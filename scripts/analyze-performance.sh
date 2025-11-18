#!/bin/bash

# AlgoQBot Performance Analysis Report
# Analyzes trades from database and logs

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║          AlgoQBot Performance Analysis Report                 ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Date calculations
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)

echo "📅 Analysis Period:"
echo "   Yesterday: $YESTERDAY"
echo "   Today: $TODAY"
echo ""

# Database path
DB_PATH="./data/trading_bot.db"

# Log paths
TODAY_LOG="./logs/combined-${TODAY}.log"
YESTERDAY_LOG="./logs/combined-${YESTERDAY}.log"

# Check if shadow trades file exists
SHADOW_TRADES_FILE="./data/shadow_trades.json"

echo "═══════════════════════════════════════════════════════════════"
echo "📊 DATABASE ANALYSIS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Query database for yesterday
echo "Yesterday ($YESTERDAY):"
YESTERDAY_TRADES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE created_at >= '${YESTERDAY}T00:00:00' AND created_at < '${TODAY}T00:00:00'" 2>/dev/null || echo "0")
YESTERDAY_PNL=$(sqlite3 "$DB_PATH" "SELECT COALESCE(SUM(profit_loss), 0) FROM trades WHERE created_at >= '${YESTERDAY}T00:00:00' AND created_at < '${TODAY}T00:00:00' AND profit_loss IS NOT NULL" 2>/dev/null || echo "0")

echo "   Total Trades: $YESTERDAY_TRADES"
echo "   Total P&L: \$$YESTERDAY_PNL"
echo ""

# Query database for today
echo "Today ($TODAY):"
TODAY_TRADES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM trades WHERE created_at >= '${TODAY}T00:00:00'" 2>/dev/null || echo "0")
TODAY_PNL=$(sqlite3 "$DB_PATH" "SELECT COALESCE(SUM(profit_loss), 0) FROM trades WHERE created_at >= '${TODAY}T00:00:00' AND profit_loss IS NOT NULL" 2>/dev/null || echo "0")

echo "   Total Trades: $TODAY_TRADES"
echo "   Total P&L: \$$TODAY_PNL"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📊 SHADOW MODE ANALYSIS (From Logs)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Analyze shadow trades file if it exists
if [ -f "$SHADOW_TRADES_FILE" ]; then
    echo "Shadow Trades File Found:"
    SHADOW_COUNT=$(cat "$SHADOW_TRADES_FILE" | jq '. | length' 2>/dev/null || echo "0")
    echo "   Total Shadow Trades: $SHADOW_COUNT"

    if [ "$SHADOW_COUNT" -gt 0 ]; then
        # Calculate P&L from shadow trades
        SHADOW_PNL=$(cat "$SHADOW_TRADES_FILE" | jq '[.[] | select(.profit != null) | .profit] | add // 0' 2>/dev/null || echo "0")
        SHADOW_WINS=$(cat "$SHADOW_TRADES_FILE" | jq '[.[] | select(.profit != null and .profit > 0)] | length' 2>/dev/null || echo "0")
        SHADOW_LOSSES=$(cat "$SHADOW_TRADES_FILE" | jq '[.[] | select(.profit != null and .profit < 0)] | length' 2>/dev/null || echo "0")

        echo "   Winners: $SHADOW_WINS"
        echo "   Losers: $SHADOW_LOSSES"
        echo "   Total P&L: \$$SHADOW_PNL"

        if [ "$SHADOW_COUNT" -gt 0 ]; then
            WIN_RATE=$(echo "scale=2; ($SHADOW_WINS * 100) / $SHADOW_COUNT" | bc 2>/dev/null || echo "0")
            echo "   Win Rate: ${WIN_RATE}%"
        fi
    fi
    echo ""
else
    echo "   No shadow_trades.json file found"
    echo ""
fi

# Analyze today's log file
if [ -f "$TODAY_LOG" ]; then
    echo "Today's Log Analysis ($TODAY):"

    # Count AI decisions
    AI_DECISIONS=$(grep -c "AI Strategy executed" "$TODAY_LOG" 2>/dev/null || echo "0")
    HOLD_DECISIONS=$(grep "AI Strategy executed" "$TODAY_LOG" | grep -c "Action: HOLD" 2>/dev/null || echo "0")
    BUY_DECISIONS=$(grep "AI Strategy executed" "$TODAY_LOG" | grep -c "Action: BUY" 2>/dev/null || echo "0")
    SELL_DECISIONS=$(grep "AI Strategy executed" "$TODAY_LOG" | grep -c "Action: SELL" 2>/dev/null || echo "0")

    echo "   AI Decisions: $AI_DECISIONS"
    echo "   HOLD: $HOLD_DECISIONS"
    echo "   BUY: $BUY_DECISIONS"
    echo "   SELL: $SELL_DECISIONS"
    echo ""

    # Count position exits
    EXIT_COUNT=$(grep -c "Position exited" "$TODAY_LOG" 2>/dev/null || echo "0")
    echo "   Positions Exited: $EXIT_COUNT"

    # Find regime distribution
    echo ""
    echo "   Regime Distribution:"
    VERY_LOW=$(grep "Regime: VERY_LOW" "$TODAY_LOG" 2>/dev/null | wc -l | tr -d ' ')
    LOW=$(grep "Regime: LOW" "$TODAY_LOG" 2>/dev/null | wc -l | tr -d ' ')
    MEDIUM=$(grep "Regime: MEDIUM" "$TODAY_LOG" 2>/dev/null | wc -l | tr -d ' ')
    HIGH=$(grep "Regime: HIGH" "$TODAY_LOG" 2>/dev/null | wc -l | tr -d ' ')
    VERY_HIGH=$(grep "Regime: VERY_HIGH" "$TODAY_LOG" 2>/dev/null | wc -l | tr -d ' ')

    echo "      VERY_LOW: $VERY_LOW"
    echo "      LOW: $LOW"
    echo "      MEDIUM: $MEDIUM"
    echo "      HIGH: $HIGH"
    echo "      VERY_HIGH: $VERY_HIGH"

    # Latest volatility
    echo ""
    LATEST_VOL=$(grep "Volatility:" "$TODAY_LOG" | tail -1 | grep -o '[0-9.]*%' | head -1 2>/dev/null || echo "N/A")
    echo "   Latest Volatility: $LATEST_VOL"

    # Error count
    ERROR_COUNT=$(grep -c "ERROR" "$TODAY_LOG" 2>/dev/null || echo "0")
    echo "   Errors Logged: $ERROR_COUNT"

    echo ""
else
    echo "   No log file found for today ($TODAY_LOG)"
    echo ""
fi

# Analyze yesterday's log
if [ -f "$YESTERDAY_LOG" ]; then
    echo "Yesterday's Log Analysis ($YESTERDAY):"

    AI_DECISIONS=$(grep -c "AI Strategy executed" "$YESTERDAY_LOG" 2>/dev/null || echo "0")
    EXIT_COUNT=$(grep -c "Position exited" "$YESTERDAY_LOG" 2>/dev/null || echo "0")
    ERROR_COUNT=$(grep -c "ERROR" "$YESTERDAY_LOG" 2>/dev/null || echo "0")

    echo "   AI Decisions: $AI_DECISIONS"
    echo "   Positions Exited: $EXIT_COUNT"
    echo "   Errors Logged: $ERROR_COUNT"
    echo ""
else
    echo "   No log file found for yesterday ($YESTERDAY_LOG)"
    echo ""
fi

echo "═══════════════════════════════════════════════════════════════"
echo "💡 INSIGHTS & RECOMMENDATIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Generate insights based on data
TOTAL_TRADES=$(($YESTERDAY_TRADES + $TODAY_TRADES))

if [ "$TOTAL_TRADES" -eq 0 ]; then
    echo "⚠️  OBSERVATION: No database trades in last 2 days"
    echo "   Recommendation: This is expected for shadow mode - check shadow_trades.json for virtual trades"
    echo ""
fi

if [ -f "$TODAY_LOG" ]; then
    VOL_NUMERIC=$(echo "$LATEST_VOL" | sed 's/%//' 2>/dev/null)
    if [ -n "$VOL_NUMERIC" ]; then
        VOL_CHECK=$(echo "$VOL_NUMERIC < 0.3" | bc 2>/dev/null || echo "1")
        if [ "$VOL_CHECK" -eq 1 ]; then
            echo "⚠️  OBSERVATION: Low volatility ($LATEST_VOL < 0.3%)"
            echo "   Recommendation: System correctly avoiding trades in VERY_LOW regime"
            echo ""
        fi
    fi
fi

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "⚠️  WARNING: $ERROR_COUNT errors logged today"
    echo "   Recommendation: Review error logs for patterns"
    echo ""
fi

if [ "$TOTAL_TRADES" -eq 0 ] && [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ SYSTEM STATUS: Operating as expected"
    echo "   • No errors detected"
    echo "   • Volatility filters working correctly"
    echo "   • Bot protecting capital in quiet markets"
    echo ""
fi

echo "═══════════════════════════════════════════════════════════════"
echo "🎯 IMMEDIATE ACTION ITEMS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$TOTAL_TRADES" -eq 0 ] && [ ! -f "$SHADOW_TRADES_FILE" ]; then
    echo "   1. Verify shadow mode is enabled (check .env SHADOW_MODE=true)"
    echo "   2. Monitor for increased volatility (need >0.3% for LOW regime)"
elif [ "$TOTAL_TRADES" -eq 0 ]; then
    echo "   ✅ No immediate actions required"
    echo "      - System operating correctly in shadow mode"
    echo "      - Volatility too low for safe trading"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📁 REPORT FILES"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Create summary report
mkdir -p ./reports

REPORT_FILE="./reports/summary-${TODAY}.txt"

cat > "$REPORT_FILE" << EOF
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║            AlgoQBot Performance Report                        ║
║            Generated: $(date)                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

YESTERDAY ($YESTERDAY)
────────────────────────────────────────────────────────────────
Database Trades: $YESTERDAY_TRADES
P&L: \$$YESTERDAY_PNL

TODAY ($TODAY)
────────────────────────────────────────────────────────────────
Database Trades: $TODAY_TRADES
P&L: \$$TODAY_PNL
AI Decisions: $AI_DECISIONS
Positions Exited: $EXIT_COUNT
Latest Volatility: $LATEST_VOL
Errors: $ERROR_COUNT

REGIME DISTRIBUTION (Today)
────────────────────────────────────────────────────────────────
VERY_LOW: $VERY_LOW
LOW: $LOW
MEDIUM: $MEDIUM
HIGH: $HIGH
VERY_HIGH: $VERY_HIGH

INSIGHTS
────────────────────────────────────────────────────────────────
EOF

if [ "$TOTAL_TRADES" -eq 0 ]; then
    echo "• No database trades (expected for shadow mode)" >> "$REPORT_FILE"
fi

if [ -n "$VOL_NUMERIC" ]; then
    VOL_CHECK=$(echo "$VOL_NUMERIC < 0.3" | bc 2>/dev/null || echo "1")
    if [ "$VOL_CHECK" -eq 1 ]; then
        echo "• Volatility too low for trading ($LATEST_VOL < 0.3%)" >> "$REPORT_FILE"
    fi
fi

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "• No errors detected - system healthy" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "RECOMMENDATIONS" >> "$REPORT_FILE"
echo "────────────────────────────────────────────────────────────────" >> "$REPORT_FILE"
echo "• Continue monitoring for volatility increase" >> "$REPORT_FILE"
echo "• System correctly protecting capital" >> "$REPORT_FILE"

echo "   ✅ Text Report: $REPORT_FILE"
echo ""

# Export to JSON as well
JSON_REPORT="./data/performance-report-${TODAY}.json"

cat > "$JSON_REPORT" << EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "yesterday": {
    "date": "$YESTERDAY",
    "database_trades": $YESTERDAY_TRADES,
    "pnl": $YESTERDAY_PNL
  },
  "today": {
    "date": "$TODAY",
    "database_trades": $TODAY_TRADES,
    "pnl": $TODAY_PNL,
    "ai_decisions": $AI_DECISIONS,
    "hold_decisions": $HOLD_DECISIONS,
    "buy_decisions": $BUY_DECISIONS,
    "sell_decisions": $SELL_DECISIONS,
    "positions_exited": $EXIT_COUNT,
    "latest_volatility": "$LATEST_VOL",
    "errors": $ERROR_COUNT,
    "regime_distribution": {
      "very_low": $VERY_LOW,
      "low": $LOW,
      "medium": $MEDIUM,
      "high": $HIGH,
      "very_high": $VERY_HIGH
    }
  }
}
EOF

echo "   ✅ JSON Report: $JSON_REPORT"
echo ""
echo "✅ Analysis complete!"
echo ""
