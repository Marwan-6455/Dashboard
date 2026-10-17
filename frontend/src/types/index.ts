export type UserRole =
  | 'owner'
  | 'super_admin'
  | 'admin'
  | 'team_manager'
  | 'team_member'
  | 'developer'
  | 'reviewer'
  | 'designer'
  | 'qa'
  | 'lead';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: UserRole[];
  avatarUrl?: string | null;
  workspaceId?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
  primary_owner_id?: string | null;
  super_admin_limit?: number;
}

export interface AdminAuditEntry {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  target_name?: string | null;
  details_json?: string | null;
  reason?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  invitation_token: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invited_by: string;
  invited_by_name?: string;
  created_at: string;
  expires_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'task_assigned' | 'review_requested' | 'review_decision' | 'task_completed' | 'comment_added' | 'overdue_warning';
  title: string;
  message: string;
  related_task_id: string | null;
  is_read: number;
  created_at: string;
}

export type Priority = 'P0' | 'P1' | 'P2';

export type TaskStatus =
  | 'Backlog'
  | 'In Progress'
  | 'Ready for Review'
  | 'Changes Requested'
  | 'Ready to Integrate'
  | 'Verified Complete'
  | 'Blocked';

export interface TaskAcceptanceCriterion {
  id: string;
  task_id: string;
  title: string;
  is_satisfied: number;
  satisfied_at: string | null;
  satisfied_by_name?: string | null;
  created_at: string;
}

export interface UVCSChangeset {
  id: string;
  repository_id: string;
  changeset_id: string;
  branch: string | null;
  comment: string;
  author: string;
  timestamp: string;
  affected_files_json: string | null;
  source: 'manual' | 'uvcs_api' | 'plastic_cli';
  validation_status: 'unverified_manual' | 'verified_live' | 'failed_lookup';
  external_link: string | null;
  linked_at?: string;
  linked_by_name?: string;
}

export type ReviewDecision = 'Pending' | 'Approved' | 'Changes Requested' | 'Rejected';

export interface ReviewChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  notes?: string;
}

export interface Review {
  id: string;
  task_id: string;
  task_title?: string;
  task_priority?: Priority;
  task_status?: TaskStatus;
  developer_id: string;
  developer_name?: string;
  reviewer_id: string;
  reviewer_name?: string;
  changeset_id: string | null;
  cs_identifier?: string;
  cs_comment?: string;
  checklist: ReviewChecklistItem[];
  decision: ReviewDecision;
  findings: string | null;
  required_fixes: string | null;
  created_at: string;
  decision_at: string | null;
}

export type EvidenceType = 'screenshot' | 'video' | 'test_log' | 'build_log' | 'document' | 'external_link';

export interface Evidence {
  id: string;
  task_id: string | null;
  task_title?: string;
  uploader_id: string;
  uploader_name?: string;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  content_type: string;
  file_size: number;
  evidence_type: EvidenceType;
  description: string;
  external_url: string | null;
  related_changeset_id: string | null;
  created_at: string;
}

export type TestResult = 'Passed' | 'Failed' | 'Error' | 'Not Run';
export type BuildResult = 'Success' | 'Failed' | 'Not Applicable';

export interface TestReport {
  id: string;
  task_id: string | null;
  task_title?: string;
  repository_id: string;
  revision: string;
  unity_version: string;
  test_suite: string;
  result: TestResult;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  build_result: BuildResult;
  runner_identity: string;
  log_artifact_id: string | null;
  log_filename?: string;
  source: 'manual' | 'unity_ci' | 'utf_runner';
  verification_state: 'manual_unverified' | 'automated_verified';
  start_time: string;
  end_time: string;
  creator_name?: string;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  actor_id: string | null;
  actor_name?: string;
  action: string;
  related_task_id: string | null;
  task_title?: string;
  previous_value: string | null;
  new_value: string | null;
  source: 'application' | 'uvcs' | 'unity_test_runner' | 'review';
  metadata_json: string | null;
  created_at: string;
}

export interface CompletionGateStatus {
  passed: boolean;
  gates: {
    acceptanceCriteria: {
      passed: boolean;
      total: number;
      satisfied: number;
      detail: string;
    };
    changesetLinked: {
      passed: boolean;
      exempt: boolean;
      exemptionReason?: string | null;
      exemptionApprovedBy?: string | null;
      count: number;
      detail: string;
    };
    peerReview: {
      passed: boolean;
      approved: boolean;
      reviewerId: string | null;
      reviewerName?: string | null;
      isSelfReview: boolean;
      decisionDate?: string | null;
      detail: string;
    };
    evidence: {
      passed: boolean;
      count: number;
      detail: string;
    };
    testReports: {
      passed: boolean;
      exempt: boolean;
      exemptionReason?: string | null;
      exemptionApprovedBy?: string | null;
      reportsCount: number;
      allPassed: boolean;
      detail: string;
    };
    dependencies: {
      passed: boolean;
      blockedBy: string[];
      detail: string;
    };
  };
  reasons: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  project_id: string;
  workspace_id?: string | null;
  category?: string | null;
  owner_id: string | null;
  owner_name?: string | null;
  reviewer_id: string | null;
  reviewer_name?: string | null;
  creator_name?: string | null;
  priority: Priority;
  status: TaskStatus;
  deadline: string | null;
  estimated_effort?: string | null;
  actual_effort?: string | null;
  tags_json?: string | null;
  last_edited_by?: string | null;
  creator_id: string;
  is_changeset_exempt: number;
  changeset_exemption_reason: string | null;
  changeset_exempt_approved_by: string | null;
  is_test_exempt: number;
  test_exemption_reason: string | null;
  test_exempt_approved_by: string | null;
  is_deadline_exempt?: number;
  deadline_exemption_reason?: string | null;
  deadline_exempt_approved_by?: string | null;
  extended_deadline?: string | null;
  deadline_extension_reason?: string | null;
  deadline_extension_approved_by?: string | null;
  reassignment_required?: number;
  reassignment_reason?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  criteria_total?: number;
  criteria_satisfied?: number;
  changeset_count?: number;
  evidence_count?: number;
  comment_count?: number;
  review_count?: number;
  latest_review_decision?: ReviewDecision | null;
  acceptance_criteria?: TaskAcceptanceCriterion[];
  changesets?: UVCSChangeset[];
  reviews?: Review[];
  evidence?: Evidence[];
  test_reports?: TestReport[];
  comments?: any[];
  dependencies?: any[];
  blocks?: any[];
  completion_gate_status?: CompletionGateStatus;
}

export interface DashboardMetrics {
  totalTasks: number;
  openTasks: number;
  inProgress: number;
  awaitingReview: number;
  changesRequested: number;
  readyToIntegrate: number;
  blocked: number;
  verifiedComplete: number;
  failedTests: number;
  passedTests: number;
}

export type StrikeStatus = 'active' | 'disputed' | 'reversed' | 'excused';

export interface Strike {
  id: string;
  workspace_id: string;
  user_id: string;
  task_id: string;
  applicable_deadline: string;
  detected_at: string;
  reason: string;
  status: StrikeStatus;
  evidence_references?: string | null;
  notification_history_json?: string | null;
  appeal_reason?: string | null;
  appealed_at?: string | null;
  appeal_outcome?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reversed_by?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  policy_snapshot_json?: string;
  created_at: string;
  updated_at: string;
  task_title?: string;
  task_priority?: Priority;
  task_status?: TaskStatus;
  member_name?: string;
  member_username?: string;
  reversed_by_name?: string;
}

export interface StrikePolicy {
  strike_threshold: number;
  grace_period_hours: number;
  timezone: string;
  manager_escalation_enabled: boolean;
  discord_dm_enabled: boolean;
  allow_member_disputes: boolean;
  reinstatement_requires_admin: boolean;
  warning_templates?: {
    first_warning?: string;
    second_warning?: string;
    escalation?: string;
    final_warning?: string;
    suspended?: string;
  };
}

export type WarningLevel = 'none' | 'first_warning' | 'second_warning' | 'escalation' | 'final_warning' | 'suspended';

export interface WorkspaceEntryWarning {
  activeStrikes: number;
  maxThreshold: number;
  remainingStrikes: number;
  warningLevel: WarningLevel;
  isSuspended: boolean;
  showWarning: boolean;
  strikes: Strike[];
  discordDmStatus: 'delivered' | 'failed' | 'skipped' | 'not_linked';
  discordError?: string | null;
  message: string;
}

export interface StrikeOverviewMember {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url?: string | null;
  workspace_role: string;
  is_suspended: number;
  suspended_at?: string | null;
  suspension_reason?: string | null;
  discord_username?: string | null;
  discord_user_id?: string | null;
  active_strikes: number;
  disputed_strikes: number;
  total_strikes: number;
  open_tasks: number;
}

export interface Project {
  id: string;
  workspace_id?: string | null;
  name: string;
  description: string;
  repository_id: string;
  status?: 'active' | 'archived' | 'paused';
  owner_id?: string | null;
  unity_version?: string | null;
  target_platforms_json?: string | null;
  created_at: string;
}

export type MilestoneStatus = 'Planned' | 'In Progress' | 'Completed' | 'Delayed' | 'Blocked';

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  target_date: string;
  owner_id?: string | null;
  status: MilestoneStatus;
  dependencies_json?: string | null;
  completion_requirements?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type SprintStatus = 'Planned' | 'Active' | 'Completed' | 'Closed';

export interface Sprint {
  id: string;
  project_id: string;
  team_id?: string | null;
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  capacity_hours?: number;
  status: SprintStatus;
  retrospective_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type BugSeverity = 'Critical' | 'Major' | 'Minor' | 'Trivial';
export type BugStatus =
  | 'Reported'
  | 'Confirmed'
  | 'In Progress'
  | 'Fixed'
  | 'Verified'
  | 'Rejected'
  | 'Duplicate'
  | 'Blocked'
  | 'Reopened';

export interface Bug {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: BugSeverity;
  priority: Priority;
  reporter_id: string;
  reporter_name?: string;
  assigned_to?: string | null;
  assignee_name?: string | null;
  assigned_team_id?: string | null;
  team_name?: string | null;
  affected_build?: string | null;
  affected_platform?: string | null;
  steps_to_reproduce?: string | null;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
  related_task_id?: string | null;
  changeset_ref?: string | null;
  status: BugStatus;
  resolution?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssetCategory =
  | '3d_model'
  | 'material'
  | 'animation'
  | 'concept_art'
  | 'audio'
  | 'music'
  | 'sfx'
  | 'narrative_doc'
  | 'marketing_graphic'
  | 'video'
  | 'tech_doc';

export type AssetStatus =
  | 'Proposed'
  | 'In Progress'
  | 'Ready for Review'
  | 'Changes Requested'
  | 'Approved'
  | 'Integrated'
  | 'Archived';

export interface Asset {
  id: string;
  project_id: string;
  team_id?: string | null;
  name: string;
  category: AssetCategory;
  description?: string | null;
  owner_id: string;
  owner_name?: string;
  team_name?: string;
  project_name?: string;
  version: string;
  status: AssetStatus;
  pipeline_stage?: string | null;
  tags_json?: string | null;
  preview_url?: string | null;
  file_path?: string | null;
  file_size?: number;
  technical_meta_json?: string | null;
  linked_task_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type StoryCategory =
  | 'character'
  | 'location'
  | 'faction'
  | 'lore'
  | 'timeline'
  | 'dialogue'
  | 'quest_beat';

export type StoryStatus = 'Draft' | 'In Review' | 'Canon Approved' | 'Archived';

export interface StoryBibleEntry {
  id: string;
  project_id: string;
  category: StoryCategory;
  title: string;
  summary: string;
  body: string;
  tags_json?: string | null;
  status: StoryStatus;
  author_id: string;
  author_name?: string;
  approved_by?: string | null;
  approver_name?: string | null;
  related_entries_json?: string | null;
  version?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentCategory =
  | 'tech_doc'
  | 'architecture'
  | 'design'
  | 'art_guide'
  | 'audio_guide'
  | 'meeting_notes'
  | 'onboarding'
  | 'release_process'
  | 'retrospective';

export interface Document {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  team_id?: string | null;
  category: DocumentCategory;
  title: string;
  content: string;
  author_id: string;
  author_name?: string;
  team_name?: string;
  last_edited_by?: string | null;
  tags_json?: string | null;
  is_pinned?: number;
  version?: number;
  created_at: string;
  updated_at: string;
}

export type DecisionStatus = 'Proposed' | 'Accepted' | 'Superseded' | 'Deprecated';

export interface Decision {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  title: string;
  scope: string;
  context: string;
  options_considered: string;
  chosen_approach: string;
  reasoning: string;
  author_id: string;
  author_name?: string;
  approver_name?: string;
  status: DecisionStatus;
  approver_id?: string | null;
  superseded_by_id?: string | null;
  related_tasks_json?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Standup {
  id: string;
  workspace_id: string;
  team_id: string;
  team_name?: string;
  user_id: string;
  user_name?: string;
  completed_yesterday: string;
  planned_today: string;
  blockers?: string | null;
  help_needed?: string | null;
  date: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  project_name?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  title: string;
  date: string;
  participants_json: string;
  agenda: string;
  notes: string;
  action_items_json?: string | null;
  decisions?: string | null;
  created_by: string;
  creator_name?: string;
  created_at: string;
}

export interface Retrospective {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  team_id?: string | null;
  title: string;
  period: string;
  what_went_well: string;
  what_caused_problems: string;
  what_should_change: string;
  action_items_json?: string | null;
  facilitator_id: string;
  facilitator_name?: string;
  created_at: string;
}

export type BuildTarget = 'Windows' | 'Linux' | 'macOS' | 'PS5' | 'Xbox' | 'Switch';
export type BuildStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Canceled';

export interface Build {
  id: string;
  project_id: string;
  project_name?: string;
  build_number: string;
  version: string;
  branch: string;
  changeset_id?: string | null;
  build_target: BuildTarget;
  unity_version: string;
  status: BuildStatus;
  test_report_id?: string | null;
  artifacts_json?: string | null;
  known_issues?: string | null;
  release_approved?: number;
  release_approved_by?: string | null;
  changelog?: string | null;
  release_owner_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export type ReleaseStatus = 'Draft' | 'Readiness Review' | 'Approved' | 'Released' | 'Canceled';

export interface Release {
  id: string;
  project_id: string;
  name: string;
  version: string;
  build_id?: string | null;
  build_version?: string;
  status: ReleaseStatus;
  checklist_json?: string | null;
  target_date?: string | null;
  released_at?: string | null;
  notes?: string | null;
  created_by: string;
  creator_name?: string;
  created_at: string;
}

export type MarketingChannel = 'Twitter/X' | 'Discord' | 'YouTube' | 'Steam' | 'Press' | 'Reddit' | 'TikTok';
export type MarketingStatus = 'Idea' | 'Draft' | 'Review' | 'Approved' | 'Scheduled' | 'Published';

export interface MarketingItem {
  id: string;
  project_id: string;
  campaign: string;
  channel: MarketingChannel;
  title: string;
  copy: string;
  creative_asset_ids_json?: string | null;
  scheduled_date?: string | null;
  status: MarketingStatus;
  owner_id: string;
  owner_name?: string;
  external_url?: string | null;
  deliverables?: string | null;
  created_at: string;
}

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

