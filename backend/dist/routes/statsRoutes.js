"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const statsService_js_1 = require("../services/statsService.js");
exports.statsRouter = (0, express_1.Router)();
exports.statsRouter.use(auth_js_1.authMiddleware);
exports.statsRouter.get('/overview', async (_req, res) => {
    try {
        const overview = await (0, statsService_js_1.getDashboardOverview)();
        res.json(overview);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
