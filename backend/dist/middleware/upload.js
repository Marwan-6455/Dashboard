"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const uuid_1 = require("uuid");
const UPLOADS_DIR = node_path_1.default.resolve(process.cwd(), 'uploads');
if (!node_fs_1.default.existsSync(UPLOADS_DIR)) {
    node_fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Prohibited dangerous extensions
const BLOCKED_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.sh', '.ps1', '.dll', '.com', '.msi', '.vbs', '.js', '.ts', '.html', '.htm', '.php', '.phtml'
]);
const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'text/plain',
    'application/json',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'text/csv'
]);
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = node_path_1.default.extname(file.originalname).toLowerCase();
        const safeBaseName = node_path_1.default.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uniqueName = `ev_${Date.now()}_${(0, uuid_1.v4)().slice(0, 8)}_${safeBaseName}${ext}`;
        cb(null, uniqueName);
    }
});
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB max
    },
    fileFilter: (req, file, cb) => {
        const ext = node_path_1.default.extname(file.originalname).toLowerCase();
        if (BLOCKED_EXTENSIONS.has(ext)) {
            req.fileValidationError = 'Executable or dangerous file types are strictly prohibited.';
            return cb(null, false);
        }
        if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !ext.match(/\.(log|txt|json|png|jpg|jpeg|webp|mp4|webm|pdf)$/i)) {
            req.fileValidationError = `Unsupported file type: ${file.mimetype}. Allowed types include images, videos, logs, and documents.`;
            return cb(null, false);
        }
        cb(null, true);
    }
});
