"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STUDIO_TIMEZONE = void 0;
exports.parseDeadline = parseDeadline;
exports.scheduleTaskReminders = scheduleTaskReminders;
exports.cancelTaskReminders = cancelTaskReminders;
exports.getDueReminders = getDueReminders;
exports.ackReminder = ackReminder;
exports.getReminderStats = getReminderStats;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
/**
 * Standard Studio Timezone: Africa/Cairo (UTC+2 / UTC+3)
 */
exports.DEFAULT_STUDIO_TIMEZONE = 'Africa/Cairo';
/**
 * Parse a deadline string (YYYY-MM-DD or ISO) into a Date object.
 * If date only, sets deadline to 18:00 (studio end of workday) in the configured timezone.
 */
function parseDeadline(deadlineStr, _timezone = exports.DEFAULT_STUDIO_TIMEZONE) {
    if (!deadlineStr)
        throw new Error('Deadline string cannot be empty.');
    // If it's already an ISO timestamp with time
    if (deadlineStr.includes('T')) {
        const d = new Date(deadlineStr);
        if (!isNaN(d.getTime()))
            return d;
    }
    // If it's YYYY-MM-DD
    const dateMatch = deadlineStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
        const [_, year, month, day] = dateMatch;
        // Set to 18:00:00 Cairo time (approx UTC+2: 16:00 UTC)
        const isoString = `${year}-${month}-${day}T16:00:00.000Z`;
        return new Date(isoString);
    }
    const parsed = new Date(deadlineStr);
    if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid deadline date format: ${deadlineStr}`);
    }
    return parsed;
}
/**
 * Schedule persistent reminders for a task's deadline
 */
function scheduleTaskReminders(taskId, deadlineStr, workspaceId = 'ws_cindermarch', recipientDiscordId = null, db = (0, connection_js_1.getDb)()) {
    // 1. Cancel existing pending deadline reminders for this task to avoid duplicates/obsolete jobs
    db.prepare(`
    UPDATE scheduled_reminders
    SET status = 'cancelled'
    WHERE task_id = ? AND status = 'pending' AND reminder_type LIKE 'deadline_%'
  `).run(taskId);
    if (!deadlineStr) {
        return [];
    }
    let deadlineDate;
    try {
        deadlineDate = parseDeadline(deadlineStr);
    }
    catch (err) {
        console.error(`Failed to parse deadline ${deadlineStr} for task ${taskId}:`, err);
        return [];
    }
    const now = new Date();
    const deadlineMs = deadlineDate.getTime();
    const createdNow = now.toISOString();
    // Intervals:
    // 1. 24h before deadline
    // 2. 2h before deadline
    // 3. At deadline (due now)
    // 4. Overdue daily (24h after deadline)
    const reminderConfigs = [
        { type: 'deadline_24h', timeMs: deadlineMs - 24 * 60 * 60 * 1000 },
        { type: 'deadline_2h', timeMs: deadlineMs - 2 * 60 * 60 * 1000 },
        { type: 'deadline_due', timeMs: deadlineMs },
        { type: 'overdue_daily', timeMs: deadlineMs + 24 * 60 * 60 * 1000 }
    ];
    const scheduled = [];
    const insertStmt = db.prepare(`
    INSERT INTO scheduled_reminders (
      id, workspace_id, task_id, reminder_type, scheduled_for,
      status, recipient_discord_id, target_channel_id, attempts, last_error, created_at, sent_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, null, 0, null, ?, null)
  `);
    for (const config of reminderConfigs) {
        // Only schedule if target time is in the future (or if overdue_daily and task is still incomplete)
        if (config.timeMs > now.getTime()) {
            const scheduledFor = new Date(config.timeMs).toISOString();
            const id = `rem_${taskId}_${config.type}_${Date.now()}_${(0, uuid_1.v4)().slice(0, 4)}`;
            insertStmt.run(id, workspaceId, taskId, config.type, scheduledFor, recipientDiscordId, createdNow);
            scheduled.push({
                id,
                workspace_id: workspaceId,
                task_id: taskId,
                reminder_type: config.type,
                scheduled_for: scheduledFor,
                status: 'pending',
                recipient_discord_id: recipientDiscordId,
                attempts: 0,
                created_at: createdNow
            });
        }
    }
    return scheduled;
}
/**
 * Cancel all pending reminders for a task (e.g. When Verified Complete or Blocked/Deleted)
 */
function cancelTaskReminders(taskId, db = (0, connection_js_1.getDb)()) {
    const result = db.prepare(`
    UPDATE scheduled_reminders
    SET status = 'cancelled'
    WHERE task_id = ? AND status = 'pending'
  `).run(taskId);
    return Number(result.changes || 0);
}
/**
 * Query due pending reminders ready to be sent
 */
function getDueReminders(nowIso = new Date().toISOString(), db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT 
      r.*,
      t.title as task_title,
      t.status as task_status,
      t.priority as task_priority,
      t.deadline as task_deadline,
      t.owner_id as task_owner_id,
      t.project_id as task_project_id,
      u.display_name as owner_name,
      dal.discord_user_id as owner_discord_id
    FROM scheduled_reminders r
    JOIN tasks t ON r.task_id = t.id
    LEFT JOIN users u ON t.owner_id = u.id
    LEFT JOIN discord_account_links dal ON t.owner_id = dal.user_id
    WHERE r.status = 'pending' AND r.scheduled_for <= ?
    ORDER BY r.scheduled_for ASC
    LIMIT 50
  `);
    return stmt.all(nowIso);
}
/**
 * Acknowledge reminder delivery result
 */
function ackReminder(reminderId, success, errorMessage = null, db = (0, connection_js_1.getDb)()) {
    const now = new Date().toISOString();
    if (success) {
        db.prepare(`
      UPDATE scheduled_reminders
      SET status = 'sent', sent_at = ?, attempts = attempts + 1
      WHERE id = ?
    `).run(now, reminderId);
    }
    else {
        db.prepare(`
      UPDATE scheduled_reminders
      SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
          attempts = attempts + 1,
          last_error = ?
      WHERE id = ?
    `).run(errorMessage, reminderId);
    }
}
/**
 * Get aggregated reminder statistics for observability
 */
function getReminderStats(db = (0, connection_js_1.getDb)()) {
    const countsStmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM scheduled_reminders
    GROUP BY status
  `);
    const rows = countsStmt.all();
    const stats = { pending: 0, sent: 0, cancelled: 0, failed: 0, nextDue: null };
    for (const r of rows) {
        if (r.status === 'pending')
            stats.pending = r.count;
        if (r.status === 'sent')
            stats.sent = r.count;
        if (r.status === 'cancelled')
            stats.cancelled = r.count;
        if (r.status === 'failed')
            stats.failed = r.count;
    }
    const nextDueStmt = db.prepare(`
    SELECT scheduled_for FROM scheduled_reminders
    WHERE status = 'pending'
    ORDER BY scheduled_for ASC LIMIT 1
  `);
    const nextRow = nextDueStmt.get();
    if (nextRow) {
        stats.nextDue = nextRow.scheduled_for;
    }
    return stats;
}
