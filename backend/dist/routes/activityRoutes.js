"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const activityService_js_1 = require("../services/activityService.js");
exports.activityRouter = (0, express_1.Router)();
exports.activityRouter.use(auth_js_1.authMiddleware);
exports.activityRouter.get('/', (req, res) => {
    const { taskId, actorId, source, limit, offset } = req.query;
    const result = (0, activityService_js_1.getActivities)({
        taskId: taskId,
        actorId: actorId,
        source: source,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0
    });
    res.json(result);
});
