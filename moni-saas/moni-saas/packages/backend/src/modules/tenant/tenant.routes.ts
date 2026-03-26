// packages/backend/src/modules/tenant/tenant.routes.ts
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireTenant, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { TenantSchemaService } from './tenant-schema.service';
import { AppError } from '@moni/shared';

const router = Router();
const prisma = new PrismaClient();

const createTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

// POST /tenants — Create organization
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = createTenantSchema.parse(req.body);

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug: body.slug } });
    if (existing) {
      throw new AppError('SLUG_EXISTS', 'This organization URL is already taken', 409);
    }

    // Create tenant + membership in transaction
    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: body.name,
          slug: body.slug,
          plan: 'starter',
          status: 'trial',
        },
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: t.id,
          userId: req.user!.userId,
          role: 'admin',
        },
      });

      return t;
    });

    // Create isolated schema
    await TenantSchemaService.createSchema(body.slug);

    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.errors },
      });
    }
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    next(err);
  }
});

// GET /tenants — List user's organizations
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: req.user!.userId },
    include: { tenant: true },
    orderBy: { joinedAt: 'desc' },
  });

  const tenants = memberships.map((m) => ({
    ...m.tenant,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  res.json({ success: true, data: tenants });
});

// GET /tenants/:tenantSlug — Get org details
router.get('/:tenantSlug', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: req.tenantSlug },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        },
      },
      subscription: true,
    },
  });

  res.json({ success: true, data: tenant });
});

// POST /tenants/:tenantSlug/invite — Invite member
router.post(
  '/:tenantSlug/invite',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = inviteSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'No user found with this email. They must register first.', 404);
      }

      // Check existing membership
      const existing = await prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: { tenantId: req.tenantId!, userId: user.id },
        },
      });
      if (existing) {
        throw new AppError('ALREADY_MEMBER', 'This user is already a member of this organization', 409);
      }

      const membership = await prisma.tenantMembership.create({
        data: {
          tenantId: req.tenantId!,
          userId: user.id,
          role: body.role,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      // TODO: Send invitation email via SendGrid
      // TODO: Log audit trail entry

      res.status(201).json({ success: true, data: membership });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

// DELETE /tenants/:tenantSlug/members/:userId — Remove member
router.delete(
  '/:tenantSlug/members/:userId',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Prevent admin from removing themselves
      if (req.params.userId === req.user!.userId) {
        throw new AppError('CANNOT_REMOVE_SELF', 'You cannot remove yourself. Transfer admin role first.', 400);
      }

      await prisma.tenantMembership.delete({
        where: {
          tenantId_userId: { tenantId: req.tenantId!, userId: req.params.userId },
        },
      });

      res.json({ success: true, data: { message: 'Member removed' } });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      next(err);
    }
  }
);

export default router;
