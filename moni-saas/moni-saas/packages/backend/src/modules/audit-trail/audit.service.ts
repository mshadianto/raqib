// packages/backend/src/modules/audit-trail/audit.service.ts
// Business logic for audit trail queries

import { TenantSchemaService } from '../tenant/tenant-schema.service';
import { paginate, buildWhereClause, type FilterCondition, type PaginatedResult } from '@moni/shared';

export interface AuditFilters {
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page: number;
  limit: number;
}

export class AuditService {
  /**
   * List audit entries with dynamic filtering and pagination.
   */
  static async listEntries(tenantSlug: string, filters: AuditFilters): Promise<PaginatedResult<any>> {
    const conditions: FilterCondition[] = [];

    if (filters.action) {
      conditions.push({ sql: 'a.action = ANY($N::varchar[])', value: filters.action.split(',') });
    }
    if (filters.userId) {
      conditions.push({ sql: 'a.user_id = $N', value: filters.userId });
    }
    if (filters.dateFrom) {
      conditions.push({ sql: 'a.created_at >= $N::timestamptz', value: filters.dateFrom });
    }
    if (filters.dateTo) {
      conditions.push({ sql: 'a.created_at <= $N::timestamptz', value: filters.dateTo });
    }
    if (filters.search) {
      conditions.push({ sql: '(a.action ILIKE $N OR a.metadata::text ILIKE $N)', value: `%${filters.search}%` });
    }

    const { clause, params, nextIdx } = buildWhereClause(conditions);

    const countRows = await TenantSchemaService.queryTenant<{ count: string }>(
      tenantSlug,
      `SELECT COUNT(*) as count FROM audit_trail a WHERE ${clause}`,
      params
    );
    const total = parseInt(countRows[0]?.count || '0', 10);
    const { offset, meta } = paginate(filters, total);

    const allParams = [...params, filters.limit, offset];
    const rows = await TenantSchemaService.queryTenant(
      tenantSlug,
      `SELECT a.*, u.full_name as user_name, u.email as user_email
       FROM audit_trail a
       LEFT JOIN public.users u ON a.user_id = u.id
       WHERE ${clause}
       ORDER BY a.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      allParams
    );

    return { data: rows, meta };
  }

  /**
   * 30-day activity stats — all in a single parallel batch.
   */
  static async getStats(tenantSlug: string) {
    const [activityByDay, topActions, topUsers] = await Promise.all([
      TenantSchemaService.queryTenant(
        tenantSlug,
        `SELECT DATE(created_at) as date, COUNT(*)::int as count
         FROM audit_trail
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`
      ),
      TenantSchemaService.queryTenant(
        tenantSlug,
        `SELECT action, COUNT(*)::int as count
         FROM audit_trail
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY action
         ORDER BY count DESC
         LIMIT 10`
      ),
      TenantSchemaService.queryTenant(
        tenantSlug,
        `SELECT a.user_id, u.full_name, COUNT(*)::int as count
         FROM audit_trail a
         LEFT JOIN public.users u ON a.user_id = u.id
         WHERE a.created_at > NOW() - INTERVAL '30 days'
         GROUP BY a.user_id, u.full_name
         ORDER BY count DESC
         LIMIT 5`
      ),
    ]);

    return { activityByDay, topActions, topUsers };
  }
}
