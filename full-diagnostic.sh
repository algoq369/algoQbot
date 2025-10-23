#!/bin/bash

echo "════════════════════════════════════════════════════════════════════════"
echo "BSC TRADING BOT - COMPREHENSIVE DIAGNOSTIC REPORT"
echo "════════════════════════════════════════════════════════════════════════"
echo "Generated: $(date)"
echo ""

# ═══════════════════════════════════════════════════════════════
# SECTION 1: BOT STATUS
# ═══════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════════"
echo "1. CURRENT BOT STATUS"
echo "═══════════════════════════════════════════════════════════════"

BOT_PID=$(ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print $2}')
if [ -z "$BOT_PID" ]; then
    echo "❌ Bot Status: NOT RUNNING"
else
    echo "✅ Bot Status: RUNNING (PID: $BOT_PID)"
    echo "   Uptime: $(ps -p $BOT_PID -o etime= | xargs)"
    echo "   Memory: $(ps -p $BOT_PID -o rss= | awk '{printf "%.2f MB", $1/1024}')"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 2: PORTFOLIO VALUE TRACKING
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "2. PORTFOLIO VALUE EVOLUTION"
echo "═══════════════════════════════════════════════════════════════"

echo "   📊 First Recorded Value:"
head -5000 logs/combined.log | grep "Portfolio value updated" | head -1 | jq -r '.message' 2>/dev/null || head -5000 logs/combined.log | grep "Portfolio value updated" | head -1

echo ""
echo "   📊 Latest Value:"
tail -500 logs/combined.log | grep "Portfolio value updated" | tail -1 | jq -r '.message' 2>/dev/null || tail -500 logs/combined.log | grep "Portfolio value updated" | tail -1

echo ""
echo "   💰 Latest Balance Breakdown:"
tail -500 logs/combined.log | grep -E "Current balances:|USDT.*BNB" | tail -3

# ═══════════════════════════════════════════════════════════════
# SECTION 3: TRADE STATISTICS (COMPREHENSIVE)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "3. COMPREHENSIVE TRADE STATISTICS"
echo "═══════════════════════════════════════════════════════════════"

TOTAL_POSITIONS=$(grep "Position tracked" logs/combined.log | wc -l | xargs)
REMOVED_POSITIONS=$(grep "removed from tracking" logs/combined.log | wc -l | xargs)
TP_EXITS=$(grep "Take profit hit" logs/combined.log | wc -l | xargs)
SL_EXITS=$(grep "Stop loss hit" logs/combined.log | wc -l | xargs)
EXECUTE_EXIT_CALLS=$(grep "executeExit.*called" logs/combined.log | wc -l | xargs)

OPEN_POSITIONS=$((TOTAL_POSITIONS - REMOVED_POSITIONS))

echo "   📈 Total Positions Opened:     $TOTAL_POSITIONS"
echo "   📉 Total Positions Removed:    $REMOVED_POSITIONS"
echo "   🔓 Currently Open:             $OPEN_POSITIONS"
echo ""
echo "   ✅ Take Profit Hits:           $TP_EXITS"
echo "   ❌ Stop Loss Hits:             $SL_EXITS"
echo "   🔄 Total executeExit() Calls:  $EXECUTE_EXIT_CALLS"
echo ""

if [ $TOTAL_POSITIONS -gt 0 ]; then
    TP_RATE=$(echo "scale=2; ($TP_EXITS * 100) / $TOTAL_POSITIONS" | bc)
    OPEN_RATE=$(echo "scale=2; ($OPEN_POSITIONS * 100) / $TOTAL_POSITIONS" | bc)
    echo "   📊 TP Hit Rate:                $TP_RATE%"
    echo "   📊 Still Open Rate:            $OPEN_RATE%"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 4: RECENT POSITIONS (DETAILED)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "4. RECENT POSITION DETAILS (Last 5)"
echo "═══════════════════════════════════════════════════════════════"

tail -1000 logs/combined.log | grep "Position tracked" | tail -5 | while read -r line; do
    echo "$line" | jq -r '"\n   Position ID: \(.message | split(":")[1] | split(",")[0] | gsub(" "; ""))\n   Entry Price: \(.message | capture("@ (?<price>[0-9.]+)").price)\n   Size: \(.message | capture("\\$(?<size>[0-9.]+)").size)\n   TP Target: \(.message | capture("TP: (?<tp>[0-9.]+)").tp)"' 2>/dev/null || echo "$line"
done

# ═══════════════════════════════════════════════════════════════
# SECTION 5: PROFIT & LOSS ANALYSIS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "5. PROFIT & LOSS ANALYSIS"
echo "═══════════════════════════════════════════════════════════════"

# Extract portfolio values
FIRST_VALUE=$(head -5000 logs/combined.log | grep "Portfolio value updated" | head -1 | grep -oE '\$[0-9]+\.[0-9]+' | head -1 | tr -d '$')
LATEST_VALUE=$(tail -500 logs/combined.log | grep "Portfolio value updated" | tail -1 | grep -oE '\$[0-9]+\.[0-9]+' | head -1 | tr -d '$')

if [ ! -z "$FIRST_VALUE" ] && [ ! -z "$LATEST_VALUE" ]; then
    PROFIT=$(echo "$LATEST_VALUE - $FIRST_VALUE" | bc)
    PROFIT_PCT=$(echo "scale=2; (($LATEST_VALUE - $FIRST_VALUE) * 100) / $FIRST_VALUE" | bc)
    
    echo "   💰 Starting Portfolio:  \$$FIRST_VALUE"
    echo "   💰 Current Portfolio:   \$$LATEST_VALUE"
    echo "   📈 Total P&L:           \$$PROFIT ($PROFIT_PCT%)"
else
    echo "   ⚠️  Cannot calculate P&L (portfolio values not found)"
fi

echo ""
echo "   🎯 Realized Exits:"
tail -2000 logs/combined.log | grep -E "executeExit.*P&L|profit.*\$" | tail -5

# ═══════════════════════════════════════════════════════════════
# SECTION 6: TP/SL ACCURACY CHECK
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "6. TAKE PROFIT / STOP LOSS VALIDATION"
echo "═══════════════════════════════════════════════════════════════"

echo "   🔍 Recent TP/SL Checks (Last 3):"
tail -2000 logs/combined.log | grep "DETAILED TP CHECK" | tail -3 | while read -r line; do
    echo "$line" | jq -r '.message' 2>/dev/null | head -10 || echo "$line" | head -10
    echo "   ───────────────────────────────────────"
done

# ═══════════════════════════════════════════════════════════════
# SECTION 7: RISK MANAGER STATUS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "7. RISK MANAGER STATUS"
echo "═══════════════════════════════════════════════════════════════"

EMERGENCY_SHUTDOWN=$(tail -500 logs/combined.log | grep -i "emergency shutdown")
if [ ! -z "$EMERGENCY_SHUTDOWN" ]; then
    echo "   ⚠️  EMERGENCY SHUTDOWN ACTIVE:"
    echo "$EMERGENCY_SHUTDOWN" | tail -3
else
    echo "   ✅ No Emergency Shutdown"
fi

echo ""
echo "   📊 Latest Risk State:"
tail -500 logs/combined.log | grep "Risk State:" -A 5 | tail -6

# ═══════════════════════════════════════════════════════════════
# SECTION 8: MARKET REGIME & STRATEGY
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "8. CURRENT MARKET REGIME & STRATEGY"
echo "═══════════════════════════════════════════════════════════════"

tail -500 logs/combined.log | grep -E "Current Regime:|Volatility:|Strategy:" | tail -5

# ═══════════════════════════════════════════════════════════════
# SECTION 9: RECENT ERRORS & WARNINGS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "9. RECENT ERRORS & WARNINGS (Last 10)"
echo "═══════════════════════════════════════════════════════════════"

tail -1000 logs/combined.log | grep -E '"level":"(error|warn)"' | tail -10 | jq -r '"\(.level | ascii_upcase): \(.message)"' 2>/dev/null || tail -1000 logs/combined.log | grep -E '"level":"(error|warn)"' | tail -10

# ═══════════════════════════════════════════════════════════════
# SECTION 10: CONFIGURATION VERIFICATION
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "10. CONFIGURATION VERIFICATION"
echo "═══════════════════════════════════════════════════════════════"

echo "   🔧 Risk Manager Limits:"
grep -E "maxTradeSize:|maxPositionSize:|maxDailyLoss:" risk/productionRiskManager.js | head -5

echo ""
echo "   🎯 Trading Strategy Config:"
grep -E "FIXED_TP_PERCENT|boundsThreshold|minProfit:" agents/TradingStrategyAgent.js | head -5

# ═══════════════════════════════════════════════════════════════
# SECTION 11: API & SYSTEM HEALTH
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "11. API & SYSTEM HEALTH"
echo "═══════════════════════════════════════════════════════════════"

# Check if API is responding
API_STATUS=$(curl -s http://localhost:3001/api/status 2>&1 | head -1)
if [ $? -eq 0 ]; then
    echo "   ✅ API Server: Responding"
else
    echo "   ❌ API Server: Not responding"
fi

echo ""
echo "   📡 Port Status:"
lsof -i :3001 2>/dev/null | grep LISTEN || echo "   ❌ Port 3001 not in use"

# ═══════════════════════════════════════════════════════════════
# SECTION 12: CRITICAL ISSUES SUMMARY
# ═══════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "12. CRITICAL ISSUES DETECTED"
echo "════════════════════════════════════════════════════════════════════════"

ISSUES_FOUND=0

# Check emergency shutdown
if tail -500 logs/combined.log | grep -q "emergency shutdown"; then
    echo "   🚨 CRITICAL: Emergency shutdown active"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check low TP rate
if [ $TOTAL_POSITIONS -gt 100 ]; then
    TP_RATE_INT=$(echo "$TP_RATE" | cut -d. -f1)
    if [ $TP_RATE_INT -lt 20 ]; then
        echo "   ⚠️  WARNING: Low TP hit rate ($TP_RATE% < 20%)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
fi

# Check for TP calculation errors
if tail -1000 logs/combined.log | grep "DETAILED TP CHECK" | grep -q "Current P&L%: -"; then
    echo "   ⚠️  WARNING: Positions showing negative P&L when should be positive"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check for recent errors
ERROR_COUNT=$(tail -1000 logs/combined.log | grep '"level":"error"' | wc -l | xargs)
if [ $ERROR_COUNT -gt 10 ]; then
    echo "   ⚠️  WARNING: High error count in last 1000 logs ($ERROR_COUNT errors)"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo "   ✅ No critical issues detected"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "DIAGNOSTIC REPORT COMPLETE"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Total Issues Found: $ISSUES_FOUND"
echo "Report saved to: full-diagnostic-report.txt"
echo ""
