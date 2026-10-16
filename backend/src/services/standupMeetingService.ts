import { getDb } from '../db/connection.js';
import { Standup, Meeting, Retrospective } from '../types/index.js';

export class StandupMeetingService {
  // Standups
  static getStandups(filters: { workspaceId?: string; teamId?: string; date?: string } = {}): (Standup & { user_name?: string; team_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT s.*,
             u.display_name as user_name,
             t.name as team_name
      FROM standups s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN teams t ON s.team_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.workspaceId) {
      query += ' AND s.workspace_id = ?';
      params.push(filters.workspaceId);
    }
    if (filters.teamId) {
      query += ' AND s.team_id = ?';
      params.push(filters.teamId);
    }
    if (filters.date) {
      query += ' AND s.date = ?';
      params.push(filters.date);
    }

    query += ' ORDER BY s.created_at DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static submitStandup(data: Omit<Standup, 'created_at'>): Standup {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO standups (
        id, workspace_id, team_id, user_id, completed_yesterday, planned_today, blockers, help_needed, date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        completed_yesterday = excluded.completed_yesterday,
        planned_today = excluded.planned_today,
        blockers = excluded.blockers,
        help_needed = excluded.help_needed
    `).run(
      data.id,
      data.workspace_id || 'ws_cindermarch',
      data.team_id,
      data.user_id,
      data.completed_yesterday,
      data.planned_today,
      data.blockers || null,
      data.help_needed || null,
      data.date,
      now
    );

    return db.prepare('SELECT * FROM standups WHERE id = ?').get(data.id) as unknown as Standup;
  }

  // Meetings
  static getMeetings(filters: { workspaceId?: string; projectId?: string; teamId?: string } = {}): (Meeting & { creator_name?: string; project_name?: string; team_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT m.*,
             u.display_name as creator_name,
             p.name as project_name,
             t.name as team_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN teams t ON m.team_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.workspaceId) {
      query += ' AND m.workspace_id = ?';
      params.push(filters.workspaceId);
    }
    if (filters.projectId) {
      query += ' AND (m.project_id = ? OR m.project_id IS NULL)';
      params.push(filters.projectId);
    }
    if (filters.teamId) {
      query += ' AND (m.team_id = ? OR m.team_id IS NULL)';
      params.push(filters.teamId);
    }

    query += ' ORDER BY m.date DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static createMeeting(data: Omit<Meeting, 'created_at'>): Meeting {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO meetings (
        id, workspace_id, project_id, team_id, title, date,
        participants_json, agenda, notes, action_items_json, decisions, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.workspace_id || 'ws_cindermarch',
      data.project_id || null,
      data.team_id || null,
      data.title,
      data.date,
      data.participants_json,
      data.agenda,
      data.notes,
      data.action_items_json || null,
      data.decisions || null,
      data.created_by,
      now
    );

    return db.prepare('SELECT * FROM meetings WHERE id = ?').get(data.id) as unknown as Meeting;
  }

  // Retrospectives
  static getRetrospectives(filters: { workspaceId?: string; projectId?: string; teamId?: string } = {}): (Retrospective & { facilitator_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT r.*,
             u.display_name as facilitator_name
      FROM retrospectives r
      LEFT JOIN users u ON r.facilitator_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.workspaceId) {
      query += ' AND r.workspace_id = ?';
      params.push(filters.workspaceId);
    }
    if (filters.projectId) {
      query += ' AND (r.project_id = ? OR r.project_id IS NULL)';
      params.push(filters.projectId);
    }
    if (filters.teamId) {
      query += ' AND (r.team_id = ? OR r.team_id IS NULL)';
      params.push(filters.teamId);
    }

    query += ' ORDER BY r.created_at DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static createRetrospective(data: Omit<Retrospective, 'created_at'>): Retrospective {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO retrospectives (
        id, workspace_id, project_id, team_id, title, period,
        what_went_well, what_caused_problems, what_should_change,
        action_items_json, facilitator_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.workspace_id || 'ws_cindermarch',
      data.project_id || null,
      data.team_id || null,
      data.title,
      data.period,
      data.what_went_well,
      data.what_caused_problems,
      data.what_should_change,
      data.action_items_json || null,
      data.facilitator_id,
      now
    );

    return db.prepare('SELECT * FROM retrospectives WHERE id = ?').get(data.id) as unknown as Retrospective;
  }
}
