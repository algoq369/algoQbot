#!/bin/bash

echo "========================================="
echo "BSC TRADING BOT - COMPLETE HEALTH CHECK"
echo "========================================="
echo ""

# 1. Process Status
echo "1️⃣ BOT PROCESS STATUS"
echo "---"
BOT_PID=$(ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print $2}')
if [ -z "$BOT_PID" ]; then
    echo "❌ Bot is NOT running"
else
    echo "✅ Bot is running (PID: $BOT_PID)"
    ps -p $BOT_PID -o etime= | xargs -I {} echo "   Uptime: {}"
fi
echo ""

# 2. Latest Status
echo "2️⃣ LATEST STATUS (Last 10 lines)"
echo "---"
tail -10 ~/bsc-ranging-bot/logs/combined.log | grep -E "Trading decision|Regime|Portfolio"
echo ""

# 3. Trade Count
echo "3️⃣ TRADE STATISTICS (Last 24h)"
echo "---"
DECISIONS=$(tail -2000 ~/bsc-ranging-bot/logs/combined.log | grep "Trading decision made" | wc -l)
BUYS=$(tail -2000 ~/bsc-ranging-bot/logs/combined.log | grep '"action":"buy"' | wc -l)
SELLS=$(tail -2000 ~/bsc-ranging-bot/logs/combined.log | grep '"action":"sell"' | wc -l)
HOLDS=$(tail -2000 ~/bsc-ranging-bot/logs/combined.log | grep '"action":"hold"' | wc -l)
echo "   Total Decisions: $DECISIONS"
echo "   BUY: $BUYS | SELL: $SELLS | HOLD: $HOLDS"
echo ""

# 4. Open Positions
echo "4️⃣ OPEN POSITIONS"
echo "---"
POSITIONS=$(tail -500 ~/bsc-ranging-bot/logs/combined.log | grep "Position tracked" | tail -3)
if [ -z "$POSITIONS" ]; then
    echo "   No open positions tracked recently"
else
    echo "$POSITIONS"
fi
echo ""

# 5. Portfolio Balance
echo "5️⃣ CURRENT PORTFOLIO"
echo "---"
tail -200 ~/bsc-ranging-bot/logs/combined.log | grep "Current balances:" | tail -1
tail -200 ~/bsc-ranging-bot/logs/combined.log | grep "Portfolio value updated" | tail -1
echo ""

# 6. Risk Manager
echo "6️⃣ RISK MANAGER STATUS"
echo "---"
EMERGENCY=$(tail -200 ~/bsc-ranging-bot/logs/combined.log | grep -i "emergency shutdown")
if [ -z "$EMERGENCY" ]; then
    echo "   ✅ No emergency shutdown"
else
    echo "   ⚠️ Emergency shutdown detected!"
    echo "$EMERGENCY" | tail -2
fi
tail -200 ~/bsc-ranging-bot/logs/combined.log | grep "Daily Loss:" | tail -1
tail -200 ~/bsc-ranging-bot/logs/combined.log | grep "Daily Trades:" | tail -1
echo ""

# 7. Current Regime
echo "7️⃣ MARKET REGIME"
echo "---"
tail -100 ~/bsc-ranging-bot/logs/combined.log | grep "Current Regime:" | tail -1
tail -100 ~/bsc-ranging-bot/logs/combined.log | grep "4h Volatility:" | tail -1
tail -100 ~/bsc-ranging-bot/logs/combined.log | grep "Strategy:" | tail -1
echo ""

# 8. API Health
echo "8️⃣ API SERVER"
echo "---"
API_STATUS=$(curl -s http://localhost:3001/api/status 2>&1)
if [ $? -eq 0 ]; then
    echo "   ✅ API server responding"
    echo "$API_STATUS" | head -5
else
    echo "   ❌ API server not responding"
fi
echo ""

# 9. Recent Errors
echo "9️⃣ RECENT ERRORS (Last 5)"
echo "---"
ERRORS=$(tail -500 ~/bsc-ranging-bot/logs/combined.log | grep -i "ERROR" | tail -5)
if [ -z "$ERRORS" ]; then
    echo "   ✅ No recent errors"
else
    echo "$ERRORS"
fi
echo ""

# 10. Anthropic API
echo "🔟 ANTHROPIC API STATUS"
echo "---"
API_ISSUE=$(tail -200 ~/bsc-ranging-bot/logs/combined.log | grep "Insufficient API credits" | tail -1)
if [ -z "$API_ISSUE" ]; then
    echo "   ✅ API credits available"
else
    echo "   ⚠️ API credits depleted"
    echo "$API_ISSUE"
fi
echo ""

echo "========================================="
echo "HEALTH CHECK COMPLETE"
echo "========================================="
