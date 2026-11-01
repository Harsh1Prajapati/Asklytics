@echo off
echo ========================================
echo   Asklytics - Starting Application
echo ========================================
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv .venv
    echo.
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat
echo.

echo Installing backend dependencies...
pip install -q -r backend\requirements.txt
echo Backend dependencies installed!
echo.

echo Installing frontend dependencies...
cd web
call npm install
cd ..
echo Frontend dependencies installed!
echo.

echo ========================================
echo Starting Backend Server (Port 8000)...
echo ========================================
start "Asklytics Backend" cmd /k "cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

timeout /t 5 /nobreak > nul

echo.
echo ========================================
echo Starting Frontend Server (Port 5173)...
echo ========================================
cd web
start "Asklytics Frontend" cmd /k "set VITE_API_BASE=http://localhost:8000 && npm run dev"
cd ..

echo.
echo ========================================
echo   Servers Starting...
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo API Docs: http://localhost:8000/docs
echo.
echo ========================================
echo   Open your browser to:
echo   http://localhost:5173
echo ========================================
echo.
echo Press any key to close this window...
pause > nul
