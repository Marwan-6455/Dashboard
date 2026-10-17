import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { runMigrations } from '../db/migrations.js';
import { setDbForTesting } from '../db/connection.js';
import { createSession } from '../middleware/auth.js';
import { taskRouter } from '../routes/taskRoutes.js';
import { botRouter } from '../routes/botRoutes.js';
import {
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  toggleAcceptanceCriterion,
  addComment
} from '../services/taskService.js';
import { TaskAuthService } from '../services/taskAuthService.js';

describe('Cindermarch Engine Hub — Restrict Task Creation, Editing, and Self-Assignment for Developers', () => {
  let db: DatabaseSync;
  let app: express.Express;

  const apexOwnerId = 'usr_apex_owner';
  const superAdminId = 'usr_super_admin';
  const managerCoreTeamId = 'usr_manager_core';
  const managerStoryTeamId = 'usr_manager_story';
  const devJoeId = 'usr_dev_joe';
  const devYehiaId = 'usr_dev_yehia';

  let apexHeaders: Record<string, string>;
  let superAdminHeaders: Record<string, string>;
  let managerCoreHeaders: Record<string, string>;
  let managerStoryHeaders: Record<string, string>;
  let devJoeHeaders: Record<string, string>;
  let devYehiaHeaders: Record<string, string>;

  let existingTaskId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(db);
    setDbForTesting(db);

    const now = new Date().toISOString();
    const hash = bcrypt.hashSync('Password123!', 10);

    // 1. Seed Users with trusted canonical roles
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        (?, 'apex_owner', 'Apex Owner', 'apex@cindermarch.studio', ?, '["owner","admin"]', ?, ?),
        (?, 'super_admin', 'Super Admin', 'admin@cindermarch.studio', ?, '["super_admin"]', ?, ?),
        (?, 'mgr_core', 'Core Team Manager', 'mgr_core@cindermarch.studio', ?, '["team_manager"]', ?, ?),
        (?, 'mgr_story', 'Story Team Manager', 'mgr_story@cindermarch.studio', ?, '["team_manager"]', ?, ?),
        (?, 'dev_joe', 'Joe Developer', 'joe@cindermarch.studio', ?, '["developer"]', ?, ?),
        (?, 'dev_yehia', 'Yehia Developer', 'yehia@cindermarch.studio', ?, '["developer"]', ?, ?)
    `).run(
      apexOwnerId, hash, now, now,
      superAdminId, hash, now, now,
      managerCoreTeamId, hash, now, now,
      managerStoryTeamId, hash, now, now,
      devJoeId, hash, now, now,
      devYehiaId, hash, now, now
    );

    // 2. Ensure Workspace with Apex Owner
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, primary_owner_id, super_admin_limit, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', ?, ?, 2, ?, ?)
      ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id, primary_owner_id = excluded.primary_owner_id
    `).run(apexOwnerId, apexOwnerId, now, now);

    // 3. Seed Workspace Memberships
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES 
        ('wm_apex', 'ws_cindermarch', ?, 'owner', 'active', ?),
        ('wm_sa', 'ws_cindermarch', ?, 'super_admin', 'active', ?),
        ('wm_mgr_core', 'ws_cindermarch', ?, 'team_manager', 'active', ?),
        ('wm_mgr_story', 'ws_cindermarch', ?, 'team_manager', 'active', ?),
        ('wm_dev_joe', 'ws_cindermarch', ?, 'developer', 'active', ?),
        ('wm_dev_yehia', 'ws_cindermarch', ?, 'developer', 'active', ?)
    `).run(
      apexOwnerId, now,
      superAdminId, now,
      managerCoreTeamId, now,
      managerStoryTeamId, now,
      devJoeId, now,
      devYehiaId, now
    );

    // 4. Seed Projects
    db.prepare(`
      INSERT INTO projects (id, name, description, repository_id, created_at)
      VALUES 
        ('terminal-6', 'Terminal 6', 'Horror Game', 'Terminal6-Main@cindermarch', ?),
        ('eclipsed', 'Eclipsed', 'Metroidvania', 'Eclipsed-Main@cindermarch', ?)
      ON CONFLICT(id) DO NOTHING
    `).run(now, now);

    // 5. Seed Teams with Manager assignments
    db.prepare(`
      INSERT INTO teams (id, workspace_id, name, slug, description, project_id, manager_id, created_at, updated_at)
      VALUES 
        ('team_core_engine', 'ws_cindermarch', 'Core Engine & Systems', 'core-engine', 'Engine tech', 'terminal-6', ?, ?, ?),
        ('team_narrative_story', 'ws_cindermarch', 'Narrative & Lore', 'narrative', 'Story tech', 'eclipsed', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET manager_id = excluded.manager_id
    `).run(
      managerCoreTeamId, now, now,
      managerStoryTeamId, now, now
    );

    // 6. Seed Team Memberships
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, role, joined_at)
      VALUES 
        ('tm_mgr_c', 'team_core_engine', ?, 'manager', ?),
        ('tm_dev_j', 'team_core_engine', ?, 'member', ?),
        ('tm_mgr_s', 'team_narrative_story', ?, 'manager', ?),
        ('tm_dev_y', 'team_narrative_story', ?, 'member', ?)
      ON CONFLICT(team_id, user_id) DO NOTHING
    `).run(
      managerCoreTeamId, now,
      devJoeId, now,
      managerStoryTeamId, now,
      devYehiaId, now
    );

    // 7. Seed Discord account links for bot commands
    db.prepare(`
      INSERT INTO discord_account_links (id, user_id, discord_user_id, discord_username, verified_at, created_at, updated_at)
      VALUES 
        ('link_dev_joe', ?, 'disc_dev_joe', 'joe_discord', ?, ?, ?),
        ('link_sa', ?, 'disc_super_admin', 'sa_discord', ?, ?, ?)
    `).run(devJoeId, now, now, now, superAdminId, now, now, now);

    // 8. Seed an Existing Task assigned to dev_joe
    const initialTask = createTask(
      {
        title: 'Initial Physics Engine Task',
        description: 'Verify bullet drop trajectory in corridor scene.',
        projectId: 'terminal-6',
        teamId: 'team_core_engine',
        ownerId: devJoeId,
        priority: 'P1',
        deadline: '2026-11-01T18:00:00Z',
        acceptanceCriteria: ['Trajectory follows gravity 9.8m/s', 'Impact triggers dust particle']
      },
      apexOwnerId,
      db
    );
    existingTaskId = initialTask.id;

    // 9. Create Auth Headers for HTTP requests
    const makeHeaders = (userId: string) => {
      const sess = createSession(userId);
      return {
        'x-session-token': sess.sessionToken,
        'x-csrf-token': sess.csrfToken
      };
    };

    apexHeaders = makeHeaders(apexOwnerId);
    superAdminHeaders = makeHeaders(superAdminId);
    managerCoreHeaders = makeHeaders(managerCoreTeamId);
    managerStoryHeaders = makeHeaders(managerStoryTeamId);
    devJoeHeaders = makeHeaders(devJoeId);
    devYehiaHeaders = makeHeaders(devYehiaId);

    // Setup Express App
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/tasks', taskRouter);
    app.use('/api/bot', botRouter);
  });

  afterEach(() => {
    setDbForTesting(null);
    db.close();
  });

  // ---------------------------------------------------------------------------
  // 1 & 2: DEVELOPER CANNOT CREATE TASKS VIA INTERFACE OR DIRECT API
  // ---------------------------------------------------------------------------
  it('1 & 2: rejects task creation attempts by ordinary developers with 403 Forbidden', async () => {
    // API request as dev_joe
    const res = await request(app)
      .post('/api/tasks')
      .set(devJoeHeaders)
      .send({
        title: 'Developer Rogue Task',
        description: 'Trying to create my own task',
        projectId: 'terminal-6',
        teamId: 'team_core_engine',
        priority: 'P1'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Developers cannot create tasks|Developers are not permitted to create tasks/i);

    // Direct service call must also reject
    expect(() => {
      createTask(
        {
          title: 'Direct Service Rogue Task',
          description: 'Direct call bypassing route',
          projectId: 'terminal-6'
        },
        devJoeId,
        db
      );
    }).toThrow(/Developers cannot create tasks|Developers are not permitted to create tasks/i);
  });

  // ---------------------------------------------------------------------------
  // 3: DEVELOPER CANNOT EDIT TASK TITLES OR DESCRIPTIONS
  // ---------------------------------------------------------------------------
  it('3: rejects task title and description edits from developers with 403 Forbidden', async () => {
    // Attempt title edit
    const resTitle = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders)
      .send({ title: 'Hacked Title By Dev' });

    expect(resTitle.status).toBe(403);
    expect(resTitle.body.error).toMatch(/Developers are not permitted to edit task definitions/i);

    // Attempt description edit
    const resDesc = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders)
      .send({ description: 'Changed description by developer' });

    expect(resDesc.status).toBe(403);
    expect(resDesc.body.error).toMatch(/Developers are not permitted to edit task definitions/i);

    // Verify task title & description remained unmodified
    const check = db.prepare('SELECT title, description FROM tasks WHERE id = ?').get(existingTaskId) as any;
    expect(check.title).toBe('Initial Physics Engine Task');
    expect(check.description).toBe('Verify bullet drop trajectory in corridor scene.');
  });

  // ---------------------------------------------------------------------------
  // 4: DEVELOPER CANNOT CHANGE TASK PRIORITIES OR DEADLINES
  // ---------------------------------------------------------------------------
  it('4: rejects priority and deadline changes from developers with 403 Forbidden', async () => {
    // Attempt priority edit
    const resPri = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders)
      .send({ priority: 'P0' });

    expect(resPri.status).toBe(403);
    expect(resPri.body.error).toMatch(/Developers are not permitted to edit task definitions/i);

    // Attempt direct deadline edit
    const resDl = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders)
      .send({ deadline: '2026-12-31T18:00:00Z' });

    expect(resDl.status).toBe(403);
    expect(resDl.body.error).toMatch(/Developers are not permitted to edit task definitions/i);

    // Attempt extend-deadline manager endpoint as developer
    const resExtend = await request(app)
      .post(`/api/tasks/${existingTaskId}/extend-deadline`)
      .set(devJoeHeaders)
      .send({ extendedDeadline: '2026-12-31T18:00:00Z', reason: 'Dev needs more time' });

    expect(resExtend.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 5: PREVENT SELF-ASSIGNMENT AND REASSIGNMENT BY DEVELOPERS
  // ---------------------------------------------------------------------------
  it('5: rejects self-assignment and reassignment attempts by developers with 403 Forbidden', async () => {
    // Attempt reassign to another developer
    const resReassign = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders)
      .send({ ownerId: devYehiaId });

    expect(resReassign.status).toBe(403);
    expect(resReassign.body.error).toMatch(/Developers cannot assign or reassign tasks/i);

    // Dev Yehia attempting to self-assign Dev Joe's task
    const resSelfAssign = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devYehiaHeaders)
      .send({ ownerId: devYehiaId });

    expect(resSelfAssign.status).toBe(403);
    expect(resSelfAssign.body.error).toMatch(/Developers cannot assign or reassign tasks/i);

    // Verify database record assignee is still dev_joe
    const check = db.prepare('SELECT owner_id FROM tasks WHERE id = ?').get(existingTaskId) as any;
    expect(check.owner_id).toBe(devJoeId);
  });

  // ---------------------------------------------------------------------------
  // 6: DEVELOPER CANNOT DELETE OR ARCHIVE TASKS
  // ---------------------------------------------------------------------------
  it('6: rejects task deletion from developers with 403 Forbidden', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Developers are not permitted to delete or archive tasks/i);

    // Verify task still exists in DB
    const check = db.prepare('SELECT id FROM tasks WHERE id = ?').get(existingTaskId);
    expect(check).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 7: DEVELOPER CAN UPDATE PERMITTED PROGRESS/STATUS FIELDS ON ASSIGNED TASKS
  // ---------------------------------------------------------------------------
  it('7: permits developer to update workflow status and actualEffort on assigned task only', async () => {
    // 1. Move from Backlog to In Progress
    const resStatus1 = await request(app)
      .patch(`/api/tasks/${existingTaskId}/status`)
      .set(devJoeHeaders)
      .send({ status: 'In Progress' });

    expect(resStatus1.status).toBe(200);
    expect(resStatus1.body.task.status).toBe('In Progress');

    // 2. Update permitted actualEffort
    const resEffort = await request(app)
      .patch(`/api/tasks/${existingTaskId}`)
      .set(devJoeHeaders)
      .send({ actualEffort: '4h 30m' });

    expect(resEffort.status).toBe(200);
    expect(resEffort.body.task.actual_effort).toBe('4h 30m');

    // 3. Move from In Progress to Ready for Review
    const resStatus2 = await request(app)
      .patch(`/api/tasks/${existingTaskId}/status`)
      .set(devJoeHeaders)
      .send({ status: 'Ready for Review' });

    expect(resStatus2.status).toBe(200);
    expect(resStatus2.body.task.status).toBe('Ready for Review');

    // 4. Disallow unassigned developer (dev_yehia) from modifying status on dev_joe's task
    const resUnauthorizedDev = await request(app)
      .patch(`/api/tasks/${existingTaskId}/status`)
      .set(devYehiaHeaders)
      .send({ status: 'Blocked' });

    expect(resUnauthorizedDev.status).toBe(403);
    expect(resUnauthorizedDev.body.error).toMatch(/only permitted to update the status of tasks assigned to you/i);
  });

  // ---------------------------------------------------------------------------
  // 8: DEVELOPER CAN COMMENT, UPLOAD EVIDENCE, AND TOGGLE CRITERIA
  // ---------------------------------------------------------------------------
  it('8: allows developer to add comments, satisfy criteria, and request extensions', async () => {
    // Add comment
    const resComment = await request(app)
      .post(`/api/tasks/${existingTaskId}/comments`)
      .set(devJoeHeaders)
      .send({ content: 'Implemented gravity calculation in CannonPhysics.cs' });

    expect(resComment.status).toBe(201);
    expect(resComment.body.comment.content).toBe('Implemented gravity calculation in CannonPhysics.cs');

    // Satisfy criterion
    const crit = db.prepare('SELECT id FROM task_acceptance_criteria WHERE task_id = ? LIMIT 1').get(existingTaskId) as any;
    expect(crit).toBeDefined();

    const resCrit = await request(app)
      .patch(`/api/tasks/${existingTaskId}/criteria/${crit.id}`)
      .set(devJoeHeaders)
      .send({ isSatisfied: true });

    expect(resCrit.status).toBe(200);
    expect(resCrit.body.criterion.is_satisfied).toBe(1);

    // Request deadline extension (Developer formal workflow)
    const resExtReq = await request(app)
      .post(`/api/tasks/${existingTaskId}/request-extension`)
      .set(devJoeHeaders)
      .send({
        requestedDeadline: '2026-11-10T18:00:00Z',
        reason: 'Unity physics update required re-indexing collision meshes'
      });

    expect(resExtReq.status).toBe(200);
    expect(resExtReq.body.success).toBe(true);
    expect(resExtReq.body.message).toMatch(/Deadline extension request submitted/i);
  });

  // ---------------------------------------------------------------------------
  // 9: TEAM MANAGER CAN CREATE AND EDIT TASKS IN THEIR SCOPE
  // ---------------------------------------------------------------------------
  it('9: permits Team Manager to create and edit tasks in their managed team/project', async () => {
    // Core manager creates task in team_core_engine
    const resCreate = await request(app)
      .post('/api/tasks')
      .set(managerCoreHeaders)
      .send({
        title: 'Core Engine Spatial Partitioning',
        description: 'Optimize octree queries for large corridor scenes.',
        projectId: 'terminal-6',
        teamId: 'team_core_engine',
        ownerId: devJoeId,
        priority: 'P1',
        deadline: '2026-11-15T18:00:00Z'
      });

    expect(resCreate.status).toBe(201);
    const newTaskId = resCreate.body.task.id;

    // Core manager edits title and changes deadline
    const resEdit = await request(app)
      .patch(`/api/tasks/${newTaskId}`)
      .set(managerCoreHeaders)
      .send({
        title: 'Core Engine BVH Partitioning',
        deadline: '2026-11-20T18:00:00Z',
        priority: 'P0'
      });

    expect(resEdit.status).toBe(200);
    expect(resEdit.body.task.title).toBe('Core Engine BVH Partitioning');
    expect(resEdit.body.task.priority).toBe('P0');
  });

  // ---------------------------------------------------------------------------
  // 10: SUPER ADMIN CAN PERFORM AUTHORIZED TASK MANAGEMENT
  // ---------------------------------------------------------------------------
  it('10: allows Super Admin full operational task management across teams', async () => {
    // Super admin creates task in narrative team
    const resCreate = await request(app)
      .post('/api/tasks')
      .set(superAdminHeaders)
      .send({
        title: 'Super Admin Narrative Task',
        description: 'Global audit of voice-over lines',
        projectId: 'eclipsed',
        teamId: 'team_narrative_story',
        ownerId: devYehiaId,
        priority: 'P2'
      });

    expect(resCreate.status).toBe(201);
    const saTaskId = resCreate.body.task.id;

    // Super admin reassigns to dev_joe
    const resReassign = await request(app)
      .patch(`/api/tasks/${saTaskId}`)
      .set(superAdminHeaders)
      .send({ ownerId: devJoeId });

    expect(resReassign.status).toBe(200);
    expect(resReassign.body.task.owner_id).toBe(devJoeId);

    // Super admin deletes task
    const resDelete = await request(app)
      .delete(`/api/tasks/${saTaskId}`)
      .set(superAdminHeaders);

    expect(resDelete.status).toBe(200);
    expect(resDelete.body.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 11: APEX AUTHORITY RETAINS FULL TASK MANAGEMENT CONTROL
  // ---------------------------------------------------------------------------
  it('11: confirms Apex Authority retains full unrestricted task control', async () => {
    // Apex Authority creates task
    const resCreate = await request(app)
      .post('/api/tasks')
      .set(apexHeaders)
      .send({
        title: 'Apex Sovereign Directive',
        description: 'Mandatory engine milestone',
        projectId: 'terminal-6',
        priority: 'P0'
      });

    expect(resCreate.status).toBe(201);
    const apexTaskId = resCreate.body.task.id;

    // Apex Authority edits definition, deadline, and priority
    const resEdit = await request(app)
      .patch(`/api/tasks/${apexTaskId}`)
      .set(apexHeaders)
      .send({
        title: 'Apex Sovereign Directive (Revised)',
        priority: 'P1',
        deadline: '2026-12-01T18:00:00Z'
      });

    expect(resEdit.status).toBe(200);
    expect(resEdit.body.task.title).toBe('Apex Sovereign Directive (Revised)');

    // Apex Authority deletes task
    const resDel = await request(app)
      .delete(`/api/tasks/${apexTaskId}`)
      .set(apexHeaders);

    expect(resDel.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // 12: CROSS-TEAM & CROSS-PROJECT RESTRICTIONS ENFORCED FOR MANAGERS
  // ---------------------------------------------------------------------------
  it('12: enforces team and project boundaries for Team Managers', async () => {
    // Core Engine manager tries to create a task in Narrative team (Eclipsed project)
    const resCrossCreate = await request(app)
      .post('/api/tasks')
      .set(managerCoreHeaders)
      .send({
        title: 'Illegal Cross Team Task',
        description: 'Core manager attempting to alter narrative story team',
        projectId: 'eclipsed',
        teamId: 'team_narrative_story',
        priority: 'P1'
      });

    expect(resCrossCreate.status).toBe(403);
    expect(resCrossCreate.body.error).toMatch(/not authorized to (create|manage) tasks/i);

    // Create a task in Narrative team first
    const narrativeTask = createTask(
      {
        title: 'Narrative Dialogue Scripting',
        description: 'Write Chapter 2 dialogue tree',
        projectId: 'eclipsed',
        teamId: 'team_narrative_story',
        ownerId: devYehiaId
      },
      managerStoryTeamId,
      db
    );

    // Core Engine manager tries to edit Narrative team task
    const resCrossEdit = await request(app)
      .patch(`/api/tasks/${narrativeTask.id}`)
      .set(managerCoreHeaders)
      .send({ title: 'Hacked by Core Manager' });

    expect(resCrossEdit.status).toBe(403);
    expect(resCrossEdit.body.error).toMatch(/not authorized to (create|manage) tasks/i);
  });

  // ---------------------------------------------------------------------------
  // 13: DISCORD BOT ENDPOINTS ENFORCE SAME AUTHORIZATION RULES
  // ---------------------------------------------------------------------------
  it('13: prevents Discord bot task commands from bypassing developer restrictions', async () => {
    // 1. Developer attempting to create task via Discord bot endpoint
    const resBotCreate = await request(app)
      .post('/api/bot/tasks')
      .set('x-bot-token', 'cindermarch-bot-internal-secret-key')
      .send({
        discordUserId: 'disc_dev_joe',
        title: 'Discord Rogue Task',
        description: 'Created through bot bypass attempt',
        projectId: 'terminal-6'
      });

    expect(resBotCreate.status).toBe(403);
    expect(resBotCreate.body.error).toMatch(/Developers (cannot create tasks|are not permitted to create tasks)/i);

    // 2. Developer attempting to assign/self-assign via Discord bot endpoint
    const resBotAssign = await request(app)
      .patch(`/api/bot/tasks/${existingTaskId}/assign`)
      .set('x-bot-token', 'cindermarch-bot-internal-secret-key')
      .send({
        discordUserId: 'disc_dev_joe',
        actorId: devJoeId,
        targetUsernameOrId: devJoeId
      });

    expect(resBotAssign.status).toBe(403);
    expect(resBotAssign.body.error).toMatch(/Developers cannot assign or reassign tasks/i);

    // 3. Developer attempting to change deadline via Discord bot endpoint
    const resBotDeadline = await request(app)
      .patch(`/api/bot/tasks/${existingTaskId}/deadline`)
      .set('x-bot-token', 'cindermarch-bot-internal-secret-key')
      .send({
        discordUserId: 'disc_dev_joe',
        deadline: '2026-12-31T18:00:00Z',
        reason: 'Bot bypass deadline'
      });

    expect(resBotDeadline.status).toBe(403);
    expect(resBotDeadline.body.error).toMatch(/Developers are not permitted to edit task definitions/i);

    // 4. Authorized Super Admin can perform bot assignment
    const resBotAssignAdmin = await request(app)
      .patch(`/api/bot/tasks/${existingTaskId}/assign`)
      .set('x-bot-token', 'cindermarch-bot-internal-secret-key')
      .send({
        discordUserId: 'disc_super_admin',
        actorId: superAdminId,
        targetUsernameOrId: devYehiaId
      });

    expect(resBotAssignAdmin.status).toBe(200);
    expect(resBotAssignAdmin.body.task.owner_id).toBe(devYehiaId);
  });

  // ---------------------------------------------------------------------------
  // 14: EXISTING TASK RECORDS AND AUDIT HISTORY REMAIN INTACT
  // ---------------------------------------------------------------------------
  it('14: verifies existing task records, audit trail, and activity logs remain intact', () => {
    // Check initial task record created in beforeEach
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existingTaskId) as any;
    expect(task).toBeDefined();
    expect(task.id).toBe(existingTaskId);
    expect(task.title).toBe('Initial Physics Engine Task');
    expect(task.owner_id).toBe(devJoeId);
    expect(task.deadline).toBe('2026-11-01T18:00:00Z');

    // Check activity history
    const activities = db.prepare('SELECT * FROM activity_events WHERE related_task_id = ?').all(existingTaskId) as any[];
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.some((a) => a.action === 'task_created')).toBe(true);

    // Check acceptance criteria
    const criteria = db.prepare('SELECT * FROM task_acceptance_criteria WHERE task_id = ?').all(existingTaskId) as any[];
    expect(criteria.length).toBe(2);
  });
});
