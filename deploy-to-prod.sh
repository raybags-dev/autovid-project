#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AutoVid Deploy Script
#  Usage: ./deploy.sh
#  Pushes to GitHub + deploys to Hetzner in one command
# ═══════════════════════════════════════════════════════════════

set -e  # Exit immediately on any error

SERVER="root@157.180.67.199"
SERVER_DIR="/opt/autovid"

# ── Colours ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✔ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✖ $1${NC}"; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        AutoVid Deploy Script         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"

# ── Step 1: Commit message ─────────────────────────────────────
print_step "Git commit"
echo -e "${YELLOW}Enter commit message (then press Enter):${NC}"
read -r COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
  print_err "Commit message cannot be empty."
  exit 1
fi

# ── Step 2: Push to GitHub ─────────────────────────────────────
print_step "Pushing to GitHub"

git add .

# Check if there's anything to commit
if git diff --cached --quiet; then
  print_warn "No changes staged — skipping commit"
else
  git commit -m "$COMMIT_MSG"
  print_ok "Committed: $COMMIT_MSG"
fi

git push origin main
print_ok "Pushed to GitHub"

# ── Step 3: Copy changed files to server ──────────────────────
print_step "Syncing files to Hetzner"

rsync -avz --progress \
  --exclude='backend/venv' \
  --exclude='backend/output' \
  --exclude='backend/__pycache__' \
  --exclude='backend/**/__pycache__' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='.git' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  ./ $SERVER:$SERVER_DIR/

print_ok "Files synced"

# ── Step 4: Rebuild and restart on server ─────────────────────
print_step "Rebuilding and restarting on server"

ssh $SERVER << REMOTE
  set -e
  cd $SERVER_DIR

  echo "→ Pulling latest images and rebuilding..."
  docker compose down

  # Only rebuild backend if Python files changed, always rebuild frontend
  docker compose build --no-cache frontend
  docker compose build backend-1 backend-2 backend-3 backend-4

  docker compose up -d

  echo ""
  echo "→ Container status:"
  docker compose ps

  echo ""
  echo "→ Backend health check:"
  sleep 3
  curl -s http://localhost:8000/docs > /dev/null && echo "✔ Backend API responding" || echo "✖ Backend not responding yet"
REMOTE

# ── Step 5: Final check from local ────────────────────────────
print_step "Verifying deployment"
sleep 2

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://157.180.67.199 || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  print_ok "Frontend is live — http://157.180.67.199"
else
  print_warn "Frontend returned HTTP $HTTP_STATUS — may still be starting up"
fi

echo -e "\n${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Deploy complete!${NC}"
echo -e "${GREEN}${BOLD}  App:  http://157.180.67.199${NC}"
echo -e "${GREEN}${BOLD}  API:  http://157.180.67.199:8000/docs${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}\n"