#!/bin/bash

# BSC Trading Bot - Safe Startup Script
# Kills old instances before starting to prevent port conflicts

echo "🔧 BSC Trading Bot - Safe Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check for existing bot instances
echo "🔍 Checking for existing bot instances..."
EXISTING_PIDS=$(pgrep -f "AdvancedTradingBot.js|start-shadow-mode.js" 2>/dev/null)

if [ -n "$EXISTING_PIDS" ]; then
    echo "⚠️  Found existing bot instances:"
    ps aux | grep -E "AdvancedTradingBot.js|start-shadow-mode.js" | grep -v grep | grep -v "safe-start"
    echo ""

    # Step 2: Kill existing instances
    echo "🔪 Killing old bot instances..."
    pkill -f "AdvancedTradingBot.js" 2>/dev/null || true
    pkill -f "start-shadow-mode.js" 2>/dev/null || true

    echo "✅ Old instances terminated"
else
    echo "✅ No existing instances found"
fi

# Step 3: Verify port 3001 is free
echo ""
echo "🔍 Checking port 3001 availability..."
PORT_CHECK=$(lsof -i :3001 2>/dev/null)

if [ -n "$PORT_CHECK" ]; then
    echo "⚠️  Port 3001 still in use, force killing process..."
    PORT_PID=$(lsof -ti :3001)
    kill -9 $PORT_PID 2>/dev/null || true
    echo "✅ Port 3001 freed"
else
    echo "✅ Port 3001 is available"
fi

# Step 4: Wait for cleanup
echo ""
echo "⏳ Waiting 2 seconds for cleanup..."
sleep 2

# Step 5: Start the bot
echo ""
echo "🚀 Starting BSC Trading Bot in Shadow Mode..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Auto-answer "yes" to shadow mode prompt
echo "yes" | node start-shadow-mode.js
