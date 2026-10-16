import { getDb } from '../db/connection.js';

export interface SearchResultItem {
  type: 'task' | 'project' | 'bug' | 'asset' | 'document' | 'story' | 'decision' | 'meeting' | 'build' | 'test_report';
  id: string;
  title: string;
  subtitle: string;
  snippet?: string;
  projectId?: string;
  status?: string;
  targetUrl: string;
}

export class SearchService {
  static search(query: string, workspaceId = 'ws_cindermarch', projectId?: string): SearchResultItem[] {
    if (!query || query.trim().length < 2) return [];

    const db = getDb();
    const pattern = `%${query.trim()}%`;
    const results: SearchResultItem[] = [];

    // 1. Search Tasks
    try {
      let taskQuery = `
        SELECT id, title, description, project_id, status, priority, deadline
        FROM tasks
        WHERE (title LIKE ? OR description LIKE ? OR id LIKE ?)
      `;
      const params: any[] = [pattern, pattern, pattern];
      if (projectId) {
        taskQuery += ' AND project_id = ?';
        params.push(projectId);
      }
      taskQuery += ' LIMIT 8';
      const tasks = db.prepare(taskQuery).all(...params) as any[];
      for (const t of tasks) {
        results.push({
          type: 'task',
          id: t.id,
          title: `[${t.id}] ${t.title}`,
          subtitle: `${t.priority} • ${t.status} • Project: ${t.project_id}`,
          snippet: t.description?.slice(0, 100),
          projectId: t.project_id,
          status: t.status,
          targetUrl: `/tasks?taskId=${t.id}`
        });
      }
    } catch {}

    // 2. Search Bugs
    try {
      let bugQuery = `
        SELECT id, title, description, project_id, severity, status
        FROM bugs
        WHERE (title LIKE ? OR description LIKE ? OR id LIKE ?)
      `;
      const params: any[] = [pattern, pattern, pattern];
      if (projectId) {
        bugQuery += ' AND project_id = ?';
        params.push(projectId);
      }
      bugQuery += ' LIMIT 6';
      const bugs = db.prepare(bugQuery).all(...params) as any[];
      for (const b of bugs) {
        results.push({
          type: 'bug',
          id: b.id,
          title: `[${b.id}] ${b.title}`,
          subtitle: `QA Bug • ${b.severity} • Status: ${b.status}`,
          snippet: b.description?.slice(0, 100),
          projectId: b.project_id,
          status: b.status,
          targetUrl: `/bugs?bugId=${b.id}`
        });
      }
    } catch {}

    // 3. Search Assets
    try {
      let assetQuery = `
        SELECT id, name, category, project_id, status, description
        FROM assets
        WHERE (name LIKE ? OR description LIKE ? OR category LIKE ?)
      `;
      const params: any[] = [pattern, pattern, pattern];
      if (projectId) {
        assetQuery += ' AND project_id = ?';
        params.push(projectId);
      }
      assetQuery += ' LIMIT 6';
      const assets = db.prepare(assetQuery).all(...params) as any[];
      for (const a of assets) {
        results.push({
          type: 'asset',
          id: a.id,
          title: a.name,
          subtitle: `Asset • ${a.category} • Status: ${a.status}`,
          snippet: a.description?.slice(0, 100),
          projectId: a.project_id,
          status: a.status,
          targetUrl: `/assets?assetId=${a.id}`
        });
      }
    } catch {}

    // 4. Search Story Bible
    try {
      let storyQuery = `
        SELECT id, title, summary, project_id, category, status
        FROM story_bible_entries
        WHERE (title LIKE ? OR summary LIKE ? OR body LIKE ?)
      `;
      const params: any[] = [pattern, pattern, pattern];
      if (projectId) {
        storyQuery += ' AND project_id = ?';
        params.push(projectId);
      }
      storyQuery += ' LIMIT 6';
      const stories = db.prepare(storyQuery).all(...params) as any[];
      for (const s of stories) {
        results.push({
          type: 'story',
          id: s.id,
          title: s.title,
          subtitle: `Story Bible • ${s.category} • ${s.status}`,
          snippet: s.summary?.slice(0, 100),
          projectId: s.project_id,
          status: s.status,
          targetUrl: `/story-bible?entryId=${s.id}`
        });
      }
    } catch {}

    // 5. Search Documents
    try {
      let docQuery = `
        SELECT id, title, content, project_id, category
        FROM documents
        WHERE (title LIKE ? OR content LIKE ?)
      `;
      const params: any[] = [pattern, pattern];
      if (projectId) {
        docQuery += ' AND (project_id = ? OR project_id IS NULL)';
        params.push(projectId);
      }
      docQuery += ' LIMIT 6';
      const docs = db.prepare(docQuery).all(...params) as any[];
      for (const d of docs) {
        results.push({
          type: 'document',
          id: d.id,
          title: d.title,
          subtitle: `Studio Wiki • ${d.category}`,
          snippet: d.content?.slice(0, 100),
          projectId: d.project_id,
          targetUrl: `/wiki?docId=${d.id}`
        });
      }
    } catch {}

    // 6. Search Decisions
    try {
      let decQuery = `
        SELECT id, title, scope, status, chosen_approach
        FROM decisions
        WHERE (title LIKE ? OR context LIKE ? OR chosen_approach LIKE ?)
      `;
      const params: any[] = [pattern, pattern, pattern];
      if (projectId) {
        decQuery += ' AND (project_id = ? OR project_id IS NULL)';
        params.push(projectId);
      }
      decQuery += ' LIMIT 5';
      const decisions = db.prepare(decQuery).all(...params) as any[];
      for (const dec of decisions) {
        results.push({
          type: 'decision',
          id: dec.id,
          title: dec.title,
          subtitle: `Decision (ADR) • Scope: ${dec.scope} • ${dec.status}`,
          snippet: dec.chosen_approach?.slice(0, 100),
          status: dec.status,
          targetUrl: `/decisions?decisionId=${dec.id}`
        });
      }
    } catch {}

    return results;
  }
}
