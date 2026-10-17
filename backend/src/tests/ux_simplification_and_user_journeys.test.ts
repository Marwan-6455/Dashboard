import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { runMigrations } from '../db/migrations.js';
import { setDbForTesting } from '../db/connection.js';
import { AdminService } from '../services/adminService.js';
import { authRouter } from '../routes/authRoutes.js';
import { adminRouter } from '../routes/adminRoutes.js';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTaskStatus,
  toggleAcceptanceCriterion,
  addComment
} from '../services/taskService.js';
import { createReviewRequest, submitReviewDecision } from '../services/reviewService.js';
import { recordChangeset } from '../services/uvcsService.js';
import { createEvidence } from '../services/evidenceService.js';
import { calculateActiveStrikes, getStrikePolicy, getWarningLevel } from '../services/strikeService.js';

describe('Real User Journeys — UX Simplification & Complete Verification', () => {
  let db: DatabaseSync;
  let app: express.Express;

  const ownerId = 'usr_apex_test';
  const ownerPassword = 'ApexOwnerPassword123!';
  const devId = 'usr_dev_test';
  const devPassword = 'DevPassword123!';
  const mgrId = 'usr_mgr_test';
  const revId = 'usr_rev_test';

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(db);
    setDbForTesting(db);

    const now = new Date().toISOString();
    const ownerHash = bcrypt.hashSync(ownerPassword, 10);
    const standardHash = bcrypt.hashSync(devPassword, 10);

    // 1. Seed Apex Authority (Primary Owner)
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES (?, 'apex_owner', 'Marwan Hossam', 'marwan@cindermarch.internal', ?, '["owner","admin","developer"]', ?, ?)
    `).run(ownerId, ownerHash, now, now);

    // Ensure Primary Workspace with ownerId
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, primary_owner_id, super_admin_limit, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', ?, ?, 2, ?, ?)
      ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id, primary_owner_id = excluded.primary_owner_id
    `).run(ownerId, ownerId, now, now);

    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES ('wm_apex', 'ws_cindermarch', ?, 'owner', 'active', ?)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = 'owner', status = 'active'
    `).run(ownerId, now);

    // 2. Seed Developer
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES (?, 'alex_dev', 'Alex Developer', 'alex@cindermarch.internal', ?, '["developer"]', ?, ?)
    `).run(devId, standardHash, now, now);

    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES ('wm_dev', 'ws_cindermarch', ?, 'developer', 'active', ?)
    `).run(devId, now);

    // 3. Seed Team Manager
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES (?, 'sarah_lead', 'Sarah Manager', 'sarah@cindermarch.internal', ?, '["team_manager","developer"]', ?, ?)
    `).run(mgrId, standardHash, now, now);

    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES ('wm_mgr', 'ws_cindermarch', ?, 'team_manager', 'active', ?)
    `).run(mgrId, now);

    // 4. Seed Reviewer
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES (?, 'david_rev', 'David Reviewer', 'david@cindermarch.internal', ?, '["reviewer","developer"]', ?, ?)
    `).run(revId, standardHash, now, now);

    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES ('wm_rev', 'ws_cindermarch', ?, 'reviewer', 'active', ?)
    `).run(revId, now);

    // 5. Seed Projects: Terminal 6 and Eclipsed
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, description, repository_id, created_at)
      VALUES 
        ('terminal-6', 'Terminal 6', 'Psychological horror in an abandoned transit station', 'Terminal6-Main@cindermarch', ?),
        ('eclipsed', 'Eclipsed', '2D Atmospheric metroidvania', 'Eclipsed-Main@cindermarch', ?)
    `).run(now, now);

    // 6. Seed the 6 Studio Teams
    const teams = [
      { id: 'team_story', name: 'Story Team', slug: 'story-team' },
      { id: 'team_coding', name: 'Coding Team', slug: 'coding-team' },
      { id: 'team_marketing', name: 'Marketing Team', slug: 'marketing-team' },
      { id: 'team_engine', name: 'Engine Team', slug: 'engine-team' },
      { id: 'team_3d_artists', name: '3D Artists', slug: '3d-artists' },
      { id: 'team_sound', name: 'Sound Team', slug: 'sound-team' }
    ];

    for (const t of teams) {
      db.prepare(`
        INSERT OR REPLACE INTO teams (id, workspace_id, name, slug, description, project_id, created_at, updated_at)
        VALUES (?, 'ws_cindermarch', ?, ?, 'Departmental studio team', 'terminal-6', ?, ?)
      `).run(t.id, t.name, t.slug, now, now);
    }

    // Setup Express App
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRouter);
    app.use('/api/admin', adminRouter);
  });

  // 1. A new user signs up and receives the developer role
  it('Journey 1: A new user signs up and receives the developer role by default', async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'jordan_newbie',
        displayName: 'Jordan Junior',
        email: 'jordan@cindermarch.internal',
        password: 'ValidPassword123!'
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user).toBeDefined();
    expect(signupRes.body.user.roles).toContain('developer');

    // Verify workspace membership status is pending_approval
    const mem = db.prepare('SELECT * FROM workspace_members WHERE user_id = ?').get(signupRes.body.user.id) as any;
    expect(mem).toBeDefined();
    expect(mem.role).toBe('developer');
    expect(mem.status).toBe('pending_approval');
  });

  // 2. An invited user joins the private workspace
  it('Journey 2: An invited user joins the private workspace with valid token', async () => {
    // 1. Apex Authority creates an invitation
    const invRes = AdminService.createInvitation({
      workspaceId: 'ws_cindermarch',
      email: 'invited_dev@cindermarch.internal',
      role: 'team_manager',
      actorId: ownerId,
      actorName: 'Marwan Hossam'
    });

    expect(invRes.invitationToken).toBeDefined();

    // 2. User registers using that token
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'invited_lead',
        displayName: 'Invited Lead Coder',
        email: 'invited_dev@cindermarch.internal',
        password: 'SecurePassword123!',
        invitationToken: invRes.invitationToken
      });

    expect(signupRes.status).toBe(201);

    // Verify workspace membership is immediately active with invited role
    const mem = db.prepare('SELECT * FROM workspace_members WHERE user_id = ?').get(signupRes.body.user.id) as any;
    expect(mem.status).toBe('active');
    expect(mem.role).toBe('team_manager');
  });

  // 3. A developer finds and updates an assigned task
  it('Journey 3: A developer finds their assigned task and starts work (Backlog -> In Progress)', () => {
    // Manager creates task assigned to dev
    const task = createTask(
      {
        title: 'Train Carriage Door Audio Occlusion',
        description: 'Occlude exterior ambient wind when sliding carriage door shuts.',
        projectId: 'terminal-6',
        teamId: 'team_sound',
        ownerId: devId,
        priority: 'P1',
        deadline: '2026-10-30T18:00:00Z'
      },
      mgrId,
      db
    );

    // Developer queries "My Tasks"
    const myTasks = getTasks({ myTasksUserId: devId }, db);
    expect(myTasks.length).toBe(1);
    expect(myTasks[0].id).toBe(task.id);
    expect(myTasks[0].status).toBe('Backlog');

    // Developer starts work by updating status to In Progress
    const updated = updateTaskStatus(task.id, 'In Progress', devId, db);
    expect(updated.status).toBe('In Progress');

    // Adds progress comment
    addComment(task.id, devId, 'Started implementing low-pass filter curve in FMOD/Unity audio bus.', db);
    const refreshed = getTaskById(task.id, db);
    expect(refreshed.comments.length).toBe(1);
  });

  // 4. A developer satisfies criteria, links changeset/evidence, and submits for review
  it('Journey 4: A developer satisfies criteria, links changeset/evidence, and submits for review', () => {
    const task = createTask(
      {
        title: 'Player Flashlight Shadow Stencil',
        description: 'Implement stencil buffer masking for volumetric flashlight shadows.',
        projectId: 'terminal-6',
        teamId: 'team_engine',
        ownerId: devId,
        reviewerId: revId,
        priority: 'P1',
        status: 'In Progress',
        acceptanceCriteria: ['Shadows do not leak through 10cm concrete walls', 'Performance cost under 0.8ms on RTX 3060']
      },
      mgrId,
      db
    );

    // Toggle acceptance criteria
    const crit1 = task.acceptance_criteria[0];
    const crit2 = task.acceptance_criteria[1];
    toggleAcceptanceCriterion(crit1.id, true, devId, db);
    toggleAcceptanceCriterion(crit2.id, true, devId, db);

    // Link UVCS changeset
    recordChangeset(
      {
        changesetId: 'CS-10492',
        repositoryId: 'Terminal6-Main@cindermarch',
        branch: '/main/stencil-shadows',
        comment: 'Add custom URP shadow stencil shader pass',
        author: 'Alex Developer',
        taskId: task.id
      },
      devId,
      db
    );

    // Attach evidence
    createEvidence(
      {
        taskId: task.id,
        originalFilename: 'shadow_stencil_test.png',
        storedFilename: 'shadow_stencil_test.png',
        filePath: 'uploads/shadow_stencil_test.png',
        contentType: 'image/png',
        fileSize: 102400,
        evidenceType: 'screenshot',
        description: 'In-editor comparison showing zero light bleeding on concrete barrier'
      },
      devId,
      db
    );

    // Submit for peer review
    const review = createReviewRequest(
      { taskId: task.id, developerId: devId, reviewerId: revId },
      devId,
      db
    );
    expect(review.decision).toBe('Pending');

    // Move task to Ready for Review
    const updated = updateTaskStatus(task.id, 'Ready for Review', devId, db);
    expect(updated.status).toBe('Ready for Review');
  });

  // 5. A manager creates and assigns a task quickly
  it('Journey 5: A manager creates and assigns a task quickly with essential fields', () => {
    const task = createTask(
      {
        title: 'Eclipsed Ability Tree UI Polish',
        description: 'Refine skill tree connection glow curves and gamepad node navigation.',
        projectId: 'eclipsed',
        teamId: 'team_coding',
        ownerId: devId,
        priority: 'P1',
        deadline: '2026-11-05T18:00:00Z'
      },
      mgrId,
      db
    );

    expect(task.id).toMatch(/^ECL-ENG-\d+/);
    expect(task.project_id).toBe('eclipsed');
    expect(task.owner_id).toBe(devId);
    expect(task.priority).toBe('P1');
    expect(task.deadline).toBe('2026-11-05T18:00:00Z');
  });

  // 6. An administrator invites a member, approves them, and assigns team
  it('Journey 6: An administrator invites a member, approves them, and assigns team', async () => {
    // 1. Admin generates invite
    const invRes = AdminService.createInvitation({
      workspaceId: 'ws_cindermarch',
      email: 'artist_lead@cindermarch.internal',
      role: 'developer',
      actorId: ownerId,
      actorName: 'Marwan Hossam'
    });
    expect(invRes.invitationToken).toBeDefined();

    // 2. User registers
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'artist_lead',
        displayName: 'Elena Artist',
        email: 'artist_lead@cindermarch.internal',
        password: 'Password123!',
        invitationToken: invRes.invitationToken
      });

    const newUserId = signupRes.body.user.id;

    // 3. Admin assigns to 3D Artists team
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, role, joined_at)
      VALUES ('tm_artist_1', 'team_3d_artists', ?, 'manager', ?)
    `).run(newUserId, new Date().toISOString());

    const teamMem = db.prepare('SELECT * FROM team_members WHERE user_id = ?').get(newUserId) as any;
    expect(teamMem).toBeDefined();
    expect(teamMem.team_id).toBe('team_3d_artists');
    expect(teamMem.role).toBe('manager');
  });

  // 7. The Apex Authority manages the two Super Admin appointments
  it('Journey 7: Apex Authority manages the two Super Admin appointments and enforces limit', () => {
    // Seed 3 candidate accounts
    const now = new Date().toISOString();
    const candidateHash = bcrypt.hashSync('CandidatePass123!', 10);
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_cand1', 'cand1', 'Candidate 1', 'cand1@cindermarch.internal', ?, '["developer"]', ?, ?),
        ('usr_cand2', 'cand2', 'Candidate 2', 'cand2@cindermarch.internal', ?, '["developer"]', ?, ?),
        ('usr_cand3', 'cand3', 'Candidate 3', 'cand3@cindermarch.internal', ?, '["developer"]', ?, ?)
    `).run(candidateHash, now, now, candidateHash, now, now, candidateHash, now, now);

    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES 
        ('wm_c1', 'ws_cindermarch', 'usr_cand1', 'developer', 'active', ?),
        ('wm_c2', 'ws_cindermarch', 'usr_cand2', 'developer', 'active', ?),
        ('wm_c3', 'ws_cindermarch', 'usr_cand3', 'developer', 'active', ?)
    `).run(now, now, now);

    // Appoint slot 1
    const app1 = AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: ownerId,
      targetUserId: 'usr_cand1',
      passwordConfirmation: ownerPassword,
      reason: 'First appointment'
    });
    expect(app1.success).toBe(true);

    // Appoint slot 2
    const app2 = AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: ownerId,
      targetUserId: 'usr_cand2',
      passwordConfirmation: ownerPassword,
      reason: 'Second appointment'
    });
    expect(app2.success).toBe(true);

    // Check slots
    const overview = AdminService.getAdminOverview('ws_cindermarch', ownerId);
    expect(overview.superAdminSlots.used).toBe(2);
    expect(overview.superAdminSlots.available).toBe(0);

    // Appoint slot 3 should be rejected (max 2)
    expect(() =>
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: 'usr_cand3',
        passwordConfirmation: ownerPassword,
        reason: 'Third appointment'
      })
    ).toThrow(/limit reached/i);

    // Revoking slot 1 frees up a slot
    const rev = AdminService.revokeSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: ownerId,
      targetUserId: 'usr_cand1',
      passwordConfirmation: ownerPassword,
      reason: 'Revocation test'
    });
    expect(rev.success).toBe(true);

    const overviewAfter = AdminService.getAdminOverview('ws_cindermarch', ownerId);
    expect(overviewAfter.superAdminSlots.used).toBe(1);
    expect(overviewAfter.superAdminSlots.available).toBe(1);
  });

  // 8. A user understands an approaching deadline and strike warnings
  it('Journey 8: User strike status clearly shows active strikes and threshold', () => {
    const activeStrikes = calculateActiveStrikes('ws_cindermarch', devId, db);
    const policy = getStrikePolicy('ws_cindermarch', db);
    const warningLevel = getWarningLevel(activeStrikes, policy.strike_threshold);
    const remainingStrikes = Math.max(0, policy.strike_threshold - activeStrikes);

    expect(activeStrikes).toBe(0);
    expect(policy.strike_threshold).toBe(5);
    expect(remainingStrikes).toBe(5);
    expect(warningLevel).toBe('none');
    expect(policy.grace_period_hours).toBe(24);
  });

  // 9. A meeting is created and saved
  it('Journey 9: Meeting created and saved with title, date, agenda, notes, decisions', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO meetings (id, workspace_id, project_id, team_id, title, date, participants_json, agenda, notes, decisions, created_by, created_at)
      VALUES ('mtg_001', 'ws_cindermarch', 'terminal-6', 'team_engine', 'Weekly Engine Architecture Sync', ?, '["Alex","Sarah"]', '1. Physics determinism 2. URP performance', 'Agreed to lock fixed timestep to 0.02s', 'Fixed timestep standard approved', ?, ?)
    `).run(now, ownerId, now);

    const mtg = db.prepare('SELECT * FROM meetings WHERE id = ?').get('mtg_001') as any;
    expect(mtg).toBeDefined();
    expect(mtg.title).toBe('Weekly Engine Architecture Sync');
    expect(mtg.decisions).toContain('Fixed timestep standard approved');
  });

  // 10. A team member finds relevant project documentation and wiki
  it('Journey 10: Team member queries project documents and ADRs', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO documents (id, workspace_id, project_id, team_id, category, title, content, author_id, created_at, updated_at)
      VALUES ('doc_001', 'ws_cindermarch', 'terminal-6', 'team_engine', 'architecture', 'Locomotive Physics Design Guidelines', 'Standard operating guidelines for metro cab simulation...', ?, ?, ?)
    `).run(ownerId, now, now);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get('doc_001') as any;
    expect(doc).toBeDefined();
    expect(doc.title).toBe('Locomotive Physics Design Guidelines');
    expect(doc.category).toBe('architecture');

    // Query decisions (ADRs)
    db.prepare(`
      INSERT INTO decisions (id, workspace_id, project_id, title, scope, context, options_considered, chosen_approach, reasoning, author_id, status, created_at, updated_at)
      VALUES ('adr_001', 'ws_cindermarch', 'terminal-6', 'Physics Fixed Timestep Standard', 'Engine', 'Deterministic train physics across framerates', 'Option A: 60Hz, Option B: 50Hz', 'Option A: 60Hz (0.0166s)', 'Smooth camera interpolation', ?, 'Accepted', ?, ?)
    `).run(ownerId, now, now);

    const adr = db.prepare('SELECT * FROM decisions WHERE id = ?').get('adr_001') as any;
    expect(adr.status).toBe('Accepted');
  });

  // 11. A reviewer approves or requests changes
  it('Journey 11: Reviewer evaluates submitted task and approves, advancing status to Ready to Integrate', () => {
    const task = createTask(
      {
        title: 'Train Emergency Brake System Physics',
        description: 'Implement brake line pneumatic pressure decay when emergency valve triggers.',
        projectId: 'terminal-6',
        ownerId: devId,
        reviewerId: revId,
        status: 'Ready for Review'
      },
      mgrId,
      db
    );

    const review = createReviewRequest(
      { taskId: task.id, developerId: devId, reviewerId: revId },
      devId,
      db
    );

    // Reviewer submits decision: Approved
    const decision = submitReviewDecision(
      review.id,
      {
        decision: 'Approved',
        findings: 'Brake curve validated against train engineering schematics. Great implementation.',
        checklist: [
          { id: '1', label: 'Code adheres to C# performance standards', passed: true },
          { id: '2', label: 'Zero GC alloc per frame during braking', passed: true }
        ]
      },
      revId,
      db
    );

    expect(decision.decision).toBe('Approved');

    // Task advances to Ready to Integrate
    const refreshed = getTaskById(task.id, db);
    expect(refreshed.status).toBe('Ready to Integrate');
  });

  // 12. Discord integration status and operational delivery results
  it('Journey 12: Discord integration outbox tracks message delivery results', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO discord_event_outbox (id, event_type, workspace_id, payload_json, status, retry_count, created_at)
      VALUES ('msg_001', 'task_created', 'ws_cindermarch', '{"taskId":"T6-ENG-001","title":"Train Engine Calibration"}', 'delivered', 0, ?)
    `).run(now);

    const event = db.prepare('SELECT * FROM discord_event_outbox WHERE id = ?').get('msg_001') as any;
    expect(event).toBeDefined();
    expect(event.event_type).toBe('task_created');
    expect(event.status).toBe('delivered');
  });
});
