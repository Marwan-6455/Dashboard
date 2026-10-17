import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { AuthenticatedRequest, authMiddleware, createSession, destroySession } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { User, UserRole, Workspace } from '../types/index.js';
import { AdminService } from '../services/adminService.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, hyphens and underscores'),
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  invitationToken: z.string().optional(),
  workspaceName: z.string().optional()
});

const profileSchema = z.object({
  displayName: z.string().min(2).optional(),
  avatarUrl: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional()
});

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['super_admin', 'team_manager', 'team_member', 'admin', 'developer', 'reviewer']).default('team_member'),
  teamId: z.string().optional()
});

function getUserWorkspaces(userId: string, db = getDb()): Array<{ id: string; name: string; slug: string; role: UserRole }> {
  const stmt = db.prepare(`
    SELECT w.id, w.name, w.slug, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
    ORDER BY w.name ASC
  `);
  return stmt.all(userId) as Array<{ id: string; name: string; slug: string; role: UserRole }>;
}

// POST /api/auth/login
authRouter.post('/login', authRateLimiter(10, 60000), (req: Request, res: Response): void => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const { username, password } = parseResult.data;
  const db = getDb();
  const trimmed = username.trim();
  const stmt = db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(username) = LOWER(?) 
       OR LOWER(email) = LOWER(?) 
       OR (id = 'usr_lead' AND LOWER(?) IN ('marwan', 'marwan hossam', 'marwan_hossam', 'lead', 'engine lead'))
       OR (id = 'usr_joe' AND LOWER(?) IN ('joe', 'joe dev'))
       OR (id = 'usr_yehia' AND LOWER(?) IN ('yehia', 'yehia dev'))
  `);
  const user = stmt.get(trimmed, trimmed, trimmed, trimmed, trimmed) as User | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const { sessionToken, csrfToken } = createSession(user.id);

  // Set secure HTTP-only session cookie
  res.cookie('cm_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  // Set CSRF cookie accessible to frontend JS
  res.cookie('cm_csrf', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  const workspaces = getUserWorkspaces(user.id, db);
  const activeWorkspace = workspaces.find(w => w.id === user.workspace_id) || workspaces[0] || null;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      roles: JSON.parse(user.roles),
      avatarUrl: user.avatar_url || null,
      workspaceId: activeWorkspace ? activeWorkspace.id : null
    },
    workspaces,
    activeWorkspace,
    sessionToken,
    csrfToken
  });
});

// POST /api/auth/signup
authRouter.post('/signup', authRateLimiter(5, 60000), (req: Request, res: Response): void => {
  const parseResult = signupSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const { username, email, displayName, password, invitationToken, workspaceName } = parseResult.data;
  const db = getDb();

  // Check if username or email already taken
  const checkStmt = db.prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?');
  const existing = checkStmt.get(username, email) as { id: string; username: string; email: string } | undefined;
  if (existing) {
    if (existing.username.toLowerCase() === username.toLowerCase()) {
      res.status(400).json({ error: 'Username is already taken.' });
      return;
    }
    res.status(400).json({ error: 'Email is already registered.' });
    return;
  }

  const userId = `usr_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  let targetWorkspaceId: string | null = null;
  let assignedRole: UserRole = 'developer';

  // Check invitation if supplied
  if (invitationToken) {
    const invStmt = db.prepare(`
      SELECT * FROM workspace_invitations 
      WHERE invitation_token = ? AND status = 'pending'
    `);
    const inv = invStmt.get(invitationToken) as any;

    if (!inv) {
      res.status(400).json({ error: 'Invalid or expired invitation token.' });
      return;
    }

    if (new Date(inv.expires_at).getTime() < Date.now()) {
      db.prepare("UPDATE workspace_invitations SET status = 'expired' WHERE id = ?").run(inv.id);
      res.status(400).json({ error: 'This invitation token has expired.' });
      return;
    }

    targetWorkspaceId = inv.workspace_id;
    assignedRole = inv.role;

    // Mark invitation accepted
    db.prepare("UPDATE workspace_invitations SET status = 'accepted' WHERE id = ?").run(inv.id);
  } else if (workspaceName && workspaceName.trim()) {
    // User is creating a brand new isolated workspace
    targetWorkspaceId = `ws_${Date.now()}_${uuidv4().slice(0, 6)}`;
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetWorkspaceId, workspaceName.trim(), slug, userId, now, now);
    assignedRole = 'owner';
  } else {
    // Non-invited user creates their personal development workspace so Cindermarch data stays isolated
    targetWorkspaceId = `ws_${Date.now()}_${uuidv4().slice(0, 6)}`;
    const personalName = `${displayName}'s Studio`;
    const slug = `${username.toLowerCase()}-studio`.slice(0, 32);
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetWorkspaceId, personalName, slug, userId, now, now);
    assignedRole = 'owner';
  }

  const rolesArray: UserRole[] = assignedRole === 'owner' ? ['owner', 'admin', 'developer'] : [assignedRole];

  // Insert user
  db.prepare(`
    INSERT INTO users (id, username, display_name, email, password_hash, roles, avatar_url, workspace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, null, ?, ?, ?)
  `).run(
    userId,
    username,
    displayName,
    email,
    passwordHash,
    JSON.stringify(rolesArray),
    targetWorkspaceId,
    now,
    now
  );

  // Insert into workspace_members
  if (targetWorkspaceId) {
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `wm_${Date.now()}_${uuidv4().slice(0, 8)}`,
      targetWorkspaceId,
      userId,
      assignedRole,
      now
    );
  }

  // Auto-login
  const { sessionToken, csrfToken } = createSession(userId);

  res.cookie('cm_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.cookie('cm_csrf', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  const workspaces = getUserWorkspaces(userId, db);
  const activeWorkspace = workspaces.find(w => w.id === targetWorkspaceId) || workspaces[0] || null;

  res.status(201).json({
    user: {
      id: userId,
      username,
      displayName,
      email,
      roles: rolesArray,
      avatarUrl: null,
      workspaceId: targetWorkspaceId
    },
    workspaces,
    activeWorkspace,
    sessionToken,
    csrfToken
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: AuthenticatedRequest, res: Response): void => {
  const sessionToken = req.cookies?.cm_session || req.headers['x-session-token'];
  if (sessionToken && typeof sessionToken === 'string') {
    destroySession(sessionToken);
  }

  res.clearCookie('cm_session');
  res.clearCookie('cm_csrf');
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const db = getDb();
  const workspaces = getUserWorkspaces(req.user.id, db);
  const activeWorkspace = workspaces.find(w => w.id === req.user?.workspace_id) || workspaces[0] || null;

  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.display_name,
      email: req.user.email,
      roles: JSON.parse(req.user.roles),
      avatarUrl: req.user.avatar_url || null,
      workspaceId: activeWorkspace ? activeWorkspace.id : null
    },
    workspaces,
    activeWorkspace
  });
});

// PATCH /api/auth/profile
authRouter.patch('/profile', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const parseResult = profileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const { displayName, avatarUrl, currentPassword, newPassword } = parseResult.data;
  const db = getDb();
  const now = new Date().toISOString();

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to set a new password.' });
      return;
    }
    const validCurrent = bcrypt.compareSync(currentPassword, req.user.password_hash);
    if (!validCurrent) {
      res.status(400).json({ error: 'Incorrect current password.' });
      return;
    }
    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);
  }

  const nextDisplayName = displayName !== undefined ? displayName : req.user.display_name;
  const nextAvatarUrl = avatarUrl !== undefined ? avatarUrl : req.user.avatar_url;

  db.prepare(`
    UPDATE users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?
  `).run(nextDisplayName, nextAvatarUrl ?? null, now, req.user.id);

  const updatedUser = (db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as unknown) as User;
  const workspaces = getUserWorkspaces(req.user.id, db);
  const activeWorkspace = workspaces.find(w => w.id === updatedUser.workspace_id) || workspaces[0] || null;

  res.json({
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.display_name,
      email: updatedUser.email,
      roles: JSON.parse(updatedUser.roles),
      avatarUrl: updatedUser.avatar_url || null,
      workspaceId: activeWorkspace ? activeWorkspace.id : null
    },
    workspaces,
    activeWorkspace
  });
});

// POST /api/auth/workspace/switch
authRouter.post('/workspace/switch', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const { workspaceId } = req.body;
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required.' });
    return;
  }

  const db = getDb();
  const memberCheck = db.prepare(`
    SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id);

  if (!memberCheck) {
    res.status(403).json({ error: 'You are not a member of this workspace.' });
    return;
  }

  db.prepare('UPDATE users SET workspace_id = ?, updated_at = ? WHERE id = ?').run(
    workspaceId,
    new Date().toISOString(),
    req.user.id
  );

  const workspaces = getUserWorkspaces(req.user.id, db);
  const activeWorkspace = workspaces.find(w => w.id === workspaceId) || null;

  res.json({ success: true, activeWorkspace, workspaces });
});

// POST /api/auth/workspace/invite
authRouter.post('/workspace/invite', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const parseResult = inviteSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const { email, role, teamId } = parseResult.data;
  const db = getDb();

  // Find user's active workspace
  const workspaceId = req.user.workspace_id || 'ws_cindermarch';
  const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(workspaceId) as any;
  const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

  // Check if caller is owner or super_admin in this workspace
  const memberRecord = db.prepare(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id) as { role: UserRole } | undefined;

  let callerRoles: string[] = [];
  try {
    callerRoles = JSON.parse(req.user.roles || '[]');
  } catch {}

  const isOwner = req.user.id === primaryOwnerId || memberRecord?.role === 'owner' || callerRoles.includes('owner');
  const isSuperAdminOrAdmin = memberRecord?.role === 'super_admin' || memberRecord?.role === 'admin' || callerRoles.includes('admin') || callerRoles.includes('super_admin');

  if (!isOwner && !isSuperAdminOrAdmin) {
    res.status(403).json({ error: 'Only workspace owners or super admins can invite new members.' });
    return;
  }

  // If inviting as super_admin, only Primary Owner can do so and slots must be available
  if (role === 'super_admin') {
    if (!isOwner) {
      res.status(403).json({ error: 'Only the Primary Owner can create invitations for Super Admin accounts.' });
      return;
    }
    const currentSuperAdmins = (db.prepare(`
      SELECT COUNT(*) as c FROM workspace_members 
      WHERE workspace_id = ? AND role = 'super_admin' AND user_id != ?
    `).get(workspaceId, primaryOwnerId) as any)?.c || 0;

    if (currentSuperAdmins >= 2) {
      res.status(400).json({ error: 'Super Admin slot limit reached: Exactly two Super Admin accounts can be appointed alongside the Primary Owner.' });
      return;
    }
  }

  const invitationToken = `inv_${Date.now()}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const id = `inv_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

  db.prepare(`
    INSERT INTO workspace_invitations (id, workspace_id, email, invitation_token, role, team_id, status, invited_by, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, workspaceId, email.toLowerCase(), invitationToken, role, teamId || null, req.user.id, now, expiresAt);

  AdminService.logAudit({
    workspaceId,
    actorId: req.user.id,
    actorName: req.user.display_name,
    action: 'invitation_created',
    targetType: 'invitation',
    targetId: id,
    targetName: email.toLowerCase(),
    details: { email: email.toLowerCase(), role, teamId }
  });

  const workspace = db.prepare('SELECT name FROM workspaces WHERE id = ?').get(workspaceId) as { name: string } | undefined;

  res.status(201).json({
    invitation: {
      id,
      workspaceId,
      workspaceName: workspace?.name || 'Cindermarch Studio',
      email: email.toLowerCase(),
      role,
      teamId: teamId || null,
      invitationToken,
      expiresAt,
      inviteUrl: `/signup?invite=${invitationToken}`
    }
  });
});

// GET /api/auth/invitations (list invites for current workspace)
authRouter.get('/invitations', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const db = getDb();
  const workspaceId = req.user.workspace_id || 'ws_cindermarch';

  const stmt = db.prepare(`
    SELECT wi.*, u.display_name as invited_by_name
    FROM workspace_invitations wi
    LEFT JOIN users u ON wi.invited_by = u.id
    WHERE wi.workspace_id = ?
    ORDER BY wi.created_at DESC
  `);

  const invitations = stmt.all(workspaceId);
  res.json({ invitations });
});

// DELETE /api/auth/invitations/:id (revoke invitation)
authRouter.delete('/invitations/:id', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const db = getDb();
  const workspaceId = req.user.workspace_id || 'ws_cindermarch';

  // Check role
  const memberRecord = db.prepare(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id) as { role: UserRole } | undefined;

  let callerRoles: string[] = [];
  try {
    callerRoles = JSON.parse(req.user.roles || '[]');
  } catch {}

  const isOwnerOrAdmin =
    memberRecord?.role === 'owner' ||
    memberRecord?.role === 'super_admin' ||
    memberRecord?.role === 'admin' ||
    callerRoles.includes('owner') ||
    callerRoles.includes('super_admin') ||
    callerRoles.includes('admin');

  if (!isOwnerOrAdmin) {
    res.status(403).json({ error: 'Only owners or admins can revoke invitations.' });
    return;
  }

  const inv = db.prepare('SELECT email FROM workspace_invitations WHERE id = ?').get(req.params.id) as any;

  db.prepare(`
    UPDATE workspace_invitations SET status = 'revoked' WHERE id = ? AND workspace_id = ?
  `).run(req.params.id, workspaceId);

  AdminService.logAudit({
    workspaceId,
    actorId: req.user.id,
    actorName: req.user.display_name,
    action: 'invitation_revoked',
    targetType: 'invitation',
    targetId: req.params.id,
    targetName: inv?.email || req.params.id
  });

  res.json({ success: true, message: 'Invitation revoked.' });
});

// GET /api/auth/invitations/verify/:token (public inspection of invite)
authRouter.get('/invitations/verify/:token', (req: Request, res: Response): void => {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT wi.*, w.name as workspace_name, u.display_name as invited_by_name
    FROM workspace_invitations wi
    JOIN workspaces w ON wi.workspace_id = w.id
    LEFT JOIN users u ON wi.invited_by = u.id
    WHERE wi.invitation_token = ?
  `);

  const inv = stmt.get(req.params.token) as any;
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found.' });
    return;
  }

  const isExpired = new Date(inv.expires_at).getTime() < Date.now();
  if (isExpired || inv.status !== 'pending') {
    res.status(400).json({
      error: isExpired ? 'This invitation has expired.' : `Invitation is ${inv.status}.`,
      status: inv.status
    });
    return;
  }

  res.json({
    valid: true,
    email: inv.email,
    role: inv.role,
    workspaceName: inv.workspace_name,
    invitedByName: inv.invited_by_name || 'Team Lead',
    expiresAt: inv.expires_at
  });
});

// POST /api/auth/invitations/accept (for authenticated users joining a workspace)
authRouter.post('/invitations/accept', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const { invitationToken } = req.body;
  if (!invitationToken || typeof invitationToken !== 'string') {
    res.status(400).json({ error: 'invitationToken is required.' });
    return;
  }

  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM workspace_invitations 
    WHERE invitation_token = ? AND status = 'pending'
  `);
  const inv = stmt.get(invitationToken.trim()) as any;

  if (!inv) {
    res.status(400).json({ error: 'Invalid or expired invitation token.' });
    return;
  }

  if (new Date(inv.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE workspace_invitations SET status = 'expired' WHERE id = ?").run(inv.id);
    res.status(400).json({ error: 'This invitation token has expired.' });
    return;
  }

  const now = new Date().toISOString();

  // Add to workspace_members
  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role
  `).run(`wm_${Date.now()}_${uuidv4().slice(0, 8)}`, inv.workspace_id, req.user.id, inv.role, now);

  // Mark invitation accepted
  db.prepare("UPDATE workspace_invitations SET status = 'accepted' WHERE id = ?").run(inv.id);

  // Update user active workspace
  db.prepare('UPDATE users SET workspace_id = ?, updated_at = ? WHERE id = ?').run(inv.workspace_id, now, req.user.id);

  const workspaces = getUserWorkspaces(req.user.id, db);
  const activeWorkspace = workspaces.find((w) => w.id === inv.workspace_id) || null;

  res.json({
    success: true,
    message: 'Successfully joined workspace.',
    activeWorkspace,
    workspaces
  });
});

