import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../db/connection.js';
import { runMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { ProjectService } from '../services/projectService.js';
import { BugService } from '../services/bugService.js';
import { AssetService } from '../services/assetService.js';
import { StoryService } from '../services/storyService.js';
import { WikiService } from '../services/wikiService.js';
import { DecisionService } from '../services/decisionService.js';
import { StandupMeetingService } from '../services/standupMeetingService.js';
import { BuildReleaseService } from '../services/buildReleaseService.js';
import { SearchService } from '../services/searchService.js';

describe('Cindermarch Studio Operating System Platform Services', () => {
  beforeAll(() => {
    const db = getDb();
    runMigrations(db);
    seedDatabase(db);
  });

  describe('ProjectService & Explainable Health', () => {
    it('retrieves active seeded projects Terminal 6 and Eclipsed', () => {
      const projects = ProjectService.getAllProjects();
      expect(projects.length).toBeGreaterThanOrEqual(2);
      const t6 = projects.find(p => p.id === 'terminal-6');
      const ecl = projects.find(p => p.id === 'eclipsed');
      expect(t6).toBeDefined();
      expect(t6?.name).toBe('Terminal 6');
      expect(ecl).toBeDefined();
      expect(ecl?.name).toBe('Eclipsed');
      const bnl = projects.find(p => p.id === 'blue-note-lounge');
      expect(bnl).toBeUndefined();
    });

    it('calculates explainable project health based on actual data', () => {
      const health = ProjectService.calculateProjectHealth('terminal-6');
      expect(health).toHaveProperty('health');
      expect(health).toHaveProperty('score');
      expect(health.reasons.length).toBeGreaterThan(0);
      expect(health.metrics).toBeDefined();
    });

    it('manages milestones and sprints for projects', () => {
      const milestones = ProjectService.getMilestones('terminal-6');
      expect(milestones.length).toBeGreaterThanOrEqual(2);

      const sprints = ProjectService.getSprints('terminal-6');
      expect(sprints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('BugService & QA Verification Gate', () => {
    it('retrieves seeded QA bugs and provides triage summaries', () => {
      const bugs = BugService.getBugs({ projectId: 'terminal-6' });
      expect(bugs.length).toBeGreaterThanOrEqual(2);

      const summary = BugService.getTriageSummary('terminal-6');
      expect(summary.total).toBeGreaterThanOrEqual(2);
      expect(summary.open).toBeGreaterThanOrEqual(1);
    });

    it('enforces QA verification: tester verifies a bug fix with notes', () => {
      const bug = BugService.createBug({
        id: `BUG-TEST-${Date.now()}`,
        project_id: 'terminal-6',
        title: 'Player footstep reverb cut on stairwell',
        description: 'Occlusion drop on wood stairs',
        severity: 'Minor',
        priority: 'P2',
        reporter_id: 'usr_joe',
        status: 'Fixed'
      });
      expect(bug.status).toBe('Fixed');

      // QA tester verifies
      const verified = BugService.verifyBug(bug.id, 'usr_yehia', true, 'Retested in build v0.8.2. Reverb curve verified.');
      expect(verified?.status).toBe('Verified');
      expect(verified?.verified_by).toBe('usr_yehia');
      expect(verified?.resolution).toContain('Verified by QA');
    });

    it('reopens bug when QA retest fails', () => {
      const bug = BugService.createBug({
        id: `BUG-FAIL-${Date.now()}`,
        project_id: 'terminal-6',
        title: 'Collision glitch in station ticket booth',
        description: 'Player slips through grating',
        severity: 'Major',
        priority: 'P1',
        reporter_id: 'usr_lead',
        status: 'Fixed'
      });

      const reopened = BugService.verifyBug(bug.id, 'usr_lead', false, 'Issue reproduces when jumping while crouching');
      expect(reopened?.status).toBe('Reopened');
      expect(reopened?.resolution).toContain('QA Verification Failed');
    });
  });

  describe('Asset Vault & Creative Workflows', () => {
    it('supports 3D model and Sound assets with metadata', () => {
      const assets = AssetService.getAssets({ projectId: 'terminal-6' });
      expect(assets.length).toBeGreaterThanOrEqual(2);

      const clock = assets.find(a => a.category === '3d_model');
      expect(clock).toBeDefined();
      expect(clock?.status).toBe('Approved');

      const sfx = assets.find(a => a.category === 'sfx');
      expect(sfx).toBeDefined();
    });

    it('updates asset status and pipeline stage', () => {
      const newAsset = AssetService.createAsset({
        id: `ast_test_${Date.now()}`,
        project_id: 'blue-note-lounge',
        name: 'Brass Ashtray',
        category: '3d_model',
        owner_id: 'usr_joe',
        version: 'v1.0',
        status: 'Proposed'
      });

      const updated = AssetService.updateAssetStatus(newAsset.id, 'In Progress', 'Blockout');
      expect(updated?.status).toBe('In Progress');
      expect(updated?.pipeline_stage).toBe('Blockout');
    });
  });

  describe('Story Bible & Canon Approval', () => {
    it('manages lore entries and approves to canon', () => {
      const stories = StoryService.getStoryEntries({ projectId: 'terminal-6' });
      expect(stories.length).toBeGreaterThanOrEqual(1);

      const entry = StoryService.createStoryEntry({
        id: `st_test_${Date.now()}`,
        project_id: 'terminal-6',
        category: 'location',
        title: 'Platform 4 Underground Vault',
        summary: 'Secret bunker beneath the station tracks',
        body: 'Constructed during the war, the vault contains sealed crates.',
        author_id: 'usr_lead'
      });
      expect(entry.status).toBe('Draft');

      const approved = StoryService.approveStoryEntry(entry.id, 'usr_lead');
      expect(approved?.status).toBe('Canon Approved');
    });
  });

  describe('Wiki, Decisions, Standups & Releases', () => {
    it('creates and versions studio wiki documents', () => {
      const docs = WikiService.getDocuments({ projectId: 'terminal-6' });
      expect(docs.length).toBeGreaterThanOrEqual(1);

      const updated = WikiService.updateDocument(docs[0].id, { title: 'Updated Arch Guide' }, 'usr_lead');
      expect(updated?.version).toBeGreaterThan(1);
    });

    it('creates decisions and handles superseding', () => {
      const dec1 = DecisionService.createDecision({
        id: `ADR-TEST-1-${Date.now()}`,
        workspace_id: 'ws_cindermarch',
        title: 'Test Audio Architecture 1',
        scope: 'Audio',
        context: 'Initial audio design',
        options_considered: 'Options A, B',
        chosen_approach: 'Approach A',
        reasoning: 'Simplicity',
        author_id: 'usr_lead'
      });

      const dec2 = DecisionService.createDecision({
        id: `ADR-TEST-2-${Date.now()}`,
        workspace_id: 'ws_cindermarch',
        title: 'Test Audio Architecture 2',
        scope: 'Audio',
        context: 'Revised audio design',
        options_considered: 'Options C, D',
        chosen_approach: 'Approach D',
        reasoning: 'Better scaling',
        author_id: 'usr_lead'
      });

      DecisionService.supersedeDecision(dec1.id, dec2.id, 'usr_lead');
      const oldDec = DecisionService.getDecisionById(dec1.id);
      expect(oldDec?.status).toBe('Superseded');
      expect(oldDec?.superseded_by_id).toBe(dec2.id);
    });

    it('evaluates release readiness checklist', () => {
      const readiness = BuildReleaseService.evaluateReleaseReadiness('terminal-6');
      expect(readiness).toHaveProperty('ready');
      expect(readiness).toHaveProperty('checklist');
      expect(readiness.checklist).toHaveProperty('testsPassed');
      expect(readiness.checklist).toHaveProperty('noCriticalBugs');
    });

    it('submits, updates, and retrieves daily standups without duplicates', () => {
      const today = new Date().toISOString().slice(0, 10);
      const testId = `std_test_${Date.now()}`;
      
      // First submission
      const s1 = StandupMeetingService.submitStandup({
        id: testId,
        workspace_id: 'ws_cindermarch',
        team_id: 'team_engine',
        user_id: 'usr_lead',
        completed_yesterday: 'Initial work finished',
        planned_today: 'Build testing',
        date: today
      });
      expect(s1.completed_yesterday).toBe('Initial work finished');

      // Update same standup ID
      const s2 = StandupMeetingService.submitStandup({
        id: testId,
        workspace_id: 'ws_cindermarch',
        team_id: 'team_engine',
        user_id: 'usr_lead',
        completed_yesterday: 'Updated deliverables',
        planned_today: 'Build testing complete',
        date: today
      });
      expect(s2.completed_yesterday).toBe('Updated deliverables');

      // Verify only 1 record exists with testId
      const allForId = getDb().prepare('SELECT * FROM standups WHERE id = ?').all(testId);
      expect(allForId.length).toBe(1);

      // Clean up test record
      getDb().prepare('DELETE FROM standups WHERE id = ?').run(testId);
    });

    it('creates and filters team meetings with agendas and action items', () => {
      const testMeetingId = `mtg_test_${Date.now()}`;
      const meeting = StandupMeetingService.createMeeting({
        id: testMeetingId,
        workspace_id: 'ws_cindermarch',
        project_id: 'terminal-6',
        team_id: 'team_engine',
        title: 'Occlusion Culling & Portal Sync',
        date: new Date().toISOString(),
        participants_json: JSON.stringify(['Marwan Hossam', 'Yehia']),
        agenda: '1. Portal buffer culling\n2. Audio occlusion sync',
        notes: 'Agreed to profile corridor frametimes.',
        decisions: 'Adopt custom HDRP depth-buffer pass',
        created_by: 'usr_lead'
      });
      expect(meeting.title).toBe('Occlusion Culling & Portal Sync');

      const filtered = StandupMeetingService.getMeetings({ projectId: 'terminal-6' });
      expect(filtered.some(m => m.id === testMeetingId)).toBe(true);

      // Clean up
      getDb().prepare('DELETE FROM meetings WHERE id = ?').run(testMeetingId);
    });

    it('creates and retrieves sprint retrospectives with 3 pillars', () => {
      const testRetroId = `retro_test_${Date.now()}`;
      const retro = StandupMeetingService.createRetrospective({
        id: testRetroId,
        workspace_id: 'ws_cindermarch',
        project_id: 'terminal-6',
        team_id: 'team_engine',
        title: 'Sprint 14 Retrospective',
        period: 'Sprint 14 (Oct 2026)',
        what_went_well: 'Portal depth pass completed on schedule.',
        what_caused_problems: 'Corridor audio occlusion glitch.',
        what_should_change: 'Add pre-merge spatial audio testing gate.',
        facilitator_id: 'usr_lead'
      });
      expect(retro.title).toBe('Sprint 14 Retrospective');
      expect(retro.what_went_well).toContain('Portal depth pass');

      const allRetros = StandupMeetingService.getRetrospectives({ workspaceId: 'ws_cindermarch' });
      expect(allRetros.some(r => r.id === testRetroId)).toBe(true);

      // Clean up
      getDb().prepare('DELETE FROM retrospectives WHERE id = ?').run(testRetroId);
    });
  });

  describe('Unified Search Service', () => {
    it('performs unified cross-entity search', () => {
      const results = SearchService.search('Platform', 'ws_cindermarch');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'bug' || r.type === 'asset' || r.type === 'story' || r.type === 'task')).toBe(true);
    });
  });
});
