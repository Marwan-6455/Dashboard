"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUVCSProvider = getUVCSProvider;
exports.recordChangeset = recordChangeset;
exports.linkChangesetToTask = linkChangesetToTask;
exports.unlinkChangesetFromTask = unlinkChangesetFromTask;
exports.getChangesets = getChangesets;
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
const ManualUVCSProvider_js_1 = require("../integrations/ManualUVCSProvider.js");
const activityService_js_1 = require("./activityService.js");
const uvcsProvider = new ManualUVCSProvider_js_1.ManualUVCSProvider();
function getUVCSProvider() {
    return uvcsProvider;
}
function recordChangeset(data, userId, db = (0, connection_js_1.getDb)()) {
    const repoId = data.repositoryId || 'Terminal6-Main@cindermarch';
    const cleanCsId = data.changesetId.trim();
    const now = new Date().toISOString();
    const timestamp = data.timestamp || now;
    const affectedFilesJson = data.affectedFiles ? JSON.stringify(data.affectedFiles) : null;
    // Check if this changeset already exists in repository
    const existingStmt = db.prepare('SELECT * FROM uvcs_changesets WHERE repository_id = ? AND changeset_id = ?');
    let existing = existingStmt.get(repoId, cleanCsId);
    let changesetId;
    if (existing) {
        changesetId = existing.id;
    }
    else {
        changesetId = `cs_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
        const insertStmt = db.prepare(`
      INSERT INTO uvcs_changesets (
        id, repository_id, changeset_id, branch, comment, author,
        timestamp, affected_files_json, source, validation_status,
        external_link, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'unverified_manual', ?, ?, ?)
    `);
        insertStmt.run(changesetId, repoId, cleanCsId, data.branch || null, data.comment.trim(), data.author.trim(), timestamp, affectedFilesJson, data.externalLink || null, userId, now);
    }
    // Link to task if specified
    if (data.taskId) {
        linkChangesetToTask(data.taskId, changesetId, userId, db);
    }
    const resultStmt = db.prepare('SELECT * FROM uvcs_changesets WHERE id = ?');
    return resultStmt.get(changesetId);
}
function linkChangesetToTask(taskId, changesetId, userId, db = (0, connection_js_1.getDb)()) {
    const checkStmt = db.prepare('SELECT * FROM task_changesets WHERE task_id = ? AND changeset_id = ?');
    const existing = checkStmt.get(taskId, changesetId);
    if (!existing) {
        const id = `tc_${(0, uuid_1.v4)().slice(0, 8)}`;
        const now = new Date().toISOString();
        const insertStmt = db.prepare(`
      INSERT INTO task_changesets (id, task_id, changeset_id, linked_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        insertStmt.run(id, taskId, changesetId, userId, now);
        const csStmt = db.prepare('SELECT changeset_id FROM uvcs_changesets WHERE id = ?');
        const cs = csStmt.get(changesetId);
        (0, activityService_js_1.recordActivity)(userId, 'changeset_linked', taskId, null, cs?.changeset_id || changesetId, 'application', { changesetId, repoChangeset: cs?.changeset_id }, db);
    }
}
function unlinkChangesetFromTask(taskId, changesetId, userId, db = (0, connection_js_1.getDb)()) {
    db.prepare('DELETE FROM task_changesets WHERE task_id = ? AND changeset_id = ?').run(taskId, changesetId);
    const csStmt = db.prepare('SELECT changeset_id FROM uvcs_changesets WHERE id = ?');
    const cs = csStmt.get(changesetId);
    (0, activityService_js_1.recordActivity)(userId, 'changeset_unlinked', taskId, cs?.changeset_id || changesetId, null, 'application', { changesetId }, db);
}
function getChangesets(filters = {}, db = (0, connection_js_1.getDb)()) {
    const conditions = [];
    const params = [];
    if (filters.taskId) {
        conditions.push('cs.id IN (SELECT changeset_id FROM task_changesets WHERE task_id = ?)');
        params.push(filters.taskId);
    }
    if (filters.author) {
        conditions.push('cs.author = ?');
        params.push(filters.author);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`
    SELECT 
      cs.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM task_changesets tc WHERE tc.changeset_id = cs.id) as linked_tasks_count
    FROM uvcs_changesets cs
    LEFT JOIN users u ON cs.created_by = u.id
    ${whereClause}
    ORDER BY cs.timestamp DESC
  `);
    return stmt.all(...params);
}
