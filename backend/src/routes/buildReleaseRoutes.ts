import { Router, Response } from 'express';
import { BuildReleaseService } from '../services/buildReleaseService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const buildReleaseRouter = Router();

// Builds
buildReleaseRouter.get('/builds', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, status } = req.query;
    const builds = BuildReleaseService.getBuilds({
      projectId: projectId as string,
      status: status as string
    });
    res.json({ builds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

buildReleaseRouter.post('/builds', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      project_id,
      build_number,
      version,
      branch,
      changeset_id,
      build_target,
      unity_version,
      status,
      test_report_id,
      artifacts_json,
      known_issues,
      release_approved,
      changelog
    } = req.body;

    if (!project_id || !build_number || !version) {
      res.status(400).json({ error: 'Missing required build fields: project_id, build_number, version.' });
      return;
    }

    const id = `bld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const build = BuildReleaseService.registerBuild({
      id,
      project_id,
      build_number,
      version,
      branch: branch || 'main',
      changeset_id: changeset_id || null,
      build_target: build_target || 'Windows',
      unity_version: unity_version || '6000.0.25f1',
      status: status || 'Queued',
      test_report_id: test_report_id || null,
      artifacts_json: artifacts_json || null,
      known_issues: known_issues || null,
      release_approved: release_approved ? 1 : 0,
      release_approved_by: release_approved ? req.user!.id : null,
      changelog: changelog || null,
      release_owner_id: req.user!.id
    });

    res.status(201).json({ build });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Releases
buildReleaseRouter.get('/releases', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const releases = BuildReleaseService.getReleases(projectId as string);
    res.json({ releases });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

buildReleaseRouter.post('/releases', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, name, version, build_id, status, checklist_json, target_date, released_at, notes } = req.body;
    if (!project_id || !name || !version) {
      res.status(400).json({ error: 'Missing required release fields: project_id, name, version.' });
      return;
    }

    const id = `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const release = BuildReleaseService.createRelease({
      id,
      project_id,
      name,
      version,
      build_id: build_id || null,
      status: status || 'Draft',
      checklist_json: checklist_json || null,
      target_date: target_date || null,
      released_at: released_at || null,
      notes: notes || null,
      created_by: req.user!.id
    });

    res.status(201).json({ release });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Release readiness checklist evaluation
buildReleaseRouter.get('/releases/readiness/evaluate', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, buildId } = req.query;
    if (!projectId) {
      res.status(400).json({ error: 'projectId query parameter is required.' });
      return;
    }
    const readiness = BuildReleaseService.evaluateReleaseReadiness(projectId as string, buildId as string);
    res.json(readiness);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
