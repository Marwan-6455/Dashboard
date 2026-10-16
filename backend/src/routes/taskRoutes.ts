import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authMiddleware, checkWorkspaceSuspension, requireRole } from '../middleware/auth.js';
import {
  createTask,
  getTaskById,
  getTasks,
  updateTask,
  updateTaskStatus,
  addAcceptanceCriterion,
  toggleAcceptanceCriterion,
  addComment
} from '../services/taskService.js';
import { linkChangesetToTask, recordChangeset, unlinkChangesetFromTask } from '../services/uvcsService.js';
import { evaluateCompletionGates } from '../services/gateService.js';
import { extendTaskDeadline, exemptTaskDeadline } from '../services/strikeService.js';

export const taskRouter = Router();

taskRouter.use(authMiddleware);
taskRouter.use(checkWorkspaceSuspension);

taskRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const {
    status,
    ownerId,
    reviewerId,
    priority,
    search,
    projectId,
    workspaceId,
    teamId,
    category,
    overdueOnly,
    myTasksOnly,
    sortBy,
    sortOrder
  } = req.query;

  // By default scope to user's active workspace, or allow explicit override if authorized
  const effectiveWorkspaceId = (workspaceId as string) || req.user?.workspace_id || 'ws_cindermarch';

  const tasks = getTasks({
    status: status as string,
    ownerId: ownerId as string,
    reviewerId: reviewerId as string,
    priority: priority as string,
    search: search as string,
    projectId: projectId as string,
    workspaceId: effectiveWorkspaceId,
    teamId: teamId as string,
    category: category as string,
    overdueOnly: overdueOnly === 'true',
    myTasksUserId: myTasksOnly === 'true' ? req.user?.id : undefined,
    sortBy: sortBy as any,
    sortOrder: sortOrder as any
  });

  res.json({ tasks });
});

taskRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const task = getTaskById(req.params.id);
  if (!task) {
    res.status(404).json({ error: `Task ${req.params.id} not found.` });
    return;
  }
  res.json({ task });
});

taskRouter.get('/:id/gates', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const gateStatus = evaluateCompletionGates(req.params.id);
    res.json({ gateStatus });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

const createTaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  projectId: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().nullable().optional(),
  category: z.string().optional(),
  estimatedEffort: z.string().optional(),
  actualEffort: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  status: z.enum(['Backlog', 'In Progress', 'Ready for Review', 'Changes Requested', 'Ready to Integrate', 'Verified Complete', 'Blocked']).optional(),
  deadline: z.string().nullable().optional(),
  acceptanceCriteria: z.array(z.string()).optional()
});

taskRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const taskData = {
    ...parseResult.data,
    workspaceId: parseResult.data.workspaceId || req.user?.workspace_id || 'ws_cindermarch'
  };

  const task = createTask(taskData, req.user!.id);
  res.status(201).json({ task });
});

taskRouter.patch('/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const updated = updateTask(req.params.id, req.body, req.user!.id);
    res.json({ task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

taskRouter.patch('/:id/status', (req: AuthenticatedRequest, res: Response): void => {
  const { status } = req.body;
  if (!status) {
    res.status(400).json({ error: 'Status is required.' });
    return;
  }

  try {
    const updated = updateTaskStatus(req.params.id, status, req.user!.id);
    res.json({ task: updated });
  } catch (err: any) {
    if (err.statusCode === 422) {
      res.status(422).json({
        error: err.message,
        gateStatus: err.gateStatus
      });
      return;
    }
    res.status(400).json({ error: err.message });
  }
});

taskRouter.post('/:id/criteria', (req: AuthenticatedRequest, res: Response): void => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Acceptance criterion title is required.' });
    return;
  }

  const criterion = addAcceptanceCriterion(req.params.id, title);
  res.status(201).json({ criterion });
});

taskRouter.patch('/:id/criteria/:critId', (req: AuthenticatedRequest, res: Response): void => {
  const { isSatisfied } = req.body;
  if (isSatisfied === undefined) {
    res.status(400).json({ error: 'isSatisfied boolean is required.' });
    return;
  }

  const updated = toggleAcceptanceCriterion(req.params.critId, !!isSatisfied, req.user!.id);
  res.json({ criterion: updated });
});

taskRouter.post('/:id/comments', (req: AuthenticatedRequest, res: Response): void => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Comment content cannot be empty.' });
    return;
  }

  const comment = addComment(req.params.id, req.user!.id, content);
  res.status(201).json({ comment });
});

taskRouter.post('/:id/changesets', (req: AuthenticatedRequest, res: Response): void => {
  const { changesetId, rawChangesetId, comment, author, branch, repositoryId } = req.body;

  try {
    if (changesetId) {
      // Existing changeset UUID linking
      linkChangesetToTask(req.params.id, changesetId, req.user!.id);
    } else if (rawChangesetId && comment && author) {
      // Record new manual changeset and link
      recordChangeset(
        {
          repositoryId,
          changesetId: rawChangesetId,
          comment,
          author,
          branch,
          taskId: req.params.id
        },
        req.user!.id
      );
    } else {
      res.status(400).json({ error: 'Must provide either existing changesetId or new changeset details (rawChangesetId, comment, author).' });
      return;
    }

    const task = getTaskById(req.params.id);
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

taskRouter.delete('/:id/changesets/:changesetId', (req: AuthenticatedRequest, res: Response): void => {
  try {
    unlinkChangesetFromTask(req.params.id, req.params.changesetId, req.user!.id);
    const task = getTaskById(req.params.id);
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/tasks/:id/extend-deadline (Admin/Owner only)
taskRouter.post('/:id/extend-deadline', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const { newDeadline, reason } = req.body;
  if (!newDeadline || !reason) {
    res.status(400).json({ error: 'Both newDeadline and a documented reason are required.' });
    return;
  }

  try {
    const updated = extendTaskDeadline(req.params.id, req.user!.id, newDeadline, reason);
    res.json({ success: true, task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/tasks/:id/exempt-deadline (Admin/Owner only)
taskRouter.post('/:id/exempt-deadline', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ error: 'A documented reason is required to exempt a task deadline.' });
    return;
  }

  try {
    const updated = exemptTaskDeadline(req.params.id, req.user!.id, reason);
    res.json({ success: true, task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
