"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_SQL = void 0;
exports.SCHEMA_SQL = `
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

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, -- e.g. T6-ENG-001
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
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
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer ON tasks(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON tasks(workspace_id);

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
`;
