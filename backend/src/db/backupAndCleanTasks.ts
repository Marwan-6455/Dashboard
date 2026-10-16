import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './connection.js';

export function backupAndCleanTasks(db = getDb()) {
  const backupDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, 'tasks_backup.json');

  // 1. Export existing demo task data
  console.log('[Cleanup] Exporting existing task records to backup file...');
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const criteria = db.prepare('SELECT * FROM task_acceptance_criteria').all();
  const comments = db.prepare('SELECT * FROM task_comments').all();
  const changesets = db.prepare('SELECT * FROM uvcs_changesets').all();
  const taskChangesets = db.prepare('SELECT * FROM task_changesets').all();
  const reviews = db.prepare('SELECT * FROM reviews').all();
  const evidence = db.prepare('SELECT * FROM evidence').all();
  const testReports = db.prepare('SELECT * FROM test_reports').all();
  const activity = db.prepare('SELECT * FROM activity_events').all();

  const backupPayload = {
    exportedAt: new Date().toISOString(),
    taskCount: tasks.length,
    tasks,
    criteria,
    comments,
    changesets,
    taskChangesets,
    reviews,
    evidence,
    testReports,
    activity
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), 'utf-8');
  console.log(`[Cleanup] Successfully backed up ${tasks.length} tasks to ${backupPath}`);

  // 2. First update workspace owner to real user KNG_MG
  const kngUser = db.prepare("SELECT id FROM users WHERE username = 'KNG_MG'").get() as { id: string } | undefined;
  if (kngUser) {
    console.log(`[Cleanup] Setting real user KNG_MG (${kngUser.id}) as Owner of Cindermarch Studio workspace...`);
    db.prepare("UPDATE workspaces SET owner_id = ? WHERE id = 'ws_cindermarch'").run(kngUser.id);
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES ('wm_kng_mg_cindermarch', 'ws_cindermarch', ?, 'owner', datetime('now'))
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = 'owner'
    `).run(kngUser.id);
    db.prepare("UPDATE users SET workspace_id = 'ws_cindermarch' WHERE id = ?").run(kngUser.id);
  }

  // 3. Clear demo tasks and associated rows
  console.log('[Cleanup] Clearing demo tasks, evidence, reviews, and test reports...');
  db.exec(`
    DELETE FROM task_acceptance_criteria;
    DELETE FROM task_comments;
    DELETE FROM task_dependencies;
    DELETE FROM task_changesets;
    DELETE FROM reviews;
    DELETE FROM test_reports;
    DELETE FROM evidence;
    DELETE FROM uvcs_changesets;
    DELETE FROM scheduled_reminders;
    DELETE FROM discord_event_outbox;
    DELETE FROM tasks;
    DELETE FROM notifications;
    DELETE FROM activity_events;
    DELETE FROM workspace_invitations;
  `);

  // 4. Remove hardcoded demo users (Lead, Yehia, Joe)
  console.log('[Cleanup] Removing hardcoded demo user accounts (Lead, Yehia, Joe)...');
  db.exec(`
    DELETE FROM discord_link_requests;
    DELETE FROM discord_account_links WHERE user_id IN ('usr_lead', 'usr_yehia', 'usr_joe');
    DELETE FROM workspace_members WHERE user_id IN ('usr_lead', 'usr_yehia', 'usr_joe');
    DELETE FROM users WHERE id IN ('usr_lead', 'usr_yehia', 'usr_joe');
  `);

  // 5. Create or verify Cindermarch AI Assistant service identity
  console.log('[Cleanup] Ensuring Cindermarch AI Assistant service identity exists...');
  db.prepare(`
    INSERT INTO users (id, username, display_name, email, password_hash, roles, avatar_url, workspace_id, created_at, updated_at)
    VALUES (
      'usr_cindermarch_assistant',
      'cindermarch_assistant',
      'Cindermarch AI Assistant',
      'assistant@cindermarch.studio',
      'LOCKED_SERVICE_ACCOUNT_NO_LOGIN',
      '["developer"]',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=128&q=80',
      'ws_cindermarch',
      datetime('now'),
      datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET display_name = 'Cindermarch AI Assistant'
  `).run();

  console.log('[Cleanup] Complete. Task board is now clean and empty.');
}

if (process.argv[1]?.includes('backupAndCleanTasks')) {
  backupAndCleanTasks();
}
