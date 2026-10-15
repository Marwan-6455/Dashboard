"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = authRateLimiter;
const loginAttempts = new Map();
function authRateLimiter(maxAttempts = 10, windowMs = 60 * 1000) {
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const record = loginAttempts.get(ip);
        if (!record || record.resetAt < now) {
            loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (record.count >= maxAttempts) {
            const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
            res.status(429).json({
                error: `Too many login attempts. Please wait ${waitSeconds} seconds before trying again.`
            });
            return;
        }
        record.count++;
        next();
    };
}
