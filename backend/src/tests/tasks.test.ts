import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../db/schema.js';
import { createTask, generateTaskId, toggleAcceptanceCriterion, updateTask } from '../services/taskService.js';

describe('Task Management & Safe Sequential ID Generation', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.internal', 'hash', '["admin","developer"]', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO projects (id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'Terminal 6', 'Horror Game', 'Terminal6-Main@cindermarch', ?)
    `).run(now);
  });

  it('generates sequential unique task IDs (T6-ENG-001, T6-ENG-002, etc.)', () => {
    const id1 = generateTaskId(db);
    expect(id1).toBe('T6-ENG-001');

    createTask({ title: 'Task One', description: 'Desc One' }, 'usr_lead', db);

    const id2 = generateTaskId(db);
    expect(id2).toBe('T6-ENG-002');

    createTask({ title: 'Task Two', description: 'Desc Two' }, 'usr_lead', db);

    const id3 = generateTaskId(db);
    expect(id3).toBe('T6-ENG-003');
  });

  it('creates task with acceptance criteria and logs activity event', () => {
    const task = createTask(
      {
        title: 'Player Flashlight Battery Drain',
        description: 'Implement non-linear discharge curve when uv filter is engaged.',
        priority: 'P0',
        acceptanceCriteria: ['Battery drains 2x faster in UV mode', 'Flicker animation triggers under 15%']
      },
      'usr_lead',
      db
    );

    expect(task.id).toBe('T6-ENG-001');
    expect(task.priority).toBe('P0');
    expect(task.acceptance_criteria.length).toBe(2);

    // Verify activity event was created
    const actStmt = db.prepare('SELECT * FROM activity_events WHERE related_task_id = ?');
    const activities = actStmt.all('T6-ENG-001') as any[];
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0].action).toBe('task_created');

    // Toggle criterion
    const critId = task.acceptance_criteria[0].id;
    const toggled = toggleAcceptanceCriterion(critId, true, 'usr_lead', db);
    expect(toggled.is_satisfied).toBe(1);
    expect(toggled.satisfied_by).toBe('usr_lead');
  });
});
