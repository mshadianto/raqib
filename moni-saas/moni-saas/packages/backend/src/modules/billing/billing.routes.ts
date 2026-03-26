// packages/backend/src/modules/billing/billing.routes.ts
import { Router, Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenant, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '@moni/shared';
import { BillingService } from './billing.service';

const router = Router();

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  gateway: z.enum(['stripe', 'midtrans']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// POST /billing/checkout
router.post(
  '/checkout',
  requireAuth, requireTenant, requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = checkoutSchema.parse(req.body);

      if (body.gateway === 'stripe') {
        const result = await BillingService.createStripeCheckout(
          req.tenantId!, req.tenantSlug!, req.user!.email,
          body.plan, body.successUrl, body.cancelUrl
        );
        return res.json({ success: true, data: result });
      }

      if (body.gateway === 'midtrans') {
        const result = await BillingService.createMidtransCheckout(
          req.tenantId!, req.tenantSlug!, req.user!.email,
          body.plan, body.successUrl
        );
        return res.json({ success: true, data: result });
      }
    } catch (err) { next(err); }
  }
);

// GET /billing/subscription
router.get(
  '/subscription',
  requireAuth, requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await BillingService.getSubscription(req.tenantId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /billing/webhook/stripe
router.post(
  '/webhook/stripe',
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    try {
      const event = BillingService.verifyStripeWebhook(req.body, sig);
      await BillingService.handleStripeEvent(event);
      res.json({ received: true });
    } catch (err: any) {
      console.error('[Stripe] Webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// POST /billing/webhook/midtrans
router.post(
  '/webhook/midtrans',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { order_id, status_code, gross_amount, signature_key } = req.body;
      if (!order_id) throw new AppError('MISSING_FIELD', 'Missing order_id', 400);

      // Verify signature if server key is configured
      if (signature_key) {
        const valid = BillingService.verifyMidtransSignature(
          order_id, status_code || '', gross_amount || '', signature_key
        );
        if (!valid) {
          console.warn('[Midtrans] Invalid webhook signature for:', order_id);
          return res.status(403).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature mismatch' } });
        }
      }

      await BillingService.handleMidtransNotification(req.body);
      res.json({ received: true });
    } catch (err) { next(err); }
  }
);

export default router;
