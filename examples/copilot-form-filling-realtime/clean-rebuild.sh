#!/bin/bash

# Clean Rebuild Script for Copilot Form Filling Realtime Example
# This script performs a complete clean rebuild of the CopilotKit packages and example app

echo "🧹 Starting clean rebuild process..."
echo ""

# Save current directory
EXAMPLE_DIR=$(pwd)
COPILOTKIT_ROOT="../../CopilotKit"

# Step 1: Clean and rebuild CopilotKit packages
echo "📦 Step 1: Cleaning and rebuilding CopilotKit packages..."
cd $COPILOTKIT_ROOT

echo "  → Cleaning packages..."
pnpm run clean

echo "  → Installing dependencies..."
pnpm install

echo "  → Building packages..."
pnpm run build

echo "✅ CopilotKit packages rebuilt!"
echo ""

# Step 2: Clean the example app
cd $EXAMPLE_DIR
echo "🗑️  Step 2: Cleaning example app..."

echo "  → Removing .next cache..."
rm -rf .next

echo "  → Removing node_modules..."
rm -rf node_modules

echo "  → Removing package-lock.json..."
rm -rf package-lock.json

echo "✅ Example app cleaned!"
echo ""

# Step 3: Reinstall example app dependencies
echo "📥 Step 3: Installing fresh dependencies..."
npm install --legacy-peer-deps

echo ""
echo "✨ Clean rebuild complete!"
echo ""
echo "To start the app, run:"
echo "  npm run dev"
echo ""
echo "The app will be available at http://localhost:3000 (or 3001 if 3000 is in use)"