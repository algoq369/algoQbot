#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "   BSC TRADING BOT - COMPREHENSIVE HEALTH CHECKUP"
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# A. LOG FILE STATUS
echo "A. LOG FILE STATUS"
echo "=================="
TODAY=$(date +%Y-%m-%d)
echo "Today's date: $TODAY"
echo ""

if [ -f "logs/combined-$TODAY.log" ]; then
    echo "✅ Today's log file exists: logs/combined-$TODAY.log"
    ls -lh "logs/combined-$TODAY.log"
    echo ""
    echo "Last modified: $(stat -f "%Sm" "logs/combined-$TODAY.log" 2>/dev/null || stat -c "%y" "logs/combined-$TODAY.log" 2>/dev/null)"
    echo ""
    echo "Last 3 log entries:"
    tail -3 "logs/combined-$TODAY.log" | cut -c1-120
else
    echo "❌ Today's log file NOT FOUND: logs/combined-$TODAY.log"
    echo ""
    echo "Available log files:"
    ls -lh logs/*.log 2>/dev/null | head -5
fi

# B. RECENT BOT ACTIVITY
echo ""
echo "B. RECENT BOT ACTIVITY (Last 50 lines)"
echo "======================================="
if [ -f "logs/combined-$TODAY.log" ]; then
    tail -50 "logs/combined-$TODAY.log" | grep -E "REGIME|Portfolio|Decision" | tail -10
else
    echo "⚠️  Using fallback log file"
    tail -50 "logs/combined-2025-10-22.log" | grep -E "REGIME|Portfolio|Decision" | tail -10
fi

# C. ACTIVE POSITIONS
echo ""
echo "C. ACTIVE POSITIONS CHECK"
echo "========================="
if [ -f "logs/combined-$TODAY.log" ]; then
    echo "Checking activePositions in today's log..."
    grep -E "activePositions size|Monitoring.*active positions" "logs/combined-$TODAY.log" | tail -5
    echo ""
    LAST_COUNT=$(grep "activePositions size" "logs/combined-$TODAY.log" | tail -1)
    if [ -n "$LAST_COUNT" ]; then
        echo "Last count: $LAST_COUNT"
    else
        echo "No activePositions entries found (checking alternative format...)"
        grep "active position" "logs/combined-$TODAY.log" | tail -3
    fi
else
    echo "⚠️  Today's log not found"
fi

# D. RECENT ERRORS
echo ""
echo "D. RECENT ERRORS (Last Hour)"
echo "============================"
if [ -f "logs/combined-$TODAY.log" ]; then
    ERROR_COUNT=$(grep -c '"level":"error"' "logs/combined-$TODAY.log" 2>/dev/null)
    echo "Total errors in today's log: $ERROR_COUNT"
    echo ""
    echo "Last 5 error messages:"
    grep '"level":"error"' "logs/combined-$TODAY.log" | tail -5 | while IFS= read -r line; do
        TIMESTAMP=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
        MESSAGE=$(echo "$line" | grep -o '"message":"[^"]*"' | cut -d'"' -f4 | cut -c1-80)
        echo "  [$TIMESTAMP] $MESSAGE"
    done
else
    echo "⚠️  Today's log not found"
fi

# E. TRADE EXECUTIONS
echo ""
echo "E. TRADE EXECUTIONS"
echo "==================="
if [ -f "logs/combined-$TODAY.log" ]; then
    echo "Checking for trade executions in today's log..."
    grep -E "Position tracked|Shadow Trade|Would Execute|EXECUTING" "logs/combined-$TODAY.log" | tail -10

    TRADE_COUNT=$(grep -c "Shadow Trade\|Position tracked" "logs/combined-$TODAY.log" 2>/dev/null)
    echo ""
    echo "Total trade entries today: $TRADE_COUNT"
else
    echo "⚠️  Today's log not found"
fi

# F. RPC CONNECTION HEALTH
echo ""
echo "F. RPC CONNECTION HEALTH"
echo "========================"
if [ -f "logs/combined-$TODAY.log" ]; then
    echo "Checking for RPC issues in today's log..."
    TIMEOUT_COUNT=$(grep -ci "timeout\|TIMEOUT" "logs/combined-$TODAY.log" 2>/dev/null)
    RPC_ERROR_COUNT=$(grep -ci "Error getting price\|RPC error" "logs/combined-$TODAY.log" 2>/dev/null)

    echo "Timeout errors: $TIMEOUT_COUNT"
    echo "RPC errors: $RPC_ERROR_COUNT"
    echo ""

    if [ $TIMEOUT_COUNT -gt 0 ] || [ $RPC_ERROR_COUNT -gt 0 ]; then
        echo "Last 5 RPC/timeout errors:"
        grep -i "timeout\|Error getting price\|RPC error" "logs/combined-$TODAY.log" | tail -5
    else
        echo "✅ No RPC/timeout errors found"
    fi
else
    echo "⚠️  Today's log not found"
fi

# G. BOT PROCESS STATUS
echo ""
echo "G. BOT PROCESS STATUS"
echo "====================="
BOT_PID=$(ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$BOT_PID" ]; then
    echo "✅ Bot is running: PID $BOT_PID"
    ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print "   CPU: "$3"% | MEM: "$4"% | Started: "$9}'
else
    echo "❌ Bot is NOT running"
fi

# H. DASHBOARD LOG FILE DETECTION
echo ""
echo "H. DASHBOARD LOG FILE DETECTION"
echo "================================"
echo "Testing what log file the dashboard will use..."

if [ -f "logs/combined-$TODAY.log" ]; then
    LOG_FILE="logs/combined-$TODAY.log"
elif [ -f "logs/combined.log" ]; then
    LOG_FILE="logs/combined.log"
elif [ -f "logs/combined-2025-10-22.log" ]; then
    LOG_FILE="logs/combined-2025-10-22.log"
else
    LOG_FILE=$(find logs -maxdepth 1 -name "combined-*.log" -type f ! -name "*.gz" 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
fi

echo "Dashboard will use: $LOG_FILE"
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
    echo "✅ File exists: $(ls -lh "$LOG_FILE")"
else
    echo "❌ File not found or empty"
fi

# I. DECISION CONFIDENCE LEVELS
echo ""
echo "I. DECISION CONFIDENCE LEVELS (Last 10)"
echo "========================================"
if [ -f "logs/combined-$TODAY.log" ]; then
    grep -E "confidence|Decision:" "logs/combined-$TODAY.log" | tail -20 | head -10
else
    echo "⚠️  Today's log not found"
fi

# SUMMARY
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   HEALTH CHECK COMPLETE"
echo "═══════════════════════════════════════════════════════════"
