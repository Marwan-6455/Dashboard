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
const strikeRoutes_js_1 = require("./routes/strikeRoutes.js");
const projectRoutes_js_1 = require("./routes/projectRoutes.js");
const bugRoutes_js_1 = require("./routes/bugRoutes.js");
const assetRoutes_js_1 = require("./routes/assetRoutes.js");
const storyRoutes_js_1 = require("./routes/storyRoutes.js");
const wikiRoutes_js_1 = require("./routes/wikiRoutes.js");
const decisionRoutes_js_1 = require("./routes/decisionRoutes.js");
const standupMeetingRoutes_js_1 = require("./routes/standupMeetingRoutes.js");
const buildReleaseRoutes_js_1 = require("./routes/buildReleaseRoutes.js");
const marketingRoutes_js_1 = require("./routes/marketingRoutes.js");
const searchRoutes_js_1 = require("./routes/searchRoutes.js");
const aiRoutes_js_1 = require("./routes/aiRoutes.js");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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
exports.app.use('/api/strikes', strikeRoutes_js_1.strikeRouter);
exports.app.use('/api/projects', projectRoutes_js_1.projectRouter);
exports.app.use('/api/bugs', bugRoutes_js_1.bugRouter);
exports.app.use('/api/assets', assetRoutes_js_1.assetRouter);
exports.app.use('/api/story', storyRoutes_js_1.storyRouter);
exports.app.use('/api/wiki', wikiRoutes_js_1.wikiRouter);
exports.app.use('/api/decisions', decisionRoutes_js_1.decisionRouter);
exports.app.use('/api', standupMeetingRoutes_js_1.standupMeetingRouter);
exports.app.use('/api', buildReleaseRoutes_js_1.buildReleaseRouter);
exports.app.use('/api/marketing', marketingRoutes_js_1.marketingRouter);
exports.app.use('/api/search', searchRoutes_js_1.searchRouter);
exports.app.use('/api/ai', aiRoutes_js_1.aiRouter);
// Centralized error handler
exports.app.use(errorHandler_js_1.errorHandler);
// Production Static Frontend Serving
const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
if (fs_1.default.existsSync(frontendDist)) {
    exports.app.use(express_1.default.static(frontendDist));
    exports.app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
            return next();
        }
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
}
