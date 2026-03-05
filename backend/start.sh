#!/bin/bash
# AutoVid Backend Starter
# Always runs on port 8000. Fails loudly if port is occupied.

PORT=8000
cd "$(dirname "$0")"
source venv/bin/activate

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

echo "🚀 Starting AutoVid backend on http://localhost:$PORT"
echo "   Docs: http://localhost:$PORT/docs"
echo ""

uvicorn main:app --reload --port $PORT --host 0.0.0.0