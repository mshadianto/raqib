// packages/backend/src/modules/billing/billing.service.ts
// Business logic for billing, extracted from routes

import Stripe from 'stripe';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AppError } from '@moni/shared';
import { config } from '../../config';

const prisma = new PrismaClient();

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2024-12-18.acacia' as any })
  : null;

export class BillingService {
  // ─── Checkout ────────────────────────────────────────

  static async createStripeCheckout(
    tenantId: string,
    tenantSlug: string,
    email: string,
    plan: 'pro' | 'enterprise',
    successUrl: string,
    cancelUrl: string
  ) {
    if (!stripe) throw new AppError('STRIPE_NOT_CONFIGURED', 'Stripe is not configured', 503);

    const priceId = plan === 'pro' ? config.stripe.proPriceId : config.stripe.enterprisePriceId;

    // Create or retrieve Stripe customer
    const existingSub = await prisma.subscription.findUnique({ where: { tenantId } });
    let customerId: string;

    if (existingSub?.gatewayCustomerId) {
      customerId = existingSub.gatewayCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { tenantId, tenantSlug },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId, plan },
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  static async createMidtransCheckout(
    tenantId: string,
    tenantSlug: string,
    email: string,
    plan: 'pro' | 'enterprise',
    successUrl: string
  ) {
    const midtrans = require('midtrans-client');
    const snap = new midtrans.Snap({
      isProduction: config.midtrans.isProduction,
      serverKey: config.midtrans.serverKey,
      clientKey: config.midtrans.clientKey,
    });

    const amount = plan === 'pro' ? 499000 : 1499000;
    const orderId = `MONI-${tenantSlug}-${Date.now()}`;

    const transaction = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: amount },
      customer_details: { email },
      item_details: [{
        id: plan,
        name: `MONI ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
        price: amount,
        quantity: 1,
      }],
      callbacks: { finish: successUrl },
    });

    // Store pending invoice with plan info for reliable webhook handling
    await prisma.invoice.create({
      data: {
        tenantId,
        amount,
        currency: 'IDR',
        status: 'pending',
        gateway: 'midtrans',
        gatewayInvoiceId: orderId,
        description: `${plan} plan subscription`,
      },
    });

    return { snapToken: transaction.token, redirectUrl: transaction.redirect_url, orderId };
  }

  // ─── Subscription Query ──────────────────────────────

  static async getSubscription(tenantId: string) {
    const [subscription, invoices] = await Promise.all([
      prisma.subscription.findUnique({ where: { tenantId } }),
      prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return { subscription, invoices };
  }

  // ─── Stripe Webhook ──────────────────────────────────

  static verifyStripeWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!stripe) throw new AppError('STRIPE_NOT_CONFIGURED', 'Stripe not configured', 503);
    return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  }

  static async handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan;
        if (tenantId && plan) {
          await prisma.$transaction([
            prisma.subscription.upsert({
              where: { tenantId },
              create: {
                tenantId, plan, status: 'active', gateway: 'stripe',
                gatewaySubscriptionId: session.subscription as string,
                gatewayCustomerId: session.customer as string,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
              update: {
                plan, status: 'active',
                gatewaySubscriptionId: session.subscription as string,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            }),
            prisma.tenant.update({ where: { id: tenantId }, data: { plan, status: 'active' } }),
          ]);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await prisma.subscription.findFirst({
          where: { gatewaySubscriptionId: invoice.subscription as string },
        });
        if (sub) {
          await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await prisma.subscription.findFirst({
          where: { gatewaySubscriptionId: subscription.id },
        });
        if (sub) {
          await prisma.$transaction([
            prisma.subscription.update({ where: { id: sub.id }, data: { status: 'cancelled' } }),
            prisma.tenant.update({ where: { id: sub.tenantId }, data: { plan: 'starter' } }),
          ]);
        }
        break;
      }
    }
  }

  // ─── Midtrans Webhook ────────────────────────────────

  /**
   * Verify Midtrans webhook signature.
   * Signature = SHA512(order_id + status_code + gross_amount + serverKey)
   */
  static verifyMidtransSignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    signatureKey: string
  ): boolean {
    if (!config.midtrans.serverKey) return false;
    const payload = orderId + statusCode + grossAmount + config.midtrans.serverKey;
    const expected = crypto.createHash('sha512').update(payload).digest('hex');
    return expected === signatureKey;
  }

  static async handleMidtransNotification(body: {
    order_id: string;
    transaction_status: string;
    fraud_status?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
  }) {
    const { order_id, transaction_status, fraud_status } = body;

    const invoice = await prisma.invoice.findFirst({
      where: { gatewayInvoiceId: order_id },
    });
    if (!invoice) throw new AppError('NOT_FOUND', 'Invoice not found', 404);

    // Idempotency: skip if already processed
    if (invoice.status === 'paid' || invoice.status === 'failed') {
      return { status: 'already_processed' };
    }

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (fraud_status === 'accept' || !fraud_status) {
        // Determine plan from invoice description instead of amount
        const plan = invoice.description?.includes('enterprise') ? 'enterprise' : 'pro';

        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: 'paid', paidAt: new Date() },
          }),
          prisma.subscription.upsert({
            where: { tenantId: invoice.tenantId },
            create: {
              tenantId: invoice.tenantId, plan, status: 'active', gateway: 'midtrans',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
              plan, status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          }),
          prisma.tenant.update({
            where: { id: invoice.tenantId },
            data: { plan, status: 'active' },
          }),
        ]);

        return { status: 'paid', plan };
      }
    }

    if (['deny', 'cancel', 'expire'].includes(transaction_status)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'failed' },
      });
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }
}
