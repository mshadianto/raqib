// packages/backend/src/lib/cache.ts
// Redis-backed cache layer for frequently accessed data

import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function initCache(redisInstance: Redis) {
  redis = redisInstance;
}

/**
 * Get a cached value, falling back to the loader function.
 * Results are cached for `ttlSeconds` (default: 300 = 5 min).
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  if (!redis) return loader();

  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Cache miss or parse error — fall through to loader
  }

  const value = await loader();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Cache write failure is non-critical
  }

  return value;
}

/**
 * Invalidate a cache key (or pattern with *).
 */
export async function invalidateCache(pattern: string) {
  if (!redis) return;
  try {
    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  } catch {
    // Non-critical
  }
}
