// packages/backend/src/lib/audit-logger.ts
// Centralized audit trail logger to avoid duplication across modules

import { TenantSchemaService } from '../modules/tenant/tenant-schema.service';
import type { AuthenticatedRequest } from '../middleware/auth';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit trail entry in the tenant's schema.
 * Fire-and-forget — errors are logged but don't propagate.
 */
export async function logAudit(tenantSlug: string, entry: AuditLogEntry): Promise<void> {
  try {
    await TenantSchemaService.queryTenant(
      tenantSlug,
      `INSERT INTO audit_trail (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId,
        entry.action,
        entry.resourceType || null,
        entry.resourceId || null,
        JSON.stringify(entry.metadata || {}),
        entry.ipAddress || null,
        entry.userAgent || null,
      ]
    );
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

/**
 * Extract common audit context from an authenticated request.
 */
export function auditContext(req: AuthenticatedRequest): Pick<AuditLogEntry, 'userId' | 'ipAddress' | 'userAgent'> {
  return {
    userId: req.user!.userId,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
  };
}
