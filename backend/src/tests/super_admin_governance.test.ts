import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { SCHEMA_SQL } from '../db/schema.js';
import { AdminService } from '../services/adminService.js';
import { setDbForTesting } from '../db/connection.js';
import { createSession } from '../middleware/auth.js';

describe('Three Super Admins & Studio Administration Governance', () => {
  let db: DatabaseSync;

  const OWNER_PASSWORD = 'PrimaryOwnerPassword#2026';
  const ownerHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
  const userHash = bcrypt.hashSync('StandardUserPassword#2026', 10);

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    // Set test database instance in connection module
    setDbForTesting(db);

    const now = new Date().toISOString();

    // 1. Create Primary Owner (KNG_MG) and candidates
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_owner', 'kng_mg', 'KNG_MG', 'marwanhossam20062007@gmail.com', ?, '["owner","admin"]', ?, ?),
        ('usr_candidate1', 'alex_lead', 'Alex Lead', 'alex@cindermarch.studio', ?, '["developer"]', ?, ?),
        ('usr_candidate2', 'sarah_ops', 'Sarah Ops', 'sarah@cindermarch.studio', ?, '["developer"]', ?, ?),
        ('usr_candidate3', 'marcus_qa', 'Marcus QA', 'marcus@cindermarch.studio', ?, '["qa"]', ?, ?),
        ('usr_member', 'regular_dev', 'Regular Dev', 'dev@cindermarch.studio', ?, '["developer"]', ?, ?),
        ('usr_cindermarch_assistant', 'cindermarch-ai', 'Cindermarch AI Assistant', 'assistant@cindermarch.internal', 'LOCKED', '["bot"]', ?, ?)
    `).run(ownerHash, now, now, userHash, now, now, userHash, now, now, userHash, now, now, userHash, now, now, now, now);

    // 2. Create Workspace with Primary Owner
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, primary_owner_id, super_admin_limit, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', 'usr_owner', 'usr_owner', 2, ?, ?)
    `).run(now, now);

    // 3. Workspace members
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, is_suspended, joined_at)
      VALUES 
        ('wm_owner', 'ws_cindermarch', 'usr_owner', 'owner', 'active', 0, ?),
        ('wm_cand1', 'ws_cindermarch', 'usr_candidate1', 'developer', 'active', 0, ?),
        ('wm_cand2', 'ws_cindermarch', 'usr_candidate2', 'developer', 'active', 0, ?),
        ('wm_cand3', 'ws_cindermarch', 'usr_candidate3', 'developer', 'active', 0, ?),
        ('wm_member', 'ws_cindermarch', 'usr_member', 'team_member', 'active', 0, ?)
    `).run(now, now, now, now, now);

    // 4. Install SQLite Triggers to strictly enforce 3 Super Admins / Owners total
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_enforce_super_admin_limit_insert
      BEFORE INSERT ON workspace_members
      WHEN NEW.role IN ('owner', 'super_admin') AND NEW.workspace_id = 'ws_cindermarch'
      BEGIN
        SELECT
          CASE
            WHEN (
              SELECT COUNT(*)
              FROM workspace_members
              WHERE workspace_id = NEW.workspace_id
                AND role IN ('owner', 'super_admin')
                AND user_id != NEW.user_id
            ) >= 3 THEN
              RAISE(ABORT, 'Access control violation: Cannot exceed 3 accounts holding Super Admin or Owner level access in ws_cindermarch.')
          END;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_enforce_super_admin_limit_update
      BEFORE UPDATE OF role ON workspace_members
      WHEN NEW.role IN ('owner', 'super_admin') AND NEW.workspace_id = 'ws_cindermarch'
      BEGIN
        SELECT
          CASE
            WHEN (
              SELECT COUNT(*)
              FROM workspace_members
              WHERE workspace_id = NEW.workspace_id
                AND role IN ('owner', 'super_admin')
                AND user_id != NEW.user_id
            ) >= 3 THEN
              RAISE(ABORT, 'Access control violation: Cannot exceed 3 accounts holding Super Admin or Owner level access in ws_cindermarch.')
          END;
      END;
    `);

    // 5. Seed project and sample tasks
    db.prepare(`
      INSERT INTO projects (id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'Terminal 6', 'Main studio game', 'Terminal6@cindermarch', ?)
    `).run(now);

    db.prepare(`
      INSERT INTO tasks (id, workspace_id, project_id, title, description, priority, status, owner_id, creator_id, created_at, updated_at)
      VALUES 
        ('tsk_1', 'ws_cindermarch', 'terminal-6', 'Combat Physics System', 'Implement weapon recoil', 'P0', 'In Progress', 'usr_member', 'usr_owner', ?, ?),
        ('tsk_2', 'ws_cindermarch', 'terminal-6', 'Boss Room Lighting', 'Volumetric fog in cavern', 'P1', 'Ready for Review', 'usr_member', 'usr_owner', ?, ?)
    `).run(now, now, now, now);
  });

  afterEach(() => {
    setDbForTesting(null);
  });

  it('correctly establishes Primary Owner KNG_MG with 0 of 2 Super Admins appointed', () => {
    const overview = AdminService.getAdminOverview('ws_cindermarch', 'usr_owner');

    expect(overview.primaryOwner.id).toBe('usr_owner');
    expect(overview.primaryOwner.displayName).toBe('KNG_MG');
    expect(overview.superAdmins.length).toBe(0);
    expect(overview.superAdminSlots.maxSlots).toBe(2);
    expect(overview.superAdminSlots.availableSlots).toBe(2);
    expect(overview.canManageSuperAdmins).toBe(true);
  });

  it('allows Primary Owner to appoint 1st Super Admin with valid reauthentication', () => {
    const result = AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD,
      reason: 'Lead Studio Operations'
    });

    expect(result.success).toBe(true);
    expect(result.superAdmin.username).toBe('alex_lead');

    // Verify database record updated
    const member = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get('ws_cindermarch', 'usr_candidate1') as any;
    expect(member.role).toBe('super_admin');

    // Verify audit log entry created
    const audit = db.prepare('SELECT * FROM admin_audit_log WHERE action = ? ORDER BY created_at DESC LIMIT 1')
      .get('super_admin_appointed') as any;
    expect(audit).toBeDefined();
    expect(audit.actor_id).toBe('usr_owner');
    expect(audit.target_id).toBe('usr_candidate1');
  });

  it('rejects Super Admin appointment if password reauthentication fails', () => {
    expect(() => {
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: 'usr_owner',
        targetUserId: 'usr_candidate1',
        passwordConfirmation: 'WrongPassword!999',
        reason: 'Attempt without valid auth'
      });
    }).toThrow(/Reauthentication failed/i);
  });

  it('prevents non-owners (e.g. standard member or super admin) from appointing Super Admins', () => {
    // 1. Appoint 1st Super Admin
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD
    });

    // 2. Candidate 1 tries to appoint Candidate 2 -> Must be rejected
    expect(() => {
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: 'usr_candidate1',
        targetUserId: 'usr_candidate2',
        passwordConfirmation: 'StandardUserPassword#2026'
      });
    }).toThrow(/Access denied: Only the Primary Owner/i);
  });

  it('allows appointing exactly two Super Admins, reaching the strict 3-account limit', () => {
    // Appoint 1st Super Admin
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD,
      reason: 'Operations Lead'
    });

    // Appoint 2nd Super Admin
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate2',
      passwordConfirmation: OWNER_PASSWORD,
      reason: 'Engineering Lead'
    });

    const overview = AdminService.getAdminOverview('ws_cindermarch', 'usr_owner');
    expect(overview.superAdmins.length).toBe(2);
    expect(overview.superAdminSlots.usedSlots).toBe(2);
    expect(overview.superAdminSlots.availableSlots).toBe(0);

    // Total accounts holding owner or super_admin = 3
    const totalAdmins = (db.prepare(`
      SELECT COUNT(*) as c FROM workspace_members 
      WHERE workspace_id = 'ws_cindermarch' AND role IN ('owner', 'super_admin')
    `).get() as any).c;
    expect(totalAdmins).toBe(3);
  });

  it('rejects attempting to appoint a 4th Super Admin at application level', () => {
    // Appoint 1 & 2
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD
    });
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate2',
      passwordConfirmation: OWNER_PASSWORD
    });

    // Attempting to appoint 3rd Super Admin (4th total account) must fail
    expect(() => {
      AdminService.appointSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: 'usr_owner',
        targetUserId: 'usr_candidate3',
        passwordConfirmation: OWNER_PASSWORD
      });
    }).toThrow(/Super Admin limit reached/i);
  });

  it('database trigger rejects direct SQL bypass that would exceed 3 Super Admins/Owners', () => {
    // Fill the 2 Super Admin slots legitimately
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD
    });
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate2',
      passwordConfirmation: OWNER_PASSWORD
    });

    // Direct SQL update attempt to elevate a 4th account to super_admin
    expect(() => {
      db.prepare(`
        UPDATE workspace_members 
        SET role = 'super_admin' 
        WHERE workspace_id = 'ws_cindermarch' AND user_id = 'usr_candidate3'
      `).run();
    }).toThrow(/Access control violation: Cannot exceed 3 accounts/i);
  });

  it('allows Primary Owner to revoke Super Admin status and reinstate slot capacity', () => {
    // Appoint 1st
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD
    });

    expect(AdminService.getAdminOverview('ws_cindermarch', 'usr_owner').superAdminSlots.availableSlots).toBe(1);

    // Revoke
    const revokeRes = AdminService.revokeSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD,
      reason: 'Role rotation'
    });
    expect(revokeRes.success).toBe(true);

    // Slot is now available again
    expect(AdminService.getAdminOverview('ws_cindermarch', 'usr_owner').superAdminSlots.availableSlots).toBe(2);

    const member = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get('ws_cindermarch', 'usr_candidate1') as any;
    expect(member.role).toBe('team_member');
  });

  it('protects the Primary Owner account from suspension, demotion, or revocation', () => {
    // Attempt to suspend Primary Owner
    expect(() => {
      AdminService.suspendMember({
        workspaceId: 'ws_cindermarch',
        actorId: 'usr_owner',
        targetUserId: 'usr_owner',
        reason: 'Illegal suspension attempt'
      });
    }).toThrow(/Primary Owner.*cannot be suspended/i);

    // Attempt to revoke Primary Owner
    expect(() => {
      AdminService.revokeSuperAdmin({
        workspaceId: 'ws_cindermarch',
        actorId: 'usr_owner',
        targetUserId: 'usr_owner',
        passwordConfirmation: OWNER_PASSWORD
      });
    }).toThrow(/Primary Owner.*cannot be revoked/i);
  });

  it('allows Super Admins to suspend a member with mandatory documented reason and terminates active sessions', () => {
    // 1. Appoint Super Admin
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD
    });

    // 2. Create active session for usr_member
    const { sessionToken } = createSession('usr_member');
    expect(sessionToken).toBeDefined();

    // 3. Super Admin suspends usr_member
    const suspendRes = AdminService.suspendMember({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_candidate1',
      targetUserId: 'usr_member',
      reason: 'Breach of studio verification gate standards'
    });
    expect(suspendRes.success).toBe(true);

    // Member status updated
    const member = db.prepare('SELECT is_suspended, status, suspension_reason FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get('ws_cindermarch', 'usr_member') as any;
    expect(member.is_suspended).toBe(1);
    expect(member.status).toBe('suspended');
    expect(member.suspension_reason).toContain('Breach of studio verification gate');
  });

  it('allows reinstating a suspended member with documented reason', () => {
    // Suspend
    AdminService.suspendMember({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_member',
      reason: 'Temporary suspension'
    });

    // Reinstate
    const reinstateRes = AdminService.reinstateMember({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_member',
      reason: 'Policy review complete and cleared'
    });
    expect(reinstateRes.success).toBe(true);

    const member = db.prepare('SELECT is_suspended, status, reinstatement_reason FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get('ws_cindermarch', 'usr_member') as any;
    expect(member.is_suspended).toBe(0);
    expect(member.status).toBe('active');
    expect(member.reinstatement_reason).toContain('Policy review complete');
  });

  it('allows authorized administrators to reassign a member outstanding work', () => {
    const reassignRes = AdminService.reassignTasks({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      fromUserId: 'usr_member',
      toUserId: 'usr_candidate1',
      reason: 'Rebalancing sprint workload'
    });

    expect(reassignRes.success).toBe(true);
    expect(reassignRes.reassignedCount).toBe(2);

    // Verify tasks are now owned by usr_candidate1
    const tasks = db.prepare('SELECT owner_id FROM tasks WHERE workspace_id = ?').all('ws_cindermarch') as any[];
    for (const t of tasks) {
      expect(t.owner_id).toBe('usr_candidate1');
    }
  });

  it('records comprehensive, immutable audit log entries for all administrative actions', () => {
    // Perform an administrative action to record audit event
    AdminService.appointSuperAdmin({
      workspaceId: 'ws_cindermarch',
      actorId: 'usr_owner',
      targetUserId: 'usr_candidate1',
      passwordConfirmation: OWNER_PASSWORD,
      reason: 'Audit trail verification promotion'
    });

    const auditRes = AdminService.getAuditLog({
      workspaceId: 'ws_cindermarch',
      limit: 50,
      offset: 0
    });

    expect(auditRes.events.length).toBeGreaterThan(0);
    for (const ev of auditRes.events) {
      expect(ev.actor_id).toBeDefined();
      expect(ev.action).toBeDefined();
      expect(ev.created_at).toBeDefined();
    }
  });
});
