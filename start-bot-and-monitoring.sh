#!/bin/bash

# Quick Start Script for Bot and Monitoring Dashboard
# Usage: ./start-bot-and-monitoring.sh

cd /Users/sheirraza/algoQbot

echo "🚀 Starting AlgoQBot Trading Bot and Monitoring Dashboard..."
echo ""

# Check if bot is already running
if ps aux | grep "AdvancedTradingBot" | grep -v grep > /dev/null; then
    echo "⚠️  Bot is already running!"
    ps aux | grep "AdvancedTradingBot" | grep -v grep
else
    # Start bot in background
    echo "📈 Starting trading bot..."
    npm start > logs/bot-console.log 2>&1 &
    BOT_PID=$!
    echo "✅ Bot started (PID: $BOT_PID)"
fi

# Wait a moment for bot to initialize
sleep 3

# Check if monitoring is already running
if ps aux | grep "monitor-positions" | grep -v grep > /dev/null; then
    echo "⚠️  Monitoring is already running!"
    ps aux | grep "monitor-positions" | grep -v grep
else
    # Start monitoring in background
    echo "📊 Starting monitoring script..."
    node scripts/monitor-positions.js > logs/monitoring-console.log 2>&1 &
    MONITOR_PID=$!
    echo "✅ Monitoring started (PID: $MONITOR_PID)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Startup Complete!"
echo ""
echo "📊 View Dashboard:"
echo "   ./monitor-dashboard-institutional.sh"
echo ""
echo "📈 View Bot Logs:"
echo "   tail -f logs/combined-$(date +%Y-%m-%d).log"
echo ""
echo "📋 View Monitoring Logs:"
echo "   tail -f logs/position-monitoring.log"
echo ""
echo "🔍 Check Status:"
echo "   ps aux | grep -E '(AdvancedTradingBot|monitor-positions)' | grep -v grep"
echo ""
echo "🛑 Stop Bot:"
echo "   pkill -f 'AdvancedTradingBot'"
echo ""
echo "🛑 Stop Monitoring:"
echo "   pkill -f 'monitor-positions'"
echo "═══════════════════════════════════════════════════════════"

