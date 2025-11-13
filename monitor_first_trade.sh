#!/bin/bash

# Monitor First Trade - Real-time log monitoring for shadow trading bot
# Usage: ./monitor_first_trade.sh

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get today's log file
LOG_FILE="logs/combined-$(date +%Y-%m-%d).log"

echo "════════════════════════════════════════════════════════════════"
echo "  SHADOW TRADING BOT - FIRST TRADE MONITOR"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📂 Monitoring log: $LOG_FILE"
echo ""
echo "🔍 Watching for:"
echo "  ✅ Shadow Trade executions"
echo "  💰 Balance updates"
echo "  ❌ Errors"
echo "  💥 Balance explosions"
echo "  📊 P&L updates"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "⚠️  Log file not found: $LOG_FILE"
    echo "⚠️  Waiting for bot to start and create log file..."
    echo ""
    # Wait for file to be created
    while [ ! -f "$LOG_FILE" ]; do
        sleep 1
    done
    echo "✅ Log file created, starting monitoring..."
    echo ""
fi

# Monitor log file with colored output
tail -f "$LOG_FILE" | grep --line-buffered -E "(Shadow Trade|New Balances|SIMULATE BUY|SIMULATE SELL|Error|error|undefined|EXPLOSION|P&L|executeShadowTrade|BALANCE|insufficient|failed)" | while read line; do
    # Add timestamp
    TIMESTAMP=$(date '+%H:%M:%S')

    # Color code based on content
    if echo "$line" | grep -iq "error\|failed\|insufficient"; then
        echo -e "${RED}[$TIMESTAMP]${NC} $line"
    elif echo "$line" | grep -iq "explosion"; then
        echo -e "${RED}[$TIMESTAMP] 💥${NC} $line"
    elif echo "$line" | grep -iq "shadow trade"; then
        echo -e "${GREEN}[$TIMESTAMP] 👻${NC} $line"
    elif echo "$line" | grep -iq "new balances"; then
        echo -e "${CYAN}[$TIMESTAMP] 💰${NC} $line"
    elif echo "$line" | grep -iq "simulate buy"; then
        echo -e "${BLUE}[$TIMESTAMP] 📈${NC} $line"
    elif echo "$line" | grep -iq "simulate sell"; then
        echo -e "${YELLOW}[$TIMESTAMP] 📉${NC} $line"
    elif echo "$line" | grep -iq "undefined"; then
        echo -e "${RED}[$TIMESTAMP] ⚠️${NC} $line"
    else
        echo "[$TIMESTAMP] $line"
    fi
done
