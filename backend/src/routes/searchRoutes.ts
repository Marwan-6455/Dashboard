import { Router, Response } from 'express';
import { SearchService } from '../services/searchService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const searchRouter = Router();

searchRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    const projectId = req.query.projectId as string;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    if (!query) {
      res.json({ results: [] });
      return;
    }

    const results = SearchService.search(query, workspaceId, projectId);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
