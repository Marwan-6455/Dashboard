import { Router, Response } from 'express';
import { StoryService } from '../services/storyService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const storyRouter = Router();

// List story entries
storyRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, category, status } = req.query;
    const entries = StoryService.getStoryEntries({
      projectId: projectId as string,
      category: category as string,
      status: status as string
    });
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single story entry
storyRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = StoryService.getStoryEntryById(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Story entry not found.' });
      return;
    }
    res.json({ entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create story entry
storyRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, category, title, summary, body, tags_json, status, related_entries_json, version } = req.body;
    if (!project_id || !category || !title || !summary || !body) {
      res.status(400).json({ error: 'Missing required story fields: project_id, category, title, summary, body.' });
      return;
    }

    const id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = StoryService.createStoryEntry({
      id,
      project_id,
      category,
      title,
      summary,
      body,
      tags_json: tags_json || null,
      status: status || 'Draft',
      author_id: req.user!.id,
      approved_by: null,
      related_entries_json: related_entries_json || null,
      version: version || '1.0'
    });

    res.status(201).json({ entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update story entry
storyRouter.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = StoryService.updateStoryEntry(req.params.id, req.body);
    if (!entry) {
      res.status(404).json({ error: 'Story entry not found.' });
      return;
    }
    res.json({ entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Approve story entry to Canon
storyRouter.post('/:id/approve', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = StoryService.approveStoryEntry(req.params.id, req.user!.id);
    if (!entry) {
      res.status(404).json({ error: 'Story entry not found.' });
      return;
    }
    res.json({ entry, message: 'Story entry approved into studio canon.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
