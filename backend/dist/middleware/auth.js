"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
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
    return { sessionToken, csrfToken };
}
function destroySession(sessionToken) {
    activeSessions.delete(sessionToken);
}
function authMiddleware(req, res, next) {
    const sessionToken = req.cookies?.cm_session || req.headers['x-session-token'];
    if (!sessionToken || typeof sessionToken !== 'string') {
        res.status(401).json({ error: 'Authentication required. Please log in.' });
        return;
    }
    const session = activeSessions.get(sessionToken);
    if (!session || session.expiresAt < Date.now()) {
        if (session)
            activeSessions.delete(sessionToken);
        res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(session.userId);
    if (!user) {
        activeSessions.delete(sessionToken);
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
            // Allow if valid csrf token provided in header or cookie match
            if (!csrfHeader && !csrfCookie && !req.headers['x-session-token']) {
                // If neither is present and it's a browser session, verify csrf
                res.status(403).json({ error: 'Invalid or missing CSRF token.' });
                return;
            }
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
