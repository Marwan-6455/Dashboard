import { getDb } from '../db/connection.js';
import { Project, Milestone, Sprint } from '../types/index.js';

export class ProjectService {
  static getAllProjects(workspaceId = 'ws_cindermarch'): Project[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM projects 
      WHERE (workspace_id = ? OR workspace_id IS NULL)
        AND (status = 'active' OR status IS NULL)
        AND status != 'archived'
      ORDER BY name ASC
    `).all(workspaceId) as unknown as Project[];
    return rows;
  }

  static getProjectById(id: string): Project | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as unknown as Project | undefined;
    return row || null;
  }

  static createProject(data: Partial<Project> & { id: string; name: string; description: string; repository_id: string }): Project {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO projects (
        id, workspace_id, name, description, repository_id, status, owner_id, unity_version, target_platforms_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.workspace_id || 'ws_cindermarch',
      data.name,
      data.description,
      data.repository_id,
      data.status || 'active',
      data.owner_id || null,
      data.unity_version || '6000.0.25f1',
      data.target_platforms_json || JSON.stringify(['PC/Steam']),
      now
    );
    return this.getProjectById(data.id)!;
  }

  static updateProject(id: string, updates: Partial<Project>): Project | null {
    const db = getDb();
    const existing = this.getProjectById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        repository_id = COALESCE(?, repository_id),
        status = COALESCE(?, status),
        owner_id = COALESCE(?, owner_id),
        unity_version = COALESCE(?, unity_version),
        target_platforms_json = COALESCE(?, target_platforms_json)
      WHERE id = ?
    `).run(
      updates.name ?? null,
      updates.description ?? null,
      updates.repository_id ?? null,
      updates.status ?? null,
      updates.owner_id ?? null,
      updates.unity_version ?? null,
      updates.target_platforms_json ?? null,
      id
    );

    return this.getProjectById(id);
  }

  static getMilestones(projectId?: string): Milestone[] {
    const db = getDb();
    if (projectId) {
      return db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY target_date ASC').all(projectId) as unknown as Milestone[];
    }
    return db.prepare('SELECT * FROM milestones ORDER BY target_date ASC').all() as unknown as Milestone[];
  }

  static createMilestone(data: Omit<Milestone, 'created_at' | 'updated_at'>): Milestone {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO milestones (
        id, project_id, title, description, target_date, owner_id, status,
        dependencies_json, completion_requirements, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.title,
      data.description || null,
      data.target_date,
      data.owner_id || null,
      data.status || 'Planned',
      data.dependencies_json || null,
      data.completion_requirements || null,
      data.completed_at || null,
      now,
      now
    );
    return db.prepare('SELECT * FROM milestones WHERE id = ?').get(data.id) as unknown as Milestone;
  }

  static updateMilestone(id: string, updates: Partial<Milestone>): Milestone | null {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE milestones SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        target_date = COALESCE(?, target_date),
        owner_id = COALESCE(?, owner_id),
        status = COALESCE(?, status),
        dependencies_json = COALESCE(?, dependencies_json),
        completion_requirements = COALESCE(?, completion_requirements),
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.title ?? null,
      updates.description ?? null,
      updates.target_date ?? null,
      updates.owner_id ?? null,
      updates.status ?? null,
      updates.dependencies_json ?? null,
      updates.completion_requirements ?? null,
      updates.completed_at ?? null,
      now,
      id
    );
    return db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as unknown as Milestone | null;
  }

  static getSprints(projectId?: string): Sprint[] {
    const db = getDb();
    if (projectId) {
      return db.prepare('SELECT * FROM sprints WHERE project_id = ? ORDER BY start_date DESC').all(projectId) as unknown as Sprint[];
    }
    return db.prepare('SELECT * FROM sprints ORDER BY start_date DESC').all() as unknown as Sprint[];
  }

  static createSprint(data: Omit<Sprint, 'created_at' | 'updated_at'>): Sprint {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sprints (
        id, project_id, team_id, name, goal, start_date, end_date, capacity_hours, status, retrospective_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.team_id || null,
      data.name,
      data.goal,
      data.start_date,
      data.end_date,
      data.capacity_hours || 0,
      data.status || 'Planned',
      data.retrospective_notes || null,
      now,
      now
    );
    return db.prepare('SELECT * FROM sprints WHERE id = ?').get(data.id) as unknown as Sprint;
  }

  static updateSprint(id: string, updates: Partial<Sprint>): Sprint | null {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE sprints SET
        name = COALESCE(?, name),
        goal = COALESCE(?, goal),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        capacity_hours = COALESCE(?, capacity_hours),
        status = COALESCE(?, status),
        retrospective_notes = COALESCE(?, retrospective_notes),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.name ?? null,
      updates.goal ?? null,
      updates.start_date ?? null,
      updates.end_date ?? null,
      updates.capacity_hours ?? null,
      updates.status ?? null,
      updates.retrospective_notes ?? null,
      now,
      id
    );
    return db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as unknown as Sprint | null;
  }

  static calculateProjectHealth(projectId: string): {
    health: 'healthy' | 'at_risk' | 'blocked';
    score: number;
    reasons: string[];
    metrics: {
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      blockedTasks: number;
      criticalBugs: number;
      openBugs: number;
      blockedMilestones: number;
      upcomingMilestones: number;
    };
  } {
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Task metrics
    const taskRows = db.prepare('SELECT status, deadline FROM tasks WHERE project_id = ?').all(projectId) as any[];
    const totalTasks = taskRows.length;
    const completedTasks = taskRows.filter(t => t.status === 'Verified Complete').length;
    const blockedTasks = taskRows.filter(t => t.status === 'Blocked').length;
    const overdueTasks = taskRows.filter(t => t.status !== 'Verified Complete' && t.deadline && t.deadline < now).length;

    // 2. Bug metrics
    const bugRows = db.prepare("SELECT severity, status FROM bugs WHERE project_id = ? AND status NOT IN ('Verified', 'Rejected')").all(projectId) as any[];
    const openBugs = bugRows.length;
    const criticalBugs = bugRows.filter(b => b.severity === 'Critical' || (b.severity === 'Major' && b.status !== 'Fixed')).length;

    // 3. Milestone metrics
    const milestoneRows = db.prepare('SELECT status, target_date FROM milestones WHERE project_id = ?').all(projectId) as any[];
    const blockedMilestones = milestoneRows.filter(m => m.status === 'Blocked' || m.status === 'Delayed').length;
    const upcomingMilestones = milestoneRows.filter(m => m.status !== 'Completed').length;

    const reasons: string[] = [];
    let health: 'healthy' | 'at_risk' | 'blocked' = 'healthy';
    let score = 100;

    if (criticalBugs > 0) {
      health = 'blocked';
      score -= 40;
      reasons.push(`${criticalBugs} critical/major unresolved bug(s) blocking production`);
    }

    if (blockedMilestones > 0) {
      if (health !== 'blocked') health = 'at_risk';
      score -= 25;
      reasons.push(`${blockedMilestones} milestone(s) flagged as blocked or delayed`);
    }

    if (overdueTasks > 0) {
      if (health !== 'blocked') health = 'at_risk';
      score -= 20;
      reasons.push(`${overdueTasks} active task(s) past deadline`);
    }

    if (blockedTasks > 0) {
      score -= 10;
      reasons.push(`${blockedTasks} task(s) currently marked Blocked by dependencies`);
    }

    if (reasons.length === 0) {
      reasons.push('All active milestones on schedule, zero critical QA bugs open, and task velocity healthy.');
    }

    score = Math.max(0, Math.min(100, score));

    return {
      health,
      score,
      reasons,
      metrics: {
        totalTasks,
        completedTasks,
        overdueTasks,
        blockedTasks,
        criticalBugs,
        openBugs,
        blockedMilestones,
        upcomingMilestones
      }
    };
  }
}
