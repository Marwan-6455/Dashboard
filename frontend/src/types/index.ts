export type UserRole = 'owner' | 'admin' | 'developer' | 'reviewer';

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
