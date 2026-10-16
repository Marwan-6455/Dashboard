import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { SCHEMA_SQL } from './schema.js';

export function runMigrations(db: DatabaseSync): void {
  // 1. Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const stmt = db.prepare('SELECT name FROM _migrations WHERE name = ?');

  // Ensure workspace_id and avatar_url exist on users
  try {
    db.exec('ALTER TABLE users ADD COLUMN workspace_id TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
  } catch {}

  // Migration 001
  const m1 = stmt.get('001_initial_schema');
  if (!m1) {
    db.exec(SCHEMA_SQL);
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('001_initial_schema', new Date().toISOString());
  }

  // Migration 002: Multi-user workspaces, invitations, notifications, task effort
  const m2 = stmt.get('002_multi_user_workspaces_notifications');
  if (!m2) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          owner_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspace_members (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'developer', 'reviewer')),
          joined_at TEXT NOT NULL,
          UNIQUE(workspace_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS workspace_invitations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          invitation_token TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'developer', 'reviewer')),
          status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
          invited_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          related_task_id TEXT,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);

      // Add columns if not already present
      const addColumn = (table: string, colDef: string) => {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
        } catch {
          // Column already exists
        }
      };

      addColumn('users', 'avatar_url TEXT');
      addColumn('users', 'workspace_id TEXT');
      addColumn('tasks', 'workspace_id TEXT');
      addColumn('tasks', "category TEXT DEFAULT 'Gameplay'");
      addColumn('tasks', 'estimated_effort TEXT');
      addColumn('tasks', 'actual_effort TEXT');
      addColumn('tasks', 'tags_json TEXT');
      addColumn('tasks', 'last_edited_by TEXT');
      addColumn('projects', 'workspace_id TEXT');

      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        '002_multi_user_workspaces_notifications',
        new Date().toISOString()
      );
    } catch (err) {
      console.error('Error applying migration 002:', err);
    }
  }

  // Migration 003: Discord Bot Operations, Account Links, Guild Configs, Reminders, and Outbox
  const m3 = stmt.get('003_discord_bot_operations');
  if (!m3) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS discord_account_links (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          discord_user_id TEXT NOT NULL UNIQUE,
          discord_username TEXT NOT NULL,
          verified_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_dal_user ON discord_account_links(user_id);
        CREATE INDEX IF NOT EXISTS idx_dal_discord ON discord_account_links(discord_user_id);

        CREATE TABLE IF NOT EXISTS discord_link_requests (
          id TEXT PRIMARY KEY,
          discord_user_id TEXT NOT NULL UNIQUE,
          discord_username TEXT NOT NULL,
          link_code TEXT NOT NULL,
          link_code_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_dlr_code ON discord_link_requests(link_code);

        CREATE TABLE IF NOT EXISTS discord_guild_configs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
          guild_id TEXT NOT NULL,
          guild_name TEXT,
          announcements_channel_id TEXT,
          engine_channel_id TEXT,
          qa_channel_id TEXT,
          design_channel_id TEXT,
          audio_channel_id TEXT,
          escalation_channel_id TEXT,
          reminder_policy_json TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scheduled_reminders (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          reminder_type TEXT NOT NULL CHECK(reminder_type IN ('deadline_24h', 'deadline_2h', 'deadline_due', 'overdue_daily', 'task_assigned', 'review_pending', 'escalation')),
          scheduled_for TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'cancelled', 'failed')) DEFAULT 'pending',
          recipient_discord_id TEXT,
          target_channel_id TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          sent_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_rem_due ON scheduled_reminders(status, scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_rem_task ON scheduled_reminders(task_id);

        CREATE TABLE IF NOT EXISTS discord_event_outbox (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          workspace_id TEXT,
          task_id TEXT,
          payload_json TEXT NOT NULL,
          target_channel_type TEXT NOT NULL DEFAULT 'announcements',
          status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'failed', 'skipped')) DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          processed_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_pending ON discord_event_outbox(status, created_at);
      `);

      // Seed default guild config if workspace exists
      const wsCheck = db.prepare("SELECT id FROM workspaces WHERE id = 'ws_cindermarch'").get();
      if (wsCheck) {
        db.prepare(`
          INSERT OR IGNORE INTO discord_guild_configs (
            id, workspace_id, guild_id, guild_name,
            announcements_channel_id, engine_channel_id, qa_channel_id,
            escalation_channel_id, reminder_policy_json, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
          'dgc_ws_cindermarch',
          'ws_cindermarch',
          'guild_cindermarch_default',
          'Cindermarch Studio Operations',
          'chan_announcements',
          'chan_engine_dev',
          'chan_qa_builds',
          'chan_escalations',
          JSON.stringify({
            timezone: 'Africa/Cairo',
            deadline24h: true,
            deadline2h: true,
            deadlineDue: true,
            overdueDaily: true,
            escalationEnabled: true
          }),
          new Date().toISOString(),
          new Date().toISOString()
        );
      }

      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        '003_discord_bot_operations',
        new Date().toISOString()
      );
    } catch (err) {
      console.error('Error applying migration 003:', err);
    }
  }

  // Migration 004: Six Teams System for Cindermarch Studio
  const m4 = stmt.get('004_six_teams_system');
  if (!m4) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          description TEXT NOT NULL,
          manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          discord_channel_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(workspace_id, slug)
        );

        CREATE TABLE IF NOT EXISTS team_members (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('manager', 'member')) DEFAULT 'member',
          joined_at TEXT NOT NULL,
          UNIQUE(team_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_tm_team ON team_members(team_id);
        CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id);
      `);

      const addCol = (table: string, colDef: string) => {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
        } catch {}
      };

      addCol('tasks', 'team_id TEXT REFERENCES teams(id)');
      addCol('discord_guild_configs', 'story_channel_id TEXT');
      addCol('discord_guild_configs', 'coding_channel_id TEXT');
      addCol('discord_guild_configs', 'marketing_channel_id TEXT');
      addCol('discord_guild_configs', 'artists_channel_id TEXT');
      addCol('discord_guild_configs', 'sound_channel_id TEXT');

      const now = new Date().toISOString();
      const sixTeams = [
        {
          id: 'team_story',
          name: 'Story Team',
          slug: 'story',
          description: 'Narrative design, lore, dialogue, world-building, and script writing.'
        },
        {
          id: 'team_coding',
          name: 'Coding Team',
          slug: 'coding',
          description: 'Gameplay systems, AI logic, UI programming, and client gameplay architecture.'
        },
        {
          id: 'team_marketing',
          name: 'Marketing Team',
          slug: 'marketing',
          description: 'Community engagement, social media, trailers, press kits, and promotional campaigns.'
        },
        {
          id: 'team_engine',
          name: 'Engine Team',
          slug: 'engine',
          description: 'Core engine development, rendering pipeline, physics optimization, performance profiling, and toolchain.'
        },
        {
          id: 'team_3d_artists',
          name: '3D Artists',
          slug: '3d-artists',
          description: '3D character modeling, environment art, texturing, rigging, animation, and asset integration.'
        },
        {
          id: 'team_sound',
          name: 'Sound Team',
          slug: 'sound',
          description: 'Original score, sound effects (SFX), foley, voiceover mastering, and audio engine integration.'
        }
      ];

      const wsCheck = db.prepare("SELECT id FROM workspaces WHERE id = 'ws_cindermarch'").get();
      if (wsCheck) {
        const prjCheck = db.prepare("SELECT id FROM projects WHERE id = 'terminal-6'").get();
        const prjId = prjCheck ? 'terminal-6' : null;
        const insertTeam = db.prepare(`
          INSERT OR IGNORE INTO teams (id, workspace_id, name, slug, description, project_id, created_at, updated_at)
          VALUES (?, 'ws_cindermarch', ?, ?, ?, ?, ?, ?)
        `);

        for (const t of sixTeams) {
          insertTeam.run(t.id, t.name, t.slug, t.description, prjId, now, now);
        }
      }

      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        '004_six_teams_system',
        new Date().toISOString()
      );
    } catch (err) {
      console.error('Error applying migration 004:', err);
    }
  }

  // Migration 005: Persistent Sessions Table
  const m5 = stmt.get('005_persistent_sessions_and_restore');
  if (!m5) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          csrf_token TEXT,
          created_at TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
      `);

      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        '005_persistent_sessions_and_restore',
        new Date().toISOString()
      );
    } catch (err) {
      console.error('Error applying migration 005:', err);
    }
  }
}

