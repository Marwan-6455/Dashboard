import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { BuildResult, ReportSource, ReportVerificationState, TestReport, TestResult } from '../types/index.js';
import { recordActivity } from './activityService.js';
import { enqueueDiscordEvent } from './discordOutboxService.js';

export function createTestReport(
  data: {
    taskId?: string | null;
    repositoryId?: string;
    revision: string;
    unityVersion: string;
    testSuite: string;
    result: TestResult;
    passedCount?: number;
    failedCount?: number;
    skippedCount?: number;
    buildResult?: BuildResult;
    runnerIdentity: string;
    logArtifactId?: string | null;
    source?: ReportSource;
    verificationState?: ReportVerificationState;
    startTime?: string;
    endTime?: string;
  },
  creatorId?: string | null,
  db = getDb()
): TestReport {
  const id = `rpt_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  const repoId = data.repositoryId || 'Terminal6-Main@cindermarch';
  const source = data.source || 'manual';
  const verificationState = data.verificationState || (source === 'manual' ? 'manual_unverified' : 'automated_verified');
  const startTime = data.startTime || now;
  const endTime = data.endTime || now;
  const passedCount = data.passedCount || 0;
  const failedCount = data.failedCount || 0;
  const skippedCount = data.skippedCount || 0;
  const buildResult = data.buildResult || 'Success';

  const stmt = db.prepare(`
    INSERT INTO test_reports (
      id, task_id, repository_id, revision, unity_version, test_suite,
      result, passed_count, failed_count, skipped_count, build_result,
      runner_identity, log_artifact_id, source, verification_state,
      start_time, end_time, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.taskId || null,
    repoId,
    data.revision,
    data.unityVersion,
    data.testSuite,
    data.result,
    passedCount,
    failedCount,
    skippedCount,
    buildResult,
    data.runnerIdentity,
    data.logArtifactId || null,
    source,
    verificationState,
    startTime,
    endTime,
    creatorId || null,
    now
  );

  recordActivity(
    creatorId || null,
    'test_report_submitted',
    data.taskId || null,
    null,
    data.result,
    source === 'manual' ? 'application' : 'unity_test_runner',
    {
      reportId: id,
      revision: data.revision,
      testSuite: data.testSuite,
      passedCount,
      failedCount,
      verificationState
    },
    db
  );

  enqueueDiscordEvent(
    'test_report_ingested',
    {
      reportId: id,
      taskId: data.taskId || null,
      suite: data.testSuite,
      result: data.result,
      passedCount,
      failedCount,
      skippedCount,
      buildResult,
      revision: data.revision,
      runnerIdentity: data.runnerIdentity
    },
    'qa',
    data.taskId || null,
    'ws_cindermarch',
    db
  );

  return {
    id,
    task_id: data.taskId || null,
    repository_id: repoId,
    revision: data.revision,
    unity_version: data.unityVersion,
    test_suite: data.testSuite,
    result: data.result,
    passed_count: passedCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
    build_result: buildResult,
    runner_identity: data.runnerIdentity,
    log_artifact_id: data.logArtifactId || null,
    source,
    verification_state: verificationState,
    start_time: startTime,
    end_time: endTime,
    created_by: creatorId || null,
    created_at: now
  };
}

export function getTestReports(
  filters: {
    taskId?: string;
    revision?: string;
    result?: string;
    source?: string;
  } = {},
  db = getDb()
): any[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.taskId) {
    conditions.push('r.task_id = ?');
    params.push(filters.taskId);
  }
  if (filters.revision) {
    conditions.push('r.revision = ?');
    params.push(filters.revision);
  }
  if (filters.result) {
    conditions.push('r.result = ?');
    params.push(filters.result);
  }
  if (filters.source) {
    conditions.push('r.source = ?');
    params.push(filters.source);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const stmt = db.prepare(`
    SELECT 
      r.*,
      u.display_name as creator_name,
      t.title as task_title
    FROM test_reports r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN tasks t ON r.task_id = t.id
    ${whereClause}
    ORDER BY r.created_at DESC
  `);

  return stmt.all(...params);
}

export function getTestReportById(id: string, db = getDb()): any {
  const stmt = db.prepare(`
    SELECT 
      r.*,
      u.display_name as creator_name,
      t.title as task_title,
      e.original_filename as log_filename,
      e.file_path as log_path
    FROM test_reports r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN tasks t ON r.task_id = t.id
    LEFT JOIN evidence e ON r.log_artifact_id = e.id
    WHERE r.id = ?
  `);
  return stmt.get(id);
}
