#!/bin/bash
# Double-click on a Mac after extracting the ZIP, or run ./RUN_ELECTRON_MAC.command
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js LTS with npm is required. Install it from https://nodejs.org/"
  read -r -p "Press Enter to close..." _
  exit 1
fi
if [ ! -f node_modules/electron/package.json ]; then
  echo "Installing Electron dependencies (first run requires internet)..."
  npm install
fi
echo "Opening AeroVector in an Electron desktop window..."
npm start
