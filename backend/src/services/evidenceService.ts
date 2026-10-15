import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../db/connection.js';
import { Evidence, EvidenceType } from '../types/index.js';
import { recordActivity } from './activityService.js';

export function createEvidence(
  data: {
    taskId?: string | null;
    originalFilename: string;
    storedFilename: string;
    filePath: string;
    contentType: string;
    fileSize: number;
    evidenceType: EvidenceType;
    description: string;
    externalUrl?: string | null;
    relatedChangesetId?: string | null;
  },
  uploaderId: string,
  db = getDb()
): Evidence {
  const id = `ev_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO evidence (
      id, task_id, uploader_id, original_filename, stored_filename,
      file_path, content_type, file_size, evidence_type,
      description, external_url, related_changeset_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.taskId || null,
    uploaderId,
    data.originalFilename,
    data.storedFilename,
    data.filePath,
    data.contentType,
    data.fileSize,
    data.evidenceType,
    data.description,
    data.externalUrl || null,
    data.relatedChangesetId || null,
    now
  );

  if (data.taskId) {
    recordActivity(
      uploaderId,
      'evidence_uploaded',
      data.taskId,
      null,
      data.originalFilename,
      'application',
      { evidenceId: id, evidenceType: data.evidenceType, size: data.fileSize },
      db
    );
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

export function getEvidence(
  filters: {
    taskId?: string;
    evidenceType?: string;
  } = {},
  db = getDb()
): any[] {
  const conditions: string[] = [];
  const params: any[] = [];

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

export function getEvidenceById(id: string, db = getDb()): any {
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

export function deleteEvidence(id: string, actorId: string, db = getDb()): void {
  const evidence = getEvidenceById(id, db);
  if (!evidence) {
    throw new Error(`Evidence ${id} not found.`);
  }

  // Delete file from disk if stored locally
  if (evidence.stored_filename) {
    const fullPath = path.resolve(process.cwd(), 'uploads', evidence.stored_filename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.warn(`Could not delete file from disk: ${fullPath}`, err);
      }
    }
  }

  db.prepare('DELETE FROM evidence WHERE id = ?').run(id);

  if (evidence.task_id) {
    recordActivity(
      actorId,
      'evidence_removed',
      evidence.task_id,
      evidence.original_filename,
      null,
      'application',
      { evidenceId: id },
      db
    );
  }
}
