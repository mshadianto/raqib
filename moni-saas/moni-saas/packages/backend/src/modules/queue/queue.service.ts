// packages/backend/src/modules/queue/queue.service.ts
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { TenantSchemaService } from '../tenant/tenant-schema.service';
import { PLAN_LIMITS, type PlanTier } from '@moni/shared';

const connection = new Redis(config.redis.url, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

// ─── Queue Definitions ──────────────────────────────────────

export const regulatoryQueue = new Queue('regulatory-scan', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const portfolioQueue = new Queue('portfolio-update', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

export const hermesQueue = new Queue('hermes-agent', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ─── Workers ────────────────────────────────────────────────

/** Regulatory scan worker — iterates all active tenants when type is 'scan-all' */
export const regulatoryWorker = new Worker(
  'regulatory-scan',
  async (job: Job) => {
    const { tenantSlug, sources, type } = job.data;

    // If this is a scheduled scan-all job, iterate tenants
    if (type === 'scan-all') {
      const tenants = await prisma.tenant.findMany({
        where: { status: { in: ['active', 'trial'] } },
        select: { slug: true, plan: true },
      });

      for (const tenant of tenants) {
        const plan = tenant.plan as PlanTier;
        const allowedSources = PLAN_LIMITS[plan].regulatorySources;
        await regulatoryQueue.add(`scan-${tenant.slug}`, {
          tenantSlug: tenant.slug,
          sources: allowedSources,
          plan,
        });
      }
      return { tenantsQueued: tenants.length };
    }

    // Single-tenant scan
    console.log(`[RegScan] Scanning for tenant: ${tenantSlug}, sources: ${sources}`);

    let alertsCreated = 0;
    for (const source of sources || []) {
      try {
        const results = await searchRegulations(source);
        for (const reg of results) {
          await TenantSchemaService.queryTenant(
            tenantSlug,
            `INSERT INTO regulatory_alerts (source, title, summary, severity, source_url, published_at, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [source, reg.title, reg.summary, classifySeverity(reg), reg.url, reg.publishedAt, JSON.stringify(reg.metadata || {})]
          );
          alertsCreated++;
        }
        console.log(`[RegScan] ${source}: ${results.length} alerts for ${tenantSlug}`);
      } catch (err) {
        console.error(`[RegScan] Error scanning ${source} for ${tenantSlug}:`, err);
        throw err; // Let BullMQ retry
      }
    }
    return { alertsCreated };
  },
  { connection, concurrency: 3 }
);

/** Portfolio price update worker */
export const portfolioWorker = new Worker(
  'portfolio-update',
  async (job: Job) => {
    const { tenantSlug, type } = job.data;

    // If scheduled update-all, iterate tenants
    if (type === 'update-all') {
      const tenants = await prisma.tenant.findMany({
        where: { status: { in: ['active', 'trial'] } },
        select: { slug: true },
      });
      for (const tenant of tenants) {
        await portfolioQueue.add(`update-${tenant.slug}`, { tenantSlug: tenant.slug });
      }
      return { tenantsQueued: tenants.length };
    }

    console.log(`[Portfolio] Updating prices for tenant: ${tenantSlug}`);
    const holdings = await TenantSchemaService.queryTenant(
      tenantSlug,
      'SELECT id, instrument_type, instrument_name, metadata FROM portfolio_holdings'
    );

    let updated = 0;
    for (const h of holdings) {
      try {
        const newPrice = await fetchCurrentPrice(h.instrument_type, h.instrument_name, h.metadata);
        if (newPrice !== null) {
          await TenantSchemaService.queryTenant(
            tenantSlug,
            'UPDATE portfolio_holdings SET current_price = $1, last_updated = NOW() WHERE id = $2',
            [newPrice, h.id]
          );
          updated++;
        }
      } catch (err) {
        console.error(`[Portfolio] Price update failed for ${h.instrument_name}:`, err);
      }
    }
    return { holdingsUpdated: updated, total: holdings.length };
  },
  { connection, concurrency: 2 }
);

/** Notification worker — dispatches email and messaging notifications */
export const notificationWorker = new Worker(
  'notifications',
  async (job: Job) => {
    const { recipient, subject, body, channel } = job.data;
    console.log(`[Notification] Sending ${channel} to ${recipient}: ${subject}`);

    if (channel === 'email') {
      // TODO: Integrate SendGrid
      console.log(`[Email] Would send to ${recipient}: ${subject}`);
    } else if (channel === 'whatsapp') {
      // TODO: Send via Hermes WhatsApp gateway
      console.log(`[WhatsApp] Would send to ${recipient}: ${body}`);
    }
  },
  { connection, concurrency: 5 }
);

// ─── Worker event listeners ─────────────────────────────────

for (const worker of [regulatoryWorker, portfolioWorker, notificationWorker]) {
  worker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job?.name} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);
  });
  worker.on('completed', (job, result) => {
    console.log(`[Queue] Job ${job.name} completed:`, result);
  });
}

// ─── Scheduler — Cron-like repeatable jobs ──────────────────

export async function setupScheduledJobs() {
  // Regulatory scan every 6 hours
  await regulatoryQueue.add(
    'scan-all-tenants',
    { type: 'scan-all' },
    { repeat: { pattern: '0 */6 * * *' } }
  );

  // Portfolio price update during market hours (WIB: 9-16, weekdays)
  await portfolioQueue.add(
    'update-all-prices',
    { type: 'update-all' },
    { repeat: { pattern: '0 9-16 * * 1-5' } }
  );

  console.log('[Queue] Scheduled jobs registered');
}

// ─── Helpers (placeholders for external API integration) ────

async function searchRegulations(source: string): Promise<any[]> {
  // TODO: Integrate Tavily API + Hermes regulatory-analysis skill
  return [];
}

function classifySeverity(reg: any): string {
  const title = (reg.title || '').toLowerCase();
  if (title.includes('urgent') || title.includes('wajib') || title.includes('sanksi')) return 'urgent';
  if (title.includes('perubahan') || title.includes('amendment') || title.includes('baru')) return 'important';
  return 'informational';
}

async function fetchCurrentPrice(type: string, name: string, metadata: any): Promise<number | null> {
  // TODO: Integrate market data APIs (KSEI, Antam, Bareksa/IPOT)
  return null;
}
