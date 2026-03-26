// packages/backend/src/middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit';
import { Redis } from 'ioredis';
import { config } from '../config';
import { AuthenticatedRequest } from './auth';
import { Response } from 'express';
import { PLAN_LIMITS } from '@moni/shared';

const redis = new Redis(config.redis.url);

export { redis };

/**
 * Global rate limiter — applies to all routes.
 */
export const globalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  },
});

/**
 * Stricter rate limiter for auth endpoints (login/register).
 * 10 attempts per 15 minutes per IP to prevent brute force.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts. Please try again in 15 minutes.' },
  },
});

/**
 * Per-tenant API rate limiter based on subscription plan.
 * Uses Redis sliding window counter. Plan is read from req.tenantPlan
 * (set by requireTenant middleware) — not from query params.
 */
export async function tenantRateLimit(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.tenantSlug) return next();

  // Use the plan set by requireTenant middleware (trusted, from DB)
  const plan = req.tenantPlan || 'starter';
  const limits = PLAN_LIMITS[plan];
  const key = `ratelimit:tenant:${req.tenantSlug}`;
  const windowSeconds = 86400; // 24 hours

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limits.apiRateLimit - current);
    res.set('X-RateLimit-Limit', String(limits.apiRateLimit));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Plan', plan);

    if (current > limits.apiRateLimit) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'TENANT_RATE_LIMITED',
          message: `API rate limit exceeded for ${plan} plan (${limits.apiRateLimit}/day). Upgrade for higher limits.`,
        },
      });
    }

    next();
  } catch (err) {
    // If Redis is down, allow the request through but log warning
    console.warn('[RateLimit] Redis error, allowing request:', (err as Error).message);
    next();
  }
}
