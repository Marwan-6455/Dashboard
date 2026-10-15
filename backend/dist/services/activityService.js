"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordActivity = recordActivity;
exports.getActivities = getActivities;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
function recordActivity(actorId, action, relatedTaskId, previousValue = null, newValue = null, source = 'application', metadata = null, db = (0, connection_js_1.getDb)()) {
    const eventId = `act_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const stmt = db.prepare(`
    INSERT INTO activity_events (id, actor_id, action, related_task_id, previous_value, new_value, source, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(eventId, actorId, action, relatedTaskId, previousValue, newValue, source, metadataJson, now);
    return {
        id: eventId,
        actor_id: actorId,
        action,
        related_task_id: relatedTaskId,
        previous_value: previousValue,
        new_value: newValue,
        source,
        metadata_json: metadataJson,
        created_at: now
    };
}
function getActivities(options = {}, db = (0, connection_js_1.getDb)()) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const conditions = [];
    const params = [];
    if (options.taskId) {
        conditions.push('a.related_task_id = ?');
        params.push(options.taskId);
    }
    if (options.actorId) {
        conditions.push('a.actor_id = ?');
        params.push(options.actorId);
    }
    if (options.source) {
        conditions.push('a.source = ?');
        params.push(options.source);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM activity_events a ${whereClause}`);
    const countRes = countStmt.get(...params);
    const queryStmt = db.prepare(`
    SELECT a.*, u.display_name as actor_name, u.username as actor_username, t.title as task_title
    FROM activity_events a
    LEFT JOIN users u ON a.actor_id = u.id
    LEFT JOIN tasks t ON a.related_task_id = t.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `);
    const rows = queryStmt.all(...params, limit, offset);
    return {
        activities: rows,
        total: countRes.count
    };
}
