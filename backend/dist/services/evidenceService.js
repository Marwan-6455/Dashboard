"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvidence = createEvidence;
exports.getEvidence = getEvidence;
exports.getEvidenceById = getEvidenceById;
exports.deleteEvidence = deleteEvidence;
const uuid_1 = require("uuid");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const connection_js_1 = require("../db/connection.js");
const activityService_js_1 = require("./activityService.js");
function createEvidence(data, uploaderId, db = (0, connection_js_1.getDb)()) {
    const id = `ev_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT INTO evidence (
      id, task_id, uploader_id, original_filename, stored_filename,
      file_path, content_type, file_size, evidence_type,
      description, external_url, related_changeset_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, data.taskId || null, uploaderId, data.originalFilename, data.storedFilename, data.filePath, data.contentType, data.fileSize, data.evidenceType, data.description, data.externalUrl || null, data.relatedChangesetId || null, now);
    if (data.taskId) {
        (0, activityService_js_1.recordActivity)(uploaderId, 'evidence_uploaded', data.taskId, null, data.originalFilename, 'application', { evidenceId: id, evidenceType: data.evidenceType, size: data.fileSize }, db);
    }
    return {
        id,
        task_id: data.taskId || null,
        uploader_id: uploaderId,
        original_filename: data.originalFilename,
        stored_filename: data.storedFilename,
        file_path: data.filePath,
        content_type: data.contentType,
        file_size: data.fileSize,
        evidence_type: data.evidenceType,
        description: data.description,
        external_url: data.externalUrl || null,
        related_changeset_id: data.relatedChangesetId || null,
        created_at: now
    };
}
function getEvidence(filters = {}, db = (0, connection_js_1.getDb)()) {
    const conditions = [];
    const params = [];
    if (filters.taskId) {
        conditions.push('e.task_id = ?');
        params.push(filters.taskId);
    }
    if (filters.evidenceType) {
        conditions.push('e.evidence_type = ?');
        params.push(filters.evidenceType);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`
    SELECT 
      e.*,
      u.display_name as uploader_name,
      u.username as uploader_username,
      t.title as task_title
    FROM evidence e
    JOIN users u ON e.uploader_id = u.id
    LEFT JOIN tasks t ON e.task_id = t.id
    ${whereClause}
    ORDER BY e.created_at DESC
  `);
    return stmt.all(...params);
}
function getEvidenceById(id, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT 
      e.*,
      u.display_name as uploader_name,
      u.username as uploader_username,
      t.title as task_title
    FROM evidence e
    JOIN users u ON e.uploader_id = u.id
    LEFT JOIN tasks t ON e.task_id = t.id
    WHERE e.id = ?
  `);
    return stmt.get(id);
}
function deleteEvidence(id, actorId, db = (0, connection_js_1.getDb)()) {
    const evidence = getEvidenceById(id, db);
    if (!evidence) {
        throw new Error(`Evidence ${id} not found.`);
    }
    // Delete file from disk if stored locally
    if (evidence.stored_filename) {
        const fullPath = node_path_1.default.resolve(process.cwd(), 'uploads', evidence.stored_filename);
        if (node_fs_1.default.existsSync(fullPath)) {
            try {
                node_fs_1.default.unlinkSync(fullPath);
            }
            catch (err) {
                console.warn(`Could not delete file from disk: ${fullPath}`, err);
            }
        }
    }
    db.prepare('DELETE FROM evidence WHERE id = ?').run(id);
    if (evidence.task_id) {
        (0, activityService_js_1.recordActivity)(actorId, 'evidence_removed', evidence.task_id, evidence.original_filename, null, 'application', { evidenceId: id }, db);
    }
}
