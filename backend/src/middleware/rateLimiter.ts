import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

export function authRateLimiter(maxAttempts = 10, windowMs = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
