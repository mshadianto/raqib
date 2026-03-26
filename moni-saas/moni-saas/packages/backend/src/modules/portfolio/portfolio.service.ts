// packages/backend/src/modules/portfolio/portfolio.service.ts
// Business logic for Sharia-compliant portfolio management

import { TenantSchemaService } from '../tenant/tenant-schema.service';
import { AppError, PLAN_LIMITS, type PlanTier } from '@moni/shared';

export interface HoldingInput {
  instrumentType: string;
  instrumentName: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export class PortfolioService {
  /**
   * List holdings with server-side P&L computation via SQL.
   */
  static async listHoldings(tenantSlug: string) {
    // Compute summary directly in SQL — avoids pulling all rows into JS
    const [holdings, summaryRows] = await Promise.all([
      TenantSchemaService.queryTenant(
        tenantSlug,
        'SELECT * FROM portfolio_holdings ORDER BY instrument_type, instrument_name'
      ),
      TenantSchemaService.queryTenant(
        tenantSlug,
        `SELECT
           COALESCE(SUM(quantity * current_price), 0)::float as total_value,
           COALESCE(SUM(quantity * buy_price), 0)::float as total_cost,
           COALESCE(SUM(quantity * (current_price - buy_price)), 0)::float as unrealized_pnl,
           instrument_type,
           COUNT(*)::int as count,
           COALESCE(SUM(quantity * current_price), 0)::float as type_value
         FROM portfolio_holdings
         GROUP BY instrument_type`
      ),
    ]);

    let totalValue = 0;
    let totalCost = 0;
    let unrealizedPnl = 0;
    const holdingsByType: Record<string, { count: number; value: number }> = {};

    for (const row of summaryRows) {
      totalValue += row.total_value;
      totalCost += row.total_cost;
      unrealizedPnl += row.unrealized_pnl;
      holdingsByType[row.instrument_type] = { count: row.count, value: row.type_value };
    }

    return {
      holdings,
      summary: {
        totalValue,
        totalCost,
        unrealizedPnl,
        unrealizedPnlPercent: totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0,
        holdingsByType,
        currency: 'IDR',
      },
    };
  }

  /**
   * Add a new holding, enforcing plan limits.
   */
  static async addHolding(tenantSlug: string, plan: PlanTier, input: HoldingInput) {
    const countRows = await TenantSchemaService.queryTenant<{ count: string }>(
      tenantSlug,
      'SELECT COUNT(*)::int as count FROM portfolio_holdings'
    );
    const currentCount = parseInt(countRows[0]?.count || '0', 10);
    const limits = PLAN_LIMITS[plan];

    if (currentCount >= limits.maxPortfolioInstruments) {
      throw new AppError(
        'PLAN_LIMIT_REACHED',
        `Your ${plan} plan allows up to ${limits.maxPortfolioInstruments} instruments. Upgrade to add more.`,
        403
      );
    }

    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      `INSERT INTO portfolio_holdings (instrument_type, instrument_name, quantity, buy_price, current_price, currency, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.instrumentType, input.instrumentName, input.quantity, input.buyPrice, input.currentPrice, input.currency, JSON.stringify(input.metadata || {})]
    );

    return rows[0];
  }

  /**
   * Update an existing holding.
   */
  static async updateHolding(tenantSlug: string, holdingId: string, input: HoldingInput) {
    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      `UPDATE portfolio_holdings
       SET instrument_type = $1, instrument_name = $2, quantity = $3,
           buy_price = $4, current_price = $5, currency = $6,
           metadata = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [input.instrumentType, input.instrumentName, input.quantity, input.buyPrice, input.currentPrice, input.currency, JSON.stringify(input.metadata || {}), holdingId]
    );

    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Holding not found', 404);
    return rows[0];
  }

  /**
   * Delete a holding.
   */
  static async deleteHolding(tenantSlug: string, holdingId: string) {
    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      'DELETE FROM portfolio_holdings WHERE id = $1 RETURNING id, instrument_name',
      [holdingId]
    );

    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Holding not found', 404);
    return rows[0];
  }
}
