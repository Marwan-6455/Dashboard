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
