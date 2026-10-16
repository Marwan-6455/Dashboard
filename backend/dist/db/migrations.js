"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const schema_js_1 = require("./schema.js");
function runMigrations(db) {
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
    }
    catch { }
    try {
        db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
    }
    catch { }
    // Migration 001
    const m1 = stmt.get('001_initial_schema');
    if (!m1) {
        db.exec(schema_js_1.SCHEMA_SQL);
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
            const addColumn = (table, colDef) => {
                try {
                    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
                }
                catch {
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
            db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('002_multi_user_workspaces_notifications', new Date().toISOString());
        }
        catch (err) {
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
        `).run('dgc_ws_cindermarch', 'ws_cindermarch', 'guild_cindermarch_default', 'Cindermarch Studio Operations', 'chan_announcements', 'chan_engine_dev', 'chan_qa_builds', 'chan_escalations', JSON.stringify({
                    timezone: 'Africa/Cairo',
                    deadline24h: true,
                    deadline2h: true,
                    deadlineDue: true,
                    overdueDaily: true,
                    escalationEnabled: true
                }), new Date().toISOString(), new Date().toISOString());
            }
            db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('003_discord_bot_operations', new Date().toISOString());
        }
        catch (err) {
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
            const addCol = (table, colDef) => {
                try {
                    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
                }
                catch { }
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
            db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('004_six_teams_system', new Date().toISOString());
        }
        catch (err) {
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
            db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('005_persistent_sessions_and_restore', new Date().toISOString());
        }
        catch (err) {
            console.error('Error applying migration 005:', err);
        }
    }
    // Migration 006: Deadline Strikes, Workspace-Entry Warnings & Automatic Suspension
    const m6 = stmt.get('006_deadline_strikes_and_suspensions');
    if (!m6) {
        try {
            const addCol = (table, colDef) => {
                try {
                    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
                }
                catch { }
            };
            addCol('workspace_members', 'is_suspended INTEGER NOT NULL DEFAULT 0');
            addCol('workspace_members', 'suspended_at TEXT');
            addCol('workspace_members', 'suspension_reason TEXT');
            addCol('workspace_members', 'reinstated_at TEXT');
            addCol('workspace_members', 'reinstated_by TEXT');
            addCol('workspace_members', 'reinstatement_reason TEXT');
            addCol('tasks', 'is_deadline_exempt INTEGER NOT NULL DEFAULT 0');
            addCol('tasks', 'deadline_exemption_reason TEXT');
            addCol('tasks', 'deadline_exempt_approved_by TEXT');
            addCol('tasks', 'extended_deadline TEXT');
            addCol('tasks', 'deadline_extension_reason TEXT');
            addCol('tasks', 'deadline_extension_approved_by TEXT');
            addCol('tasks', 'reassignment_required INTEGER NOT NULL DEFAULT 0');
            addCol('tasks', 'reassignment_reason TEXT');
            db.exec(`
        CREATE TABLE IF NOT EXISTS strikes (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          applicable_deadline TEXT NOT NULL,
          detected_at TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active', 'disputed', 'reversed', 'excused')) DEFAULT 'active',
          evidence_references TEXT,
          notification_history_json TEXT,
          appeal_reason TEXT,
          appealed_at TEXT,
          appeal_outcome TEXT,
          reviewed_by TEXT REFERENCES users(id),
          reviewed_at TEXT,
          reversed_by TEXT REFERENCES users(id),
          reversed_at TEXT,
          reversal_reason TEXT,
          policy_snapshot_json TEXT NOT NULL,
          idempotency_key TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_strikes_ws_user ON strikes(workspace_id, user_id, status);
        CREATE INDEX IF NOT EXISTS idx_strikes_task ON strikes(task_id);
        CREATE INDEX IF NOT EXISTS idx_strikes_idempotency ON strikes(idempotency_key);

        CREATE TABLE IF NOT EXISTS workspace_entry_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_id TEXT NOT NULL,
          active_strike_count INTEGER NOT NULL,
          warning_level TEXT NOT NULL,
          discord_dm_status TEXT NOT NULL CHECK(discord_dm_status IN ('delivered', 'failed', 'skipped', 'not_linked')),
          discord_error TEXT,
          discord_message_id TEXT,
          entered_at TEXT NOT NULL,
          UNIQUE(workspace_id, user_id, session_id)
        );

        CREATE INDEX IF NOT EXISTS idx_wee_ws_user ON workspace_entry_events(workspace_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_wee_session ON workspace_entry_events(session_id);

        CREATE TABLE IF NOT EXISTS strike_threshold_notifications (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          threshold_level INTEGER NOT NULL,
          strike_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          notified_at TEXT NOT NULL,
          UNIQUE(workspace_id, user_id, threshold_level, strike_id, channel)
        );

        CREATE INDEX IF NOT EXISTS idx_stn_user ON strike_threshold_notifications(workspace_id, user_id, threshold_level);

        CREATE TABLE IF NOT EXISTS workspace_suspensions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          strike_count_at_suspension INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active', 'reinstated')) DEFAULT 'active',
          reason TEXT NOT NULL,
          suspended_at TEXT NOT NULL,
          reinstated_at TEXT,
          reinstated_by TEXT REFERENCES users(id),
          reinstatement_reason TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_ws_user ON workspace_suspensions(workspace_id, user_id);
      `);
            // Seed default strike policy into settings
            const now = new Date().toISOString();
            const defaultPolicy = {
                strike_threshold: 5,
                grace_period_hours: 24,
                timezone: 'Africa/Cairo',
                manager_escalation_enabled: true,
                discord_dm_enabled: true,
                allow_member_disputes: true,
                reinstatement_requires_admin: true,
                warning_templates: {
                    first_warning: 'DEADLINE WARNING — You currently have 1 of 5 strikes. A task deadline was missed. Review the task and keep future deadlines on track.',
                    second_warning: 'DEADLINE WARNING — You currently have 2 of 5 strikes. Ensure outstanding deadlines are managed promptly.',
                    escalation: 'DEADLINE ALERT — You currently have 3 of 5 strikes. Repeated missed deadlines may lead to workspace suspension. Please review your outstanding tasks and upcoming deadlines.',
                    final_warning: 'FINAL WARNING — You currently have 4 of 5 strikes. One additional qualifying missed deadline will trigger workspace suspension under the current policy. Review your deadlines immediately.',
                    suspended: 'WORKSPACE SUSPENDED — Your account has reached the five-strike threshold. Workspace access is suspended. Contact the Workspace Owner/Admin to request a review.'
                }
            };
            db.prepare(`
        INSERT OR IGNORE INTO settings (key, value_json, updated_at)
        VALUES ('strike_policy', ?, ?)
      `).run(JSON.stringify(defaultPolicy), now);
            db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('006_deadline_strikes_and_suspensions', new Date().toISOString());
        }
        catch (err) {
            console.error('Error applying migration 006:', err);
        }
    }
    // Migration 007: Studio Operating System Expansion
    const m7 = stmt.get('007_studio_operating_system_expansion');
    if (!m7) {
        try {
            const addCol = (table, colDef) => {
                try {
                    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
                }
                catch { }
            };
            addCol('projects', "status TEXT DEFAULT 'active'");
            addCol('projects', 'owner_id TEXT REFERENCES users(id)');
            addCol('projects', "unity_version TEXT DEFAULT '6000.0.25f1'");
            addCol('projects', 'target_platforms_json TEXT');
            addCol('tasks', 'sprint_id TEXT');
            addCol('tasks', 'related_bug_id TEXT');
            db.exec(`
        -- Milestones table
        CREATE TABLE IF NOT EXISTS milestones (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          target_date TEXT NOT NULL,
          owner_id TEXT REFERENCES users(id),
          status TEXT NOT NULL CHECK(status IN ('Planned', 'In Progress', 'Completed', 'Delayed', 'Blocked')) DEFAULT 'Planned',
          dependencies_json TEXT,
          completion_requirements TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_milestones_proj ON milestones(project_id);

        -- Sprints table
        CREATE TABLE IF NOT EXISTS sprints (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          team_id TEXT REFERENCES teams(id),
          name TEXT NOT NULL,
          goal TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          capacity_hours REAL DEFAULT 0,
          status TEXT NOT NULL CHECK(status IN ('Planned', 'Active', 'Completed', 'Closed')) DEFAULT 'Planned',
          retrospective_notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sprints_proj ON sprints(project_id);

        -- Bugs & QA Lab table
        CREATE TABLE IF NOT EXISTS bugs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT NOT NULL CHECK(severity IN ('Critical', 'Major', 'Minor', 'Trivial')) DEFAULT 'Major',
          priority TEXT NOT NULL CHECK(priority IN ('P0', 'P1', 'P2')) DEFAULT 'P1',
          reporter_id TEXT NOT NULL REFERENCES users(id),
          assigned_to TEXT REFERENCES users(id),
          assigned_team_id TEXT REFERENCES teams(id),
          affected_build TEXT,
          affected_platform TEXT DEFAULT 'PC/Steam',
          steps_to_reproduce TEXT,
          expected_behavior TEXT,
          actual_behavior TEXT,
          related_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          changeset_ref TEXT,
          status TEXT NOT NULL CHECK(status IN ('Reported', 'Confirmed', 'In Progress', 'Fixed', 'Verified', 'Rejected', 'Duplicate', 'Blocked', 'Reopened')) DEFAULT 'Reported',
          resolution TEXT,
          verified_by TEXT REFERENCES users(id),
          verified_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bugs_proj ON bugs(project_id);
        CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
        CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);

        -- Assets Vault table
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          team_id TEXT REFERENCES teams(id),
          name TEXT NOT NULL,
          category TEXT NOT NULL CHECK(category IN ('3d_model', 'material', 'animation', 'concept_art', 'audio', 'music', 'sfx', 'narrative_doc', 'marketing_graphic', 'video', 'tech_doc')),
          description TEXT,
          owner_id TEXT NOT NULL REFERENCES users(id),
          version TEXT NOT NULL DEFAULT 'v1.0',
          status TEXT NOT NULL CHECK(status IN ('Proposed', 'In Progress', 'Ready for Review', 'Changes Requested', 'Approved', 'Integrated', 'Archived')) DEFAULT 'Proposed',
          pipeline_stage TEXT,
          tags_json TEXT,
          preview_url TEXT,
          file_path TEXT,
          file_size INTEGER DEFAULT 0,
          technical_meta_json TEXT,
          linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_assets_proj ON assets(project_id);
        CREATE INDEX IF NOT EXISTS idx_assets_team ON assets(team_id);
        CREATE INDEX IF NOT EXISTS idx_assets_cat ON assets(category);

        -- Story Bible Entries table
        CREATE TABLE IF NOT EXISTS story_bible_entries (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          category TEXT NOT NULL CHECK(category IN ('character', 'location', 'faction', 'lore', 'timeline', 'dialogue', 'quest_beat')),
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          body TEXT NOT NULL,
          tags_json TEXT,
          status TEXT NOT NULL CHECK(status IN ('Draft', 'In Review', 'Canon Approved', 'Archived')) DEFAULT 'Draft',
          author_id TEXT NOT NULL REFERENCES users(id),
          approved_by TEXT REFERENCES users(id),
          related_entries_json TEXT,
          version TEXT DEFAULT '1.0',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_story_proj ON story_bible_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_story_cat ON story_bible_entries(category);

        -- Studio Wiki & Documents table
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
          team_id TEXT REFERENCES teams(id),
          category TEXT NOT NULL CHECK(category IN ('tech_doc', 'architecture', 'design', 'art_guide', 'audio_guide', 'meeting_notes', 'onboarding', 'release_process', 'retrospective')),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          author_id TEXT NOT NULL REFERENCES users(id),
          last_edited_by TEXT REFERENCES users(id),
          tags_json TEXT,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_docs_ws ON documents(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_docs_proj ON documents(project_id);

        -- Decisions Log (Architecture Decision Records - ADR)
        CREATE TABLE IF NOT EXISTS decisions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          scope TEXT NOT NULL,
          context TEXT NOT NULL,
          options_considered TEXT NOT NULL,
          chosen_approach TEXT NOT NULL,
          reasoning TEXT NOT NULL,
          author_id TEXT NOT NULL REFERENCES users(id),
          status TEXT NOT NULL CHECK(status IN ('Proposed', 'Accepted', 'Superseded', 'Deprecated')) DEFAULT 'Proposed',
          approver_id TEXT REFERENCES users(id),
          superseded_by_id TEXT REFERENCES decisions(id),
          related_tasks_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_decisions_proj ON decisions(project_id);

        -- Daily Standups table
        CREATE TABLE IF NOT EXISTS standups (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          completed_yesterday TEXT NOT NULL,
          planned_today TEXT NOT NULL,
          blockers TEXT,
          help_needed TEXT,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_standups_team ON standups(team_id, date);

        -- Meetings table
        CREATE TABLE IF NOT EXISTS meetings (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id TEXT REFERENCES projects(id),
          team_id TEXT REFERENCES teams(id),
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          participants_json TEXT NOT NULL,
          agenda TEXT NOT NULL,
          notes TEXT NOT NULL,
          action_items_json TEXT,
          decisions TEXT,
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        -- Retrospectives table
        CREATE TABLE IF NOT EXISTS retrospectives (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id TEXT REFERENCES projects(id),
          team_id TEXT REFERENCES teams(id),
          title TEXT NOT NULL,
          period TEXT NOT NULL,
          what_went_well TEXT NOT NULL,
          what_caused_problems TEXT NOT NULL,
          what_should_change TEXT NOT NULL,
          action_items_json TEXT,
          facilitator_id TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        -- Builds table
        CREATE TABLE IF NOT EXISTS builds (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          build_number TEXT NOT NULL,
          version TEXT NOT NULL,
          branch TEXT NOT NULL DEFAULT 'main',
          changeset_id TEXT REFERENCES uvcs_changesets(id),
          build_target TEXT NOT NULL CHECK(build_target IN ('Windows', 'Linux', 'macOS', 'PS5', 'Xbox', 'Switch')) DEFAULT 'Windows',
          unity_version TEXT NOT NULL DEFAULT '6000.0.25f1',
          status TEXT NOT NULL CHECK(status IN ('Queued', 'Running', 'Succeeded', 'Failed', 'Canceled')) DEFAULT 'Queued',
          test_report_id TEXT REFERENCES test_reports(id),
          artifacts_json TEXT,
          known_issues TEXT,
          release_approved INTEGER NOT NULL DEFAULT 0,
          release_approved_by TEXT REFERENCES users(id),
          changelog TEXT,
          release_owner_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL,
          completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_builds_proj ON builds(project_id);

        -- Releases table
        CREATE TABLE IF NOT EXISTS releases (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          build_id TEXT REFERENCES builds(id),
          status TEXT NOT NULL CHECK(status IN ('Draft', 'Readiness Review', 'Approved', 'Released', 'Canceled')) DEFAULT 'Draft',
          checklist_json TEXT,
          target_date TEXT,
          released_at TEXT,
          notes TEXT,
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        -- Marketing Items table
        CREATE TABLE IF NOT EXISTS marketing_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          campaign TEXT NOT NULL,
          channel TEXT NOT NULL CHECK(channel IN ('Twitter/X', 'Discord', 'YouTube', 'Steam', 'Press', 'Reddit', 'TikTok')),
          title TEXT NOT NULL,
          copy TEXT NOT NULL,
          creative_asset_ids_json TEXT,
          scheduled_date TEXT,
          status TEXT NOT NULL CHECK(status IN ('Idea', 'Draft', 'Review', 'Approved', 'Scheduled', 'Published')) DEFAULT 'Idea',
          owner_id TEXT NOT NULL REFERENCES users(id),
          external_url TEXT,
          deliverables TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_mkt_proj ON marketing_items(project_id);

        -- AI Conversations & Auditing
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          project_id TEXT,
          prompt TEXT NOT NULL,
          response TEXT NOT NULL,
          citations_json TEXT,
          drafted_actions_json TEXT,
          model_used TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_conversations(user_id);
      `);
            db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('007_studio_operating_system_expansion', new Date().toISOString());
        }
        catch (err) {
            console.error('Error applying migration 007:', err);
        }
    }
}
