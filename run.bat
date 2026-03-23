@echo off
echo ==========================================
echo   Classify - Starting Production Server
echo ==========================================
echo.

echo Starting backend (serving frontend on port 5000)...
node server/dist/index.js

if %ERRORLEVEL% NEQ 0 (
    echo Server crashed or failed to start.
    pause
)
