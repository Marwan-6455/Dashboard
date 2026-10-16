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

// Centralized error handler
app.use(errorHandler);
