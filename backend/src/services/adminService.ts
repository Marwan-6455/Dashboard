import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';
import { UserRole, AdminAuditEntry } from '../types/index.js';
import { invalidateUserSessions } from '../middleware/auth.js';

export interface AdminOverview {
  primaryOwner: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
  superAdmins: Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
    appointedAt: string;
  }>;
  superAdminSlots: {
    max: number;
    maxSlots: number;
    used: number;
    usedSlots: number;
    available: number;
    availableSlots: number;
  };
  counts: {
    totalMembers: number;
    activeMembers: number;
    suspendedMembers: number;
    pendingApprovals: number;
    teamManagers: number;
    teams: number;
    projects: number;
    invitations: number;
  };
  canManageSuperAdmins: boolean; // Only true for Primary Owner
}

export class AdminService {
  /**
   * Log an administrative audit record (immutable)
   */
  static logAudit(params: {
    workspaceId: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    targetName?: string | null;
    details?: any;
    reason?: string | null;
    ipAddress?: string | null;
  }): void {
    const db = getDb();
    const id = `audit_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO admin_audit_log (
        id, workspace_id, actor_id, actor_name, action, target_type, target_id, target_name, details_json, reason, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.workspaceId,
      params.actorId,
      params.actorName,
      params.action,
      params.targetType,
      params.targetId || null,
      params.targetName || null,
      params.details ? JSON.stringify(params.details) : null,
      params.reason || null,
      params.ipAddress || null,
      now
    );
  }

  /**
   * Get workspace Primary Owner and Super Admin status
   */
  static getAdminOverview(workspaceId: string, callerUserId: string): AdminOverview {
    const db = getDb();

    // 1. Fetch workspace record
    const ws = db.prepare(`
      SELECT id, name, owner_id, primary_owner_id, super_admin_limit
      FROM workspaces
      WHERE id = ?
    `).get(workspaceId) as any;

    if (!ws) {
      throw new Error(`Workspace '${workspaceId}' not found.`);
    }

    const primaryOwnerId = ws.primary_owner_id || ws.owner_id;

    // 2. Fetch Primary Owner user record
    const ownerUser = db.prepare(`
      SELECT id, username, display_name, email, avatar_url
      FROM users
      WHERE id = ?
    `).get(primaryOwnerId) as any;

    const primaryOwner = {
      id: ownerUser?.id || primaryOwnerId,
      username: ownerUser?.username || 'KNG_MG',
      displayName: ownerUser?.display_name || 'KNG_MG',
      email: ownerUser?.email || 'marwanhossam20062007@gmail.com',
      avatarUrl: ownerUser?.avatar_url || null
    };

    // 3. Fetch appointed Super Admins (holding super_admin, excluding Primary Owner)
    const superAdminsStmt = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, wm.joined_at as appointed_at
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ? 
        AND wm.role = 'super_admin'
        AND wm.user_id != ?
      ORDER BY wm.joined_at ASC
    `);

    const superAdmins = (superAdminsStmt.all(workspaceId, primaryOwnerId) as any[]).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      avatarUrl: row.avatar_url || null,
      appointedAt: row.appointed_at
    }));

    const maxSlots = 2; // Strict limit: exactly 2 Super Admins alongside the Primary Owner
    const usedSlots = superAdmins.length;
    const availableSlots = Math.max(0, maxSlots - usedSlots);

    // 4. Counts
    const memberCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_suspended = 0 AND (status = 'active' OR status IS NULL) THEN 1 END) as active,
        COUNT(CASE WHEN is_suspended = 1 OR status = 'suspended' THEN 1 END) as suspended,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_approvals,
        COUNT(CASE WHEN role = 'team_manager' THEN 1 END) as managers
      FROM workspace_members
      WHERE workspace_id = ?
    `).get(workspaceId) as any;

    const teamCount = (db.prepare('SELECT COUNT(*) as c FROM teams WHERE workspace_id = ?').get(workspaceId) as any)?.c || 0;
    const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects WHERE (workspace_id = ? OR workspace_id IS NULL)').get(workspaceId) as any)?.c || 0;
    const invCount = (db.prepare("SELECT COUNT(*) as c FROM workspace_invitations WHERE workspace_id = ? AND status = 'pending'").get(workspaceId) as any)?.c || 0;

    return {
      primaryOwner,
      superAdmins,
      superAdminSlots: {
        max: maxSlots,
        maxSlots,
        used: usedSlots,
        usedSlots,
        available: availableSlots,
        availableSlots
      },
      counts: {
        totalMembers: memberCounts?.total || 0,
        activeMembers: memberCounts?.active || 0,
        suspendedMembers: memberCounts?.suspended || 0,
        pendingApprovals: memberCounts?.pending_approvals || 0,
        teamManagers: memberCounts?.managers || 0,
        teams: teamCount,
        projects: projectCount,
        invitations: invCount
      },
      canManageSuperAdmins: callerUserId === primaryOwnerId
    };
  }

  /**
   * Appoint an account to Super Admin (Primary Owner only, strictly capped at 2)
   */
  static appointSuperAdmin(params: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    passwordConfirmation: string;
    reason?: string;
  }): { success: boolean; superAdmin: any } {
    const db = getDb();
    const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(params.workspaceId) as any;
    const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

    // 1. Verify Caller is Primary Owner
    if (params.actorId !== primaryOwnerId) {
      throw new Error('Access denied: Only the Primary Owner has authority to appoint Super Admin accounts.');
    }

    // 2. Reauthenticate Primary Owner
    const actorUser = db.prepare('SELECT password_hash, display_name FROM users WHERE id = ?').get(params.actorId) as any;
    if (!actorUser || !bcrypt.compareSync(params.passwordConfirmation, actorUser.password_hash)) {
      throw new Error('Reauthentication failed: Invalid password confirmation for Primary Owner.');
    }

    // 3. Verify Target User
    if (params.targetUserId === primaryOwnerId) {
      throw new Error('The Primary Owner already holds top-level authority and cannot be appointed as a Super Admin.');
    }

    const targetUser = db.prepare('SELECT id, username, display_name, email, roles FROM users WHERE id = ?').get(params.targetUserId) as any;
    if (!targetUser) {
      throw new Error(`Target user '${params.targetUserId}' not found.`);
    }

    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(params.workspaceId, params.targetUserId) as any;
    if (!member) {
      throw new Error('Target user is not a member of this workspace.');
    }

    if (member.role === 'super_admin') {
      throw new Error(`${targetUser.display_name} is already appointed as a Super Admin.`);
    }

    // 4. Transactionally verify Super Admin slot limit (< 2)
    db.exec('BEGIN IMMEDIATE;');
    try {
      const currentSuperAdminsCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM workspace_members 
        WHERE workspace_id = ? AND role = 'super_admin' AND user_id != ?
      `).get(params.workspaceId, primaryOwnerId) as any)?.count || 0;

      if (currentSuperAdminsCount >= 2) {
        throw new Error('Super Admin limit reached: Exactly two Super Admin accounts can be appointed alongside the Primary Owner (3 total). Revoke an existing Super Admin before appointing a new one.');
      }

      const now = new Date().toISOString();

      // Update workspace_members
      db.prepare(`
        UPDATE workspace_members 
        SET role = 'super_admin', status = 'active', is_suspended = 0 
        WHERE workspace_id = ? AND user_id = ?
      `).run(params.workspaceId, params.targetUserId);

      // Update users roles JSON
      let roles: string[] = [];
      try {
        roles = JSON.parse(targetUser.roles || '[]');
      } catch {}
      if (!roles.includes('super_admin')) roles.unshift('super_admin');
      if (!roles.includes('admin')) roles.push('admin');

      db.prepare('UPDATE users SET roles = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(roles),
        now,
        params.targetUserId
      );

      // Log Audit Event
      this.logAudit({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        actorName: actorUser.display_name,
        action: 'super_admin_appointed',
        targetType: 'user',
        targetId: params.targetUserId,
        targetName: targetUser.display_name,
        details: { appointedSlot: currentSuperAdminsCount + 1, totalSuperAdmins: currentSuperAdminsCount + 1 },
        reason: params.reason || 'Appointed to designated Super Admin role by Primary Owner.'
      });

      db.exec('COMMIT;');

      return {
        success: true,
        superAdmin: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.display_name,
          email: targetUser.email,
          appointedAt: now
        }
      };
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {}
      throw err;
    }
  }

  /**
   * Revoke Super Admin access (Primary Owner only)
   */
  static revokeSuperAdmin(params: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    passwordConfirmation: string;
    reason?: string;
  }): { success: boolean } {
    const db = getDb();
    const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(params.workspaceId) as any;
    const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

    // 1. Verify Caller is Primary Owner
    if (params.actorId !== primaryOwnerId) {
      throw new Error('Access denied: Only the Primary Owner has authority to revoke Super Admin accounts.');
    }

    // 2. Reauthenticate Primary Owner
    const actorUser = db.prepare('SELECT password_hash, display_name FROM users WHERE id = ?').get(params.actorId) as any;
    if (!actorUser || !bcrypt.compareSync(params.passwordConfirmation, actorUser.password_hash)) {
      throw new Error('Reauthentication failed: Invalid password confirmation for Primary Owner.');
    }

    // 3. Prevent revoking Primary Owner
    if (params.targetUserId === primaryOwnerId) {
      throw new Error('The Primary Owner account cannot be revoked or demoted.');
    }

    const targetUser = db.prepare('SELECT id, display_name, roles FROM users WHERE id = ?').get(params.targetUserId) as any;
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(`
        UPDATE workspace_members 
        SET role = 'team_member' 
        WHERE workspace_id = ? AND user_id = ?
      `).run(params.workspaceId, params.targetUserId);

      // Clean roles JSON
      let roles: string[] = [];
      try {
        roles = JSON.parse(targetUser.roles || '[]');
      } catch {}
      roles = roles.filter((r) => r !== 'super_admin' && r !== 'admin' && r !== 'owner');
      if (!roles.includes('developer')) roles.push('developer');

      db.prepare('UPDATE users SET roles = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(roles),
        now,
        params.targetUserId
      );

      this.logAudit({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        actorName: actorUser.display_name,
        action: 'super_admin_revoked',
        targetType: 'user',
        targetId: params.targetUserId,
        targetName: targetUser.display_name,
        reason: params.reason || 'Super Admin privileges revoked by Primary Owner.'
      });

      db.exec('COMMIT;');
      return { success: true };
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {}
      throw err;
    }
  }

  /**
   * Suspend a member's access (Primary Owner or Super Admin)
   * Primary Owner CANNOT be suspended.
   */
  static suspendMember(params: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    reason: string;
  }): { success: boolean } {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('A documented reason is required to suspend a member.');
    }

    const db = getDb();
    const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(params.workspaceId) as any;
    const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

    if (params.targetUserId === primaryOwnerId) {
      throw new Error('The Primary Owner account cannot be suspended.');
    }

    const actorMember = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(params.workspaceId, params.actorId) as any;
    const actorUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.actorId) as any;
    const targetUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.targetUserId) as any;

    const isAuthorized = params.actorId === primaryOwnerId || actorMember?.role === 'super_admin' || actorMember?.role === 'owner';
    if (!isAuthorized) {
      throw new Error('Access denied: Only the Primary Owner or Super Admins can suspend members.');
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE workspace_members
      SET is_suspended = 1, status = 'suspended', suspended_at = ?, suspension_reason = ?
      WHERE workspace_id = ? AND user_id = ?
    `).run(now, params.reason.trim(), params.workspaceId, params.targetUserId);

    // Invalidate user's active sessions immediately
    try {
      invalidateUserSessions(params.targetUserId);
    } catch {}

    this.logAudit({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: actorUser?.display_name || 'Admin',
      action: 'member_suspended',
      targetType: 'user',
      targetId: params.targetUserId,
      targetName: targetUser?.display_name || params.targetUserId,
      reason: params.reason.trim()
    });

    return { success: true };
  }

  /**
   * Reinstate a suspended member (Primary Owner or Super Admin)
   */
  static reinstateMember(params: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    reason: string;
  }): { success: boolean } {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('A documented reason is required to reinstate a suspended member.');
    }

    const db = getDb();
    const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(params.workspaceId) as any;
    const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

    const actorMember = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(params.workspaceId, params.actorId) as any;
    const actorUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.actorId) as any;
    const targetUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.targetUserId) as any;

    const isAuthorized = params.actorId === primaryOwnerId || actorMember?.role === 'super_admin' || actorMember?.role === 'owner';
    if (!isAuthorized) {
      throw new Error('Access denied: Only the Primary Owner or Super Admins can reinstate members.');
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE workspace_members
      SET is_suspended = 0, status = 'active', reinstated_at = ?, reinstated_by = ?, reinstatement_reason = ?
      WHERE workspace_id = ? AND user_id = ?
    `).run(now, params.actorId, params.reason.trim(), params.workspaceId, params.targetUserId);

    this.logAudit({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: actorUser?.display_name || 'Admin',
      action: 'member_reinstated',
      targetType: 'user',
      targetId: params.targetUserId,
      targetName: targetUser?.display_name || params.targetUserId,
      reason: params.reason.trim()
    });

    return { success: true };
  }

  /**
   * Reassign a member's incomplete tasks to a new owner
   */
  static reassignTasks(params: {
    workspaceId: string;
    actorId: string;
    fromUserId: string;
    toUserId: string;
    reason?: string;
  }): { success: boolean; reassignedCount: number } {
    const db = getDb();
    const actorUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.actorId) as any;
    const fromUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.fromUserId) as any;
    const toUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.toUserId) as any;

    if (!toUser) {
      throw new Error('Target new owner not found.');
    }

    const now = new Date().toISOString();
    const info = db.prepare(`
      UPDATE tasks
      SET owner_id = ?, updated_at = ?
      WHERE owner_id = ? 
        AND (workspace_id = ? OR workspace_id IS NULL)
        AND status != 'Verified Complete'
    `).run(params.toUserId, now, params.fromUserId, params.workspaceId);

    const count = Number(info.changes);

    this.logAudit({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: actorUser?.display_name || 'Admin',
      action: 'tasks_reassigned',
      targetType: 'tasks',
      targetId: params.fromUserId,
      targetName: `From ${fromUser?.display_name || params.fromUserId} to ${toUser.display_name}`,
      details: { taskCount: count, fromUserId: params.fromUserId, toUserId: params.toUserId },
      reason: params.reason || `Workload reassignment of ${count} task(s).`
    });

    return { success: true, reassignedCount: count };
  }

  /**
   * Change member permitted role (Team Manager / Developer / Team Member / Reviewer)
   */
  static changeMemberRole(params: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    newRole: UserRole;
  }): { success: boolean; previousRole: string; newRole: string } {
    const db = getDb();
    const ws = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(params.workspaceId) as any;
    const primaryOwnerId = ws?.primary_owner_id || ws?.owner_id;

    // 1. Verify caller authorization
    const actorMember = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(params.workspaceId, params.actorId) as any;
    const isAuthorized = params.actorId === primaryOwnerId || actorMember?.role === 'owner' || actorMember?.role === 'super_admin' || actorMember?.role === 'admin';
    if (!isAuthorized) {
      throw new Error('Access denied: You do not have authority to change member roles.');
    }

    // 2. Irrevocable Apex Authority protection
    if (params.targetUserId === primaryOwnerId) {
      throw new Error('The Irrevocable Apex Authority account cannot be demoted, suspended, or modified.');
    }

    // 3. Super Admin & Owner elevations must use dedicated governance workflow
    if (params.newRole === 'super_admin' || params.newRole === 'owner') {
      throw new Error("Super Admin or Primary Owner promotions must be executed through the dedicated 'Appoint Super Admin' governance procedure.");
    }

    // 4. Fetch target member and protect Super Admins from routine role changes
    const currentMember = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(params.workspaceId, params.targetUserId) as any;
    if (!currentMember) {
      throw new Error(`Member '${params.targetUserId}' not found in workspace.`);
    }

    const previousRole = currentMember.role;
    if (previousRole === 'super_admin') {
      throw new Error("Super Admin accounts can only be revoked by the Primary Owner through the dedicated Super Admin Governance portal.");
    }

    const actorUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.actorId) as any;
    const targetUser = db.prepare('SELECT display_name, roles FROM users WHERE id = ?').get(params.targetUserId) as any;

    // 5. Update workspace_members
    db.prepare(`
      UPDATE workspace_members
      SET role = ?
      WHERE workspace_id = ? AND user_id = ?
    `).run(params.newRole, params.workspaceId, params.targetUserId);

    // 6. Update users.roles JSON array
    let roles: string[] = [];
    try {
      roles = JSON.parse(targetUser.roles || '[]');
    } catch {}
    roles = roles.filter((r) => r !== 'super_admin' && r !== 'owner' && r !== 'admin' && r !== 'team_manager' && r !== 'team_member' && r !== 'developer' && r !== 'reviewer');
    roles.unshift(params.newRole);

    db.prepare('UPDATE users SET roles = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(roles),
      new Date().toISOString(),
      params.targetUserId
    );

    // 7. Audit log with previous and new role values
    this.logAudit({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: actorUser?.display_name || 'Admin',
      action: 'role_changed',
      targetType: 'user',
      targetId: params.targetUserId,
      targetName: targetUser?.display_name || params.targetUserId,
      details: { previousRole, newRole: params.newRole },
      reason: `Workspace role changed from ${previousRole} to ${params.newRole}.`
    });

    return { success: true, previousRole, newRole: params.newRole };
  }

  /**
   * Approve a pending workspace registration
   */
  static approveMembership(params: {
    workspaceId: string;
    actorId: string;
    userId: string;
    role?: UserRole;
    teamId?: string;
  }): { success: boolean } {
    const db = getDb();
    const actorUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.actorId) as any;
    const targetUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.userId) as any;
    const assignedRole = params.role || 'team_member';
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE workspace_members
      SET status = 'active', role = ?
      WHERE workspace_id = ? AND user_id = ?
    `).run(assignedRole, params.workspaceId, params.userId);

    if (params.teamId) {
      db.prepare(`
        INSERT INTO team_members (id, team_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'member', ?)
        ON CONFLICT(team_id, user_id) DO NOTHING
      `).run(`tm_${uuidv4().slice(0, 8)}`, params.teamId, params.userId, now);
    }

    this.logAudit({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: actorUser?.display_name || 'Admin',
      action: 'membership_approved',
      targetType: 'user',
      targetId: params.userId,
      targetName: targetUser?.display_name || params.userId,
      details: { assignedRole, teamId: params.teamId }
    });

    return { success: true };
  }

  /**
   * Reject a pending workspace registration
   */
  static rejectMembership(params: {
    workspaceId: string;
    actorId: string;
    userId: string;
    reason?: string;
  }): { success: boolean } {
    const db = getDb();
    const actorUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.actorId) as any;
    const targetUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(params.userId) as any;

    db.prepare(`
      UPDATE workspace_members
      SET status = 'rejected'
      WHERE workspace_id = ? AND user_id = ?
    `).run(params.workspaceId, params.userId);

    this.logAudit({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorName: actorUser?.display_name || 'Admin',
      action: 'membership_rejected',
      targetType: 'user',
      targetId: params.userId,
      targetName: targetUser?.display_name || params.userId,
      reason: params.reason || 'Membership request rejected.'
    });

    return { success: true };
  }

  /**
   * Fetch immutable Admin Audit Log records
   */
  static getAuditLog(params: {
    workspaceId: string;
    limit?: number;
    offset?: number;
    action?: string;
    search?: string;
  }): { auditEvents: AdminAuditEntry[]; total: number } {
    const db = getDb();
    const limit = Math.min(params.limit || 50, 100);
    const offset = params.offset || 0;

    let whereClause = 'WHERE workspace_id = ?';
    const queryParams: any[] = [params.workspaceId];

    if (params.action && params.action.trim()) {
      whereClause += ' AND action = ?';
      queryParams.push(params.action.trim());
    }

    if (params.search && params.search.trim()) {
      whereClause += ' AND (actor_name LIKE ? OR target_name LIKE ? OR reason LIKE ? OR action LIKE ?)';
      const s = `%${params.search.trim()}%`;
      queryParams.push(s, s, s, s);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as c FROM admin_audit_log ${whereClause}`);
    const total = (countStmt.get(...queryParams) as any)?.c || 0;

    const listStmt = db.prepare(`
      SELECT * FROM admin_audit_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const auditEvents = listStmt.all(...queryParams, limit, offset) as AdminAuditEntry[];
    return { auditEvents, events: auditEvents, total };
  }
}
