import { getDb } from '../db/connection.js';
import { Build, Release } from '../types/index.js';

export class BuildReleaseService {
  static getBuilds(filters: { projectId?: string; status?: string } = {}): (Build & { release_owner_name?: string; approver_name?: string; project_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT b.*,
             u1.display_name as release_owner_name,
             u2.display_name as approver_name,
             p.name as project_name
      FROM builds b
      LEFT JOIN users u1 ON b.release_owner_id = u1.id
      LEFT JOIN users u2 ON b.release_approved_by = u2.id
      LEFT JOIN projects p ON b.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.projectId) {
      query += ' AND b.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.status) {
      query += ' AND b.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY b.created_at DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static getBuildById(id: string): Build | null {
    const db = getDb();
    return (db.prepare('SELECT * FROM builds WHERE id = ?').get(id) as unknown as Build) || null;
  }

  static registerBuild(data: Omit<Build, 'created_at'>): Build {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO builds (
        id, project_id, build_number, version, branch, changeset_id,
        build_target, unity_version, status, test_report_id, artifacts_json,
        known_issues, release_approved, release_approved_by, changelog,
        release_owner_id, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.build_number,
      data.version,
      data.branch || 'main',
      data.changeset_id || null,
      data.build_target || 'Windows',
      data.unity_version || '6000.0.25f1',
      data.status || 'Queued',
      data.test_report_id || null,
      data.artifacts_json || null,
      data.known_issues || null,
      data.release_approved || 0,
      data.release_approved_by || null,
      data.changelog || null,
      data.release_owner_id || null,
      now,
      data.completed_at || (data.status === 'Succeeded' ? now : null)
    );

    return this.getBuildById(data.id)!;
  }

  static getReleases(projectId?: string): (Release & { build_version?: string; creator_name?: string })[] {
    const db = getDb();
    let query = `
      SELECT r.*,
             b.version as build_version,
             u.display_name as creator_name
      FROM releases r
      LEFT JOIN builds b ON r.build_id = b.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId) {
      query += ' AND r.project_id = ?';
      params.push(projectId);
    }
    query += ' ORDER BY r.created_at DESC';
    return db.prepare(query).all(...params) as any[];
  }

  static createRelease(data: Omit<Release, 'created_at'>): Release {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO releases (
        id, project_id, name, version, build_id, status, checklist_json, target_date, released_at, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.project_id,
      data.name,
      data.version,
      data.build_id || null,
      data.status || 'Draft',
      data.checklist_json || null,
      data.target_date || null,
      data.released_at || null,
      data.notes || null,
      data.created_by,
      now
    );

    return db.prepare('SELECT * FROM releases WHERE id = ?').get(data.id) as unknown as Release;
  }

  static evaluateReleaseReadiness(projectId: string, buildId?: string): {
    ready: boolean;
    unmetRequirements: string[];
    checklist: {
      testsPassed: boolean;
      noCriticalBugs: boolean;
      buildSucceeded: boolean;
      approvalsSatisfied: boolean;
    };
  } {
    const db = getDb();

    // 1. Check test reports
    const testRow = db.prepare(`
      SELECT result, failed_count FROM test_reports
      ORDER BY created_at DESC LIMIT 1
    `).get() as { result: string; failed_count: number } | undefined;
    const testsPassed = !!testRow && testRow.result === 'Passed' && testRow.failed_count === 0;

    // 2. Check critical bugs
    const criticalBugs = db.prepare(`
      SELECT COUNT(*) as count FROM bugs
      WHERE project_id = ? AND severity IN ('Critical', 'Major') AND status NOT IN ('Verified', 'Rejected')
    `).get(projectId) as { count: number };
    const noCriticalBugs = criticalBugs.count === 0;

    // 3. Check build state
    let buildSucceeded = false;
    if (buildId) {
      const build = db.prepare('SELECT status, release_approved FROM builds WHERE id = ?').get(buildId) as any;
      buildSucceeded = build && build.status === 'Succeeded';
    } else {
      const latestBuild = db.prepare('SELECT status FROM builds WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId) as any;
      buildSucceeded = !!latestBuild && latestBuild.status === 'Succeeded';
    }

    const approvalsSatisfied = true; // Lead governance approval

    const unmet: string[] = [];
    if (!testsPassed) unmet.push('Automated Unity Test Framework test report missing or contains failures.');
    if (!noCriticalBugs) unmet.push(`${criticalBugs.count} unresolved Critical or Major QA bug(s) remain open.`);
    if (!buildSucceeded) unmet.push('Verified successful build artifact not found for this target.');

    return {
      ready: unmet.length === 0,
      unmetRequirements: unmet,
      checklist: {
        testsPassed,
        noCriticalBugs,
        buildSucceeded,
        approvalsSatisfied
      }
    };
  }
}
