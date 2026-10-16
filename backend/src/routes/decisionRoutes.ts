import { Router, Response } from 'express';
import { DecisionService } from '../services/decisionService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const decisionRouter = Router();

// List decisions
decisionRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, scope, status } = req.query;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const decisions = DecisionService.getDecisions({
      workspaceId,
      projectId: projectId as string,
      scope: scope as string,
      status: status as string
    });
    res.json({ decisions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single decision
decisionRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const decision = DecisionService.getDecisionById(req.params.id);
    if (!decision) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    res.json({ decision });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create decision (ADR)
decisionRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, title, scope, context, options_considered, chosen_approach, reasoning, status, related_tasks_json } = req.body;
    if (!title || !scope || !context || !chosen_approach || !reasoning) {
      res.status(400).json({ error: 'Missing required ADR fields: title, scope, context, chosen_approach, reasoning.' });
      return;
    }

    const rand = Math.floor(100 + Math.random() * 900);
    const id = `ADR-${rand}`;
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

    const decision = DecisionService.createDecision({
      id,
      workspace_id: workspaceId,
      project_id: project_id || null,
      title,
      scope,
      context,
      options_considered: options_considered || 'None listed',
      chosen_approach,
      reasoning,
      author_id: req.user!.id,
      status: status || 'Accepted',
      approver_id: req.user!.id,
      superseded_by_id: null,
      related_tasks_json: related_tasks_json || null
    });

    res.status(201).json({ decision });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update decision
decisionRouter.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const decision = DecisionService.updateDecision(req.params.id, req.body);
    if (!decision) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    res.json({ decision });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Supersede decision
decisionRouter.post('/:id/supersede', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newDecisionId } = req.body;
    if (!newDecisionId) {
      res.status(400).json({ error: 'newDecisionId is required to supersede.' });
      return;
    }
    const ok = DecisionService.supersedeDecision(req.params.id, newDecisionId, req.user!.id);
    if (!ok) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    res.json({ success: true, message: `Decision superseded by ${newDecisionId}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
