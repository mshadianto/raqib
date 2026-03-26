// packages/backend/src/modules/hermes/hermes.service.ts
// Bridge between MONI SaaS and Hermes Agent (NousResearch)

import { config } from '../../config';
import { TenantSchemaService } from '../tenant/tenant-schema.service';

interface HermesSkillResult {
  success: boolean;
  output: string;
  tokensUsed?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

const HERMES_TIMEOUT_MS = 30_000;

export class HermesService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.hermes.apiUrl;
    this.apiKey = config.hermes.apiKey;
  }

  /**
   * Execute a Hermes skill within a tenant context.
   * Includes request timeout to prevent hanging on Hermes downtime.
   */
  async executeSkill(
    tenantSlug: string,
    agentId: string,
    skillName: string,
    input: string,
    context?: Record<string, unknown>
  ): Promise<HermesSkillResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HERMES_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Tenant-Slug': tenantSlug,
        },
        body: JSON.stringify({
          model: config.hermes.defaultModel,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(agentId, skillName, context) },
            { role: 'user', content: input },
          ],
          max_tokens: 4096,
          metadata: { skill: skillName, agent: agentId, tenant: tenantSlug },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const output = data.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n') || '';

      const durationMs = Date.now() - startTime;

      // Log successful execution
      await this.logExecution(tenantSlug, {
        agentId, skillName, input, output, durationMs,
        status: 'completed',
        tokensUsed: data.usage?.output_tokens || 0,
      });

      return { success: true, output, tokensUsed: data.usage?.output_tokens, durationMs };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error.name === 'AbortError'
        ? `Hermes request timed out after ${HERMES_TIMEOUT_MS}ms`
        : error.message;

      // Log failed execution
      await this.logExecution(tenantSlug, {
        agentId, skillName, input, durationMs,
        status: 'failed', errorMessage,
      });

      return {
        success: false,
        output: '',
        durationMs,
        metadata: { error: errorMessage },
      };
    }
  }

  /**
   * Send alert via Hermes multi-platform gateway.
   */
  async sendAlert(
    channel: 'telegram' | 'whatsapp' | 'discord' | 'slack',
    recipient: string,
    message: string
  ): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${this.baseUrl}/gateway/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ channel, recipient, message }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      console.error(`[Hermes] Gateway send failed (${channel}):`, error);
      return false;
    }
  }

  /**
   * Trigger a regulatory scan using NIZAM agent.
   */
  async scanRegulations(tenantSlug: string, sources: string[]): Promise<HermesSkillResult> {
    const query = sources.map(s => {
      const sourceQueries: Record<string, string> = {
        'POJK': 'Peraturan OJK terbaru 2026 perbankan syariah asuransi pasar modal',
        'DSN-MUI': 'Fatwa DSN-MUI terbaru ekonomi syariah keuangan',
        'ISO': 'ISO 37001 37301 updates anti-bribery compliance',
        'BI': 'Peraturan Bank Indonesia terbaru sistem pembayaran moneter',
        'OJK': 'Regulasi OJK terkini pengawasan lembaga keuangan',
      };
      return sourceQueries[s] || `${s} regulation update Indonesia 2026`;
    }).join('; ');

    return this.executeSkill(
      tenantSlug, 'NIZAM', 'regulatory-scan',
      `Search and analyze recent regulatory updates for: ${query}.
       Classify each by severity (urgent/important/informational).
       Return structured JSON with: title, summary, source, severity, sourceUrl, publishedAt.`,
      { sources }
    );
  }

  /**
   * Analyze portfolio using FALAH agent.
   */
  async analyzePortfolio(tenantSlug: string, holdings: any[]): Promise<HermesSkillResult> {
    return this.executeSkill(
      tenantSlug, 'FALAH', 'falah-portfolio',
      `Analyze this Sharia-compliant portfolio and provide:
       1. Asset allocation assessment
       2. Shariah compliance check for each holding
       3. Risk concentration warnings
       4. Rebalancing recommendations

       Holdings: ${JSON.stringify(holdings)}`,
      { holdingCount: holdings.length }
    );
  }

  /**
   * Run audit analysis using AURIX agent.
   */
  async runAuditAnalysis(tenantSlug: string, data: any): Promise<HermesSkillResult> {
    return this.executeSkill(
      tenantSlug, 'AURIX', 'aurix-audit',
      `Perform audit analysis on the following data:
       - Apply Benford's Law analysis
       - Check for anomalies and outliers
       - Align findings with ISA 240 (fraud indicators)
       - Generate executive summary

       Data: ${JSON.stringify(data)}`,
      { analysisType: 'comprehensive' }
    );
  }

  // ─── Private helpers ──────────────────────────────────

  private async logExecution(tenantSlug: string, entry: {
    agentId: string; skillName: string; input: string;
    output?: string; durationMs: number; status: string;
    tokensUsed?: number; errorMessage?: string;
  }) {
    try {
      if (entry.status === 'completed') {
        await TenantSchemaService.queryTenant(
          tenantSlug,
          `INSERT INTO agent_executions (agent_id, skill_name, input_summary, output_summary, status, duration_ms, tokens_used, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [entry.agentId, entry.skillName, entry.input.substring(0, 500), (entry.output || '').substring(0, 1000), entry.status, entry.durationMs, entry.tokensUsed || 0, JSON.stringify({ model: config.hermes.defaultModel })]
        );
      } else {
        await TenantSchemaService.queryTenant(
          tenantSlug,
          `INSERT INTO agent_executions (agent_id, skill_name, input_summary, status, duration_ms, error_message)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [entry.agentId, entry.skillName, entry.input.substring(0, 500), entry.status, entry.durationMs, entry.errorMessage || '']
        );
      }
    } catch (err) {
      console.error('[Hermes] Failed to log execution:', err);
    }
  }

  private buildSystemPrompt(
    agentId: string,
    skillName: string,
    context?: Record<string, unknown>
  ): string {
    const agentPrompts: Record<string, string> = {
      MONI: 'You are MONI, the Chief Command Agent. You orchestrate and coordinate all other agents. You provide strategic oversight and executive summaries.',
      FALAH: 'You are FALAH, the Sharia-Compliant Wealth Management Agent. Expert in Islamic finance, sukuk analysis, halal investment screening, and portfolio optimization per DSN-MUI fatwa.',
      AURIX: 'You are AURIX, the AI Audit Intelligence Agent. Expert in ISA standards, Benford\'s Law analysis, fraud detection (ISA 240), and reconciliation. Output follows Big 4 audit methodology.',
      TAKWA: 'You are TAKWA, the Governance & Ethics Agent. Expert in GCG implementation, board governance, whistleblowing systems, and anti-corruption (ISO 37001).',
      AMANAH: 'You are AMANAH, the Risk Management Agent. Expert in enterprise risk management, risk register maintenance, and ISO 31000 compliance.',
      HIKMAH: 'You are HIKMAH, the Strategic Intelligence Agent. Expert in competitive analysis, market intelligence, and McKinsey-style strategic advisory.',
      BASYAR: 'You are BASYAR, the HR & People Agent. Expert in organizational development, talent management, and Indonesian labor law compliance.',
      NIZAM: 'You are NIZAM, the Regulatory Intelligence Agent. Expert in Indonesian financial regulations (POJK, BI, OJK), Islamic finance fatwa (DSN-MUI), and international standards (ISO, FATF).',
      AMAN: 'You are AMAN, the Cybersecurity Agent. Expert in information security, vulnerability assessment, and ISO 27001 compliance.',
      "RA'IS": 'You are RA\'IS, the Leadership & Communication Agent. Expert in executive communication, stakeholder management, and public relations.',
      WASIT: 'You are WASIT, the Quality Assurance Agent. Expert in ISO 9001 quality management, process improvement, and operational excellence.',
      MUHTASIB: 'You are MUHTASIB, the Internal Control Agent. Expert in COSO framework, internal audit procedures, and control testing.',
    };

    const basePrompt = agentPrompts[agentId] || `You are agent ${agentId} in the MONI GRC Command Center.`;

    return `${basePrompt}

You are operating within a multi-tenant SaaS GRC platform serving Indonesian audit committees and compliance officers.
Skill: ${skillName}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Always respond in a professional, Big 4 / McKinsey-quality format. Use both English and Bahasa Indonesia as appropriate for the audience. Include regulatory references where applicable.`;
  }
}

// Singleton
export const hermesService = new HermesService();
