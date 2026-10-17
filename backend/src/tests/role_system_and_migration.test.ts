import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import { createSession } from '../middleware/auth.js';

describe('Cindermarch Engine Hub — Canonical Role System, Safe Migration & Administrative Security', () => {
  let db: DatabaseSync;
  let app: express.Express;
  const ownerId = 'usr_1792096581289_bdaea15a';
  const ownerPassword = 'PrimaryOwnerPassword123!';
  const dev1Id = 'usr_test_dev1';
  const dev2Id = 'usr_test_dev2';
  const superAdmin1Id = 'usr_test_sa1';
  const superAdmin2Id = 'usr_test_sa2';
  const extraUserId = 'usr_test_extra';

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runMigrations(db);
    setDbForTesting(db);

    const now = new Date().toISOString();
    const ownerHash = bcrypt.hashSync(ownerPassword, 10);
    const standardHash = bcrypt.hashSync('StandardPass123!', 10);

    // 1. Seed Owner User (KNG_MG)
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES (?, 'KNG_MG', 'KNG_MG', 'marwanhossam20062007@gmail.com', ?, '["owner","admin"]', ?, ?)
    `).run(ownerId, ownerHash, now, now);

    // 2. Ensure Primary Workspace
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, primary_owner_id, super_admin_limit, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', ?, ?, 2, ?, ?)
      ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id, primary_owner_id = excluded.primary_owner_id
    `).run(ownerId, ownerId, now, now);

    // 3. Seed Workspace Membership for Owner
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES ('wm_owner', 'ws_cindermarch', ?, 'owner', 'active', ?)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = 'owner', status = 'active'
    `).run(ownerId, now);

    // 4. Seed Standard Developers
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        (?, 'joe_dev', 'Joe Developer', 'joe@cindermarch.studio', ?, '["developer"]', ?, ?),
        (?, 'yehia_dev', 'Yehia Developer', 'yehia@cindermarch.studio', ?, '["developer"]', ?, ?),
        (?, 'sa1_user', 'Super Admin One', 'sa1@cindermarch.studio', ?, '["developer"]', ?, ?),
        (?, 'sa2_user', 'Super Admin Two', 'sa2@cindermarch.studio', ?, '["developer"]', ?, ?),
        (?, 'extra_user', 'Extra Candidate', 'extra@cindermarch.studio', ?, '["developer"]', ?, ?)
    `).run(
      dev1Id, standardHash, now, now,
      dev2Id, standardHash, now, now,
      superAdmin1Id, standardHash, now, now,
      superAdmin2Id, standardHash, now, now,
      extraUserId, standardHash, now, now
    );

    // Seed Memberships for Developers
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, joined_at)
      VALUES 
        ('wm_dev1', 'ws_cindermarch', ?, 'developer', 'active', ?),
        ('wm_dev2', 'ws_cindermarch', ?, 'developer', 'active', ?),
        ('wm_sa1', 'ws_cindermarch', ?, 'developer', 'active', ?),
        ('wm_sa2', 'ws_cindermarch', ?, 'developer', 'active', ?),
        ('wm_extra', 'ws_cindermarch', ?, 'developer', 'active', ?)
    `).run(dev1Id, now, dev2Id, now, superAdmin1Id, now, superAdmin2Id, now, extraUserId, now);

    // Setup Express App
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRouter);
    app.use('/api/admin', adminRouter);
  });

  afterEach(() => {
    setDbForTesting(null);
    db.close();
  });

  // ---------------------------------------------------------------------------
  // A. DATABASE MIGRATION & TEAM MANAGER ROLE CONSTRAINT FIX
  // ---------------------------------------------------------------------------
  describe('Database Check Constraint & Team Manager Role Repair', () => {
    it('successfully assigns the team_manager role without CHECK constraint failure', () => {
      // Execute change role to team_manager
      const res = AdminService.changeMemberRole({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: dev1Id,
        newRole: 'team_manager'
      });

      expect(res.success).toBe(true);
      expect(res.previousRole).toBe('developer');
      expect(res.newRole).toBe('team_manager');

      // Verify persistence in database
      const member = db.prepare('SELECT role, status FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .get('ws_cindermarch', dev1Id) as any;
      expect(member.role).toBe('team_manager');
      expect(member.status).toBe('active');

      // Verify audit record includes previous and new role
      const audit = db.prepare("SELECT * FROM admin_audit_log WHERE action = 'role_changed' AND target_id = ?")
        .get(dev1Id) as any;
      expect(audit).toBeDefined();
      const details = JSON.parse(audit.details_json);
      expect(details.previousRole).toBe('developer');
      expect(details.newRole).toBe('team_manager');
    });

    it('supports canonical roles: developer, reviewer, team_member, team_manager', () => {
      // 1. Change to reviewer
      AdminService.changeMemberRole({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: dev1Id,
        newRole: 'reviewer'
      });
      let m = db.prepare('SELECT role FROM workspace_members WHERE user_id = ?').get(dev1Id) as any;
      expect(m.role).toBe('reviewer');

      // 2. Change to team_member
      AdminService.changeMemberRole({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: dev1Id,
        newRole: 'team_member'
      });
      m = db.prepare('SELECT role FROM workspace_members WHERE user_id = ?').get(dev1Id) as any;
      expect(m.role).toBe('team_member');

      // 3. Change to developer
      AdminService.changeMemberRole({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: dev1Id,
        newRole: 'developer'
      });
      m = db.prepare('SELECT role FROM workspace_members WHERE user_id = ?').get(dev1Id) as any;
      expect(m.role).toBe('developer');
    });

    it('rejects illegal roles that do not conform to canonical database constraint', () => {
      expect(() => {
        db.prepare("UPDATE workspace_members SET role = 'super_hacker' WHERE user_id = ?").run(dev1Id);
      }).toThrow(/CHECK constraint failed/);
    });
  });

  // ---------------------------------------------------------------------------
  // B. APEX AUTHORITY GOVERNANCE & 2-SLOT SUPER ADMIN LIMIT
  // ---------------------------------------------------------------------------
  describe('Apex Authority & Super Admin Governance', () => {
    it('allows Primary Owner to appoint exactly two Super Admins', () => {
      // Appoint first Super Admin
      const sa1 = AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: superAdmin1Id,
        passwordConfirmation: ownerPassword,
        reason: 'Appointing First Super Admin'
      });
      expect(sa1.success).toBe(true);

      // Appoint second Super Admin
      const sa2 = AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: superAdmin2Id,
        passwordConfirmation: ownerPassword,
        reason: 'Appointing Second Super Admin'
      });
      expect(sa2.success).toBe(true);

      // Verify overview displays 2 used slots and 0 available slots
      const overview = AdminService.getAdminOverview('ws_cindermarch', ownerId);
      expect(overview.superAdminSlots.usedSlots).toBe(2);
      expect(overview.superAdminSlots.availableSlots).toBe(0);
      expect(overview.superAdmins).toHaveLength(2);
    });

    it('transactionally prevents appointing a third Super Admin (enforcing strict limit of 2)', () => {
      // Fill slot 1 and 2
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: superAdmin1Id,
        passwordConfirmation: ownerPassword
      });
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: superAdmin2Id,
        passwordConfirmation: ownerPassword
      });

      // Attempt slot 3 -> Must fail
      expect(() => {
        AdminService.appointSuperAdmin({
          workspaceId: 'ws_cindermarch',
          actorId: ownerId,
          targetUserId: extraUserId,
          passwordConfirmation: ownerPassword
        });
      }).toThrow(/Super Admin limit reached/);

      // Also verify database trigger enforces it on direct insert/update
      expect(() => {
        db.prepare("UPDATE workspace_members SET role = 'super_admin' WHERE user_id = ?").run(extraUserId);
      }).toThrow(/Access control limit reached/);
    });

    it('prohibits demoting, suspending, or revoking the Primary Owner account', () => {
      // Cannot demote Primary Owner
      expect(() => {
        AdminService.changeMemberRole({
          workspaceId: 'ws_cindermarch',
          actorId: ownerId,
          targetUserId: ownerId,
          newRole: 'developer'
        });
      }).toThrow(/Cannot change the role of the Primary Owner|Apex Authority/);

      // Cannot suspend Primary Owner
      expect(() => {
        AdminService.suspendMember({
          workspaceId: 'ws_cindermarch',
          actorId: ownerId,
          targetUserId: ownerId,
          reason: 'Test suspension attempt'
        });
      }).toThrow(/Primary Owner account cannot be suspended/);

      // Cannot revoke Primary Owner
      expect(() => {
        AdminService.revokeSuperAdmin({
          workspaceId: 'ws_cindermarch',
          actorId: ownerId,
          targetUserId: ownerId,
          passwordConfirmation: ownerPassword
        });
      }).toThrow(/Primary Owner already holds top-level authority|cannot be revoked/);
    });

    it('requires Primary Owner reauthentication to appoint or revoke Super Admins', () => {
      expect(() => {
        AdminService.appointSuperAdmin({
          workspaceId: 'ws_cindermarch',
          actorId: ownerId,
          targetUserId: superAdmin1Id,
          passwordConfirmation: 'WRONG_PASSWORD'
        });
      }).toThrow(/Reauthentication failed/);
    });

    it('prevents Super Admins from appointing or revoking other Super Admins', () => {
      // Appoint SA1
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: superAdmin1Id,
        passwordConfirmation: ownerPassword
      });

      // SA1 tries to appoint SA2
      expect(() => {
        AdminService.appointSuperAdmin({
          workspaceId: 'ws_cindermarch',
          actorId: superAdmin1Id,
          targetUserId: superAdmin2Id,
          passwordConfirmation: 'StandardPass123!'
        });
      }).toThrow(/Only the Primary Owner has authority/);

      // SA1 tries to revoke SA1 or others
      expect(() => {
        AdminService.revokeSuperAdmin({
          workspaceId: 'ws_cindermarch',
          actorId: superAdmin1Id,
          targetUserId: superAdmin1Id,
          passwordConfirmation: 'StandardPass123!'
        });
      }).toThrow(/Only the Primary Owner has authority/);
    });
  });

  // ---------------------------------------------------------------------------
  // C. SIGNUP PROCESS & DEVELOPER DEFAULT ROLE ENFORCEMENT
  // ---------------------------------------------------------------------------
  describe('Signup Process & Mandatory Developer Default Role', () => {
    it('always assigns developer role to newly registered accounts', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'new_engineer',
          displayName: 'New Engineer',
          email: 'engineer@cindermarch.studio',
          password: 'SecurePassword123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.user.roles).toEqual(['developer']);

      // Check database users table
      const user = db.prepare('SELECT roles FROM users WHERE username = ?').get('new_engineer') as any;
      expect(JSON.parse(user.roles)).toEqual(['developer']);
    });

    it('ignores client-supplied role payloads on signup to prevent privilege escalation', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'sneaky_user',
          displayName: 'Sneaky User',
          email: 'sneaky@cindermarch.studio',
          password: 'SecurePassword123!',
          role: 'owner', // Injected privileged role attempt
          roles: ['owner', 'super_admin']
        });

      expect(res.status).toBe(201);
      expect(res.body.user.roles).toEqual(['developer']);

      const user = db.prepare('SELECT roles FROM users WHERE username = ?').get('sneaky_user') as any;
      expect(JSON.parse(user.roles)).toEqual(['developer']);
    });

    it('sets status to pending_approval for uninvited signups, isolating studio workspace data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'uninvited_guest',
          displayName: 'Uninvited Guest',
          email: 'guest@cindermarch.studio',
          password: 'SecurePassword123!'
        });

      expect(res.status).toBe(201);
      const createdUserId = res.body.user.id;

      // Verify membership record has pending_approval status
      const member = db.prepare('SELECT role, status FROM workspace_members WHERE user_id = ?')
        .get(createdUserId) as any;
      expect(member.role).toBe('developer');
      expect(member.status).toBe('pending_approval');

      // Verify accessing protected administration route fails with HTTP 403
      const { sessionToken } = createSession(createdUserId);
      const adminRes = await request(app)
        .get('/api/admin/overview')
        .set('x-session-token', sessionToken);

      expect(adminRes.status).toBe(403);
    });

    it('activates membership immediately when registering with a valid invitation token', async () => {
      // 1. Primary Owner generates invitation
      const inviteToken = 'inv_test_token_valid';
      db.prepare(`
        INSERT INTO workspace_invitations (id, workspace_id, email, invitation_token, role, status, invited_by, created_at, expires_at)
        VALUES ('inv_1', 'ws_cindermarch', 'invited@cindermarch.studio', ?, 'developer', 'pending', ?, datetime('now'), datetime('now', '+14 days'))
      `).run(inviteToken, ownerId);

      // 2. User registers using invitation
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'invited_dev',
          displayName: 'Invited Dev',
          email: 'invited@cindermarch.studio',
          password: 'SecurePassword123!',
          invitationToken: inviteToken
        });

      expect(res.status).toBe(201);
      const member = db.prepare('SELECT role, status FROM workspace_members WHERE user_id = ?')
        .get(res.body.user.id) as any;
      expect(member.role).toBe('developer');
      expect(member.status).toBe('active');

      // Invitation is marked accepted
      const inv = db.prepare('SELECT status FROM workspace_invitations WHERE invitation_token = ?').get(inviteToken) as any;
      expect(inv.status).toBe('accepted');
    });
  });

  // ---------------------------------------------------------------------------
  // D. ACCESS CONTROL & ROUTE AUTHORIZATION
  // ---------------------------------------------------------------------------
  describe('Backend Authorization & Access Control', () => {
    it('denies developers access to the administration portal', async () => {
      const { sessionToken } = createSession(dev1Id);
      const res = await request(app)
        .get('/api/admin/overview')
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Access denied/);
    });

    it('denies team managers from promoting themselves or other members', async () => {
      // Elevate dev1 to team manager
      AdminService.changeMemberRole({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: dev1Id,
        newRole: 'team_manager'
      });

      // dev1 (now Team Manager) tries to change dev2 role
      const { sessionToken } = createSession(dev1Id);
      const res = await request(app)
        .post(`/api/admin/members/${dev2Id}/role`)
        .set('x-session-token', sessionToken)
        .send({ role: 'super_admin' });

      expect(res.status).toBe(403);
    });

    it('permits authorized Super Admins to access admin overview and manage permitted roles', async () => {
      // Appoint SA1
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: superAdmin1Id,
        passwordConfirmation: ownerPassword
      });

      const { sessionToken } = createSession(superAdmin1Id);

      // SA1 accesses admin overview
      const res = await request(app)
        .get('/api/admin/overview')
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.primaryOwner.displayName).toBe('KNG_MG');
      expect(res.body.canManageSuperAdmins).toBe(false); // Only true for Primary Owner!

      // SA1 changes dev2 to team_manager
      const roleRes = await request(app)
        .post(`/api/admin/members/${dev2Id}/role`)
        .set('x-session-token', sessionToken)
        .send({ role: 'team_manager' });

      expect(roleRes.status).toBe(200);
      expect(roleRes.body.newRole).toBe('team_manager');
    });

    it('enforces session revocation and denies access when member is suspended', async () => {
      const { sessionToken } = createSession(dev1Id);

      // Suspend dev1
      AdminService.suspendMember({
        workspaceId: 'ws_cindermarch',
        actorId: ownerId,
        targetUserId: dev1Id,
        reason: 'Policy violation investigation'
      });

      // 1. Old session is revoked immediately upon suspension
      const resOldSession = await request(app)
        .get('/api/admin/members')
        .set('x-session-token', sessionToken);
      expect(resOldSession.status).toBe(401);

      // 2. Even with a newly issued session, suspended member is blocked from protected workspace routes
      const newSession = createSession(dev1Id);
      const resSuspended = await request(app)
        .get('/api/admin/members')
        .set('x-session-token', newSession.sessionToken);
      expect(resSuspended.status).toBe(403);
      expect(resSuspended.body.isSuspended).toBe(true);
    });
  });
});
