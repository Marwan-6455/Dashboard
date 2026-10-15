"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REVIEW_CHECKLIST = void 0;
exports.createReviewRequest = createReviewRequest;
exports.submitReviewDecision = submitReviewDecision;
exports.getReviews = getReviews;
exports.getReviewById = getReviewById;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
const activityService_js_1 = require("./activityService.js");
const notificationService_js_1 = require("./notificationService.js");
const discordOutboxService_js_1 = require("./discordOutboxService.js");
exports.DEFAULT_REVIEW_CHECKLIST = [
    { id: 'chk_scope', label: 'Correct task and scope alignment', passed: false },
    { id: 'chk_changeset', label: 'UVCS Changeset reference recorded and valid', passed: false },
    { id: 'chk_code', label: 'Relevant source code & shaders inspected', passed: false },
    { id: 'chk_criteria', label: 'All task acceptance criteria verified', passed: false },
    { id: 'chk_edge_cases', label: 'Edge cases and error states tested', passed: false },
    { id: 'chk_console', label: 'No new Unity Console warnings or runtime errors', passed: false },
    { id: 'chk_tests', label: 'Automated test suite results verified', passed: false },
    { id: 'chk_evidence', label: 'Visual/log evidence inspected and accessible', passed: false },
    { id: 'chk_integration', label: 'Integration requirements & dependencies satisfied', passed: false }
];
function createReviewRequest(data, requesterId, db = (0, connection_js_1.getDb)()) {
    // Check self-review restriction on creation
    if (data.reviewerId === data.developerId) {
        throw new Error('Self-review violation: A developer cannot be assigned to review their own work.');
    }
    const reviewId = `rev_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const checklist = data.checklist || exports.DEFAULT_REVIEW_CHECKLIST;
    const stmt = db.prepare(`
    INSERT INTO reviews (
      id, task_id, developer_id, reviewer_id, changeset_id,
      checklist_json, decision, findings, required_fixes, created_at, decision_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', null, null, ?, null)
  `);
    stmt.run(reviewId, data.taskId, data.developerId, data.reviewerId, data.changesetId || null, JSON.stringify(checklist), now);
    // Set task status to Ready for Review if it is currently In Progress or Changes Requested
    const taskStmt = db.prepare('SELECT status FROM tasks WHERE id = ?');
    const task = taskStmt.get(data.taskId);
    if (task && (task.status === 'In Progress' || task.status === 'Changes Requested' || task.status === 'Backlog')) {
        db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('Ready for Review', now, data.taskId);
    }
    (0, activityService_js_1.recordActivity)(requesterId, 'review_requested', data.taskId, task?.status || null, 'Ready for Review', 'review', { reviewId, reviewerId: data.reviewerId, developerId: data.developerId }, db);
    (0, notificationService_js_1.createNotification)(data.reviewerId, 'review_requested', 'Review Requested', `You were assigned as reviewer for task ${data.taskId}`, data.taskId, db);
    (0, discordOutboxService_js_1.enqueueDiscordEvent)('review_requested', {
        taskId: data.taskId,
        reviewId,
        developerId: data.developerId,
        reviewerId: data.reviewerId
    }, 'engine', data.taskId, 'ws_cindermarch', db);
    return {
        id: reviewId,
        task_id: data.taskId,
        developer_id: data.developerId,
        reviewer_id: data.reviewerId,
        changeset_id: data.changesetId || null,
        checklist_json: JSON.stringify(checklist),
        decision: 'Pending',
        findings: null,
        required_fixes: null,
        created_at: now,
        decision_at: null
    };
}
function submitReviewDecision(reviewId, data, reviewerId, db = (0, connection_js_1.getDb)()) {
    const getStmt = db.prepare('SELECT * FROM reviews WHERE id = ?');
    const review = getStmt.get(reviewId);
    if (!review) {
        throw new Error(`Review ${reviewId} not found.`);
    }
    // SELF-APPROVAL REJECTION CHECK
    if (reviewerId === review.developer_id) {
        const err = new Error('Self-approval rejected! Developers cannot approve their own work.');
        err.statusCode = 403;
        throw err;
    }
    // If reviewerId does not match assigned reviewer_id, ensure reviewer has admin/reviewer role
    if (review.reviewer_id !== reviewerId) {
        const userStmt = db.prepare('SELECT roles FROM users WHERE id = ?');
        const user = userStmt.get(reviewerId);
        const roles = user ? JSON.parse(user.roles) : [];
        if (!roles.includes('admin') && !roles.includes('reviewer')) {
            const err = new Error('Unauthorized: You are not the assigned reviewer or an authorized reviewer.');
            err.statusCode = 403;
            throw err;
        }
    }
    // Validate explanation when Changes Requested
    if (data.decision === 'Changes Requested' && !data.findings?.trim() && !data.requiredFixes?.trim()) {
        throw new Error('A detailed explanation or list of required fixes is mandatory when requesting changes.');
    }
    const now = new Date().toISOString();
    const checklistJson = data.checklist ? JSON.stringify(data.checklist) : review.checklist_json;
    const updateStmt = db.prepare(`
    UPDATE reviews
    SET decision = ?, findings = ?, required_fixes = ?, checklist_json = ?, reviewer_id = ?, decision_at = ?
    WHERE id = ?
  `);
    updateStmt.run(data.decision, data.findings?.trim() || null, data.requiredFixes?.trim() || null, checklistJson, reviewerId, now, reviewId);
    // Update task status based on review decision
    const taskStmt = db.prepare('SELECT status FROM tasks WHERE id = ?');
    const task = taskStmt.get(review.task_id);
    let newStatus = task?.status;
    if (data.decision === 'Approved' && task?.status === 'Ready for Review') {
        newStatus = 'Ready to Integrate';
        db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, review.task_id);
    }
    else if (data.decision === 'Changes Requested') {
        newStatus = 'Changes Requested';
        db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, review.task_id);
    }
    else if (data.decision === 'Rejected') {
        newStatus = 'Blocked';
        db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, review.task_id);
    }
    // Record audit activity
    const actionName = data.decision === 'Approved'
        ? 'review_approved'
        : data.decision === 'Changes Requested'
            ? 'changes_requested'
            : 'review_rejected';
    (0, activityService_js_1.recordActivity)(reviewerId, actionName, review.task_id, review.decision, data.decision, 'review', { reviewId, findings: data.findings, requiredFixes: data.requiredFixes }, db);
    (0, notificationService_js_1.createNotification)(review.developer_id, 'review_decision', `Review ${data.decision}`, `Review for ${review.task_id} has been marked: ${data.decision}`, review.task_id, db);
    (0, discordOutboxService_js_1.enqueueDiscordEvent)('review_decision', {
        taskId: review.task_id,
        reviewId,
        decision: data.decision,
        reviewerId,
        developerId: review.developer_id,
        newStatus,
        findings: data.findings || null,
        requiredFixes: data.requiredFixes || null
    }, 'engine', review.task_id, 'ws_cindermarch', db);
    return getReviewById(reviewId, db);
}
function getReviews(filters = {}, db = (0, connection_js_1.getDb)()) {
    const conditions = [];
    const params = [];
    if (filters.taskId) {
        conditions.push('r.task_id = ?');
        params.push(filters.taskId);
    }
    if (filters.decision) {
        conditions.push('r.decision = ?');
        params.push(filters.decision);
    }
    if (filters.reviewerId) {
        conditions.push('r.reviewer_id = ?');
        params.push(filters.reviewerId);
    }
    if (filters.developerId) {
        conditions.push('r.developer_id = ?');
        params.push(filters.developerId);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`
    SELECT 
      r.*,
      t.title as task_title,
      t.priority as task_priority,
      t.status as task_status,
      u_dev.display_name as developer_name,
      u_dev.username as developer_username,
      u_rev.display_name as reviewer_name,
      u_rev.username as reviewer_username,
      cs.changeset_id as cs_identifier,
      cs.comment as cs_comment
    FROM reviews r
    JOIN tasks t ON r.task_id = t.id
    JOIN users u_dev ON r.developer_id = u_dev.id
    JOIN users u_rev ON r.reviewer_id = u_rev.id
    LEFT JOIN uvcs_changesets cs ON r.changeset_id = cs.id
    ${whereClause}
    ORDER BY r.created_at DESC
  `);
    return stmt.all(...params).map((row) => ({
        ...row,
        checklist: JSON.parse(row.checklist_json || '[]')
    }));
}
function getReviewById(reviewId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT 
      r.*,
      t.title as task_title,
      t.priority as task_priority,
      t.status as task_status,
      u_dev.display_name as developer_name,
      u_dev.username as developer_username,
      u_rev.display_name as reviewer_name,
      u_rev.username as reviewer_username,
      cs.changeset_id as cs_identifier,
      cs.comment as cs_comment
    FROM reviews r
    JOIN tasks t ON r.task_id = t.id
    JOIN users u_dev ON r.developer_id = u_dev.id
    JOIN users u_rev ON r.reviewer_id = u_rev.id
    LEFT JOIN uvcs_changesets cs ON r.changeset_id = cs.id
    WHERE r.id = ?
  `);
    const row = stmt.get(reviewId);
    if (!row)
        return null;
    return {
        ...row,
        checklist: JSON.parse(row.checklist_json || '[]')
    };
}
