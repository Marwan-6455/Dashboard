import { v4 as uuidv4 } from 'uuid';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/connection.js';
import { ActivityEvent, ActivitySource } from '../types/index.js';

export function recordActivity(
  actorIdOrOptions: string | null | {
    actorId?: string | null;
    action: string;
    relatedTaskId?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    source?: ActivitySource;
    metadata?: Record<string, any> | null;
  },
  actionOrDb?: string | DatabaseSync,
  relatedTaskId?: string | null,
  previousValue: string | null = null,
  newValue: string | null = null,
  source: ActivitySource = 'application',
  metadata: Record<string, any> | null = null,
  dbPassed?: DatabaseSync
): ActivityEvent {
  let actorId: string | null = null;
  let action = '';
  let taskId: string | null = null;
  let prevVal: string | null = null;
  let newVal: string | null = null;
  let src: ActivitySource = 'application';
  let meta: Record<string, any> | null = null;
  let db: DatabaseSync;

  if (typeof actorIdOrOptions === 'object' && actorIdOrOptions !== null) {
    actorId = actorIdOrOptions.actorId || null;
    action = actorIdOrOptions.action;
    taskId = actorIdOrOptions.relatedTaskId || null;
    prevVal = actorIdOrOptions.previousValue || null;
    newVal = actorIdOrOptions.newValue || null;
    src = actorIdOrOptions.source || 'application';
    meta = actorIdOrOptions.metadata || null;
    db = (actionOrDb as DatabaseSync) || getDb();
  } else {
    actorId = actorIdOrOptions;
    action = (actionOrDb as string) || '';
    taskId = relatedTaskId || null;
    prevVal = previousValue;
    newVal = newValue;
    src = source;
    meta = metadata;
    db = dbPassed || getDb();
  }

  const eventId = `act_${Date.now()}_${uuidv4().slice(0, 8)}`;
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

export function getActivities(options: {
  taskId?: string;
  actorId?: string;
  source?: string;
  limit?: number;
  offset?: number;
} = {}, db = getDb()): { activities: any[]; total: number } {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const conditions: string[] = [];
  const params: any[] = [];

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
  const countRes = countStmt.get(...params) as { count: number };

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
