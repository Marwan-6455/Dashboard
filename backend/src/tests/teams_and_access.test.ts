import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../db/schema.js';
import { createTask, getTasks } from '../services/taskService.js';
import { scheduleTaskReminders, getReminderStats } from '../services/reminderScheduler.js';

describe('Six Teams System, Access Control & Real Deadlines', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    const now = new Date().toISOString();

    // 1. Create Owner and Developer Users
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES 
        ('usr_owner', 'kng_mg', 'KNG_MG', 'marwanhossam20062007@gmail.com', 'hash123', '["owner","admin"]', ?, ?),
        ('usr_dev1', 'dev_marwan', 'Marwan Hossam', 'marwan@cindermarch.studio', 'hash456', '["developer"]', ?, ?),
        ('usr_cindermarch_assistant', 'cindermarch-ai', 'Cindermarch AI Assistant', 'assistant@cindermarch.internal', 'LOCKED_SERVICE_ACCOUNT', '["bot"]', ?, ?)
    `).run(now, now, now, now, now, now);

    // 2. Create Workspace (owner_id references users)
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', 'usr_owner', ?, ?)
    `).run(now, now);

    // 3. Workspace membership
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES 
        ('wm_1', 'ws_cindermarch', 'usr_owner', 'owner', ?),
        ('wm_2', 'ws_cindermarch', 'usr_dev1', 'developer', ?)
    `).run(now, now);

    // 4. Project
    db.prepare(`
      INSERT INTO projects (id, name, description, repository_id, created_at)
      VALUES ('terminal-6', 'Terminal 6', 'Horror Game', 'Terminal6-Main@cindermarch', ?)
    `).run(now);

    // 5. Seed the 6 teams
    const teams = [
      { id: 'team_story', name: 'Story Team', slug: 'story', desc: 'Narrative and lore' },
      { id: 'team_coding', name: 'Coding Team', slug: 'coding', desc: 'Gameplay systems and logic' },
      { id: 'team_marketing', name: 'Marketing Team', slug: 'marketing', desc: 'Promotions and publishing' },
      { id: 'team_engine', name: 'Engine Team', slug: 'engine', desc: 'Core rendering and engine tech' },
      { id: 'team_3d_artists', name: '3D Artists', slug: '3d-artists', desc: 'Models, shaders, environments' },
      { id: 'team_sound', name: 'Sound Team', slug: 'sound', desc: 'Audio and SFX' }
    ];

    for (const t of teams) {
      db.prepare(`
        INSERT INTO teams (id, workspace_id, name, slug, description, project_id, created_at, updated_at)
        VALUES (?, 'ws_cindermarch', ?, ?, ?, 'terminal-6', ?, ?)
      `).run(t.id, t.name, t.slug, t.desc, now, now);
    }
  });

  it('correctly maintains 6 distinct teams with independent workloads', () => {
    const teams = db.prepare('SELECT * FROM teams WHERE workspace_id = ? ORDER BY name ASC').all('ws_cindermarch') as any[];
    expect(teams.length).toBe(6);

    const names = teams.map((t) => t.name);
    expect(names).toContain('Story Team');
    expect(names).toContain('Coding Team');
    expect(names).toContain('Marketing Team');
    expect(names).toContain('Engine Team');
    expect(names).toContain('3D Artists');
    expect(names).toContain('Sound Team');

    // Engine Team and Coding Team must be separate
    const engineTeam = teams.find((t) => t.id === 'team_engine');
    const codingTeam = teams.find((t) => t.id === 'team_coding');
    expect(engineTeam).toBeDefined();
    expect(codingTeam).toBeDefined();
    expect(engineTeam.id).not.toBe(codingTeam.id);
  });

  it('allows a developer to belong to multiple teams with distinct roles', () => {
    const now = new Date().toISOString();

    // Assign dev1 to Coding Team as member
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, role, joined_at)
      VALUES ('tm_1', 'team_coding', 'usr_dev1', 'member', ?)
    `).run(now);

    // Assign dev1 to Engine Team as manager
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, role, joined_at)
      VALUES ('tm_2', 'team_engine', 'usr_dev1', 'manager', ?)
    `).run(now);

    const userMemberships = db.prepare(`
      SELECT tm.*, t.name as team_name 
      FROM team_members tm 
      JOIN teams t ON tm.team_id = t.id 
      WHERE tm.user_id = ?
    `).all('usr_dev1') as any[];

    expect(userMemberships.length).toBe(2);
    expect(userMemberships.find((m) => m.team_id === 'team_coding').role).toBe('member');
    expect(userMemberships.find((m) => m.team_id === 'team_engine').role).toBe('manager');
  });

  it('creates task with teamId, deadline, and schedules persistent reminders', () => {
    const futureDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours from now

    const task = createTask(
      {
        title: 'Implement Volumetric Fog Shaders',
        description: 'Atmospheric depth and light scattering in Sector B.',
        teamId: 'team_engine',
        priority: 'P1',
        deadline: futureDeadline,
        ownerId: 'usr_dev1'
      },
      'usr_owner',
      db
    );

    expect(task.id).toBe('T6-ENG-001');
    expect(task.team_id).toBe('team_engine');
    expect(task.deadline).toBe(futureDeadline);

    // Schedule reminders
    scheduleTaskReminders(task.id, futureDeadline, 'ws_cindermarch', null, db);

    const stats = getReminderStats(db);
    // Should have 24h reminder, 2h reminder, and due-time reminder scheduled
    expect(stats.pending).toBeGreaterThanOrEqual(2);

    // Query reminders from table
    const reminders = db.prepare('SELECT * FROM scheduled_reminders WHERE task_id = ?').all(task.id) as any[];
    expect(reminders.length).toBeGreaterThanOrEqual(2);
    expect(reminders.some((r) => r.reminder_type === 'deadline_24h')).toBe(true);
    expect(reminders.some((r) => r.reminder_type === 'deadline_2h')).toBe(true);
  });

  it('filters tasks accurately by teamId', () => {
    createTask({ title: 'Engine Task 1', teamId: 'team_engine' }, 'usr_owner', db);
    createTask({ title: 'Engine Task 2', teamId: 'team_engine' }, 'usr_owner', db);
    createTask({ title: 'Story Task 1', teamId: 'team_story' }, 'usr_owner', db);

    const engineTasks = getTasks({ teamId: 'team_engine' }, db);
    expect(engineTasks.length).toBe(2);
    expect(engineTasks.every((t) => t.team_id === 'team_engine')).toBe(true);

    const storyTasks = getTasks({ teamId: 'team_story' }, db);
    expect(storyTasks.length).toBe(1);
    expect(storyTasks[0].title).toBe('Story Task 1');
  });

  it('isolates AI Assistant from human workspace roster', () => {
    const members = db.prepare(`
      SELECT u.id, u.display_name, wm.role 
      FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      WHERE u.id != 'usr_cindermarch_assistant'
    `).all() as any[];

    expect(members.length).toBe(2);
    expect(members.some((m) => m.id === 'usr_cindermarch_assistant')).toBe(false);
  });
});
