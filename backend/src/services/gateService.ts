import { getDb } from '../db/connection.js';
import { CompletionGateStatus, Task } from '../types/index.js';

export function evaluateCompletionGates(taskId: string, db = getDb()): CompletionGateStatus {
  // 1. Fetch task
  const taskStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const task = taskStmt.get(taskId) as Task | undefined;

  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }

  // Fetch hub settings for gate configuration
  const settingsStmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
  const settingsRow = settingsStmt.get('completion_gates') as { value_json: string } | undefined;
  const config = settingsRow
    ? JSON.parse(settingsRow.value_json)
    : {
        requireAcceptanceCriteria: true,
        requireChangeset: true,
        requirePeerReview: true,
        requireEvidence: true,
        requirePassingTests: true,
        allowChangesetExemptions: true,
        allowTestExemptions: true
      };

  const reasons: string[] = [];

  // Gate 1: Acceptance Criteria
  const tacStmt = db.prepare('SELECT * FROM task_acceptance_criteria WHERE task_id = ?');
  const criteria = tacStmt.all(taskId) as any[];
  const totalCriteria = criteria.length;
  const satisfiedCriteria = criteria.filter((c) => c.is_satisfied === 1).length;

  let criteriaPassed = true;
  let criteriaDetail = '';

  if (config.requireAcceptanceCriteria) {
    if (totalCriteria === 0) {
      criteriaPassed = false;
      criteriaDetail = 'No acceptance criteria defined for this task. At least one criterion is required.';
      reasons.push(criteriaDetail);
    } else if (satisfiedCriteria < totalCriteria) {
      criteriaPassed = false;
      criteriaDetail = `${satisfiedCriteria} of ${totalCriteria} acceptance criteria satisfied. All criteria must be satisfied.`;
      reasons.push(criteriaDetail);
    } else {
      criteriaDetail = `All ${totalCriteria} acceptance criteria satisfied.`;
    }
  } else {
    criteriaDetail = 'Acceptance criteria verification is not enforced by hub policy.';
  }

  // Gate 2: UVCS Changeset Linked
  const csStmt = db.prepare(`
    SELECT c.* FROM uvcs_changesets c
    JOIN task_changesets tc ON c.id = tc.changeset_id
    WHERE tc.task_id = ?
  `);
  const changesets = csStmt.all(taskId) as any[];
  const isChangesetExempt = task.is_changeset_exempt === 1;

  let changesetPassed = true;
  let changesetDetail = '';

  if (isChangesetExempt) {
    changesetPassed = true;
    changesetDetail = `Changeset requirement exempt: "${task.changeset_exemption_reason || 'No reason specified'}" (Approved by: ${task.changeset_exempt_approved_by || 'Admin'})`;
  } else if (config.requireChangeset) {
    if (changesets.length === 0) {
      changesetPassed = false;
      changesetDetail = 'No UVCS changeset linked. At least one changeset must be recorded, or an authorized exemption must be filed.';
      reasons.push(changesetDetail);
    } else {
      changesetDetail = `${changesets.length} UVCS changeset(s) linked: ${changesets.map((c) => c.changeset_id).join(', ')}`;
    }
  } else {
    changesetDetail = 'Changeset linking is optional by hub policy.';
  }

  // Gate 3: Peer Review (Crucial rule: No self-approval!)
  const reviewStmt = db.prepare(`
    SELECT r.*, u.display_name as reviewer_name
    FROM reviews r
    JOIN users u ON r.reviewer_id = u.id
    WHERE r.task_id = ?
    ORDER BY r.created_at DESC
  `);
  const reviews = reviewStmt.all(taskId) as any[];

  let peerReviewPassed = false;
  let approvedReview: any = null;
  let isSelfReview = false;
  let peerReviewDetail = '';

  if (config.requirePeerReview) {
    if (reviews.length === 0) {
      peerReviewDetail = 'No peer reviews have been conducted for this task. An approved peer review is required.';
      reasons.push(peerReviewDetail);
    } else {
      // Find latest approved review
      const latestApproved = reviews.find((r) => r.decision === 'Approved');

      if (!latestApproved) {
        const latestReview = reviews[0];
        peerReviewDetail = `Latest review decision is "${latestReview.decision}". Work must be Approved before completion.`;
        reasons.push(peerReviewDetail);
      } else {
        // Check self-review restriction
        if (latestApproved.reviewer_id === task.owner_id) {
          isSelfReview = true;
          peerReviewPassed = false;
          peerReviewDetail = `Self-approval rejected! Review was conducted by task owner (${latestApproved.reviewer_name}). An independent reviewer must approve this task.`;
          reasons.push(peerReviewDetail);
        } else {
          peerReviewPassed = true;
          approvedReview = latestApproved;
          peerReviewDetail = `Approved by independent reviewer ${latestApproved.reviewer_name} on ${new Date(latestApproved.created_at).toLocaleDateString()}.`;
        }
      }
    }
  } else {
    peerReviewPassed = true;
    peerReviewDetail = 'Peer review is optional by hub policy.';
  }

  // Gate 4: Evidence Attachment
  const evidenceStmt = db.prepare('SELECT * FROM evidence WHERE task_id = ?');
  const evidenceList = evidenceStmt.all(taskId) as any[];

  let evidencePassed = true;
  let evidenceDetail = '';

  if (config.requireEvidence) {
    if (evidenceList.length === 0) {
      evidencePassed = false;
      evidenceDetail = 'No verification evidence (screenshot, video, test/build log) attached to this task.';
      reasons.push(evidenceDetail);
    } else {
      evidenceDetail = `${evidenceList.length} evidence artifact(s) attached.`;
    }
  } else {
    evidenceDetail = 'Evidence attachment is optional by hub policy.';
  }

  // Gate 5: Test and Build Reports
  const reportStmt = db.prepare(`
    SELECT * FROM test_reports
    WHERE task_id = ?
       OR revision IN (SELECT changeset_id FROM uvcs_changesets WHERE id IN (SELECT changeset_id FROM task_changesets WHERE task_id = ?))
    ORDER BY created_at DESC
  `);
  const reports = reportStmt.all(taskId, taskId) as any[];
  const isTestExempt = task.is_test_exempt === 1;

  let testsPassed = true;
  let testDetail = '';

  if (isTestExempt) {
    testsPassed = true;
    testDetail = `Automated test requirement exempt: "${task.test_exemption_reason || 'Non-code or documentation task'}" (Approved by: ${task.test_exempt_approved_by || 'Admin'})`;
  } else if (config.requirePassingTests) {
    if (reports.length === 0) {
      testsPassed = false;
      testDetail = 'No test reports found for this task or its linked changesets. A passing test run is required.';
      reasons.push(testDetail);
    } else {
      const failedReports = reports.filter((r) => r.result === 'Failed' || r.result === 'Error');
      const passedReports = reports.filter((r) => r.result === 'Passed');

      if (failedReports.length > 0 && passedReports.length === 0) {
        testsPassed = false;
        testDetail = `Latest test runs failed (${failedReports.length} failed). No passing test run on record.`;
        reasons.push(testDetail);
      } else if (passedReports.length === 0) {
        testsPassed = false;
        testDetail = 'No passing test report on record.';
        reasons.push(testDetail);
      } else {
        testsPassed = true;
        testDetail = `${passedReports.length} passing test report(s) found (Latest: ${passedReports[0].test_suite} on revision ${passedReports[0].revision}).`;
      }
    }
  } else {
    testDetail = 'Test report verification is optional by hub policy.';
  }

  // Gate 6: Dependencies
  const depStmt = db.prepare(`
    SELECT t.id, t.title, t.status
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_task_id = t.id
    WHERE td.task_id = ?
  `);
  const dependencies = depStmt.all(taskId) as any[];
  const uncompletedDeps = dependencies.filter((d) => d.status !== 'Verified Complete');

  let dependenciesPassed = true;
  let depDetail = '';

  if (uncompletedDeps.length > 0) {
    dependenciesPassed = false;
    depDetail = `Task is blocked by ${uncompletedDeps.length} incomplete dependenc(ies): ${uncompletedDeps.map((d) => `${d.id} (${d.status})`).join(', ')}`;
    reasons.push(depDetail);
  } else if (dependencies.length > 0) {
    depDetail = `All ${dependencies.length} prerequisite task dependencies are Verified Complete.`;
  } else {
    depDetail = 'No blocking dependencies.';
  }

  const allPassed =
    criteriaPassed &&
    changesetPassed &&
    peerReviewPassed &&
    evidencePassed &&
    testsPassed &&
    dependenciesPassed;

  return {
    passed: allPassed,
    gates: {
      acceptanceCriteria: {
        passed: criteriaPassed,
        total: totalCriteria,
        satisfied: satisfiedCriteria,
        detail: criteriaDetail
      },
      changesetLinked: {
        passed: changesetPassed,
        exempt: isChangesetExempt,
        exemptionReason: task.changeset_exemption_reason,
        exemptionApprovedBy: task.changeset_exempt_approved_by,
        count: changesets.length,
        detail: changesetDetail
      },
      peerReview: {
        passed: peerReviewPassed,
        approved: !!approvedReview,
        reviewerId: approvedReview?.reviewer_id || null,
        reviewerName: approvedReview?.reviewer_name || null,
        isSelfReview,
        decisionDate: approvedReview?.decision_at || approvedReview?.created_at || null,
        detail: peerReviewDetail
      },
      evidence: {
        passed: evidencePassed,
        count: evidenceList.length,
        detail: evidenceDetail
      },
      testReports: {
        passed: testsPassed,
        exempt: isTestExempt,
        exemptionReason: task.test_exemption_reason,
        exemptionApprovedBy: task.test_exempt_approved_by,
        reportsCount: reports.length,
        allPassed: testsPassed,
        detail: testDetail
      },
      dependencies: {
        passed: dependenciesPassed,
        blockedBy: uncompletedDeps.map((d) => d.id),
        detail: depDetail
      }
    },
    reasons
  };
}
