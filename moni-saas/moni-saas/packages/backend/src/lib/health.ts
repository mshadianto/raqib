// packages/backend/src/lib/health.ts
// Deep health check that probes database and Redis connectivity

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { config } from '../config';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks: Record<string, { status: 'ok' | 'error'; latencyMs: number; error?: string }>;
}

const startTime = Date.now();

export async function checkHealth(pool: Pool, redis: Redis): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {};

  // Database check
  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart, error: err.message };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
  } catch (err: any) {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart, error: err.message };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  const anyError = Object.values(checks).some((c) => c.status === 'error');

  return {
    status: allOk ? 'ok' : anyError ? 'unhealthy' : 'degraded',
    service: 'moni-saas-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}
