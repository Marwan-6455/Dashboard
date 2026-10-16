"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
try {
    process.loadEnvFile?.();
}
catch { }
const app_js_1 = require("./app.js");
const connection_js_1 = require("./db/connection.js");
const migrations_js_1 = require("./db/migrations.js");
const seed_js_1 = require("./db/seed.js");
const strikeWorker_js_1 = require("./services/strikeWorker.js");
const PORT = process.env.PORT || 3001;
function bootstrap() {
    const db = (0, connection_js_1.getDb)();
    console.log('[Database] Running migrations...');
    (0, migrations_js_1.runMigrations)(db);
    console.log('[Database] Checking initial seed data...');
    (0, seed_js_1.seedDatabase)(db);
    // Start background deadline evaluator worker
    (0, strikeWorker_js_1.startDeadlineStrikeWorker)(60000);
    app_js_1.app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  CINDERMARCH ENGINE HUB — TERMINAL 6 DEV HUB`);
        console.log(`  API Server active on http://localhost:${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`====================================================`);
    });
}
bootstrap();
