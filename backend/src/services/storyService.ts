import { getDb } from '../db/connection.js';
import { StoryBibleEntry, StoryCategory, StoryStatus } from '../types/index.js';

export class StoryService {
  static getStoryEntries(filters: { projectId?: string; category?: string; status?: string } = {}): (StoryBibleEntry & { author_name?: string; approver_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT s.*,
             u1.display_name as author_name,
             u2.display_name as approver_name
      FROM story_bible_entries s
      LEFT JOIN users u1 ON s.author_id = u1.id
      LEFT JOIN users u2 ON s.approved_by = u2.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.projectId) {
      query += ' AND s.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.category) {
      query += ' AND s.category = ?';
      params.push(filters.category);
    }
    if (filters.status) {
      query += ' AND s.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY s.title ASC';

    return db.prepare(query).all(...params) as any[];
  }

  static getStoryEntryById(id: string): (StoryBibleEntry & { author_name?: string; approver_name?: string }) | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT s.*,
             u1.display_name as author_name,
             u2.display_name as approver_name
      FROM story_bible_entries s
      LEFT JOIN users u1 ON s.author_id = u1.id
      LEFT JOIN users u2 ON s.approved_by = u2.id
      WHERE s.id = ?
    `).get(id) as any;
    return row || null;
  }

  static createStoryEntry(data: Omit<StoryBibleEntry, 'created_at' | 'updated_at'>): StoryBibleEntry {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO story_bible_entries (
        id, project_id, category, title, summary, body, tags_json,
        status, author_id, approved_by, related_entries_json, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.category,
      data.title,
      data.summary,
      data.body,
      data.tags_json || null,
      data.status || 'Draft',
      data.author_id,
      data.approved_by || null,
      data.related_entries_json || null,
      data.version || '1.0',
      now,
      now
    );

    return this.getStoryEntryById(data.id)!;
  }

  static updateStoryEntry(id: string, updates: Partial<StoryBibleEntry>): StoryBibleEntry | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getStoryEntryById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE story_bible_entries SET
        category = COALESCE(?, category),
        title = COALESCE(?, title),
        summary = COALESCE(?, summary),
        body = COALESCE(?, body),
        tags_json = COALESCE(?, tags_json),
        status = COALESCE(?, status),
        approved_by = COALESCE(?, approved_by),
        related_entries_json = COALESCE(?, related_entries_json),
        version = COALESCE(?, version),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.category ?? null,
      updates.title ?? null,
      updates.summary ?? null,
      updates.body ?? null,
      updates.tags_json ?? null,
      updates.status ?? null,
      updates.approved_by ?? null,
      updates.related_entries_json ?? null,
      updates.version ?? null,
      now,
      id
    );

    return this.getStoryEntryById(id);
  }

  static approveStoryEntry(id: string, approverId: string): StoryBibleEntry | null {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE story_bible_entries SET
        status = 'Canon Approved',
        approved_by = ?,
        updated_at = ?
      WHERE id = ?
    `).run(approverId, now, id);

    return this.getStoryEntryById(id);
  }
}
