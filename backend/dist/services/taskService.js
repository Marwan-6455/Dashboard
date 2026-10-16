"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTaskId = generateTaskId;
exports.getTasks = getTasks;
exports.getTaskById = getTaskById;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.updateTaskStatus = updateTaskStatus;
exports.addAcceptanceCriterion = addAcceptanceCriterion;
exports.toggleAcceptanceCriterion = toggleAcceptanceCriterion;
exports.addComment = addComment;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
const gateService_js_1 = require("./gateService.js");
const activityService_js_1 = require("./activityService.js");
const notificationService_js_1 = require("./notificationService.js");
const reminderScheduler_js_1 = require("./reminderScheduler.js");
const discordOutboxService_js_1 = require("./discordOutboxService.js");
function generateTaskId(db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT id FROM tasks WHERE id LIKE 'T6-ENG-%' ORDER BY id DESC LIMIT 1
  `);
    const lastTask = stmt.get();
    if (!lastTask) {
        return 'T6-ENG-001';
    }
    const match = lastTask.id.match(/T6-ENG-(\d+)/);
    if (!match) {
        return `T6-ENG-${String(Date.now()).slice(-4)}`;
    }
    const nextNumber = parseInt(match[1], 10) + 1;
    return `T6-ENG-${String(nextNumber).padStart(3, '0')}`;
}
function getTasks(filters = {}, db = (0, connection_js_1.getDb)()) {
    const conditions = [];
    const params = [];
    if (filters.workspaceId) {
        conditions.push('(t.workspace_id = ? OR t.workspace_id IS NULL)');
        params.push(filters.workspaceId);
    }
    if (filters.teamId) {
        conditions.push('(t.team_id = ? OR tm.slug = ?)');
        params.push(filters.teamId, filters.teamId);
    }
    if (filters.category) {
        conditions.push('t.category = ?');
        params.push(filters.category);
    }
    if (filters.overdueOnly) {
        conditions.push("(t.deadline IS NOT NULL AND t.deadline < date('now') AND t.status != 'Verified Complete')");
    }
    if (filters.myTasksUserId) {
        conditions.push('(t.owner_id = ? OR t.reviewer_id = ?)');
        params.push(filters.myTasksUserId, filters.myTasksUserId);
    }
    if (filters.status) {
        conditions.push('t.status = ?');
        params.push(filters.status);
    }
    if (filters.ownerId) {
        conditions.push('t.owner_id = ?');
        params.push(filters.ownerId);
    }
    if (filters.reviewerId) {
        conditions.push('t.reviewer_id = ?');
        params.push(filters.reviewerId);
    }
    if (filters.priority) {
        conditions.push('t.priority = ?');
        params.push(filters.priority);
    }
    if (filters.projectId) {
        conditions.push('t.project_id = ?');
        params.push(filters.projectId);
    }
    if (filters.search) {
        conditions.push('(t.title LIKE ? OR t.description LIKE ? OR t.id LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortBy = filters.sortBy || 'updated_at';
    const sortOrder = filters.sortOrder || 'DESC';
    const stmt = db.prepare(`
    SELECT 
      t.*,
      tm.name as team_name,
      tm.slug as team_slug,
      u_owner.display_name as owner_name,
      u_owner.username as owner_username,
      u_rev.display_name as reviewer_name,
      u_rev.username as reviewer_username,
      u_creator.display_name as creator_name,
      (SELECT COUNT(*) FROM task_acceptance_criteria tac WHERE tac.task_id = t.id) as criteria_total,
      (SELECT COUNT(*) FROM task_acceptance_criteria tac WHERE tac.task_id = t.id AND tac.is_satisfied = 1) as criteria_satisfied,
      (SELECT COUNT(*) FROM task_changesets tc WHERE tc.task_id = t.id) as changeset_count,
      (SELECT COUNT(*) FROM evidence e WHERE e.task_id = t.id) as evidence_count,
      (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count,
      (SELECT COUNT(*) FROM reviews r WHERE r.task_id = t.id) as review_count,
      (SELECT decision FROM reviews r WHERE r.task_id = t.id ORDER BY r.created_at DESC LIMIT 1) as latest_review_decision
    FROM tasks t
    LEFT JOIN teams tm ON t.team_id = tm.id
    LEFT JOIN users u_owner ON t.owner_id = u_owner.id
    LEFT JOIN users u_rev ON t.reviewer_id = u_rev.id
    LEFT JOIN users u_creator ON t.creator_id = u_creator.id
    ${whereClause}
    ORDER BY t.${sortBy} ${sortOrder}
  `);
    return stmt.all(...params);
}
function getTaskById(taskId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT 
      t.*,
      tm.name as team_name,
      tm.slug as team_slug,
      u_owner.display_name as owner_name,
      u_owner.username as owner_username,
      u_rev.display_name as reviewer_name,
      u_rev.username as reviewer_username,
      u_creator.display_name as creator_name
    FROM tasks t
    LEFT JOIN teams tm ON t.team_id = tm.id
    LEFT JOIN users u_owner ON t.owner_id = u_owner.id
    LEFT JOIN users u_rev ON t.reviewer_id = u_rev.id
    LEFT JOIN users u_creator ON t.creator_id = u_creator.id
    WHERE t.id = ?
  `);
    const task = stmt.get(taskId);
    if (!task)
        return null;
    // Criteria
    const critStmt = db.prepare(`
    SELECT tac.*, u.display_name as satisfied_by_name
    FROM task_acceptance_criteria tac
    LEFT JOIN users u ON tac.satisfied_by = u.id
    WHERE tac.task_id = ?
    ORDER BY tac.created_at ASC
  `);
    task.acceptance_criteria = critStmt.all(taskId);
    // Changesets
    const csStmt = db.prepare(`
    SELECT c.*, tc.created_at as linked_at, u.display_name as linked_by_name
    FROM uvcs_changesets c
    JOIN task_changesets tc ON c.id = tc.changeset_id
    JOIN users u ON tc.linked_by = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at DESC
  `);
    task.changesets = csStmt.all(taskId);
    // Reviews
    const revStmt = db.prepare(`
    SELECT r.*, u_dev.display_name as developer_name, u_rev.display_name as reviewer_name
    FROM reviews r
    JOIN users u_dev ON r.developer_id = u_dev.id
    JOIN users u_rev ON r.reviewer_id = u_rev.id
    WHERE r.task_id = ?
    ORDER BY r.created_at DESC
  `);
    task.reviews = revStmt.all(taskId).map((r) => ({
        ...r,
        checklist: JSON.parse(r.checklist_json || '[]')
    }));
    // Evidence
    const evStmt = db.prepare(`
    SELECT e.*, u.display_name as uploader_name
    FROM evidence e
    JOIN users u ON e.uploader_id = u.id
    WHERE e.task_id = ?
    ORDER BY e.created_at DESC
  `);
    task.evidence = evStmt.all(taskId);
    // Test Reports
    const rptStmt = db.prepare(`
    SELECT r.*, u.display_name as creator_name
    FROM test_reports r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.task_id = ?
       OR r.revision IN (SELECT changeset_id FROM uvcs_changesets WHERE id IN (SELECT changeset_id FROM task_changesets WHERE task_id = ?))
    ORDER BY r.created_at DESC
  `);
    task.test_reports = rptStmt.all(taskId, taskId);
    // Comments
    const commStmt = db.prepare(`
    SELECT c.*, u.display_name as user_name, u.username as user_username
    FROM task_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `);
    task.comments = commStmt.all(taskId);
    // Dependencies
    const depStmt = db.prepare(`
    SELECT td.*, t.title as depends_on_title, t.status as depends_on_status
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_task_id = t.id
    WHERE td.task_id = ?
  `);
    task.dependencies = depStmt.all(taskId);
    // Tasks depending on this task
    const depByStmt = db.prepare(`
    SELECT td.*, t.id as blocked_task_id, t.title as blocked_task_title, t.status as blocked_task_status
    FROM task_dependencies td
    JOIN tasks t ON td.task_id = t.id
    WHERE td.depends_on_task_id = ?
  `);
    task.blocks = depByStmt.all(taskId);
    // Evaluate gates
    task.completion_gate_status = (0, gateService_js_1.evaluateCompletionGates)(taskId, db);
    return task;
}
function createTask(data, creatorId, db = (0, connection_js_1.getDb)()) {
    const id = generateTaskId(db);
    const now = new Date().toISOString();
    const projectId = data.projectId || 'terminal-6';
    let workspaceId = data.workspaceId || null;
    if (!workspaceId) {
        try {
            const wsCheck = db.prepare("SELECT id FROM workspaces WHERE id = 'ws_cindermarch'").get();
            if (wsCheck) {
                workspaceId = 'ws_cindermarch';
            }
        }
        catch {
            // Table might not exist or empty
        }
    }
    const category = data.category || 'Gameplay';
    const priority = data.priority || 'P1';
    const status = data.status || 'Backlog';
    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
    const stmt = db.prepare(`
    INSERT INTO tasks (
      id, title, description, project_id, workspace_id, team_id, category,
      estimated_effort, actual_effort, tags_json, last_edited_by,
      owner_id, reviewer_id, priority, status, deadline, creator_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, data.title, data.description || '', projectId, workspaceId, data.teamId || null, category, data.estimatedEffort || null, data.actualEffort || null, tagsJson, creatorId, data.ownerId || null, data.reviewerId || null, priority, status, data.deadline || null, creatorId, now, now);
    // Add acceptance criteria if provided
    if (data.acceptanceCriteria && Array.isArray(data.acceptanceCriteria)) {
        const tacStmt = db.prepare(`
      INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, created_at)
      VALUES (?, ?, ?, 0, ?)
    `);
        for (const title of data.acceptanceCriteria) {
            if (title.trim()) {
                tacStmt.run(`tac_${(0, uuid_1.v4)().slice(0, 8)}`, id, title.trim(), now);
            }
        }
    }
    (0, activityService_js_1.recordActivity)(creatorId, 'task_created', id, null, status, 'application', { title: data.title, priority, ownerId: data.ownerId, category }, db);
    // Schedule persistent deadline reminders if deadline provided
    if (data.deadline) {
        (0, reminderScheduler_js_1.scheduleTaskReminders)(id, data.deadline, workspaceId, null, db);
    }
    // Enqueue outbox event for Discord
    (0, discordOutboxService_js_1.enqueueDiscordEvent)('task_created', {
        taskId: id,
        title: data.title,
        description: data.description,
        priority,
        status,
        category,
        deadline: data.deadline || null,
        ownerId: data.ownerId || null,
        creatorId
    }, category === 'QA' ? 'qa' : 'engine', id, workspaceId, db);
    if (data.ownerId && data.ownerId !== creatorId) {
        (0, notificationService_js_1.createNotification)(data.ownerId, 'task_assigned', 'New Task Assigned', `You were assigned to ${id}: ${data.title}`, id, db);
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('task_assigned', {
            taskId: id,
            title: data.title,
            assigneeId: data.ownerId,
            assignedBy: creatorId
        }, 'engine', id, workspaceId, db);
    }
    return getTaskById(id, db);
}
function updateTask(taskId, updates, actorId, db = (0, connection_js_1.getDb)()) {
    const existing = getTaskById(taskId, db);
    if (!existing) {
        throw new Error(`Task ${taskId} not found.`);
    }
    const now = new Date().toISOString();
    const tagsJson = updates.tags !== undefined ? (updates.tags ? JSON.stringify(updates.tags) : null) : existing.tags_json;
    const stmt = db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      workspace_id = COALESCE(?, workspace_id),
      team_id = ?,
      category = COALESCE(?, category),
      estimated_effort = COALESCE(?, estimated_effort),
      actual_effort = COALESCE(?, actual_effort),
      tags_json = ?,
      last_edited_by = ?,
      owner_id = ?,
      reviewer_id = ?,
      priority = COALESCE(?, priority),
      deadline = ?,
      is_changeset_exempt = COALESCE(?, is_changeset_exempt),
      changeset_exemption_reason = ?,
      changeset_exempt_approved_by = ?,
      is_test_exempt = COALESCE(?, is_test_exempt),
      test_exemption_reason = ?,
      test_exempt_approved_by = ?,
      is_deadline_exempt = COALESCE(?, is_deadline_exempt),
      deadline_exemption_reason = ?,
      deadline_exempt_approved_by = ?,
      extended_deadline = ?,
      deadline_extension_reason = ?,
      deadline_extension_approved_by = ?,
      updated_at = ?
    WHERE id = ?
  `);
    stmt.run(updates.title ?? null, updates.description ?? null, updates.workspaceId ?? null, updates.teamId !== undefined ? updates.teamId : existing.team_id, updates.category ?? null, updates.estimatedEffort ?? null, updates.actualEffort ?? null, tagsJson, actorId, updates.ownerId !== undefined ? updates.ownerId : existing.owner_id, updates.reviewerId !== undefined ? updates.reviewerId : existing.reviewer_id, updates.priority ?? null, updates.deadline !== undefined ? updates.deadline : existing.deadline, updates.isChangesetExempt !== undefined ? (updates.isChangesetExempt ? 1 : 0) : null, updates.changesetExemptionReason !== undefined ? updates.changesetExemptionReason : existing.changeset_exemption_reason, updates.changesetExemptApprovedBy !== undefined ? updates.changesetExemptApprovedBy : existing.changeset_exempt_approved_by, updates.isTestExempt !== undefined ? (updates.isTestExempt ? 1 : 0) : null, updates.testExemptionReason !== undefined ? updates.testExemptionReason : existing.test_exemption_reason, updates.testExemptApprovedBy !== undefined ? updates.testExemptApprovedBy : existing.test_exempt_approved_by, updates.isDeadlineExempt !== undefined ? (updates.isDeadlineExempt ? 1 : 0) : null, updates.deadlineExemptionReason !== undefined ? updates.deadlineExemptionReason : existing.deadline_exemption_reason, updates.deadlineExemptApprovedBy !== undefined ? updates.deadlineExemptApprovedBy : existing.deadline_exempt_approved_by, updates.extendedDeadline !== undefined ? updates.extendedDeadline : existing.extended_deadline, updates.deadlineExtensionReason !== undefined ? updates.deadlineExtensionReason : existing.deadline_extension_reason, updates.deadlineExtensionApprovedBy !== undefined ? updates.deadlineExtensionApprovedBy : existing.deadline_extension_approved_by, now, taskId);
    // If task had reassignment_required and owner was changed, clear reassignment_required
    if (existing.reassignment_required === 1 && updates.ownerId !== undefined && updates.ownerId !== existing.owner_id) {
        db.prepare('UPDATE tasks SET reassignment_required = 0, reassignment_reason = NULL WHERE id = ?').run(taskId);
    }
    // Check changed fields and record activity & notifications
    if (updates.priority && updates.priority !== existing.priority) {
        (0, activityService_js_1.recordActivity)(actorId, 'priority_changed', taskId, existing.priority, updates.priority, 'application', null, db);
    }
    // Handle deadline change & persistent reminder recalculation
    if (updates.deadline !== undefined && updates.deadline !== existing.deadline) {
        (0, activityService_js_1.recordActivity)(actorId, 'deadline_changed', taskId, existing.deadline, updates.deadline, 'application', null, db);
        (0, reminderScheduler_js_1.scheduleTaskReminders)(taskId, updates.deadline, existing.workspace_id, null, db);
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('deadline_changed', {
            taskId,
            title: existing.title,
            oldDeadline: existing.deadline,
            newDeadline: updates.deadline,
            changedBy: actorId
        }, 'engine', taskId, existing.workspace_id, db);
    }
    if (updates.ownerId !== undefined && updates.ownerId !== existing.owner_id) {
        (0, activityService_js_1.recordActivity)(actorId, 'task_assigned', taskId, existing.owner_id, updates.ownerId, 'application', null, db);
        if (updates.ownerId && updates.ownerId !== actorId) {
            (0, notificationService_js_1.createNotification)(updates.ownerId, 'task_assigned', 'Task Assigned to You', `You were assigned to ${taskId}: ${existing.title}`, taskId, db);
        }
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('task_assigned', {
            taskId,
            title: existing.title,
            oldOwnerId: existing.owner_id,
            newOwnerId: updates.ownerId,
            assignedBy: actorId
        }, 'engine', taskId, existing.workspace_id, db);
    }
    return getTaskById(taskId, db);
}
function updateTaskStatus(taskId, newStatus, actorId, db = (0, connection_js_1.getDb)()) {
    const existing = getTaskById(taskId, db);
    if (!existing) {
        throw new Error(`Task ${taskId} not found.`);
    }
    if (existing.status === newStatus) {
        return existing;
    }
    const now = new Date().toISOString();
    // COMPLETION GATE VALIDATION
    if (newStatus === 'Verified Complete') {
        const gateStatus = (0, gateService_js_1.evaluateCompletionGates)(taskId, db);
        if (!gateStatus.passed) {
            const errorMsg = `Task ${taskId} cannot be marked Verified Complete. Unmet verification gates:\n` +
                gateStatus.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
            const err = new Error(errorMsg);
            err.statusCode = 422;
            err.gateStatus = gateStatus;
            throw err;
        }
    }
    // Handle completion timestamp
    const completedAt = newStatus === 'Verified Complete' ? now : (existing.status === 'Verified Complete' ? null : existing.completed_at);
    const stmt = db.prepare(`
    UPDATE tasks 
    SET status = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `);
    stmt.run(newStatus, completedAt, now, taskId);
    // If reopened, record special activity
    if (existing.status === 'Verified Complete' && newStatus !== 'Verified Complete') {
        (0, activityService_js_1.recordActivity)(actorId, 'task_reopened', taskId, existing.status, newStatus, 'application', null, db);
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('status_changed', { taskId, title: existing.title, oldStatus: existing.status, newStatus, actorId }, 'engine', taskId, existing.workspace_id, db);
    }
    else if (newStatus === 'Verified Complete') {
        // Cancel obsolete reminders upon verified completion
        (0, reminderScheduler_js_1.cancelTaskReminders)(taskId, db);
        (0, activityService_js_1.recordActivity)(actorId, 'task_verified_complete', taskId, existing.status, newStatus, 'application', { completionGatesPassed: true }, db);
        if (existing.creator_id && existing.creator_id !== actorId) {
            (0, notificationService_js_1.createNotification)(existing.creator_id, 'task_completed', 'Task Verified Complete', `Task ${taskId} (${existing.title}) has passed all completion gates and is Verified Complete.`, taskId, db);
        }
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('task_completed', {
            taskId,
            title: existing.title,
            completedBy: actorId,
            ownerId: existing.owner_id,
            category: existing.category
        }, 'announcements', taskId, existing.workspace_id, db);
    }
    else if (newStatus === 'Blocked') {
        (0, activityService_js_1.recordActivity)(actorId, 'status_changed', taskId, existing.status, newStatus, 'application', null, db);
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('task_blocked', {
            taskId,
            title: existing.title,
            ownerId: existing.owner_id,
            blockedBy: actorId
        }, 'escalation', taskId, existing.workspace_id, db);
    }
    else {
        (0, activityService_js_1.recordActivity)(actorId, 'status_changed', taskId, existing.status, newStatus, 'application', null, db);
        (0, discordOutboxService_js_1.enqueueDiscordEvent)('status_changed', {
            taskId,
            title: existing.title,
            oldStatus: existing.status,
            newStatus,
            actorId
        }, 'engine', taskId, existing.workspace_id, db);
    }
    return getTaskById(taskId, db);
}
function addAcceptanceCriterion(taskId, title, db = (0, connection_js_1.getDb)()) {
    const now = new Date().toISOString();
    const id = `tac_${(0, uuid_1.v4)().slice(0, 8)}`;
    const stmt = db.prepare(`
    INSERT INTO task_acceptance_criteria (id, task_id, title, is_satisfied, created_at)
    VALUES (?, ?, ?, 0, ?)
  `);
    stmt.run(id, taskId, title.trim(), now);
    return { id, task_id: taskId, title: title.trim(), is_satisfied: 0, created_at: now };
}
function toggleAcceptanceCriterion(criterionId, isSatisfied, actorId, db = (0, connection_js_1.getDb)()) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    UPDATE task_acceptance_criteria
    SET is_satisfied = ?, satisfied_at = ?, satisfied_by = ?
    WHERE id = ?
  `);
    stmt.run(isSatisfied ? 1 : 0, isSatisfied ? now : null, isSatisfied ? actorId : null, criterionId);
    const getStmt = db.prepare('SELECT * FROM task_acceptance_criteria WHERE id = ?');
    const row = getStmt.get(criterionId);
    if (row) {
        (0, activityService_js_1.recordActivity)(actorId, 'acceptance_criteria_updated', row.task_id, isSatisfied ? 'unsatisfied' : 'satisfied', isSatisfied ? 'satisfied' : 'unsatisfied', 'application', { criterionTitle: row.title }, db);
    }
    return row;
}
function addComment(taskId, userId, content, db = (0, connection_js_1.getDb)()) {
    const id = `comm_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT INTO task_comments (id, task_id, user_id, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
    stmt.run(id, taskId, userId, content.trim(), now);
    const getStmt = db.prepare(`
    SELECT c.*, u.display_name as user_name, u.username as user_username
    FROM task_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `);
    const comment = getStmt.get(id);
    (0, activityService_js_1.recordActivity)(userId, 'comment_added', taskId, null, null, 'application', { commentId: id }, db);
    const task = db.prepare('SELECT owner_id, title FROM tasks WHERE id = ?').get(taskId);
    if (task && task.owner_id && task.owner_id !== userId) {
        (0, notificationService_js_1.createNotification)(task.owner_id, 'comment_added', 'New Comment on Task', `New comment added to ${taskId}: "${content.slice(0, 40)}..."`, taskId, db);
    }
    return comment;
}
