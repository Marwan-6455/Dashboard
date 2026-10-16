import { Router, Response } from 'express';
import { AssetService } from '../services/assetService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const assetRouter = Router();

// List assets with filters
assetRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, teamId, category, status, pipelineStage } = req.query;
    const assets = AssetService.getAssets({
      projectId: projectId as string,
      teamId: teamId as string,
      category: category as string,
      status: status as string,
      pipelineStage: pipelineStage as string
    });
    res.json({ assets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single asset
assetRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const asset = AssetService.getAssetById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    res.json({ asset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new asset record
assetRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      project_id,
      team_id,
      name,
      category,
      description,
      version,
      status,
      pipeline_stage,
      tags_json,
      preview_url,
      file_path,
      file_size,
      technical_meta_json,
      linked_task_id
    } = req.body;

    if (!project_id || !name || !category) {
      res.status(400).json({ error: 'Missing required fields: project_id, name, category.' });
      return;
    }

    const id = `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const asset = AssetService.createAsset({
      id,
      project_id,
      team_id: team_id || null,
      name,
      category,
      description: description || null,
      owner_id: req.user!.id,
      version: version || 'v1.0',
      status: status || 'Proposed',
      pipeline_stage: pipeline_stage || null,
      tags_json: tags_json || null,
      preview_url: preview_url || null,
      file_path: file_path || null,
      file_size: file_size || 0,
      technical_meta_json: technical_meta_json || null,
      linked_task_id: linked_task_id || null
    });

    res.status(201).json({ asset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update asset
assetRouter.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const asset = AssetService.updateAsset(req.params.id, req.body);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    res.json({ asset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update asset approval status
assetRouter.post('/:id/status', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, pipelineStage } = req.body;
    if (!status) {
      res.status(400).json({ error: 'Status is required.' });
      return;
    }
    const asset = AssetService.updateAssetStatus(req.params.id, status, pipelineStage);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    res.json({ asset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
