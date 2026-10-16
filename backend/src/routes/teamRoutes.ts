import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';

export const teamRouter = Router();

teamRouter.use(authMiddleware);

// GET /api/team or /api/teams: Returns the 6 teams with members & workloads, plus all studio members
teamRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

  // 1. Fetch all teams in this workspace
  const teamsStmt = db.prepare(`
    SELECT 
      t.id,
      t.workspace_id,
      t.name,
      t.slug,
      t.description,
      t.manager_id,
      t.project_id,
      t.discord_channel_id,
      t.created_at,
      t.updated_at,
      u.display_name as manager_name,
      u.username as manager_username,
      u.avatar_url as manager_avatar
    FROM teams t
    LEFT JOIN users u ON t.manager_id = u.id
    WHERE t.workspace_id = ?
    ORDER BY t.name ASC
  `);

  const rawTeams = teamsStmt.all(workspaceId) as any[];

  // For each team, fetch members and computed metrics
  const teams = rawTeams.map((team) => {
    // Members in this team
    const membersStmt = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.email,
        u.roles,
        u.avatar_url,
        tm.role as team_role,
        tm.joined_at,
        (SELECT COUNT(*) FROM tasks WHERE owner_id = u.id AND team_id = ? AND status != 'Verified Complete') as active_tasks_count
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role DESC, u.display_name ASC
    `);

    const members = membersStmt.all(team.id, team.id).map((m: any) => ({
      ...m,
      roles: JSON.parse(m.roles || '[]')
    }));

    // Team task metrics
    const metricsStmt = db.prepare(`
      SELECT
        COUNT(CASE WHEN status != 'Verified Complete' THEN 1 END) as active_tasks_count,
        COUNT(CASE WHEN deadline IS NOT NULL AND deadline >= datetime('now') AND deadline <= datetime('now', '+7 days') AND status != 'Verified Complete' THEN 1 END) as due_soon_count,
        COUNT(CASE WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status != 'Verified Complete' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked_count,
        COUNT(CASE WHEN status = 'Ready for Review' THEN 1 END) as pending_reviews_count,
        COUNT(CASE WHEN status = 'Verified Complete' THEN 1 END) as completed_tasks_count
      FROM tasks
      WHERE team_id = ? AND (workspace_id = ? OR workspace_id IS NULL)
    `);

    const metrics = (metricsStmt.get(team.id, workspaceId) as any) || {
      active_tasks_count: 0,
      due_soon_count: 0,
      overdue_count: 0,
      blocked_count: 0,
      pending_reviews_count: 0,
      completed_tasks_count: 0
    };

    return {
      id: team.id,
      workspaceId: team.workspace_id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      managerId: team.manager_id,
      projectId: team.project_id,
      discordChannelId: team.discord_channel_id,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
      manager: team.manager_id
        ? {
            id: team.manager_id,
            displayName: team.manager_name,
            username: team.manager_username,
            avatarUrl: team.manager_avatar
          }
        : null,
      members,
      memberCount: members.length,
      metrics: {
        activeTasksCount: metrics.active_tasks_count || 0,
        dueSoonCount: metrics.due_soon_count || 0,
        overdueCount: metrics.overdue_count || 0,
        blockedCount: metrics.blocked_count || 0,
        pendingReviewsCount: metrics.pending_reviews_count || 0,
        completedTasksCount: metrics.completed_tasks_count || 0
      }
    };
  });

  // 2. Fetch all members in this studio workspace
  const usersStmt = db.prepare(`
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.email,
      u.roles,
      u.avatar_url,
      u.created_at,
      wm.role as workspace_role,
      COUNT(DISTINCT t.id) as assigned_tasks_count,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN t.status = 'Ready for Review' THEN 1 ELSE 0 END) as awaiting_review_count,
      SUM(CASE WHEN t.status = 'Blocked' THEN 1 ELSE 0 END) as blocked_count,
      SUM(CASE WHEN t.status = 'Verified Complete' THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN t.deadline IS NOT NULL AND t.deadline < datetime('now') AND t.status != 'Verified Complete' THEN 1 ELSE 0 END) as overdue_count,
      (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id AND r.decision = 'Pending') as pending_reviews_count,
      (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id AND r.decision = 'Approved') as approved_reviews_count,
      (SELECT json_group_array(json_object('teamId', tm2.team_id, 'teamName', t2.name, 'role', tm2.role))
       FROM team_members tm2 
       JOIN teams t2 ON tm2.team_id = t2.id 
       WHERE tm2.user_id = u.id) as teams_json
    FROM users u
    JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = ?
    LEFT JOIN tasks t ON t.owner_id = u.id AND (t.workspace_id = ? OR t.workspace_id IS NULL)
    WHERE u.id != 'usr_cindermarch_assistant'
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);

  const users = usersStmt.all(workspaceId, workspaceId).map((u: any) => ({
    ...u,
    roles: JSON.parse(u.roles || '[]'),
    teams: JSON.parse(u.teams_json || '[]')
  }));

  res.json({ teams, users });
});

// POST /api/team/teams: Dynamically add a new team to workspace
teamRouter.post('/teams', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';

  // Authorization check: Owner or Admin only
  const callerRoles = JSON.parse(req.user?.roles || '[]');
  const isOwnerOrAdmin = callerRoles.includes('owner') || callerRoles.includes('admin');
  if (!isOwnerOrAdmin) {
    res.status(403).json({ error: 'Only workspace owners or admins can create new teams.' });
    return;
  }

  const { name, slug, description, managerId, projectId, discordChannelId } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Team name is required.' });
    return;
  }

  const finalSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
  const teamId = `team_${finalSlug.replace(/-/g, '_')}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO teams (id, workspace_id, name, slug, description, manager_id, project_id, discord_channel_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      teamId,
      workspaceId,
      name.trim(),
      finalSlug,
      description?.trim() || '',
      managerId || null,
      projectId || 'terminal-6',
      discordChannelId || null,
      now,
      now
    );

    if (managerId) {
      db.prepare(`
        INSERT INTO team_members (id, team_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'manager', ?)
        ON CONFLICT(team_id, user_id) DO UPDATE SET role = 'manager'
      `).run(`tm_${uuidv4().slice(0, 8)}`, teamId, managerId, now);
    }

    const createdTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    res.status(201).json({ team: createdTeam });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create team. Ensure slug is unique.' });
  }
});

// GET /api/team/:id (handles both team detail and user profile)
teamRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const targetId = req.params.id;

  // Check if targetId is a Team ID or slug
  const team = db.prepare(`
    SELECT t.*, u.display_name as manager_name, u.username as manager_username, u.avatar_url as manager_avatar
    FROM teams t
    LEFT JOIN users u ON t.manager_id = u.id
    WHERE (t.id = ? OR t.slug = ?) AND t.workspace_id = ?
  `).get(targetId, targetId, workspaceId) as any;

  if (team) {
    // 1. Members of this team
    const members = db.prepare(`
      SELECT 
        u.id, u.username, u.display_name, u.email, u.roles, u.avatar_url,
        tm.role as team_role, tm.joined_at,
        (SELECT COUNT(*) FROM tasks WHERE owner_id = u.id AND team_id = ? AND status != 'Verified Complete') as active_tasks_count
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role DESC, u.display_name ASC
    `).all(team.id, team.id).map((m: any) => ({
      ...m,
      roles: JSON.parse(m.roles || '[]')
    }));

    // 2. Filtered tasks for team dashboard
    const allTeamTasks = db.prepare(`
      SELECT t.*, u.display_name as owner_name, u.avatar_url as owner_avatar,
             r.display_name as reviewer_name
      FROM tasks t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN users r ON t.reviewer_id = r.id
      WHERE t.team_id = ? AND (t.workspace_id = ? OR t.workspace_id IS NULL)
      ORDER BY t.priority ASC, t.deadline ASC
    `).all(team.id, workspaceId) as any[];

    const activeTasks = allTeamTasks.filter((t) => t.status !== 'Verified Complete');
    const completedTasks = allTeamTasks.filter((t) => t.status === 'Verified Complete');
    const blockedTasks = allTeamTasks.filter((t) => t.status === 'Blocked');
    const pendingReviews = allTeamTasks.filter((t) => t.status === 'Ready for Review');

    const nowIso = new Date().toISOString();
    const sevenDaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const dueSoonTasks = activeTasks.filter((t) => t.deadline && t.deadline >= nowIso && t.deadline <= sevenDaysIso);
    const overdueTasks = activeTasks.filter((t) => t.deadline && t.deadline < nowIso);

    // 3. Recent team activity
    const recentActivity = db.prepare(`
      SELECT a.*, u.display_name as actor_name, u.avatar_url as actor_avatar, t.title as task_title
      FROM activity_events a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN tasks t ON a.related_task_id = t.id
      WHERE t.team_id = ?
      ORDER BY a.created_at DESC
      LIMIT 25
    `).all(team.id);

    res.json({
      team: {
        id: team.id,
        workspaceId: team.workspace_id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        managerId: team.manager_id,
        projectId: team.project_id,
        discordChannelId: team.discord_channel_id,
        createdAt: team.created_at,
        updatedAt: team.updated_at,
        manager: team.manager_id
          ? {
              id: team.manager_id,
              displayName: team.manager_name,
              username: team.manager_username,
              avatarUrl: team.manager_avatar
            }
          : null,
        members,
        tasks: {
          active: activeTasks,
          dueSoon: dueSoonTasks,
          overdue: overdueTasks,
          blocked: blockedTasks,
          pendingReviews,
          completed: completedTasks
        },
        recentActivity
      }
    });
    return;
  }

  // Otherwise, treat as User ID (user profile view)
  const stmt = db.prepare('SELECT id, username, display_name, email, roles, avatar_url, created_at FROM users WHERE id = ?');
  const user = stmt.get(targetId) as any;

  if (!user) {
    res.status(404).json({ error: `Team or User '${targetId}' not found.` });
    return;
  }

  // Get user's tasks
  const tasksStmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE owner_id = ? AND (workspace_id = ? OR workspace_id IS NULL)
    ORDER BY updated_at DESC
  `);
  const assignedTasks = tasksStmt.all(targetId, workspaceId);

  // Get user's reviews as reviewer
  const reviewStmt = db.prepare(`
    SELECT r.*, t.title as task_title 
    FROM reviews r 
    JOIN tasks t ON r.task_id = t.id 
    WHERE r.reviewer_id = ? 
    ORDER BY r.created_at DESC
  `);
  const conductedReviews = reviewStmt.all(targetId);

  // Get user's recent activity
  const actStmt = db.prepare(`
    SELECT a.*, t.title as task_title 
    FROM activity_events a 
    LEFT JOIN tasks t ON a.related_task_id = t.id 
    WHERE a.actor_id = ? 
    ORDER BY a.created_at DESC 
    LIMIT 20
  `);
  const activities = actStmt.all(targetId);

  // Get user's teams
  const userTeamsStmt = db.prepare(`
    SELECT t.*, tm.role as team_role
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE tm.user_id = ? AND t.workspace_id = ?
  `);
  const teamsList = userTeamsStmt.all(targetId, workspaceId);

  res.json({
    user: {
      ...user,
      roles: JSON.parse(user.roles || '[]'),
      teams: teamsList,
      assignedTasks,
      conductedReviews,
      recentActivities: activities
    }
  });
});

// POST /api/team/:id/members: Add member to team
teamRouter.post('/:id/members', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const teamId = req.params.id;
  const { userId, role } = req.body;

  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  // Check team exists
  const team = db.prepare('SELECT * FROM teams WHERE (id = ? OR slug = ?) AND workspace_id = ?').get(teamId, teamId, workspaceId) as any;
  if (!team) {
    res.status(404).json({ error: `Team '${teamId}' not found.` });
    return;
  }

  // Check user belongs to this workspace
  const userInWs = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
  if (!userInWs) {
    res.status(400).json({ error: 'User is not a member of this workspace.' });
    return;
  }

  // Authorization check: Workspace Owner, Admin, or the Team Manager
  const callerRoles = JSON.parse(req.user?.roles || '[]');
  const isOwnerOrAdmin = callerRoles.includes('owner') || callerRoles.includes('admin');
  const isTeamManager = team.manager_id === req.user?.id;

  if (!isOwnerOrAdmin && !isTeamManager) {
    res.status(403).json({ error: 'Only workspace admins or the team manager can assign team members.' });
    return;
  }

  const teamMemberRole = role === 'manager' ? 'manager' : 'member';
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(team_id, user_id) DO UPDATE SET role = ?
  `).run(`tm_${uuidv4().slice(0, 8)}`, team.id, userId, teamMemberRole, now, teamMemberRole);

  if (teamMemberRole === 'manager') {
    db.prepare('UPDATE teams SET manager_id = ?, updated_at = ? WHERE id = ?').run(userId, now, team.id);
  }

  res.json({ success: true, message: `Member assigned to ${team.name} as ${teamMemberRole}.` });
});

// DELETE /api/team/:id/members/:userId: Remove member from team
teamRouter.delete('/:id/members/:userId', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const teamId = req.params.id;
  const { userId } = req.params;

  const team = db.prepare('SELECT * FROM teams WHERE (id = ? OR slug = ?) AND workspace_id = ?').get(teamId, teamId, workspaceId) as any;
  if (!team) {
    res.status(404).json({ error: `Team '${teamId}' not found.` });
    return;
  }

  const callerRoles = JSON.parse(req.user?.roles || '[]');
  const isOwnerOrAdmin = callerRoles.includes('owner') || callerRoles.includes('admin');
  const isTeamManager = team.manager_id === req.user?.id;

  if (!isOwnerOrAdmin && !isTeamManager && req.user?.id !== userId) {
    res.status(403).json({ error: 'Not authorized to remove members from this team.' });
    return;
  }

  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(team.id, userId);

  if (team.manager_id === userId) {
    db.prepare('UPDATE teams SET manager_id = NULL, updated_at = ? WHERE id = ?').run(new Date().toISOString(), team.id);
  }

  res.json({ success: true, message: `Member removed from ${team.name}.` });
});

// PATCH /api/team/:id: Update team or update user profile
teamRouter.patch('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
  const targetId = req.params.id;

  // Check if team
  const team = db.prepare('SELECT * FROM teams WHERE (id = ? OR slug = ?) AND workspace_id = ?').get(targetId, targetId, workspaceId) as any;
  if (team) {
    const callerRoles = JSON.parse(req.user?.roles || '[]');
    const isOwnerOrAdmin = callerRoles.includes('owner') || callerRoles.includes('admin');
    const isTeamManager = team.manager_id === req.user?.id;

    if (!isOwnerOrAdmin && !isTeamManager) {
      res.status(403).json({ error: 'Not authorized to update this team.' });
      return;
    }

    const { name, description, managerId, discordChannelId } = req.body;
    const now = new Date().toISOString();

    const nextName = name?.trim() || team.name;
    const nextDesc = description !== undefined ? description.trim() : team.description;
    const nextManager = managerId !== undefined ? managerId : team.manager_id;
    const nextChannel = discordChannelId !== undefined ? discordChannelId : team.discord_channel_id;

    db.prepare(`
      UPDATE teams 
      SET name = ?, description = ?, manager_id = ?, discord_channel_id = ?, updated_at = ?
      WHERE id = ?
    `).run(nextName, nextDesc, nextManager, nextChannel, now, team.id);

    if (nextManager) {
      db.prepare(`
        INSERT INTO team_members (id, team_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'manager', ?)
        ON CONFLICT(team_id, user_id) DO UPDATE SET role = 'manager'
      `).run(`tm_${uuidv4().slice(0, 8)}`, team.id, nextManager, now);
    }

    const updated = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);
    res.json({ team: updated });
    return;
  }

  // Otherwise, user profile update
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!user) {
    res.status(404).json({ error: `Team or User '${targetId}' not found.` });
    return;
  }

  const callerRoles = JSON.parse(req.user?.roles || '[]');
  const isOwnerOrAdmin = callerRoles.includes('owner') || callerRoles.includes('admin');
  if (!isOwnerOrAdmin && req.user?.id !== targetId) {
    res.status(403).json({ error: 'Not authorized to update this user.' });
    return;
  }

  const { displayName, roles, avatarUrl } = req.body;
  const now = new Date().toISOString();
  const newDisplayName = displayName?.trim() || user.display_name;
  const newRoles = roles ? JSON.stringify(roles) : user.roles;
  const newAvatarUrl = avatarUrl !== undefined ? avatarUrl : user.avatar_url;

  db.prepare(`
    UPDATE users 
    SET display_name = ?, roles = ?, avatar_url = ?, updated_at = ? 
    WHERE id = ?
  `).run(newDisplayName, newRoles, newAvatarUrl, now, targetId);

  const updated = db.prepare('SELECT id, username, display_name, email, roles, avatar_url FROM users WHERE id = ?').get(targetId) as any;
  res.json({
    user: {
      ...updated,
      roles: JSON.parse(updated.roles || '[]')
    }
  });
});
