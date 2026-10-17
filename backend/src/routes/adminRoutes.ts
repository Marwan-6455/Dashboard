import { Router, Response } from 'express';
import { getDb } from '../db/connection.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { AdminService } from '../services/adminService.js';
import { UserRole } from '../types/index.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);

// Middleware enforcing that caller is at least a Super Admin or Owner
function requireAdminAccess(req: AuthenticatedRequest, res: Response, next: () => void) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const workspaceId = req.user.workspace_id || 'ws_cindermarch';
  const db = getDb();

  const member = db.prepare(`
    SELECT role, is_suspended, status 
    FROM workspace_members 
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id) as any;

  if (!member || member.is_suspended === 1 || member.status === 'suspended') {
    res.status(403).json({ error: 'Access denied: Your account is suspended.' });
    return;
  }

  let callerRoles: string[] = [];
  try {
    callerRoles = JSON.parse(req.user.roles || '[]');
  } catch {}

  const isSuperAdminOrOwner =
    member.role === 'owner' ||
    member.role === 'super_admin' ||
    member.role === 'admin' ||
    callerRoles.includes('owner') ||
    callerRoles.includes('super_admin') ||
    callerRoles.includes('admin');

  if (!isSuperAdminOrOwner) {
    res.status(403).json({
      error: 'Access denied: Administration portal requires Super Admin or Primary Owner access.'
    });
    return;
  }

  next();
}

adminRouter.use(requireAdminAccess);

// GET /api/admin/overview
adminRouter.get('/overview', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  try {
    const overview = AdminService.getAdminOverview(workspaceId, req.user!.id);
    res.json(overview);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/members (full searchable directory with roles and teams)
adminRouter.get('/members', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const { search, role, status, teamId } = req.query;

  let query = `
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.email,
      u.avatar_url,
      u.created_at,
      wm.role as workspace_role,
      wm.status as membership_status,
      wm.is_suspended,
      wm.suspended_at,
      wm.suspension_reason,
      wm.reinstated_at,
      wm.reinstatement_reason,
      (SELECT COUNT(*) FROM tasks WHERE owner_id = u.id AND (workspace_id = ? OR workspace_id IS NULL) AND status != 'Verified Complete') as active_tasks_count,
      (SELECT COUNT(*) FROM tasks WHERE owner_id = u.id AND (workspace_id = ? OR workspace_id IS NULL) AND status = 'Verified Complete') as completed_tasks_count,
      (SELECT COUNT(*) FROM strikes WHERE user_id = u.id AND workspace_id = ? AND status = 'active') as active_strikes_count,
      (SELECT json_group_array(json_object('teamId', tm.team_id, 'teamName', t.name, 'role', tm.role))
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.user_id = u.id) as teams_json
    FROM users u
    JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = ?
    WHERE u.id != 'usr_cindermarch_assistant'
  `;

  const params: any[] = [workspaceId, workspaceId, workspaceId, workspaceId];

  if (search && typeof search === 'string' && search.trim()) {
    query += ' AND (u.display_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  if (role && typeof role === 'string' && role.trim()) {
    query += ' AND wm.role = ?';
    params.push(role.trim());
  }

  if (status && typeof status === 'string' && status.trim()) {
    if (status === 'suspended') {
      query += ' AND (wm.is_suspended = 1 OR wm.status = ?)';
      params.push('suspended');
    } else {
      query += ' AND wm.status = ? AND wm.is_suspended = 0';
      params.push(status.trim());
    }
  }

  query += ' ORDER BY CASE WHEN wm.role = \'owner\' THEN 1 WHEN wm.role = \'super_admin\' THEN 2 ELSE 3 END, u.created_at ASC';

  const rows = db.prepare(query).all(...params) as any[];

  let members = rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    email: r.email,
    avatarUrl: r.avatar_url,
    createdAt: r.created_at,
    role: r.workspace_role as UserRole,
    status: r.is_suspended === 1 ? 'suspended' : r.membership_status || 'active',
    isSuspended: r.is_suspended === 1,
    suspendedAt: r.suspended_at,
    suspensionReason: r.suspension_reason,
    reinstatedAt: r.reinstated_at,
    reinstatementReason: r.reinstatement_reason,
    activeTasksCount: r.active_tasks_count || 0,
    completedTasksCount: r.completed_tasks_count || 0,
    activeStrikesCount: r.active_strikes_count || 0,
    teams: JSON.parse(r.teams_json || '[]')
  }));

  if (teamId && typeof teamId === 'string' && teamId.trim()) {
    members = members.filter((m) => m.teams.some((t: any) => t.teamId === teamId.trim()));
  }

  res.json({ members });
});

// POST /api/admin/super-admins/appoint (Primary Owner only, capped at 2)
adminRouter.post('/super-admins/appoint', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const { targetUserId, passwordConfirmation, reason } = req.body;

  if (!targetUserId) {
    res.status(400).json({ error: 'targetUserId is required.' });
    return;
  }

  if (!passwordConfirmation) {
    res.status(400).json({ error: 'Primary Owner password confirmation is required for sensitive Super Admin promotions.' });
    return;
  }

  try {
    const result = AdminService.appointSuperAdmin({
      workspaceId,
      actorId: req.user!.id,
      targetUserId,
      passwordConfirmation,
      reason
    });
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('Access denied')
      ? 403
      : err.message.includes('Reauthentication failed')
      ? 401
      : 400;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/admin/super-admins/revoke (Primary Owner only)
adminRouter.post('/super-admins/revoke', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const { targetUserId, passwordConfirmation, reason } = req.body;

  if (!targetUserId) {
    res.status(400).json({ error: 'targetUserId is required.' });
    return;
  }

  if (!passwordConfirmation) {
    res.status(400).json({ error: 'Primary Owner password confirmation is required to revoke Super Admin status.' });
    return;
  }

  try {
    const result = AdminService.revokeSuperAdmin({
      workspaceId,
      actorId: req.user!.id,
      targetUserId,
      passwordConfirmation,
      reason
    });
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('Access denied')
      ? 403
      : err.message.includes('Reauthentication failed')
      ? 401
      : 400;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/admin/members/:id/role
adminRouter.post('/members/:id/role', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const targetUserId = req.params.id;
  const { role } = req.body;

  if (!role) {
    res.status(400).json({ error: 'Role is required.' });
    return;
  }

  try {
    const result = AdminService.changeMemberRole({
      workspaceId,
      actorId: req.user!.id,
      targetUserId,
      newRole: role
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/members/:id/suspend
adminRouter.post('/members/:id/suspend', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const targetUserId = req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'A documented reason is required to suspend a member.' });
    return;
  }

  try {
    const result = AdminService.suspendMember({
      workspaceId,
      actorId: req.user!.id,
      targetUserId,
      reason
    });
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : 400;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/admin/members/:id/reinstate
adminRouter.post('/members/:id/reinstate', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const targetUserId = req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'A documented reason is required to reinstate a member.' });
    return;
  }

  try {
    const result = AdminService.reinstateMember({
      workspaceId,
      actorId: req.user!.id,
      targetUserId,
      reason
    });
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : 400;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/admin/members/:id/reassign-tasks
adminRouter.post('/members/:id/reassign-tasks', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const fromUserId = req.params.id;
  const { toUserId, reason } = req.body;

  if (!toUserId) {
    res.status(400).json({ error: 'toUserId is required.' });
    return;
  }

  try {
    const result = AdminService.reassignTasks({
      workspaceId,
      actorId: req.user!.id,
      fromUserId,
      toUserId,
      reason
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/pending-approvals
adminRouter.get('/pending-approvals', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, wm.joined_at, wm.status
    FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    WHERE wm.workspace_id = ? AND wm.status = 'pending_approval'
    ORDER BY wm.joined_at DESC
  `).all(workspaceId);

  res.json({ pendingMembers: rows });
});

// POST /api/admin/pending-approvals/:id/approve
adminRouter.post('/pending-approvals/:id/approve', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const userId = req.params.id;
  const { role, teamId } = req.body;

  try {
    const result = AdminService.approveMembership({
      workspaceId,
      actorId: req.user!.id,
      userId,
      role,
      teamId
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/pending-approvals/:id/reject
adminRouter.post('/pending-approvals/:id/reject', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const userId = req.params.id;
  const { reason } = req.body;

  try {
    const result = AdminService.rejectMembership({
      workspaceId,
      actorId: req.user!.id,
      userId,
      reason
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/audit-log
adminRouter.get('/audit-log', (req: AuthenticatedRequest, res: Response): void => {
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  const action = req.query.action as string | undefined;
  const search = req.query.search as string | undefined;

  try {
    const result = AdminService.getAuditLog({
      workspaceId,
      limit,
      offset,
      action,
      search
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
