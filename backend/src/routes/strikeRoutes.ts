import { Router, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getStrikePolicy,
  updateStrikePolicy,
  calculateActiveStrikes,
  getWarningLevel,
  recordWorkspaceEntry,
  reverseStrike,
  excuseStrike,
  submitStrikeDispute,
  reviewStrikeDispute,
  suspendMember,
  reinstateMember,
  evaluateOverdueDeadlines
} from '../services/strikeService.js';

export const strikeRouter = Router();

// Apply auth middleware to all strike routes
strikeRouter.use(authMiddleware);

const disputeSchema = z.object({
  reason: z.string().min(5, 'A clear reason for the dispute is required (minimum 5 characters).')
});

const reviewDisputeSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().min(3, 'Review notes are required.')
});

const reverseStrikeSchema = z.object({
  reason: z.string().min(5, 'A documented reason is required to reverse a strike.')
});

const reinstateSchema = z.object({
  reason: z.string().min(5, 'A documented reason is required to reinstate a suspended member.')
});

const suspendSchema = z.object({
  reason: z.string().min(5, 'A documented reason is required for suspension.')
});

/**
 * GET /api/strikes/my-status
 * Member view: current strike count, warning level, tasks causing strikes, upcoming deadlines, suspension status
 */
strikeRouter.get('/my-status', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const db = getDb();
  const workspaceId = req.user.workspace_id || 'ws_cindermarch';
  const policy = getStrikePolicy(workspaceId, db);

  // Authoritative strike count directly from backend database
  const activeStrikes = calculateActiveStrikes(workspaceId, req.user.id, db);
  const warningLevel = getWarningLevel(activeStrikes, policy.strike_threshold);
  const remainingStrikes = Math.max(0, policy.strike_threshold - activeStrikes);

  // Check workspace member suspension status
  const member = db.prepare(`
    SELECT is_suspended, suspension_reason, suspended_at, role
    FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.id) as { is_suspended: number; suspension_reason: string; suspended_at: string; role: string } | undefined;

  const isSuspended = (member?.is_suspended === 1) || (activeStrikes >= policy.strike_threshold);

  // Fetch all strikes for this member
  const allStrikes = db.prepare(`
    SELECT 
      s.*,
      t.title as task_title,
      t.priority as task_priority,
      t.status as task_status,
      u_rev.display_name as reversed_by_name,
      u_rev.username as reversed_by_username
    FROM strikes s
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN users u_rev ON s.reversed_by = u_rev.id
    WHERE s.workspace_id = ? AND s.user_id = ?
    ORDER BY s.detected_at DESC
  `).all(workspaceId, req.user.id);

  // Active strikes
  const activeStrikesList = allStrikes.filter((s: any) => s.status === 'active' || s.status === 'disputed');

  // Upcoming deadlines for this user (next 14 days)
  const upcomingDeadlines = db.prepare(`
    SELECT t.id, t.title, t.priority, t.status, t.deadline, t.extended_deadline, t.category
    FROM tasks t
    WHERE (t.workspace_id = ? OR t.workspace_id IS NULL)
      AND t.owner_id = ?
      AND t.status != 'Verified Complete'
      AND (t.deadline IS NOT NULL OR t.extended_deadline IS NOT NULL)
    ORDER BY COALESCE(t.extended_deadline, t.deadline) ASC
    LIMIT 10
  `).all(workspaceId, req.user.id);

  res.json({
    activeStrikes,
    maxThreshold: policy.strike_threshold,
    remainingStrikes,
    warningLevel,
    isSuspended,
    suspensionReason: member?.suspension_reason || null,
    suspendedAt: member?.suspended_at || null,
    activeStrikesList,
    allStrikes,
    upcomingDeadlines,
    policy: {
      strike_threshold: policy.strike_threshold,
      grace_period_hours: policy.grace_period_hours,
      timezone: policy.timezone
    }
  });
});

/**
 * POST /api/strikes/workspace-entry
 * Workspace-entry warning: Records entry, refreshes count, triggers Discord DM if linked, deduplicates per session
 */
strikeRouter.post('/workspace-entry', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required to track workspace-entry session.' });
    return;
  }

  const db = getDb();
  const workspaceId = req.user.workspace_id || 'ws_cindermarch';

  const entryData = recordWorkspaceEntry(workspaceId, req.user.id, sessionId, db);
  res.json(entryData);
});

/**
 * POST /api/strikes/:id/dispute
 * Member submits a dispute for a qualifying strike
 */
strikeRouter.post('/:id/dispute', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parseResult = disputeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const db = getDb();
    const updated = submitStrikeDispute(req.params.id, req.user.id, parseResult.data.reason, db);
    res.json({ success: true, strike: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/strikes/policy
 * Get workspace strike policy
 */
strikeRouter.get('/policy', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const policy = getStrikePolicy(workspaceId, db);
  res.json({ policy });
});

/**
 * PATCH /api/strikes/policy
 * Update workspace strike policy (Admin only, audited)
 */
strikeRouter.patch('/policy', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const db = getDb();
    const workspaceId = req.user.workspace_id || 'ws_cindermarch';
    const updated = updateStrikePolicy(workspaceId, req.body, req.user.id, db);
    res.json({ success: true, policy: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/strikes/overview
 * Workspace Owner/Admin view: Strike overview across authorized teams, filters by team and member
 */
strikeRouter.get('/overview', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const policy = getStrikePolicy(workspaceId, db);

  const teamId = req.query.teamId as string | undefined;
  const userId = req.query.userId as string | undefined;

  let memberQuery = `
    SELECT 
      u.id, u.username, u.display_name, u.email, u.avatar_url,
      wm.role as workspace_role,
      wm.is_suspended,
      wm.suspended_at,
      wm.suspension_reason,
      dal.discord_username,
      dal.discord_user_id,
      (SELECT COUNT(*) FROM strikes s WHERE s.workspace_id = ? AND s.user_id = u.id AND s.status = 'active') as active_strikes,
      (SELECT COUNT(*) FROM strikes s WHERE s.workspace_id = ? AND s.user_id = u.id AND s.status = 'disputed') as disputed_strikes,
      (SELECT COUNT(*) FROM strikes s WHERE s.workspace_id = ? AND s.user_id = u.id) as total_strikes,
      (SELECT COUNT(*) FROM tasks t WHERE t.owner_id = u.id AND t.status != 'Verified Complete') as open_tasks
    FROM users u
    JOIN workspace_members wm ON u.id = wm.user_id AND wm.workspace_id = ?
    LEFT JOIN discord_account_links dal ON u.id = dal.user_id
    WHERE 1=1
  `;

  const params: any[] = [workspaceId, workspaceId, workspaceId, workspaceId];

  if (userId) {
    memberQuery += ' AND u.id = ?';
    params.push(userId);
  }

  memberQuery += ' ORDER BY active_strikes DESC, u.display_name ASC';

  const members = db.prepare(memberQuery).all(...params) as any[];

  // Workspace-wide totals
  const totalActive = members.reduce((sum, m) => sum + (m.active_strikes || 0), 0);
  const totalSuspended = members.filter(m => m.is_suspended === 1 || m.active_strikes >= policy.strike_threshold).length;
  const totalDisputed = members.reduce((sum, m) => sum + (m.disputed_strikes || 0), 0);

  res.json({
    workspaceId,
    policy,
    summary: {
      totalMembers: members.length,
      totalActiveStrikes: totalActive,
      totalSuspendedMembers: totalSuspended,
      totalDisputedStrikes: totalDisputed
    },
    members
  });
});

/**
 * GET /api/strikes/history
 * Admin view: Full strike audit history
 */
strikeRouter.get('/history', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

  const status = req.query.status as string | undefined;
  const userId = req.query.userId as string | undefined;

  let query = `
    SELECT 
      s.*,
      t.title as task_title,
      t.priority as task_priority,
      t.status as task_status,
      u.display_name as member_name,
      u.username as member_username,
      u_rev.display_name as reversed_by_name,
      u_eval.display_name as reviewed_by_name
    FROM strikes s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN users u_rev ON s.reversed_by = u_rev.id
    LEFT JOIN users u_eval ON s.reviewed_by = u_eval.id
    WHERE s.workspace_id = ?
  `;

  const params: any[] = [workspaceId];

  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }
  if (userId) {
    query += ' AND s.user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY s.detected_at DESC LIMIT 100';

  const strikes = db.prepare(query).all(...params);
  res.json({ strikes });
});

/**
 * GET /api/strikes/entry-logs
 * Admin view: Workspace-entry notification logs and Discord delivery results
 */
strikeRouter.get('/entry-logs', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

  const logs = db.prepare(`
    SELECT 
      wee.*,
      u.display_name as member_name,
      u.username as member_username,
      dal.discord_username
    FROM workspace_entry_events wee
    JOIN users u ON wee.user_id = u.id
    LEFT JOIN discord_account_links dal ON wee.user_id = dal.user_id
    WHERE wee.workspace_id = ?
    ORDER BY wee.entered_at DESC
    LIMIT 50
  `).all(workspaceId);

  res.json({ logs });
});

/**
 * POST /api/strikes/:id/reverse
 * Admin action: Reverse an incorrectly issued strike (requires documented reason)
 */
strikeRouter.post('/:id/reverse', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parseResult = reverseStrikeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const db = getDb();
    const result = reverseStrike(req.params.id, req.user.id, parseResult.data.reason, db);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/strikes/:id/excuse
 * Admin action: Excuse a missed deadline strike (requires documented reason)
 */
strikeRouter.post('/:id/excuse', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parseResult = reverseStrikeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const db = getDb();
    const result = excuseStrike(req.params.id, req.user.id, parseResult.data.reason, db);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/strikes/:id/review-dispute
 * Admin action: Approve or reject a strike dispute
 */
strikeRouter.post('/:id/review-dispute', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parseResult = reviewDisputeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const db = getDb();
    const result = reviewStrikeDispute(
      req.params.id,
      req.user.id,
      parseResult.data.action,
      parseResult.data.notes,
      db
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/strikes/members/:userId/suspend
 * Admin action: Explicitly suspend a member
 */
strikeRouter.post('/members/:userId/suspend', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parseResult = suspendSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const db = getDb();
    const workspaceId = req.user.workspace_id || 'ws_cindermarch';
    const suspension = suspendMember(workspaceId, req.params.userId, parseResult.data.reason, db);
    res.json({ success: true, suspension });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/strikes/members/:userId/reinstate
 * Admin action: Reinstatement of a suspended member (requires documented reason)
 */
strikeRouter.post('/members/:userId/reinstate', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parseResult = reinstateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const db = getDb();
    const workspaceId = req.user.workspace_id || 'ws_cindermarch';
    const result = reinstateMember(workspaceId, req.params.userId, req.user.id, parseResult.data.reason, db);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/strikes/evaluate-now
 * Admin action: Manually trigger deadline evaluation
 */
strikeRouter.post('/evaluate-now', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const newlyIssued = evaluateOverdueDeadlines(workspaceId, db);
  res.json({
    success: true,
    issuedCount: newlyIssued.length,
    strikes: newlyIssued
  });
});
