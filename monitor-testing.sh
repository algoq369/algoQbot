#!/bin/bash

echo "🔍 BSC Trading Bot - Extended Testing Monitor"
echo "=============================================="
echo "Started: $(date)"
echo ""

while true; do
    echo "📊 Status Check - $(date '+%H:%M:%S')"
    echo "----------------------------------------"

    # Check if bot is running
    if pgrep -f "start-shadow-mode.js" > /dev/null; then
        echo "✅ Bot Status: RUNNING"
    else
        echo "❌ Bot Status: STOPPED"
        break
    fi

    # Check price history count
    if [ -f "data/price-history.json" ]; then
        COUNT=$(jq '. | length' data/price-history.json 2>/dev/null || echo "0")
        echo "📈 Price History Points: $COUNT"

        # Show latest price
        LATEST_PRICE=$(jq -r '.[-1].price' data/price-history.json 2>/dev/null || echo "N/A")
        LATEST_TIME=$(jq -r '.[-1].timestamp' data/price-history.json 2>/dev/null || echo "N/A")
        echo "💰 Latest Price: $LATEST_PRICE (${LATEST_TIME})"
    else
        echo "📈 Price History Points: 0 (no file)"
    fi

    # Check shadow trades
    if [ -f ".shadow-trades.json" ]; then
        TRADE_COUNT=$(jq '.trades | length' .shadow-trades.json 2>/dev/null || echo "0")
        echo "👻 Shadow Trades: $TRADE_COUNT"
    else
        echo "👻 Shadow Trades: 0 (no file yet)"
    fi

    # Check bot process info
    PID=$(pgrep -f "start-shadow-mode.js")
    if [ ! -z "$PID" ]; then
        MEMORY=$(ps -o rss= -p $PID 2>/dev/null | awk '{print $1/1024 " MB"}' || echo "N/A")
        CPU=$(ps -o %cpu= -p $PID 2>/dev/null | awk '{print $1 "%"}' || echo "N/A")
        echo "🖥️  Process Info: PID $PID, Memory: $MEMORY, CPU: $CPU"
    fi

    echo ""
    echo "⏰ Next check in 60 seconds..."
    echo "=============================================="

    sleep 60
done

echo "🔚 Monitoring stopped at $(date)"
