#!/bin/bash

# 🤖 AlgoQBot Overnight Performance Check
# Run this to analyze bot activity after running overnight

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║        🤖 ALGOQBOT OVERNIGHT PERFORMANCE CHECK 🤖             ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 1. BOT STATUS
echo "═══════════════════════════════════════════════════════════════"
echo "1. BOT STATUS"
echo "═══════════════════════════════════════════════════════════════"
if pgrep -f "AdvancedTradingBot.js" > /dev/null; then
    echo "✅ Bot is RUNNING"
    ps aux | grep "AdvancedTradingBot.js" | grep -v grep
else
    echo "❌ Bot is NOT RUNNING"
fi
echo ""

# 2. LOG FILES
echo "═══════════════════════════════════════════════════════════════"
echo "2. LOG FILES"
echo "═══════════════════════════════════════════════════════════════"
ls -lh logs/combined-*.log 2>/dev/null | tail -5
echo ""
LATEST_LOG=$(ls -t logs/combined-*.log 2>/dev/null | head -1)
if [ -f "$LATEST_LOG" ]; then
    echo "Latest log: $LATEST_LOG"
    echo "Log size: $(wc -l < "$LATEST_LOG") lines"
else
    echo "❌ No log files found"
fi
echo ""

# 3. TRADE COUNT (from logs)
echo "═══════════════════════════════════════════════════════════════"
echo "3. TRADE DECISIONS (Last 24 Hours)"
echo "═══════════════════════════════════════════════════════════════"
if [ -f "$LATEST_LOG" ]; then
    echo "Searching for trade actions in logs..."

    # Count HOLD decisions
    HOLD_COUNT=$(grep -i "action.*hold\|HOLD" "$LATEST_LOG" 2>/dev/null | wc -l)

    # Count BUY decisions
    BUY_COUNT=$(grep -i "action.*buy\|BUY" "$LATEST_LOG" 2>/dev/null | grep -v "HOLD" | wc -l)

    # Count SELL decisions
    SELL_COUNT=$(grep -i "action.*sell\|SELL" "$LATEST_LOG" 2>/dev/null | grep -v "HOLD" | wc -l)

    TOTAL=$((HOLD_COUNT + BUY_COUNT + SELL_COUNT))

    echo "  HOLD:  $HOLD_COUNT"
    echo "  BUY:   $BUY_COUNT"
    echo "  SELL:  $SELL_COUNT"
    echo "  TOTAL: $TOTAL decisions"
else
    echo "❌ No log file to analyze"
fi
echo ""

# 4. SHADOW TRADES FILE
echo "═══════════════════════════════════════════════════════════════"
echo "4. SHADOW TRADES DATA"
echo "═══════════════════════════════════════════════════════════════"
if [ -f "data/shadow_trades.json" ]; then
    ls -lh data/shadow_trades.json
    echo "Total records: $(cat data/shadow_trades.json | jq '. | length' 2>/dev/null || echo 'unknown')"
else
    echo "❌ No shadow trades file found"
fi
echo ""

# 5. CURRENT PORTFOLIO
echo "═══════════════════════════════════════════════════════════════"
echo "5. CURRENT PORTFOLIO"
echo "═══════════════════════════════════════════════════════════════"
if [ -f "data/virtual_balances.json" ]; then
    cat data/virtual_balances.json
else
    echo "❌ No virtual balances file found"
fi
echo ""

# 6. RECENT ACTIVITY (Last 20 lines)
echo "═══════════════════════════════════════════════════════════════"
echo "6. RECENT ACTIVITY (Last 20 log lines)"
echo "═══════════════════════════════════════════════════════════════"
if [ -f "$LATEST_LOG" ]; then
    tail -20 "$LATEST_LOG" | jq -r '.timestamp + " | " + .level + " | " + .message' 2>/dev/null || tail -20 "$LATEST_LOG"
else
    echo "❌ No log file to show"
fi
echo ""

# 7. ERROR COUNT
echo "═══════════════════════════════════════════════════════════════"
echo "7. ERROR ANALYSIS"
echo "═══════════════════════════════════════════════════════════════"
if [ -f "$LATEST_LOG" ]; then
    ERROR_COUNT=$(grep '"level":"error"' "$LATEST_LOG" 2>/dev/null | wc -l)
    WARN_COUNT=$(grep '"level":"warn"' "$LATEST_LOG" 2>/dev/null | wc -l)

    echo "Errors:   $ERROR_COUNT"
    echo "Warnings: $WARN_COUNT"

    if [ $ERROR_COUNT -gt 0 ]; then
        echo ""
        echo "Recent errors:"
        grep '"level":"error"' "$LATEST_LOG" | tail -5 | jq -r '.message' 2>/dev/null
    fi
else
    echo "❌ No log file to analyze"
fi
echo ""

# 8. CACHE PERFORMANCE
echo "═══════════════════════════════════════════════════════════════"
echo "8. CACHE PERFORMANCE"
echo "═══════════════════════════════════════════════════════════════"
if [ -f "$LATEST_LOG" ]; then
    grep "CACHE.*hit rate\|Price Cache" "$LATEST_LOG" 2>/dev/null | tail -5 | jq -r '.message' 2>/dev/null || echo "No cache data found"
else
    echo "❌ No log file to analyze"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✅ Check complete! Run detailed P&L analysis for more info."
echo "═══════════════════════════════════════════════════════════════"
