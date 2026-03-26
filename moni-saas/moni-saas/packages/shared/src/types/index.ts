// packages/shared/src/types/index.ts
// Canonical type definitions shared across all MONI packages

// ─── Auth & Users ───────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

// ─── Tenants & Memberships ──────────────────────────────────
export type PlanTier = 'starter' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type MemberRole = 'admin' | 'member' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: PlanTier;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembership {
  tenantId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user?: User;
  tenant?: Tenant;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  plan?: PlanTier;
}

export interface InviteMemberRequest {
  email: string;
  role: MemberRole;
}

// ─── Regulatory Alerts ──────────────────────────────────────
export type RegulatorySource = 'POJK' | 'DSN-MUI' | 'ISO' | 'BI' | 'OJK' | 'BAPEPAM' | 'custom';
export type AlertSeverity = 'urgent' | 'important' | 'informational';
export type AlertStatus = 'new' | 'acknowledged' | 'in_review' | 'resolved' | 'dismissed';

export interface RegulatoryAlert {
  id: string;
  source: RegulatorySource;
  title: string;
  summary: string;
  fullText?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  sourceUrl?: string;
  publishedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryAlertFilter {
  source?: RegulatorySource[];
  severity?: AlertSeverity[];
  status?: AlertStatus[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Portfolio ──────────────────────────────────────────────
export type InstrumentType =
  | 'sukuk'
  | 'gold'
  | 'mutual_fund_syariah'
  | 'deposit_syariah'
  | 'equity_syariah'
  | 'reit_syariah'
  | 'other';

export interface PortfolioHolding {
  id: string;
  instrumentType: InstrumentType;
  instrumentName: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  currency: string;
  lastUpdated: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  holdingsByType: Record<InstrumentType, { count: number; value: number }>;
  currency: string;
}

// ─── Audit Trail ────────────────────────────────────────────
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'alert.created'
  | 'alert.acknowledged'
  | 'alert.resolved'
  | 'portfolio.updated'
  | 'member.invited'
  | 'member.removed'
  | 'settings.changed'
  | 'report.generated'
  | 'agent.executed'
  | 'billing.charged';

export interface AuditEntry {
  id: string;
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditFilter {
  action?: AuditAction[];
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Billing ────────────────────────────────────────────────
export type PaymentGateway = 'stripe' | 'midtrans';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface Subscription {
  id: string;
  tenantId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  gateway: PaymentGateway;
  gatewaySubscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface Invoice {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  gateway: PaymentGateway;
  paidAt?: string;
  createdAt: string;
}

// ─── API Response Wrappers ──────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Agent Types (Hermes Bridge) ────────────────────────────
export type AgentTier = 'executive' | 'director' | 'lead';
export type AgentStatus = 'active' | 'idle' | 'processing' | 'error';

export interface AgentInfo {
  id: string;
  name: string;
  tier: AgentTier;
  status: AgentStatus;
  description: string;
  skills: string[];
  lastActivity?: string;
}

// ─── Plan Limits ────────────────────────────────────────────
export const PLAN_LIMITS: Record<PlanTier, {
  maxUsers: number;
  maxAgents: number;
  maxPortfolioInstruments: number;
  regulatorySources: RegulatorySource[];
  auditRetentionDays: number;
  apiRateLimit: number; // requests per day
  whatsappAlerts: boolean;
  hermesEvolution: boolean;
}> = {
  starter: {
    maxUsers: 1,
    maxAgents: 3,
    maxPortfolioInstruments: 10,
    regulatorySources: ['POJK'],
    auditRetentionDays: 30,
    apiRateLimit: 100,
    whatsappAlerts: false,
    hermesEvolution: false,
  },
  pro: {
    maxUsers: 5,
    maxAgents: 7,
    maxPortfolioInstruments: 50,
    regulatorySources: ['POJK', 'DSN-MUI', 'ISO', 'BI'],
    auditRetentionDays: 365,
    apiRateLimit: 1000,
    whatsappAlerts: true,
    hermesEvolution: false,
  },
  enterprise: {
    maxUsers: Infinity,
    maxAgents: 12,
    maxPortfolioInstruments: Infinity,
    regulatorySources: ['POJK', 'DSN-MUI', 'ISO', 'BI', 'OJK', 'BAPEPAM', 'custom'],
    auditRetentionDays: 2555, // ~7 years
    apiRateLimit: 10000,
    whatsappAlerts: true,
    hermesEvolution: true,
  },
};
