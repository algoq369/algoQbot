#!/bin/bash

# BugBot Status Checker
# Checks for detected bugs and anomalies in your trading bot

echo "🐛 Checking BugBot Status..."
echo "========================================"
echo ""

# Check if bot is running
if ! lsof -ti:3001 > /dev/null 2>&1; then
    echo "❌ Bot is not running on port 3001"
    echo "Start it with: npm start"
    exit 1
fi

echo "✅ Bot is running"
echo ""

# Check BugBot API
echo "📊 BugBot API Status:"
echo "--------------------"
BUGBOT_STATUS=$(curl -s http://localhost:3001/api/bugbot/status)

if [ -z "$BUGBOT_STATUS" ]; then
    echo "❌ Failed to get BugBot status"
    exit 1
fi

# Parse status
STATUS=$(echo $BUGBOT_STATUS | jq -r '.status')
CRITICAL_COUNT=$(echo $BUGBOT_STATUS | jq -r '.criticalBugsCount')

if [ "$STATUS" == "healthy" ]; then
    echo "✅ Status: HEALTHY"
    echo "✅ Critical Bugs: 0"
else
    echo "🚨 Status: ISSUES DETECTED"
    echo "🚨 Critical Bugs: $CRITICAL_COUNT"
    echo ""
    echo "Critical Bug Details:"
    echo "--------------------"
    echo $BUGBOT_STATUS | jq '.criticalBugs'
fi

echo ""
echo "========================================"

# Check trading metrics
echo ""
echo "📈 Trading Metrics:"
echo "--------------------"
BOT_STATUS=$(curl -s http://localhost:3001/api/status)

TOTAL_TRADES=$(echo $BOT_STATUS | jq -r '.performance.totalTrades')
SUCCESS_RATE=$(echo $BOT_STATUS | jq -r '.performance.successRate')
PROFIT=$(echo $BOT_STATUS | jq -r '.performance.profit')

echo "Total Trades: $TOTAL_TRADES"
echo "Success Rate: ${SUCCESS_RATE}%"
echo "Profit: \$${PROFIT}"

echo ""
echo "========================================"

# Check recent bug reports
echo ""
echo "📝 Recent Bug Reports (last 5):"
echo "--------------------"

if [ -f "logs/bugbot-reports.json" ]; then
    REPORT_COUNT=$(cat logs/bugbot-reports.json | jq '. | length')
    echo "Total reports: $REPORT_COUNT"
    echo ""
    cat logs/bugbot-reports.json | jq '.[-5:] | .[] | {type, severity, description, timestamp}' 2>/dev/null || echo "No reports yet"
else
    echo "No bug reports file found"
fi

echo ""
echo "========================================"
echo ""
echo "💡 Commands:"
echo "- Watch logs: tail -f logs/combined.log | grep 'CRITICAL BUG'"
echo "- View reports: cat logs/bugbot-reports.json | jq"
echo "- BugBot dashboard: https://cursor.com/dashboard?tab=bugbot"
echo ""







