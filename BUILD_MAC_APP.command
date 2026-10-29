#!/bin/bash
# Double-click to build .dmg/.zip for the current Mac CPU.
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js LTS with npm is required. Install it from https://nodejs.org/"
  read -r -p "Press Enter to close..." _
  exit 1
fi
if [ ! -f node_modules/electron/package.json ]; then
  echo "Installing Electron dependencies..."
  npm install
fi
echo "Building Mac .dmg and .zip for this Mac's architecture..."
npm run dist:mac
echo "Build complete: see the dist/ folder."
read -r -p "Press Enter to close..." _
