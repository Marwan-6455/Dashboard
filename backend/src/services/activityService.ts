import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { ActivityEvent, ActivitySource } from '../types/index.js';

export function recordActivity(
  actorId: string | null,
  action: string,
  relatedTaskId: string | null,
  previousValue: string | null = null,
  newValue: string | null = null,
  source: ActivitySource = 'application',
  metadata: Record<string, any> | null = null,
  db = getDb()
): ActivityEvent {
  const eventId = `act_${Date.now()}_${uuidv4().slice(0, 8)}`;
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
