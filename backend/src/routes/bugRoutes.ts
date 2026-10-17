import { Router, Response } from 'express';
import { BugService } from '../services/bugService.js';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const bugRouter = Router();

// List bugs with filters
bugRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, status, severity, priority, assignedTo, assignedTeamId } = req.query;
    const bugs = BugService.getBugs({
      projectId: projectId as string,
      status: status as string,
      severity: severity as string,
      priority: priority as string,
      assignedTo: assignedTo as string,
      assignedTeamId: assignedTeamId as string
    });
    res.json({ bugs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Triage summary
bugRouter.get('/triage/summary', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const summary = BugService.getTriageSummary(projectId as string);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get bug by ID
bugRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const bug = BugService.getBugById(req.params.id);
    if (!bug) {
      res.status(404).json({ error: 'Bug report not found.' });
      return;
    }
    res.json({ bug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new bug report
bugRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      project_id,
      title,
      description,
      severity,
      priority,
      assigned_to,
      assigned_team_id,
      affected_build,
      affected_platform,
      steps_to_reproduce,
      expected_behavior,
      actual_behavior,
      related_task_id,
      changeset_ref
    } = req.body;

    if (!project_id || !title || !description) {
      res.status(400).json({ error: 'Missing required fields: project_id, title, description.' });
      return;
    }

    const prefix = project_id === 'eclipsed' ? 'BUG-ECL' : project_id === 'blue-note-lounge' ? 'BUG-BNL' : 'BUG-T6';
    const randNum = Math.floor(100 + Math.random() * 900);
    const id = `${prefix}-${randNum}`;

    const bug = BugService.createBug({
      id,
      project_id,
      title,
      description,
      severity: severity || 'Major',
      priority: priority || 'P1',
      reporter_id: req.user!.id,
      assigned_to: assigned_to || null,
      assigned_team_id: assigned_team_id || null,
      affected_build: affected_build || null,
      affected_platform: affected_platform || 'PC/Steam',
      steps_to_reproduce: steps_to_reproduce || null,
      expected_behavior: expected_behavior || null,
      actual_behavior: actual_behavior || null,
      related_task_id: related_task_id || null,
      changeset_ref: changeset_ref || null,
      status: 'Reported',
      resolution: null
    });

    res.status(201).json({ bug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update bug report
bugRouter.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const bug = BugService.updateBug(req.params.id, req.body);
    if (!bug) {
      res.status(404).json({ error: 'Bug report not found.' });
      return;
    }
    res.json({ bug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// QA Verification Gate: tester verifies or reopens bug
bugRouter.post('/:id/verify', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { passed, notes } = req.body;
    if (typeof passed !== 'boolean') {
      res.status(400).json({ error: 'Field "passed" (boolean) is required for QA verification.' });
      return;
    }

    const bug = BugService.verifyBug(req.params.id, req.user!.id, passed, notes);
    if (!bug) {
      res.status(404).json({ error: 'Bug report not found.' });
      return;
    }

    res.json({ bug, message: passed ? 'Bug fix verified by QA.' : 'Bug reopened with QA verification notes.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
