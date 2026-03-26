// packages/shared/src/errors.ts
// Canonical error class shared across backend and frontend

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

// Pre-defined error factories for common cases
export const Errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Insufficient permissions') =>
    new AppError('FORBIDDEN', message, 403),
  notFound: (resource = 'Resource') =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  conflict: (message: string) =>
    new AppError('CONFLICT', message, 409),
  validation: (message: string, details?: unknown) =>
    new AppError('VALIDATION_ERROR', message, 400, details),
  rateLimited: (message = 'Too many requests') =>
    new AppError('RATE_LIMITED', message, 429),
  serviceUnavailable: (service: string) =>
    new AppError('SERVICE_UNAVAILABLE', `${service} is currently unavailable`, 503),
  internal: (message = 'Internal server error') =>
    new AppError('INTERNAL_ERROR', message, 500),
} as const;
