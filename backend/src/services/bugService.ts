import { getDb } from '../db/connection.js';
import { Bug, BugStatus, BugSeverity, Priority } from '../types/index.js';

export interface BugFilters {
  projectId?: string;
  status?: string;
  severity?: string;
  priority?: string;
  assignedTo?: string;
  assignedTeamId?: string;
}

export class BugService {
  static getBugs(filters: BugFilters = {}): (Bug & { reporter_name?: string; assignee_name?: string; team_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT b.*,
             u1.display_name as reporter_name,
             u2.display_name as assignee_name,
             t.name as team_name
      FROM bugs b
      LEFT JOIN users u1 ON b.reporter_id = u1.id
      LEFT JOIN users u2 ON b.assigned_to = u2.id
      LEFT JOIN teams t ON b.assigned_team_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.projectId) {
      query += ' AND b.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.status) {
      query += ' AND b.status = ?';
      params.push(filters.status);
    }
    if (filters.severity) {
      query += ' AND b.severity = ?';
      params.push(filters.severity);
    }
    if (filters.priority) {
      query += ' AND b.priority = ?';
      params.push(filters.priority);
    }
    if (filters.assignedTo) {
      query += ' AND b.assigned_to = ?';
      params.push(filters.assignedTo);
    }
    if (filters.assignedTeamId) {
      query += ' AND b.assigned_team_id = ?';
      params.push(filters.assignedTeamId);
    }

    query += " ORDER BY CASE b.severity WHEN 'Critical' THEN 1 WHEN 'Major' THEN 2 WHEN 'Minor' THEN 3 ELSE 4 END, b.created_at DESC";

    return db.prepare(query).all(...params) as any[];
  }

  static getBugById(id: string): (Bug & { reporter_name?: string; assignee_name?: string; team_name?: string }) | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT b.*,
             u1.display_name as reporter_name,
             u2.display_name as assignee_name,
             t.name as team_name
      FROM bugs b
      LEFT JOIN users u1 ON b.reporter_id = u1.id
      LEFT JOIN users u2 ON b.assigned_to = u2.id
      LEFT JOIN teams t ON b.assigned_team_id = t.id
      WHERE b.id = ?
    `).get(id) as any;
    return row || null;
  }

  static createBug(data: Omit<Bug, 'created_at' | 'updated_at'>): Bug {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO bugs (
        id, project_id, title, description, severity, priority,
        reporter_id, assigned_to, assigned_team_id, affected_build, affected_platform,
        steps_to_reproduce, expected_behavior, actual_behavior, related_task_id,
        changeset_ref, status, resolution, verified_by, verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.title,
      data.description,
      data.severity || 'Major',
      data.priority || 'P1',
      data.reporter_id,
      data.assigned_to || null,
      data.assigned_team_id || null,
      data.affected_build || null,
      data.affected_platform || 'PC/Steam',
      data.steps_to_reproduce || null,
      data.expected_behavior || null,
      data.actual_behavior || null,
      data.related_task_id || null,
      data.changeset_ref || null,
      data.status || 'Reported',
      data.resolution || null,
      null,
      null,
      now,
      now
    );

    return this.getBugById(data.id)!;
  }

  static updateBug(id: string, updates: Partial<Bug>): Bug | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getBugById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE bugs SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        severity = COALESCE(?, severity),
        priority = COALESCE(?, priority),
        assigned_to = COALESCE(?, assigned_to),
        assigned_team_id = COALESCE(?, assigned_team_id),
        affected_build = COALESCE(?, affected_build),
        affected_platform = COALESCE(?, affected_platform),
        steps_to_reproduce = COALESCE(?, steps_to_reproduce),
        expected_behavior = COALESCE(?, expected_behavior),
        actual_behavior = COALESCE(?, actual_behavior),
        related_task_id = COALESCE(?, related_task_id),
        changeset_ref = COALESCE(?, changeset_ref),
        status = COALESCE(?, status),
        resolution = COALESCE(?, resolution),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.title ?? null,
      updates.description ?? null,
      updates.severity ?? null,
      updates.priority ?? null,
      updates.assigned_to ?? null,
      updates.assigned_team_id ?? null,
      updates.affected_build ?? null,
      updates.affected_platform ?? null,
      updates.steps_to_reproduce ?? null,
      updates.expected_behavior ?? null,
      updates.actual_behavior ?? null,
      updates.related_task_id ?? null,
      updates.changeset_ref ?? null,
      updates.status ?? null,
      updates.resolution ?? null,
      now,
      id
    );

    return this.getBugById(id);
  }

  /**
   * Enforces the QA Verification gate:
   * A developer marking a bug as "Fixed" does NOT verify it.
   * Only authorized QA / Reviewers can mark it "Verified" or reopen it if testing fails.
   */
  static verifyBug(id: string, verifiedByUserId: string, passed: boolean, notes?: string): Bug | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getBugById(id);
    if (!existing) return null;

    if (passed) {
      db.prepare(`
        UPDATE bugs SET
          status = 'Verified',
          verified_by = ?,
          verified_at = ?,
          resolution = COALESCE(?, resolution),
          updated_at = ?
        WHERE id = ?
      `).run(verifiedByUserId, now, notes ? `Verified by QA: ${notes}` : null, now, id);
    } else {
      // Reopened by QA
      db.prepare(`
        UPDATE bugs SET
          status = 'Reopened',
          verified_by = ?,
          verified_at = ?,
          resolution = ?,
          updated_at = ?
        WHERE id = ?
      `).run(verifiedByUserId, now, notes ? `QA Verification Failed: ${notes}` : 'Verification failed in QA retest', now, id);
    }

    return this.getBugById(id);
  }

  static getTriageSummary(projectId?: string): {
    total: number;
    open: number;
    critical: number;
    major: number;
    fixedAwaitingQA: number;
    verified: number;
  } {
    const db = getDb();
    let query = 'SELECT status, severity FROM bugs';
    const params: any[] = [];
    if (projectId) {
      query += ' WHERE project_id = ?';
      params.push(projectId);
    }
    const rows = db.prepare(query).all(...params) as any[];

    return {
      total: rows.length,
      open: rows.filter(r => !['Verified', 'Rejected'].includes(r.status)).length,
      critical: rows.filter(r => r.severity === 'Critical' && !['Verified', 'Rejected'].includes(r.status)).length,
      major: rows.filter(r => r.severity === 'Major' && !['Verified', 'Rejected'].includes(r.status)).length,
      fixedAwaitingQA: rows.filter(r => r.status === 'Fixed').length,
      verified: rows.filter(r => r.status === 'Verified').length
    };
  }
}
