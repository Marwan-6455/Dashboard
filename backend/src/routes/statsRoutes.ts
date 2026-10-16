import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { getDashboardOverview } from '../services/statsService.js';

export const statsRouter = Router();

statsRouter.use(authMiddleware);

statsRouter.get('/overview', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const overview = await getDashboardOverview(workspaceId);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
