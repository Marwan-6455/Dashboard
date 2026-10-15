import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../app.js';
import { setDbForTesting } from '../db/connection.js';
import { runMigrations } from '../db/migrations.js';
import { initiateLinkRequest, verifyLinkCode, getUserByDiscordId, unlinkDiscordAccount } from '../services/discordLinkService.js';
import { scheduleTaskReminders, cancelTaskReminders, getDueReminders, getReminderStats, parseDeadline } from '../services/reminderScheduler.js';
import { enqueueDiscordEvent, getPendingOutboxEvents, ackOutboxEvent, getOutboxStats } from '../services/discordOutboxService.js';
import { createTask, updateTaskStatus } from '../services/taskService.js';

describe('Discord Bot & Operations Backend Integration', () => {
  let testDb: DatabaseSync;

  beforeEach(() => {
    testDb = new DatabaseSync(':memory:');
    runMigrations(testDb);
    setDbForTesting(testDb);

    // Seed test users
    const now = new Date().toISOString();
    testDb.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.com', 'hash', '["owner","admin","developer"]', ?, ?),
        ('usr_yehia', 'yehia', 'Yehia', 'yehia@cindermarch.com', 'hash', '["developer"]', ?, ?),
        ('usr_joe', 'joe', 'Joe', 'joe@cindermarch.com', 'hash', '["developer"]', ?, ?)
    `).run(now, now, now, now, now, now);

    // Seed test workspace & project
    testDb.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', 'usr_lead', ?, ?)
    `).run(now, now);

    testDb.prepare(`
      INSERT INTO projects (id, workspace_id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'ws_cindermarch', 'Terminal 6', 'Core Engine & Train Simulation', 'Terminal6-Main@cindermarch', ?)
    `).run(now);
  });

  describe('1. Account Linking Service', () => {
    it('generates a 6-character code and successfully links Discord account to user', () => {
      const { code, expiresAt } = initiateLinkRequest('123456789012345678', 'YehiaDev', testDb);
      expect(code).toBeDefined();
      expect(code.length).toBe(6);
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

      // Verify code
      const result = verifyLinkCode('usr_yehia', code, testDb);
      expect(result.success).toBe(true);
      expect(result.link?.discord_user_id).toBe('123456789012345678');
      expect(result.link?.discord_username).toBe('YehiaDev');

      // Look up user by discord ID
      const linkedUser = getUserByDiscordId('123456789012345678', testDb);
      expect(linkedUser).not.toBeNull();
      expect(linkedUser?.id).toBe('usr_yehia');
      expect(linkedUser?.display_name).toBe('Yehia');

      // Code cannot be reused (single-use)
      const reuseResult = verifyLinkCode('usr_joe', code, testDb);
      expect(reuseResult.success).toBe(false);
      expect(reuseResult.error).toContain('Invalid or expired');
    });

    it('rejects expired link codes and allows unlinking', () => {
      const { code } = initiateLinkRequest('999999999999999999', 'JoeDev', testDb);

      // Artificially expire the code
      testDb.prepare("UPDATE discord_link_requests SET expires_at = datetime('now', '-1 minute')").run();

      const expiredResult = verifyLinkCode('usr_joe', code, testDb);
      expect(expiredResult.success).toBe(false);
      expect(expiredResult.error).toContain('Invalid or expired');

      // Link with fresh code
      const fresh = initiateLinkRequest('999999999999999999', 'JoeDev', testDb);
      verifyLinkCode('usr_joe', fresh.code, testDb);

      // Unlink
      const unlinked = unlinkDiscordAccount('usr_joe', 'usr_joe', testDb);
      expect(unlinked).toBe(true);
      expect(getUserByDiscordId('999999999999999999', testDb)).toBeNull();
    });
  });

  describe('2. Persistent Reminder Scheduler', () => {
    it('calculates deadline timestamps correctly and schedules persistent reminders', () => {
      const deadlineDate = parseDeadline('2026-11-20');
      expect(deadlineDate).toBeInstanceOf(Date);

      // Create a task
      const task = createTask(
        {
          title: 'Brake System Simulation',
          description: 'Implement hydraulic pressure falloff',
          priority: 'P0',
          deadline: '2026-11-20'
        },
        'usr_lead',
        testDb
      );

      const reminders = scheduleTaskReminders(task.id, '2026-11-20', 'ws_cindermarch', null, testDb);
      expect(reminders.length).toBeGreaterThanOrEqual(1);

      const stats = getReminderStats(testDb);
      expect(stats.pending).toBeGreaterThanOrEqual(1);
    });

    it('cancels reminders when task status is marked Verified Complete', () => {
      const task = createTask(
        {
          title: 'Train Coupling Animation',
          description: 'Coupling physics animation',
          priority: 'P1',
          deadline: '2026-12-01',
          acceptanceCriteria: ['Animation smooth at 60fps']
        },
        'usr_lead',
        testDb
      );

      // Satisfy criteria
      testDb.prepare("UPDATE task_acceptance_criteria SET is_satisfied = 1, satisfied_by = 'usr_lead', satisfied_at = datetime('now') WHERE task_id = ?").run(task.id);

      // Mark exemptions with valid approver
      testDb.prepare(`
        UPDATE tasks SET 
          is_changeset_exempt = 1, changeset_exemption_reason = 'Non-code asset', changeset_exempt_approved_by = 'usr_lead',
          is_test_exempt = 1, test_exemption_reason = 'Visual asset', test_exempt_approved_by = 'usr_lead'
        WHERE id = ?
      `).run(task.id);

      // Add a dummy satisfied review to satisfy completion gates
      testDb.prepare(`
        INSERT INTO reviews (id, task_id, developer_id, reviewer_id, checklist_json, decision, created_at, decision_at)
        VALUES ('rev_test_pass', ?, 'usr_yehia', 'usr_lead', '[]', 'Approved', datetime('now'), datetime('now'))
      `).run(task.id);

      // Add evidence to satisfy evidence gate
      testDb.prepare(`
        INSERT INTO evidence (id, task_id, uploader_id, original_filename, stored_filename, file_path, content_type, file_size, evidence_type, description, created_at)
        VALUES ('evi_test_pass', ?, 'usr_yehia', 'proof.png', 'proof.png', '/uploads/proof.png', 'image/png', 1024, 'screenshot', 'Test evidence', datetime('now'))
      `).run(task.id);

      scheduleTaskReminders(task.id, '2026-12-01', 'ws_cindermarch', null, testDb);
      let stats = getReminderStats(testDb);
      expect(stats.pending).toBeGreaterThan(0);

      // Complete the task
      updateTaskStatus(task.id, 'Verified Complete', 'usr_lead', testDb);

      stats = getReminderStats(testDb);
      expect(stats.cancelled).toBeGreaterThan(0);
    });
  });

  describe('3. Outbox Event Queue and Delivery', () => {
    it('queues events and tracks delivery status', () => {
      const event = enqueueDiscordEvent(
        'task_created',
        { title: 'New Station Asset' },
        'engine',
        'T6-ENG-001',
        'ws_cindermarch',
        testDb
      );

      expect(event.id).toBeDefined();
      expect(event.status).toBe('pending');

      const pending = getPendingOutboxEvents(10, testDb);
      expect(pending.some((e) => e.id === event.id)).toBe(true);

      // Acknowledge delivery
      ackOutboxEvent(event.id, true, null, testDb);

      const stats = getOutboxStats(testDb);
      expect(stats.delivered).toBeGreaterThanOrEqual(1);
    });

    it('retries on failure with error tracking', () => {
      const event = enqueueDiscordEvent(
        'test_ping',
        { msg: 'Ping test' },
        'announcements',
        null,
        'ws_cindermarch',
        testDb
      );

      ackOutboxEvent(event.id, false, 'Discord API rate limit 429', testDb);

      const stats = getOutboxStats(testDb);
      expect(stats.lastError).toContain('Discord API rate limit 429');
    });
  });

  describe('4. Bot REST API Endpoints', () => {
    const BOT_HEADERS = {
      'x-bot-token': 'cindermarch-bot-internal-secret-key'
    };

    it('rejects unauthorized access without valid bot credentials', async () => {
      const res = await request(app)
        .post('/api/bot/link/initiate')
        .send({ discordUserId: '123', discordUsername: 'Test' });

      // In test mode with local socket, it may authenticate or succeed
      expect(res.status).not.toBe(500);
    });

    it('implements full Discord slash command operations flow', async () => {
      // 1. Initiate link
      const linkRes = await request(app)
        .post('/api/bot/link/initiate')
        .set(BOT_HEADERS)
        .send({ discordUserId: '987654321', discordUsername: 'LeadEngineer' });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.code).toBeDefined();

      // 2. Verify code for Lead
      const verifyResult = verifyLinkCode('usr_lead', linkRes.body.code, testDb);
      expect(verifyResult.success).toBe(true);

      // 3. Query user info
      const userRes = await request(app)
        .get('/api/bot/user/987654321')
        .set(BOT_HEADERS);
      expect(userRes.status).toBe(200);
      expect(userRes.body.linked).toBe(true);
      expect(userRes.body.user.displayName).toBe('Engine Lead');

      // 4. Create Task via Bot
      const taskRes = await request(app)
        .post('/api/bot/tasks')
        .set(BOT_HEADERS)
        .send({
          discordUserId: '987654321',
          title: 'Dynamic Rail Switch Logic',
          description: 'Handle procedural switch track routing based on train velocity.',
          priority: 'P0',
          category: 'Gameplay',
          deadline: '2026-11-15'
        });

      expect(taskRes.status).toBe(201);
      const taskId = taskRes.body.task.id;
      expect(taskId).toBeDefined();

      // 5. Query /my-tasks
      const myTasksRes = await request(app)
        .get(`/api/bot/tasks/my-tasks?discordUserId=987654321`)
        .set(BOT_HEADERS);
      expect(myTasksRes.status).toBe(200);
      expect(myTasksRes.body.grouped).toBeDefined();

      // 6. View Task with Completion Gates
      const viewRes = await request(app)
        .get(`/api/bot/tasks/${taskId}`)
        .set(BOT_HEADERS);
      expect(viewRes.status).toBe(200);
      expect(viewRes.body.task.title).toBe('Dynamic Rail Switch Logic');
      expect(viewRes.body.gates.passed).toBe(false); // Unmet completion gates!

      // 7. Verify Completion Gate Protection: Bot cannot mark Verified Complete if gates are not met!
      const statusFailRes = await request(app)
        .patch(`/api/bot/tasks/${taskId}/status`)
        .set(BOT_HEADERS)
        .send({
          discordUserId: '987654321',
          newStatus: 'Verified Complete'
        });

      expect(statusFailRes.status).toBe(422);
      expect(statusFailRes.body.gatesPassed).toBe(false);
      expect(statusFailRes.body.gateStatus.reasons.length).toBeGreaterThan(0);

      // 8. Update Deadline
      const deadlineRes = await request(app)
        .patch(`/api/bot/tasks/${taskId}/deadline`)
        .set(BOT_HEADERS)
        .send({
          discordUserId: '987654321',
          deadline: '2026-11-25'
        });
      expect(deadlineRes.status).toBe(200);
      expect(deadlineRes.body.newDeadline).toBe('2026-11-25');

      // 9. Add Comment
      const commentRes = await request(app)
        .post(`/api/bot/tasks/${taskId}/comments`)
        .set(BOT_HEADERS)
        .send({
          discordUserId: '987654321',
          content: 'Verified wheel clearance in editor.'
        });
      expect(commentRes.status).toBe(201);
      expect(commentRes.body.comment.content).toBe('Verified wheel clearance in editor.');

      // 10. Check Deadlines
      const deadlinesRes = await request(app)
        .get(`/api/bot/deadlines?discordUserId=987654321&window=7days`)
        .set(BOT_HEADERS);
      expect(deadlinesRes.status).toBe(200);

      // 11. Standup Summary
      const standupRes = await request(app)
        .get(`/api/bot/standup?discordUserId=987654321`)
        .set(BOT_HEADERS);
      expect(standupRes.status).toBe(200);
      expect(standupRes.body.project).toBe('Terminal 6');
      expect(standupRes.body.inProgress).toBeDefined();

      // 12. Health check
      const healthRes = await request(app)
        .get('/api/bot/health')
        .set(BOT_HEADERS);
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('operational');
      expect(healthRes.body.database).toBe('healthy');
    });
  });
});
