// packages/backend/src/modules/regulatory/regulatory.service.ts
// Business logic for regulatory alert management

import { TenantSchemaService } from '../tenant/tenant-schema.service';
import { AppError, paginate, buildWhereClause, type FilterCondition, type PaginatedResult } from '@moni/shared';

export interface AlertFilters {
  source?: string;
  severity?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export class RegulatoryService {
  /**
   * List alerts with dynamic filtering and pagination.
   */
  static async listAlerts(tenantSlug: string, filters: AlertFilters): Promise<PaginatedResult<any>> {
    const conditions: FilterCondition[] = [];

    if (filters.source) {
      conditions.push({ sql: 'source = ANY($N::varchar[])', value: filters.source.split(',') });
    }
    if (filters.severity) {
      conditions.push({ sql: 'severity = ANY($N::varchar[])', value: filters.severity.split(',') });
    }
    if (filters.status) {
      conditions.push({ sql: 'status = ANY($N::varchar[])', value: filters.status.split(',') });
    }
    if (filters.search) {
      conditions.push({ sql: '(title ILIKE $N OR summary ILIKE $N)', value: `%${filters.search}%` });
    }

    const { clause, params, nextIdx } = buildWhereClause(conditions);

    // Count total
    const countRows = await TenantSchemaService.queryTenant<{ count: string }>(
      tenantSlug,
      `SELECT COUNT(*) as count FROM regulatory_alerts WHERE ${clause}`,
      params
    );
    const total = parseInt(countRows[0]?.count || '0', 10);
    const { offset, meta } = paginate(filters, total);

    // Fetch page
    const allParams = [...params, filters.limit, offset];
    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      `SELECT * FROM regulatory_alerts WHERE ${clause}
       ORDER BY created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      allParams
    );

    return { data: rows, meta };
  }

  /**
   * Get a single alert by ID.
   */
  static async getAlert(tenantSlug: string, alertId: string) {
    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      'SELECT * FROM regulatory_alerts WHERE id = $1',
      [alertId]
    );
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Alert not found', 404);
    return rows[0];
  }

  /**
   * Update alert status. Returns the old status for audit trail.
   */
  static async updateStatus(
    tenantSlug: string,
    alertId: string,
    newStatus: string,
    userId: string
  ) {
    // Fetch current status first for proper audit
    const current = await TenantSchemaService.queryTenant(
      tenantSlug,
      'SELECT status FROM regulatory_alerts WHERE id = $1',
      [alertId]
    );
    if (current.length === 0) throw new AppError('NOT_FOUND', 'Alert not found', 404);

    const previousStatus = current[0].status;

    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      `UPDATE regulatory_alerts
       SET status = $1, acknowledged_by = $2, acknowledged_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newStatus, userId, alertId]
    );

    return { alert: rows[0], previousStatus };
  }

  /**
   * Dashboard stats — single optimized query with all aggregations.
   */
  static async getStats(tenantSlug: string) {
    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      `SELECT
         severity,
         status,
         COUNT(*)::int as count,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int as recent_count,
         COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'dismissed'))::int as unresolved_count
       FROM regulatory_alerts
       GROUP BY severity, status
       ORDER BY severity, status`
    );

    // Aggregate totals from grouped rows
    let recentWeek = 0;
    let unresolved = 0;
    for (const row of rows) {
      recentWeek += row.recent_count;
      unresolved += row.unresolved_count;
    }

    return {
      bySeverity: rows.map(({ severity, status, count }) => ({ severity, status, count })),
      recentWeek,
      unresolved,
    };
  }
}
