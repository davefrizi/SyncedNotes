@echo off
title SyncNote Desktop Installer
echo ========================================
echo   SyncNote Desktop Installer
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version

echo.
echo Installing SyncNote Desktop...
echo.

REM Install electron locally if not exists
if not exist "node_modules" (
    echo Creating node_modules directory...
    mkdir node_modules 2>nul
)

if not exist "node_modules\.bin\electron.cmd" (
    echo Installing Electron (this may take a moment)...
    npm install electron@latest
    if errorlevel 1 (
        echo.
        echo Error: Failed to install Electron
        echo Please ensure you have internet connection and try again
        echo.
        pause
        exit /b 1
    )
    echo Electron installed successfully!
)

echo.
echo Starting SyncNote Desktop...
echo.

REM Try different ways to run electron
if exist "node_modules\.bin\electron.cmd" (
    "node_modules\.bin\electron.cmd" electron/installer-main.js
) else if exist "node_modules\electron\dist\electron.exe" (
    "node_modules\electron\dist\electron.exe" electron/installer-main.js
) else (
    echo Trying global electron...
    electron electron/installer-main.js
)

echo.
echo SyncNote Desktop has been closed.
pause
