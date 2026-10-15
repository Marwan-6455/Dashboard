import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error Handler]:', err.message || err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File exceeds maximum upload size of 25MB.' });
      return;
    }
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }

  const statusCode = err.statusCode || (err.message && err.message.includes('not found') ? 404 : 400);
  res.status(statusCode).json({
    error: err.message || 'An unexpected error occurred.'
  });
}
