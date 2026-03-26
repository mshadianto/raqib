// packages/backend/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { config } from './config';

// Middleware
import { requestId } from './middleware/request-id';
import { requestTimeout } from './middleware/request-timeout';
import { globalRateLimit, redis as rateLimitRedis } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';

// Infrastructure
import { checkHealth } from './lib/health';
import { setupGracefulShutdown } from './lib/graceful-shutdown';
import { initCache } from './lib/cache';
import { setupScheduledJobs } from './modules/queue/queue.service';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import regulatoryRoutes from './modules/regulatory/regulatory.routes';
import portfolioRoutes from './modules/portfolio/portfolio.routes';
import auditRoutes from './modules/audit-trail/audit.routes';
import billingRoutes from './modules/billing/billing.routes';
import hermesRoutes from './modules/hermes/hermes.routes';

const app = express();

// Database pool (shared with health check + graceful shutdown)
const pool = new Pool({ connectionString: config.database.url });

// Initialize cache layer
initCache(rateLimitRedis);

// ─── Global Middleware ──────────────────────────────────────
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(globalRateLimit);
app.use(requestTimeout(30_000));

// Stripe webhook needs raw body — must come BEFORE express.json()
app.use('/api/v1/billing/webhook/stripe', express.raw({ type: 'application/json' }));
// Everything else gets JSON parsing
app.use(express.json({ limit: '10mb' }));

// ─── Health Check ───────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const health = await checkHealth(pool, rateLimitRedis);
  const status = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(status).json(health);
});

// ─── API Routes ─────────────────────────────────────────────
const api = config.apiPrefix;

app.use(`${api}/auth`, authRoutes);
app.use(`${api}/tenants`, tenantRoutes);
app.use(`${api}/regulatory`, regulatoryRoutes);
app.use(`${api}/portfolio`, portfolioRoutes);
app.use(`${api}/audit`, auditRoutes);
app.use(`${api}/billing`, billingRoutes);
app.use(`${api}/hermes`, hermesRoutes);

// ─── Centralized Error Handler (must be LAST) ───────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────
async function bootstrap() {
  try {
    await setupScheduledJobs();
    console.log('[Queue] Background jobs initialized');
  } catch (err) {
    console.warn('[Queue] Failed to setup scheduled jobs (Redis may be offline):', err);
  }

  const server = app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   MONI SaaS API — GRC Command Center                ║
║                                                      ║
║   Environment : ${config.env.padEnd(36)}║
║   Port        : ${String(config.port).padEnd(36)}║
║   API Prefix  : ${config.apiPrefix.padEnd(36)}║
║   Hermes      : ${config.hermes.apiUrl.padEnd(36)}║
║                                                      ║
║   Powered by Hermes Agent (NousResearch)             ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown — drain connections on SIGTERM/SIGINT
  setupGracefulShutdown({ server, pool, redis: rateLimitRedis });
}

bootstrap();

export default app;
