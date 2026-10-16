import { v4 as uuidv4 } from 'uuid';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/connection.js';
import { parseDeadline } from './reminderScheduler.js';
import { enqueueDiscordEvent } from './discordOutboxService.js';
import { createNotification } from './notificationService.js';
import { recordActivity } from './activityService.js';
import {
  Strike,
  StrikePolicy,
  StrikeStatus,
  WarningLevel,
  WorkspaceEntryEvent,
  WorkspaceSuspension
} from '../types/index.js';

export const DEFAULT_STRIKE_POLICY: StrikePolicy = {
  strike_threshold: 5,
  grace_period_hours: 24,
  timezone: 'Africa/Cairo',
  manager_escalation_enabled: true,
  discord_dm_enabled: true,
  allow_member_disputes: true,
  reinstatement_requires_admin: true,
  warning_templates: {
    first_warning: 'DEADLINE WARNING — You currently have 1 of 5 strikes. A task deadline was missed. Review the task and keep future deadlines on track.',
    second_warning: 'DEADLINE WARNING — You currently have 2 of 5 strikes. Ensure outstanding deadlines are managed promptly.',
    escalation: 'DEADLINE ALERT — You currently have 3 of 5 strikes. Repeated missed deadlines may lead to workspace suspension. Please review your outstanding tasks and upcoming deadlines.',
    final_warning: 'FINAL WARNING — You currently have 4 of 5 strikes. One additional qualifying missed deadline will trigger workspace suspension under the current policy. Review your deadlines immediately.',
    suspended: 'WORKSPACE SUSPENDED — Your account has reached the five-strike threshold. Workspace access is suspended. Contact the Workspace Owner/Admin to request a review.'
  }
};

/**
 * Retrieve current strike policy for workspace
 */
export function getStrikePolicy(workspaceId = 'ws_cindermarch', db = getDb()): StrikePolicy {
  try {
    const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('strike_policy') as
      | { value_json: string }
      | undefined;
    if (row?.value_json) {
      const parsed = JSON.parse(row.value_json);
      return {
        ...DEFAULT_STRIKE_POLICY,
        ...parsed,
        warning_templates: {
          ...DEFAULT_STRIKE_POLICY.warning_templates,
          ...(parsed.warning_templates || {})
        }
      };
    }
  } catch {}
  return DEFAULT_STRIKE_POLICY;
}

/**
 * Update strike policy (Admin only, audited)
 */
export function updateStrikePolicy(
  workspaceId: string,
  updates: Partial<StrikePolicy>,
  adminId: string,
  db = getDb()
): StrikePolicy {
  const current = getStrikePolicy(workspaceId, db);
  const updated: StrikePolicy = {
    ...current,
    ...updates,
    warning_templates: {
      ...current.warning_templates,
      ...(updates.warning_templates || {})
    }
  };

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES ('strike_policy', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(updated), now);

  recordActivity({
    actorId: adminId,
    action: 'strike_policy_updated',
    previousValue: JSON.stringify(current),
    newValue: JSON.stringify(updated),
    source: 'application',
    metadata: { workspaceId }
  }, db);

  return updated;
}

/**
 * Authoritatively calculate active qualifying strike count for a user
 */
export function calculateActiveStrikes(
  workspaceId: string,
  userId: string,
  db = getDb()
): number {
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM strikes
    WHERE workspace_id = ? AND user_id = ? AND status = 'active'
  `).get(workspaceId, userId) as { count: number } | undefined;

  return row ? Number(row.count) : 0;
}

/**
 * Get warning level from active strike count and threshold
 */
export function getWarningLevel(activeStrikes: number, threshold = 5): WarningLevel {
  if (activeStrikes <= 0) return 'none';
  if (activeStrikes >= threshold) return 'suspended';
  if (activeStrikes === threshold - 1) return 'final_warning';
  if (activeStrikes === 3) return 'escalation';
  if (activeStrikes === 2) return 'second_warning';
  return 'first_warning';
}

/**
 * Send threshold warning if not already sent for this strike level
 */
export function sendThresholdNotification(
  workspaceId: string,
  userId: string,
  thresholdLevel: number,
  strikeId: string,
  policy: StrikePolicy,
  db = getDb()
): void {
  // Deduplicate: check if notification was already sent for this threshold level & strike
  const existing = db.prepare(`
    SELECT id FROM strike_threshold_notifications
    WHERE workspace_id = ? AND user_id = ? AND threshold_level = ? AND strike_id = ?
  `).get(workspaceId, userId, thresholdLevel, strikeId);

  if (existing) {
    return;
  }

  const notifId = `stn_${Date.now()}_${uuidv4().slice(0, 6)}`;
  const now = new Date().toISOString();

  // Create in-app notification
  let title = `Deadline Alert: ${thresholdLevel} Active Strike(s)`;
  let message = `You have reached ${thresholdLevel} of ${policy.strike_threshold} strikes.`;
  if (thresholdLevel === 1) {
    title = 'Deadline Warning (1 of 5 strikes)';
    message = policy.warning_templates?.first_warning || 'First warning: A task deadline was missed.';
  } else if (thresholdLevel === 2) {
    title = 'Deadline Warning (2 of 5 strikes)';
    message = policy.warning_templates?.second_warning || 'Second warning: Ensure outstanding deadlines are managed.';
  } else if (thresholdLevel === 3) {
    title = 'Deadline Alert (3 of 5 strikes)';
    message = policy.warning_templates?.escalation || 'Escalated warning: Repeated missed deadlines may lead to suspension.';
  } else if (thresholdLevel === 4) {
    title = 'FINAL DEADLINE WARNING (4 of 5 strikes)';
    message = policy.warning_templates?.final_warning || 'FINAL WARNING: One additional missed deadline will trigger workspace suspension.';
  } else if (thresholdLevel >= 5) {
    title = 'WORKSPACE SUSPENDED (5 strikes reached)';
    message = policy.warning_templates?.suspended || 'Your workspace access is suspended.';
  }

  createNotification({
    userId,
    type: 'overdue_warning',
    title,
    message,
    relatedTaskId: null
  }, db);

  // Check Discord Link
  const link = db.prepare('SELECT discord_user_id FROM discord_account_links WHERE user_id = ?').get(userId) as
    | { discord_user_id: string }
    | undefined;

  let discordStatus = 'skipped';
  if (link && policy.discord_dm_enabled) {
    try {
      enqueueDiscordEvent(
        'threshold_warning',
        {
          userId,
          recipientDiscordId: link.discord_user_id,
          thresholdLevel,
          strikeId,
          activeStrikes: thresholdLevel,
          maxThreshold: policy.strike_threshold,
          remainingStrikes: Math.max(0, policy.strike_threshold - thresholdLevel),
          title,
          message
        },
        'dm',
        null,
        workspaceId,
        db
      );
      discordStatus = 'queued';
    } catch {
      discordStatus = 'failed';
    }
  }

  // If 4 strikes, trigger manager escalation if enabled
  if (thresholdLevel === 4 && policy.manager_escalation_enabled) {
    try {
      enqueueDiscordEvent(
        'threshold_warning',
        {
          userId,
          escalation: true,
          thresholdLevel: 4,
          title: `⚠️ MANAGER ESCALATION: Member Reached 4 Strikes`,
          message: `Member ${userId} has received a 4th strike. One more strike will trigger automatic workspace suspension.`
        },
        'escalation',
        null,
        workspaceId,
        db
      );
    } catch {}
  }

  db.prepare(`
    INSERT INTO strike_threshold_notifications (
      id, workspace_id, user_id, threshold_level, strike_id, channel, status, error, notified_at
    ) VALUES (?, ?, ?, ?, ?, 'in_app_and_discord', ?, null, ?)
  `).run(notifId, workspaceId, userId, thresholdLevel, strikeId, discordStatus, now);
}

/**
 * Automatically suspend member from private workspace
 */
export function suspendMember(
  workspaceId: string,
  userId: string,
  reason: string,
  db = getDb()
): WorkspaceSuspension {
  const now = new Date().toISOString();
  const activeStrikes = calculateActiveStrikes(workspaceId, userId, db);

  // 1. Update workspace membership
  db.prepare(`
    UPDATE workspace_members
    SET is_suspended = 1,
        suspended_at = ?,
        suspension_reason = ?
    WHERE workspace_id = ? AND user_id = ?
  `).run(now, reason, workspaceId, userId);

  // 2. Invalidate active user sessions
  db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);

  // 3. Mark user's incomplete tasks for reassignment (do not delete them!)
  db.prepare(`
    UPDATE tasks
    SET reassignment_required = 1,
        reassignment_reason = ?
    WHERE workspace_id = ? AND owner_id = ? AND status != 'Verified Complete'
  `).run(`Member suspended: ${reason}`, workspaceId, userId);

  // 4. Create suspension audit record
  const suspensionId = `ws_susp_${Date.now()}_${uuidv4().slice(0, 6)}`;
  db.prepare(`
    INSERT INTO workspace_suspensions (
      id, workspace_id, user_id, strike_count_at_suspension, status, reason, suspended_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(suspensionId, workspaceId, userId, activeStrikes, reason, now);

  // 5. Activity log
  recordActivity({
    actorId: userId,
    action: 'member_suspended',
    previousValue: 'active',
    newValue: 'suspended',
    source: 'application',
    metadata: {
      workspaceId,
      reason,
      activeStrikes,
      suspensionId
    }
  }, db);

  // 6. In-App notification
  createNotification({
    userId,
    type: 'overdue_warning',
    title: 'WORKSPACE SUSPENDED — Access Terminated',
    message: reason,
    relatedTaskId: null
  }, db);

  // 7. Discord notifications
  const link = db.prepare('SELECT discord_user_id FROM discord_account_links WHERE user_id = ?').get(userId) as
    | { discord_user_id: string }
    | undefined;

  if (link) {
    enqueueDiscordEvent(
      'member_suspended',
      {
        userId,
        recipientDiscordId: link.discord_user_id,
        activeStrikes,
        reason,
        instructions: 'Your workspace access is suspended. Contact Workspace Owner/Admin to request a review.'
      },
      'dm',
      null,
      workspaceId,
      db
    );
  }

  // Notify admins in escalation channel
  enqueueDiscordEvent(
    'member_suspended',
    {
      userId,
      activeStrikes,
      reason,
      announcement: `Member ${userId} reached ${activeStrikes} strikes and was automatically suspended from the workspace.`
    },
    'escalation',
    null,
    workspaceId,
    db
  );

  return {
    id: suspensionId,
    workspace_id: workspaceId,
    user_id: userId,
    strike_count_at_suspension: activeStrikes,
    status: 'active',
    reason,
    suspended_at: now
  };
}

/**
 * Re-evaluate overdue deadlines across all tasks in a workspace and issue qualifying strikes
 */
export function evaluateOverdueDeadlines(
  workspaceId = 'ws_cindermarch',
  db = getDb(),
  referenceTime = new Date()
): Strike[] {
  const policy = getStrikePolicy(workspaceId, db);
  const nowMs = referenceTime.getTime();
  const gracePeriodMs = policy.grace_period_hours * 60 * 60 * 1000;

  // Query candidate tasks:
  // - Has deadline or extended_deadline
  // - Has owner_id (assignee identified)
  // - Status is NOT 'Verified Complete'
  // - Not deadline exempt
  const query = `
    SELECT 
      t.id, t.title, t.priority, t.status, t.owner_id, t.workspace_id,
      t.deadline, t.extended_deadline, t.is_deadline_exempt
    FROM tasks t
    WHERE (t.workspace_id = ? OR t.workspace_id IS NULL)
      AND t.owner_id IS NOT NULL
      AND t.status != 'Verified Complete'
      AND (t.is_deadline_exempt IS NULL OR t.is_deadline_exempt = 0)
      AND (t.deadline IS NOT NULL OR t.extended_deadline IS NOT NULL)
  `;

  const tasks = db.prepare(query).all(workspaceId) as any[];
  const newlyIssued: Strike[] = [];

  for (const t of tasks) {
    const effectiveDeadline = t.extended_deadline || t.deadline;
    if (!effectiveDeadline) continue;

    let deadlineDate: Date;
    try {
      deadlineDate = parseDeadline(effectiveDeadline, policy.timezone);
    } catch {
      continue;
    }

    const graceExpiresAtMs = deadlineDate.getTime() + gracePeriodMs;
    // If current time is strictly BEFORE deadline + grace period has expired, NO strike
    if (nowMs < graceExpiresAtMs) {
      continue;
    }

    // Check idempotency: Has a strike already been issued for this task + deadline?
    const idempotencyKey = `${workspaceId}:${t.id}:${effectiveDeadline}`;
    const existing = db.prepare('SELECT id FROM strikes WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      // Exactly one strike for a qualifying missed deadline (not once per day)
      continue;
    }

    // Issue strike
    const strikeId = `strk_${Date.now()}_${uuidv4().slice(0, 6)}`;
    const nowIso = referenceTime.toISOString();
    const reason = `Missed deadline for task ${t.id} (${t.title}). Applicable deadline: ${effectiveDeadline}. Grace period (${policy.grace_period_hours}h) expired.`;

    const snapshot = JSON.stringify({
      threshold: policy.strike_threshold,
      grace_period_hours: policy.grace_period_hours,
      timezone: policy.timezone
    });

    const evidence = JSON.stringify({
      taskId: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      originalDeadline: t.deadline,
      extendedDeadline: t.extended_deadline
    });

    try {
      db.prepare(`
        INSERT INTO strikes (
          id, workspace_id, user_id, task_id, applicable_deadline,
          detected_at, reason, status, evidence_references, notification_history_json,
          policy_snapshot_json, idempotency_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, '[]', ?, ?, ?, ?)
      `).run(
        strikeId,
        workspaceId,
        t.owner_id,
        t.id,
        effectiveDeadline,
        nowIso,
        reason,
        evidence,
        snapshot,
        idempotencyKey,
        nowIso,
        nowIso
      );

      const createdStrike: Strike = {
        id: strikeId,
        workspace_id: workspaceId,
        user_id: t.owner_id,
        task_id: t.id,
        applicable_deadline: effectiveDeadline,
        detected_at: nowIso,
        reason,
        status: 'active',
        evidence_references: evidence,
        notification_history_json: '[]',
        policy_snapshot_json: snapshot,
        idempotency_key: idempotencyKey,
        created_at: nowIso,
        updated_at: nowIso
      };

      newlyIssued.push(createdStrike);

      // Record activity
      recordActivity({
        actorId: t.owner_id,
        action: 'strike_issued',
        relatedTaskId: t.id,
        newValue: `Strike issued for task ${t.id} (${effectiveDeadline})`,
        source: 'application',
        metadata: {
          strikeId,
          workspaceId,
          effectiveDeadline
        }
      }, db);

      // Compute updated active strikes
      const currentActive = calculateActiveStrikes(workspaceId, t.owner_id, db);

      // Send threshold notifications (1..4)
      sendThresholdNotification(workspaceId, t.owner_id, currentActive, strikeId, policy, db);

      // Automatic suspension check: 5 qualifying strikes
      if (currentActive >= policy.strike_threshold) {
        suspendMember(
          workspaceId,
          t.owner_id,
          `Automatic suspension: reached ${currentActive} active strikes (threshold: ${policy.strike_threshold}) under Cindermarch deadline policy.`,
          db
        );
      }
    } catch (err: any) {
      // Ignore if concurrent worker inserted
      console.warn(`[Strikes] Could not insert strike for ${idempotencyKey}:`, err.message);
    }
  }

  return newlyIssued;
}

/**
 * Record workspace entry and handle in-app & Discord warnings
 */
export function recordWorkspaceEntry(
  workspaceId: string,
  userId: string,
  sessionId: string,
  db = getDb(),
  clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
): {
  activeStrikes: number;
  maxThreshold: number;
  remainingStrikes: number;
  warningLevel: WarningLevel;
  isSuspended: boolean;
  showWarning: boolean;
  strikes: any[];
  discordDmStatus: 'delivered' | 'failed' | 'skipped' | 'not_linked';
  discordError?: string | null;
  message: string;
} {
  const policy = getStrikePolicy(workspaceId, db);
  const now = new Date().toISOString();

  // Authoritative strike count directly from backend
  const activeStrikes = calculateActiveStrikes(workspaceId, userId, db);
  const warningLevel = getWarningLevel(activeStrikes, policy.strike_threshold);
  const remainingStrikes = Math.max(0, policy.strike_threshold - activeStrikes);

  // Check suspension status from workspace_members
  const memberRow = db.prepare(`
    SELECT is_suspended, suspension_reason, suspended_at
    FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, userId) as { is_suspended: number; suspension_reason: string; suspended_at: string } | undefined;

  const isSuspended = (memberRow?.is_suspended === 1) || (activeStrikes >= policy.strike_threshold);

  // Fetch active strikes with task info
  const strikes = db.prepare(`
    SELECT 
      s.*,
      t.title as task_title,
      t.priority as task_priority,
      t.status as task_status
    FROM strikes s
    LEFT JOIN tasks t ON s.task_id = t.id
    WHERE s.workspace_id = ? AND s.user_id = ? AND s.status = 'active'
    ORDER BY s.detected_at DESC
  `).all(workspaceId, userId);

  // If no strikes and not suspended, no warning needed
  if (activeStrikes === 0 && !isSuspended) {
    return {
      activeStrikes: 0,
      maxThreshold: policy.strike_threshold,
      remainingStrikes: policy.strike_threshold,
      warningLevel: 'none',
      isSuspended: false,
      showWarning: false,
      strikes: [],
      discordDmStatus: 'skipped',
      message: 'No active strikes.'
    };
  }

  // Check if this session was already recorded in this workspace
  const existingEvent = db.prepare(`
    SELECT * FROM workspace_entry_events
    WHERE workspace_id = ? AND user_id = ? AND session_id = ?
  `).get(workspaceId, userId, sessionId) as WorkspaceEntryEvent | undefined;

  if (existingEvent) {
    // Return existing warning data without duplicate Discord DM
    return {
      activeStrikes,
      maxThreshold: policy.strike_threshold,
      remainingStrikes,
      warningLevel,
      isSuspended,
      showWarning: true,
      strikes,
      discordDmStatus: existingEvent.discord_dm_status,
      discordError: existingEvent.discord_error,
      message: 'Workspace entry already recorded for this session.'
    };
  }

  // Genuine new workspace-entry session!
  // Check Discord Link
  const link = db.prepare('SELECT discord_user_id, discord_username FROM discord_account_links WHERE user_id = ?').get(userId) as
    | { discord_user_id: string; discord_username: string }
    | undefined;

  let discordDmStatus: 'delivered' | 'failed' | 'skipped' | 'not_linked' = 'not_linked';
  let discordError: string | null = null;

  if (link && policy.discord_dm_enabled) {
    // Attempt private Discord DM
    const taskRefs = strikes.map((s: any) => `• [${s.task_id}] ${s.task_title || 'Task'} (Missed: ${s.applicable_deadline})`).join('\n');
    const dmText =
      `**CINDEMARCH DEADLINE WARNING**\n` +
      `You currently have **${activeStrikes} of ${policy.strike_threshold}** active strikes.\n` +
      (remainingStrikes > 0 ? `Strikes remaining before workspace suspension: **${remainingStrikes}**.\n` : `**Your workspace access is SUSPENDED.**\n`) +
      `Review your missed deadlines and outstanding tasks in Engine Hub:\n` +
      `${clientOrigin}/tasks\n\n` +
      (taskRefs.length > 0 ? `Recent qualifying missed deadlines:\n${taskRefs}\n\n` : '') +
      `Further qualifying deadline misses may result in workspace suspension.`;

    try {
      enqueueDiscordEvent(
        'workspace_entry_warning',
        {
          userId,
          recipientDiscordId: link.discord_user_id,
          activeStrikes,
          maxThreshold: policy.strike_threshold,
          remainingStrikes,
          warningLevel,
          isSuspended,
          content: dmText,
          dashboardUrl: `${clientOrigin}`
        },
        'dm',
        null,
        workspaceId,
        db
      );
      // In synchronous or mock mode, mark delivered; if offline, enqueued
      discordDmStatus = 'delivered';
    } catch (err: any) {
      discordDmStatus = 'failed';
      discordError = err.message;
    }
  }

  // Record workspace entry event
  const eventId = `wee_${Date.now()}_${uuidv4().slice(0, 6)}`;
  try {
    db.prepare(`
      INSERT INTO workspace_entry_events (
        id, workspace_id, user_id, session_id, active_strike_count,
        warning_level, discord_dm_status, discord_error, entered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      workspaceId,
      userId,
      sessionId,
      activeStrikes,
      warningLevel,
      discordDmStatus,
      discordError,
      now
    );
  } catch (err: any) {
    console.warn(`[WorkspaceEntry] Could not record entry event: ${err.message}`);
  }

  return {
    activeStrikes,
    maxThreshold: policy.strike_threshold,
    remainingStrikes,
    warningLevel,
    isSuspended,
    showWarning: true,
    strikes,
    discordDmStatus,
    discordError,
    message: isSuspended ? 'Workspace suspended.' : 'Workspace entry warning recorded.'
  };
}

/**
 * Reverse an incorrectly issued strike (Admin only, requires reason, recalculates active strikes)
 */
export function reverseStrike(
  strikeId: string,
  adminId: string,
  reversalReason: string,
  db = getDb()
): { strike: Strike; activeStrikes: number } {
  if (!reversalReason || !reversalReason.trim()) {
    throw new Error('A documented reason is required to reverse a strike.');
  }

  const strike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as Strike | undefined;
  if (!strike) {
    throw new Error('Strike not found.');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE strikes
    SET status = 'reversed',
        reversed_by = ?,
        reversed_at = ?,
        reversal_reason = ?,
        updated_at = ?
    WHERE id = ?
  `).run(adminId, now, reversalReason.trim(), now, strikeId);

  // Recompute active strikes
  const activeStrikes = calculateActiveStrikes(strike.workspace_id, strike.user_id, db);

  // Record activity
  recordActivity({
    actorId: adminId,
    action: 'strike_reversed',
    relatedTaskId: strike.task_id,
    previousValue: strike.status,
    newValue: 'reversed',
    source: 'application',
    metadata: {
      strikeId,
      userId: strike.user_id,
      reversalReason: reversalReason.trim(),
      newActiveCount: activeStrikes
    }
  }, db);

  // Enqueue Discord notification
  const link = db.prepare('SELECT discord_user_id FROM discord_account_links WHERE user_id = ?').get(strike.user_id) as
    | { discord_user_id: string }
    | undefined;

  if (link) {
    enqueueDiscordEvent(
      'strike_reversed',
      {
        userId: strike.user_id,
        recipientDiscordId: link.discord_user_id,
        strikeId,
        taskId: strike.task_id,
        reason: reversalReason.trim(),
        currentActiveStrikes: activeStrikes
      },
      'dm',
      strike.task_id,
      strike.workspace_id,
      db
    );
  }

  const updatedStrike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as unknown as Strike;
  return { strike: updatedStrike, activeStrikes };
}

/**
 * Excuse a missed deadline / strike (Admin only, requires reason)
 */
export function excuseStrike(
  strikeId: string,
  adminId: string,
  reason: string,
  db = getDb()
): { strike: Strike; activeStrikes: number } {
  if (!reason || !reason.trim()) {
    throw new Error('A documented reason is required to excuse a strike.');
  }

  const strike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as Strike | undefined;
  if (!strike) {
    throw new Error('Strike not found.');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE strikes
    SET status = 'excused',
        reviewed_by = ?,
        reviewed_at = ?,
        appeal_outcome = ?,
        updated_at = ?
    WHERE id = ?
  `).run(adminId, now, reason.trim(), now, strikeId);

  const activeStrikes = calculateActiveStrikes(strike.workspace_id, strike.user_id, db);

  recordActivity({
    actorId: adminId,
    action: 'strike_excused',
    relatedTaskId: strike.task_id,
    previousValue: strike.status,
    newValue: 'excused',
    source: 'application',
    metadata: { strikeId, reason: reason.trim(), newActiveCount: activeStrikes }
  }, db);

  const updatedStrike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as unknown as Strike;
  return { strike: updatedStrike, activeStrikes };
}

/**
 * Submit dispute for an active strike (Member)
 */
export function submitStrikeDispute(
  strikeId: string,
  userId: string,
  appealReason: string,
  db = getDb()
): Strike {
  if (!appealReason || !appealReason.trim()) {
    throw new Error('Please provide a reason for disputing this strike.');
  }

  const strike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as Strike | undefined;
  if (!strike) {
    throw new Error('Strike not found.');
  }
  if (strike.user_id !== userId) {
    throw new Error('You may only dispute your own strikes.');
  }
  if (strike.status !== 'active') {
    throw new Error(`Cannot dispute strike with status '${strike.status}'.`);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE strikes
    SET status = 'disputed',
        appeal_reason = ?,
        appealed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(appealReason.trim(), now, now, strikeId);

  recordActivity({
    actorId: userId,
    action: 'strike_disputed',
    relatedTaskId: strike.task_id,
    newValue: appealReason.trim(),
    source: 'application',
    metadata: { strikeId }
  }, db);

  return db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as unknown as Strike;
}

/**
 * Review strike dispute (Admin only)
 */
export function reviewStrikeDispute(
  strikeId: string,
  adminId: string,
  action: 'approve' | 'reject',
  notes: string,
  db = getDb()
): { strike: Strike; activeStrikes: number } {
  const strike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as Strike | undefined;
  if (!strike) {
    throw new Error('Strike not found.');
  }
  if (strike.status !== 'disputed') {
    throw new Error('Strike is not in disputed status.');
  }

  const now = new Date().toISOString();
  const nextStatus: StrikeStatus = action === 'approve' ? 'reversed' : 'active';

  db.prepare(`
    UPDATE strikes
    SET status = ?,
        reviewed_by = ?,
        reviewed_at = ?,
        appeal_outcome = ?,
        reversed_by = CASE WHEN ? = 'approve' THEN ? ELSE reversed_by END,
        reversed_at = CASE WHEN ? = 'approve' THEN ? ELSE reversed_at END,
        reversal_reason = CASE WHEN ? = 'approve' THEN ? ELSE reversal_reason END,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextStatus,
    adminId,
    now,
    notes,
    action,
    adminId,
    action,
    now,
    action,
    notes,
    now,
    strikeId
  );

  const activeStrikes = calculateActiveStrikes(strike.workspace_id, strike.user_id, db);

  recordActivity({
    actorId: adminId,
    action: `strike_dispute_${action}`,
    relatedTaskId: strike.task_id,
    newValue: action,
    source: 'application',
    metadata: { strikeId, notes, activeStrikes }
  }, db);

  const updatedStrike = db.prepare('SELECT * FROM strikes WHERE id = ?').get(strikeId) as unknown as Strike;
  return { strike: updatedStrike, activeStrikes };
}

/**
 * Reinstate a suspended member (Admin only, requires reason)
 */
export function reinstateMember(
  workspaceId: string,
  userId: string,
  adminId: string,
  reason: string,
  db = getDb()
): { success: boolean; activeStrikes: number; message: string } {
  if (!reason || !reason.trim()) {
    throw new Error('A documented reason is required to reinstate a suspended member.');
  }

  const now = new Date().toISOString();

  // Update workspace_members
  db.prepare(`
    UPDATE workspace_members
    SET is_suspended = 0,
        reinstated_at = ?,
        reinstated_by = ?,
        reinstatement_reason = ?
    WHERE workspace_id = ? AND user_id = ?
  `).run(now, adminId, reason.trim(), workspaceId, userId);

  // Update workspace_suspensions
  db.prepare(`
    UPDATE workspace_suspensions
    SET status = 'reinstated',
        reinstated_at = ?,
        reinstated_by = ?,
        reinstatement_reason = ?
    WHERE workspace_id = ? AND user_id = ? AND status = 'active'
  `).run(now, adminId, reason.trim(), workspaceId, userId);

  const activeStrikes = calculateActiveStrikes(workspaceId, userId, db);

  recordActivity({
    actorId: adminId,
    action: 'member_reinstated',
    previousValue: 'suspended',
    newValue: 'active',
    source: 'application',
    metadata: {
      workspaceId,
      userId,
      reason: reason.trim(),
      activeStrikes
    }
  }, db);

  // In-app notification
  createNotification({
    userId,
    type: 'overdue_warning',
    title: 'Workspace Membership Reinstated',
    message: `Your Cindermarch workspace access has been reinstated. Reason: ${reason.trim()}`,
    relatedTaskId: null
  }, db);

  // Discord DM notification
  const link = db.prepare('SELECT discord_user_id FROM discord_account_links WHERE user_id = ?').get(userId) as
    | { discord_user_id: string }
    | undefined;

  if (link) {
    enqueueDiscordEvent(
      'member_reinstated',
      {
        userId,
        recipientDiscordId: link.discord_user_id,
        reason: reason.trim(),
        message: 'Your Cindermarch workspace membership has been reinstated.'
      },
      'dm',
      null,
      workspaceId,
      db
    );
  }

  return {
    success: true,
    activeStrikes,
    message: 'Member workspace access reinstated successfully.'
  };
}

/**
 * Approve a deadline extension for a task (Admin only, requires reason)
 */
export function extendTaskDeadline(
  taskId: string,
  adminId: string,
  newDeadline: string,
  reason: string,
  db = getDb()
): any {
  if (!newDeadline) throw new Error('New deadline date is required.');
  if (!reason || !reason.trim()) throw new Error('A documented reason is required to approve a deadline extension.');

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) throw new Error('Task not found.');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks
    SET extended_deadline = ?,
        deadline_extension_reason = ?,
        deadline_extension_approved_by = ?,
        updated_at = ?
    WHERE id = ?
  `).run(newDeadline, reason.trim(), adminId, now, taskId);

  recordActivity({
    actorId: adminId,
    action: 'deadline_extended',
    relatedTaskId: taskId,
    previousValue: task.extended_deadline || task.deadline,
    newValue: newDeadline,
    source: 'application',
    metadata: { reason: reason.trim() }
  }, db);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

/**
 * Exempt a task from deadline accountability policy (Admin only, requires reason)
 */
export function exemptTaskDeadline(
  taskId: string,
  adminId: string,
  reason: string,
  db = getDb()
): any {
  if (!reason || !reason.trim()) throw new Error('A documented reason is required to exempt a task deadline.');

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) throw new Error('Task not found.');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks
    SET is_deadline_exempt = 1,
        deadline_exemption_reason = ?,
        deadline_exempt_approved_by = ?,
        updated_at = ?
    WHERE id = ?
  `).run(reason.trim(), adminId, now, taskId);

  recordActivity({
    actorId: adminId,
    action: 'deadline_exempted',
    relatedTaskId: taskId,
    newValue: reason.trim(),
    source: 'application',
    metadata: { reason: reason.trim() }
  }, db);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}
