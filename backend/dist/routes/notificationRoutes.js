"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const notificationService_js_1 = require("../services/notificationService.js");
exports.notificationRouter = (0, express_1.Router)();
exports.notificationRouter.use(auth_js_1.authMiddleware);
// GET /api/notifications
exports.notificationRouter.get('/', (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const notifications = (0, notificationService_js_1.getUserNotifications)(req.user.id, unreadOnly, limit);
    const unreadCount = (0, notificationService_js_1.getUnreadNotificationCount)(req.user.id);
    res.json({
        notifications,
        unreadCount
    });
});
// PATCH /api/notifications/:id/read
exports.notificationRouter.patch('/:id/read', (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const updated = (0, notificationService_js_1.markNotificationAsRead)(req.params.id, req.user.id);
    if (!updated) {
        res.status(404).json({ error: 'Notification not found or unauthorized' });
        return;
    }
    const unreadCount = (0, notificationService_js_1.getUnreadNotificationCount)(req.user.id);
    res.json({ success: true, unreadCount });
});
// POST /api/notifications/read-all
exports.notificationRouter.post('/read-all', (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const updatedCount = (0, notificationService_js_1.markAllNotificationsAsRead)(req.user.id);
    res.json({ success: true, updatedCount, unreadCount: 0 });
});
