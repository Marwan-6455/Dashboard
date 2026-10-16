export const SCHEMA_SQL = `
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  roles TEXT NOT NULL, -- JSON array string e.g. ["admin","developer"]
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Workspace Members junction table
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'developer', 'reviewer')),
  joined_at TEXT NOT NULL,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  suspended_at TEXT,
  suspension_reason TEXT,
  reinstated_at TEXT,
  reinstated_by TEXT REFERENCES users(id),
  reinstatement_reason TEXT,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_ws ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);

-- Workspace Invitations table
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

CREATE INDEX IF NOT EXISTS idx_wi_token ON workspace_invitations(invitation_token);

-- In-App Notifications table
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

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Teams table
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

CREATE INDEX IF NOT EXISTS idx_teams_ws ON teams(workspace_id);

-- Team Members junction table
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

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, -- e.g. T6-ENG-001
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'Gameplay',
  owner_id TEXT REFERENCES users(id),
  reviewer_id TEXT REFERENCES users(id),
  priority TEXT NOT NULL CHECK(priority IN ('P0', 'P1', 'P2')),
  status TEXT NOT NULL CHECK(status IN ('Backlog', 'In Progress', 'Ready for Review', 'Changes Requested', 'Ready to Integrate', 'Verified Complete', 'Blocked')),
  deadline TEXT,
  estimated_effort TEXT,
  actual_effort TEXT,
  tags_json TEXT,
  last_edited_by TEXT REFERENCES users(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  is_changeset_exempt INTEGER NOT NULL DEFAULT 0,
  changeset_exemption_reason TEXT,
  changeset_exempt_approved_by TEXT REFERENCES users(id),
  is_test_exempt INTEGER NOT NULL DEFAULT 0,
  test_exemption_reason TEXT,
  test_exempt_approved_by TEXT REFERENCES users(id),
  is_deadline_exempt INTEGER NOT NULL DEFAULT 0,
  deadline_exemption_reason TEXT,
  deadline_exempt_approved_by TEXT REFERENCES users(id),
  extended_deadline TEXT,
  deadline_extension_reason TEXT,
  deadline_extension_approved_by TEXT REFERENCES users(id),
  reassignment_required INTEGER NOT NULL DEFAULT 0,
  reassignment_reason TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer ON tasks(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);

-- Task Acceptance Criteria table
CREATE TABLE IF NOT EXISTS task_acceptance_criteria (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_satisfied INTEGER NOT NULL DEFAULT 0,
  satisfied_at TEXT,
  satisfied_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tac_task ON task_acceptance_criteria(task_id);

-- Task Dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id),
  created_at TEXT NOT NULL,
  UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_dep_task ON task_dependencies(task_id);

-- Task Comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);

-- UVCS Changesets table
CREATE TABLE IF NOT EXISTS uvcs_changesets (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  changeset_id TEXT NOT NULL,
  branch TEXT,
  comment TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  affected_files_json TEXT,
  source TEXT NOT NULL CHECK(source IN ('manual', 'uvcs_api', 'plastic_cli')),
  validation_status TEXT NOT NULL CHECK(validation_status IN ('unverified_manual', 'verified_live', 'failed_lookup')),
  external_link TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(repository_id, changeset_id)
);

CREATE INDEX IF NOT EXISTS idx_changeset_id ON uvcs_changesets(changeset_id);

-- Task to Changeset junction table
CREATE TABLE IF NOT EXISTS task_changesets (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changeset_id TEXT NOT NULL REFERENCES uvcs_changesets(id) ON DELETE CASCADE,
  linked_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(task_id, changeset_id)
);

CREATE INDEX IF NOT EXISTS idx_tc_task ON task_changesets(task_id);

-- Peer Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  developer_id TEXT NOT NULL REFERENCES users(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  changeset_id TEXT REFERENCES uvcs_changesets(id),
  checklist_json TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('Pending', 'Approved', 'Changes Requested', 'Rejected')),
  findings TEXT,
  required_fixes TEXT,
  created_at TEXT NOT NULL,
  decision_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_task ON reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- Evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('screenshot', 'video', 'test_log', 'build_log', 'document', 'external_link')),
  description TEXT NOT NULL,
  external_url TEXT,
  related_changeset_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_task ON evidence(task_id);

-- Test and Build Reports table
CREATE TABLE IF NOT EXISTS test_reports (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  repository_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  unity_version TEXT NOT NULL,
  test_suite TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('Passed', 'Failed', 'Error', 'Not Run')),
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  build_result TEXT NOT NULL CHECK(build_result IN ('Success', 'Failed', 'Not Applicable')),
  runner_identity TEXT NOT NULL,
  log_artifact_id TEXT REFERENCES evidence(id),
  source TEXT NOT NULL CHECK(source IN ('manual', 'unity_ci', 'utf_runner')),
  verification_state TEXT NOT NULL CHECK(verification_state IN ('manual_unverified', 'automated_verified')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_task ON test_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_reports_revision ON test_reports(revision);

-- Audit / Activity Events table
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  related_task_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  source TEXT NOT NULL CHECK(source IN ('application', 'uvcs', 'unity_test_runner', 'review')),
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_events(related_task_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at);

-- Integration Configurations table
CREATE TABLE IF NOT EXISTS integration_configs (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Hub Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Migration Tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
);

-- Discord Account Links
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

-- Discord Link Requests (Short-lived 6-char verification codes)
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

-- Discord Guild & Channel Configurations per Workspace
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

-- Scheduled Reminders (Durable persistent job queue)
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

-- Discord Event Outbox (Reliable asynchronous delivery queue)
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

-- User Sessions table (Persistent auth sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- Deadline Strikes table
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

-- Workspace Entry Events table
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

-- Strike Threshold Notifications table (deduplication of threshold alerts)
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

-- Workspace Suspensions table (authoritative audit log of member suspensions & reinstatements)
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
`;
