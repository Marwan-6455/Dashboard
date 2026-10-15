import { Router, Response } from 'express';
import { getDb } from '../db/connection.js';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import { seedDatabase } from '../db/seed.js';

export const settingsRouter = Router();

// Health check endpoint (public)
settingsRouter.get('/health', (_req, res: Response): void => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 as alive').get() as { alive: number };
    res.json({
      status: 'healthy',
      system: 'Cindermarch Engine Hub',
      project: 'Terminal 6',
      timestamp: new Date().toISOString(),
      database: row?.alive === 1 ? 'connected' : 'error',
      nodeVersion: process.version
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

settingsRouter.use(authMiddleware);

// Get completion gate settings
settingsRouter.get('/gates', (_req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const stmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
  const row = stmt.get('completion_gates') as { value_json: string } | undefined;
  const config = row ? JSON.parse(row.value_json) : {};
  res.json({ completionGates: config });
});

// Update completion gate settings (admin only)
settingsRouter.patch('/gates', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const now = new Date().toISOString();
  const currentStmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
  const currentRow = currentStmt.get('completion_gates') as { value_json: string } | undefined;
  const current = currentRow ? JSON.parse(currentRow.value_json) : {};

  const updated = {
    ...current,
    ...req.body
  };

  db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES ('completion_gates', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(updated), now);

  res.json({ completionGates: updated });
});

// Reseed database safely (admin only)
settingsRouter.post('/reseed', requireRole(['admin']), (req: AuthenticatedRequest, res: Response): void => {
  const { confirm } = req.body;
  if (confirm !== 'RESET_TERMINAL_6') {
    res.status(400).json({
      error: 'Confirmation required. Please provide confirm: "RESET_TERMINAL_6" to proceed.'
    });
    return;
  }

  const db = getDb();
  // Clear non-core data
  db.exec(`
    DELETE FROM task_comments;
    DELETE FROM task_dependencies;
    DELETE FROM task_acceptance_criteria;
    DELETE FROM task_changesets;
    DELETE FROM reviews;
    DELETE FROM evidence;
    DELETE FROM test_reports;
    DELETE FROM activity_events;
    DELETE FROM tasks;
    DELETE FROM uvcs_changesets;
    DELETE FROM users;
    DELETE FROM projects;
    DELETE FROM settings;
    DELETE FROM integration_configs;
    DELETE FROM _migrations;
  `);

  seedDatabase(db);

  res.json({ message: 'Database reset and successfully reseeded with Terminal 6 initial demo data.' });
});
