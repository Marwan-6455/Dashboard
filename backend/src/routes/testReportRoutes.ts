import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { createTestReport, getTestReportById, getTestReports } from '../services/testReportService.js';

export const testReportRouter = Router();

testReportRouter.use(authMiddleware);

testReportRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { taskId, revision, result, source } = req.query;
  const reports = getTestReports({
    taskId: taskId as string,
    revision: revision as string,
    result: result as string,
    source: source as string
  });
  res.json({ reports });
});

testReportRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const report = getTestReportById(req.params.id);
  if (!report) {
    res.status(404).json({ error: `Test report ${req.params.id} not found.` });
    return;
  }
  res.json({ report });
});

const reportSchema = z.object({
  taskId: z.string().nullable().optional(),
  repositoryId: z.string().optional(),
  revision: z.string().min(1, 'Revision or Changeset ID is required'),
  unityVersion: z.string().min(1, 'Unity version is required'),
  testSuite: z.string().min(1, 'Test suite name is required'),
  result: z.enum(['Passed', 'Failed', 'Error', 'Not Run']),
  passedCount: z.number().int().min(0).optional(),
  failedCount: z.number().int().min(0).optional(),
  skippedCount: z.number().int().min(0).optional(),
  buildResult: z.enum(['Success', 'Failed', 'Not Applicable']).optional(),
  runnerIdentity: z.string().min(1, 'Runner identity is required'),
  logArtifactId: z.string().nullable().optional()
});

testReportRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const parseResult = reportSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  // Force manual source and manual_unverified verificationState for UI submissions per rule
  const report = createTestReport(
    {
      ...parseResult.data,
      source: 'manual',
      verificationState: 'manual_unverified'
    },
    req.user!.id
  );

  res.status(201).json({ report });
});
