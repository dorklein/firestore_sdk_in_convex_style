#!/bin/bash

# Script to run E2E tests with Firebase emulator
# This script starts the emulator, runs tests, and cleans up

set -e

echo "🔥 Starting Firebase Emulator..."

# Check if emulator is already running
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo "✅ Emulator already running"
  echo "🧪 Running E2E tests..."
  pnpm test:e2e
else
  echo "📦 Starting emulator and running tests..."
  firebase emulators:exec --only firestore "pnpm test:e2e"
fi

echo "✨ E2E tests complete!"

