// packages/backend/src/middleware/error-handler.ts
// Centralized error handler — normalizes all errors into consistent ApiError responses

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@moni/shared';
import { config } from '../config';

/**
 * Express error handler. Must be registered LAST (after all routes).
 * Handles AppError, ZodError, and unexpected errors uniformly.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Already sent — nothing to do
  if (res.headersSent) return;

  const requestId = req.requestId || 'unknown';

  // Known application error
  if (err instanceof AppError) {
    logError(requestId, err.statusCode, err.code, err.message);
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Zod validation error
  if (err instanceof ZodError) {
    logError(requestId, 400, 'VALIDATION_ERROR', `${err.issues.length} validation issue(s)`);
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
  }

  // Prisma known errors (unique constraint, not found)
  if (isPrismaError(err)) {
    const { status, code, message } = mapPrismaError(err);
    logError(requestId, status, code, message);
    return res.status(status).json({ success: false, error: { code, message } });
  }

  // Unexpected error — hide details in production
  const message = config.env === 'production'
    ? 'Internal server error'
    : (err instanceof Error ? err.message : 'Unknown error');

  logError(requestId, 500, 'INTERNAL_ERROR', err instanceof Error ? err.message : String(err));

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}

function logError(requestId: string, status: number, code: string, message: string) {
  const entry = { timestamp: new Date().toISOString(), requestId, status, code, message };
  if (status >= 500) {
    console.error('[Error]', JSON.stringify(entry));
  } else {
    console.warn('[Warn]', JSON.stringify(entry));
  }
}

function isPrismaError(err: unknown): err is { code: string; meta?: { target?: string[] } } {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as any).code === 'string' && (err as any).code.startsWith('P');
}

function mapPrismaError(err: { code: string; meta?: { target?: string[] } }) {
  switch (err.code) {
    case 'P2002': // Unique constraint
      return { status: 409, code: 'CONFLICT', message: `Duplicate value for: ${err.meta?.target?.join(', ') || 'field'}` };
    case 'P2025': // Not found
      return { status: 404, code: 'NOT_FOUND', message: 'Record not found' };
    default:
      return { status: 500, code: 'DATABASE_ERROR', message: 'Database operation failed' };
  }
}
