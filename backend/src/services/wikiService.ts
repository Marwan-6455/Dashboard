import { getDb } from '../db/connection.js';
import { Document, DocumentCategory } from '../types/index.js';

export class WikiService {
  static getDocuments(filters: { workspaceId?: string; projectId?: string; teamId?: string; category?: string } = {}): (Document & { author_name?: string; team_name?: string; project_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT d.*,
             u.display_name as author_name,
             t.name as team_name,
             p.name as project_name
      FROM documents d
      LEFT JOIN users u ON d.author_id = u.id
      LEFT JOIN teams t ON d.team_id = t.id
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
    if (filters.teamId) {
      query += ' AND (d.team_id = ? OR d.team_id IS NULL)';
      params.push(filters.teamId);
    }
    if (filters.category) {
      query += ' AND d.category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY d.is_pinned DESC, d.updated_at DESC';

    return db.prepare(query).all(...params) as any[];
  }

  static getDocumentById(id: string): (Document & { author_name?: string; team_name?: string; project_name?: string }) | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT d.*,
             u.display_name as author_name,
             t.name as team_name,
             p.name as project_name
      FROM documents d
      LEFT JOIN users u ON d.author_id = u.id
      LEFT JOIN teams t ON d.team_id = t.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.id = ?
    `).get(id) as any;
    return row || null;
  }

  static createDocument(data: Omit<Document, 'created_at' | 'updated_at'>): Document {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO documents (
        id, workspace_id, project_id, team_id, category, title, content,
        author_id, last_edited_by, tags_json, is_pinned, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.workspace_id || 'ws_cindermarch',
      data.project_id || null,
      data.team_id || null,
      data.category,
      data.title,
      data.content,
      data.author_id,
      data.author_id,
      data.tags_json || null,
      data.is_pinned || 0,
      1,
      now,
      now
    );

    return this.getDocumentById(data.id)!;
  }

  static updateDocument(id: string, updates: Partial<Document>, editorId?: string): Document | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getDocumentById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE documents SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        category = COALESCE(?, category),
        last_edited_by = ?,
        tags_json = COALESCE(?, tags_json),
        is_pinned = COALESCE(?, is_pinned),
        version = version + 1,
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.title ?? null,
      updates.content ?? null,
      updates.category ?? null,
      editorId || null,
      updates.tags_json ?? null,
      updates.is_pinned ?? null,
      now,
      id
    );

    return this.getDocumentById(id);
  }

  static deleteDocument(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
