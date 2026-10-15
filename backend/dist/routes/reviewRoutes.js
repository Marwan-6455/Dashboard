"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_js_1 = require("../middleware/auth.js");
const reviewService_js_1 = require("../services/reviewService.js");
exports.reviewRouter = (0, express_1.Router)();
exports.reviewRouter.use(auth_js_1.authMiddleware);
exports.reviewRouter.get('/', (req, res) => {
    const { taskId, decision, reviewerId, developerId } = req.query;
    const reviews = (0, reviewService_js_1.getReviews)({
        taskId: taskId,
        decision: decision,
        reviewerId: reviewerId,
        developerId: developerId
    });
    res.json({ reviews });
});
exports.reviewRouter.get('/:id', (req, res) => {
    const review = (0, reviewService_js_1.getReviewById)(req.params.id);
    if (!review) {
        res.status(404).json({ error: `Review ${req.params.id} not found.` });
        return;
    }
    res.json({ review });
});
const createReviewSchema = zod_1.z.object({
    taskId: zod_1.z.string().min(1, 'Task ID is required'),
    developerId: zod_1.z.string().min(1, 'Developer ID is required'),
    reviewerId: zod_1.z.string().min(1, 'Reviewer ID is required'),
    changesetId: zod_1.z.string().nullable().optional(),
    checklist: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        passed: zod_1.z.boolean(),
        notes: zod_1.z.string().optional()
    })).optional()
});
exports.reviewRouter.post('/', (req, res) => {
    const parseResult = createReviewSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    try {
        const review = (0, reviewService_js_1.createReviewRequest)(parseResult.data, req.user.id);
        res.status(201).json({ review });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
const decisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(['Approved', 'Changes Requested', 'Rejected']),
    findings: zod_1.z.string().nullable().optional(),
    requiredFixes: zod_1.z.string().nullable().optional(),
    checklist: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        passed: zod_1.z.boolean(),
        notes: zod_1.z.string().optional()
    })).optional()
});
exports.reviewRouter.post('/:id/decision', (req, res) => {
    const parseResult = decisionSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    try {
        const review = (0, reviewService_js_1.submitReviewDecision)(req.params.id, parseResult.data, req.user.id);
        res.json({ review });
    }
    catch (err) {
        const statusCode = err.statusCode || 400;
        res.status(statusCode).json({ error: err.message });
    }
});
