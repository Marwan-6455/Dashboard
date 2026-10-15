"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const connection_js_1 = require("../db/connection.js");
const auth_js_1 = require("../middleware/auth.js");
const seed_js_1 = require("../db/seed.js");
exports.settingsRouter = (0, express_1.Router)();
// Health check endpoint (public)
exports.settingsRouter.get('/health', (_req, res) => {
    try {
        const db = (0, connection_js_1.getDb)();
        const row = db.prepare('SELECT 1 as alive').get();
        res.json({
            status: 'healthy',
            system: 'Cindermarch Engine Hub',
            project: 'Terminal 6',
            timestamp: new Date().toISOString(),
            database: row?.alive === 1 ? 'connected' : 'error',
            nodeVersion: process.version
        });
    }
    catch (err) {
        res.status(500).json({ status: 'unhealthy', error: err.message });
    }
});
exports.settingsRouter.use(auth_js_1.authMiddleware);
// Get completion gate settings
exports.settingsRouter.get('/gates', (_req, res) => {
    const db = (0, connection_js_1.getDb)();
    const stmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
    const row = stmt.get('completion_gates');
    const config = row ? JSON.parse(row.value_json) : {};
    res.json({ completionGates: config });
});
// Update completion gate settings (admin only)
exports.settingsRouter.patch('/gates', (0, auth_js_1.requireRole)(['admin']), (req, res) => {
    const db = (0, connection_js_1.getDb)();
    const now = new Date().toISOString();
    const currentStmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
    const currentRow = currentStmt.get('completion_gates');
    const current = currentRow ? JSON.parse(currentRow.value_json) : {};
    const updated = {
        ...current,
        ...req.body
    };
    db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES ('completion_gates', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(updated), now);
    res.json({ completionGates: updated });
});
// Reseed database safely (admin only)
exports.settingsRouter.post('/reseed', (0, auth_js_1.requireRole)(['admin']), (req, res) => {
    const { confirm } = req.body;
    if (confirm !== 'RESET_TERMINAL_6') {
        res.status(400).json({
            error: 'Confirmation required. Please provide confirm: "RESET_TERMINAL_6" to proceed.'
        });
        return;
    }
    const db = (0, connection_js_1.getDb)();
    // Clear non-core data
    db.exec(`
    DELETE FROM task_comments;
    DELETE FROM task_dependencies;
    DELETE FROM task_acceptance_criteria;
    DELETE FROM task_changesets;
    DELETE FROM reviews;
    DELETE FROM evidence;
    DELETE FROM test_reports;
    DELETE FROM activity_events;
    DELETE FROM tasks;
    DELETE FROM uvcs_changesets;
    DELETE FROM users;
    DELETE FROM projects;
    DELETE FROM settings;
    DELETE FROM integration_configs;
    DELETE FROM _migrations;
  `);
    (0, seed_js_1.seedDatabase)(db);
    res.json({ message: 'Database reset and successfully reseeded with Terminal 6 initial demo data.' });
});
