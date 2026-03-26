// packages/backend/src/middleware/request-id.ts
// Assigns a unique request ID to every request for tracing through logs

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
