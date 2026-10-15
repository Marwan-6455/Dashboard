"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
const auth_js_1 = require("../middleware/auth.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Username or email is required'),
    password: zod_1.z.string().min(1, 'Password is required')
});
const signupSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, hyphens and underscores'),
    email: zod_1.z.string().email('Invalid email address'),
    displayName: zod_1.z.string().min(2, 'Display name must be at least 2 characters'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    invitationToken: zod_1.z.string().optional(),
    workspaceName: zod_1.z.string().optional()
});
const profileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(2).optional(),
    avatarUrl: zod_1.z.string().optional(),
    currentPassword: zod_1.z.string().optional(),
    newPassword: zod_1.z.string().min(6).optional()
});
const inviteSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    role: zod_1.z.enum(['admin', 'developer', 'reviewer']).default('developer')
});
function getUserWorkspaces(userId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT w.id, w.name, w.slug, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
    ORDER BY w.name ASC
  `);
    return stmt.all(userId);
}
// POST /api/auth/login
exports.authRouter.post('/login', (0, rateLimiter_js_1.authRateLimiter)(10, 60000), (req, res) => {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    const { username, password } = parseResult.data;
    const db = (0, connection_js_1.getDb)();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    const user = stmt.get(username, username);
    if (!user) {
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
    }
    const validPassword = bcryptjs_1.default.compareSync(password, user.password_hash);
    if (!validPassword) {
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
    }
    const { sessionToken, csrfToken } = (0, auth_js_1.createSession)(user.id);
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
exports.authRouter.post('/signup', (0, rateLimiter_js_1.authRateLimiter)(5, 60000), (req, res) => {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    const { username, email, displayName, password, invitationToken, workspaceName } = parseResult.data;
    const db = (0, connection_js_1.getDb)();
    // Check if username or email already taken
    const checkStmt = db.prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?');
    const existing = checkStmt.get(username, email);
    if (existing) {
        if (existing.username.toLowerCase() === username.toLowerCase()) {
            res.status(400).json({ error: 'Username is already taken.' });
            return;
        }
        res.status(400).json({ error: 'Email is already registered.' });
        return;
    }
    const userId = `usr_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const now = new Date().toISOString();
    let targetWorkspaceId = null;
    let assignedRole = 'developer';
    // Check invitation if supplied
    if (invitationToken) {
        const invStmt = db.prepare(`
      SELECT * FROM workspace_invitations 
      WHERE invitation_token = ? AND status = 'pending'
    `);
        const inv = invStmt.get(invitationToken);
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
    }
    else if (workspaceName && workspaceName.trim()) {
        // User is creating a brand new isolated workspace
        targetWorkspaceId = `ws_${Date.now()}_${(0, uuid_1.v4)().slice(0, 6)}`;
        const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
        db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetWorkspaceId, workspaceName.trim(), slug, userId, now, now);
        assignedRole = 'owner';
    }
    else {
        // Non-invited user creates their personal development workspace so Cindermarch data stays isolated
        targetWorkspaceId = `ws_${Date.now()}_${(0, uuid_1.v4)().slice(0, 6)}`;
        const personalName = `${displayName}'s Studio`;
        const slug = `${username.toLowerCase()}-studio`.slice(0, 32);
        db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetWorkspaceId, personalName, slug, userId, now, now);
        assignedRole = 'owner';
    }
    const rolesArray = assignedRole === 'owner' ? ['owner', 'admin', 'developer'] : [assignedRole];
    // Insert user
    db.prepare(`
    INSERT INTO users (id, username, display_name, email, password_hash, roles, avatar_url, workspace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, null, ?, ?, ?)
  `).run(userId, username, displayName, email, passwordHash, JSON.stringify(rolesArray), targetWorkspaceId, now, now);
    // Insert into workspace_members
    if (targetWorkspaceId) {
        db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(`wm_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`, targetWorkspaceId, userId, assignedRole, now);
    }
    // Auto-login
    const { sessionToken, csrfToken } = (0, auth_js_1.createSession)(userId);
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
exports.authRouter.post('/logout', (req, res) => {
    const sessionToken = req.cookies?.cm_session || req.headers['x-session-token'];
    if (sessionToken && typeof sessionToken === 'string') {
        (0, auth_js_1.destroySession)(sessionToken);
    }
    res.clearCookie('cm_session');
    res.clearCookie('cm_csrf');
    res.json({ message: 'Logged out successfully.' });
});
// GET /api/auth/me
exports.authRouter.get('/me', auth_js_1.authMiddleware, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
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
exports.authRouter.patch('/profile', auth_js_1.authMiddleware, (req, res) => {
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
    const db = (0, connection_js_1.getDb)();
    const now = new Date().toISOString();
    if (newPassword) {
        if (!currentPassword) {
            res.status(400).json({ error: 'Current password is required to set a new password.' });
            return;
        }
        const validCurrent = bcryptjs_1.default.compareSync(currentPassword, req.user.password_hash);
        if (!validCurrent) {
            res.status(400).json({ error: 'Incorrect current password.' });
            return;
        }
        const newHash = bcryptjs_1.default.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);
    }
    const nextDisplayName = displayName !== undefined ? displayName : req.user.display_name;
    const nextAvatarUrl = avatarUrl !== undefined ? avatarUrl : req.user.avatar_url;
    db.prepare(`
    UPDATE users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?
  `).run(nextDisplayName, nextAvatarUrl ?? null, now, req.user.id);
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
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
exports.authRouter.post('/workspace/switch', auth_js_1.authMiddleware, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
    }
    const { workspaceId } = req.body;
    if (!workspaceId) {
        res.status(400).json({ error: 'workspaceId is required.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const memberCheck = db.prepare(`
    SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id);
    if (!memberCheck) {
        res.status(403).json({ error: 'You are not a member of this workspace.' });
        return;
    }
    db.prepare('UPDATE users SET workspace_id = ?, updated_at = ? WHERE id = ?').run(workspaceId, new Date().toISOString(), req.user.id);
    const workspaces = getUserWorkspaces(req.user.id, db);
    const activeWorkspace = workspaces.find(w => w.id === workspaceId) || null;
    res.json({ success: true, activeWorkspace, workspaces });
});
// POST /api/auth/workspace/invite
exports.authRouter.post('/workspace/invite', auth_js_1.authMiddleware, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
    }
    const parseResult = inviteSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    const { email, role } = parseResult.data;
    const db = (0, connection_js_1.getDb)();
    // Find user's active workspace
    const workspaceId = req.user.workspace_id || 'ws_cindermarch';
    // Check if caller is owner or admin in this workspace
    const memberRecord = db.prepare(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id);
    const isOwnerOrAdmin = memberRecord?.role === 'owner' || memberRecord?.role === 'admin' || JSON.parse(req.user.roles).includes('admin');
    if (!isOwnerOrAdmin) {
        res.status(403).json({ error: 'Only workspace owners or admins can invite new members.' });
        return;
    }
    const invitationToken = `inv_${Date.now()}_${(0, uuid_1.v4)().replace(/-/g, '').slice(0, 16)}`;
    const id = `inv_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days
    db.prepare(`
    INSERT INTO workspace_invitations (id, workspace_id, email, invitation_token, role, status, invited_by, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, workspaceId, email.toLowerCase(), invitationToken, role, req.user.id, now, expiresAt);
    const workspace = db.prepare('SELECT name FROM workspaces WHERE id = ?').get(workspaceId);
    res.status(201).json({
        invitation: {
            id,
            workspaceId,
            workspaceName: workspace?.name || 'Cindermarch Studio',
            email: email.toLowerCase(),
            role,
            invitationToken,
            expiresAt,
            inviteUrl: `/signup?invite=${invitationToken}`
        }
    });
});
// GET /api/auth/invitations (list invites for current workspace)
exports.authRouter.get('/invitations', auth_js_1.authMiddleware, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
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
exports.authRouter.delete('/invitations/:id', auth_js_1.authMiddleware, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const workspaceId = req.user.workspace_id || 'ws_cindermarch';
    // Check role
    const memberRecord = db.prepare(`
    SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id);
    const isOwnerOrAdmin = memberRecord?.role === 'owner' || memberRecord?.role === 'admin' || JSON.parse(req.user.roles).includes('admin');
    if (!isOwnerOrAdmin) {
        res.status(403).json({ error: 'Only owners or admins can revoke invitations.' });
        return;
    }
    db.prepare(`
    UPDATE workspace_invitations SET status = 'revoked' WHERE id = ? AND workspace_id = ?
  `).run(req.params.id, workspaceId);
    res.json({ success: true, message: 'Invitation revoked.' });
});
// GET /api/auth/invitations/verify/:token (public inspection of invite)
exports.authRouter.get('/invitations/verify/:token', (req, res) => {
    const db = (0, connection_js_1.getDb)();
    const stmt = db.prepare(`
    SELECT wi.*, w.name as workspace_name, u.display_name as invited_by_name
    FROM workspace_invitations wi
    JOIN workspaces w ON wi.workspace_id = w.id
    LEFT JOIN users u ON wi.invited_by = u.id
    WHERE wi.invitation_token = ?
  `);
    const inv = stmt.get(req.params.token);
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
