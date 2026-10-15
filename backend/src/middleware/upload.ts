import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `ev_${Date.now()}_${uuidv4().slice(0, 8)}_${safeBaseName}${ext}`;
    cb(null, uniqueName);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max
  },
  fileFilter: (req: any, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
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
