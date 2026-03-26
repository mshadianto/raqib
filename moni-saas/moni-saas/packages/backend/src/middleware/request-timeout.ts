// packages/backend/src/middleware/request-timeout.ts
// Abort requests that exceed the timeout threshold

import { Request, Response, NextFunction } from 'express';

/**
 * Adds a timeout to requests. If the handler doesn't respond
 * within `ms` milliseconds, sends a 504 Gateway Timeout.
 */
export function requestTimeout(ms = 30_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' },
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
