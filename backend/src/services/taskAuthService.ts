import { getDb } from '../db/connection.js';

export interface TaskPermissions {
  userId: string;
  isApexOwner: boolean;
  isSuperAdmin: boolean;
  isTeamManager: boolean;
  isDeveloper: boolean;
  canManageAll: boolean;
  managedTeamIds: string[];
  managedProjectIds: string[];
}

export class TaskAuthService {
  /**
   * Resolve authoritative task permissions for a user in a workspace
   */
  static getPermissions(userId: string, workspaceId = 'ws_cindermarch', db = getDb()): TaskPermissions {
    const member = db.prepare(`
      SELECT role, status, is_suspended 
      FROM workspace_members 
      WHERE workspace_id = ? AND user_id = ?
    `).get(workspaceId, userId) as { role: string; status: string; is_suspended: number } | undefined;

    const userRow = db.prepare('SELECT roles FROM users WHERE id = ?').get(userId) as { roles: string } | undefined;
    let roles: string[] = [];
    if (userRow?.roles) {
      try {
        roles = JSON.parse(userRow.roles);
      } catch {}
    }

    const wsRow = db.prepare('SELECT owner_id, primary_owner_id FROM workspaces WHERE id = ?').get(workspaceId) as any;
    const isPrimaryOwner = wsRow?.primary_owner_id === userId || wsRow?.owner_id === userId;

    const isApexOwner = isPrimaryOwner || member?.role === 'owner' || roles.includes('owner');
    const isSuperAdmin = !isApexOwner && (member?.role === 'super_admin' || member?.role === 'admin' || roles.includes('super_admin') || roles.includes('admin'));
    const isTeamManager = !isApexOwner && !isSuperAdmin && (member?.role === 'team_manager' || roles.includes('team_manager'));
    const isDeveloper = !isApexOwner && !isSuperAdmin && !isTeamManager;

    const canManageAll = isApexOwner || isSuperAdmin;

    let managedTeamIds: string[] = [];
    let managedProjectIds: string[] = [];

    if (canManageAll) {
      const allTeams = db.prepare('SELECT id, project_id FROM teams WHERE workspace_id = ?').all(workspaceId) as any[];
      managedTeamIds = allTeams.map((t) => t.id);
      managedProjectIds = Array.from(new Set(allTeams.map((t) => t.project_id).filter(Boolean)));
    } else if (isTeamManager) {
      // Find teams where user is manager in teams table OR has role='manager' in team_members
      const explicitManagedTeams = db.prepare(`
        SELECT t.id, t.project_id
        FROM teams t
        WHERE t.workspace_id = ? 
          AND (
            t.manager_id = ? 
            OR t.id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ? AND tm.role = 'manager')
          )
      `).all(workspaceId, userId, userId) as any[];

      const workspaceProjects = db.prepare('SELECT id FROM projects WHERE workspace_id = ? OR workspace_id IS NULL').all(workspaceId) as any[];
      const validProjectIds = workspaceProjects.map((p) => p.id);

      if (explicitManagedTeams.length > 0) {
        managedTeamIds = explicitManagedTeams.map((t) => t.id);
        managedProjectIds = validProjectIds;
      } else {
        // Check if member belongs to any team
        const memberTeams = db.prepare(`
          SELECT t.id, t.project_id
          FROM teams t
          JOIN team_members tm ON t.id = tm.team_id
          WHERE t.workspace_id = ? AND tm.user_id = ?
        `).all(workspaceId, userId) as any[];

        if (memberTeams.length > 0) {
          managedTeamIds = memberTeams.map((t) => t.id);
          managedProjectIds = validProjectIds;
        } else {
          // If appointed workspace team_manager without team rows yet, they have general team management in workspace
          const allTeams = db.prepare('SELECT id, project_id FROM teams WHERE workspace_id = ?').all(workspaceId) as any[];
          managedTeamIds = allTeams.map((t) => t.id);
          managedProjectIds = validProjectIds;
        }
      }
    }

    return {
      userId,
      isApexOwner,
      isSuperAdmin,
      isTeamManager,
      isDeveloper,
      canManageAll,
      managedTeamIds,
      managedProjectIds
    };
  }

  /**
   * Verify whether actor can create a task
   */
  static verifyCanCreateTask(
    actorId: string,
    taskData: { teamId?: string | null; projectId?: string | null; workspaceId?: string | null; ownerId?: string | null },
    db = getDb()
  ): { allowed: boolean; statusCode?: number; error?: string } {
    const wsId = taskData.workspaceId || 'ws_cindermarch';
    const perms = this.getPermissions(actorId, wsId, db);

    if (perms.isDeveloper) {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Access denied: Developers are not permitted to create tasks. Only Team Managers and Studio Administrators can create tasks.'
      };
    }

    if (perms.canManageAll) {
      return { allowed: true };
    }

    if (perms.isTeamManager) {
      // Check team scope
      if (taskData.teamId && perms.managedTeamIds.length > 0 && !perms.managedTeamIds.includes(taskData.teamId)) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: You are not authorized to create tasks for a team you do not manage.'
        };
      }

      // Check project scope
      if (taskData.projectId && perms.managedProjectIds.length > 0 && !perms.managedProjectIds.includes(taskData.projectId)) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: You are not authorized to create tasks for a project outside your managed scope.'
        };
      }

      return { allowed: true };
    }

    return {
      allowed: false,
      statusCode: 403,
      error: 'Access denied: Insufficient permissions to create tasks.'
    };
  }

  /**
   * Verify whether actor can edit a task definition, priority, deadline, or assignment
   */
  static verifyCanEditTask(
    actorId: string,
    existingTask: any,
    updates: any,
    db = getDb()
  ): { allowed: boolean; statusCode?: number; error?: string } {
    const wsId = existingTask.workspace_id || 'ws_cindermarch';
    const perms = this.getPermissions(actorId, wsId, db);

    const protectedDefinitionFields = [
      'title',
      'description',
      'projectId',
      'workspaceId',
      'teamId',
      'category',
      'priority',
      'deadline',
      'reviewerId',
      'estimatedEffort',
      'isChangesetExempt',
      'changesetExemptionReason',
      'isTestExempt',
      'testExemptionReason',
      'isDeadlineExempt',
      'deadlineExemptionReason',
      'extendedDeadline',
      'deadlineExtensionReason'
    ];

    if (perms.isDeveloper) {
      // 1. Prevent self-assignment or reassignment attempts
      if (updates.ownerId !== undefined) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: Developers cannot assign or reassign tasks.'
        };
      }

      // 2. Prevent task definition edits
      const attemptedProtected = protectedDefinitionFields.filter((f) => updates[f] !== undefined);
      if (attemptedProtected.length > 0) {
        return {
          allowed: false,
          statusCode: 403,
          error: `Access denied: Developers are not permitted to edit task definitions, priority, deadlines, or assignments (${attemptedProtected.join(', ')}).`
        };
      }

      // 3. Permitted progress fields: actualEffort, tags
      // Verify assigned developer or designated reviewer
      if (existingTask.owner_id !== actorId && existingTask.reviewer_id !== actorId) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: You are not assigned to this task.'
        };
      }

      return { allowed: true };
    }

    if (perms.canManageAll) {
      return { allowed: true };
    }

    if (perms.isTeamManager) {
      // Must manage the task's current team (if task is associated with a team)
      if (existingTask.team_id && perms.managedTeamIds.length > 0 && !perms.managedTeamIds.includes(existingTask.team_id)) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: You are not authorized to manage tasks for this team.'
        };
      }

      // If moving to a new team, must manage target team
      if (updates.teamId && perms.managedTeamIds.length > 0 && !perms.managedTeamIds.includes(updates.teamId)) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: You cannot reassign a task to a team you do not manage.'
        };
      }

      // Must manage task's project
      if (existingTask.project_id && perms.managedProjectIds.length > 0 && !perms.managedProjectIds.includes(existingTask.project_id)) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'Access denied: You are not authorized to manage tasks for this project.'
        };
      }

      return { allowed: true };
    }

    return {
      allowed: false,
      statusCode: 403,
      error: 'Access denied: Insufficient permissions to edit task.'
    };
  }

  /**
   * Verify whether actor can delete a task
   */
  static verifyCanDeleteTask(
    actorId: string,
    existingTask: any,
    db = getDb()
  ): { allowed: boolean; statusCode?: number; error?: string } {
    const wsId = existingTask.workspace_id || 'ws_cindermarch';
    const perms = this.getPermissions(actorId, wsId, db);

    if (perms.isDeveloper) {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Access denied: Developers are not permitted to delete or archive tasks.'
      };
    }

    if (perms.canManageAll) {
      return { allowed: true };
    }

    if (perms.isTeamManager) {
      if (existingTask.team_id && perms.managedTeamIds.length > 0 && perms.managedTeamIds.includes(existingTask.team_id)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        statusCode: 403,
        error: 'Access denied: You are not authorized to delete tasks for this team.'
      };
    }

    return {
      allowed: false,
      statusCode: 403,
      error: 'Access denied: Insufficient permissions to delete task.'
    };
  }
}
