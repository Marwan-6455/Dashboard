import { Router, Response } from 'express';
import { WikiService } from '../services/wikiService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const wikiRouter = Router();

// List documents
wikiRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, teamId, category } = req.query;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const documents = WikiService.getDocuments({
      workspaceId,
      projectId: projectId as string,
      teamId: teamId as string,
      category: category as string
    });
    res.json({ documents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single document
wikiRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const document = WikiService.getDocumentById(req.params.id);
    if (!document) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json({ document });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create document
wikiRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, team_id, category, title, content, tags_json, is_pinned } = req.body;
    if (!title || !content || !category) {
      res.status(400).json({ error: 'Missing required document fields: title, content, category.' });
      return;
    }

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    const document = WikiService.createDocument({
      id,
      workspace_id: workspaceId,
      project_id: project_id || null,
      team_id: team_id || null,
      category,
      title,
      content,
      author_id: req.user!.id,
      last_edited_by: req.user!.id,
      tags_json: tags_json || null,
      is_pinned: is_pinned ? 1 : 0,
      version: 1
    });

    res.status(201).json({ document });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update document
wikiRouter.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const document = WikiService.updateDocument(req.params.id, req.body, req.user!.id);
    if (!document) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json({ document });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
wikiRouter.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = WikiService.deleteDocument(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json({ success: true, message: 'Document deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
