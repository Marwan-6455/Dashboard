import { evaluateOverdueDeadlines } from './strikeService.js';
import { getDb } from '../db/connection.js';

let workerInterval: NodeJS.Timeout | null = null;

/**
 * Start durable background worker to evaluate task deadlines and issue qualifying strikes
 */
export function startDeadlineStrikeWorker(intervalMs = 60000, workspaceId = 'ws_cindermarch'): void {
  if (workerInterval) {
    clearInterval(workerInterval);
  }

  console.log(`[StrikeWorker] Starting deadline strike evaluator (interval: ${intervalMs / 1000}s, workspace: ${workspaceId})...`);

  // Run initial check immediately
  try {
    const db = getDb();
    const issued = evaluateOverdueDeadlines(workspaceId, db);
    if (issued.length > 0) {
      console.log(`[StrikeWorker] Initial run issued ${issued.length} strike(s).`);
    }
  } catch (err: any) {
    console.error('[StrikeWorker] Error during initial evaluation:', err.message);
  }

  workerInterval = setInterval(() => {
    try {
      const db = getDb();
      const issued = evaluateOverdueDeadlines(workspaceId, db);
      if (issued.length > 0) {
        console.log(`[StrikeWorker] Periodic check issued ${issued.length} strike(s).`);
      }
    } catch (err: any) {
      console.error('[StrikeWorker] Periodic evaluation error:', err.message);
    }
  }, intervalMs);

  // Unref so worker doesn't prevent graceful exit if needed
  workerInterval.unref?.();
}

/**
 * Stop background worker cleanly
 */
export function stopDeadlineStrikeWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[StrikeWorker] Background evaluator stopped.');
  }
}
