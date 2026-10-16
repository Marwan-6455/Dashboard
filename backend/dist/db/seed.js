"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const connection_js_1 = require("./connection.js");
const migrations_js_1 = require("./migrations.js");
function seedDatabase(db = (0, connection_js_1.getDb)()) {
    // 1. Always run all migrations first
    (0, migrations_js_1.runMigrations)(db);
    const now = new Date().toISOString();
    // 2. Ensure primary Cindermarch Studio workspace exists
    const existingWs = db.prepare("SELECT * FROM workspaces WHERE id = 'ws_cindermarch'").get();
    const kngUser = db.prepare("SELECT id FROM users WHERE username = 'KNG_MG'").get();
    const ownerId = kngUser ? kngUser.id : 'usr_system_init';
    if (!existingWs) {
        db.prepare(`
      INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
      VALUES ('ws_cindermarch', 'Cindermarch Studio', 'cindermarch', ?, ?, ?)
    `).run(ownerId, now, now);
    }
    else if (kngUser && existingWs.owner_id !== kngUser.id) {
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
    // 4. Ensure Terminal 6 and Blue Note Lounge projects exist
    db.prepare(`
    INSERT INTO projects (id, workspace_id, name, description, repository_id, status, owner_id, unity_version, created_at)
    VALUES (
      'terminal-6',
      'ws_cindermarch',
      'Terminal 6',
      'Psychological horror game set around an abandoned, reality-shifting train station. Engine: Unity 6000.0.25f1',
      'Terminal6-Main@cindermarch',
      'active',
      'usr_lead',
      '6000.0.25f1',
      ?
    )
    ON CONFLICT(id) DO UPDATE SET
      name = 'Terminal 6',
      status = 'active',
      unity_version = '6000.0.25f1'
  `).run(now);
    db.prepare(`
    INSERT INTO projects (id, workspace_id, name, description, repository_id, status, owner_id, unity_version, created_at)
    VALUES (
      'blue-note-lounge',
      'ws_cindermarch',
      'Blue Note Lounge',
      'Noir mystery narrative game set in an evocative retro jazz lounge. Atmospheric lighting, branching character dialogue, and rich jazz score. Engine: Unity 6000.0.25f1',
      'BlueNote-Main@cindermarch',
      'active',
      'usr_lead',
      '6000.0.25f1',
      ?
    )
    ON CONFLICT(id) DO UPDATE SET
      name = 'Blue Note Lounge',
      status = 'active',
      unity_version = '6000.0.25f1'
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
    insertSetting.run('completion_gates', JSON.stringify({
        requireAcceptanceCriteria: true,
        requireChangeset: true,
        requirePeerReview: true,
        requireEvidence: true,
        requirePassingTests: true,
        allowChangesetExemptions: true,
        allowTestExemptions: true
    }), now);
    insertSetting.run('hub_info', JSON.stringify({
        hubName: 'Cindermarch Engine Hub',
        projectSubtitle: 'Terminal 6 Development Management',
        currentUnityVersion: '6000.0.25f1',
        defaultRepo: 'Terminal6-Main@cindermarch',
        logoUrl: '/cindermarch-logo.png',
        timezone: 'Africa/Cairo'
    }), now);
    // 7. Ensure integration configs exist
    const insertConfig = db.prepare(`
    INSERT INTO integration_configs (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
    insertConfig.run('uvcs', JSON.stringify({
        provider: 'manual',
        status: 'manual_mode',
        organization: 'cindermarch',
        repository: 'Terminal6-Main',
        serverUrl: 'https://cloud.plasticscm.com',
        cliPath: 'cm',
        lastTestResult: null,
        notes: 'Operating in manual changeset recording mode. Automated UVCS CLI / Cloud API connection requires Plastic SCM / Unity DevOps credentials.'
    }), now);
    insertConfig.run('unity_test_runner', JSON.stringify({
        status: 'ready_for_ingestion',
        endpoint: '/api/integrations/unity-test-report',
        apiTokenConfigured: true,
        apiToken: 'cm-test-ingest-token-t6-dev',
        notes: 'Ready to receive JSON test reports from Unity Test Framework via command line runner or CI webhook.'
    }), now);
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
    `).run(JSON.stringify({
            timezone: 'Africa/Cairo',
            deadline24h: true,
            deadline2h: true,
            deadlineDue: true,
            overdueDaily: true,
            escalationEnabled: true
        }), now, now);
    }
    // 9. Seed Milestones
    const insertMilestone = db.prepare(`
    INSERT INTO milestones (id, project_id, title, description, target_date, owner_id, status, completion_requirements, completed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertMilestone.run('mls_t6_alpha', 'terminal-6', 'M1: Station Navigation & Horror Atmosphere (Alpha)', 'Core station level geometry, reality-shifting trigger zones, first playable encounter.', '2026-11-15T18:00:00Z', 'usr_lead', 'In Progress', 'All station corridors navigable, 60fps stable on GTX 1060 baseline, UTF automated test suite passing.', null, now, now);
    insertMilestone.run('mls_t6_beta', 'terminal-6', 'M2: Reality-Shifting Mechanics & Full Audio Spatialization (Beta)', 'Full psychological horror loop, procedural audio occlusion, complete story act 1.', '2026-12-20T18:00:00Z', 'usr_lead', 'Planned', 'FMOD spatial audio bus validated, peer review gate satisfied on all gameplay scripts.', null, now, now);
    insertMilestone.run('mls_bnl_proto', 'blue-note-lounge', 'M1: Jazz Club Ambience & Character Dialogue Tree (Prototype)', 'Interactive jazz bar environment, Vincent Vance dialogue tree, piano trigger mechanics.', '2026-11-30T18:00:00Z', 'usr_yehia', 'In Progress', 'Branching dialogue graph verified, dynamic FMOD stem switching operational.', null, now, now);
    // 10. Seed Sprints
    const insertSprint = db.prepare(`
    INSERT INTO sprints (id, project_id, team_id, name, goal, start_date, end_date, capacity_hours, status, retrospective_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertSprint.run('sp_t6_14', 'terminal-6', 'team_engine', 'Sprint 14: Sub-level Occlusion & AI Pathing', 'Resolve corridor occlusion culling and polish AI pathing in shifting train cars.', '2026-10-10T00:00:00Z', '2026-10-24T23:59:59Z', 80, 'Active', null, now, now);
    insertSprint.run('sp_bnl_03', 'blue-note-lounge', 'team_coding', 'Sprint 03: Dialogue Graph Engine & Piano Key Triggers', 'Complete branching dialogue nodes and piano interaction feedback.', '2026-10-12T00:00:00Z', '2026-10-26T23:59:59Z', 60, 'Active', null, now, now);
    // 11. Seed Bugs & QA Lab
    const insertBug = db.prepare(`
    INSERT INTO bugs (
      id, project_id, title, description, severity, priority,
      reporter_id, assigned_to, assigned_team_id, affected_build, affected_platform,
      steps_to_reproduce, expected_behavior, actual_behavior, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertBug.run('BUG-T6-001', 'terminal-6', 'Audio spatialization occlusion drop in sub-level tunnel corridor', 'When transitioning from Platform 4 to the underground maintenance shaft, reverb and occlusion cut off abruptly instead of smoothly interpolating.', 'Major', 'P1', 'usr_joe', 'usr_yehia', 'team_sound', 'v0.8.2-alpha', 'PC/Steam', '1. Walk through the rusted double gate on Platform 4.\n2. Crouch under the collapsed girder.\n3. Observe ambient audio transition.', 'Reverb and occlusion should smoothly fade using the portal depth buffer.', 'Audio instantly drops to 0dB dry signal for two frames.', 'In Progress', now, now);
    insertBug.run('BUG-T6-002', 'terminal-6', 'Camera clipping through Victorian luggage trolley on Platform 2', 'Near-clip plane cuts into the brass corner of the vintage trolley when crouching against the brick pillar.', 'Minor', 'P2', 'usr_lead', 'usr_joe', 'team_3d_artists', 'v0.8.2-alpha', 'PC/Steam', '1. Move to Platform 2 pillar C.\n2. Crouch against the wooden luggage trolley.\n3. Look up at 45 degrees.', 'Player capsule collision keeps camera outside the trolley mesh.', 'Camera near plane clips through trolley interior.', 'Reported', now, now);
    insertBug.run('BUG-BNL-001', 'blue-note-lounge', 'Dialogue state machine does not clear flags on exit conversation', 'Pressing ESC during Vincent Vance dialogue branch keeps player interaction state flagged as in-dialogue.', 'Major', 'P1', 'usr_lead', 'usr_yehia', 'team_coding', 'v0.2.1-proto', 'PC/Steam', '1. Initiate conversation with Vincent Vance.\n2. Select topic 2.\n3. Press ESC before audio line completes.', 'Dialogue state resets to idle and movement controls unlock.', 'Movement remains locked until clicking the conversation window again.', 'Confirmed', now, now);
    // 12. Seed Assets Vault
    const insertAsset = db.prepare(`
    INSERT INTO assets (
      id, project_id, team_id, name, category, description, owner_id, version,
      status, pipeline_stage, tags_json, preview_url, technical_meta_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertAsset.run('ast_t6_clock', 'terminal-6', 'team_3d_artists', 'Old Brass Platform Clock', '3d_model', 'Detailed 1940s station double-faced clock with oscillating pendulum and cracked glass lens.', 'usr_joe', 'v1.2', 'Approved', 'Approved', JSON.stringify(['prop', 'station', 'metal', 'hero']), 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=400&q=80', JSON.stringify({ polycount: 4280, textureRes: '2048x2048', lods: 3, prefab: 'Prefabs/Props/PlatformClock.prefab' }), now, now);
    insertAsset.run('ast_t6_ambience', 'terminal-6', 'team_sound', 'Station Wind & Distant Rail Groan', 'sfx', 'Haunting spatial background loop composed of wind gusts through shattered skylights and metallic rail tension.', 'usr_yehia', 'v1.0', 'Approved', 'Integrated', JSON.stringify(['ambience', 'horror', 'loop', 'spatial']), null, JSON.stringify({ sampleRate: 48000, channels: 2, durationSec: 45.2, looping: true, loudnessLUFS: -18.5 }), now, now);
    insertAsset.run('ast_bnl_theme', 'blue-note-lounge', 'team_sound', 'Rain on the Neon Awning (Main Theme Motif)', 'music', 'Smoky, melancholic muted trumpet with slow walking upright bass and subtle vinyl flutter.', 'usr_yehia', 'v0.9', 'Ready for Review', 'Mixing', JSON.stringify(['jazz', 'ost', 'theme', 'noir']), null, JSON.stringify({ sampleRate: 48000, channels: 2, durationSec: 124.0, bpm: 72, keySignature: 'D Minor' }), now, now);
    insertAsset.run('ast_bnl_vincent', 'blue-note-lounge', 'team_3d_artists', 'Vincent Vance Character Concept & Turnaround', 'concept_art', 'Full costume and facial turnaround for resident jazz pianist Vincent Vance, highlighting cigarette burn scar on knuckles.', 'usr_joe', 'v1.0', 'Approved', 'Modeling', JSON.stringify(['character', 'vincent', 'concept', 'costume']), 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80', JSON.stringify({ format: 'PSD/PNG', resolution: '4096x2048', artist: 'Joe' }), now, now);
    // 13. Seed Story Bible Entries
    const insertStory = db.prepare(`
    INSERT INTO story_bible_entries (
      id, project_id, category, title, summary, body, tags_json, status, author_id, approved_by, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertStory.run('st_t6_passengers', 'terminal-6', 'lore', 'The Displaced Passengers of 1947', 'The historical incident when Train 404 vanished between platforms.', 'In November 1947, the night express departed Terminal 6 with seventy-two passengers. When it crossed the junction under signal tower 4, the track switches vibrated violently but the train never entered the tunnel. Decades later, travelers waiting on the disused platform report hearing footsteps echoing in sync with their own.', JSON.stringify(['lore', 'mystery', 'station', 'train-404']), 'Canon Approved', 'usr_lead', 'usr_lead', '1.0', now, now);
    insertStory.run('st_bnl_vincent', 'blue-note-lounge', 'character', 'Vincent Vance - The Weary Virtuoso', 'Resident jazz pianist at the Blue Note Lounge who knows too much about the disappearances in the district.', 'Vincent has played the Steinway at the Blue Note for fifteen years. His fingers know the keys better than his own memories. His right hand carries a faint burn scar from the warehouse district fire. He speaks in measured sentences and watches every newcomer through the brass mirror mounted above the upright piano.', JSON.stringify(['character', 'npc', 'vincent', 'jazz']), 'Canon Approved', 'usr_yehia', 'usr_lead', '1.0', now, now);
    // 14. Seed Wiki Documents
    const insertDoc = db.prepare(`
    INSERT INTO documents (
      id, workspace_id, project_id, team_id, category, title, content, author_id, tags_json, is_pinned, version, created_at, updated_at
    ) VALUES (?, 'ws_cindermarch', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertDoc.run('doc_t6_arch', 'terminal-6', 'team_engine', 'architecture', 'Terminal 6 Tone & Rendering Architecture Guide', '# Terminal 6 Rendering & Atmosphere Architecture\n\n## Visual Tenets\n1. Deep graphites, wet slate, and oxidized brass.\n2. Volumetric fog in underground shafts.\n3. Reality shifting transitions must use non-euclidean portal depth buffers rather than standard screen fades.\n\n## Performance Budget\n- Maximum 1.8M polygons on screen simultaneously.\n- Shader complexity capped at 45 instructions per surface shader.', 'usr_lead', JSON.stringify(['rendering', 'hdrp', 'architecture', 'performance']), 1, 1, now, now);
    insertDoc.run('doc_bnl_audio', 'blue-note-lounge', 'team_sound', 'audio_guide', 'Blue Note Audio Bus & Spatial Acoustics Guide', '# Blue Note Lounge Acoustic Design\n\n## Bus Routing\n- Master / Music / Piano_Stem / Reverb_Hall.\n- Master / Ambience / Rain_Glass / Crowd_Mutter.\n\n## Dynamic Mix Rules\n- Dialogue reduces piano high-pass frequencies by 6dB automatically.', 'usr_yehia', JSON.stringify(['fmod', 'mixing', 'audio', 'standards']), 1, 1, now, now);
    // 15. Seed Decisions (ADR)
    const insertDecision = db.prepare(`
    INSERT INTO decisions (
      id, workspace_id, project_id, title, scope, context, options_considered, chosen_approach,
      reasoning, author_id, status, approver_id, created_at, updated_at
    ) VALUES (?, 'ws_cindermarch', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertDecision.run('ADR-001', 'terminal-6', 'ADR-001: HDRP Custom Depth-Buffer Shifting vs Stencil Portals', 'Engine', 'Terminal 6 requires seamless transitions between the realistic 1940s station and the nightmare shifting geometry.', '1. Stencil buffer masking with multi-camera rendering.\n2. Custom HDRP fullscreen pass with raymarched distance fields.\n3. Pre-baked scene streaming triggers.', 'Custom HDRP depth-buffer portal pass with compute shader assistance.', 'Provides deterministic framerates on target hardware without duplicating camera render passes.', 'usr_lead', 'Accepted', 'usr_lead', now, now);
    insertDecision.run('ADR-002', 'blue-note-lounge', 'ADR-002: Dynamic Music Layering via FMOD Studio Stems', 'Audio', 'The music must react dynamically to the player approaching tables or asking tense questions.', '1. AudioSource crossfading in Unity audio engine.\n2. FMOD Studio parameter-driven multi-track events.', 'FMOD Studio parameter-driven event with 4 intensity layers.', 'Zero click artifacts on transition and sample-accurate bar sync.', 'usr_yehia', 'Accepted', 'usr_lead', now, now);
    // 16. Seed Builds & Releases
    const insertBuild = db.prepare(`
    INSERT INTO builds (
      id, project_id, build_number, version, branch, build_target, unity_version,
      status, release_approved, release_approved_by, changelog, release_owner_id, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertBuild.run('bld_t6_082', 'terminal-6', 'B-082', 'v0.8.2-alpha', 'main', 'Windows', '6000.0.25f1', 'Succeeded', 1, 'usr_lead', 'Added sub-level station navigation, updated occlusion culling, imported UTF automated tests.', 'usr_lead', now, now);
    const insertRelease = db.prepare(`
    INSERT INTO releases (
      id, project_id, name, version, build_id, status, checklist_json, target_date, released_at, notes, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertRelease.run('rel_t6_alpha', 'terminal-6', 'Terminal 6 Internal Studio Alpha', 'v0.8.2-alpha', 'bld_t6_082', 'Released', JSON.stringify({
        testsPassing: true,
        noP0Bugs: true,
        leadApproved: true,
        assetsVerified: true
    }), now, now, 'First internal milestone release playable by the full studio.', 'usr_lead', now);
    // 17. Seed Marketing Items
    const insertMkt = db.prepare(`
    INSERT INTO marketing_items (
      id, project_id, campaign, channel, title, copy, scheduled_date, status, owner_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    insertMkt.run('mkt_t6_steam', 'terminal-6', 'Steam Wishlist 10k Milestone', 'Steam', 'Terminal 6 Steam Storefront Update & Teaser', 'Something waits on Platform 6. The train was scheduled for 1947. You are eighty years late.', '2026-11-01T12:00:00Z', 'Review', 'usr_lead', now);
    // 18. Seed Standups
    const insertStandup = db.prepare(`
    INSERT INTO standups (
      id, workspace_id, team_id, user_id, completed_yesterday, planned_today, blockers, help_needed, date, created_at
    ) VALUES (?, 'ws_cindermarch', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
    const todayDate = now.slice(0, 10);
    insertStandup.run(`std_lead_${todayDate}`, 'team_engine', 'usr_lead', 'Implemented non-euclidean portal depth pass and audited collision gates.', 'Profile frametime in Platform 4 corridor and assist Yehia with sound occlusion.', 'None.', 'None.', todayDate, now);
    insertStandup.run(`std_yehia_${todayDate}`, 'team_sound', 'usr_yehia', 'Mixed steam train horn reverberation and recorded jazz piano stems.', 'Fix BUG-T6-001 audio occlusion glitch in subway car.', 'Awaiting updated geometry prefab from Joe.', 'Need updated mesh collider export.', todayDate, now);
    insertStandup.run(`std_joe_${todayDate}`, 'team_3d_artists', 'usr_joe', 'Textured brass station clock and luggage trolleys.', 'Export optimized subway car collision mesh for Yehia and fix camera clip bug BUG-T6-002.', 'None.', 'None.', todayDate, now);
    console.log('[Seed] Database initialized with Cindermarch Studio members, teams, and studio operating system entities.');
}
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
    seedDatabase();
}
