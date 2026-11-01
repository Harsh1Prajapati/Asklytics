#!/bin/bash

echo "========================================"
echo "  Asklytics - Starting Application"
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    echo ""
fi

echo "Activating virtual environment..."
source .venv/bin/activate
echo ""

echo "Installing backend dependencies..."
pip install -q -r backend/requirements.txt
echo "Backend dependencies installed!"
echo ""

echo "Installing frontend dependencies..."
cd web
npm install
cd ..
echo "Frontend dependencies installed!"
echo ""

echo "========================================"
echo "Starting Backend Server (Port 8000)..."
echo "========================================"
cd backend
PYTHONPATH=. python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
cd ..

sleep 5

echo ""
echo "========================================"
echo "Starting Frontend Server (Port 5173)..."
echo "========================================"
cd web
VITE_API_BASE="http://localhost:8000" npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  Servers Running!"
echo "========================================"
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "========================================"
echo "  Open your browser to:"
echo "  http://localhost:5173"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all servers..."
echo ""

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
