"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordActivity = recordActivity;
exports.getActivities = getActivities;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
function recordActivity(actorIdOrOptions, actionOrDb, relatedTaskId, previousValue = null, newValue = null, source = 'application', metadata = null, dbPassed) {
    let actorId = null;
    let action = '';
    let taskId = null;
    let prevVal = null;
    let newVal = null;
    let src = 'application';
    let meta = null;
    let db;
    if (typeof actorIdOrOptions === 'object' && actorIdOrOptions !== null) {
        actorId = actorIdOrOptions.actorId || null;
        action = actorIdOrOptions.action;
        taskId = actorIdOrOptions.relatedTaskId || null;
        prevVal = actorIdOrOptions.previousValue || null;
        newVal = actorIdOrOptions.newValue || null;
        src = actorIdOrOptions.source || 'application';
        meta = actorIdOrOptions.metadata || null;
        db = actionOrDb || (0, connection_js_1.getDb)();
    }
    else {
        actorId = actorIdOrOptions;
        action = actionOrDb || '';
        taskId = relatedTaskId || null;
        prevVal = previousValue;
        newVal = newValue;
        src = source;
        meta = metadata;
        db = dbPassed || (0, connection_js_1.getDb)();
    }
    const eventId = `act_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const metadataJson = meta ? JSON.stringify(meta) : null;
    const stmt = db.prepare(`
    INSERT INTO activity_events (id, actor_id, action, related_task_id, previous_value, new_value, source, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(eventId, actorId, action, taskId, prevVal, newVal, src, metadataJson, now);
    return {
        id: eventId,
        actor_id: actorId,
        action,
        related_task_id: taskId,
        previous_value: prevVal,
        new_value: newVal,
        source: src,
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
