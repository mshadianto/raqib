// packages/backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { TenantSchemaService } from '../src/modules/tenant/tenant-schema.service';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding MONI SaaS database...\n');

  // 1. Create demo user
  const passwordHash = await bcrypt.hash('Demo2026!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'sopian@kimconsulting.id' },
    update: {},
    create: {
      email: 'sopian@kimconsulting.id',
      passwordHash,
      fullName: 'Sopian Hadianto',
    },
  });
  console.log('✓ User created:', user.email);

  // 2. Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'bpkh-compliance' },
    update: {},
    create: {
      name: 'BPKH Compliance Team',
      slug: 'bpkh-compliance',
      plan: 'pro',
      status: 'active',
    },
  });
  console.log('✓ Tenant created:', tenant.slug);

  // 3. Create membership
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: user.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'admin',
    },
  });
  console.log('✓ Membership created: admin');

  // 4. Create subscription
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      plan: 'pro',
      status: 'active',
      gateway: 'midtrans',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✓ Subscription created: pro plan');

  // 5. Create tenant schema
  const exists = await TenantSchemaService.schemaExists('bpkh-compliance');
  if (!exists) {
    await TenantSchemaService.createSchema('bpkh-compliance');
    console.log('✓ Tenant schema created: tenant_bpkh_compliance');
  }

  // 6. Seed regulatory alerts
  const alerts = [
    { source: 'POJK', title: 'POJK No. 12/2026 — Perubahan Ketentuan Perbankan Syariah', severity: 'urgent', summary: 'Revisi ketentuan modal minimum bank syariah.' },
    { source: 'DSN-MUI', title: 'Fatwa DSN-MUI No. 142 — Akad Musyarakah Mutanaqishah Digital', severity: 'important', summary: 'Fatwa baru mengenai akad MMQ dalam platform fintech syariah.' },
    { source: 'ISO', title: 'ISO 37001:2026 Amendment — Anti-Bribery Management Systems', severity: 'important', summary: 'Updated requirements for anti-bribery controls.' },
    { source: 'BI', title: 'PBI No. 8/2026 — Penyelenggaraan Transfer Dana Digital', severity: 'informational', summary: 'Regulasi baru transfer dana melalui dompet digital.' },
    { source: 'OJK', title: 'SE OJK — Pelaporan ESG untuk Lembaga Keuangan', severity: 'urgent', summary: 'Kewajiban pelaporan ESG untuk seluruh lembaga jasa keuangan.' },
    { source: 'POJK', title: 'POJK No. 15/2026 — Tata Kelola Investasi Haji', severity: 'urgent', summary: 'Penguatan tata kelola pengelolaan dana haji.' },
  ];

  for (const alert of alerts) {
    await TenantSchemaService.queryTenant(
      'bpkh-compliance',
      `INSERT INTO regulatory_alerts (source, title, summary, severity, status)
       VALUES ($1, $2, $3, $4, 'new')
       ON CONFLICT DO NOTHING`,
      [alert.source, alert.title, alert.summary, alert.severity]
    );
  }
  console.log(`✓ ${alerts.length} regulatory alerts seeded`);

  // 7. Seed portfolio holdings
  const holdings = [
    { type: 'sukuk', name: 'PBS038 Sukuk Negara', qty: 500, buy: 1000000, current: 1025000 },
    { type: 'gold', name: 'Antam Gold 1g', qty: 50, buy: 1350000, current: 1420000 },
    { type: 'mutual_fund_syariah', name: 'TRIM Syariah Saham', qty: 1200, buy: 1850, current: 1920 },
    { type: 'deposit_syariah', name: 'BSI Deposito Syariah', qty: 1, buy: 100000000, current: 100000000 },
    { type: 'equity_syariah', name: 'BRIS (Bank Syariah Indonesia)', qty: 10000, buy: 2450, current: 2680 },
  ];

  for (const h of holdings) {
    await TenantSchemaService.queryTenant(
      'bpkh-compliance',
      `INSERT INTO portfolio_holdings (instrument_type, instrument_name, quantity, buy_price, current_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [h.type, h.name, h.qty, h.buy, h.current]
    );
  }
  console.log(`✓ ${holdings.length} portfolio holdings seeded`);

  // 8. Seed audit trail
  const auditEntries = [
    { action: 'user.login', metadata: { ip: '103.28.xx.xx', location: 'Jakarta' } },
    { action: 'agent.executed', metadata: { agentId: 'NIZAM', skill: 'regulatory-scan', duration: 2340 } },
    { action: 'alert.acknowledged', metadata: { alertSource: 'DSN-MUI', alertTitle: 'Fatwa No. 142' } },
    { action: 'portfolio.updated', metadata: { instrument: 'BRIS', action: 'price_update', newPrice: 2680 } },
    { action: 'report.generated', metadata: { reportType: 'Q1 Compliance Report', format: 'PDF' } },
  ];

  for (const entry of auditEntries) {
    await TenantSchemaService.queryTenant(
      'bpkh-compliance',
      `INSERT INTO audit_trail (user_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [user.id, entry.action, JSON.stringify(entry.metadata)]
    );
  }
  console.log(`✓ ${auditEntries.length} audit trail entries seeded`);

  console.log('\n✅ Seed complete!\n');
  console.log('Demo credentials:');
  console.log('  Email:    sopian@kimconsulting.id');
  console.log('  Password: Demo2026!');
  console.log('  Tenant:   bpkh-compliance');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
