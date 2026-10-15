import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../db/schema.js';
import { evaluateCompletionGates } from '../services/gateService.js';
import { updateTaskStatus } from '../services/taskService.js';

describe('Completion Gates & Verification Logic', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    const now = new Date().toISOString();

    // Seed test users
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.internal', 'hash', '["admin","developer","reviewer"]', ?, ?),
        ('usr_yehia', 'yehia', 'Yehia', 'yehia@cindermarch.internal', 'hash', '["developer","reviewer"]', ?, ?),
        ('usr_joe', 'joe', 'Joe', 'joe@cindermarch.internal', 'hash', '["developer"]', ?, ?)
    `).run(now, now, now, now, now, now);

    // Seed project
    db.prepare(`
      INSERT INTO projects (id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'Terminal 6', 'Horror Game', 'Terminal6-Main@cindermarch', ?)
    `).run(now);

    // Seed settings
    db.prepare(`
      INSERT INTO settings (key, value_json, updated_at)
      VALUES ('completion_gates', ?, ?)
    `).run(
      JSON.stringify({
        requireAcceptanceCriteria: true,
        requireChangeset: true,
        requirePeerReview: true,
        requireEvidence: true,
        requirePassingTests: true,
        allowChangesetExemptions: true,
        allowTestExemptions: true
      }),
      now
    );
  });

  it('rejects completion if task has NO acceptance criteria', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, title, description, project_id, owner_id, reviewer_id, priority, status, creator_id, created_at, updated_at)
      VALUES ('T6-ENG-101', 'Test Task', 'Description', 'terminal-6', 'usr_yehia', 'usr_lead', 'P1', 'In Progress', 'usr_lead', ?, ?)
    `).run(now, now);

    const gateStatus = evaluateCompletionGates('T6-ENG-101', db);
    expect(gateStatus.passed).toBe(false);
    expect(gateStatus.gates.acceptanceCriteria.passed).toBe(false);
    expect(gateStatus.reasons.some((r) => r.includes('acceptance criteria'))).toBe(true);

    // Attempting to change status via task service must throw
    expect(() => {
      updateTaskStatus('T6-ENG-101', 'Verified Complete', 'usr_lead', db);
    }).toThrow(/cannot be marked Verified Complete/);
  });

  it('rejects completion if acceptance criteria are unsatisfied', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, title, description, project_id, owner_id, reviewer_id, priority, status, creator_id, created_at, updated_at)
      VALUES ('T6-ENG-102', 'Test Task', 'Description', 'terminal-6', 'usr_yehia', 'usr_lead', 'P1', 'In Progress', 'usr_lead', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, created_at)
      VALUES ('tac_1', 'T6-ENG-102', 'Criterion 1', 0, ?)
    `).run(now);

    const gateStatus = evaluateCompletionGates('T6-ENG-102', db);
    expect(gateStatus.passed).toBe(false);
    expect(gateStatus.gates.acceptanceCriteria.passed).toBe(false);
    expect(gateStatus.gates.acceptanceCriteria.satisfied).toBe(0);
    expect(gateStatus.gates.acceptanceCriteria.total).toBe(1);
  });

  it('rejects completion if SELF-APPROVAL was attempted by the task owner', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, title, description, project_id, owner_id, reviewer_id, priority, status, creator_id, created_at, updated_at)
      VALUES ('T6-ENG-103', 'Self Review Task', 'Description', 'terminal-6', 'usr_yehia', 'usr_yehia', 'P1', 'Ready for Review', 'usr_yehia', ?, ?)
    `).run(now, now);

    // Satisfy acceptance criterion
    db.prepare(`
      INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, satisfied_at, satisfied_by, created_at)
      VALUES ('tac_2', 'T6-ENG-103', 'Criterion', 1, ?, 'usr_yehia', ?)
    `).run(now, now);

    // Link changeset
    db.prepare(`
      INSERT INTO uvcs_changesets (id, repository_id, changeset_id, comment, author, timestamp, source, validation_status, created_at)
      VALUES ('cs_1', 'Terminal6-Main@cindermarch', 'cs:999', 'Fix', 'Yehia', ?, 'manual', 'unverified_manual', ?)
    `).run(now, now);
    db.prepare(`
      INSERT INTO task_changesets (id, task_id, changeset_id, linked_by, created_at)
      VALUES ('tc_1', 'T6-ENG-103', 'cs_1', 'usr_yehia', ?)
    `).run(now);

    // Add evidence
    db.prepare(`
      INSERT INTO evidence (id, task_id, uploader_id, original_filename, stored_filename, file_path, content_type, file_size, evidence_type, description, created_at)
      VALUES ('ev_1', 'T6-ENG-103', 'usr_yehia', 'test.png', 'test.png', 'uploads/test.png', 'image/png', 100, 'screenshot', 'desc', ?)
    `).run(now);

    // Add passing test report
    db.prepare(`
      INSERT INTO test_reports (id, task_id, repository_id, revision, unity_version, test_suite, result, build_result, runner_identity, source, verification_state, start_time, end_time, created_at)
      VALUES ('rpt_1', 'T6-ENG-103', 'Terminal6-Main@cindermarch', 'cs:999', '6000.0.25f1', 'Suite', 'Passed', 'Success', 'Yehia', 'manual', 'manual_unverified', ?, ?, ?)
    `).run(now, now, now);

    // Simulate review where task owner approved their own work!
    db.prepare(`
      INSERT INTO reviews (id, task_id, developer_id, reviewer_id, checklist_json, decision, created_at, decision_at)
      VALUES ('rev_self', 'T6-ENG-103', 'usr_yehia', 'usr_yehia', '[]', 'Approved', ?, ?)
    `).run(now, now);

    const gateStatus = evaluateCompletionGates('T6-ENG-103', db);
    expect(gateStatus.passed).toBe(false);
    expect(gateStatus.gates.peerReview.passed).toBe(false);
    expect(gateStatus.gates.peerReview.isSelfReview).toBe(true);
    expect(gateStatus.reasons.some((r) => r.includes('Self-approval rejected'))).toBe(true);
  });

  it('passes all completion gates when independent reviewer approves and all criteria, changeset, evidence, and tests exist', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, title, description, project_id, owner_id, reviewer_id, priority, status, creator_id, created_at, updated_at)
      VALUES ('T6-ENG-104', 'Full Task', 'Description', 'terminal-6', 'usr_yehia', 'usr_lead', 'P1', 'Ready to Integrate', 'usr_yehia', ?, ?)
    `).run(now, now);

    // 1. Acceptance criteria (all satisfied)
    db.prepare(`
      INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, satisfied_at, satisfied_by, created_at)
      VALUES ('tac_3', 'T6-ENG-104', 'Done', 1, ?, 'usr_yehia', ?)
    `).run(now, now);

    // 2. Changeset linked
    db.prepare(`
      INSERT INTO uvcs_changesets (id, repository_id, changeset_id, comment, author, timestamp, source, validation_status, created_at)
      VALUES ('cs_2', 'Terminal6-Main@cindermarch', 'cs:1000', 'Fix', 'Yehia', ?, 'manual', 'unverified_manual', ?)
    `).run(now, now);
    db.prepare(`
      INSERT INTO task_changesets (id, task_id, changeset_id, linked_by, created_at)
      VALUES ('tc_2', 'T6-ENG-104', 'cs_2', 'usr_yehia', ?)
    `).run(now);

    // 3. Independent peer review by Engine Lead (not task owner)
    db.prepare(`
      INSERT INTO reviews (id, task_id, developer_id, reviewer_id, checklist_json, decision, created_at, decision_at)
      VALUES ('rev_ok', 'T6-ENG-104', 'usr_yehia', 'usr_lead', '[]', 'Approved', ?, ?)
    `).run(now, now);

    // 4. Evidence
    db.prepare(`
      INSERT INTO evidence (id, task_id, uploader_id, original_filename, stored_filename, file_path, content_type, file_size, evidence_type, description, created_at)
      VALUES ('ev_2', 'T6-ENG-104', 'usr_yehia', 'spec.png', 'spec.png', 'uploads/spec.png', 'image/png', 500, 'screenshot', 'desc', ?)
    `).run(now);

    // 5. Passing test report
    db.prepare(`
      INSERT INTO test_reports (id, task_id, repository_id, revision, unity_version, test_suite, result, build_result, runner_identity, source, verification_state, start_time, end_time, created_at)
      VALUES ('rpt_2', 'T6-ENG-104', 'Terminal6-Main@cindermarch', 'cs:1000', '6000.0.25f1', 'Suite', 'Passed', 'Success', 'Runner', 'manual', 'manual_unverified', ?, ?, ?)
    `).run(now, now, now);

    const gateStatus = evaluateCompletionGates('T6-ENG-104', db);
    expect(gateStatus.passed).toBe(true);
    expect(gateStatus.reasons.length).toBe(0);

    // Marking task Verified Complete succeeds!
    const updated = updateTaskStatus('T6-ENG-104', 'Verified Complete', 'usr_lead', db);
    expect(updated.status).toBe('Verified Complete');
    expect(updated.completed_at).toBeTruthy();
  });

  it('supports authorized exemptions for tasks that do not require code changes or test reports', () => {
    const now = new Date().toISOString();
    // Task with changeset exemption and test exemption
    db.prepare(`
      INSERT INTO tasks (
        id, title, description, project_id, owner_id, reviewer_id,
        priority, status, creator_id,
        is_changeset_exempt, changeset_exemption_reason, changeset_exempt_approved_by,
        is_test_exempt, test_exemption_reason, test_exempt_approved_by,
        created_at, updated_at
      ) VALUES (
        'T6-ENG-105', 'Design Doc Task', 'Writing game design lore document', 'terminal-6', 'usr_joe', 'usr_lead',
        'P2', 'In Progress', 'usr_lead',
        1, 'Documentation only task - no code changes', 'usr_lead',
        1, 'Documentation only task - no Unity test suite applicable', 'usr_lead',
        ?, ?
      )
    `).run(now, now);

    // Criteria satisfied
    db.prepare(`
      INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, created_at)
      VALUES ('tac_4', 'T6-ENG-105', 'Lore approved', 1, ?)
    `).run(now);

    // Evidence
    db.prepare(`
      INSERT INTO evidence (id, task_id, uploader_id, original_filename, stored_filename, file_path, content_type, file_size, evidence_type, description, created_at)
      VALUES ('ev_3', 'T6-ENG-105', 'usr_joe', 'doc.pdf', 'doc.pdf', 'uploads/doc.pdf', 'application/pdf', 100, 'document', 'Lore PDF', ?)
    `).run(now);

    // Independent review
    db.prepare(`
      INSERT INTO reviews (id, task_id, developer_id, reviewer_id, checklist_json, decision, created_at, decision_at)
      VALUES ('rev_doc', 'T6-ENG-105', 'usr_joe', 'usr_lead', '[]', 'Approved', ?, ?)
    `).run(now, now);

    const gateStatus = evaluateCompletionGates('T6-ENG-105', db);
    expect(gateStatus.gates.changesetLinked.exempt).toBe(true);
    expect(gateStatus.gates.changesetLinked.passed).toBe(true);
    expect(gateStatus.gates.testReports.exempt).toBe(true);
    expect(gateStatus.gates.testReports.passed).toBe(true);
    expect(gateStatus.passed).toBe(true);
  });
});
