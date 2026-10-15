"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.getUserNotifications = getUserNotifications;
exports.getUnreadNotificationCount = getUnreadNotificationCount;
exports.markNotificationAsRead = markNotificationAsRead;
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
function createNotification(userId, type, title, message, relatedTaskId = null, db = (0, connection_js_1.getDb)()) {
    const id = `notif_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
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
function getUserNotifications(userId, unreadOnly = false, limit = 30, db = (0, connection_js_1.getDb)()) {
    const query = unreadOnly
        ? 'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT ?'
        : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?';
    const stmt = db.prepare(query);
    return stmt.all(userId, limit);
}
function getUnreadNotificationCount(userId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0');
    const result = stmt.get(userId);
    return result?.count || 0;
}
function markNotificationAsRead(notificationId, userId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
    const result = stmt.run(notificationId, userId);
    return Number(result.changes || 0) > 0;
}
function markAllNotificationsAsRead(userId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0');
    const result = stmt.run(userId);
    return Number(result.changes || 0);
}
