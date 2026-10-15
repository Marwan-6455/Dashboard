"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botRouter = void 0;
const express_1 = require("express");
const connection_js_1 = require("../db/connection.js");
const discordLinkService_js_1 = require("../services/discordLinkService.js");
const taskService_js_1 = require("../services/taskService.js");
const reviewService_js_1 = require("../services/reviewService.js");
const reminderScheduler_js_1 = require("../services/reminderScheduler.js");
const discordOutboxService_js_1 = require("../services/discordOutboxService.js");
const gateService_js_1 = require("../services/gateService.js");
exports.botRouter = (0, express_1.Router)();
const BOT_API_KEY = process.env.INTERNAL_BOT_API_KEY ||
    process.env.SESSION_SECRET ||
    'cindermarch-bot-internal-secret-key';
/**
 * Authentication middleware for internal bot requests
 */
function botAuthMiddleware(req, res, next) {
    const token = req.headers['x-bot-token'] ||
        (req.headers['authorization']?.startsWith('Bearer ')
            ? req.headers['authorization'].slice(7)
            : null);
    // Allow in development or if matching token
    if (token && token === BOT_API_KEY) {
        return next();
    }
    // Also allow if localhost or test environment
    const clientIp = req.socket.remoteAddress || '';
    if (process.env.NODE_ENV !== 'production' &&
        (clientIp.includes('127.0.0.1') || clientIp.includes('::1') || !process.env.INTERNAL_BOT_API_KEY)) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized bot service request.' });
}
exports.botRouter.use(botAuthMiddleware);
/**
 * Helper to resolve Engine Hub user from discord user ID
 */
function resolveUser(discordUserId) {
    if (!discordUserId)
        return null;
    return (0, discordLinkService_js_1.getUserByDiscordId)(discordUserId);
}
// -----------------------------------------------------------------------------
// 1. ACCOUNT LINKING ENDPOINTS
// -----------------------------------------------------------------------------
// POST /api/bot/link/initiate
exports.botRouter.post('/link/initiate', (req, res) => {
    const { discordUserId, discordUsername } = req.body;
    if (!discordUserId || !discordUsername) {
        res.status(400).json({ error: 'discordUserId and discordUsername are required.' });
        return;
    }
    const { code, expiresAt } = (0, discordLinkService_js_1.initiateLinkRequest)(discordUserId, discordUsername);
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
exports.botRouter.get('/user/:discordUserId', (req, res) => {
    const user = resolveUser(req.params.discordUserId);
    if (!user) {
        res.status(404).json({
            linked: false,
            message: 'Discord account is not linked to any Cindermarch Engine Hub user. Run /link to connect.'
        });
        return;
    }
    let roles = [];
    try {
        roles = JSON.parse(user.roles);
    }
    catch { }
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
exports.botRouter.post('/unlink', (req, res) => {
    const { discordUserId } = req.body;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(404).json({ error: 'Account is not linked.' });
        return;
    }
    (0, discordLinkService_js_1.unlinkDiscordAccount)(user.id, user.id);
    res.json({ success: true, message: 'Discord account unlinked successfully.' });
});
// -----------------------------------------------------------------------------
// 2. TASK COMMANDS (/my-tasks, /team-tasks, /task view, /deadlines)
// -----------------------------------------------------------------------------
// GET /api/bot/tasks/my-tasks
exports.botRouter.get('/tasks/my-tasks', (req, res) => {
    const discordUserId = req.query.discordUserId;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'Not linked. Please run /link first to connect your account.' });
        return;
    }
    const tasks = (0, taskService_js_1.getTasks)({ myTasksUserId: user.id, sortBy: 'deadline', sortOrder: 'ASC' });
    // Group by status
    const grouped = {
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
        }
        else {
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
exports.botRouter.get('/tasks/team-tasks', (req, res) => {
    const discordUserId = req.query.discordUserId;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'Not linked. Please run /link first to connect your account.' });
        return;
    }
    const { status, priority, category, projectId, search } = req.query;
    const tasks = (0, taskService_js_1.getTasks)({
        status: status,
        priority: priority,
        category: category,
        projectId: projectId,
        search: search,
        sortBy: 'updated_at',
        sortOrder: 'DESC'
    });
    res.json({
        total: tasks.length,
        tasks
    });
});
// GET /api/bot/tasks/:taskId
exports.botRouter.get('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId.toUpperCase();
    const task = (0, taskService_js_1.getTaskById)(taskId);
    if (!task) {
        res.status(404).json({ error: `Task ${taskId} not found.` });
        return;
    }
    const gates = (0, gateService_js_1.evaluateCompletionGates)(taskId);
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    res.json({
        task,
        gates,
        dashboardUrl: `${clientOrigin}/tasks/${task.id}`
    });
});
// POST /api/bot/tasks (Create Task)
exports.botRouter.post('/tasks', (req, res) => {
    const { discordUserId, title, description, priority, category, deadline, ownerUsernameOrId, reviewerUsernameOrId, projectId } = req.body;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link before creating tasks.' });
        return;
    }
    if (!title || !description) {
        res.status(400).json({ error: 'Task title and description are required.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    let ownerId = null;
    if (ownerUsernameOrId) {
        const ownerRow = db.prepare('SELECT id FROM users WHERE id = ? OR username = ? OR display_name = ?')
            .get(ownerUsernameOrId, ownerUsernameOrId, ownerUsernameOrId);
        if (ownerRow)
            ownerId = ownerRow.id;
    }
    let reviewerId = null;
    if (reviewerUsernameOrId) {
        const revRow = db.prepare('SELECT id FROM users WHERE id = ? OR username = ? OR display_name = ?')
            .get(reviewerUsernameOrId, reviewerUsernameOrId, reviewerUsernameOrId);
        if (revRow)
            reviewerId = revRow.id;
    }
    try {
        const task = (0, taskService_js_1.createTask)({
            title,
            description,
            priority: priority || 'P1',
            category: category || 'Gameplay',
            deadline: deadline || null,
            ownerId,
            reviewerId,
            projectId: projectId || 'terminal-6'
        }, user.id, db);
        const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        res.status(201).json({
            success: true,
            task,
            dashboardUrl: `${clientOrigin}/tasks/${task.id}`
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// PATCH /api/bot/tasks/:taskId/assign
exports.botRouter.patch('/tasks/:taskId/assign', (req, res) => {
    const taskId = req.params.taskId.toUpperCase();
    const { discordUserId, targetUsernameOrId } = req.body;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link first.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const existing = (0, taskService_js_1.getTaskById)(taskId, db);
    if (!existing) {
        res.status(404).json({ error: `Task ${taskId} not found.` });
        return;
    }
    let newOwnerId = null;
    if (targetUsernameOrId) {
        const ownerRow = db.prepare('SELECT id, display_name FROM users WHERE id = ? OR username = ? OR display_name = ?')
            .get(targetUsernameOrId, targetUsernameOrId, targetUsernameOrId);
        if (!ownerRow) {
            res.status(404).json({ error: `User "${targetUsernameOrId}" not found.` });
            return;
        }
        newOwnerId = ownerRow.id;
    }
    const updated = (0, taskService_js_1.updateTask)(taskId, { ownerId: newOwnerId }, user.id, db);
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    res.json({
        success: true,
        task: updated,
        dashboardUrl: `${clientOrigin}/tasks/${taskId}`
    });
});
// PATCH /api/bot/tasks/:taskId/status
exports.botRouter.patch('/tasks/:taskId/status', (req, res) => {
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
    const validStatuses = [
        'Backlog',
        'In Progress',
        'Ready for Review',
        'Changes Requested',
        'Ready to Integrate',
        'Verified Complete',
        'Blocked'
    ];
    if (!validStatuses.includes(newStatus)) {
        res.status(400).json({
            error: `Invalid status "${newStatus}". Valid statuses: ${validStatuses.join(', ')}`
        });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    try {
        const updated = (0, taskService_js_1.updateTaskStatus)(taskId, newStatus, user.id, db);
        const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        res.json({
            success: true,
            task: updated,
            dashboardUrl: `${clientOrigin}/tasks/${taskId}`
        });
    }
    catch (err) {
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
exports.botRouter.patch('/tasks/:taskId/deadline', (req, res) => {
    const taskId = req.params.taskId.toUpperCase();
    const { discordUserId, deadline } = req.body;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link first.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const existing = (0, taskService_js_1.getTaskById)(taskId, db);
    if (!existing) {
        res.status(404).json({ error: `Task ${taskId} not found.` });
        return;
    }
    const updated = (0, taskService_js_1.updateTask)(taskId, { deadline: deadline || null }, user.id, db);
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
exports.botRouter.post('/tasks/:taskId/comments', (req, res) => {
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
    const db = (0, connection_js_1.getDb)();
    const comment = (0, taskService_js_1.addComment)(taskId, user.id, content.trim(), db);
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    res.status(201).json({
        success: true,
        comment,
        dashboardUrl: `${clientOrigin}/tasks/${taskId}`
    });
});
// POST /api/bot/tasks/:taskId/reviews
exports.botRouter.post('/tasks/:taskId/reviews', (req, res) => {
    const taskId = req.params.taskId.toUpperCase();
    const { discordUserId, reviewerUsernameOrId } = req.body;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link first.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const task = (0, taskService_js_1.getTaskById)(taskId, db);
    if (!task) {
        res.status(404).json({ error: `Task ${taskId} not found.` });
        return;
    }
    let reviewerId = task.reviewer_id;
    if (reviewerUsernameOrId) {
        const revRow = db.prepare('SELECT id FROM users WHERE id = ? OR username = ? OR display_name = ?')
            .get(reviewerUsernameOrId, reviewerUsernameOrId, reviewerUsernameOrId);
        if (revRow)
            reviewerId = revRow.id;
    }
    if (!reviewerId) {
        res.status(400).json({ error: 'No reviewer assigned to this task. Please specify a reviewer.' });
        return;
    }
    // Developer is the current task owner or caller
    const developerId = task.owner_id || user.id;
    try {
        const review = (0, reviewService_js_1.createReviewRequest)({
            taskId,
            developerId,
            reviewerId
        }, user.id, db);
        const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        res.status(201).json({
            success: true,
            review,
            dashboardUrl: `${clientOrigin}/reviews`
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET /api/bot/deadlines
exports.botRouter.get('/deadlines', (req, res) => {
    const discordUserId = req.query.discordUserId;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link first.' });
        return;
    }
    const window = req.query.window || '7days';
    const db = (0, connection_js_1.getDb)();
    let query = `
    SELECT t.*, u.display_name as owner_name
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.status != 'Verified Complete' AND t.deadline IS NOT NULL
  `;
    if (window === 'today') {
        query += " AND date(t.deadline) = date('now')";
    }
    else if (window === 'tomorrow') {
        query += " AND date(t.deadline) = date('now', '+1 day')";
    }
    else if (window === 'overdue') {
        query += " AND date(t.deadline) < date('now')";
    }
    else {
        // 7 days
        query += " AND date(t.deadline) >= date('now') AND date(t.deadline) <= date('now', '+7 days')";
    }
    query += ' ORDER BY t.deadline ASC LIMIT 30';
    const tasks = db.prepare(query).all();
    res.json({ window, total: tasks.length, tasks });
});
// GET /api/bot/standup
exports.botRouter.get('/standup', (req, res) => {
    const discordUserId = req.query.discordUserId;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link first.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
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
exports.botRouter.get('/team', (req, res) => {
    const discordUserId = req.query.discordUserId;
    const user = resolveUser(discordUserId);
    if (!user) {
        res.status(403).json({ error: 'You must link your account with /link first.' });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    const members = db.prepare(`
    SELECT 
      u.id, u.username, u.display_name, u.roles,
      dal.discord_username, dal.discord_user_id,
      (SELECT COUNT(*) FROM tasks WHERE owner_id = u.id AND status != 'Verified Complete') as active_tasks_count,
      (SELECT COUNT(*) FROM reviews WHERE reviewer_id = u.id AND decision = 'Pending') as pending_reviews_count
    FROM users u
    LEFT JOIN discord_account_links dal ON u.id = dal.user_id
    ORDER BY u.display_name ASC
  `).all();
    res.json({ members });
});
// GET /api/bot/health
exports.botRouter.get('/health', (_req, res) => {
    const db = (0, connection_js_1.getDb)();
    const outboxStats = (0, discordOutboxService_js_1.getOutboxStats)(db);
    const reminderStats = (0, reminderScheduler_js_1.getReminderStats)(db);
    const guildConfig = db.prepare(`
    SELECT guild_id, guild_name, announcements_channel_id, engine_channel_id, qa_channel_id, reminder_policy_json, is_active
    FROM discord_guild_configs WHERE workspace_id = 'ws_cindermarch'
  `).get();
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
exports.botRouter.get('/outbox/pending', (_req, res) => {
    const events = (0, discordOutboxService_js_1.getPendingOutboxEvents)(20);
    res.json({ events });
});
// POST /api/bot/outbox/:id/ack
exports.botRouter.post('/outbox/:id/ack', (req, res) => {
    const { success, error } = req.body;
    (0, discordOutboxService_js_1.ackOutboxEvent)(req.params.id, !!success, error || null);
    res.json({ acknowledged: true });
});
// GET /api/bot/reminders/due
exports.botRouter.get('/reminders/due', (_req, res) => {
    const reminders = (0, reminderScheduler_js_1.getDueReminders)();
    res.json({ reminders });
});
// POST /api/bot/reminders/:id/ack
exports.botRouter.post('/reminders/:id/ack', (req, res) => {
    const { success, error } = req.body;
    (0, reminderScheduler_js_1.ackReminder)(req.params.id, !!success, error || null);
    res.json({ acknowledged: true });
});
