"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testReportRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_js_1 = require("../middleware/auth.js");
const testReportService_js_1 = require("../services/testReportService.js");
exports.testReportRouter = (0, express_1.Router)();
exports.testReportRouter.use(auth_js_1.authMiddleware);
exports.testReportRouter.get('/', (req, res) => {
    const { taskId, revision, result, source } = req.query;
    const reports = (0, testReportService_js_1.getTestReports)({
        taskId: taskId,
        revision: revision,
        result: result,
        source: source
    });
    res.json({ reports });
});
exports.testReportRouter.get('/:id', (req, res) => {
    const report = (0, testReportService_js_1.getTestReportById)(req.params.id);
    if (!report) {
        res.status(404).json({ error: `Test report ${req.params.id} not found.` });
        return;
    }
    res.json({ report });
});
const reportSchema = zod_1.z.object({
    taskId: zod_1.z.string().nullable().optional(),
    repositoryId: zod_1.z.string().optional(),
    revision: zod_1.z.string().min(1, 'Revision or Changeset ID is required'),
    unityVersion: zod_1.z.string().min(1, 'Unity version is required'),
    testSuite: zod_1.z.string().min(1, 'Test suite name is required'),
    result: zod_1.z.enum(['Passed', 'Failed', 'Error', 'Not Run']),
    passedCount: zod_1.z.number().int().min(0).optional(),
    failedCount: zod_1.z.number().int().min(0).optional(),
    skippedCount: zod_1.z.number().int().min(0).optional(),
    buildResult: zod_1.z.enum(['Success', 'Failed', 'Not Applicable']).optional(),
    runnerIdentity: zod_1.z.string().min(1, 'Runner identity is required'),
    logArtifactId: zod_1.z.string().nullable().optional()
});
exports.testReportRouter.post('/', (req, res) => {
    const parseResult = reportSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    // Force manual source and manual_unverified verificationState for UI submissions per rule
    const report = (0, testReportService_js_1.createTestReport)({
        ...parseResult.data,
        source: 'manual',
        verificationState: 'manual_unverified'
    }, req.user.id);
    res.status(201).json({ report });
});
