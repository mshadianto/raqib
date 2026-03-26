// packages/backend/src/lib/graceful-shutdown.ts
// Handles SIGTERM/SIGINT by draining connections before exit

import { Server } from 'http';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

interface ShutdownDeps {
  server: Server;
  pool: Pool;
  redis: Redis;
}

export function setupGracefulShutdown({ server, pool, redis }: ShutdownDeps) {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n[Shutdown] Received ${signal}, draining connections...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log('[Shutdown] HTTP server closed');

      try {
        await pool.end();
        console.log('[Shutdown] Database pool closed');
      } catch (err) {
        console.error('[Shutdown] Database pool close error:', err);
      }

      try {
        redis.disconnect();
        console.log('[Shutdown] Redis disconnected');
      } catch (err) {
        console.error('[Shutdown] Redis disconnect error:', err);
      }

      console.log('[Shutdown] Clean exit');
      process.exit(0);
    });

    // Force exit after 15s if drain is stuck
    setTimeout(() => {
      console.error('[Shutdown] Forced exit after timeout');
      process.exit(1);
    }, 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
