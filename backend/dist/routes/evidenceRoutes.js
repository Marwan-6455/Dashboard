"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceRouter = void 0;
const express_1 = require("express");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const auth_js_1 = require("../middleware/auth.js");
const upload_js_1 = require("../middleware/upload.js");
const evidenceService_js_1 = require("../services/evidenceService.js");
exports.evidenceRouter = (0, express_1.Router)();
exports.evidenceRouter.use(auth_js_1.authMiddleware);
exports.evidenceRouter.get('/', (req, res) => {
    const { taskId, evidenceType } = req.query;
    const items = (0, evidenceService_js_1.getEvidence)({
        taskId: taskId,
        evidenceType: evidenceType
    });
    res.json({ evidence: items });
});
exports.evidenceRouter.get('/:id', (req, res) => {
    const item = (0, evidenceService_js_1.getEvidenceById)(req.params.id);
    if (!item) {
        res.status(404).json({ error: `Evidence ${req.params.id} not found.` });
        return;
    }
    res.json({ evidence: item });
});
exports.evidenceRouter.get('/:id/file', (req, res) => {
    const item = (0, evidenceService_js_1.getEvidenceById)(req.params.id);
    if (!item) {
        res.status(404).json({ error: `Evidence ${req.params.id} not found.` });
        return;
    }
    // Prevent path traversal
    const safeFilename = node_path_1.default.basename(item.stored_filename);
    const filePath = node_path_1.default.resolve(process.cwd(), 'uploads', safeFilename);
    if (!node_fs_1.default.existsSync(filePath)) {
        res.status(404).json({ error: 'Stored evidence file not found on disk.' });
        return;
    }
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', item.content_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.original_filename)}"`);
    const stream = node_fs_1.default.createReadStream(filePath);
    stream.pipe(res);
});
exports.evidenceRouter.post('/upload', upload_js_1.uploadMiddleware.single('file'), (req, res) => {
    if (req.fileValidationError) {
        res.status(400).json({ error: req.fileValidationError });
        return;
    }
    const file = req.file;
    const { taskId, description, evidenceType, externalUrl, relatedChangesetId } = req.body;
    if (!description || !description.trim()) {
        res.status(400).json({ error: 'Evidence description is required.' });
        return;
    }
    if (file) {
        const ext = node_path_1.default.extname(file.originalname).toLowerCase();
        let detectedType = 'document';
        if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
            detectedType = 'screenshot';
        }
        else if (['.mp4', '.webm'].includes(ext)) {
            detectedType = 'video';
        }
        else if (['.log', '.txt'].includes(ext)) {
            detectedType = 'test_log';
        }
        const item = (0, evidenceService_js_1.createEvidence)({
            taskId: taskId || null,
            originalFilename: file.originalname,
            storedFilename: file.filename,
            filePath: `uploads/${file.filename}`,
            contentType: file.mimetype,
            fileSize: file.size,
            evidenceType: evidenceType || detectedType,
            description: description.trim(),
            externalUrl: externalUrl || null,
            relatedChangesetId: relatedChangesetId || null
        }, req.user.id);
        res.status(201).json({ evidence: item });
    }
    else if (externalUrl) {
        // Artifact link
        const item = (0, evidenceService_js_1.createEvidence)({
            taskId: taskId || null,
            originalFilename: 'external_link',
            storedFilename: '',
            filePath: '',
            contentType: 'text/uri-list',
            fileSize: 0,
            evidenceType: 'external_link',
            description: description.trim(),
            externalUrl: externalUrl.trim(),
            relatedChangesetId: relatedChangesetId || null
        }, req.user.id);
        res.status(201).json({ evidence: item });
    }
    else {
        res.status(400).json({ error: 'Either a file upload or externalUrl is required.' });
    }
});
exports.evidenceRouter.delete('/:id', (req, res) => {
    try {
        (0, evidenceService_js_1.deleteEvidence)(req.params.id, req.user.id);
        res.json({ message: 'Evidence deleted successfully.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
