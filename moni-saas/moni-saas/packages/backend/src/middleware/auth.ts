// packages/backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';
import type { PlanTier } from '@moni/shared';

const prisma = new PrismaClient();

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  tenantSlug?: string;
  tenantId?: string;
  memberRole?: string;
  tenantPlan?: PlanTier;
}

/**
 * Verify JWT access token from Authorization header.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Access token expired or invalid' },
    });
  }
}

/**
 * Extract tenant slug from X-Tenant-Slug header or URL param.
 * Verifies user has membership and exposes tenant plan on the request.
 */
export function requireTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const slug = (req.headers['x-tenant-slug'] as string) || req.params.tenantSlug;

  if (!slug) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TENANT', message: 'X-Tenant-Slug header or tenantSlug param required' },
    });
  }

  req.tenantSlug = slug;

  prisma.tenant
    .findUnique({
      where: { slug },
      include: {
        memberships: {
          where: { userId: req.user!.userId },
        },
      },
    })
    .then((tenant) => {
      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Organization not found' },
        });
      }
      if (tenant.memberships.length === 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this organization' },
        });
      }
      if (tenant.status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: { code: 'TENANT_SUSPENDED', message: 'This organization is currently suspended' },
        });
      }

      req.tenantId = tenant.id;
      req.memberRole = tenant.memberships[0].role;
      // Expose tenant plan — used by rate limiter and plan-limit checks
      req.tenantPlan = tenant.plan as PlanTier;
      next();
    })
    .catch(next);
}

/**
 * Require a specific role within the tenant.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.memberRole || !roles.includes(req.memberRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `This action requires one of: ${roles.join(', ')}`,
        },
      });
    }
    next();
  };
}
