"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const authRoutes_js_1 = require("./routes/authRoutes.js");
const taskRoutes_js_1 = require("./routes/taskRoutes.js");
const reviewRoutes_js_1 = require("./routes/reviewRoutes.js");
const evidenceRoutes_js_1 = require("./routes/evidenceRoutes.js");
const testReportRoutes_js_1 = require("./routes/testReportRoutes.js");
const teamRoutes_js_1 = require("./routes/teamRoutes.js");
const activityRoutes_js_1 = require("./routes/activityRoutes.js");
const statsRoutes_js_1 = require("./routes/statsRoutes.js");
const integrationRoutes_js_1 = require("./routes/integrationRoutes.js");
const settingsRoutes_js_1 = require("./routes/settingsRoutes.js");
const notificationRoutes_js_1 = require("./routes/notificationRoutes.js");
const botRoutes_js_1 = require("./routes/botRoutes.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint (public)
exports.app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        hub: 'Cindermarch Engine Hub',
        subtitle: 'Terminal 6 Development Management',
        time: new Date().toISOString()
    });
});
// Mount API routes
exports.app.use('/api/auth', authRoutes_js_1.authRouter);
exports.app.use('/api/tasks', taskRoutes_js_1.taskRouter);
exports.app.use('/api/reviews', reviewRoutes_js_1.reviewRouter);
exports.app.use('/api/evidence', evidenceRoutes_js_1.evidenceRouter);
exports.app.use('/api/test-reports', testReportRoutes_js_1.testReportRouter);
exports.app.use('/api/team', teamRoutes_js_1.teamRouter);
exports.app.use('/api/teams', teamRoutes_js_1.teamRouter);
exports.app.use('/api/activity', activityRoutes_js_1.activityRouter);
exports.app.use('/api/stats', statsRoutes_js_1.statsRouter);
exports.app.use('/api/integrations', integrationRoutes_js_1.integrationRouter);
exports.app.use('/api/settings', settingsRoutes_js_1.settingsRouter);
exports.app.use('/api/notifications', notificationRoutes_js_1.notificationRouter);
exports.app.use('/api/bot', botRoutes_js_1.botRouter);
// Centralized error handler
exports.app.use(errorHandler_js_1.errorHandler);
