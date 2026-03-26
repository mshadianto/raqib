// packages/backend/src/modules/hermes/hermes.routes.ts
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../../middleware/auth';
import { hermesService } from './hermes.service';
import { TenantSchemaService } from '../tenant/tenant-schema.service';
import { tenantRateLimit } from '../../middleware/rate-limiter';

const router = Router();

const executeSchema = z.object({
  agentId: z.string().min(1),
  skillName: z.string().min(1),
  input: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
});

// POST /hermes/execute — Execute an agent skill
router.post(
  '/execute',
  requireAuth,
  requireTenant,
  tenantRateLimit,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = executeSchema.parse(req.body);

      // Audit log
      await TenantSchemaService.queryTenant(
        req.tenantSlug!,
        `INSERT INTO audit_trail (user_id, action, resource_type, metadata)
         VALUES ($1, 'agent.executed', 'hermes_agent', $2)`,
        [req.user!.userId, JSON.stringify({ agentId: body.agentId, skill: body.skillName })]
      );

      const result = await hermesService.executeSkill(
        req.tenantSlug!,
        body.agentId,
        body.skillName,
        body.input,
        body.context
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /hermes/scan-regulations — Trigger regulatory scan
router.post(
  '/scan-regulations',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sources } = z.object({
        sources: z.array(z.string()).min(1),
      }).parse(req.body);

      const result = await hermesService.scanRegulations(req.tenantSlug!, sources);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /hermes/analyze-portfolio — AI portfolio analysis
router.post(
  '/analyze-portfolio',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Fetch tenant's holdings
      const holdings = await TenantSchemaService.queryTenant(
        req.tenantSlug!,
        'SELECT * FROM portfolio_holdings'
      );

      const result = await hermesService.analyzePortfolio(req.tenantSlug!, holdings);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /hermes/audit-analysis — AI audit analysis
router.post(
  '/audit-analysis',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await hermesService.runAuditAnalysis(req.tenantSlug!, req.body.data || {});
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /hermes/agents — List available agents and their status
router.get(
  '/agents',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Get recent agent executions
      const recentExecs = await TenantSchemaService.queryTenant(
        req.tenantSlug!,
        `SELECT agent_id, MAX(created_at) as last_activity, COUNT(*)::int as total_executions
         FROM agent_executions
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY agent_id`
      );

      const execMap = new Map(recentExecs.map((e: any) => [e.agent_id, e]));

      const agents = [
        { id: 'MONI', name: 'MONI', tier: 'executive', description: 'Chief Command Agent — orchestration & oversight', skills: ['chain-of-thought', 'task-delegation'] },
        { id: 'FALAH', name: 'FALAH', tier: 'executive', description: 'Sharia-Compliant Wealth Management', skills: ['falah-portfolio', 'halal-screening'] },
        { id: 'AURIX', name: 'AURIX', tier: 'executive', description: 'AI Audit Intelligence', skills: ['aurix-audit', 'benford-analysis', 'reconciliation'] },
        { id: 'TAKWA', name: 'TAKWA', tier: 'director', description: 'Governance & Ethics', skills: ['gcg-review', 'whistleblowing'] },
        { id: 'AMANAH', name: 'AMANAH', tier: 'director', description: 'Risk Management', skills: ['risk-register', 'risk-assessment'] },
        { id: 'HIKMAH', name: 'HIKMAH', tier: 'director', description: 'Strategic Intelligence', skills: ['market-analysis', 'competitive-intel'] },
        { id: 'BASYAR', name: 'BASYAR', tier: 'director', description: 'HR & People Analytics', skills: ['talent-review', 'labor-compliance'] },
        { id: 'NIZAM', name: 'NIZAM', tier: 'lead', description: 'Regulatory Intelligence', skills: ['regulatory-scan', 'compliance-check'] },
        { id: 'AMAN', name: 'AMAN', tier: 'lead', description: 'Cybersecurity & InfoSec', skills: ['vuln-scan', 'iso27001-audit'] },
        { id: "RA'IS", name: "RA'IS", tier: 'lead', description: 'Leadership & Communication', skills: ['exec-briefing', 'stakeholder-comm'] },
        { id: 'WASIT', name: 'WASIT', tier: 'lead', description: 'Quality Assurance', skills: ['process-audit', 'iso9001-check'] },
        { id: 'MUHTASIB', name: 'MUHTASIB', tier: 'lead', description: 'Internal Control', skills: ['coso-assessment', 'control-testing'] },
      ].map((agent) => {
        const exec = execMap.get(agent.id);
        return {
          ...agent,
          status: exec ? 'active' : 'idle',
          lastActivity: exec?.last_activity || null,
          totalExecutions: exec?.total_executions || 0,
        };
      });

      res.json({ success: true, data: agents });
    } catch (err) {
      next(err);
    }
  }
);

// GET /hermes/executions — Recent agent execution history
router.get(
  '/executions',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const rows = await TenantSchemaService.queryTenant(
        req.tenantSlug!,
        `SELECT * FROM agent_executions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countRows = await TenantSchemaService.queryTenant<{ count: string }>(
        req.tenantSlug!,
        'SELECT COUNT(*)::int as count FROM agent_executions'
      );

      res.json({
        success: true,
        data: rows,
        meta: {
          page,
          limit,
          total: parseInt(countRows[0]?.count || '0', 10),
          totalPages: Math.ceil(parseInt(countRows[0]?.count || '0', 10) / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
