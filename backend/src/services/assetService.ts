import { getDb } from '../db/connection.js';
import { Asset, AssetStatus, AssetCategory } from '../types/index.js';

export interface AssetFilters {
  projectId?: string;
  teamId?: string;
  category?: string;
  status?: string;
  pipelineStage?: string;
}

export class AssetService {
  static getAssets(filters: AssetFilters = {}): (Asset & { owner_name?: string; team_name?: string; project_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT a.*,
             u.display_name as owner_name,
             t.name as team_name,
             p.name as project_name
      FROM assets a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN teams t ON a.team_id = t.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.projectId) {
      query += ' AND a.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.teamId) {
      query += ' AND a.team_id = ?';
      params.push(filters.teamId);
    }
    if (filters.category) {
      query += ' AND a.category = ?';
      params.push(filters.category);
    }
    if (filters.status) {
      query += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters.pipelineStage) {
      query += ' AND a.pipeline_stage = ?';
      params.push(filters.pipelineStage);
    }

    query += ' ORDER BY a.updated_at DESC';

    return db.prepare(query).all(...params) as any[];
  }

  static getAssetById(id: string): (Asset & { owner_name?: string; team_name?: string; project_name?: string }) | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT a.*,
             u.display_name as owner_name,
             t.name as team_name,
             p.name as project_name
      FROM assets a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN teams t ON a.team_id = t.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `).get(id) as any;
    return row || null;
  }

  static createAsset(data: Omit<Asset, 'created_at' | 'updated_at'>): Asset {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO assets (
        id, project_id, team_id, name, category, description, owner_id, version,
        status, pipeline_stage, tags_json, preview_url, file_path, file_size,
        technical_meta_json, linked_task_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.team_id || null,
      data.name,
      data.category,
      data.description || null,
      data.owner_id,
      data.version || 'v1.0',
      data.status || 'Proposed',
      data.pipeline_stage || null,
      data.tags_json || null,
      data.preview_url || null,
      data.file_path || null,
      data.file_size || 0,
      data.technical_meta_json || null,
      data.linked_task_id || null,
      now,
      now
    );

    return this.getAssetById(data.id)!;
  }

  static updateAsset(id: string, updates: Partial<Asset>): Asset | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getAssetById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE assets SET
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        version = COALESCE(?, version),
        status = COALESCE(?, status),
        pipeline_stage = COALESCE(?, pipeline_stage),
        tags_json = COALESCE(?, tags_json),
        preview_url = COALESCE(?, preview_url),
        file_path = COALESCE(?, file_path),
        file_size = COALESCE(?, file_size),
        technical_meta_json = COALESCE(?, technical_meta_json),
        linked_task_id = COALESCE(?, linked_task_id),
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.name ?? null,
      updates.category ?? null,
      updates.description ?? null,
      updates.version ?? null,
      updates.status ?? null,
      updates.pipeline_stage ?? null,
      updates.tags_json ?? null,
      updates.preview_url ?? null,
      updates.file_path ?? null,
      updates.file_size ?? null,
      updates.technical_meta_json ?? null,
      updates.linked_task_id ?? null,
      now,
      id
    );

    return this.getAssetById(id);
  }

  static updateAssetStatus(id: string, status: AssetStatus, pipelineStage?: string): Asset | null {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE assets SET
        status = ?,
        pipeline_stage = COALESCE(?, pipeline_stage),
        updated_at = ?
      WHERE id = ?
    `).run(status, pipelineStage || null, now, id);

    return this.getAssetById(id);
  }
}
