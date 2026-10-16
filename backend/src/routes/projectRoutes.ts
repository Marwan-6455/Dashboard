import { Router, Response } from 'express';
import { ProjectService } from '../services/projectService.js';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const projectRouter = Router();

// List all projects
projectRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const projects = ProjectService.getAllProjects(workspaceId);
    res.json({ projects });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
projectRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const project = ProjectService.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create project (Owner/Admin)
projectRouter.post('/', authMiddleware, requireRole(['owner', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, name, description, repository_id, status, unity_version, target_platforms_json } = req.body;
    if (!id || !name || !description || !repository_id) {
      res.status(400).json({ error: 'Missing required fields: id, name, description, repository_id.' });
      return;
    }
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const project = ProjectService.createProject({
      id,
      workspace_id: workspaceId,
      name,
      description,
      repository_id,
      status,
      owner_id: req.user?.id,
      unity_version,
      target_platforms_json
    });
    res.status(201).json({ project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update project (Owner/Admin)
projectRouter.patch('/:id', authMiddleware, requireRole(['owner', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const project = ProjectService.updateProject(req.params.id, req.body);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get project health telemetry & explainable signals
projectRouter.get('/:id/health', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const health = ProjectService.calculateProjectHealth(req.params.id);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Milestones
projectRouter.get('/:id/milestones', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const milestones = ProjectService.getMilestones(req.params.id);
    res.json({ milestones });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRouter.post('/:id/milestones', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, target_date, status, completion_requirements, dependencies_json } = req.body;
    if (!title || !target_date) {
      res.status(400).json({ error: 'Missing title or target_date.' });
      return;
    }
    const id = `mls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const milestone = ProjectService.createMilestone({
      id,
      project_id: req.params.id,
      title,
      description,
      target_date,
      owner_id: req.user?.id || null,
      status: status || 'Planned',
      dependencies_json,
      completion_requirements,
      completed_at: null
    });
    res.status(201).json({ milestone });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRouter.patch('/:id/milestones/:mId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const milestone = ProjectService.updateMilestone(req.params.mId, req.body);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    res.json({ milestone });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sprints
projectRouter.get('/:id/sprints', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const sprints = ProjectService.getSprints(req.params.id);
    res.json({ sprints });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRouter.post('/:id/sprints', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, goal, start_date, end_date, team_id, capacity_hours, status } = req.body;
    if (!name || !goal || !start_date || !end_date) {
      res.status(400).json({ error: 'Missing required sprint fields: name, goal, start_date, end_date.' });
      return;
    }
    const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sprint = ProjectService.createSprint({
      id,
      project_id: req.params.id,
      team_id,
      name,
      goal,
      start_date,
      end_date,
      capacity_hours: Number(capacity_hours) || 0,
      status: status || 'Planned',
      retrospective_notes: null
    });
    res.status(201).json({ sprint });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRouter.patch('/:id/sprints/:sId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const sprint = ProjectService.updateSprint(req.params.sId, req.body);
    if (!sprint) {
      res.status(404).json({ error: 'Sprint not found.' });
      return;
    }
    res.json({ sprint });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
