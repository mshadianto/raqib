-- packages/backend/src/database/migrations/001_tenant_schema.sql
-- Run dynamically when a new tenant is created
-- Placeholder: __TENANT_SCHEMA__ is replaced with actual tenant slug

CREATE SCHEMA IF NOT EXISTS __TENANT_SCHEMA__;

-- Regulatory Alerts
CREATE TABLE __TENANT_SCHEMA__.regulatory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,          -- POJK, DSN-MUI, ISO, BI, OJK, BAPEPAM
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  full_text TEXT,
  severity VARCHAR(50) NOT NULL DEFAULT 'informational',  -- urgent, important, informational
  status VARCHAR(50) NOT NULL DEFAULT 'new',              -- new, acknowledged, in_review, resolved, dismissed
  source_url VARCHAR(1000),
  published_at TIMESTAMPTZ,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_severity ON __TENANT_SCHEMA__.regulatory_alerts(severity, status);
CREATE INDEX idx_alerts_source ON __TENANT_SCHEMA__.regulatory_alerts(source, created_at DESC);
CREATE INDEX idx_alerts_created ON __TENANT_SCHEMA__.regulatory_alerts(created_at DESC);

-- Portfolio Holdings
CREATE TABLE __TENANT_SCHEMA__.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_type VARCHAR(100) NOT NULL,  -- sukuk, gold, mutual_fund_syariah, etc.
  instrument_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  buy_price DECIMAL(18,2) NOT NULL DEFAULT 0,
  current_price DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_type ON __TENANT_SCHEMA__.portfolio_holdings(instrument_type);

-- Audit Trail
CREATE TABLE __TENANT_SCHEMA__.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON __TENANT_SCHEMA__.audit_trail(action, created_at DESC);
CREATE INDEX idx_audit_user ON __TENANT_SCHEMA__.audit_trail(user_id, created_at DESC);
CREATE INDEX idx_audit_created ON __TENANT_SCHEMA__.audit_trail(created_at DESC);

-- Agent Executions (Hermes integration)
CREATE TABLE __TENANT_SCHEMA__.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  skill_name VARCHAR(255),
  input_summary TEXT,
  output_summary TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  duration_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_exec ON __TENANT_SCHEMA__.agent_executions(agent_id, created_at DESC);

-- Workflow Runs (ported from ClawFlows)
CREATE TABLE __TENANT_SCHEMA__.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',  -- manual, scheduled, webhook, alert
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER DEFAULT 0,
  output JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION __TENANT_SCHEMA__.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alerts_updated
  BEFORE UPDATE ON __TENANT_SCHEMA__.regulatory_alerts
  FOR EACH ROW EXECUTE FUNCTION __TENANT_SCHEMA__.update_updated_at();

CREATE TRIGGER trg_portfolio_updated
  BEFORE UPDATE ON __TENANT_SCHEMA__.portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION __TENANT_SCHEMA__.update_updated_at();
