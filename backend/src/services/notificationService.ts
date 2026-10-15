import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { NotificationItem } from '../types/index.js';

export function createNotification(
  userId: string,
  type: NotificationItem['type'],
  title: string,
  message: string,
  relatedTaskId: string | null = null,
  db = getDb()
): NotificationItem {
  const id = `notif_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, related_task_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);

  stmt.run(id, userId, type, title, message, relatedTaskId, now);

  return {
    id,
    user_id: userId,
    type,
    title,
    message,
    related_task_id: relatedTaskId,
    is_read: 0,
    created_at: now
  };
}

export function getUserNotifications(
  userId: string,
  unreadOnly = false,
  limit = 30,
  db = getDb()
): NotificationItem[] {
  const query = unreadOnly
    ? 'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?';

  const stmt = db.prepare(query);
  return (stmt.all(userId, limit) as unknown) as NotificationItem[];
}

export function getUnreadNotificationCount(userId: string, db = getDb()): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0');
  const result = stmt.get(userId) as { count: number } | undefined;
  return result?.count || 0;
}

export function markNotificationAsRead(notificationId: string, userId: string, db = getDb()): boolean {
  const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
  const result = stmt.run(notificationId, userId);
  return Number(result.changes || 0) > 0;
}

export function markAllNotificationsAsRead(userId: string, db = getDb()): number {
  const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0');
  const result = stmt.run(userId);
  return Number(result.changes || 0);
}
