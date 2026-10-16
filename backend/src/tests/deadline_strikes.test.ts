import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../app.js';
import { setDbForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrations.js';
import { createSession } from '../middleware/auth.js';
import {
  evaluateOverdueDeadlines,
  calculateActiveStrikes,
  recordWorkspaceEntry,
  reverseStrike,
  excuseStrike,
  submitStrikeDispute,
  reviewStrikeDispute,
  suspendMember,
  reinstateMember,
  extendTaskDeadline,
  exemptTaskDeadline,
  getStrikePolicy,
  updateStrikePolicy
} from '../services/strikeService.js';
import { createTask } from '../services/taskService.js';

describe('Deadline Strikes, Workspace-Entry Warnings & Automatic Suspension', () => {
  let testDb: DatabaseSync;

  beforeEach(() => {
    testDb = new DatabaseSync(':memory:');
    runMigrations(testDb);
    setDbForTesting(testDb);

    const now = new Date().toISOString();

    // 1. Seed users
    testDb.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, workspace_id, created_at, updated_at)
      VALUES 
        ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.com', 'hash', '["owner","admin","developer"]', 'ws_cindermarch', ?, ?),
        ('usr_yehia', 'yehia', 'Yehia', 'yehia@cindermarch.com', 'hash', '["developer"]', 'ws_cindermarch', ?, ?),
        ('usr_joe', 'joe', 'Joe', 'joe@cindermarch.com', 'hash', '["developer"]', 'ws_cindermarch', ?, ?)
    `).run(now, now, now, now, now, now);

    // 2. Seed workspace & members
    testDb.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', 'usr_lead', ?, ?)
    `).run(now, now);

    testDb.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES 
        ('wm_lead', 'ws_cindermarch', 'usr_lead', 'owner', ?),
        ('wm_yehia', 'ws_cindermarch', 'usr_yehia', 'developer', ?),
        ('wm_joe', 'ws_cindermarch', 'usr_joe', 'developer', ?)
    `).run(now, now, now);

    // 3. Seed project
    testDb.prepare(`
      INSERT INTO projects (id, workspace_id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'ws_cindermarch', 'Terminal 6', 'Core Engine & Train Simulation', 'Terminal6-Main@cindermarch', ?)
    `).run(now);

    // 4. Seed Discord link for Yehia (verified)
    testDb.prepare(`
      INSERT INTO discord_account_links (id, user_id, discord_user_id, discord_username, verified_at, created_at, updated_at)
      VALUES ('dal_yehia', 'usr_yehia', '123456789012345678', 'YehiaDiscord', ?, ?, ?)
    `).run(now, now, now);
  });

  describe('1. Deadline Evaluation & Qualifying Strikes', () => {
    it('does NOT issue a strike before deadline and 24-hour grace period have expired', () => {
      // Create task with deadline tomorrow
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const task = createTask({
        title: 'Train Brake Calipers',
        description: 'Implement physics model',
        priority: 'P1',
        deadline: tomorrow,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(0);

      const strikes = calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb);
      expect(strikes).toBe(0);
    });

    it('does NOT issue a strike if deadline passed but within 24-hour grace period', () => {
      // Deadline was 12 hours ago (within 24h grace)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Cab Lighting Shader',
        description: 'Volumetric light cone',
        priority: 'P1',
        deadline: twelveHoursAgo,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(0);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb)).toBe(0);
    });

    it('issues EXACTLY ONE strike when deadline AND grace period (24h) have expired', () => {
      // Deadline was 3 days ago (grace period expired 2 days ago)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Overdue Coupler Mechanics',
        description: 'Joint constraints',
        priority: 'P0',
        deadline: threeDaysAgo,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(1);
      expect(issued[0].task_id).toBe(task.id);
      expect(issued[0].user_id).toBe('usr_yehia');
      expect(issued[0].status).toBe('active');

      expect(calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb)).toBe(1);

      // Verify idempotency: repeated evaluations do NOT issue duplicate strikes
      const repeated = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(repeated.length).toBe(0);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb)).toBe(1);
    });

    it('does NOT issue strikes for properly exempted deadlines', () => {
      const pastDeadline = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Exempt Audio Pipeline',
        description: 'Waiting on external voice actor stems',
        priority: 'P2',
        deadline: pastDeadline,
        ownerId: 'usr_joe'
      }, 'usr_lead', testDb);

      // Exempt the task deadline with a documented reason
      exemptTaskDeadline(task.id, 'usr_lead', 'External vendor audio asset delivery delay authorized by Studio Lead', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(0);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_joe', testDb)).toBe(0);
    });

    it('respects approved deadline extensions and does not issue strike before new deadline + grace expires', () => {
      const oldDeadline = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Signal Switch Box Refactor',
        description: 'Refactor switch state machine',
        priority: 'P1',
        deadline: oldDeadline,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);

      // Approve deadline extension to next week
      const extendedDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      extendTaskDeadline(task.id, 'usr_lead', extendedDeadline, 'Scope enlarged to include interlocking signals', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(0);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb)).toBe(0);
    });
  });

  describe('2. Strike Reversal, Dispute & Recomputation', () => {
    it('reverses an incorrectly issued strike and recalculates active count while preserving audit trail', () => {
      const pastDeadline = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Locomotive Bogie Physics',
        description: 'Suspension spring dampening',
        priority: 'P1',
        deadline: pastDeadline,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(1);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb)).toBe(1);

      // Admin reverses strike with reason
      const reversalReason = 'Developer completed work before deadline but UVCS sync was stalled by IT network outage';
      const result = reverseStrike(issued[0].id, 'usr_lead', reversalReason, testDb);

      expect(result.strike.status).toBe('reversed');
      expect(result.strike.reversed_by).toBe('usr_lead');
      expect(result.strike.reversal_reason).toBe(reversalReason);
      expect(result.activeStrikes).toBe(0);

      // Active count is recomputed to 0
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_yehia', testDb)).toBe(0);

      // Reversed strike is preserved in historical records
      const row = testDb.prepare('SELECT * FROM strikes WHERE id = ?').get(issued[0].id) as any;
      expect(row).toBeDefined();
      expect(row.status).toBe('reversed');
    });

    it('allows a member to dispute a strike and admin to review and approve or reject', () => {
      const pastDeadline = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Fog Volume Shader',
        description: 'Volumetric fog in tunnel section',
        priority: 'P1',
        deadline: pastDeadline,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      const strikeId = issued[0].id;

      // Developer disputes the strike
      const disputed = submitStrikeDispute(strikeId, 'usr_yehia', 'Work was delivered on time via test branch', testDb);
      expect(disputed.status).toBe('disputed');
      expect(disputed.appeal_reason).toContain('Work was delivered');

      // Admin reviews and rejects
      const rejected = reviewStrikeDispute(strikeId, 'usr_lead', 'reject', 'Branch did not pass tests', testDb);
      expect(rejected.strike.status).toBe('active');
      expect(rejected.activeStrikes).toBe(1);

      // Developer disputes again and admin approves
      submitStrikeDispute(strikeId, 'usr_yehia', 'Additional proof attached from Plastic SCM logs', testDb);
      const approved = reviewStrikeDispute(strikeId, 'usr_lead', 'approve', 'Verified changeset timestampcs:1055', testDb);
      expect(approved.strike.status).toBe('reversed');
      expect(approved.activeStrikes).toBe(0);
    });
  });

  describe('3. Workspace-Entry Warning Behavior', () => {
    it('shows no warning for member with zero active strikes', () => {
      const result = recordWorkspaceEntry('ws_cindermarch', 'usr_joe', 'session_zero_strikes', testDb);
      expect(result.showWarning).toBe(false);
      expect(result.activeStrikes).toBe(0);
      expect(result.warningLevel).toBe('none');
    });

    it('shows prominent personalized warning for member with active strikes and records workspace entry event', () => {
      // Issue a strike to Yehia
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const task = createTask({
        title: 'Cab Gauge Needle Smoothing',
        description: 'Smooth needle interpolation',
        priority: 'P1',
        deadline: past,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);
      evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());

      const sessionId = 'session_entry_101';
      const entry = recordWorkspaceEntry('ws_cindermarch', 'usr_yehia', sessionId, testDb);

      expect(entry.showWarning).toBe(true);
      expect(entry.activeStrikes).toBe(1);
      expect(entry.maxThreshold).toBe(5);
      expect(entry.remainingStrikes).toBe(4);
      expect(entry.warningLevel).toBe('first_warning');
      expect(entry.strikes.length).toBe(1);
      expect(entry.discordDmStatus).toBe('delivered'); // Yehia has linked discord account

      // Check DB record
      const eventRow = testDb.prepare('SELECT * FROM workspace_entry_events WHERE session_id = ?').get(sessionId) as any;
      expect(eventRow).toBeDefined();
      expect(eventRow.user_id).toBe('usr_yehia');
      expect(eventRow.active_strike_count).toBe(1);
      expect(eventRow.discord_dm_status).toBe('delivered');
    });

    it('deduplicates warnings within the SAME session (no repeated Discord DMs on re-renders)', () => {
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      createTask({
        title: 'Track Ballast LODs',
        description: 'Generate LOD mesh variations',
        priority: 'P2',
        deadline: past,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);
      evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());

      const sessionId = 'session_persistent_tab';

      // First entry
      const entry1 = recordWorkspaceEntry('ws_cindermarch', 'usr_yehia', sessionId, testDb);
      expect(entry1.showWarning).toBe(true);

      // Clear outbox to observe new events
      testDb.prepare("DELETE FROM discord_event_outbox WHERE event_type = 'workspace_entry_warning'").run();

      // Second entry within same session (e.g. Navigation or React component re-render)
      const entry2 = recordWorkspaceEntry('ws_cindermarch', 'usr_yehia', sessionId, testDb);
      expect(entry2.showWarning).toBe(true);
      expect(entry2.message).toContain('already recorded');

      // No new outbox event was generated!
      const outboxCount = testDb.prepare("SELECT COUNT(*) as c FROM discord_event_outbox WHERE event_type = 'workspace_entry_warning'").get() as any;
      expect(outboxCount.c).toBe(0);
    });

    it('shows warning again on a GENUINE NEW workspace session', () => {
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      createTask({
        title: 'Speedometer Gauge Asset',
        description: 'Import texture atlas',
        priority: 'P1',
        deadline: past,
        ownerId: 'usr_yehia'
      }, 'usr_lead', testDb);
      evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());

      // Session 1
      const entry1 = recordWorkspaceEntry('ws_cindermarch', 'usr_yehia', 'session_tab_1', testDb);
      expect(entry1.showWarning).toBe(true);

      // Session 2 (New browser window / tab / day)
      const entry2 = recordWorkspaceEntry('ws_cindermarch', 'usr_yehia', 'session_tab_2', testDb);
      expect(entry2.showWarning).toBe(true);
      expect(entry2.message).toBe('Workspace entry warning recorded.');

      const eventsCount = testDb.prepare("SELECT COUNT(*) as c FROM workspace_entry_events WHERE user_id = 'usr_yehia'").get() as any;
      expect(eventsCount.c).toBe(2);
    });

    it('handles unlinked Discord accounts gracefully without blocking in-app warnings', () => {
      // Joe has NO discord link
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      createTask({
        title: 'Emergency Brake Lever',
        description: 'Sound triggers on pull',
        priority: 'P1',
        deadline: past,
        ownerId: 'usr_joe'
      }, 'usr_lead', testDb);
      evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());

      const entry = recordWorkspaceEntry('ws_cindermarch', 'usr_joe', 'session_joe_unlinked', testDb);
      expect(entry.showWarning).toBe(true);
      expect(entry.activeStrikes).toBe(1);
      expect(entry.discordDmStatus).toBe('not_linked'); // Graceful fallback
    });
  });

  describe('4. Automatic Suspension at Five Strikes & Authorization Policy', () => {
    it('automatically suspends member upon reaching five active qualifying strikes', () => {
      // Create 5 overdue tasks for Joe
      for (let i = 1; i <= 5; i++) {
        const past = new Date(Date.now() - (3 + i) * 24 * 60 * 60 * 1000).toISOString();
        createTask({
          title: `Overdue Task ${i}`,
          description: `Description ${i}`,
          priority: 'P1',
          deadline: past,
          ownerId: 'usr_joe'
        }, 'usr_lead', testDb);
      }

      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(5);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_joe', testDb)).toBe(5);

      // Verify workspace_members suspension status
      const member = testDb.prepare("SELECT * FROM workspace_members WHERE workspace_id = 'ws_cindermarch' AND user_id = 'usr_joe'").get() as any;
      expect(member.is_suspended).toBe(1);
      expect(member.suspended_at).toBeDefined();
      expect(member.suspension_reason).toContain('Automatic suspension');

      // Verify incomplete tasks are marked for reassignment (not deleted!)
      const tasks = testDb.prepare("SELECT * FROM tasks WHERE owner_id = 'usr_joe'").all() as any[];
      expect(tasks.length).toBe(5);
      for (const t of tasks) {
        expect(t.reassignment_required).toBe(1);
      }

      // Verify suspension audit record in workspace_suspensions
      const suspension = testDb.prepare("SELECT * FROM workspace_suspensions WHERE user_id = 'usr_joe' AND status = 'active'").get() as any;
      expect(suspension).toBeDefined();
      expect(suspension.strike_count_at_suspension).toBe(5);
    });

    it('enforces backend access denial for suspended accounts on protected workspace routes', async () => {
      // Suspend Joe
      suspendMember('ws_cindermarch', 'usr_joe', 'Policy suspension test', testDb);

      // Create session for Joe
      const { sessionToken } = createSession('usr_joe');

      // 1. Attempt to fetch tasks (Protected workspace route) -> HTTP 403 Forbidden with suspension details
      const taskRes = await request(app)
        .get('/api/tasks')
        .set('Cookie', `cm_session=${sessionToken}`);

      expect(taskRes.status).toBe(403);
      expect(taskRes.body.isSuspended).toBe(true);
      expect(taskRes.body.error).toContain('Workspace membership suspended');

      // 2. Attempt to create a task -> HTTP 403 Forbidden
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-session-token', sessionToken)
        .send({
          title: 'Unauthorized Task Creation',
          description: 'Should be rejected'
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.isSuspended).toBe(true);

      // 3. User can still view their strike status and appeal endpoint
      const statusRes = await request(app)
        .get('/api/strikes/my-status')
        .set('Cookie', `cm_session=${sessionToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.isSuspended).toBe(true);
    });

    it('allows authorized administrator to reinstate a suspended member with a documented reason', () => {
      suspendMember('ws_cindermarch', 'usr_joe', 'Disciplinary suspension', testDb);
      expect(testDb.prepare("SELECT is_suspended FROM workspace_members WHERE user_id = 'usr_joe'").get() as any).toMatchObject({ is_suspended: 1 });

      // Admin reinstates Joe
      const result = reinstateMember('ws_cindermarch', 'usr_joe', 'usr_lead', 'Appeal accepted after medical leave documentation submitted', testDb);
      expect(result.success).toBe(true);

      const member = testDb.prepare("SELECT * FROM workspace_members WHERE user_id = 'usr_joe'").get() as any;
      expect(member.is_suspended).toBe(0);
      expect(member.reinstated_at).toBeDefined();
      expect(member.reinstated_by).toBe('usr_lead');
      expect(member.reinstatement_reason).toContain('Appeal accepted');

      // Audit history in workspace_suspensions updated
      const susp = testDb.prepare("SELECT * FROM workspace_suspensions WHERE user_id = 'usr_joe'").get() as any;
      expect(susp.status).toBe('reinstated');
      expect(susp.reinstated_by).toBe('usr_lead');
    });

    it('requires explicit reinstatement decision when strikes are reversed on a suspended member', () => {
      // Give Joe 5 strikes and suspend him
      for (let i = 1; i <= 5; i++) {
        const past = new Date(Date.now() - (3 + i) * 24 * 60 * 60 * 1000).toISOString();
        createTask({
          title: `Overdue Task ${i}`,
          description: `Desc ${i}`,
          priority: 'P1',
          deadline: past,
          ownerId: 'usr_joe'
        }, 'usr_lead', testDb);
      }
      const issued = evaluateOverdueDeadlines('ws_cindermarch', testDb, new Date());
      expect(issued.length).toBe(5);

      // Joe is suspended
      expect((testDb.prepare("SELECT is_suspended FROM workspace_members WHERE user_id = 'usr_joe'").get() as any).is_suspended).toBe(1);

      // Admin reverses one strike
      reverseStrike(issued[0].id, 'usr_lead', 'Reversing one false strike', testDb);
      expect(calculateActiveStrikes('ws_cindermarch', 'usr_joe', testDb)).toBe(4);

      // Membership is NOT silently restored without an authorized reinstatement decision!
      const member = testDb.prepare("SELECT is_suspended FROM workspace_members WHERE user_id = 'usr_joe'").get() as any;
      expect(member.is_suspended).toBe(1);

      // Now explicit authorized reinstatement
      reinstateMember('ws_cindermarch', 'usr_joe', 'usr_lead', 'Active strikes fell below threshold to 4 strikes', testDb);
      expect((testDb.prepare("SELECT is_suspended FROM workspace_members WHERE user_id = 'usr_joe'").get() as any).is_suspended).toBe(0);
    });
  });

  describe('5. Policy Configuration & Observability', () => {
    it('allows Workspace Owner/Admin to configure threshold, grace period, and timezone', () => {
      const initialPolicy = getStrikePolicy('ws_cindermarch', testDb);
      expect(initialPolicy.strike_threshold).toBe(5);
      expect(initialPolicy.grace_period_hours).toBe(24);
      expect(initialPolicy.timezone).toBe('Africa/Cairo');

      const updated = updateStrikePolicy(
        'ws_cindermarch',
        {
          strike_threshold: 4,
          grace_period_hours: 48,
          manager_escalation_enabled: true
        },
        'usr_lead',
        testDb
      );

      expect(updated.strike_threshold).toBe(4);
      expect(updated.grace_period_hours).toBe(48);

      const fetched = getStrikePolicy('ws_cindermarch', testDb);
      expect(fetched.strike_threshold).toBe(4);
      expect(fetched.grace_period_hours).toBe(48);
    });

    it('records audit events for all policy changes, strikes, reversals, suspensions, and reinstatements', () => {
      const initialEvents = testDb.prepare("SELECT COUNT(*) as c FROM activity_events").get() as any;

      // Update policy
      updateStrikePolicy('ws_cindermarch', { strike_threshold: 6 }, 'usr_lead', testDb);

      const afterPolicy = testDb.prepare("SELECT COUNT(*) as c FROM activity_events WHERE action = 'strike_policy_updated'").get() as any;
      expect(afterPolicy.c).toBeGreaterThanOrEqual(1);
    });
  });
});
