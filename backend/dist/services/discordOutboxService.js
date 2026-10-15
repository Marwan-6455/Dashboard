"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCORD_THEME_COLORS = void 0;
exports.enqueueDiscordEvent = enqueueDiscordEvent;
exports.getPendingOutboxEvents = getPendingOutboxEvents;
exports.ackOutboxEvent = ackOutboxEvent;
exports.getOutboxStats = getOutboxStats;
exports.createDiscordEmbed = createDiscordEmbed;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
// Cindermarch Studio Hex Colors for Discord Embeds
exports.DISCORD_THEME_COLORS = {
    PRIMARY_ORANGE: 0xff5722, // Cindermarch Burnt Orange
    DARK_METALLIC: 0x2a2d35, // Metallic Grey
    SUCCESS_GREEN: 0x16a34a, // Verified Complete / Passed
    DANGER_RED: 0xdc2626, // Blocked / Overdue / Failed
    WARNING_AMBER: 0xf59e0b, // Review Requested / Warning
    INFO_BLUE: 0x0284c7 // Informational / Assignment
};
/**
 * Enqueue an event in the outbox for reliable asynchronous delivery
 */
function enqueueDiscordEvent(eventType, payload, targetChannelType = 'announcements', taskId = null, workspaceId = 'ws_cindermarch', db = (0, connection_js_1.getDb)()) {
    const id = `outbox_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);
    const stmt = db.prepare(`
    INSERT INTO discord_event_outbox (
      id, event_type, workspace_id, task_id, payload_json,
      target_channel_type, status, retry_count, last_error, created_at, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, null, ?, null)
  `);
    stmt.run(id, eventType, workspaceId, taskId, payloadJson, targetChannelType, now);
    return {
        id,
        event_type: eventType,
        workspace_id: workspaceId,
        task_id: taskId,
        payload_json: payloadJson,
        target_channel_type: targetChannelType,
        status: 'pending',
        retry_count: 0,
        created_at: now
    };
}
/**
 * Fetch pending events from the outbox
 */
function getPendingOutboxEvents(limit = 25, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT * FROM discord_event_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `);
    return stmt.all(limit);
}
/**
 * Acknowledge processed event
 */
function ackOutboxEvent(eventId, success, errorMessage = null, db = (0, connection_js_1.getDb)()) {
    const now = new Date().toISOString();
    if (success) {
        db.prepare(`
      UPDATE discord_event_outbox
      SET status = 'delivered', processed_at = ?, retry_count = retry_count + 1
      WHERE id = ?
    `).run(now, eventId);
    }
    else {
        db.prepare(`
      UPDATE discord_event_outbox
      SET status = CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END,
          retry_count = retry_count + 1,
          last_error = ?,
          processed_at = ?
      WHERE id = ?
    `).run(errorMessage, now, eventId);
    }
}
/**
 * Get outbox delivery statistics for dashboard health metrics
 */
function getOutboxStats(db = (0, connection_js_1.getDb)()) {
    const countsStmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM discord_event_outbox
    GROUP BY status
  `);
    const rows = countsStmt.all();
    const stats = {
        pending: 0,
        delivered: 0,
        failed: 0,
        lastDeliveredAt: null,
        lastError: null
    };
    for (const r of rows) {
        if (r.status === 'pending')
            stats.pending = r.count;
        if (r.status === 'delivered')
            stats.delivered = r.count;
        if (r.status === 'failed')
            stats.failed = r.count;
    }
    const lastDelivered = db.prepare(`
    SELECT processed_at FROM discord_event_outbox
    WHERE status = 'delivered'
    ORDER BY processed_at DESC LIMIT 1
  `).get();
    if (lastDelivered)
        stats.lastDeliveredAt = lastDelivered.processed_at;
    const lastErr = db.prepare(`
    SELECT last_error FROM discord_event_outbox
    WHERE last_error IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
  `).get();
    if (lastErr)
        stats.lastError = lastErr.last_error;
    return stats;
}
/**
 * Format a standardized Discord Embed object for task/system events
 */
function createDiscordEmbed(data) {
    return {
        title: data.title,
        description: data.description,
        color: data.color ?? exports.DISCORD_THEME_COLORS.PRIMARY_ORANGE,
        fields: data.fields || [],
        footer: {
            text: data.footer || 'Cindermarch Engine Hub // Terminal 6 Operations'
        },
        timestamp: data.timestamp || new Date().toISOString(),
        url: data.url
    };
}
