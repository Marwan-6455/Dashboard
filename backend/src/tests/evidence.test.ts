import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { SCHEMA_SQL } from '../db/schema.js';
import { getDb } from '../db/connection.js';
import { app } from '../app.js';

describe('Evidence Upload Validation & Security', () => {
  let sessionToken: string;
  let csrfToken: string;

  beforeEach(async () => {
    const db = getDb();
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    const now = new Date().toISOString();
    const hash = bcrypt.hashSync('Terminal6#Studio', 10);

    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.internal', ?, '["admin"]', ?, ?)
      ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, roles = excluded.roles
    `).run(hash, now, now);

    // Login to get session
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lead', password: 'Terminal6#Studio' });

    sessionToken = res.body.sessionToken;
    csrfToken = res.body.csrfToken;
  });

  it('rejects dangerous executable files (.exe, .bat, etc.)', async () => {
    const tempFile = path.resolve(process.cwd(), 'scratch_test_malicious.exe');
    fs.writeFileSync(tempFile, 'MZ fake binary');

    try {
      const res = await request(app)
        .post('/api/evidence/upload')
        .set('Cookie', [`cm_session=${sessionToken}`, `cm_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .field('description', 'Attempted malicious upload')
        .attach('file', tempFile);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/prohibited|unsupported/i);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('accepts valid image uploads and records evidence metadata', async () => {
    const tempFile = path.resolve(process.cwd(), 'scratch_test_valid.png');
    fs.writeFileSync(tempFile, 'PNG fake image content');

    try {
      const res = await request(app)
        .post('/api/evidence/upload')
        .set('Cookie', [`cm_session=${sessionToken}`, `cm_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .field('description', 'Valid platform screenshot')
        .field('evidenceType', 'screenshot')
        .attach('file', tempFile);

      expect(res.status).toBe(201);
      expect(res.body.evidence).toBeTruthy();
      expect(res.body.evidence.original_filename).toBe('scratch_test_valid.png');
      expect(res.body.evidence.evidence_type).toBe('screenshot');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });
});
