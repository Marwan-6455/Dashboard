try {
  (process as any).loadEnvFile?.();
} catch {}

import { app } from './app.js';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import { seedDatabase } from './db/seed.js';

const PORT = process.env.PORT || 3001;

function bootstrap() {
  const db = getDb();
  console.log('[Database] Running migrations...');
  runMigrations(db);

  console.log('[Database] Checking initial seed data...');
  seedDatabase(db);

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  CINDERMARCH ENGINE HUB — TERMINAL 6 DEV HUB`);
    console.log(`  API Server active on http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });
}

bootstrap();
