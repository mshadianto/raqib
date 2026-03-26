# MONI SaaS — Multi-Agent GRC Command Center

> Transform your compliance workflow with AI-powered regulatory monitoring, portfolio tracking, and audit trail management — powered by [Hermes Agent](https://github.com/NousResearch/hermes-agent).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MONI SaaS Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Next.js  │  │   Express    │  │   Hermes Agent        │  │
│  │ Frontend │◄►│   Backend    │◄►│   Bridge              │  │
│  │ (React)  │  │   (API)      │  │   (Skills/Workflows)  │  │
│  └──────────┘  └──────┬───────┘  └───────────┬───────────┘  │
│                       │                       │              │
│                  ┌────▼────┐            ┌─────▼──────┐      │
│                  │  Redis  │            │  Hermes    │      │
│                  │  Queue  │            │  Gateway   │      │
│                  └────┬────┘            │ (Telegram/ │      │
│                       │                │  WhatsApp) │      │
│                  ┌────▼────────┐       └────────────┘      │
│                  │ PostgreSQL  │                             │
│                  │ (per-tenant │                             │
│                  │  schemas)   │                             │
│                  └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy: Schema-per-Tenant

Each organization gets an isolated PostgreSQL schema (`tenant_<slug>`). Shared tables (users, tenants, billing) live in `public`. Row-Level Security (RLS) enforces boundaries even if code has bugs.

### Hermes Agent Integration

MONI leverages Hermes Agent's self-improving learning loop:

- **Skills Bridge**: MONI's 26 OpenClaw skills are ported to Hermes `agentskills.io` format
- **Memory Sync**: Hermes persistent memory stores per-tenant regulatory context
- **Gateway**: Telegram/WhatsApp alerts via Hermes multi-platform gateway
- **ClawFlows → Hermes Cron**: Workflow schedules migrate to Hermes cron jobs
- **Self-Evolution**: Agent behaviors improve via Hermes's built-in learning loop

Migration path: `hermes claw migrate` auto-imports existing OpenClaw config.

## Tech Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| Frontend     | Next.js 14, Tailwind CSS, React Query, Recharts    |
| Backend      | Node.js, Express, TypeScript, Prisma ORM           |
| Database     | PostgreSQL 16 (schema-per-tenant)                  |
| Cache/Queue  | Redis 7, BullMQ                                    |
| AI Engine    | Hermes Agent (Nous Research) + OpenRouter           |
| Payments     | Stripe (international) + Midtrans (Indonesia)      |
| Notifications| SendGrid + WhatsApp Business API via Hermes Gateway|
| Deployment   | Docker Compose → Kubernetes (AWS EKS / GCP GKE)   |

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/mshadianto/moni-saas.git
cd moni-saas
npm install

# 2. Start infrastructure
npm run docker:up  # PostgreSQL + Redis

# 3. Setup environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your credentials

# 4. Run migrations & seed
npm run db:migrate
npm run db:seed

# 5. Start development
npm run dev
# Backend:  http://127.0.0.1:4000
# Frontend: http://127.0.0.1:3000

# 6. (Optional) Connect Hermes Agent
npm run hermes:migrate
```

## Subscription Plans

| Feature                | Starter (Free) | Pro (Rp 499K)  | Enterprise (Rp 1.499K) |
| ---------------------- | --------------- | --------------- | ----------------------- |
| Users                  | 1               | 5               | Unlimited               |
| Agents                 | 3 (basic)       | 7               | 12 (all tiers)          |
| Regulatory sources     | POJK only       | POJK + DSN-MUI  | All + custom            |
| Portfolio instruments   | 10              | 50              | Unlimited               |
| Audit trail retention  | 30 days         | 1 year          | 7 years                 |
| WhatsApp alerts        | —               | ✓               | ✓ + priority            |
| API access             | —               | 1,000 req/day   | 10,000 req/day          |
| Hermes self-evolution  | —               | —               | ✓                       |

## License

Proprietary — © 2026 KIM Consulting / MS Hadianto
