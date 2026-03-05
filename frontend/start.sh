#!/bin/bash
# AutoVid Frontend Starter
# Always runs on port 5173. Fails loudly if port is occupied.

PORT=5173
cd "$(dirname "$0")"

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo ""
  echo "❌ ERROR: Port $PORT is already in use!"
  echo ""
  echo "   To find what's using it:"
  echo "   lsof -i :$PORT"
  echo ""
  echo "   To kill it:"
  echo "   kill \$(lsof -ti :$PORT)"
  echo ""
  exit 1
fi

# Also verify backend is reachable before starting
BACKEND="http://localhost:8000"
if ! curl -s --max-time 2 "$BACKEND/health" > /dev/null 2>&1; then
  echo ""
  echo "⚠️  WARNING: Backend not reachable at $BACKEND"
  echo "   Start the backend first: cd ../backend && ./start.sh"
  echo ""
  read -p "   Continue anyway? (y/N): " confirm
  [[ "$confirm" != "y" && "$confirm" != "Y" ]] && exit 1
fi

echo "🚀 Starting AutoVid frontend on http://localhost:$PORT"
echo "   Backend proxy → http://localhost:8000"
echo ""

npm run dev