import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { getActivities } from '../services/activityService.js';

export const activityRouter = Router();

activityRouter.use(authMiddleware);

activityRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { taskId, actorId, source, limit, offset } = req.query;

  const result = getActivities({
    taskId: taskId as string,
    actorId: actorId as string,
    source: source as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0
  });

  res.json(result);
});
