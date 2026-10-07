@echo off
REM One-time setup: Python virtual environment + packages, then frontend packages.
cd /d "%~dp0"

echo [1/3] Creating Python virtual environment...
if not exist backend\.venv\Scripts\python.exe (
    python -m venv backend\.venv || goto :error
)

echo [2/3] Installing Python packages...
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || goto :error

echo [3/3] Installing frontend packages...
pushd frontend
call npm install || (popd & goto :error)
popd

echo.
echo Setup complete. Double-click start.bat to launch the app.
pause
exit /b 0

:error
echo.
echo Setup failed - see the message above.
pause
exit /b 1
