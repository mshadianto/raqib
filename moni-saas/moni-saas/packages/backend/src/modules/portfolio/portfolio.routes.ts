// packages/backend/src/modules/portfolio/portfolio.routes.ts
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../../middleware/auth';
import { logAudit, auditContext } from '../../lib/audit-logger';
import { PortfolioService } from './portfolio.service';
import type { PlanTier } from '@moni/shared';

const router = Router();

const holdingSchema = z.object({
  instrumentType: z.enum(['sukuk', 'gold', 'mutual_fund_syariah', 'deposit_syariah', 'equity_syariah', 'reit_syariah', 'other']),
  instrumentName: z.string().min(1).max(255),
  quantity: z.number().positive(),
  buyPrice: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  currency: z.string().length(3).default('IDR'),
  metadata: z.record(z.unknown()).optional(),
});

// GET /portfolio/holdings
router.get(
  '/holdings',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await PortfolioService.listHoldings(req.tenantSlug!);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

// POST /portfolio/holdings
router.post(
  '/holdings',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = holdingSchema.parse(req.body);
      // Plan comes from tenant record set by middleware (see auth.ts requireTenant)
      const plan = (req as any).tenantPlan as PlanTier || 'starter';
      const holding = await PortfolioService.addHolding(req.tenantSlug!, plan, body);

      logAudit(req.tenantSlug!, {
        ...auditContext(req),
        action: 'portfolio.updated',
        resourceType: 'portfolio_holding',
        resourceId: holding.id,
        metadata: { action: 'created', instrument: body.instrumentName },
      });

      res.status(201).json({ success: true, data: holding });
    } catch (err) { next(err); }
  }
);

// PUT /portfolio/holdings/:id
router.put(
  '/holdings/:id',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = holdingSchema.parse(req.body);
      const holding = await PortfolioService.updateHolding(req.tenantSlug!, req.params.id, body);

      logAudit(req.tenantSlug!, {
        ...auditContext(req),
        action: 'portfolio.updated',
        resourceType: 'portfolio_holding',
        resourceId: req.params.id,
        metadata: { action: 'updated', instrument: body.instrumentName },
      });

      res.json({ success: true, data: holding });
    } catch (err) { next(err); }
  }
);

// DELETE /portfolio/holdings/:id
router.delete(
  '/holdings/:id',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deleted = await PortfolioService.deleteHolding(req.tenantSlug!, req.params.id);

      logAudit(req.tenantSlug!, {
        ...auditContext(req),
        action: 'portfolio.updated',
        resourceType: 'portfolio_holding',
        resourceId: req.params.id,
        metadata: { action: 'deleted', instrument: deleted.instrument_name },
      });

      res.json({ success: true, data: { message: 'Holding deleted' } });
    } catch (err) { next(err); }
  }
);

export default router;
