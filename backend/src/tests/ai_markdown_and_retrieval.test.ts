import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getDb } from '../db/connection.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { app } from '../app.js';
import { AIAssistantService } from '../services/aiAssistantService.js';
import { createSession } from '../middleware/auth.js';

describe('AI Chat Markdown Rendering & Grounded Studio Telemetry Retrieval', () => {
  let sessionToken: string;
  let csrfToken: string;

  beforeAll(() => {
    const db = getDb();
    runMigrations(db);
    seedDatabase(db);

    // Create session for usr_lead (Marwan Hossam)
    const session = createSession('usr_lead');
    sessionToken = session.sessionToken;
    csrfToken = session.csrfToken;
  });

  describe('1. Truthful Studio Intelligence Retrieval (No Default Greetings)', () => {
    it('answers "tell me about terminal 6" with psychological horror lore, engine version, and milestones', async () => {
      const res = await AIAssistantService.query('tell me about terminal 6', 'usr_lead', 'ws_cindermarch');

      expect(res.answer).toBeDefined();
      // Verifies it is NOT a generic greeting
      expect(res.answer).not.toContain('Welcome to the Studio Operating System.');
      expect(res.answer).toContain('Terminal 6');
      expect(res.answer).toContain('psychological horror game');
      expect(res.answer).toContain('Unity 6000.0.25f1');
      expect(res.answer).toContain('Train 404');
      expect(res.answer).toContain('Project Health');
      expect(res.answer).toContain('ADR-001');

      // Citations verified
      expect(res.citations.length).toBeGreaterThan(0);
      const prjCitation = res.citations.find(c => c.id === 'terminal-6');
      expect(prjCitation).toBeDefined();
      expect(prjCitation?.url).toContain('/projects');
    });

    it('answers "tell me about blue note lounge" with noir mystery narrative and Vincent Vance', async () => {
      const res = await AIAssistantService.query('tell me about blue note lounge', 'usr_lead', 'ws_cindermarch');

      expect(res.answer).toBeDefined();
      expect(res.answer).toContain('Blue Note Lounge');
      expect(res.answer).toContain('noir mystery narrative game');
      expect(res.answer).toContain('Vincent Vance');
      expect(res.answer).toContain('ADR-002');
      expect(res.answer).toContain('Unity 6000.0.25f1');

      const prjCitation = res.citations.find(c => c.id === 'blue-note-lounge');
      expect(prjCitation).toBeDefined();
    });

    it('confirms different questions produce distinctly different, tailored responses', async () => {
      const resStory = await AIAssistantService.query('who is vincent vance in the story bible', 'usr_lead', 'ws_cindermarch');
      const resBugs = await AIAssistantService.query('summarize open critical bugs and QA failures', 'usr_lead', 'ws_cindermarch');
      const resTeams = await AIAssistantService.query("summarize this week's progress for all six teams", 'usr_lead', 'ws_cindermarch');
      const resArch = await AIAssistantService.query('what is the rendering architecture decision for portal depth buffer', 'usr_lead', 'ws_cindermarch');

      // None of them are identical
      expect(resStory.answer).not.toEqual(resBugs.answer);
      expect(resStory.answer).not.toEqual(resTeams.answer);
      expect(resBugs.answer).not.toEqual(resArch.answer);

      // Verify each answers its specific domain
      expect(resStory.answer).toContain('Story Bible');
      expect(resStory.answer).toContain('Vincent Vance');
      expect(resBugs.answer).toContain('QA Lab & Bug Triage Summary');
      expect(resBugs.answer).toContain('BUG-');
      expect(resTeams.answer).toContain('Studio Multi-Department Operations');
      expect(resTeams.answer).toContain('Engine Team');
      expect(resArch.answer).toContain('ADR-001');
      expect(resArch.answer).toContain('HDRP');
    });
  });

  describe('2. Project Authorization & Security Access Control', () => {
    it('blocks queries when project does not belong to authorized workspace', async () => {
      // Create a foreign project in a separate workspace
      const db = getDb();
      try {
        db.prepare(`
          INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
          VALUES ('ws_foreign', 'Foreign Studio', 'foreign', 'usr_lead', datetime('now'), datetime('now'))
          ON CONFLICT(id) DO NOTHING
        `).run();
        db.prepare(`
          INSERT INTO projects (id, workspace_id, name, description, repository_id, status, created_at)
          VALUES ('prj_secret_foreign', 'ws_foreign', 'Top Secret Foreign Game', 'Confidential', 'SecretRepo', 'active', datetime('now'))
          ON CONFLICT(id) DO NOTHING
        `).run();
      } catch {}

      // Attempt to query foreign project via HTTP POST /api/ai/query
      const res = await request(app)
        .post('/api/ai/query')
        .set('x-session-token', sessionToken)
        .set('x-csrf-token', csrfToken)
        .send({
          prompt: 'Tell me about the secret foreign game',
          projectId: 'prj_secret_foreign'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects unauthenticated requests to /api/ai/query', async () => {
      const res = await request(app)
        .post('/api/ai/query')
        .send({ prompt: 'Tell me about terminal 6' });

      expect(res.status).toBe(401);
    });

    it('returns 400 for empty or missing prompt', async () => {
      const res = await request(app)
        .post('/api/ai/query')
        .set('x-session-token', sessionToken)
        .set('x-csrf-token', csrfToken)
        .send({ prompt: '   ' });

      expect(res.status).toBe(400);
    });
  });

  describe('3. AI Operational Status & Conversation History', () => {
    it('GET /api/ai/status truthfully exposes provider and model status', async () => {
      const res = await request(app).get('/api/ai/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
      expect(res.body).toHaveProperty('isGeminiAvailable');
      expect(res.body).toHaveProperty('provider');
      expect(res.body).toHaveProperty('model');
      expect(res.body.activeProjects).toContain('terminal-6');
    });

    it('records conversation audit log in database on query', async () => {
      const testPrompt = `Audit check prompt ${Date.now()}`;
      await request(app)
        .post('/api/ai/query')
        .set('x-session-token', sessionToken)
        .set('x-csrf-token', csrfToken)
        .send({
          prompt: testPrompt,
          projectId: 'terminal-6'
        });

      // Verify audit history endpoint
      const histRes = await request(app)
        .get('/api/ai/history')
        .set('x-session-token', sessionToken);

      expect(histRes.status).toBe(200);
      expect(histRes.body.history.length).toBeGreaterThan(0);
      const found = histRes.body.history.find((h: any) => h.prompt === testPrompt);
      expect(found).toBeDefined();
      expect(found.response).toBeDefined();
    });
  });

  describe('4. Assistant Markdown Structure & Citation Safety', () => {
    it('produces structured Markdown with headings, bold text, lists, and inline code', async () => {
      const res = await AIAssistantService.query('tell me about terminal 6', 'usr_lead', 'ws_cindermarch');

      // Headings
      expect(res.answer).toMatch(/###\s+[^\n]+/);
      expect(res.answer).toMatch(/####\s+[^\n]+/);

      // Bold text
      expect(res.answer).toMatch(/\*\*[^*]+\*\*/);

      // Bullet lists
      expect(res.answer).toMatch(/^-\s+\*\*[^*]+\*\*:/m);

      // Inline code
      expect(res.answer).toMatch(/`[^`]+`/);

      // All citation URLs use safe in-app routes
      for (const citation of res.citations) {
        expect(citation.url.startsWith('/')).toBe(true);
        expect(citation.url).not.toContain('javascript:');
      }
    });

    it('handles malformed, strange, and edge-case prompts without crashing', async () => {
      const strangePrompts = [
        '### <script>alert("xss")</script>',
        '**unclosed bold and *italic and `unclosed code',
        '||||||| table without content',
        '> > > nested blockquotes',
        '1. 2. 3. 4. random numbers',
        'javascript:alert(1) [clickme](javascript:void(0))',
        '   \n\n\n\n\t\t\t   ',
        'What is Terminal 6? Tell me everything!'
      ];

      for (const p of strangePrompts) {
        if (!p.trim()) continue;
        const res = await AIAssistantService.query(p, 'usr_lead', 'ws_cindermarch');
        expect(res).toBeDefined();
        expect(typeof res.answer).toBe('string');
        expect(res.answer.length).toBeGreaterThan(0);
        expect(Array.isArray(res.citations)).toBe(true);
      }
    });
  });

  describe('5. Factual Grounding, Integration Disclosure & Concise Overview Verification', () => {
    it('provides a concise overview for simple project queries with follow-up options', async () => {
      const res = await AIAssistantService.query('tell me about terminal 6', 'usr_lead', 'ws_cindermarch');

      expect(res.answer).toContain('Terminal 6 — Studio Project Overview');
      expect(res.answer).toContain('psychological horror game');
      expect(res.answer).toContain('Unity 6000.0.25f1');
      expect(res.answer).toContain('Terminal6-Main@cindermarch');
      expect(res.answer).toContain('PC/Steam');
      expect(res.answer).toContain('Incident of November 1947');
      expect(res.answer).toContain('Train 404');

      // Transparent integration disclosure
      expect(res.answer).toContain('Studio Database');
      expect(res.answer).toContain('UVCS (Plastic SCM)');
      expect(res.answer).toContain('Unity Editor Live-link');
      expect(res.answer).toContain('Disconnected');

      // Follow-up prompt choices (Requirement 6)
      expect(res.answer).toContain('What would you like to explore next?');
      expect(res.answer).toContain('Technical Architecture & Budgets');
      expect(res.answer).toContain('Milestones & Production Health');
      expect(res.answer).toContain('QA Lab & Active Defects');
      expect(res.answer).toContain('Story Bible & Lore Details');

      // Citations verified to real database routes
      const projectCitation = res.citations.find(c => c.id === 'terminal-6');
      expect(projectCitation?.url).toBe('/projects?projectId=terminal-6');
      const storyCitation = res.citations.find(c => c.id === 'st_t6_passengers');
      expect(storyCitation?.url).toBe('/story-bible?entryId=st_t6_passengers');
    });

    it('retrieves verified technical architecture and performance budgets without fabrication', async () => {
      const res = await AIAssistantService.query(
        'What is the rendering architecture and performance budget for Terminal 6?',
        'usr_lead',
        'ws_cindermarch'
      );

      // ADR-001 facts verified against DB
      expect(res.answer).toContain('ADR-001');
      expect(res.answer).toContain('Custom HDRP depth-buffer portal pass');
      expect(res.answer).toContain('compute shader assistance');

      // Performance budget verified against doc_t6_arch
      expect(res.answer).toContain('1.8M polygons');
      expect(res.answer).toContain('45 instructions');

      // Live telemetry disclosure
      expect(res.answer).toContain('Unity Editor live socket bridge is currently disconnected');

      // Citations
      const adrCitation = res.citations.find(c => c.id === 'ADR-001');
      expect(adrCitation).toBeDefined();
      expect(adrCitation?.url).toBe('/decisions?decisionId=ADR-001');
      const docCitation = res.citations.find(c => c.id === 'doc_t6_arch');
      expect(docCitation).toBeDefined();
      expect(docCitation?.url).toBe('/wiki?docId=doc_t6_arch');
    });

    it('retrieves exact milestone target dates without fabricating dates or progress', async () => {
      const res = await AIAssistantService.query(
        'What are the active milestones for Terminal 6?',
        'usr_lead',
        'ws_cindermarch'
      );

      expect(res.answer).toContain('M1: Station Navigation & Horror Atmosphere (Alpha)');
      expect(res.answer).toContain('2026-11-15');
      expect(res.answer).toContain('M2: Reality-Shifting Mechanics & Full Audio Spatialization (Beta)');
      expect(res.answer).toContain('2026-12-20');
      expect(res.answer).toContain('GTX 1060 baseline');
      expect(res.answer).toContain('Sprint 14: Sub-level Occlusion & AI Pathing');

      const m1Citation = res.citations.find(c => c.id === 'mls_t6_alpha');
      expect(m1Citation).toBeDefined();
      expect(m1Citation?.url).toContain('/projects?projectId=terminal-6');
    });

    it('reports exact QA defect counts and details matching database rows', async () => {
      const res = await AIAssistantService.query(
        'Summarize open bugs and QA triage for Terminal 6',
        'usr_lead',
        'ws_cindermarch'
      );

      // Verify count dynamically against database
      const db = getDb();
      const openCount = (db.prepare("SELECT COUNT(*) as count FROM bugs WHERE project_id = 'terminal-6' AND status NOT IN ('Verified', 'Rejected')").get() as any).count;
      expect(res.answer).toContain(`**${openCount}** open defect(s)`);
      expect(res.answer).toContain('BUG-T6-001');
      expect(res.answer).toContain('Audio spatialization occlusion drop');
      expect(res.answer).toContain('BUG-T6-002');
      expect(res.answer).toContain('Camera clipping through Victorian luggage trolley');

      // Citations point directly to QA bug routes
      const bug1Citation = res.citations.find(c => c.id === 'BUG-T6-001');
      expect(bug1Citation?.url).toBe('/bugs?bugId=BUG-T6-001');
      const bug2Citation = res.citations.find(c => c.id === 'BUG-T6-002');
      expect(bug2Citation?.url).toBe('/bugs?bugId=BUG-T6-002');
    });

    it('truthfully declares unverified platform targets and disconnected live telemetry', async () => {
      // Query about live FPS from Unity Editor
      const resFps = await AIAssistantService.query(
        'What is the live FPS and GPU time right now in the Unity Editor?',
        'usr_lead',
        'ws_cindermarch'
      );
      expect(resFps.answer).toContain('Unavailable Integration');
      expect(resFps.answer).toContain('Unity Editor Live-link is disconnected');
      expect(resFps.answer).toContain('Unity 6000.0.25f1');

      // Query about console release budget
      const resConsole = await AIAssistantService.query(
        'What is the polygon budget for Nintendo Switch and PlayStation 5?',
        'usr_lead',
        'ws_cindermarch'
      );
      expect(resConsole.answer).toContain('Unverified Platform Target');
      expect(resConsole.answer).toContain('PC/Steam');
      expect(resConsole.answer).toContain('unverified and not documented');
    });

    it('GET /api/ai/status returns verified integration states', async () => {
      const res = await request(app).get('/api/ai/status');

      expect(res.status).toBe(200);
      expect(res.body.integrations).toBeDefined();
      expect(res.body.integrations.database.status).toBe('connected');
      expect(res.body.integrations.database.verified).toBe(true);
      expect(res.body.integrations.uvcs.status).toBe('manual_mode');
      expect(res.body.integrations.uvcs.verified).toBe(false);
      expect(res.body.integrations.unityEditor.status).toBe('disconnected');
      expect(res.body.integrations.unityEditor.verified).toBe(false);
    });
  });
});
