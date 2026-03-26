// packages/hermes-bridge/src/workflows/clawflows-to-hermes.ts
// Migrates MONI ClawFlows workflows to Hermes cron jobs
// ClawFlows YAML frontmatter → Hermes cron schedule format

interface ClawFlowWorkflow {
  name: string;
  emoji: string;
  description: string;
  agent: string;
  tier: string;
  schedule: string; // cron expression
  steps: string[];
}

interface HermesCronJob {
  name: string;
  schedule: string;
  command: string;
  agent?: string;
  skill?: string;
  enabled: boolean;
}

// MONI's 17 community workflows mapped to Hermes cron jobs
export const CLAWFLOW_MIGRATIONS: ClawFlowWorkflow[] = [
  {
    name: 'morning-briefing',
    emoji: '☀️',
    description: 'Daily regulatory and market briefing for executives',
    agent: 'MONI',
    tier: 'executive',
    schedule: '0 7 * * 1-5', // 7 AM WIB, weekdays
    steps: [
      'Scan POJK/OJK for overnight regulatory updates',
      'Check DSN-MUI fatwa releases',
      'Summarize key market movements (IHSG, IDR/USD, gold)',
      'Check portfolio performance overnight',
      'Generate executive briefing in McKinsey format',
      'Send via WhatsApp to admin users',
    ],
  },
  {
    name: 'regulatory-scan',
    emoji: '🔍',
    description: 'Periodic scan of Indonesian financial regulators',
    agent: 'NIZAM',
    tier: 'lead',
    schedule: '0 */6 * * *', // Every 6 hours
    steps: [
      'Search Tavily for new POJK regulations',
      'Search for new DSN-MUI fatwa',
      'Check BI website for new peraturan',
      'Check OJK for SE/POJK updates',
      'Classify severity (urgent/important/informational)',
      'Create alerts in regulatory_alerts table',
      'Notify admin if urgent alerts found',
    ],
  },
  {
    name: 'portfolio-price-update',
    emoji: '📊',
    description: 'Update portfolio instrument prices',
    agent: 'FALAH',
    tier: 'executive',
    schedule: '0 9-16 * * 1-5', // Hourly during market hours
    steps: [
      'Fetch KSEI/IDX bond prices for sukuk holdings',
      'Fetch Antam/LM gold price',
      'Fetch mutual fund NAV from data providers',
      'Update current_price in portfolio_holdings',
      'Calculate P&L changes',
      'Alert if any holding drops > 5% in a day',
    ],
  },
  {
    name: 'compliance-check',
    emoji: '✅',
    description: 'Weekly compliance status review',
    agent: 'MUHTASIB',
    tier: 'lead',
    schedule: '0 9 * * 1', // Monday 9 AM
    steps: [
      'Review all unresolved regulatory alerts',
      'Check overdue compliance actions',
      'Verify audit trail completeness',
      'Generate compliance gap analysis',
      'Send weekly compliance digest to team',
    ],
  },
  {
    name: 'audit-anomaly-scan',
    emoji: '🔎',
    description: 'Benford analysis and anomaly detection on financial data',
    agent: 'AURIX',
    tier: 'executive',
    schedule: '0 2 * * 0', // Sunday 2 AM (low traffic)
    steps: [
      'Extract financial transaction data',
      'Apply Benfords Law first-digit analysis',
      'Run statistical outlier detection',
      'Cross-reference with ISA 240 fraud indicators',
      'Generate findings report',
      'Flag any red items for admin review',
    ],
  },
  {
    name: 'risk-register-update',
    emoji: '⚠️',
    description: 'Monthly risk register refresh',
    agent: 'AMANAH',
    tier: 'director',
    schedule: '0 10 1 * *', // 1st of month, 10 AM
    steps: [
      'Review current risk register entries',
      'Assess regulatory changes impact on risk profile',
      'Update risk likelihood and impact scores',
      'Identify new emerging risks',
      'Generate risk heatmap update',
      'Send to governance committee',
    ],
  },
];

/**
 * Convert ClawFlow workflows to Hermes cron job format.
 */
export function convertToHermesCron(workflows: ClawFlowWorkflow[]): HermesCronJob[] {
  return workflows.map((wf) => ({
    name: wf.name,
    schedule: wf.schedule,
    command: `hermes run --skill ${wf.name} --agent ${wf.agent} --input "${wf.description}"`,
    agent: wf.agent,
    skill: wf.name,
    enabled: true,
  }));
}

/**
 * Generate Hermes cron configuration file.
 */
export function generateHermesCronConfig(workflows: ClawFlowWorkflow[]): string {
  const jobs = convertToHermesCron(workflows);

  const lines = [
    '# MONI SaaS — Hermes Cron Schedule',
    '# Migrated from ClawFlows workflows',
    `# Generated: ${new Date().toISOString()}`,
    '#',
    '# Format: schedule | name | command',
    '#',
    '',
  ];

  for (const job of jobs) {
    lines.push(`# ${job.name} (Agent: ${job.agent})`);
    lines.push(`${job.schedule} | ${job.name} | ${job.command}`);
    lines.push('');
  }

  return lines.join('\n');
}

// CLI entry
if (require.main === module) {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  ClawFlows → Hermes Cron Migration           ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  const config = generateHermesCronConfig(CLAWFLOW_MIGRATIONS);
  console.log(config);

  console.log(`\n✅ ${CLAWFLOW_MIGRATIONS.length} workflows converted to Hermes cron jobs.`);
  console.log('\nTo install, save the above to ~/.hermes/cron.conf');
  console.log('Then run: hermes cron reload');
}
