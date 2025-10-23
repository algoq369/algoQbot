#!/bin/bash

echo "════════════════════════════════════════════════════════════════════════"
echo "BSC TRADING BOT - COMPREHENSIVE STATUS REPORT"
echo "Generated: $(date)"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════
# SECTION 1: BOT HEALTH
# ═══════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════════"
echo "1. BOT HEALTH STATUS"
echo "═══════════════════════════════════════════════════════════════"

BOT_PID=$(ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print $2}')
if [ -z "$BOT_PID" ]; then
    echo "❌ Status: NOT RUNNING"
    echo ""
    echo "Last 20 log lines before crash:"
    tail -20 logs/combined.log
    exit 1
else
    echo "✅ Status: RUNNING (PID: $BOT_PID)"
    UPTIME=$(ps -p $BOT_PID -o etime= | xargs)
    echo "   Uptime: $UPTIME"
    MEMORY=$(ps -p $BOT_PID -o rss= | awk '{printf "%.2f MB", $1/1024}')
    echo "   Memory: $MEMORY"
    CPU=$(ps -p $BOT_PID -o %cpu= | xargs)
    echo "   CPU: ${CPU}%"
fi

# API Status
echo ""
echo "API Server:"
if curl -s http://localhost:3001/api/status > /dev/null 2>&1; then
    echo "   ✅ Responding on port 3001"
else
    echo "   ❌ Not responding"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 2: BUG STATUS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "2. CRITICAL BUG STATUS"
echo "═══════════════════════════════════════════════════════════════"

echo "bnbBalance Bug:"
if tail -500 logs/combined.log | grep -q "bnbBalance is not defined"; then
    echo "   ❌ PRESENT - Still causing errors"
    BUG_COUNT=$(tail -500 logs/combined.log | grep -c "bnbBalance is not defined")
    echo "   Occurrences (last 500 logs): $BUG_COUNT"
else
    echo "   ✅ FIXED - No occurrences in recent logs"
fi

echo ""
echo "Emergency Shutdown:"
if tail -300 logs/combined.log | grep -q "emergency shutdown"; then
    echo "   ⚠️ ACTIVE"
    tail -300 logs/combined.log | grep "emergency shutdown" | tail -2
else
    echo "   ✅ CLEAR - Trading not blocked"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 3: PORTFOLIO STATUS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "3. PORTFOLIO STATUS"
echo "═══════════════════════════════════════════════════════════════"

LATEST_PORTFOLIO=$(tail -200 logs/combined.log | grep "Total portfolio:" | tail -1)
if [ ! -z "$LATEST_PORTFOLIO" ]; then
    echo "$LATEST_PORTFOLIO" | sed 's/.*Total portfolio: /Current Value: /'
else
    echo "Current Value: Unable to extract (checking alternative format...)"
    tail -200 logs/combined.log | grep "Portfolio value updated" | tail -1 | grep -oE '\$[0-9]+\.[0-9]+'
fi

echo ""
echo "Balance Breakdown:"
USDT_BAL=$(tail -200 logs/combined.log | grep "PORTFOLIO CHECK.*USDT.*BNB" | tail -1 | grep -oE '[0-9]+\.[0-9]+ USDT' | head -1)
BNB_BAL=$(tail -200 logs/combined.log | grep "PORTFOLIO CHECK.*USDT.*BNB" | tail -1 | grep -oE '[0-9]+\.[0-9]+ BNB')
USDT_PCT=$(tail -200 logs/combined.log | grep "Percentages:" | tail -1 | grep -oE 'USDT [0-9.]+%' | grep -oE '[0-9.]+%')
BNB_PCT=$(tail -200 logs/combined.log | grep "Percentages:" | tail -1 | grep -oE 'BNB [0-9.]+%' | grep -oE '[0-9.]+%')

if [ ! -z "$USDT_BAL" ]; then
    echo "   USDT: $USDT_BAL ($USDT_PCT)"
    echo "   BNB:  $BNB_BAL ($BNB_PCT)"
else
    echo "   Unable to extract detailed breakdown"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 4: MARKET CONDITIONS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "4. CURRENT MARKET CONDITIONS"
echo "═══════════════════════════════════════════════════════════════"

REGIME=$(tail -200 logs/combined.log | grep "\[REGIME\] Detected:" | tail -1 | awk -F': ' '{print $2}')
VOLATILITY=$(tail -200 logs/combined.log | grep "4h Volatility:" | tail -1 | awk -F': ' '{print $2}')
STRATEGY=$(tail -200 logs/combined.log | grep "Selected strategy:" | tail -1 | awk -F': ' '{print $2}')
CURRENT_PRICE=$(tail -200 logs/combined.log | grep "Current Price:" | tail -1 | awk -F': ' '{print $2}')

echo "Regime: ${REGIME:-Unknown}"
echo "4h Volatility: ${VOLATILITY:-Unknown}"
echo "Strategy: ${STRATEGY:-Unknown}"
echo "Current Price: ${CURRENT_PRICE:-Unknown} BNB/USDT"

echo ""
echo "Trading Status:"
if tail -200 logs/combined.log | grep -q "Volatility too low"; then
    echo "   ⏸️  PAUSED - Volatility too low for trading"
    MIN_VOL=$(tail -200 logs/combined.log | grep "Minimum required:" | tail -1 | awk -F': ' '{print $2}')
    echo "   Minimum required: ${MIN_VOL:-0.3%}"
elif tail -200 logs/combined.log | grep -q "confidence.*below minimum"; then
    echo "   ⏸️  PAUSED - Confidence below threshold"
else
    echo "   ✅ ACTIVE - Looking for trading opportunities"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 5: TRADING ACTIVITY (Last 1 Hour)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "5. TRADING ACTIVITY (Recent)"
echo "═══════════════════════════════════════════════════════════════"

DECISIONS=$(tail -1000 logs/combined.log | grep "Trading decision made" | wc -l | xargs)
HOLDS=$(tail -1000 logs/combined.log | grep '"action":"hold"' | wc -l | xargs)
BUYS=$(tail -1000 logs/combined.log | grep '"action":"buy"' | wc -l | xargs)
SELLS=$(tail -1000 logs/combined.log | grep '"action":"sell"' | wc -l | xargs)

echo "Trading Decisions (last 1000 logs):"
echo "   Total: $DECISIONS"
echo "   HOLD:  $HOLDS"
echo "   BUY:   $BUYS"
echo "   SELL:  $SELLS"

echo ""
echo "Position Tracking:"
POSITIONS_OPENED=$(grep "Position tracked" logs/combined.log | wc -l | xargs)
POSITIONS_REMOVED=$(grep "removed from tracking" logs/combined.log | wc -l | xargs)
CURRENTLY_OPEN=$((POSITIONS_OPENED - POSITIONS_REMOVED))

echo "   Total opened (all time): $POSITIONS_OPENED"
echo "   Total closed (all time): $POSITIONS_REMOVED"
echo "   Currently open: $CURRENTLY_OPEN"

# ═══════════════════════════════════════════════════════════════
# SECTION 6: CONFIDENCE LEVELS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "6. RECENT CONFIDENCE LEVELS"
echo "═══════════════════════════════════════════════════════════════"

echo "Last 5 trading decisions:"
tail -1000 logs/combined.log | grep "Trading decision made" | tail -5 | while read -r line; do
    ACTION=$(echo "$line" | grep -oE '"action":"[^"]*"' | cut -d'"' -f4)
    CONFIDENCE=$(echo "$line" | grep -oE '"confidence":[0-9.]+' | cut -d':' -f2)
    STRATEGY=$(echo "$line" | grep -oE '"strategy":"[^"]*"' | cut -d'"' -f4)
    echo "   ${ACTION^^} - ${STRATEGY} - Confidence: ${CONFIDENCE}%"
done

# ═══════════════════════════════════════════════════════════════
# SECTION 7: ERROR ANALYSIS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "7. ERROR ANALYSIS"
echo "═══════════════════════════════════════════════════════════════"

ERROR_COUNT=$(tail -500 logs/combined.log | grep '"level":"error"' | wc -l | xargs)
WARN_COUNT=$(tail -500 logs/combined.log | grep '"level":"warn"' | wc -l | xargs)

echo "Recent Issues (last 500 logs):"
echo "   Errors: $ERROR_COUNT"
echo "   Warnings: $WARN_COUNT"

if [ $ERROR_COUNT -gt 0 ]; then
    echo ""
    echo "Last 3 errors:"
    tail -500 logs/combined.log | grep '"level":"error"' | tail -3 | while read -r line; do
        MSG=$(echo "$line" | jq -r '.message' 2>/dev/null || echo "$line")
        echo "   • $MSG"
    done
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 8: PERFORMANCE SUMMARY
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "8. PERFORMANCE SUMMARY"
echo "═══════════════════════════════════════════════════════════════"

TP_HITS=$(grep "Take profit hit" logs/combined.log | wc -l | xargs)
SL_HITS=$(grep "Stop loss hit" logs/combined.log | wc -l | xargs)
TOTAL_EXITS=$((TP_HITS + SL_HITS))

echo "Exit Statistics (all time):"
echo "   Take Profit hits: $TP_HITS"
echo "   Stop Loss hits: $SL_HITS"
echo "   Total exits: $TOTAL_EXITS"

if [ $TOTAL_EXITS -gt 0 ] && [ $POSITIONS_OPENED -gt 0 ]; then
    EXIT_RATE=$(echo "scale=1; ($TOTAL_EXITS * 100) / $POSITIONS_OPENED" | bc)
    TP_RATE=$(echo "scale=1; ($TP_HITS * 100) / $POSITIONS_OPENED" | bc)
    echo "   Exit rate: ${EXIT_RATE}%"
    echo "   TP rate: ${TP_RATE}%"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 9: RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "9. SYSTEM RECOMMENDATIONS"
echo "═══════════════════════════════════════════════════════════════"

ISSUES=0

# Check 1: bnbBalance bug
if tail -500 logs/combined.log | grep -q "bnbBalance is not defined"; then
    echo "⚠️  Issue 1: bnbBalance bug still present"
    ISSUES=$((ISSUES + 1))
fi

# Check 2: Emergency shutdown
if tail -300 logs/combined.log | grep -q "emergency shutdown"; then
    echo "⚠️  Issue 2: Emergency shutdown blocking trades"
    ISSUES=$((ISSUES + 1))
fi

# Check 3: High error rate
if [ $ERROR_COUNT -gt 10 ]; then
    echo "⚠️  Issue 3: High error rate ($ERROR_COUNT errors in last 500 logs)"
    ISSUES=$((ISSUES + 1))
fi

# Check 4: No trading activity
if [ $DECISIONS -lt 3 ] && [ "$UPTIME" != "" ]; then
    echo "ℹ️  Notice: Low trading activity (waiting for market conditions)"
fi

# Check 5: Low TP rate
if [ $POSITIONS_OPENED -gt 100 ] && [ $TP_HITS -gt 0 ]; then
    TP_RATE=$(echo "scale=0; ($TP_HITS * 100) / $POSITIONS_OPENED" | bc)
    if [ $TP_RATE -lt 20 ]; then
        echo "⚠️  Issue 4: Low TP rate (${TP_RATE}% - should be >30%)"
        ISSUES=$((ISSUES + 1))
    fi
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ No critical issues detected"
    echo ""
    echo "System Status: HEALTHY"
    echo "Bot is operating normally and waiting for optimal trading conditions."
else
    echo ""
    echo "Total Issues Found: $ISSUES"
    echo "Status: NEEDS ATTENTION"
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 10: NEXT ACTIONS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "10. SUGGESTED NEXT ACTIONS"
echo "═══════════════════════════════════════════════════════════════"

if [ $ISSUES -gt 0 ]; then
    echo "🔧 Immediate actions required:"
    
    if tail -500 logs/combined.log | grep -q "bnbBalance is not defined"; then
        echo "   1. Apply bnbBalance bug fix"
    fi
    
    if tail -300 logs/combined.log | grep -q "emergency shutdown"; then
        echo "   2. Reset emergency shutdown"
    fi
    
    if [ $ERROR_COUNT -gt 10 ]; then
        echo "   3. Investigate recurring errors"
    fi
else
    echo "📊 Monitoring recommendations:"
    echo "   1. Continue monitoring for volatility increase"
    echo "   2. Check back in 1-2 hours for trading activity"
    echo "   3. Monitor position exits when trading resumes"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "REPORT COMPLETE"
echo "════════════════════════════════════════════════════════════════════════"
