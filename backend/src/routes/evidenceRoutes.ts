import { Router, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { createEvidence, deleteEvidence, getEvidence, getEvidenceById } from '../services/evidenceService.js';
import { EvidenceType } from '../types/index.js';

export const evidenceRouter = Router();

evidenceRouter.use(authMiddleware);

evidenceRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { taskId, evidenceType } = req.query;
  const items = getEvidence({
    taskId: taskId as string,
    evidenceType: evidenceType as string
  });
  res.json({ evidence: items });
});

evidenceRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const item = getEvidenceById(req.params.id);
  if (!item) {
    res.status(404).json({ error: `Evidence ${req.params.id} not found.` });
    return;
  }
  res.json({ evidence: item });
});

evidenceRouter.get('/:id/file', (req: AuthenticatedRequest, res: Response): void => {
  const item = getEvidenceById(req.params.id);
  if (!item) {
    res.status(404).json({ error: `Evidence ${req.params.id} not found.` });
    return;
  }

  // Prevent path traversal
  const safeFilename = path.basename(item.stored_filename);
  const filePath = path.resolve(process.cwd(), 'uploads', safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Stored evidence file not found on disk.' });
    return;
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', item.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.original_filename)}"`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

evidenceRouter.post('/upload', uploadMiddleware.single('file'), (req: AuthenticatedRequest, res: Response): void => {
  if ((req as any).fileValidationError) {
    res.status(400).json({ error: (req as any).fileValidationError });
    return;
  }

  const file = req.file;
  const { taskId, description, evidenceType, externalUrl, relatedChangesetId } = req.body;

  if (!description || !description.trim()) {
    res.status(400).json({ error: 'Evidence description is required.' });
    return;
  }

  if (file) {
    const ext = path.extname(file.originalname).toLowerCase();
    let detectedType: EvidenceType = 'document';
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      detectedType = 'screenshot';
    } else if (['.mp4', '.webm'].includes(ext)) {
      detectedType = 'video';
    } else if (['.log', '.txt'].includes(ext)) {
      detectedType = 'test_log';
    }

    const item = createEvidence(
      {
        taskId: taskId || null,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        filePath: `uploads/${file.filename}`,
        contentType: file.mimetype,
        fileSize: file.size,
        evidenceType: (evidenceType as EvidenceType) || detectedType,
        description: description.trim(),
        externalUrl: externalUrl || null,
        relatedChangesetId: relatedChangesetId || null
      },
      req.user!.id
    );

    res.status(201).json({ evidence: item });
  } else if (externalUrl) {
    // Artifact link
    const item = createEvidence(
      {
        taskId: taskId || null,
        originalFilename: 'external_link',
        storedFilename: '',
        filePath: '',
        contentType: 'text/uri-list',
        fileSize: 0,
        evidenceType: 'external_link',
        description: description.trim(),
        externalUrl: externalUrl.trim(),
        relatedChangesetId: relatedChangesetId || null
      },
      req.user!.id
    );
    res.status(201).json({ evidence: item });
  } else {
    res.status(400).json({ error: 'Either a file upload or externalUrl is required.' });
  }
});

evidenceRouter.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    deleteEvidence(req.params.id, req.user!.id);
    res.json({ message: 'Evidence deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
