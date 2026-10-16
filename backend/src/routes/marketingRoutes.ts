import { Router, Response } from 'express';
import { MarketingService } from '../services/marketingService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const marketingRouter = Router();

// List marketing items
marketingRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, channel, status } = req.query;
    const items = MarketingService.getMarketingItems({
      projectId: projectId as string,
      channel: channel as string,
      status: status as string
    });
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single item
marketingRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = MarketingService.getMarketingItemById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Marketing item not found.' });
      return;
    }
    res.json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create item
marketingRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { project_id, campaign, channel, title, copy, creative_asset_ids_json, scheduled_date, status, external_url, deliverables } = req.body;
    if (!project_id || !campaign || !channel || !title || !copy) {
      res.status(400).json({ error: 'Missing required marketing fields: project_id, campaign, channel, title, copy.' });
      return;
    }

    const id = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item = MarketingService.createMarketingItem({
      id,
      project_id,
      campaign,
      channel,
      title,
      copy,
      creative_asset_ids_json: creative_asset_ids_json || null,
      scheduled_date: scheduled_date || null,
      status: status || 'Idea',
      owner_id: req.user!.id,
      external_url: external_url || null,
      deliverables: deliverables || null
    });

    res.status(201).json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update item
marketingRouter.patch('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = MarketingService.updateMarketingItem(req.params.id, req.body);
    if (!item) {
      res.status(404).json({ error: 'Marketing item not found.' });
      return;
    }
    res.json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
