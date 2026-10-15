"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateLinkRequest = initiateLinkRequest;
exports.verifyLinkCode = verifyLinkCode;
exports.getDiscordLinkByUserId = getDiscordLinkByUserId;
exports.getUserByDiscordId = getUserByDiscordId;
exports.unlinkDiscordAccount = unlinkDiscordAccount;
const node_crypto_1 = __importDefault(require("node:crypto"));
const uuid_1 = require("uuid");
const connection_js_1 = require("../db/connection.js");
const activityService_js_1 = require("./activityService.js");
const notificationService_js_1 = require("./notificationService.js");
// Expiration time for link codes (15 minutes)
const LINK_EXPIRY_MS = 15 * 60 * 1000;
/**
 * Generate a friendly 6-character code (e.g., CM-7K9A or 8F2K9A)
 */
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars 0/O, 1/I
    let code = '';
    const bytes = node_crypto_1.default.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}
/**
 * Hash a code with SHA-256 for secure lookup/storage
 */
function hashCode(code) {
    return node_crypto_1.default.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
/**
 * Initiate linking from Discord: generates a short-lived, single-use code.
 */
function initiateLinkRequest(discordUserId, discordUsername, db = (0, connection_js_1.getDb)()) {
    const now = Date.now();
    const expiresAt = new Date(now + LINK_EXPIRY_MS).toISOString();
    const plainCode = generateCode();
    const codeHash = hashCode(plainCode);
    const id = `dlr_${(0, uuid_1.v4)().slice(0, 8)}`;
    // Delete any existing link request for this discord user
    db.prepare('DELETE FROM discord_link_requests WHERE discord_user_id = ?').run(discordUserId);
    db.prepare(`
    INSERT INTO discord_link_requests (
      id, discord_user_id, discord_username, link_code, link_code_hash, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, discordUserId, discordUsername, plainCode, codeHash, expiresAt, new Date(now).toISOString());
    return { code: plainCode, expiresAt };
}
/**
 * Verify code entered by an authenticated Engine Hub user.
 * Binds the Discord account to the user account.
 */
function verifyLinkCode(userId, code, db = (0, connection_js_1.getDb)()) {
    const trimmed = code.trim().toUpperCase();
    const codeHash = hashCode(trimmed);
    const nowIso = new Date().toISOString();
    // Find valid, non-expired link request
    const stmt = db.prepare(`
    SELECT * FROM discord_link_requests
    WHERE (link_code = ? OR link_code_hash = ?) AND expires_at > ?
  `);
    const request = stmt.get(trimmed, codeHash, nowIso);
    if (!request) {
        return {
            success: false,
            error: 'Invalid or expired verification code. Please run /link in Discord to generate a new code.'
        };
    }
    // Delete the link request (single-use)
    db.prepare('DELETE FROM discord_link_requests WHERE id = ?').run(request.id);
    // Check if discord account is already linked to another user
    const existingDiscord = db.prepare('SELECT * FROM discord_account_links WHERE discord_user_id = ?').get(request.discord_user_id);
    if (existingDiscord && existingDiscord.user_id !== userId) {
        return {
            success: false,
            error: 'This Discord account is already linked to another Engine Hub user.'
        };
    }
    // Remove any previous link for this user
    db.prepare('DELETE FROM discord_account_links WHERE user_id = ?').run(userId);
    const linkId = `dlink_${(0, uuid_1.v4)().slice(0, 8)}`;
    db.prepare(`
    INSERT INTO discord_account_links (
      id, user_id, discord_user_id, discord_username, verified_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(linkId, userId, request.discord_user_id, request.discord_username, nowIso, nowIso, nowIso);
    const link = db.prepare('SELECT * FROM discord_account_links WHERE id = ?').get(linkId);
    // Record audit activity
    (0, activityService_js_1.recordActivity)(userId, 'discord_account_linked', null, null, request.discord_username, 'application', { discordUserId: request.discord_user_id, discordUsername: request.discord_username }, db);
    // Send in-app notification
    (0, notificationService_js_1.createNotification)(userId, 'task_completed', 'Discord Account Linked', `Successfully linked Discord account @${request.discord_username} (${request.discord_user_id}) to your Engine Hub profile.`, null, db);
    return { success: true, link };
}
/**
 * Get linked Discord account for a given Engine Hub user
 */
function getDiscordLinkByUserId(userId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare('SELECT * FROM discord_account_links WHERE user_id = ?');
    return stmt.get(userId) || null;
}
/**
 * Get Engine Hub user by linked Discord User ID
 */
function getUserByDiscordId(discordUserId, db = (0, connection_js_1.getDb)()) {
    const stmt = db.prepare(`
    SELECT u.*, dal.id as dlink_id, dal.discord_user_id, dal.discord_username, dal.verified_at, dal.created_at as link_created_at
    FROM discord_account_links dal
    JOIN users u ON dal.user_id = u.id
    WHERE dal.discord_user_id = ?
  `);
    const row = stmt.get(discordUserId);
    if (!row)
        return null;
    const discord_link = {
        id: row.dlink_id,
        user_id: row.id,
        discord_user_id: row.discord_user_id,
        discord_username: row.discord_username,
        verified_at: row.verified_at,
        created_at: row.link_created_at,
        updated_at: row.link_created_at
    };
    return { ...row, discord_link };
}
/**
 * Unlink Discord account
 */
function unlinkDiscordAccount(userId, actorId, db = (0, connection_js_1.getDb)()) {
    const existing = getDiscordLinkByUserId(userId, db);
    if (!existing)
        return false;
    db.prepare('DELETE FROM discord_account_links WHERE user_id = ?').run(userId);
    (0, activityService_js_1.recordActivity)(actorId, 'discord_account_unlinked', null, existing.discord_username, null, 'application', { discordUserId: existing.discord_user_id }, db);
    return true;
}
