// packages/hermes-bridge/src/skills/migrate-openclaw.ts
// Migrates MONI's 26 OpenClaw skills to Hermes agentskills.io format
// Run: hermes claw migrate (auto-detected) or: npm run hermes:migrate

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

interface OpenClawSkill {
  name: string;
  description: string;
  path: string;
  content: string;
}

interface HermesSkill {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  platforms: string[];
  instructions: string;
}

const OPENCLAW_SKILLS_DIR = join(process.env.HOME || '~', '.openclaw', 'workspace', 'skills');
const HERMES_SKILLS_DIR = join(process.env.HOME || '~', '.hermes', 'skills', 'moni');

// MONI agent → skill mapping
const AGENT_SKILL_MAP: Record<string, string[]> = {
  MONI: ['chain-of-thought', 'task-delegation', 'claw3d-workspace'],
  FALAH: ['falah-portfolio', 'halal-screening', 'sukuk-analysis'],
  AURIX: ['aurix-audit', 'benford-analysis', 'reconciliation-check'],
  TAKWA: ['gcg-review', 'whistleblowing-system', 'anti-corruption'],
  AMANAH: ['risk-register', 'risk-assessment', 'erm-framework'],
  HIKMAH: ['market-analysis', 'competitive-intel', 'strategic-advisory'],
  BASYAR: ['talent-review', 'labor-compliance', 'org-development'],
  NIZAM: ['regulatory-scan', 'compliance-check', 'fatwa-lookup'],
  AMAN: ['vuln-scan', 'iso27001-audit', 'incident-response'],
  "RA'IS": ['exec-briefing', 'stakeholder-comm', 'crisis-comm'],
  WASIT: ['process-audit', 'iso9001-check', 'quality-metrics'],
  MUHTASIB: ['coso-assessment', 'control-testing', 'internal-audit'],
};

/**
 * Read all OpenClaw SKILL.md files from the MONI workspace.
 */
function readOpenClawSkills(): OpenClawSkill[] {
  if (!existsSync(OPENCLAW_SKILLS_DIR)) {
    console.log(`[Migration] OpenClaw skills directory not found: ${OPENCLAW_SKILLS_DIR}`);
    console.log('[Migration] Generating default Hermes skills from agent definitions...');
    return [];
  }

  const skills: OpenClawSkill[] = [];
  const dirs = readdirSync(OPENCLAW_SKILLS_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const skillPath = join(OPENCLAW_SKILLS_DIR, dir.name, 'SKILL.md');
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      const nameMatch = content.match(/^#\s+(.+)/m);
      const descMatch = content.match(/(?:description|##\s*Description)[:\s]*(.+)/im);

      skills.push({
        name: dir.name,
        description: descMatch?.[1]?.trim() || `MONI skill: ${dir.name}`,
        path: skillPath,
        content,
      });
    }
  }

  return skills;
}

/**
 * Convert OpenClaw SKILL.md to Hermes agentskills.io format.
 */
function convertToHermes(skill: OpenClawSkill, agentId?: string): HermesSkill {
  return {
    name: skill.name,
    description: skill.description,
    version: '1.0.0',
    author: 'MSHadianto/MONI',
    tags: [
      'grc',
      'compliance',
      'audit',
      agentId?.toLowerCase() || 'general',
      'indonesia',
    ].filter(Boolean),
    platforms: ['cli', 'telegram', 'whatsapp', 'web'],
    instructions: skill.content,
  };
}

/**
 * Generate default Hermes skills from MONI agent definitions
 * (when OpenClaw workspace isn't available).
 */
function generateDefaultSkills(): HermesSkill[] {
  const skills: HermesSkill[] = [];

  for (const [agentId, skillNames] of Object.entries(AGENT_SKILL_MAP)) {
    for (const skillName of skillNames) {
      skills.push({
        name: skillName,
        description: `${agentId} agent skill: ${skillName.replace(/-/g, ' ')}`,
        version: '1.0.0',
        author: 'MSHadianto/MONI',
        tags: ['grc', 'moni', agentId.toLowerCase(), 'indonesia'],
        platforms: ['cli', 'telegram', 'whatsapp', 'web'],
        instructions: `# ${skillName}\n\nAgent: ${agentId}\nThis skill is part of the MONI GRC Command Center.\n\n## Instructions\n\nPlease implement the ${skillName} functionality as defined in the MONI agent hierarchy.\n\nRefer to the MONI SOUL.md for agent personality and system prompt guidelines.`,
      });
    }
  }

  return skills;
}

/**
 * Write Hermes skill to disk in agentskills.io format.
 */
function writeHermesSkill(skill: HermesSkill): void {
  const skillDir = join(HERMES_SKILLS_DIR, skill.name);
  mkdirSync(skillDir, { recursive: true });

  const skillMd = `---
name: ${skill.name}
description: ${skill.description}
version: ${skill.version}
author: ${skill.author}
tags: [${skill.tags.join(', ')}]
platforms: [${skill.platforms.join(', ')}]
---

${skill.instructions}
`;

  writeFileSync(join(skillDir, 'SKILL.md'), skillMd, 'utf-8');
  console.log(`  ✓ ${skill.name}`);
}

/**
 * Main migration entry point.
 */
export async function migrateSkills(): Promise<void> {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  MONI → Hermes Agent Skill Migration        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  mkdirSync(HERMES_SKILLS_DIR, { recursive: true });

  const openClawSkills = readOpenClawSkills();
  let hermesSkills: HermesSkill[];

  if (openClawSkills.length > 0) {
    console.log(`[Migration] Found ${openClawSkills.length} OpenClaw skills. Converting...`);
    hermesSkills = openClawSkills.map((s) => {
      // Find which agent owns this skill
      const agent = Object.entries(AGENT_SKILL_MAP).find(([_, skills]) =>
        skills.includes(s.name)
      );
      return convertToHermes(s, agent?.[0]);
    });
  } else {
    console.log('[Migration] Generating from MONI agent definitions...');
    hermesSkills = generateDefaultSkills();
  }

  console.log(`\nWriting ${hermesSkills.length} skills to ${HERMES_SKILLS_DIR}:\n`);

  for (const skill of hermesSkills) {
    writeHermesSkill(skill);
  }

  console.log(`\n✅ Migration complete! ${hermesSkills.length} skills ready.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review skills in ${HERMES_SKILLS_DIR}`);
  console.log(`  2. Run: hermes skills list`);
  console.log(`  3. Test: hermes "Use the regulatory-scan skill to check POJK updates"`);
}

// CLI entry
if (require.main === module) {
  migrateSkills().catch(console.error);
}
