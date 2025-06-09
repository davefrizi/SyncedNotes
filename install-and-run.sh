#!/bin/bash
echo "========================================"
echo "  SyncNote Desktop Installer"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Node.js found: $(node --version)"
echo ""
echo "Installing SyncNote Desktop..."
echo ""

# Install electron locally if not exists
if [ ! -d "node_modules" ]; then
    mkdir -p node_modules
fi

if [ ! -f "node_modules/.bin/electron" ]; then
    echo "Installing Electron (this may take a moment)..."
    npm install electron@latest
    if [ $? -ne 0 ]; then
        echo ""
        echo "Error: Failed to install Electron"
        echo "Please ensure you have internet connection and try again"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "Electron installed successfully!"
fi

echo ""
echo "Starting SyncNote Desktop..."
echo ""

# Try different ways to run electron
if [ -f "node_modules/.bin/electron" ]; then
    ./node_modules/.bin/electron electron/installer-main.js
elif [ -f "node_modules/electron/dist/electron" ]; then
    ./node_modules/electron/dist/electron electron/installer-main.js
else
    echo "Trying global electron..."
    electron electron/installer-main.js
fi

echo ""
echo "SyncNote Desktop has been closed."
