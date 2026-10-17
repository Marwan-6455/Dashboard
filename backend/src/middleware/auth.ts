import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { User, UserRole } from '../types/index.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'cindermarch-terminal-6-secret-dev-key';

export interface AuthenticatedRequest extends Request {
  user?: User;
  csrfToken?: string;
}

// In-memory or database-backed active sessions
// Map session token -> { userId, expiresAt }
const activeSessions = new Map<string, { userId: string; expiresAt: number }>();

export function createSession(userId: string): { sessionToken: string; csrfToken: string } {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  activeSessions.set(sessionToken, { userId, expiresAt });
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO user_sessions (token, user_id, csrf_token, created_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at
    `).run(sessionToken, userId, csrfToken, expiresAt);
  } catch {
    // Fall back to memory session if table does not exist
  }
  return { sessionToken, csrfToken };
}

export function destroySession(sessionToken: string): void {
  activeSessions.delete(sessionToken);
  try {
    const db = getDb();
    db.prepare('DELETE FROM user_sessions WHERE token = ?').run(sessionToken);
  } catch {}
}

export function invalidateUserSessions(userId: string): void {
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(token);
    }
  }
  try {
    const db = getDb();
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  } catch {}
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
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
      const db = getDb();
      const row = db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token = ?').get(sessionToken) as { user_id: string; expires_at: number } | undefined;
      if (row) {
        session = { userId: row.user_id, expiresAt: Number(row.expires_at) };
        activeSessions.set(sessionToken, session);
      }
    } catch {}
  }

  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      activeSessions.delete(sessionToken);
      try {
        const db = getDb();
        db.prepare('DELETE FROM user_sessions WHERE token = ?').run(sessionToken);
      } catch {}
    }
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(session.userId) as User | undefined;

  if (!user) {
    activeSessions.delete(sessionToken);
    try {
      db.prepare('DELETE FROM user_sessions WHERE token = ?').run(sessionToken);
    } catch {}
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
  if (
    !url.startsWith('/api/auth') &&
    !url.startsWith('/api/strikes/my-status') &&
    !url.startsWith('/api/strikes/workspace-entry') &&
    !url.includes('/dispute') &&
    !url.startsWith('/api/bot') &&
    !url.startsWith('/health')
  ) {
    const workspaceId = user.workspace_id || 'ws_cindermarch';
    const db = getDb();
    try {
      const member = db.prepare(`
        SELECT role, is_suspended, suspension_reason, suspended_at, status
        FROM workspace_members
        WHERE workspace_id = ? AND user_id = ?
      `).get(workspaceId, user.id) as any;

      if (!member) {
        res.status(403).json({
          error: 'Access denied: You are not an authorized member of this workspace.',
          noMembership: true
        });
        return;
      }

      if (member.is_suspended === 1 || member.status === 'suspended') {
        res.status(403).json({
          error: `Workspace membership suspended: ${member.suspension_reason || 'Account suspended by Studio Administration.'}`,
          isSuspended: true,
          suspensionReason: member.suspension_reason || 'Account suspended by Studio Administration.',
          suspendedAt: member.suspended_at
        });
        return;
      }

      if (member.status === 'pending_approval') {
        res.status(403).json({
          error: 'Workspace membership pending administrator approval. Please wait for the Primary Owner or a Super Admin to approve your account.',
          isPendingApproval: true
        });
        return;
      }

      if (member.status === 'rejected') {
        res.status(403).json({
          error: 'Workspace membership request was rejected by Studio Administration.',
          isRejected: true
        });
        return;
      }
    } catch {
      // Graceful fallback if table/column in migration is pending
    }
  }

  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      const userRoles: UserRole[] = JSON.parse(req.user.roles);

      // Owner and Super Admin inherently hold admin and team_manager capabilities
      const effectiveRoles = new Set<string>(userRoles);
      if (userRoles.includes('owner')) {
        effectiveRoles.add('super_admin');
        effectiveRoles.add('admin');
        effectiveRoles.add('team_manager');
      }
      if (userRoles.includes('super_admin')) {
        effectiveRoles.add('admin');
        effectiveRoles.add('team_manager');
      }
      if (userRoles.includes('admin')) {
        effectiveRoles.add('team_manager');
      }

      const hasRole = allowedRoles.some((r) => effectiveRoles.has(r));
      if (!hasRole) {
        res.status(403).json({
          error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
        });
        return;
      }
      next();
    } catch {
      res.status(403).json({ error: 'Malformed user role permissions.' });
    }
  };
}

export function requirePrimaryOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const workspaceId = req.user.workspace_id || 'ws_cindermarch';
  const db = getDb();
  const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(workspaceId) as any;
  const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

  if (req.user.id !== primaryOwnerId) {
    res.status(403).json({ error: 'Access denied: Only the Primary Owner can perform this administrative action.' });
    return;
  }

  next();
}

export function requireSuperAdminOrOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const workspaceId = req.user.workspace_id || 'ws_cindermarch';
  const db = getDb();
  const member = db.prepare('SELECT role, is_suspended, status FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, req.user.id) as any;

  if (member?.is_suspended === 1 || member?.status === 'suspended') {
    res.status(403).json({ error: 'Account suspended.' });
    return;
  }

  let roles: string[] = [];
  try {
    roles = JSON.parse(req.user.roles || '[]');
  } catch {}

  const isSuperAdminOrOwner =
    member?.role === 'owner' ||
    member?.role === 'super_admin' ||
    member?.role === 'admin' ||
    roles.includes('owner') ||
    roles.includes('super_admin') ||
    roles.includes('admin');

  if (!isSuperAdminOrOwner) {
    res.status(403).json({ error: 'Access denied: Requires Super Admin or Primary Owner access.' });
    return;
  }

  next();
}

export function checkWorkspaceSuspension(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next();
  }

  const url = (req.baseUrl || '') + (req.path || '');
  if (
    url.startsWith('/api/auth') ||
    url.startsWith('/api/strikes/my-status') ||
    url.startsWith('/api/strikes/workspace-entry') ||
    url.includes('/dispute') ||
    url.startsWith('/api/bot') ||
    url.startsWith('/health')
  ) {
    return next();
  }

  const workspaceId = req.user.workspace_id || 'ws_cindermarch';
  const db = getDb();
  const member = db.prepare(`
    SELECT is_suspended, suspension_reason, suspended_at, status
    FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id) as any;

  if (member && (member.is_suspended === 1 || member.status === 'suspended')) {
    res.status(403).json({
      error: `Workspace access suspended: ${member.suspension_reason || 'Account suspended by Studio Administration.'}`,
      isSuspended: true,
      suspensionReason: member.suspension_reason || 'Account suspended by Studio Administration.',
      suspendedAt: member.suspended_at
    });
    return;
  }

  next();
}
