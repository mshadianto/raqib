// packages/backend/src/modules/audit-trail/audit.routes.ts
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../../middleware/auth';
import { AuditService } from './audit.service';

const router = Router();

const auditFilterSchema = z.object({
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// GET /audit
router.get(
  '/',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = auditFilterSchema.parse(req.query);
      const result = await AuditService.listEntries(req.tenantSlug!, filters);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) { next(err); }
  }
);

// GET /audit/stats
router.get(
  '/stats',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await AuditService.getStats(req.tenantSlug!);
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  }
);

export default router;
