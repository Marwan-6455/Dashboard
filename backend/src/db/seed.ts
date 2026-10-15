import { getDb } from './connection.js';
import { runMigrations } from './migrations.js';
import bcrypt from 'bcryptjs';

export function seedDatabase(db = getDb()): void {
  runMigrations(db);

  // Check if users already exist
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = checkStmt.get() as { count: number };
  if (result && result.count > 0) {
    // If users exist, check if workspace exists
    const wsCheck = db.prepare('SELECT COUNT(*) as count FROM workspaces').get() as { count: number };
    if (wsCheck && wsCheck.count === 0) {
      const now = new Date().toISOString();
      const insertWs = db.prepare(`
        INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
        VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', 'usr_lead', ?, ?)
      `);
      insertWs.run(now, now);

      const insertMember = db.prepare(`
        INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertMember.run('wm_lead', 'ws_cindermarch', 'usr_lead', 'owner', now);
      insertMember.run('wm_yehia', 'ws_cindermarch', 'usr_yehia', 'developer', now);
      insertMember.run('wm_joe', 'ws_cindermarch', 'usr_joe', 'developer', now);

      db.prepare("UPDATE projects SET workspace_id = 'ws_cindermarch' WHERE workspace_id IS NULL").run();
      db.prepare("UPDATE tasks SET workspace_id = 'ws_cindermarch' WHERE workspace_id IS NULL").run();
    }
    return;
  }

  console.log('Seeding database with Cindermarch Terminal 6 initial data...');

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync('Terminal6#Studio', 10);

  // 1. Seed Team Members
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, display_name, email, password_hash, roles, avatar_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'usr_lead',
    'lead',
    'Engine Lead',
    'lead@cindermarch.internal',
    passwordHash,
    JSON.stringify(['owner', 'admin', 'developer', 'reviewer']),
    '/cindermarch-logo.png',
    now,
    now
  );

  insertUser.run(
    'usr_yehia',
    'yehia',
    'Yehia',
    'yehia@cindermarch.internal',
    passwordHash,
    JSON.stringify(['developer', 'reviewer']),
    null,
    now,
    now
  );

  insertUser.run(
    'usr_joe',
    'joe',
    'Joe',
    'joe@cindermarch.internal',
    passwordHash,
    JSON.stringify(['developer']),
    null,
    now,
    now
  );

  // 2. Seed Primary Studio Workspace
  const insertWorkspace = db.prepare(`
    INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertWorkspace.run(
    'ws_cindermarch',
    'Cindermarch Studio',
    'cindermarch',
    'usr_lead',
    now,
    now
  );

  // 3. Seed Workspace Memberships
  const insertMember = db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertMember.run('wm_lead', 'ws_cindermarch', 'usr_lead', 'owner', now);
  insertMember.run('wm_yehia', 'ws_cindermarch', 'usr_yehia', 'developer', now);
  insertMember.run('wm_joe', 'ws_cindermarch', 'usr_joe', 'developer', now);

  // 4. Seed Project
  const insertProject = db.prepare(`
    INSERT INTO projects (id, workspace_id, name, description, repository_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertProject.run(
    'terminal-6',
    'ws_cindermarch',
    'Terminal 6',
    'Psychological horror game set around an abandoned, reality-shifting train station. Engine: Unity 6000.0.25f1',
    'Terminal6-Main@cindermarch',
    now
  );

  // 5. Seed Default Hub Settings
  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
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
      logoUrl: '/cindermarch-logo.png'
    }),
    now
  );

  // 6. Seed Integrations Config
  const insertConfig = db.prepare(`
    INSERT INTO integration_configs (key, value_json, updated_at)
    VALUES (?, ?, ?)
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

  insertConfig.run(
    'discord',
    JSON.stringify({
      status: 'not_configured',
      webhookUrl: '',
      channel: '#t6-dev-alerts',
      notifyOnReview: true,
      notifyOnComplete: true,
      notifyOnFailedTest: true,
      notes: 'Discord webhook is not yet configured. Provide a Discord incoming webhook URL in Settings to enable notifications.'
    }),
    now
  );

  // 7. Seed UVCS Changeset (DEMO DATA)
  const insertChangeset = db.prepare(`
    INSERT INTO uvcs_changesets (id, repository_id, changeset_id, branch, comment, author, timestamp, affected_files_json, source, validation_status, external_link, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertChangeset.run(
    'cs_demo_1042',
    'Terminal6-Main@cindermarch',
    'cs:1042',
    '/main/audio/station-static',
    '[DEMO DATA] Implement spatial audio attenuation and radio static filters for station interior',
    'Yehia',
    '2026-10-14T14:30:00Z',
    JSON.stringify([
      'Assets/Scripts/Audio/RadioStaticController.cs',
      'Assets/Scripts/Audio/SpatialZoneTrigger.cs',
      'Assets/Audio/Mixers/StationInteriorMixer.mixer'
    ]),
    'manual',
    'unverified_manual',
    null,
    'usr_yehia',
    now
  );

  insertChangeset.run(
    'cs_demo_1043',
    'Terminal6-Main@cindermarch',
    'cs:1043',
    '/main/vfx/fog-volumetrics',
    '[DEMO DATA] ShaderGraph custom HLSL node for train platform low-lying volumetric fog',
    'Joe',
    '2026-10-15T09:15:00Z',
    JSON.stringify([
      'Assets/Shaders/PlatformVolumetricFog.shadergraph',
      'Assets/Scripts/Environment/FogDensityVolume.cs'
    ]),
    'manual',
    'unverified_manual',
    null,
    'usr_joe',
    now
  );

  // 8. Seed Tasks (DEMO DATA)
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id, title, description, project_id, workspace_id, category,
      owner_id, reviewer_id, priority, status, deadline, estimated_effort, actual_effort,
      tags_json, creator_id, is_changeset_exempt, changeset_exemption_reason, changeset_exempt_approved_by,
      is_test_exempt, test_exemption_reason, test_exempt_approved_by,
      completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // T6-ENG-001 (In Progress)
  insertTask.run(
    'T6-ENG-001',
    '[DEMO DATA] Player Locomotive Cab Interactions & Controls',
    'Implement the physics-based throttle lever, pneumatic brake valve, and cab light toggles for the class-4 locomotive stalled at Platform 3.',
    'terminal-6',
    'ws_cindermarch',
    'Gameplay',
    'usr_yehia',
    'usr_lead',
    'P0',
    'In Progress',
    '2026-10-25T18:00:00Z',
    '16h',
    '8h',
    JSON.stringify(['locomotive', 'physics', 'controls']),
    'usr_lead',
    0, null, null, 0, null, null,
    null, now, now
  );

  // T6-ENG-002 (Ready for Review)
  insertTask.run(
    'T6-ENG-002',
    '[DEMO DATA] Procedural Fog Volumetrics around Terminal 6 Platforms',
    'Implement height-attenuated atmospheric scattering and noise jitter along platform tracks to simulate dense chemical smog.',
    'terminal-6',
    'ws_cindermarch',
    'VFX',
    'usr_joe',
    'usr_yehia',
    'P1',
    'Ready for Review',
    '2026-10-20T18:00:00Z',
    '12h',
    '10h',
    JSON.stringify(['shaders', 'vfx', 'fog']),
    'usr_lead',
    0, null, null, 0, null, null,
    null, now, now
  );

  // T6-ENG-003 (Verified Complete)
  insertTask.run(
    'T6-ENG-003',
    '[DEMO DATA] Station Audio Distortion & Spatialized Radio Static',
    'Configure station master broadcast speakers with low-pass distortion and spatialized Doppler effect when player traverses corridor B.',
    'terminal-6',
    'ws_cindermarch',
    'Audio',
    'usr_yehia',
    'usr_lead',
    'P1',
    'Verified Complete',
    '2026-10-14T20:00:00Z',
    '8h',
    '7h',
    JSON.stringify(['audio', 'static', 'ambience']),
    'usr_lead',
    0, null, null, 0, null, null,
    now, now, now
  );

  // T6-ENG-004 (Blocked)
  insertTask.run(
    'T6-ENG-004',
    '[DEMO DATA] AI Stalker Pathfinding on Distorted Track Geometry',
    'NavMesh baking fails on non-Euclidean station stairwells where gravity normal shifts 45 degrees dynamically.',
    'terminal-6',
    'ws_cindermarch',
    'Engine',
    'usr_lead',
    'usr_joe',
    'P0',
    'Blocked',
    '2026-10-22T18:00:00Z',
    '24h',
    '12h',
    JSON.stringify(['ai', 'navmesh', 'blocker']),
    'usr_yehia',
    0, null, null, 0, null, null,
    null, now, now
  );

  // 9. Seed Acceptance Criteria for Tasks
  const insertCriteria = db.prepare(`
    INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, satisfied_at, satisfied_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCriteria.run('tac_001_1', 'T6-ENG-001', 'Brake lever exhibits spring resistance when pulled past 60%', 1, now, 'usr_yehia', now);
  insertCriteria.run('tac_001_2', 'T6-ENG-001', 'Cab light switches click with tactile feedback and sound cue', 0, null, null, now);
  insertCriteria.run('tac_001_3', 'T6-ENG-001', 'Speedometer needle reflects realistic inertia curve', 0, null, null, now);

  insertCriteria.run('tac_002_1', 'T6-ENG-002', 'Volumetric fog maintains 60 FPS on target minimum GPU profile', 1, now, 'usr_joe', now);
  insertCriteria.run('tac_002_2', 'T6-ENG-002', 'No light leaking through station concrete pillars', 1, now, 'usr_joe', now);

  insertCriteria.run('tac_003_1', 'T6-ENG-003', 'Audio mixer ducks high frequencies when player enters subterranean cellar', 1, now, 'usr_yehia', now);
  insertCriteria.run('tac_003_2', 'T6-ENG-003', 'Radio static crackles with randomized dropouts under station canopy', 1, now, 'usr_yehia', now);

  insertCriteria.run('tac_004_1', 'T6-ENG-004', 'Stalker agent traverses dynamic tilted track surfaces without jitter', 0, null, null, now);

  // 10. Link Changesets
  const linkCs = db.prepare(`
    INSERT INTO task_changesets (id, task_id, changeset_id, linked_by, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  linkCs.run('tc_003', 'T6-ENG-003', 'cs_demo_1042', 'usr_yehia', now);
  linkCs.run('tc_002', 'T6-ENG-002', 'cs_demo_1043', 'usr_joe', now);

  // 11. Seed Evidence for T6-ENG-003
  const insertEvidence = db.prepare(`
    INSERT INTO evidence (
      id, task_id, uploader_id, original_filename, stored_filename,
      file_path, content_type, file_size, evidence_type,
      description, external_url, related_changeset_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEvidence.run(
    'ev_demo_001',
    'T6-ENG-003',
    'usr_yehia',
    'station_audio_debug_spectrogram.png',
    'ev_demo_001_station_audio_debug_spectrogram.png',
    'uploads/ev_demo_001_station_audio_debug_spectrogram.png',
    'image/png',
    245760,
    'screenshot',
    '[DEMO DATA] Spectrogram capture showing smooth high-frequency roll-off and spatial attenuation inside Corridor B',
    null,
    'cs_demo_1042',
    now
  );

  insertEvidence.run(
    'ev_demo_002',
    'T6-ENG-002',
    'usr_joe',
    'platform_fog_renderdoc_profile.txt',
    'ev_demo_002_platform_fog_renderdoc_profile.txt',
    'uploads/ev_demo_002_platform_fog_renderdoc_profile.txt',
    'text/plain',
    4280,
    'test_log',
    '[DEMO DATA] RenderDoc GPU frame breakdown measuring 1.4ms frame cost for platform fog pass',
    null,
    'cs_demo_1043',
    now
  );

  // 12. Seed Test Report for T6-ENG-003
  const insertReport = db.prepare(`
    INSERT INTO test_reports (
      id, task_id, repository_id, revision, unity_version, test_suite,
      result, passed_count, failed_count, skipped_count, build_result,
      runner_identity, log_artifact_id, source, verification_state,
      start_time, end_time, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReport.run(
    'rpt_demo_001',
    'T6-ENG-003',
    'Terminal6-Main@cindermarch',
    'cs:1042',
    '6000.0.25f1',
    'PlayMode.AudioSystems',
    'Passed',
    14, 0, 0,
    'Success',
    'Yehia (Manual Verification via Unity Test Runner)',
    'ev_demo_001',
    'manual',
    'manual_unverified',
    '2026-10-14T15:00:00Z',
    '2026-10-14T15:04:12Z',
    'usr_yehia',
    now
  );

  // 13. Seed Peer Review for T6-ENG-003
  const insertReview = db.prepare(`
    INSERT INTO reviews (
      id, task_id, developer_id, reviewer_id, changeset_id,
      checklist_json, decision, findings, required_fixes,
      created_at, decision_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checklistItems = [
    { id: 'chk_1', label: 'Correct task and scope', passed: true },
    { id: 'chk_2', label: 'Changeset reference recorded (cs:1042)', passed: true },
    { id: 'chk_3', label: 'Relevant audio mixer & C# scripts inspected', passed: true },
    { id: 'chk_4', label: 'Acceptance criteria tested in PlayMode', passed: true },
    { id: 'chk_5', label: 'Edge cases checked (rapid corridor re-entry)', passed: true },
    { id: 'chk_6', label: 'No new Console warnings or audio buffer underruns', passed: true },
    { id: 'chk_7', label: 'Automated test results verified', passed: true },
    { id: 'chk_8', label: 'Evidence spectrogram inspected and verified', passed: true },
    { id: 'chk_9', label: 'Integration requirements satisfied', passed: true }
  ];

  insertReview.run(
    'rev_demo_001',
    'T6-ENG-003',
    'usr_yehia',
    'usr_lead',
    'cs_demo_1042',
    JSON.stringify(checklistItems),
    'Approved',
    '[DEMO DATA] Audio curves match design specifications. Radio static feels authentic to 1980s train comms without ear fatigue.',
    null,
    now,
    now
  );

  // 14. Seed Activity Events
  const insertActivity = db.prepare(`
    INSERT INTO activity_events (id, actor_id, action, related_task_id, previous_value, new_value, source, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertActivity.run(
    'act_001',
    'usr_lead',
    'task_created',
    'T6-ENG-001',
    null,
    'Backlog',
    'application',
    JSON.stringify({ title: '[DEMO DATA] Player Locomotive Cab Interactions & Controls' }),
    now
  );

  insertActivity.run(
    'act_002',
    'usr_yehia',
    'status_changed',
    'T6-ENG-001',
    'Backlog',
    'In Progress',
    'application',
    null,
    now
  );

  insertActivity.run(
    'act_003',
    'usr_joe',
    'changeset_linked',
    'T6-ENG-002',
    null,
    'cs:1043',
    'application',
    JSON.stringify({ branch: '/main/vfx/fog-volumetrics' }),
    now
  );

  insertActivity.run(
    'act_004',
    'usr_lead',
    'review_approved',
    'T6-ENG-003',
    'Ready for Review',
    'Approved',
    'review',
    JSON.stringify({ reviewId: 'rev_demo_001' }),
    now
  );

  insertActivity.run(
    'act_005',
    'usr_lead',
    'task_verified_complete',
    'T6-ENG-003',
    'Ready to Integrate',
    'Verified Complete',
    'application',
    JSON.stringify({ completionGatesPassed: true }),
    now
  );

  // 15. Seed Welcome Notification for Engine Lead
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, related_task_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);

  insertNotif.run(
    'notif_001',
    'usr_lead',
    'review_requested',
    'Review Requested',
    'Joe requested a review for T6-ENG-002: Procedural Fog Volumetrics',
    'T6-ENG-002',
    now
  );

  console.log('Seeding completed successfully with workspace ws_cindermarch!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
