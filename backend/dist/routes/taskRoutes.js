"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_js_1 = require("../middleware/auth.js");
const taskService_js_1 = require("../services/taskService.js");
const uvcsService_js_1 = require("../services/uvcsService.js");
const gateService_js_1 = require("../services/gateService.js");
const strikeService_js_1 = require("../services/strikeService.js");
exports.taskRouter = (0, express_1.Router)();
exports.taskRouter.use(auth_js_1.authMiddleware);
exports.taskRouter.use(auth_js_1.checkWorkspaceSuspension);
exports.taskRouter.get('/', (req, res) => {
    const { status, ownerId, reviewerId, priority, search, projectId, workspaceId, teamId, category, overdueOnly, myTasksOnly, sortBy, sortOrder } = req.query;
    // By default scope to user's active workspace, or allow explicit override if authorized
    const effectiveWorkspaceId = workspaceId || req.user?.workspace_id || 'ws_cindermarch';
    const tasks = (0, taskService_js_1.getTasks)({
        status: status,
        ownerId: ownerId,
        reviewerId: reviewerId,
        priority: priority,
        search: search,
        projectId: projectId,
        workspaceId: effectiveWorkspaceId,
        teamId: teamId,
        category: category,
        overdueOnly: overdueOnly === 'true',
        myTasksUserId: myTasksOnly === 'true' ? req.user?.id : undefined,
        sortBy: sortBy,
        sortOrder: sortOrder
    });
    res.json({ tasks });
});
exports.taskRouter.get('/:id', (req, res) => {
    const task = (0, taskService_js_1.getTaskById)(req.params.id);
    if (!task) {
        res.status(404).json({ error: `Task ${req.params.id} not found.` });
        return;
    }
    res.json({ task });
});
exports.taskRouter.get('/:id/gates', (req, res) => {
    try {
        const gateStatus = (0, gateService_js_1.evaluateCompletionGates)(req.params.id);
        res.json({ gateStatus });
    }
    catch (err) {
        res.status(404).json({ error: err.message });
    }
});
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, 'Title must be at least 3 characters'),
    description: zod_1.z.string().min(5, 'Description must be at least 5 characters'),
    projectId: zod_1.z.string().optional(),
    workspaceId: zod_1.z.string().optional(),
    teamId: zod_1.z.string().nullable().optional(),
    category: zod_1.z.string().optional(),
    estimatedEffort: zod_1.z.string().optional(),
    actualEffort: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    ownerId: zod_1.z.string().nullable().optional(),
    reviewerId: zod_1.z.string().nullable().optional(),
    priority: zod_1.z.enum(['P0', 'P1', 'P2']).optional(),
    status: zod_1.z.enum(['Backlog', 'In Progress', 'Ready for Review', 'Changes Requested', 'Ready to Integrate', 'Verified Complete', 'Blocked']).optional(),
    deadline: zod_1.z.string().nullable().optional(),
    acceptanceCriteria: zod_1.z.array(zod_1.z.string()).optional()
});
exports.taskRouter.post('/', (req, res) => {
    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
    }
    const taskData = {
        ...parseResult.data,
        workspaceId: parseResult.data.workspaceId || req.user?.workspace_id || 'ws_cindermarch'
    };
    const task = (0, taskService_js_1.createTask)(taskData, req.user.id);
    res.status(201).json({ task });
});
exports.taskRouter.patch('/:id', (req, res) => {
    try {
        const updated = (0, taskService_js_1.updateTask)(req.params.id, req.body, req.user.id);
        res.json({ task: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.taskRouter.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    if (!status) {
        res.status(400).json({ error: 'Status is required.' });
        return;
    }
    try {
        const updated = (0, taskService_js_1.updateTaskStatus)(req.params.id, status, req.user.id);
        res.json({ task: updated });
    }
    catch (err) {
        if (err.statusCode === 422) {
            res.status(422).json({
                error: err.message,
                gateStatus: err.gateStatus
            });
            return;
        }
        res.status(400).json({ error: err.message });
    }
});
exports.taskRouter.post('/:id/criteria', (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) {
        res.status(400).json({ error: 'Acceptance criterion title is required.' });
        return;
    }
    const criterion = (0, taskService_js_1.addAcceptanceCriterion)(req.params.id, title);
    res.status(201).json({ criterion });
});
exports.taskRouter.patch('/:id/criteria/:critId', (req, res) => {
    const { isSatisfied } = req.body;
    if (isSatisfied === undefined) {
        res.status(400).json({ error: 'isSatisfied boolean is required.' });
        return;
    }
    const updated = (0, taskService_js_1.toggleAcceptanceCriterion)(req.params.critId, !!isSatisfied, req.user.id);
    res.json({ criterion: updated });
});
exports.taskRouter.post('/:id/comments', (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) {
        res.status(400).json({ error: 'Comment content cannot be empty.' });
        return;
    }
    const comment = (0, taskService_js_1.addComment)(req.params.id, req.user.id, content);
    res.status(201).json({ comment });
});
exports.taskRouter.post('/:id/changesets', (req, res) => {
    const { changesetId, rawChangesetId, comment, author, branch, repositoryId } = req.body;
    try {
        if (changesetId) {
            // Existing changeset UUID linking
            (0, uvcsService_js_1.linkChangesetToTask)(req.params.id, changesetId, req.user.id);
        }
        else if (rawChangesetId && comment && author) {
            // Record new manual changeset and link
            (0, uvcsService_js_1.recordChangeset)({
                repositoryId,
                changesetId: rawChangesetId,
                comment,
                author,
                branch,
                taskId: req.params.id
            }, req.user.id);
        }
        else {
            res.status(400).json({ error: 'Must provide either existing changesetId or new changeset details (rawChangesetId, comment, author).' });
            return;
        }
        const task = (0, taskService_js_1.getTaskById)(req.params.id);
        res.json({ task });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.taskRouter.delete('/:id/changesets/:changesetId', (req, res) => {
    try {
        (0, uvcsService_js_1.unlinkChangesetFromTask)(req.params.id, req.params.changesetId, req.user.id);
        const task = (0, taskService_js_1.getTaskById)(req.params.id);
        res.json({ task });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/tasks/:id/extend-deadline (Admin/Owner only)
exports.taskRouter.post('/:id/extend-deadline', (0, auth_js_1.requireRole)(['admin']), (req, res) => {
    const { newDeadline, reason } = req.body;
    if (!newDeadline || !reason) {
        res.status(400).json({ error: 'Both newDeadline and a documented reason are required.' });
        return;
    }
    try {
        const updated = (0, strikeService_js_1.extendTaskDeadline)(req.params.id, req.user.id, newDeadline, reason);
        res.json({ success: true, task: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/tasks/:id/exempt-deadline (Admin/Owner only)
exports.taskRouter.post('/:id/exempt-deadline', (0, auth_js_1.requireRole)(['admin']), (req, res) => {
    const { reason } = req.body;
    if (!reason) {
        res.status(400).json({ error: 'A documented reason is required to exempt a task deadline.' });
        return;
    }
    try {
        const updated = (0, strikeService_js_1.exemptTaskDeadline)(req.params.id, req.user.id, reason);
        res.json({ success: true, task: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
