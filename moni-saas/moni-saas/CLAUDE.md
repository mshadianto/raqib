# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MONI SaaS** is a multi-tenant GRC (Governance, Risk, Compliance) command center built for Indonesian audit committees, compliance officers, and Islamic finance professionals. Powered by [Hermes Agent](https://github.com/NousResearch/hermes-agent) with 12 specialized AI agents.

## Architecture

```
moni-saas/                           # Monorepo (npm workspaces)
├── packages/
│   ├── shared/                      # Shared types, errors, pagination utilities
│   │   └── src/
│   │       ├── index.ts             # Re-exports all shared modules
│   │       ├── types/index.ts       # Canonical type definitions
│   │       ├── errors.ts            # AppError class + Errors factory
│   │       └── pagination.ts        # paginate(), buildWhereClause()
│   ├── backend/                     # Express + TypeScript API
│   │   └── src/
│   │       ├── config/              # Environment config
│   │       ├── lib/                 # Cross-cutting infrastructure
│   │       │   ├── audit-logger.ts  # Centralized audit trail logger
│   │       │   ├── cache.ts         # Redis-backed cache layer
│   │       │   ├── graceful-shutdown.ts
│   │       │   └── health.ts        # Deep health check (DB + Redis)
│   │       ├── middleware/
│   │       │   ├── auth.ts          # JWT + tenant context + plan
│   │       │   ├── error-handler.ts # Centralized error handler (AppError, Zod, Prisma)
│   │       │   ├── rate-limiter.ts  # Global + auth + per-tenant rate limiting
│   │       │   ├── request-id.ts    # X-Request-Id tracing
│   │       │   └── request-timeout.ts
│   │       ├── modules/
│   │       │   ├── auth/            # auth.routes.ts + auth.service.ts
│   │       │   ├── tenant/          # tenant.routes.ts + tenant-schema.service.ts
│   │       │   ├── regulatory/      # regulatory.routes.ts + regulatory.service.ts
│   │       │   ├── portfolio/       # portfolio.routes.ts + portfolio.service.ts
│   │       │   ├── audit-trail/     # audit.routes.ts + audit.service.ts
│   │       │   ├── billing/         # billing.routes.ts + billing.service.ts
│   │       │   ├── queue/           # queue.service.ts (BullMQ workers + cron)
│   │       │   └── hermes/          # hermes.routes.ts + hermes.service.ts
│   │       ├── database/migrations/ # Per-tenant schema SQL template
│   │       └── server.ts            # Express app entry point
│   ├── frontend/                    # Next.js 14 + Tailwind + React Query + Recharts
│   │   └── src/
│   │       ├── lib/api.ts           # Typed API client with timeout + retry
│   │       └── stores/auth.store.ts # Zustand auth + tenant state
│   └── hermes-bridge/               # OpenClaw → Hermes migration tools
├── infrastructure/
│   ├── docker/                      # Docker Compose (dev), Dockerfiles (prod)
│   └── k8s/                         # Kubernetes manifests
└── scripts/setup.sh                 # One-command project setup
```

## Code Patterns

### Routes → Services pattern
Every module follows the routes/service split:
- **Routes** (`*.routes.ts`): HTTP concerns only — validation (Zod), calling service, formatting response
- **Services** (`*.service.ts`): Business logic, DB queries, error throwing
- Routes delegate ALL errors to the centralized `errorHandler` middleware via `next(err)`

### Error handling
- Use `AppError` from `@moni/shared` for all known errors (it has `.toJSON()`)
- Use `Errors.*` factory functions for common cases: `Errors.notFound('Alert')`, `Errors.forbidden()`
- Zod errors and Prisma errors are auto-handled by `errorHandler` middleware
- Never manually format error JSON in routes — just `throw` and let middleware handle it

### Multi-tenancy
- `public` schema: Shared tables (Prisma ORM)
- `tenant_<slug>` schemas: Isolated tables (raw SQL via `TenantSchemaService`)
- `requireTenant` middleware sets `req.tenantSlug`, `req.tenantId`, `req.memberRole`, `req.tenantPlan`
- Plan is read from DB by middleware — never from query params
- All tenant-scoped queries: `TenantSchemaService.queryTenant(slug, sql, params)`

### Pagination & filtering
- Use `paginate()` and `buildWhereClause()` from `@moni/shared`
- `buildWhereClause` uses `$N` placeholder that auto-increments parameter indices

### Audit logging
- Use `logAudit(tenantSlug, entry)` from `lib/audit-logger.ts`
- Use `auditContext(req)` to extract userId, IP, user-agent from request

### Caching
- Use `cached(key, loader, ttlSeconds)` from `lib/cache.ts`
- `invalidateCache(pattern)` to bust cache

## Common Development Tasks

### Start development
```bash
bash scripts/setup.sh    # First time only
npm run dev              # Backend (4000) + Frontend (3000)
```

### Add a new API route
1. Create service file: `packages/backend/src/modules/<module>/<module>.service.ts`
2. Create route file: `packages/backend/src/modules/<module>/<module>.routes.ts`
3. Use `requireAuth`, `requireTenant` middleware chain
4. Use `TenantSchemaService.queryTenant()` for tenant-scoped queries
5. Throw `AppError` for business errors — errorHandler middleware formats the response
6. Register route in `server.ts`

### Add a new tenant-scoped table
1. Add CREATE TABLE to `packages/backend/src/database/migrations/001_tenant_schema.sql`
2. Use `__TENANT_SCHEMA__` placeholder
3. Re-run `TenantSchemaService.createSchema()` for existing tenants

### Modify billing
- Service logic: `packages/backend/src/modules/billing/billing.service.ts`
- Route handlers: `packages/backend/src/modules/billing/billing.routes.ts`
- Midtrans webhook now verifies SHA512 signature
- Plan limits defined in `packages/shared/src/types/index.ts` (`PLAN_LIMITS`)

## Environment

- **Node.js**: v22+
- **Database**: PostgreSQL 16 + Redis 7 (via Docker)
- **Ports**: Backend 4000, Frontend 3000, PostgreSQL 5432, Redis 6379
- **Use 127.0.0.1** instead of localhost (Windows proxy issues)

## Do NOT
- Do not use Prisma for tenant-scoped tables (raw SQL via pg client)
- Do not bypass tenant middleware for data queries
- Do not read plan from query params — use `req.tenantPlan` set by middleware
- Do not format error responses manually in routes — throw AppError, let errorHandler do it
- Do not instantiate new PrismaClient() in every file — reuse module-level instances
