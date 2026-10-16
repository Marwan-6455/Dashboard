-- PostgreSQL Production Schema for Cindermarch Engine Hub
-- Terminal 6 Development Management

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  roles JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  repository_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id),
  owner_id VARCHAR(64) REFERENCES users(id),
  reviewer_id VARCHAR(64) REFERENCES users(id),
  priority VARCHAR(8) NOT NULL CHECK(priority IN ('P0', 'P1', 'P2')),
  status VARCHAR(32) NOT NULL CHECK(status IN ('Backlog', 'In Progress', 'Ready for Review', 'Changes Requested', 'Ready to Integrate', 'Verified Complete', 'Blocked')),
  deadline TIMESTAMPTZ,
  creator_id VARCHAR(64) NOT NULL REFERENCES users(id),
  is_changeset_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  changeset_exemption_reason TEXT,
  changeset_exempt_approved_by VARCHAR(64) REFERENCES users(id),
  is_test_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  test_exemption_reason TEXT,
  test_exempt_approved_by VARCHAR(64) REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer ON tasks(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Task Acceptance Criteria table
CREATE TABLE IF NOT EXISTS task_acceptance_criteria (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  is_satisfied BOOLEAN NOT NULL DEFAULT FALSE,
  satisfied_at TIMESTAMPTZ,
  satisfied_by VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tac_task ON task_acceptance_criteria(task_id);

-- Task Dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id VARCHAR(64) NOT NULL REFERENCES tasks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Task Comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UVCS Changesets table
CREATE TABLE IF NOT EXISTS uvcs_changesets (
  id VARCHAR(64) PRIMARY KEY,
  repository_id VARCHAR(128) NOT NULL,
  changeset_id VARCHAR(64) NOT NULL,
  branch VARCHAR(128),
  comment TEXT NOT NULL,
  author VARCHAR(128) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  affected_files_json JSONB,
  source VARCHAR(32) NOT NULL CHECK(source IN ('manual', 'uvcs_api', 'plastic_cli')),
  validation_status VARCHAR(32) NOT NULL CHECK(validation_status IN ('unverified_manual', 'verified_live', 'failed_lookup')),
  external_link TEXT,
  created_by VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, changeset_id)
);

-- Task to Changeset junction table
CREATE TABLE IF NOT EXISTS task_changesets (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changeset_id VARCHAR(64) NOT NULL REFERENCES uvcs_changesets(id) ON DELETE CASCADE,
  linked_by VARCHAR(64) NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, changeset_id)
);

-- Peer Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  developer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  reviewer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  changeset_id VARCHAR(64) REFERENCES uvcs_changesets(id),
  checklist_json JSONB NOT NULL,
  decision VARCHAR(32) NOT NULL CHECK(decision IN ('Pending', 'Approved', 'Changes Requested', 'Rejected')),
  findings TEXT,
  required_fixes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_at TIMESTAMPTZ
);

-- Evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
  uploader_id VARCHAR(64) NOT NULL REFERENCES users(id),
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  file_size BIGINT NOT NULL,
  evidence_type VARCHAR(32) NOT NULL CHECK(evidence_type IN ('screenshot', 'video', 'test_log', 'build_log', 'document', 'external_link')),
  description TEXT NOT NULL,
  external_url TEXT,
  related_changeset_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test and Build Reports table
CREATE TABLE IF NOT EXISTS test_reports (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
  repository_id VARCHAR(128) NOT NULL,
  revision VARCHAR(64) NOT NULL,
  unity_version VARCHAR(64) NOT NULL,
  test_suite VARCHAR(64) NOT NULL,
  result VARCHAR(32) NOT NULL CHECK(result IN ('Passed', 'Failed', 'Error', 'Not Run')),
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  build_result VARCHAR(32) NOT NULL CHECK(build_result IN ('Success', 'Failed', 'Not Applicable')),
  runner_identity VARCHAR(128) NOT NULL,
  log_artifact_id VARCHAR(64) REFERENCES evidence(id),
  source VARCHAR(32) NOT NULL CHECK(source IN ('manual', 'unity_ci', 'utf_runner')),
  verification_state VARCHAR(32) NOT NULL CHECK(verification_state IN ('manual_unverified', 'automated_verified')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_by VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit / Activity Events table
CREATE TABLE IF NOT EXISTS activity_events (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) REFERENCES users(id),
  action VARCHAR(128) NOT NULL,
  related_task_id VARCHAR(64),
  previous_value TEXT,
  new_value TEXT,
  source VARCHAR(32) NOT NULL CHECK(source IN ('application', 'uvcs', 'unity_test_runner', 'review')),
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Integration Configurations table
CREATE TABLE IF NOT EXISTS integration_configs (
  key VARCHAR(64) PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  manager_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
  discord_channel_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date TIMESTAMPTZ NOT NULL,
  owner_id VARCHAR(64) REFERENCES users(id),
  status VARCHAR(32) NOT NULL CHECK(status IN ('Planned', 'In Progress', 'Completed', 'Delayed', 'Blocked')) DEFAULT 'Planned',
  dependencies_json JSONB,
  completion_requirements TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sprints table
CREATE TABLE IF NOT EXISTS sprints (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id VARCHAR(64) REFERENCES teams(id),
  name VARCHAR(128) NOT NULL,
  goal TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  capacity_hours NUMERIC DEFAULT 0,
  status VARCHAR(32) NOT NULL CHECK(status IN ('Planned', 'Active', 'Completed', 'Closed')) DEFAULT 'Planned',
  retrospective_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bugs table
CREATE TABLE IF NOT EXISTS bugs (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(16) NOT NULL CHECK(severity IN ('Critical', 'Major', 'Minor', 'Trivial')) DEFAULT 'Major',
  priority VARCHAR(8) NOT NULL CHECK(priority IN ('P0', 'P1', 'P2')) DEFAULT 'P1',
  reporter_id VARCHAR(64) NOT NULL REFERENCES users(id),
  assigned_to VARCHAR(64) REFERENCES users(id),
  assigned_team_id VARCHAR(64) REFERENCES teams(id),
  affected_build VARCHAR(64),
  affected_platform VARCHAR(64) DEFAULT 'PC/Steam',
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  related_task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
  changeset_ref VARCHAR(64),
  status VARCHAR(32) NOT NULL CHECK(status IN ('Reported', 'Confirmed', 'In Progress', 'Fixed', 'Verified', 'Rejected', 'Duplicate', 'Blocked', 'Reopened')) DEFAULT 'Reported',
  resolution TEXT,
  verified_by VARCHAR(64) REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assets Vault table
CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id VARCHAR(64) REFERENCES teams(id),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(32) NOT NULL,
  description TEXT,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id),
  version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  status VARCHAR(32) NOT NULL DEFAULT 'Proposed',
  pipeline_stage VARCHAR(64),
  tags_json JSONB,
  preview_url TEXT,
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  technical_meta_json JSONB,
  linked_task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Story Bible Entries table
CREATE TABLE IF NOT EXISTS story_bible_entries (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tags_json JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  author_id VARCHAR(64) NOT NULL REFERENCES users(id),
  approved_by VARCHAR(64) REFERENCES users(id),
  related_entries_json JSONB,
  version VARCHAR(16) DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Studio Documents & Wiki table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
  team_id VARCHAR(64) REFERENCES teams(id),
  category VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id VARCHAR(64) NOT NULL REFERENCES users(id),
  last_edited_by VARCHAR(64) REFERENCES users(id),
  tags_json JSONB,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Architecture Decisions Log (ADR)
CREATE TABLE IF NOT EXISTS decisions (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  scope VARCHAR(64) NOT NULL,
  context TEXT NOT NULL,
  options_considered TEXT NOT NULL,
  chosen_approach TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  author_id VARCHAR(64) NOT NULL REFERENCES users(id),
  status VARCHAR(32) NOT NULL DEFAULT 'Proposed',
  approver_id VARCHAR(64) REFERENCES users(id),
  superseded_by_id VARCHAR(64) REFERENCES decisions(id),
  related_tasks_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Builds table
CREATE TABLE IF NOT EXISTS builds (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_number VARCHAR(32) NOT NULL,
  version VARCHAR(32) NOT NULL,
  branch VARCHAR(128) NOT NULL DEFAULT 'main',
  changeset_id VARCHAR(64) REFERENCES uvcs_changesets(id),
  build_target VARCHAR(32) NOT NULL DEFAULT 'Windows',
  unity_version VARCHAR(32) NOT NULL DEFAULT '6000.0.25f1',
  status VARCHAR(32) NOT NULL DEFAULT 'Queued',
  test_report_id VARCHAR(64),
  artifacts_json JSONB,
  known_issues TEXT,
  release_approved BOOLEAN NOT NULL DEFAULT FALSE,
  release_approved_by VARCHAR(64) REFERENCES users(id),
  changelog TEXT,
  release_owner_id VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Releases table
CREATE TABLE IF NOT EXISTS releases (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  version VARCHAR(32) NOT NULL,
  build_id VARCHAR(64) REFERENCES builds(id),
  status VARCHAR(32) NOT NULL DEFAULT 'Draft',
  checklist_json JSONB,
  target_date TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  notes TEXT,
  created_by VARCHAR(64) NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Marketing Items table
CREATE TABLE IF NOT EXISTS marketing_items (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign VARCHAR(128) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  copy TEXT NOT NULL,
  creative_asset_ids_json JSONB,
  scheduled_date TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'Idea',
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id),
  external_url TEXT,
  deliverables TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64),
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  citations_json JSONB,
  drafted_actions_json JSONB,
  model_used VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
