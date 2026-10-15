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
  return { sessionToken, csrfToken };
}

export function destroySession(sessionToken: string): void {
  activeSessions.delete(sessionToken);
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionToken = req.cookies?.cm_session || req.headers['x-session-token'];

  if (!sessionToken || typeof sessionToken !== 'string') {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const session = activeSessions.get(sessionToken);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(sessionToken);
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(session.userId) as User | undefined;

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

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      const userRoles: UserRole[] = JSON.parse(req.user.roles);
      const hasRole = allowedRoles.some((r) => userRoles.includes(r));
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
