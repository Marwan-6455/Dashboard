import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../services/notificationService.js';

export const notificationRouter = Router();

notificationRouter.use(authMiddleware);

// GET /api/notifications
notificationRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const unreadOnly = req.query.unreadOnly === 'true';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const notifications = getUserNotifications(req.user.id, unreadOnly, limit);
  const unreadCount = getUnreadNotificationCount(req.user.id);

  res.json({
    notifications,
    unreadCount
  });
});

// PATCH /api/notifications/:id/read
notificationRouter.patch('/:id/read', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const updated = markNotificationAsRead(req.params.id, req.user.id);
  if (!updated) {
    res.status(404).json({ error: 'Notification not found or unauthorized' });
    return;
  }

  const unreadCount = getUnreadNotificationCount(req.user.id);
  res.json({ success: true, unreadCount });
});

// POST /api/notifications/read-all
notificationRouter.post('/read-all', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const updatedCount = markAllNotificationsAsRead(req.user.id);
  res.json({ success: true, updatedCount, unreadCount: 0 });
});
