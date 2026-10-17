import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/authRoutes.js';
import { taskRouter } from './routes/taskRoutes.js';
import { reviewRouter } from './routes/reviewRoutes.js';
import { evidenceRouter } from './routes/evidenceRoutes.js';
import { testReportRouter } from './routes/testReportRoutes.js';
import { teamRouter } from './routes/teamRoutes.js';
import { activityRouter } from './routes/activityRoutes.js';
import { statsRouter } from './routes/statsRoutes.js';
import { integrationRouter } from './routes/integrationRoutes.js';
import { settingsRouter } from './routes/settingsRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { botRouter } from './routes/botRoutes.js';
import { strikeRouter } from './routes/strikeRoutes.js';
import { projectRouter } from './routes/projectRoutes.js';
import { bugRouter } from './routes/bugRoutes.js';
import { assetRouter } from './routes/assetRoutes.js';
import { storyRouter } from './routes/storyRoutes.js';
import { wikiRouter } from './routes/wikiRoutes.js';
import { decisionRouter } from './routes/decisionRoutes.js';
import { standupMeetingRouter } from './routes/standupMeetingRoutes.js';
import { buildReleaseRouter } from './routes/buildReleaseRoutes.js';
import { marketingRouter } from './routes/marketingRoutes.js';
import { searchRouter } from './routes/searchRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

import path from 'path';
import fs from 'fs';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (public)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    hub: 'Cindermarch Engine Hub',
    subtitle: 'Terminal 6 Development Management',
    time: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/test-reports', testReportRouter);
app.use('/api/team', teamRouter);
app.use('/api/teams', teamRouter);
app.use('/api/activity', activityRouter);
app.use('/api/stats', statsRouter);
app.use('/api/integrations', integrationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/bot', botRouter);
app.use('/api/strikes', strikeRouter);
app.use('/api/projects', projectRouter);
app.use('/api/bugs', bugRouter);
app.use('/api/assets', assetRouter);
app.use('/api/story', storyRouter);
app.use('/api/wiki', wikiRouter);
app.use('/api/decisions', decisionRouter);
app.use('/api', standupMeetingRouter);
app.use('/api', buildReleaseRouter);
app.use('/api/marketing', marketingRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);

// Centralized error handler
app.use(errorHandler);

// Production Static Frontend Serving
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

