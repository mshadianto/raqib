// packages/backend/src/modules/regulatory/regulatory.routes.ts
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../../middleware/auth';
import { tenantRateLimit } from '../../middleware/rate-limiter';
import { logAudit, auditContext } from '../../lib/audit-logger';
import { RegulatoryService } from './regulatory.service';

const router = Router();

const alertFilterSchema = z.object({
  source: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const updateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'in_review', 'resolved', 'dismissed']),
});

// GET /regulatory/alerts
router.get(
  '/alerts',
  requireAuth, requireTenant, tenantRateLimit,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = alertFilterSchema.parse(req.query);
      const result = await RegulatoryService.listAlerts(req.tenantSlug!, filters);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (err) { next(err); }
  }
);

// GET /regulatory/alerts/:id
router.get(
  '/alerts/:id',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const alert = await RegulatoryService.getAlert(req.tenantSlug!, req.params.id);
      res.json({ success: true, data: alert });
    } catch (err) { next(err); }
  }
);

// PATCH /regulatory/alerts/:id
router.patch(
  '/alerts/:id',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = updateAlertSchema.parse(req.body);
      const { alert, previousStatus } = await RegulatoryService.updateStatus(
        req.tenantSlug!, req.params.id, body.status, req.user!.userId
      );

      logAudit(req.tenantSlug!, {
        ...auditContext(req),
        action: `alert.${body.status}`,
        resourceType: 'regulatory_alert',
        resourceId: req.params.id,
        metadata: { previousStatus, newStatus: body.status },
      });

      res.json({ success: true, data: alert });
    } catch (err) { next(err); }
  }
);

// GET /regulatory/stats
router.get(
  '/stats',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await RegulatoryService.getStats(req.tenantSlug!);
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  }
);

export default router;
