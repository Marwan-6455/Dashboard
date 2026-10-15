import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { createReviewRequest, getReviewById, getReviews, submitReviewDecision } from '../services/reviewService.js';

export const reviewRouter = Router();

reviewRouter.use(authMiddleware);

reviewRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { taskId, decision, reviewerId, developerId } = req.query;

  const reviews = getReviews({
    taskId: taskId as string,
    decision: decision as string,
    reviewerId: reviewerId as string,
    developerId: developerId as string
  });

  res.json({ reviews });
});

reviewRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const review = getReviewById(req.params.id);
  if (!review) {
    res.status(404).json({ error: `Review ${req.params.id} not found.` });
    return;
  }
  res.json({ review });
});

const createReviewSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  developerId: z.string().min(1, 'Developer ID is required'),
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  changesetId: z.string().nullable().optional(),
  checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    passed: z.boolean(),
    notes: z.string().optional()
  })).optional()
});

reviewRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const parseResult = createReviewSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const review = createReviewRequest(parseResult.data, req.user!.id);
    res.status(201).json({ review });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

const decisionSchema = z.object({
  decision: z.enum(['Approved', 'Changes Requested', 'Rejected']),
  findings: z.string().nullable().optional(),
  requiredFixes: z.string().nullable().optional(),
  checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    passed: z.boolean(),
    notes: z.string().optional()
  })).optional()
});

reviewRouter.post('/:id/decision', (req: AuthenticatedRequest, res: Response): void => {
  const parseResult = decisionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  try {
    const review = submitReviewDecision(req.params.id, parseResult.data, req.user!.id);
    res.json({ review });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
  }
});
