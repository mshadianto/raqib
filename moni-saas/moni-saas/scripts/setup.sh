#!/usr/bin/env bash
# scripts/setup.sh — One-command MONI SaaS setup
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                                      ║${NC}"
echo -e "${BOLD}║   🛡️  MONI SaaS — Setup Script                      ║${NC}"
echo -e "${BOLD}║   Multi-Agent GRC Command Center                     ║${NC}"
echo -e "${BOLD}║                                                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Check prerequisites
echo -e "${CYAN}[1/7]${NC} Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required (v22+). Install from https://nodejs.org"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required. Install from https://docker.com"; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo -e "${YELLOW}⚠️  Node.js v22+ recommended (found v$(node -v))${NC}"
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
echo -e "  ${GREEN}✓${NC} Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# 2. Install dependencies
echo ""
echo -e "${CYAN}[2/7]${NC} Installing dependencies..."
npm install

# 3. Start infrastructure
echo ""
echo -e "${CYAN}[3/7]${NC} Starting PostgreSQL & Redis..."
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Wait for PostgreSQL
echo -n "  Waiting for PostgreSQL"
for i in $(seq 1 30); do
  if docker exec moni-postgres pg_isready -U moni -d moni_saas >/dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

# Wait for Redis
echo -n "  Waiting for Redis"
for i in $(seq 1 15); do
  if docker exec moni-redis redis-cli ping >/dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

# 4. Setup environment
echo ""
echo -e "${CYAN}[4/7]${NC} Setting up environment..."
if [ ! -f packages/backend/.env ]; then
  cp packages/backend/.env.example packages/backend/.env
  # Generate random JWT secret
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/change-this-to-a-random-64-char-string/$JWT_SECRET/" packages/backend/.env
  else
    sed -i "s/change-this-to-a-random-64-char-string/$JWT_SECRET/" packages/backend/.env
  fi
  echo -e "  ${GREEN}✓${NC} .env created with random JWT secret"
else
  echo -e "  ${YELLOW}→${NC} .env already exists, skipping"
fi

# 5. Generate Prisma client
echo ""
echo -e "${CYAN}[5/7]${NC} Generating Prisma client..."
cd packages/backend
npx prisma generate
cd ../..

# 6. Run migrations
echo ""
echo -e "${CYAN}[6/7]${NC} Running database migrations..."
cd packages/backend
npx prisma migrate dev --name init --skip-seed 2>/dev/null || npx prisma db push --force-reset
cd ../..

# 7. Seed database
echo ""
echo -e "${CYAN}[7/7]${NC} Seeding demo data..."
npm run db:seed

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅ Setup complete!${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Start development:"
echo -e "    ${CYAN}npm run dev${NC}"
echo ""
echo -e "  Access:"
echo -e "    Backend:  ${CYAN}http://127.0.0.1:4000${NC}"
echo -e "    Frontend: ${CYAN}http://127.0.0.1:3000${NC}"
echo -e "    pgAdmin:  ${CYAN}docker compose -f infrastructure/docker/docker-compose.yml --profile tools up pgadmin${NC}"
echo ""
echo -e "  Demo login:"
echo -e "    Email:    ${YELLOW}sopian@kimconsulting.id${NC}"
echo -e "    Password: ${YELLOW}Demo2026!${NC}"
echo -e "    Tenant:   ${YELLOW}bpkh-compliance${NC}"
echo ""
echo -e "  Hermes Agent migration:"
echo -e "    ${CYAN}npm run hermes:migrate${NC}"
echo ""
