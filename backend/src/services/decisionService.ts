import { getDb } from '../db/connection.js';
import { Decision, DecisionStatus } from '../types/index.js';

export class DecisionService {
  static getDecisions(filters: { workspaceId?: string; projectId?: string; scope?: string; status?: string } = {}): (Decision & { author_name?: string; approver_name?: string; project_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT d.*,
             u1.display_name as author_name,
             u2.display_name as approver_name,
             p.name as project_name
      FROM decisions d
      LEFT JOIN users u1 ON d.author_id = u1.id
      LEFT JOIN users u2 ON d.approver_id = u2.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.workspaceId) {
      query += ' AND d.workspace_id = ?';
      params.push(filters.workspaceId);
    }
    if (filters.projectId) {
      query += ' AND (d.project_id = ? OR d.project_id IS NULL)';
      params.push(filters.projectId);
    }
    if (filters.scope) {
      query += ' AND d.scope = ?';
      params.push(filters.scope);
    }
    if (filters.status) {
      query += ' AND d.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY d.id DESC';

    return db.prepare(query).all(...params) as any[];
  }

  static getDecisionById(id: string): (Decision & { author_name?: string; approver_name?: string; project_name?: string }) | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT d.*,
             u1.display_name as author_name,
             u2.display_name as approver_name,
             p.name as project_name
      FROM decisions d
      LEFT JOIN users u1 ON d.author_id = u1.id
      LEFT JOIN users u2 ON d.approver_id = u2.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.id = ?
    `).get(id) as any;
    return row || null;
  }

  static createDecision(data: Omit<Decision, 'created_at' | 'updated_at'>): Decision {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO decisions (
        id, workspace_id, project_id, title, scope, context, options_considered,
        chosen_approach, reasoning, author_id, status, approver_id, superseded_by_id,
        related_tasks_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.workspace_id || 'ws_cindermarch',
      data.project_id || null,
      data.title,
      data.scope,
      data.context,
      data.options_considered,
      data.chosen_approach,
      data.reasoning,
      data.author_id,
      data.status || 'Proposed',
      data.approver_id || null,
      data.superseded_by_id || null,
      data.related_tasks_json || null,
      now,
      now
    );

    return this.getDecisionById(data.id)!;
  }

  static updateDecision(id: string, updates: Partial<Decision>): Decision | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getDecisionById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE decisions SET
        title = COALESCE(?, title),
        scope = COALESCE(?, scope),
        context = COALESCE(?, context),
        options_considered = COALESCE(?, options_considered),
        chosen_approach = COALESCE(?, chosen_approach),
        reasoning = COALESCE(?, reasoning),
        status = COALESCE(?, status),
        approver_id = COALESCE(?, approver_id),
        superseded_by_id = COALESCE(?, superseded_by_id),
        related_tasks_json = COALESCE(?, related_tasks_json),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.title ?? null,
      updates.scope ?? null,
      updates.context ?? null,
      updates.options_considered ?? null,
      updates.chosen_approach ?? null,
      updates.reasoning ?? null,
      updates.status ?? null,
      updates.approver_id ?? null,
      updates.superseded_by_id ?? null,
      updates.related_tasks_json ?? null,
      now,
      id
    );

    return this.getDecisionById(id);
  }

  static supersedeDecision(oldId: string, newId: string, approverId: string): boolean {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE decisions SET
        status = 'Superseded',
        superseded_by_id = ?,
        approver_id = ?,
        updated_at = ?
      WHERE id = ?
    `).run(newId, approverId, now, oldId);
    return result.changes > 0;
  }
}
