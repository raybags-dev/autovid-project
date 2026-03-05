#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "📁 Project root : $ROOT"
echo "📁 Backend      : $BACKEND"
echo "📁 Frontend     : $FRONTEND"
echo ""

# ── Validate paths exist ──────────────────────────────────────────────────────
if [ ! -d "$BACKEND" ]; then
  echo "❌ Backend folder not found: $BACKEND"; exit 1
fi
if [ ! -d "$FRONTEND" ]; then
  echo "❌ Frontend folder not found: $FRONTEND"; exit 1
fi
if [ ! -f "$FRONTEND/package.json" ]; then
  echo "❌ package.json not found in $FRONTEND"; exit 1
fi
if [ ! -f "$BACKEND/venv/bin/activate" ]; then
  echo "❌ Python venv not found in $BACKEND/venv"; exit 1
fi

# ── Kill existing processes ───────────────────────────────────────────────────
echo "🧹 Clearing ports 8000 and 5173..."
for PORT in 8000 5173; do
  PIDS=$(lsof -ti :$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "   Killing PID(s) on port $PORT"
    kill -9 $PIDS 2>/dev/null
  else
    echo "   Port $PORT was free"
  fi
done

echo "   Waiting for ports to release..."
sleep 2

for PORT in 8000 5173; do
  if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port $PORT still in use. Run: kill -9 \$(lsof -ti :$PORT)"
    exit 1
  fi
done

echo ""

# ── Start backend ─────────────────────────────────────────────────────────────
echo "▶ Starting backend on :8000..."
(
  cd "$BACKEND"
  source venv/bin/activate
  uvicorn main:app --port 8000 --host 0.0.0.0
) &
BACKEND_PID=$!

# Wait until backend responds
echo "  Waiting for backend..."
for i in {1..20}; do
  if curl -s --max-time 1 http://localhost:8000/health > /dev/null 2>&1; then
    echo "  ✅ Backend ready (${i}s)"
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "  ❌ Backend crashed. Check errors above."
    exit 1
  fi
  sleep 1
done

# ── Start frontend ────────────────────────────────────────────────────────────
echo ""
echo "▶ Starting frontend on :5173..."
(
  cd "$FRONTEND"
  npm run dev
) &
FRONTEND_PID=$!

sleep 3

echo ""
echo "════════════════════════════════════════"
echo "  ✅ AutoVid is running!"
echo ""
echo "  Frontend → http://localhost:5173"
echo "  Backend  → http://localhost:8000"
echo "  API Docs → http://localhost:8000/docs"
echo "════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop everything"
echo ""

trap "
  echo ''
  echo '🛑 Stopping AutoVid...'
  kill -9 $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo '✅ All stopped.'
  exit 0
" INT TERM

wait