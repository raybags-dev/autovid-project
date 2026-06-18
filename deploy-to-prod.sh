#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AutoVid Deploy Script
#  Usage: echo "commit message" | bash deploy-to-prod.sh
#         bash deploy-to-prod.sh              (prompts for message)
#
#  Runs the full pre-deploy test suite, then builds & deploys to
#  Hetzner.  Aborts on any test failure.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# Read from env or a local .deploy config (never commit real values)
SERVER="${DEPLOY_SERVER:-root@157.180.67.199}"
SERVER_DIR="/opt/autovid"

# SSH options that keep the connection alive through a long Docker build.
# ServerAliveInterval=60  → send keepalive packet every 60 s
# ServerAliveCountMax=20  → tolerate up to 20 missed responses (= 20 min)
SSH="ssh -o StrictHostKeyChecking=no \
         -o ServerAliveInterval=60 \
         -o ServerAliveCountMax=20 \
         -o ConnectTimeout=15"

# ── Colours ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

print_step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✔ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✖ $1${NC}"; exit 1; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        AutoVid Deploy Script         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"

# ── Step 1: Commit message ─────────────────────────────────────
print_step "Git commit"

# Accept message from stdin (echo "msg" | bash deploy.sh) or interactively
if [ -t 0 ]; then
    echo -e "${YELLOW}Enter commit message:${NC}"
    read -r COMMIT_MSG
else
    read -r COMMIT_MSG
fi

if [ -z "$COMMIT_MSG" ]; then
    print_err "Commit message cannot be empty."
fi

# ── Step 2: Pre-deploy test suite ─────────────────────────────
print_step "Running pre-deploy test suite"

PYTEST_BIN=""
for candidate in \
    "$(dirname "$0")/backend/venv/bin/pytest" \
    "$(which pytest 2>/dev/null)" \
    "$(which python3 2>/dev/null) -m pytest" \
    "python -m pytest"; do
    cmd_head=$(echo "$candidate" | awk '{print $1}')
    if [ -x "$cmd_head" ] 2>/dev/null || command -v "$cmd_head" &>/dev/null; then
        PYTEST_BIN="$candidate"
        break
    fi
done

if [ -z "$PYTEST_BIN" ]; then
    print_warn "pytest not found — skipping tests (install with: pip install pytest httpx)"
else
    TESTS_DIR="$(dirname "$0")/backend"
    echo "Running: $PYTEST_BIN tests/ -x -q (in $TESTS_DIR)"
    if ! (cd "$TESTS_DIR" && $PYTEST_BIN tests/ -x -q); then
        print_err "Tests FAILED — aborting deploy. Fix failing tests before shipping."
    fi
    print_ok "All tests passed"
fi

# ── Step 3: Commit & push ──────────────────────────────────────
print_step "Pushing to GitHub"

git add .

if git diff --cached --quiet; then
    print_warn "No changes staged — skipping commit"
else
    git commit -m "$COMMIT_MSG"
    print_ok "Committed: $COMMIT_MSG"
fi

git push origin main
print_ok "Pushed to GitHub"

# ── Step 4: Sync files to server ──────────────────────────────
print_step "Syncing files to Hetzner"

rsync -az --progress \
  --exclude='backend/venv' \
  --exclude='backend/output' \
  --exclude='backend/__pycache__' \
  --exclude='backend/**/__pycache__' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  ./ $SERVER:$SERVER_DIR/

print_ok "Files synced"

# ── Step 5: Build & restart on server ─────────────────────────
print_step "Rebuilding and restarting on server"
echo "  (This takes 2–5 min. SSH keepalive active — will not time out.)"

$SSH $SERVER << 'REMOTE'
set -e
cd /opt/autovid

echo "→ Current disk usage:"
df -h / | tail -1 | awk '{print "   " $4 " free (" $5 " used)"}'

# Graceful shutdown
docker compose down --remove-orphans 2>/dev/null || true

# ── Smart cleanup ───────────────────────────────────────────────
# Only remove *dangling* (untagged) images — this preserves the Python
# layer cache so the backend doesn't need to reinstall 4 GB of packages
# on every deploy.  We still prune dangling images and build cache to
# reclaim space from failed/superseded builds.
echo "→ Pruning dangling images and build cache..."
docker image prune -f 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

echo "→ Disk after cleanup:"
df -h / | tail -1 | awk '{print "   " $4 " free (" $5 " used)"}'

# ── Build ───────────────────────────────────────────────────────
# Frontend: always rebuild without cache (it's tiny, ~180 MB).
# Backend/celery: use layer cache — Python packages are 4+ GB and
#   rarely change; only app code layers are invalidated.
echo "→ Building frontend (no-cache)..."
docker compose build --no-cache frontend

echo "→ Building backend services (cached layers)..."
docker compose build backend-1 backend-2 celery-worker

# ── Start ───────────────────────────────────────────────────────
echo "→ Starting containers..."
docker compose up -d

echo ""
echo "→ Container status:"
docker compose ps

echo ""
echo "→ Backend health check (waiting 5 s)..."
sleep 5
curl -s http://localhost:8000/docs > /dev/null \
  && echo "✔ Backend API responding" \
  || echo "⚠ Backend not responding yet — may still be starting"
REMOTE

# ── Step 6: Verify from local ──────────────────────────────────
print_step "Verifying deployment"
sleep 3

SERVER_HOST="${DEPLOY_SERVER_IP:-$(echo "$SERVER" | cut -d@ -f2)}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_HOST}" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    print_ok "Site is live — http://${SERVER_HOST}  (HTTP $HTTP_STATUS)"
else
    print_warn "Site returned HTTP $HTTP_STATUS — may still be warming up"
fi

echo -e "\n${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Deploy complete!${NC}"
echo -e "${GREEN}${BOLD}  App:  http://${SERVER_HOST}${NC}"
echo -e "${GREEN}${BOLD}  API:  http://${SERVER_HOST}:8000/docs${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}\n"
