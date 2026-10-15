"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.setDbForTesting = setDbForTesting;
const node_sqlite_1 = require("node:sqlite");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
let dbInstance = null;
function getDb(customPath) {
    if (dbInstance && !customPath) {
        return dbInstance;
    }
    const dbPath = customPath || process.env.DATABASE_PATH || node_path_1.default.resolve(process.cwd(), 'data', 'cindermarch.db');
    if (dbPath !== ':memory:') {
        const dir = node_path_1.default.dirname(dbPath);
        if (!node_fs_1.default.existsSync(dir)) {
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    const db = new node_sqlite_1.DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
        db.exec('PRAGMA journal_mode = WAL;');
    }
    db.exec('PRAGMA busy_timeout = 5000;');
    if (!customPath) {
        dbInstance = db;
    }
    return db;
}
function closeDb() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
function setDbForTesting(db) {
    dbInstance = db;
}
