@echo off
echo ==========================================
echo   Classify - Initial Setup Script
echo ==========================================
echo.

echo [1/4] Installing root and service dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error installing dependencies. Please ensure Node.js and NPM are installed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Installing sub-project dependencies...
call npm run install-all
if %ERRORLEVEL% NEQ 0 (
    echo Error installing sub-project dependencies.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/4] Building client, generating database client, and bundling backend...
call npm run build-all
if %ERRORLEVEL% NEQ 0 (
    echo Error during build process.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/4] Finalizing setup...
echo.
echo ==========================================
echo   Setup Complete!
echo   The server uses a bundled and minified version of the backend.
echo   You can now start the server with: run.bat
echo ==========================================
pause
