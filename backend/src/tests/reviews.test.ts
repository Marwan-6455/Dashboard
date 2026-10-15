import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../db/schema.js';
import { createReviewRequest, submitReviewDecision } from '../services/reviewService.js';

describe('Peer Review Workflow & Self-Approval Prevention', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.internal', 'hash', '["admin","developer","reviewer"]', ?, ?),
        ('usr_yehia', 'yehia', 'Yehia', 'yehia@cindermarch.internal', 'hash', '["developer","reviewer"]', ?, ?),
        ('usr_joe', 'joe', 'Joe', 'joe@cindermarch.internal', 'hash', '["developer"]', ?, ?)
    `).run(now, now, now, now, now, now);

    db.prepare(`
      INSERT INTO projects (id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'Terminal 6', 'Horror Game', 'Terminal6-Main@cindermarch', ?)
    `).run(now);

    db.prepare(`
      INSERT INTO tasks (id, title, description, project_id, owner_id, reviewer_id, priority, status, creator_id, created_at, updated_at)
      VALUES ('T6-ENG-201', 'Review Target Task', 'Desc', 'terminal-6', 'usr_yehia', 'usr_lead', 'P0', 'In Progress', 'usr_lead', ?, ?)
    `).run(now, now);
  });

  it('rejects assigning developer to review their own work on request creation', () => {
    expect(() => {
      createReviewRequest(
        {
          taskId: 'T6-ENG-201',
          developerId: 'usr_yehia',
          reviewerId: 'usr_yehia' // Self-review attempt!
        },
        'usr_yehia',
        db
      );
    }).toThrow(/Self-review violation/);
  });

  it('rejects developer submitting an approval decision on their own work', () => {
    // Legitimate review created with Engine Lead as reviewer
    const review = createReviewRequest(
      {
        taskId: 'T6-ENG-201',
        developerId: 'usr_yehia',
        reviewerId: 'usr_lead'
      },
      'usr_yehia',
      db
    );

    // Now Yehia tries to approve their own work
    expect(() => {
      submitReviewDecision(
        review.id,
        {
          decision: 'Approved',
          findings: 'I reviewed my own code and it looks great'
        },
        'usr_yehia', // Self-approval!
        db
      );
    }).toThrow(/Self-approval rejected/);
  });

  it('allows authorized non-owner reviewer to approve review and updates task status', () => {
    const review = createReviewRequest(
      {
        taskId: 'T6-ENG-201',
        developerId: 'usr_yehia',
        reviewerId: 'usr_lead'
      },
      'usr_yehia',
      db
    );

    const approved = submitReviewDecision(
      review.id,
      {
        decision: 'Approved',
        findings: 'Clean code architecture and verified in editor.'
      },
      'usr_lead', // Engine Lead (independent reviewer)
      db
    );

    expect(approved.decision).toBe('Approved');
    expect(approved.reviewer_id).toBe('usr_lead');

    // Check task status moved to Ready to Integrate
    const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get('T6-ENG-201') as { status: string };
    expect(task.status).toBe('Ready to Integrate');
  });

  it('requires findings or required fixes when Changes Requested', () => {
    const review = createReviewRequest(
      {
        taskId: 'T6-ENG-201',
        developerId: 'usr_yehia',
        reviewerId: 'usr_lead'
      },
      'usr_yehia',
      db
    );

    expect(() => {
      submitReviewDecision(
        review.id,
        {
          decision: 'Changes Requested',
          findings: '' // Empty findings!
        },
        'usr_lead',
        db
      );
    }).toThrow(/mandatory when requesting changes/);
  });
});
