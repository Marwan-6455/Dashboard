import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { SCHEMA_SQL } from '../db/schema.js';
import { getDb } from '../db/connection.js';
import { app } from '../app.js';

describe('Authentication & Protected Endpoints', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);

    const now = new Date().toISOString();
    const hash = bcrypt.hashSync('Terminal6#Studio', 10);

    // Ensure users table has lead test user
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, roles, created_at, updated_at)
      VALUES ('usr_lead', 'lead', 'Engine Lead', 'lead@cindermarch.internal', ?, '["admin","developer","reviewer"]', ?, ?)
      ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, roles = excluded.roles
    `).run(hash, now, now);
  });

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authentication required/);
  });

  it('authenticates with correct credentials and returns session & csrf cookies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lead', password: 'Terminal6#Studio' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.username).toBe('lead');
    expect(res.body.csrfToken).toBeTruthy();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('cm_session'))).toBe(true);
    expect(cookies.some((c: string) => c.includes('cm_csrf'))).toBe(true);
  });

  it('rejects incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lead', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid username or password/);
  });
});
