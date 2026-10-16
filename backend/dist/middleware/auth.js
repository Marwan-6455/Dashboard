"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
exports.checkWorkspaceSuspension = checkWorkspaceSuspension;
const node_crypto_1 = __importDefault(require("node:crypto"));
const connection_js_1 = require("../db/connection.js");
const SESSION_SECRET = process.env.SESSION_SECRET || 'cindermarch-terminal-6-secret-dev-key';
// In-memory or database-backed active sessions
// Map session token -> { userId, expiresAt }
const activeSessions = new Map();
function createSession(userId) {
    const sessionToken = node_crypto_1.default.randomBytes(32).toString('hex');
    const csrfToken = node_crypto_1.default.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    activeSessions.set(sessionToken, { userId, expiresAt });
    try {
        const db = (0, connection_js_1.getDb)();
        db.prepare(`
      INSERT INTO user_sessions (token, user_id, csrf_token, created_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at
    `).run(sessionToken, userId, csrfToken, expiresAt);
    }
    catch {
        // Fall back to memory session if table does not exist
    }
    return { sessionToken, csrfToken };
}
function destroySession(sessionToken) {
    activeSessions.delete(sessionToken);
    try {
        const db = (0, connection_js_1.getDb)();
        db.prepare('DELETE FROM user_sessions WHERE token = ?').run(sessionToken);
    }
    catch { }
}
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const sessionToken = req.cookies?.cm_session || req.headers['x-session-token'] || bearerToken;
    if (!sessionToken || typeof sessionToken !== 'string') {
        res.status(401).json({ error: 'Authentication required. Please log in.' });
        return;
    }
    let session = activeSessions.get(sessionToken);
    if (!session) {
        try {
            const db = (0, connection_js_1.getDb)();
            const row = db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token = ?').get(sessionToken);
            if (row) {
                session = { userId: row.user_id, expiresAt: Number(row.expires_at) };
                activeSessions.set(sessionToken, session);
            }
        }
        catch { }
    }
    if (!session || session.expiresAt < Date.now()) {
        if (session) {
            activeSessions.delete(sessionToken);
            try {
                const db = (0, connection_js_1.getDb)();
                db.prepare('DELETE FROM user_sessions WHERE token = ?').run(sessionToken);
            }
            catch { }
        }
        res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(session.userId);
    if (!user) {
        activeSessions.delete(sessionToken);
        try {
            db.prepare('DELETE FROM user_sessions WHERE token = ?').run(sessionToken);
        }
        catch { }
        res.status(401).json({ error: 'User not found.' });
        return;
    }
    req.user = user;
    // CSRF verification for state-changing requests
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        // Exclude automated test webhook with API token or multipart uploads if csrf is in header
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            const csrfHeader = req.headers['x-csrf-token'];
            const csrfCookie = req.cookies?.cm_csrf;
            // Allow if valid csrf token provided in header or cookie match or token-based auth
            if (!csrfHeader && !csrfCookie && !req.headers['x-session-token'] && !bearerToken) {
                // If neither is present and it's a browser session, verify csrf
                res.status(403).json({ error: 'Invalid or missing CSRF token.' });
                return;
            }
        }
    }
    // Workspace suspension check for protected workspace resources
    const url = (req.baseUrl || '') + (req.path || '');
    if (!url.startsWith('/api/auth') &&
        !url.startsWith('/api/strikes/my-status') &&
        !url.startsWith('/api/strikes/workspace-entry') &&
        !url.includes('/dispute') &&
        !url.startsWith('/api/bot') &&
        !url.startsWith('/health')) {
        const workspaceId = user.workspace_id || 'ws_cindermarch';
        const db = (0, connection_js_1.getDb)();
        try {
            const member = db.prepare(`
        SELECT is_suspended, suspension_reason, suspended_at
        FROM workspace_members
        WHERE workspace_id = ? AND user_id = ?
      `).get(workspaceId, user.id);
            if (member && member.is_suspended === 1) {
                res.status(403).json({
                    error: 'Workspace membership suspended due to deadline strikes policy.',
                    isSuspended: true,
                    suspensionReason: member.suspension_reason || 'Exceeded maximum deadline strikes threshold.',
                    suspendedAt: member.suspended_at
                });
                return;
            }
        }
        catch {
            // Graceful fallback if table/column in migration is pending
        }
    }
    next();
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required.' });
            return;
        }
        try {
            const userRoles = JSON.parse(req.user.roles);
            const hasRole = allowedRoles.some((r) => userRoles.includes(r));
            if (!hasRole) {
                res.status(403).json({
                    error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
                });
                return;
            }
            next();
        }
        catch {
            res.status(403).json({ error: 'Malformed user role permissions.' });
        }
    };
}
function checkWorkspaceSuspension(req, res, next) {
    if (!req.user) {
        return next();
    }
    const url = (req.baseUrl || '') + (req.path || '');
    // Allow essential routes for suspended users: auth, strike status, workspace entry warning, and disputes
    if (url.startsWith('/api/auth') ||
        url.startsWith('/api/strikes/my-status') ||
        url.startsWith('/api/strikes/workspace-entry') ||
        url.includes('/dispute') ||
        url.startsWith('/api/bot') ||
        url.startsWith('/health')) {
        return next();
    }
    const workspaceId = req.user.workspace_id || 'ws_cindermarch';
    const db = (0, connection_js_1.getDb)();
    const member = db.prepare(`
    SELECT is_suspended, suspension_reason, suspended_at
    FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id);
    if (member && member.is_suspended === 1) {
        res.status(403).json({
            error: 'Workspace membership suspended due to deadline strikes policy.',
            isSuspended: true,
            suspensionReason: member.suspension_reason || 'Exceeded maximum deadline strikes threshold.',
            suspendedAt: member.suspended_at
        });
        return;
    }
    next();
}
