#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}         ${YELLOW}🎯 ALGOQBOT EXIT MONITOR${NC}                         ${CYAN}║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Bot Status
echo -e "${BLUE}📊 BOT STATUS:${NC}"
pm2 status algoqbot 2>/dev/null | grep algoqbot || echo -e "${RED}Bot not running${NC}"
echo ""

# Recent Activity
echo -e "${BLUE}💰 RECENT ACTIVITY (Last 20 lines):${NC}"
pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | \
  grep -E "SHADOW EXIT|Position.*exited|BUY|SELL|HOLD|Profit:" | \
  tail -20 | \
  while read line; do
    if echo "$line" | grep -q "✅"; then
      echo -e "${GREEN}$line${NC}"
    elif echo "$line" | grep -q "❌"; then
      echo -e "${RED}$line${NC}"
    elif echo "$line" | grep -qi "hold"; then
      echo -e "${YELLOW}$line${NC}"
    else
      echo "$line"
    fi
  done
echo ""

# Shadow Mode Statistics
echo -e "${BLUE}📈 SHADOW MODE STATISTICS:${NC}"
if [ -f ./data/shadow_trades.json ]; then
  SHADOW_FILE="./data/shadow_trades.json"
elif [ -f ./.shadow-trades.json ]; then
  SHADOW_FILE="./.shadow-trades.json"
else
  SHADOW_FILE=""
fi

if [ ! -z "$SHADOW_FILE" ]; then
  TOTAL=$(grep -c '"action"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")
  EXITS=$(grep -c '"reasoning": *"Exit' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")
  BUY=$(grep -c '"action": *"buy"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")
  SELL=$(grep -c '"action": *"sell"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")

  echo -e "  File: ${CYAN}$SHADOW_FILE${NC}"
  echo -e "  Total Trades: ${YELLOW}$TOTAL${NC}"
  echo -e "  Buy Actions: ${GREEN}$BUY${NC}"
  echo -e "  Sell Actions: ${RED}$SELL${NC}"
  echo -e "  Exit Signals: ${BLUE}$EXITS${NC}"

  if [ "$EXITS" -gt 0 ]; then
    echo ""
    echo -e "${BLUE}📋 LAST 5 EXIT SIGNALS:${NC}"
    grep -B 2 -A 5 '"reasoning":.*Exit' "$SHADOW_FILE" 2>/dev/null | \
      grep -E "action|reasoning|strategy|amount|timestamp" | \
      tail -25
  fi
else
  echo -e "${YELLOW}  No shadow trades file found yet${NC}"
  echo -e "${YELLOW}  (Will be created after first exit)${NC}"
fi

echo ""
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "⏰ Last updated: ${YELLOW}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo ""
echo -e "${YELLOW}Refreshing every 10 seconds... Press Ctrl+C to stop${NC}"
