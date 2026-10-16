import { getDb } from '../db/connection.js';
import { MarketingItem } from '../types/index.js';

export class MarketingService {
  static getMarketingItems(filters: { projectId?: string; channel?: string; status?: string } = {}): (MarketingItem & { owner_name?: string; project_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT m.*,
             u.display_name as owner_name,
             p.name as project_name
      FROM marketing_items m
      LEFT JOIN users u ON m.owner_id = u.id
      LEFT JOIN projects p ON m.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.projectId) {
      query += ' AND m.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.channel) {
      query += ' AND m.channel = ?';
      params.push(filters.channel);
    }
    if (filters.status) {
      query += ' AND m.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY m.scheduled_date ASC, m.created_at DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static getMarketingItemById(id: string): MarketingItem | null {
    const db = getDb();
    return (db.prepare('SELECT * FROM marketing_items WHERE id = ?').get(id) as unknown as MarketingItem) || null;
  }

  static createMarketingItem(data: Omit<MarketingItem, 'created_at'>): MarketingItem {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO marketing_items (
        id, project_id, campaign, channel, title, copy, creative_asset_ids_json,
        scheduled_date, status, owner_id, external_url, deliverables, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.campaign,
      data.channel,
      data.title,
      data.copy,
      data.creative_asset_ids_json || null,
      data.scheduled_date || null,
      data.status || 'Idea',
      data.owner_id,
      data.external_url || null,
      data.deliverables || null,
      now
    );

    return this.getMarketingItemById(data.id)!;
  }

  static updateMarketingItem(id: string, updates: Partial<MarketingItem>): MarketingItem | null {
    const db = getDb();
    const existing = this.getMarketingItemById(id);
    if (!existing) return null;

    db.prepare(`
      UPDATE marketing_items SET
        campaign = COALESCE(?, campaign),
        channel = COALESCE(?, channel),
        title = COALESCE(?, title),
        copy = COALESCE(?, copy),
        creative_asset_ids_json = COALESCE(?, creative_asset_ids_json),
        scheduled_date = COALESCE(?, scheduled_date),
        status = COALESCE(?, status),
        external_url = COALESCE(?, external_url),
        deliverables = COALESCE(?, deliverables)
      WHERE id = ?
    `).run(
      updates.campaign ?? null,
      updates.channel ?? null,
      updates.title ?? null,
      updates.copy ?? null,
      updates.creative_asset_ids_json ?? null,
      updates.scheduled_date ?? null,
      updates.status ?? null,
      updates.external_url ?? null,
      updates.deliverables ?? null,
      id
    );

    return this.getMarketingItemById(id);
  }
}
