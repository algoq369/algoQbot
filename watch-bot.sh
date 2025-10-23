#!/bin/bash
# Real-time Bot Dashboard

clear
echo "🤖 BSC TRADING BOT - LIVE DASHBOARD"
echo "Press Ctrl+C to exit"
echo "===================================="

while true; do
    clear
    echo "🤖 BSC TRADING BOT - LIVE DASHBOARD"
    date
    echo "===================================="
    echo ""

    # Bot Status
    echo "📊 BOT STATUS:"
    ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print "   🟢 Running | PID: "$2" | CPU: "$3"% | Mem: "$4"% | Time: "$10}' || echo "   🔴 NOT RUNNING"
    echo ""

    # Portfolio
    echo "💰 PORTFOLIO:"
    tail -100 logs/combined.log | grep "virtual balances" | tail -1 | grep -o '[0-9.]\+ USDT, [0-9.]\+ BNB' | awk '{print "   "$0}' || echo "   No data"
    echo ""

    # Last Decision
    echo "🎯 LAST DECISION:"
    tail -100 logs/combined.log | grep "Trading decision made" | tail -1 | grep -o 'action":"[^"]*","confidence":[^,]*' | awk -F'"' '{print "   Action: "$2" | Confidence: "$4}' | sed 's/,confidence://' || echo "   No recent decision"
    echo ""

    # Active Positions
    echo "📈 POSITIONS (Last 30s):"
    tail -50 logs/combined.log | grep "Monitoring position" | tail -3 | awk -F'message":"' '{print $2}' | awk -F'"' '{print "   "$1}' || echo "   None"
    echo ""

    # Recent Trades (last 5 min)
    echo "💼 RECENT TRADES:"
    tail -200 logs/combined.log | grep "Shadow Trade:" | tail -3 | awk -F'message":"' '{print $2}' | awk -F'"' '{print "   "$1}' || echo "   None in last 5 min"
    echo ""

    # Corruption Check
    CORRUPTION=$(tail -100 logs/combined.log | grep -c "suspiciously high")
    if [ "$CORRUPTION" -gt 0 ]; then
        echo "⚠️  CORRUPTION: $CORRUPTION warnings!"
    else
        echo "✅ HEALTH: No corruption detected"
    fi
    echo ""

    # Errors
    ERRORS=$(tail -50 logs/combined.log | grep -c '"level":"error"')
    if [ "$ERRORS" -gt 0 ]; then
        echo "❌ ERRORS: $ERRORS in last 50 lines"
        tail -50 logs/combined.log | grep '"level":"error"' | tail -2 | awk -F'message":"' '{print "   "$2}' | awk -F'"' '{print $1}'
    else
        echo "✅ NO ERRORS"
    fi

    echo ""
    echo "Refreshing in 5 seconds..."
    sleep 5
done






