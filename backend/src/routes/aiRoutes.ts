import { Router, Response } from 'express';
import { AIAssistantService } from '../services/aiAssistantService.js';
import { getDb } from '../db/connection.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const aiRouter = Router();

// Get AI assistant operational status and configured intelligence provider
aiRouter.get('/status', (req, res: Response) => {
  try {
    const status = AIAssistantService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Query the Cindermarch Studio Operations AI Assistant
aiRouter.post('/query', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, projectId } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Field "prompt" is required and cannot be empty.' });
      return;
    }

    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    // Verify project authorization if an explicit projectId was requested
    if (projectId) {
      const db = getDb();
      const prj = db.prepare('SELECT id, workspace_id FROM projects WHERE id = ?').get(projectId) as { id: string; workspace_id: string } | undefined;
      if (!prj) {
        res.status(404).json({ error: `Project "${projectId}" not found.` });
        return;
      }
      if (prj.workspace_id && prj.workspace_id !== workspaceId) {
        res.status(403).json({ error: `Access denied. Project "${projectId}" does not belong to your authorized workspace.` });
        return;
      }
    }

    const result = await AIAssistantService.query(prompt, req.user!.id, workspaceId, projectId);
    res.json(result);
  } catch (err: any) {
    const statusCode = err.message?.includes('Access denied') || err.message?.includes('Unauthorized') ? 403 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

// Get AI assistant query history for current user
aiRouter.get('/history', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM ai_conversations
      WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).all(req.user!.id) as any[];

    const parsed = rows.map(r => ({
      ...r,
      citations: r.citations_json ? JSON.parse(r.citations_json) : [],
      drafted_actions: r.drafted_actions_json ? JSON.parse(r.drafted_actions_json) : null
    }));

    res.json({ history: parsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
