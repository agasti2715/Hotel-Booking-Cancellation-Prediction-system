@echo off
REM Starts the Flask API (port 5000) and the React app (port 5173) in two windows.
cd /d "%~dp0"

if not exist backend\.venv\Scripts\python.exe (
    echo Run setup.bat first.
    pause
    exit /b 1
)

if not exist backend\model\booking_cancellation_model.pkl (
    echo Model not found - training it now, this takes about a minute...
    backend\.venv\Scripts\python.exe backend\train_model.py || (pause & exit /b 1)
)

start "Flask API - port 5000" cmd /k backend\.venv\Scripts\python.exe backend\app.py
start "React frontend - port 5173" cmd /k "cd frontend && npm run dev"

echo Waiting for the servers to start...
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
