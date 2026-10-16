import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';
import {
  initiateLinkRequest,
  getUserByDiscordId,
  unlinkDiscordAccount,
  getDiscordLinkByUserId
} from '../services/discordLinkService.js';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  addComment
} from '../services/taskService.js';
import {
  createReviewRequest,
  getReviews
} from '../services/reviewService.js';
import {
  getDueReminders,
  ackReminder,
  getReminderStats,
  scheduleTaskReminders
} from '../services/reminderScheduler.js';
import {
  getPendingOutboxEvents,
  ackOutboxEvent,
  getOutboxStats,
  enqueueDiscordEvent
} from '../services/discordOutboxService.js';
import { evaluateCompletionGates } from '../services/gateService.js';
import { Priority, TaskStatus } from '../types/index.js';

export const botRouter = Router();

const BOT_API_KEY =
  process.env.INTERNAL_BOT_API_KEY ||
  process.env.SESSION_SECRET ||
  'cindermarch-bot-internal-secret-key';

/**
 * Authentication middleware for internal bot requests
 */
function botAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.headers['x-bot-token'] ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : null);

  // Allow in development or if matching token
  if (token && token === BOT_API_KEY) {
    return next();
  }

  // Also allow if localhost or test environment
  const clientIp = req.socket.remoteAddress || '';
  if (
    process.env.NODE_ENV !== 'production' &&
    (clientIp.includes('127.0.0.1') || clientIp.includes('::1') || !process.env.INTERNAL_BOT_API_KEY)
  ) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized bot service request.' });
}

botRouter.use(botAuthMiddleware);

/**
 * Helper to resolve Engine Hub user from discord user ID
 */
function resolveUser(discordUserId?: string) {
  if (!discordUserId) return null;
  return getUserByDiscordId(discordUserId);
}

// -----------------------------------------------------------------------------
// 1. ACCOUNT LINKING ENDPOINTS
// -----------------------------------------------------------------------------

// POST /api/bot/link/initiate
botRouter.post('/link/initiate', (req: Request, res: Response): void => {
  const { discordUserId, discordUsername } = req.body;
  if (!discordUserId || !discordUsername) {
    res.status(400).json({ error: 'discordUserId and discordUsername are required.' });
    return;
  }

  const { code, expiresAt } = initiateLinkRequest(discordUserId, discordUsername);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const hubUrl = `${clientOrigin}/integrations?linkCode=${code}`;

  res.json({
    code,
    expiresAt,
    hubUrl,
    instructions: `Enter code **${code}** on the Cindermarch Engine Hub (Settings -> Integrations) within 15 minutes.`
  });
});

// GET /api/bot/user/:discordUserId
botRouter.get('/user/:discordUserId', (req: Request, res: Response): void => {
  const user = resolveUser(req.params.discordUserId);
  if (!user) {
    res.status(404).json({
      linked: false,
      message: 'Discord account is not linked to any Cindermarch Engine Hub user. Run /link to connect.'
    });
    return;
  }

  let roles: string[] = [];
  try {
    roles = JSON.parse(user.roles);
  } catch {}

  res.json({
    linked: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      roles,
      avatarUrl: user.avatar_url,
      workspaceId: user.workspace_id,
      discordLink: user.discord_link
    }
  });
});

// POST /api/bot/unlink
botRouter.post('/unlink', (req: Request, res: Response): void => {
  const { discordUserId } = req.body;
  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(404).json({ error: 'Account is not linked.' });
    return;
  }

  unlinkDiscordAccount(user.id, user.id);
  res.json({ success: true, message: 'Discord account unlinked successfully.' });
});

// -----------------------------------------------------------------------------
// 2. TASK COMMANDS (/my-tasks, /team-tasks, /task view, /deadlines)
// -----------------------------------------------------------------------------

// GET /api/bot/tasks/my-tasks
botRouter.get('/tasks/my-tasks', (req: Request, res: Response): void => {
  const discordUserId = req.query.discordUserId as string;
  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'Not linked. Please run /link first to connect your account.' });
    return;
  }

  const tasks = getTasks({ myTasksUserId: user.id, sortBy: 'deadline', sortOrder: 'ASC' });

  // Group by status
  const grouped: Record<string, any[]> = {
    'In Progress': [],
    'Ready for Review': [],
    'Changes Requested': [],
    'Backlog': [],
    'Blocked': [],
    'Ready to Integrate': [],
    'Verified Complete': []
  };

  for (const t of tasks) {
    if (grouped[t.status]) {
      grouped[t.status].push(t);
    } else {
      grouped[t.status] = [t];
    }
  }

  res.json({
    user: { id: user.id, displayName: user.display_name },
    total: tasks.length,
    grouped,
    tasks
  });
});

// GET /api/bot/tasks/team-tasks
botRouter.get('/tasks/team-tasks', (req: Request, res: Response): void => {
  const discordUserId = req.query.discordUserId as string;
  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'Not linked. Please run /link first to connect your account.' });
    return;
  }

  const { status, priority, category, teamId, team, projectId, search } = req.query;
  const tasks = getTasks({
    status: status as string,
    priority: priority as string,
    category: category as string,
    teamId: (teamId || team) as string,
    projectId: projectId as string,
    search: search as string,
    sortBy: 'updated_at',
    sortOrder: 'DESC'
  });

  res.json({
    total: tasks.length,
    tasks
  });
});

// GET /api/bot/tasks/:taskId
botRouter.get('/tasks/:taskId', (req: Request, res: Response): void => {
  const taskId = req.params.taskId.toUpperCase();
  const task = getTaskById(taskId);
  if (!task) {
    res.status(404).json({ error: `Task ${taskId} not found.` });
    return;
  }

  const gates = evaluateCompletionGates(taskId);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  res.json({
    task,
    gates,
    dashboardUrl: `${clientOrigin}/tasks/${task.id}`
  });
});

// POST /api/bot/tasks (Create Task)
botRouter.post('/tasks', (req: Request, res: Response): void => {
  const {
    discordUserId,
    title,
    description,
    priority,
    category,
    teamId,
    team,
    deadline,
    ownerUsernameOrId,
    reviewerUsernameOrId,
    projectId
  } = req.body;

  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link before creating tasks.' });
    return;
  }

  if (!title || !description) {
    res.status(400).json({ error: 'Task title and description are required.' });
    return;
  }

  const db = getDb();
  let ownerId: string | null = null;
  if (ownerUsernameOrId) {
    const ownerRow = db.prepare('SELECT id FROM users WHERE id = ? OR username = ? OR display_name = ?')
      .get(ownerUsernameOrId, ownerUsernameOrId, ownerUsernameOrId) as { id: string } | undefined;
    if (ownerRow) ownerId = ownerRow.id;
  }

  let reviewerId: string | null = null;
  if (reviewerUsernameOrId) {
    const revRow = db.prepare('SELECT id FROM users WHERE id = ? OR username = ? OR display_name = ?')
      .get(reviewerUsernameOrId, reviewerUsernameOrId, reviewerUsernameOrId) as { id: string } | undefined;
    if (revRow) reviewerId = revRow.id;
  }

  let resolvedTeamId: string | null = null;
  const targetTeam = teamId || team;
  if (targetTeam) {
    const teamRow = db.prepare('SELECT id FROM teams WHERE id = ? OR slug = ? OR name = ? COLLATE NOCASE')
      .get(targetTeam, targetTeam, targetTeam) as { id: string } | undefined;
    if (teamRow) resolvedTeamId = teamRow.id;
  }

  try {
    const task = createTask(
      {
        title,
        description,
        priority: (priority as Priority) || 'P1',
        category: category || 'Gameplay',
        teamId: resolvedTeamId,
        deadline: deadline || null,
        ownerId,
        reviewerId,
        projectId: projectId || 'terminal-6'
      },
      user.id,
      db
    );

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    res.status(201).json({
      success: true,
      task,
      dashboardUrl: `${clientOrigin}/tasks/${task.id}`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/bot/tasks/:taskId/assign
botRouter.patch('/tasks/:taskId/assign', (req: Request, res: Response): void => {
  const taskId = req.params.taskId.toUpperCase();
  const { discordUserId, targetUsernameOrId } = req.body;

  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  const db = getDb();
  const existing = getTaskById(taskId, db);
  if (!existing) {
    res.status(404).json({ error: `Task ${taskId} not found.` });
    return;
  }

  let newOwnerId: string | null = null;
  if (targetUsernameOrId) {
    const ownerRow = db.prepare('SELECT id, display_name FROM users WHERE id = ? OR username = ? OR display_name = ?')
      .get(targetUsernameOrId, targetUsernameOrId, targetUsernameOrId) as { id: string; display_name: string } | undefined;
    if (!ownerRow) {
      res.status(404).json({ error: `User "${targetUsernameOrId}" not found.` });
      return;
    }
    newOwnerId = ownerRow.id;
  }

  const updated = updateTask(taskId, { ownerId: newOwnerId }, user.id, db);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  res.json({
    success: true,
    task: updated,
    dashboardUrl: `${clientOrigin}/tasks/${taskId}`
  });
});

// PATCH /api/bot/tasks/:taskId/status
botRouter.patch('/tasks/:taskId/status', (req: Request, res: Response): void => {
  const taskId = req.params.taskId.toUpperCase();
  const { discordUserId, newStatus } = req.body;

  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  if (!newStatus) {
    res.status(400).json({ error: 'newStatus is required.' });
    return;
  }

  const validStatuses: TaskStatus[] = [
    'Backlog',
    'In Progress',
    'Ready for Review',
    'Changes Requested',
    'Ready to Integrate',
    'Verified Complete',
    'Blocked'
  ];

  if (!validStatuses.includes(newStatus as TaskStatus)) {
    res.status(400).json({
      error: `Invalid status "${newStatus}". Valid statuses: ${validStatuses.join(', ')}`
    });
    return;
  }

  const db = getDb();
  try {
    const updated = updateTaskStatus(taskId, newStatus as TaskStatus, user.id, db);
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

    res.json({
      success: true,
      task: updated,
      dashboardUrl: `${clientOrigin}/tasks/${taskId}`
    });
  } catch (err: any) {
    // If completion gate failed
    if (err.gateStatus) {
      res.status(422).json({
        error: err.message,
        gatesPassed: false,
        gateStatus: err.gateStatus
      });
      return;
    }
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/bot/tasks/:taskId/deadline
botRouter.patch('/tasks/:taskId/deadline', (req: Request, res: Response): void => {
  const taskId = req.params.taskId.toUpperCase();
  const { discordUserId, deadline } = req.body;

  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  const db = getDb();
  const existing = getTaskById(taskId, db);
  if (!existing) {
    res.status(404).json({ error: `Task ${taskId} not found.` });
    return;
  }

  const updated = updateTask(taskId, { deadline: deadline || null }, user.id, db);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  res.json({
    success: true,
    previousDeadline: existing.deadline,
    newDeadline: updated.deadline,
    task: updated,
    dashboardUrl: `${clientOrigin}/tasks/${taskId}`
  });
});

// POST /api/bot/tasks/:taskId/comments
botRouter.post('/tasks/:taskId/comments', (req: Request, res: Response): void => {
  const taskId = req.params.taskId.toUpperCase();
  const { discordUserId, content } = req.body;

  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Comment content cannot be empty.' });
    return;
  }

  const db = getDb();
  const comment = addComment(taskId, user.id, content.trim(), db);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  res.status(201).json({
    success: true,
    comment,
    dashboardUrl: `${clientOrigin}/tasks/${taskId}`
  });
});

// POST /api/bot/tasks/:taskId/reviews
botRouter.post('/tasks/:taskId/reviews', (req: Request, res: Response): void => {
  const taskId = req.params.taskId.toUpperCase();
  const { discordUserId, reviewerUsernameOrId } = req.body;

  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  const db = getDb();
  const task = getTaskById(taskId, db);
  if (!task) {
    res.status(404).json({ error: `Task ${taskId} not found.` });
    return;
  }

  let reviewerId = task.reviewer_id;
  if (reviewerUsernameOrId) {
    const revRow = db.prepare('SELECT id FROM users WHERE id = ? OR username = ? OR display_name = ?')
      .get(reviewerUsernameOrId, reviewerUsernameOrId, reviewerUsernameOrId) as { id: string } | undefined;
    if (revRow) reviewerId = revRow.id;
  }

  if (!reviewerId) {
    res.status(400).json({ error: 'No reviewer assigned to this task. Please specify a reviewer.' });
    return;
  }

  // Developer is the current task owner or caller
  const developerId = task.owner_id || user.id;

  try {
    const review = createReviewRequest(
      {
        taskId,
        developerId,
        reviewerId
      },
      user.id,
      db
    );

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    res.status(201).json({
      success: true,
      review,
      dashboardUrl: `${clientOrigin}/reviews`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/bot/deadlines
botRouter.get('/deadlines', (req: Request, res: Response): void => {
  const discordUserId = req.query.discordUserId as string;
  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  const window = (req.query.window as string) || '7days';
  const db = getDb();

  let query = `
    SELECT t.*, u.display_name as owner_name
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.status != 'Verified Complete' AND t.deadline IS NOT NULL
  `;

  if (window === 'today') {
    query += " AND date(t.deadline) = date('now')";
  } else if (window === 'tomorrow') {
    query += " AND date(t.deadline) = date('now', '+1 day')";
  } else if (window === 'overdue') {
    query += " AND date(t.deadline) < date('now')";
  } else {
    // 7 days
    query += " AND date(t.deadline) >= date('now') AND date(t.deadline) <= date('now', '+7 days')";
  }

  query += ' ORDER BY t.deadline ASC LIMIT 30';

  const tasks = db.prepare(query).all();
  res.json({ window, total: tasks.length, tasks });
});

// GET /api/bot/standup
botRouter.get('/standup', (req: Request, res: Response): void => {
  const discordUserId = req.query.discordUserId as string;
  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  const db = getDb();

  // Completed recently (last 24-48 hours)
  const completed = db.prepare(`
    SELECT t.id, t.title, u.display_name as owner_name, t.completed_at
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.status = 'Verified Complete' AND t.completed_at >= datetime('now', '-2 days')
    ORDER BY t.completed_at DESC
  `).all();

  // In Progress
  const inProgress = db.prepare(`
    SELECT t.id, t.title, u.display_name as owner_name, t.priority, t.deadline
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.status = 'In Progress'
    ORDER BY t.priority ASC, t.deadline ASC
  `).all();

  // Blocked
  const blocked = db.prepare(`
    SELECT t.id, t.title, u.display_name as owner_name, t.priority
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.status = 'Blocked'
  `).all();

  // Upcoming Deadlines (next 7 days)
  const upcomingDeadlines = db.prepare(`
    SELECT t.id, t.title, u.display_name as owner_name, t.deadline, t.priority
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.status != 'Verified Complete' AND t.deadline >= date('now') AND t.deadline <= date('now', '+7 days')
    ORDER BY t.deadline ASC
  `).all();

  // Pending Reviews
  const pendingReviews = db.prepare(`
    SELECT r.id, r.task_id, t.title as task_title, u_dev.display_name as developer_name, u_rev.display_name as reviewer_name, r.created_at
    FROM reviews r
    JOIN tasks t ON r.task_id = t.id
    LEFT JOIN users u_dev ON r.developer_id = u_dev.id
    LEFT JOIN users u_rev ON r.reviewer_id = u_rev.id
    WHERE r.decision = 'Pending'
    ORDER BY r.created_at ASC
  `).all();

  res.json({
    studio: 'Cindermarch Studio',
    project: 'Terminal 6',
    generatedAt: new Date().toISOString(),
    completed,
    inProgress,
    blocked,
    upcomingDeadlines,
    pendingReviews
  });
});

// GET /api/bot/team
botRouter.get('/team', (req: Request, res: Response): void => {
  const discordUserId = req.query.discordUserId as string;
  const user = resolveUser(discordUserId);
  if (!user) {
    res.status(403).json({ error: 'You must link your account with /link first.' });
    return;
  }

  const db = getDb();
  const members = db.prepare(`
    SELECT 
      u.id, u.username, u.display_name, u.roles,
      dal.discord_username, dal.discord_user_id,
      (SELECT COUNT(*) FROM tasks WHERE owner_id = u.id AND status != 'Verified Complete') as active_tasks_count,
      (SELECT COUNT(*) FROM reviews WHERE reviewer_id = u.id AND decision = 'Pending') as pending_reviews_count
    FROM users u
    LEFT JOIN discord_account_links dal ON u.id = dal.user_id
    WHERE u.id != 'usr_cindermarch_assistant'
    ORDER BY u.display_name ASC
  `).all();

  res.json({ members });
});

// GET /api/bot/health
botRouter.get('/health', (_req: Request, res: Response): void => {
  const db = getDb();
  const outboxStats = getOutboxStats(db);
  const reminderStats = getReminderStats(db);

  const guildConfig = db.prepare(`
    SELECT guild_id, guild_name, announcements_channel_id, engine_channel_id, qa_channel_id, reminder_policy_json, is_active
    FROM discord_guild_configs WHERE workspace_id = 'ws_cindermarch'
  `).get() as any;

  res.json({
    status: 'operational',
    service: 'Cindermarch Operations Bot API',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'healthy',
    outbox: outboxStats,
    reminders: reminderStats,
    guildConfig: guildConfig || null
  });
});

// -----------------------------------------------------------------------------
// 3. BOT WORKER OUTBOX & REMINDER POLLING
// -----------------------------------------------------------------------------

// GET /api/bot/outbox/pending
botRouter.get('/outbox/pending', (_req: Request, res: Response): void => {
  const events = getPendingOutboxEvents(20);
  res.json({ events });
});

// POST /api/bot/outbox/:id/ack
botRouter.post('/outbox/:id/ack', (req: Request, res: Response): void => {
  const { success, error } = req.body;
  ackOutboxEvent(req.params.id, !!success, error || null);
  res.json({ acknowledged: true });
});

// GET /api/bot/reminders/due
botRouter.get('/reminders/due', (_req: Request, res: Response): void => {
  const reminders = getDueReminders();
  res.json({ reminders });
});

// POST /api/bot/reminders/:id/ack
botRouter.post('/reminders/:id/ack', (req: Request, res: Response): void => {
  const { success, error } = req.body;
  ackReminder(req.params.id, !!success, error || null);
  res.json({ acknowledged: true });
});
