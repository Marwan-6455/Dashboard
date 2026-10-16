import { getDb } from './connection.js';
import { runMigrations } from './migrations.js';

export function seedDatabase(db = getDb()): void {
  // 1. Always run all migrations first
  runMigrations(db);

  const now = new Date().toISOString();

  // 2. Ensure primary Cindermarch Studio workspace exists
  const existingWs = db.prepare("SELECT * FROM workspaces WHERE id = 'ws_cindermarch'").get() as any;
  const kngUser = db.prepare("SELECT id FROM users WHERE username = 'KNG_MG'").get() as { id: string } | undefined;
  const ownerId = kngUser ? kngUser.id : 'usr_system_init';

  if (!existingWs) {
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', ?, ?, ?)
    `).run(ownerId, now, now);
  } else if (kngUser && existingWs.owner_id !== kngUser.id) {
    db.prepare("UPDATE workspaces SET owner_id = ? WHERE id = 'ws_cindermarch'").run(kngUser.id);
  }

  // Ensure KNG_MG is an owner in workspace_members if present
  if (kngUser) {
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES ('wm_kng_mg_cindermarch', 'ws_cindermarch', ?, 'owner', ?)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = 'owner'
    `).run(kngUser.id, now);
    db.prepare("UPDATE users SET workspace_id = 'ws_cindermarch' WHERE id = ?").run(kngUser.id);
  }

  // 3. Ensure Cindermarch AI Assistant service identity exists (NOT a human developer, NO ordinary login)
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
      ?,
      ?
    )
    ON CONFLICT(id) DO UPDATE SET display_name = 'Cindermarch AI Assistant'
  `).run(now, now);

  // 4. Ensure Terminal 6 project exists
  db.prepare(`
    INSERT INTO projects (id, workspace_id, name, description, repository_id, created_at)
    VALUES (
      'terminal-6',
      'ws_cindermarch',
      'Terminal 6',
      'Psychological horror game set around an abandoned, reality-shifting train station. Engine: Unity 6000.0.25f1',
      'Terminal6-Main@cindermarch',
      ?
    )
    ON CONFLICT(id) DO UPDATE SET name = 'Terminal 6'
  `).run(now);

  // 5. Ensure the 6 real Studio Teams exist
  const sixTeams = [
    {
      id: 'team_story',
      name: 'Story Team',
      slug: 'story',
      description: 'Narrative design, lore, dialogue, world-building, and script writing.'
    },
    {
      id: 'team_coding',
      name: 'Coding Team',
      slug: 'coding',
      description: 'Gameplay systems, AI logic, UI programming, and client gameplay architecture.'
    },
    {
      id: 'team_marketing',
      name: 'Marketing Team',
      slug: 'marketing',
      description: 'Community engagement, social media, trailers, press kits, and promotional campaigns.'
    },
    {
      id: 'team_engine',
      name: 'Engine Team',
      slug: 'engine',
      description: 'Core engine development, rendering pipeline, physics optimization, performance profiling, and toolchain.'
    },
    {
      id: 'team_3d_artists',
      name: '3D Artists',
      slug: '3d-artists',
      description: '3D character modeling, environment art, texturing, rigging, animation, and asset integration.'
    },
    {
      id: 'team_sound',
      name: 'Sound Team',
      slug: 'sound',
      description: 'Original score, sound effects (SFX), foley, voiceover mastering, and audio engine integration.'
    }
  ];

  const insertTeam = db.prepare(`
    INSERT INTO teams (id, workspace_id, name, slug, description, project_id, created_at, updated_at)
    VALUES (?, 'ws_cindermarch', ?, ?, ?, 'terminal-6', ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description
  `);

  for (const t of sixTeams) {
    insertTeam.run(t.id, t.name, t.slug, t.description, now, now);
  }

  // 5b. Ensure restored team members exist with verified credentials (Terminal6#Studio)
  const restoredUsers = [
    {
      id: 'usr_lead',
      username: 'lead',
      displayName: 'Marwan Hossam',
      email: 'lead@cindermarch.internal',
      roles: '["developer", "reviewer", "admin"]',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80',
      passwordHash: '$2b$10$z6mxlHAQVyQRFZ4PjtkRMufgeXKGVSGn5nMqn5Kihz2L4tT1PFbCG' // Terminal6#Studio
    },
    {
      id: 'usr_yehia',
      username: 'yehia',
      displayName: 'Yehia',
      email: 'yehia@cindermarch.internal',
      roles: '["developer", "reviewer"]',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=128&q=80',
      passwordHash: '$2b$10$z6mxlHAQVyQRFZ4PjtkRMufgeXKGVSGn5nMqn5Kihz2L4tT1PFbCG' // Terminal6#Studio
    },
    {
      id: 'usr_joe',
      username: 'joe',
      displayName: 'Joe',
      email: 'joe@cindermarch.internal',
      roles: '["developer"]',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=128&q=80',
      passwordHash: '$2b$10$z6mxlHAQVyQRFZ4PjtkRMufgeXKGVSGn5nMqn5Kihz2L4tT1PFbCG' // Terminal6#Studio
    }
  ];

  const upsertUser = db.prepare(`
    INSERT INTO users (id, username, display_name, email, password_hash, roles, avatar_url, workspace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ws_cindermarch', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      display_name = excluded.display_name,
      email = excluded.email,
      roles = excluded.roles,
      password_hash = excluded.password_hash,
      workspace_id = 'ws_cindermarch',
      updated_at = excluded.updated_at
  `);

  const upsertMember = db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, 'ws_cindermarch', ?, 'developer', ?)
    ON CONFLICT(workspace_id, user_id) DO NOTHING
  `);

  for (const u of restoredUsers) {
    upsertUser.run(u.id, u.username, u.displayName, u.email, u.passwordHash, u.roles, u.avatarUrl, now, now);
    upsertMember.run(`wm_${u.username}`, u.id, now);
  }

  // Appoint Marwan Hossam as Engine Lead (manager of Engine Team)
  db.prepare("UPDATE teams SET manager_id = 'usr_lead', updated_at = ? WHERE id = 'team_engine'").run(now);

  // Assign team memberships
  const teamMemberships = [
    { id: 'tm_lead_engine', teamId: 'team_engine', userId: 'usr_lead', role: 'manager' },
    { id: 'tm_lead_coding', teamId: 'team_coding', userId: 'usr_lead', role: 'member' },
    { id: 'tm_joe_artists', teamId: 'team_3d_artists', userId: 'usr_joe', role: 'member' },
    { id: 'tm_joe_engine', teamId: 'team_engine', userId: 'usr_joe', role: 'member' },
    { id: 'tm_yehia_coding', teamId: 'team_coding', userId: 'usr_yehia', role: 'member' },
    { id: 'tm_yehia_sound', teamId: 'team_sound', userId: 'usr_yehia', role: 'member' }
  ];

  const upsertTm = db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(team_id, user_id) DO UPDATE SET role = excluded.role
  `);

  for (const tm of teamMemberships) {
    upsertTm.run(tm.id, tm.teamId, tm.userId, tm.role, now);
  }

  // 6. Ensure default completion gates and hub settings exist
  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);

  insertSetting.run(
    'completion_gates',
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

  insertSetting.run(
    'hub_info',
    JSON.stringify({
      hubName: 'Cindermarch Engine Hub',
      projectSubtitle: 'Terminal 6 Development Management',
      currentUnityVersion: '6000.0.25f1',
      defaultRepo: 'Terminal6-Main@cindermarch',
      logoUrl: '/cindermarch-logo.png',
      timezone: 'Africa/Cairo'
    }),
    now
  );

  // 7. Ensure integration configs exist
  const insertConfig = db.prepare(`
    INSERT INTO integration_configs (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);

  insertConfig.run(
    'uvcs',
    JSON.stringify({
      provider: 'manual',
      status: 'manual_mode',
      organization: 'cindermarch',
      repository: 'Terminal6-Main',
      serverUrl: 'https://cloud.plasticscm.com',
      cliPath: 'cm',
      lastTestResult: null,
      notes: 'Operating in manual changeset recording mode. Automated UVCS CLI / Cloud API connection requires Plastic SCM / Unity DevOps credentials.'
    }),
    now
  );

  insertConfig.run(
    'unity_test_runner',
    JSON.stringify({
      status: 'ready_for_ingestion',
      endpoint: '/api/integrations/unity-test-report',
      apiTokenConfigured: true,
      apiToken: 'cm-test-ingest-token-t6-dev',
      notes: 'Ready to receive JSON test reports from Unity Test Framework via command line runner or CI webhook.'
    }),
    now
  );

  // 8. Ensure Discord Guild Config exists with actual guild ID and client ID
  const guildConfig = db.prepare("SELECT * FROM discord_guild_configs WHERE workspace_id = 'ws_cindermarch'").get();
  if (!guildConfig) {
    db.prepare(`
      INSERT INTO discord_guild_configs (
        id, workspace_id, guild_id, guild_name,
        announcements_channel_id, engine_channel_id, coding_channel_id,
        story_channel_id, marketing_channel_id, artists_channel_id, sound_channel_id,
        qa_channel_id, escalation_channel_id, reminder_policy_json, is_active, created_at, updated_at
      ) VALUES (
        'dgc_ws_cindermarch',
        'ws_cindermarch',
        '1394770347030483034',
        'Cindermarch Studio Operations',
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        ?,
        1,
        ?,
        ?
      )
    `).run(
      JSON.stringify({
        timezone: 'Africa/Cairo',
        deadline24h: true,
        deadline2h: true,
        deadlineDue: true,
        overdueDaily: true,
        escalationEnabled: true
      }),
      now,
      now
    );
  }

  console.log('[Seed] Database initialized with Cindermarch Studio members, teams, and project tasks.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
