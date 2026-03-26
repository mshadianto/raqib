# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is the RAQIB project workspace — a multi-agent GRC (Governance, Risk, Compliance) platform for Indonesian audit committees, compliance officers, and Islamic finance professionals.

- `moni-saas/moni-saas/` — Main SaaS monorepo (npm workspaces). Has its own CLAUDE.md with detailed architecture docs.
- `raqib-landing.jsx` — Standalone React landing page prototype (RAQIB branding)
- `moni-dashboard.jsx` — Standalone React dashboard prototype (mock data, Recharts)
- `RAQIB-Brand-Identity-System.pdf` — Brand identity guidelines

## MONI SaaS Monorepo

The core application lives in `moni-saas/moni-saas/`. It is an npm workspaces monorepo with four packages:

| Package | Role | Key Tech |
|---------|------|----------|
| `packages/shared` | Shared types, errors, pagination utils | TypeScript |
| `packages/backend` | Express API server | Express, Prisma, pg, BullMQ, Zod |
| `packages/frontend` | Web UI | Next.js 14, Tailwind, React Query, Zustand, Recharts |
| `packages/hermes-bridge` | OpenClaw-to-Hermes migration tools | TypeScript |

### Common Commands (run from `moni-saas/moni-saas/`)

```bash
npm run dev              # Start backend (4000) + frontend (3000) concurrently
npm run dev:backend      # Backend only (tsx watch)
npm run dev:frontend     # Frontend only (next dev)
npm run build            # Build all workspaces
npm run lint             # Lint all workspaces
npm run test             # Test all workspaces (vitest for backend)
npm run docker:up        # Start PostgreSQL + Redis via Docker Compose
npm run docker:down      # Stop Docker services
npm run db:migrate       # Run Prisma migrations (backend)
npm run db:seed          # Seed database (backend)
npm run db:studio        # Open Prisma Studio
```

### Architecture Pattern: Routes → Services

Every backend module follows a clean split:
- **Routes** (`*.routes.ts`) — HTTP concerns, Zod validation, call service, delegate errors via `next(err)`
- **Services** (`*.service.ts`) — Business logic, DB queries, throw `AppError` from `@moni/shared`
- **Error handler** middleware auto-formats AppError, ZodError, and Prisma errors

### Multi-Tenancy Model

Schema-per-tenant isolation on PostgreSQL:
- `public` schema: shared tables managed by Prisma ORM (users, tenants, billing)
- `tenant_<slug>` schemas: isolated tables managed by raw SQL via `TenantSchemaService`
- Tenant context: `X-Tenant-Slug` header → `requireTenant` middleware → sets `req.tenantSlug`, `req.tenantPlan`
- Never use Prisma for tenant-scoped tables; use the raw pg client

### 12 AI Agents (3 Tiers)

Executive: MONI (orchestration), FALAH (sharia wealth), AURIX (audit). Director: TAKWA (governance), AMANAH (risk), HIKMAH (strategy), BASYAR (HR). Lead: NIZAM (regulatory), AMAN (cybersecurity), RA'IS (comms), WASIT (QA), MUHTASIB (internal control). All execute skills via Hermes Agent integration with 30s timeout.

### Stability Infrastructure

- Request IDs (`X-Request-Id`) for tracing
- Request timeout (30s default)
- Graceful shutdown (SIGTERM/SIGINT drain)
- Deep health check (`/health` probes DB + Redis)
- Centralized error handler (AppError, Zod, Prisma errors)
- Auth rate limiting (10 attempts / 15 min)
- BullMQ retry with exponential backoff

### Brand & Design

Brand colors: Gold (#C8943E / #E8C47A), Deep navy (#0B1120), Cream (#F5F0E6), Teal (#0D7377), Coral (#C75C3A). See the PDF for full brand identity guidelines.

## Environment Notes

- Node.js >= 22 required
- Use `127.0.0.1` instead of `localhost` (Windows proxy issues)
- Ports: Backend 4000, Frontend 3000, PostgreSQL 5432, Redis 6379
- License: Proprietary — KIM Consulting / MS Hadianto
