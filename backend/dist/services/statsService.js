"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardOverview = getDashboardOverview;
const connection_js_1 = require("../db/connection.js");
const uvcsService_js_1 = require("./uvcsService.js");
async function getDashboardOverview(workspaceId = 'ws_cindermarch', db = (0, connection_js_1.getDb)()) {
    // 1. Task counts by status
    const statusCountsStmt = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM tasks 
    WHERE workspace_id = ? OR workspace_id IS NULL
    GROUP BY status
  `);
    const statusRows = statusCountsStmt.all(workspaceId);
    const statusMap = {};
    statusRows.forEach((r) => {
        statusMap[r.status] = r.count;
    });
    const totalTasksStmt = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE workspace_id = ? OR workspace_id IS NULL');
    const totalTasks = totalTasksStmt.get(workspaceId)?.count || 0;
    const openTasks = (statusMap['Backlog'] || 0) +
        (statusMap['In Progress'] || 0) +
        (statusMap['Ready for Review'] || 0) +
        (statusMap['Changes Requested'] || 0) +
        (statusMap['Ready to Integrate'] || 0) +
        (statusMap['Blocked'] || 0);
    // Deadlines due today & overdue counts
    const dueTodayStmt = db.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE (workspace_id = ? OR workspace_id IS NULL)
      AND deadline IS NOT NULL 
      AND deadline >= date('now') AND deadline < date('now', '+1 day')
      AND status != 'Verified Complete'
  `);
    const dueToday = dueTodayStmt.get(workspaceId)?.count || 0;
    const overdueStmt = db.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE (workspace_id = ? OR workspace_id IS NULL)
      AND deadline IS NOT NULL 
      AND deadline < datetime('now')
      AND status != 'Verified Complete'
  `);
    const overdueCount = overdueStmt.get(workspaceId)?.count || 0;
    // 2. Test Reports summary
    const testCountsStmt = db.prepare(`
    SELECT result, COUNT(*) as count 
    FROM test_reports 
    GROUP BY result
  `);
    const testRows = testCountsStmt.all();
    const testMap = {};
    testRows.forEach((r) => {
        testMap[r.result] = r.count;
    });
    // 3. Team Workloads summary across the 6 teams
    const teamWorkloadStmt = db.prepare(`
    SELECT 
      tm.id,
      tm.name,
      tm.slug,
      COUNT(DISTINCT mem.user_id) as member_count,
      COUNT(DISTINCT CASE WHEN t.status != 'Verified Complete' THEN t.id END) as active_tasks_count,
      COUNT(DISTINCT CASE WHEN t.deadline IS NOT NULL AND t.deadline < datetime('now') AND t.status != 'Verified Complete' THEN t.id END) as overdue_count
    FROM teams tm
    LEFT JOIN team_members mem ON mem.team_id = tm.id
    LEFT JOIN tasks t ON t.team_id = tm.id AND (t.workspace_id = ? OR t.workspace_id IS NULL)
    WHERE tm.workspace_id = ?
    GROUP BY tm.id
    ORDER BY tm.name ASC
  `);
    const teamWorkloads = teamWorkloadStmt.all(workspaceId, workspaceId);
    // 4. Developer Workload
    const workloadStmt = db.prepare(`
    SELECT 
      u.id, 
      u.display_name, 
      u.username,
      u.roles,
      u.avatar_url,
      COUNT(t.id) as assigned_tasks,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
      SUM(CASE WHEN t.status = 'Ready for Review' THEN 1 ELSE 0 END) as review_tasks,
      SUM(CASE WHEN t.status = 'Blocked' THEN 1 ELSE 0 END) as blocked_tasks,
      SUM(CASE WHEN t.status = 'Verified Complete' THEN 1 ELSE 0 END) as completed_tasks,
      (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id AND r.decision = 'Pending') as pending_reviews_as_reviewer
    FROM users u
    JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = ?
    LEFT JOIN tasks t ON t.owner_id = u.id AND (t.workspace_id = ? OR t.workspace_id IS NULL)
    WHERE u.id != 'usr_cindermarch_assistant'
    GROUP BY u.id
    ORDER BY assigned_tasks DESC
  `);
    const workload = workloadStmt.all(workspaceId, workspaceId);
    // 4. Upcoming Deadlines
    const deadlinesStmt = db.prepare(`
    SELECT t.id, t.title, t.priority, t.status, t.deadline, u.display_name as owner_name
    FROM tasks t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.deadline IS NOT NULL AND t.status != 'Verified Complete'
    ORDER BY t.deadline ASC
    LIMIT 6
  `);
    const upcomingDeadlines = deadlinesStmt.all();
    // 5. Recent Review Decisions
    const reviewsStmt = db.prepare(`
    SELECT 
      r.id, r.task_id, r.decision, r.findings, r.created_at, r.decision_at,
      t.title as task_title,
      u_dev.display_name as developer_name,
      u_rev.display_name as reviewer_name
    FROM reviews r
    JOIN tasks t ON r.task_id = t.id
    JOIN users u_dev ON r.developer_id = u_dev.id
    JOIN users u_rev ON r.reviewer_id = u_rev.id
    ORDER BY r.created_at DESC
    LIMIT 6
  `);
    const recentReviews = reviewsStmt.all();
    // 6. Recent Test/Build Reports
    const reportsStmt = db.prepare(`
    SELECT 
      r.id, r.task_id, r.revision, r.unity_version, r.test_suite, r.result,
      r.passed_count, r.failed_count, r.build_result, r.source, r.verification_state,
      r.created_at,
      t.title as task_title
    FROM test_reports r
    LEFT JOIN tasks t ON r.task_id = t.id
    ORDER BY r.created_at DESC
    LIMIT 6
  `);
    const recentReports = reportsStmt.all();
    // 7. Recent Activity Events
    const activityStmt = db.prepare(`
    SELECT 
      a.*,
      u.display_name as actor_name,
      t.title as task_title
    FROM activity_events a
    LEFT JOIN users u ON a.actor_id = u.id
    LEFT JOIN tasks t ON a.related_task_id = t.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `);
    const recentActivity = activityStmt.all();
    // 8. Integrations real status
    const uvcsStatus = await (0, uvcsService_js_1.getUVCSProvider)().getStatus();
    const cfgStmt = db.prepare('SELECT key, value_json FROM integration_configs');
    const configs = cfgStmt.all();
    const configMap = {};
    configs.forEach((c) => {
        try {
            configMap[c.key] = JSON.parse(c.value_json);
        }
        catch {
            configMap[c.key] = {};
        }
    });
    return {
        metrics: {
            totalTasks,
            openTasks,
            inProgress: statusMap['In Progress'] || 0,
            awaitingReview: statusMap['Ready for Review'] || 0,
            changesRequested: statusMap['Changes Requested'] || 0,
            readyToIntegrate: statusMap['Ready to Integrate'] || 0,
            blocked: statusMap['Blocked'] || 0,
            verifiedComplete: statusMap['Verified Complete'] || 0,
            dueToday,
            overdue: overdueCount,
            failedTests: (testMap['Failed'] || 0) + (testMap['Error'] || 0),
            passedTests: testMap['Passed'] || 0
        },
        teamWorkloads,
        workload,
        upcomingDeadlines,
        recentReviews,
        recentReports,
        recentActivity,
        integrations: {
            uvcs: uvcsStatus,
            unityTestRunner: configMap['unity_test_runner'] || { status: 'ready_for_ingestion' },
            discord: {
                status: (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) ? 'configured' : 'not_configured',
                clientId: process.env.DISCORD_CLIENT_ID || '1560406066867478681',
                guildId: process.env.DISCORD_GUILD_ID || '1394770347030483034'
            }
        }
    };
}
