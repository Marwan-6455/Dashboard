"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamRouter = void 0;
const express_1 = require("express");
const connection_js_1 = require("../db/connection.js");
const auth_js_1 = require("../middleware/auth.js");
exports.teamRouter = (0, express_1.Router)();
exports.teamRouter.use(auth_js_1.authMiddleware);
exports.teamRouter.get('/', (req, res) => {
    const db = (0, connection_js_1.getDb)();
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const stmt = db.prepare(`
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.email,
      u.roles,
      u.avatar_url,
      u.created_at,
      wm.role as workspace_role,
      COUNT(DISTINCT t.id) as assigned_tasks_count,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN t.status = 'Ready for Review' THEN 1 ELSE 0 END) as awaiting_review_count,
      SUM(CASE WHEN t.status = 'Blocked' THEN 1 ELSE 0 END) as blocked_count,
      SUM(CASE WHEN t.status = 'Verified Complete' THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN t.deadline IS NOT NULL AND t.deadline < date('now') AND t.status != 'Verified Complete' THEN 1 ELSE 0 END) as overdue_count,
      (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id AND r.decision = 'Pending') as pending_reviews_count,
      (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id AND r.decision = 'Approved') as approved_reviews_count
    FROM users u
    LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = ?
    LEFT JOIN tasks t ON t.owner_id = u.id AND (t.workspace_id = ? OR t.workspace_id IS NULL)
    WHERE wm.id IS NOT NULL OR u.workspace_id = ? OR u.id IN ('lead', 'yehia', 'joe')
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);
    const users = stmt.all(workspaceId, workspaceId, workspaceId).map((u) => ({
        ...u,
        roles: JSON.parse(u.roles)
    }));
    res.json({ users });
});
exports.teamRouter.get('/:id', (req, res) => {
    const db = (0, connection_js_1.getDb)();
    const workspaceId = req.user?.workspace_id || 'ws_cindermarch';
    const stmt = db.prepare('SELECT id, username, display_name, email, roles, avatar_url, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.params.id);
    if (!user) {
        res.status(404).json({ error: `User ${req.params.id} not found.` });
        return;
    }
    // Get user's tasks
    const tasksStmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE owner_id = ? AND (workspace_id = ? OR workspace_id IS NULL)
    ORDER BY updated_at DESC
  `);
    const assignedTasks = tasksStmt.all(req.params.id, workspaceId);
    // Get user's reviews as reviewer
    const reviewStmt = db.prepare(`
    SELECT r.*, t.title as task_title 
    FROM reviews r 
    JOIN tasks t ON r.task_id = t.id 
    WHERE r.reviewer_id = ? 
    ORDER BY r.created_at DESC
  `);
    const conductedReviews = reviewStmt.all(req.params.id);
    // Get user's recent activity
    const actStmt = db.prepare(`
    SELECT a.*, t.title as task_title 
    FROM activity_events a 
    LEFT JOIN tasks t ON a.related_task_id = t.id 
    WHERE a.actor_id = ? 
    ORDER BY a.created_at DESC 
    LIMIT 20
  `);
    const activities = actStmt.all(req.params.id);
    res.json({
        user: {
            ...user,
            roles: JSON.parse(user.roles),
            assignedTasks,
            conductedReviews,
            recentActivities: activities
        }
    });
});
exports.teamRouter.patch('/:id', (req, res) => {
    const { displayName, roles, avatarUrl } = req.body;
    const db = (0, connection_js_1.getDb)();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
        res.status(404).json({ error: `User ${req.params.id} not found.` });
        return;
    }
    const now = new Date().toISOString();
    const newDisplayName = displayName?.trim() || user.display_name;
    const newRoles = roles ? JSON.stringify(roles) : user.roles;
    const newAvatarUrl = avatarUrl !== undefined ? avatarUrl : user.avatar_url;
    db.prepare(`
    UPDATE users 
    SET display_name = ?, roles = ?, avatar_url = ?, updated_at = ? 
    WHERE id = ?
  `).run(newDisplayName, newRoles, newAvatarUrl, now, req.params.id);
    const updated = db.prepare('SELECT id, username, display_name, email, roles, avatar_url FROM users WHERE id = ?').get(req.params.id);
    res.json({
        user: {
            ...updated,
            roles: JSON.parse(updated.roles)
        }
    });
});
