#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Box drawing characters
TL="╔" TR="╗" BL="╚" BR="╝"
H="═" V="║"
HR="────────────────────────────────────────────────────────────"

clear

# Header
echo -e "${CYAN}${TL}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${TR}${NC}"
echo -e "${CYAN}${V}${NC}        ${BOLD}${WHITE}🤖 ALGOQBOT LIVE MONITORING DASHBOARD 🤖${NC}           ${CYAN}${V}${NC}"
echo -e "${CYAN}${BL}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${BR}${NC}"
echo ""

# Bot Status
echo -e "${BOLD}${CYAN}📊 BOT STATUS${NC}"
echo -e "${GRAY}${HR}${NC}"

STATUS=$(pm2 list | grep algoqbot | awk '{print $10}')
if [ "$STATUS" == "online" ]; then
  echo -e "  Status:    ${GREEN}✅ ONLINE${NC}"
else
  echo -e "  Status:    ${RED}❌ OFFLINE${NC}"
fi

UPTIME=$(pm2 info algoqbot 2>/dev/null | grep "uptime" | awk '{print $3, $4}')
echo -e "  Uptime:    ${CYAN}$UPTIME${NC}"

MEM=$(pm2 info algoqbot 2>/dev/null | grep "memory" | awk '{print $3, $4}')
echo -e "  Memory:    ${YELLOW}$MEM${NC}"

CPU=$(pm2 info algoqbot 2>/dev/null | grep "cpu" | awk '{print $3}')
echo -e "  CPU:       ${YELLOW}$CPU${NC}"

echo ""

# Market Status
echo -e "${BOLD}${MAGENTA}🌡️  MARKET STATUS${NC}"
echo -e "${GRAY}${HR}${NC}"

REGIME=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep -i "regime" | tail -1 | grep -o "VERY_LOW\|LOW\|MEDIUM\|HIGH\|VERY_HIGH" | head -1)
if [ -z "$REGIME" ]; then
  REGIME="Unknown"
  REGIME_COLOR="${GRAY}"
else
  case $REGIME in
    VERY_LOW) REGIME_COLOR="${BLUE}" ;;
    LOW) REGIME_COLOR="${CYAN}" ;;
    MEDIUM) REGIME_COLOR="${YELLOW}" ;;
    HIGH) REGIME_COLOR="${ORANGE}" ;;
    VERY_HIGH) REGIME_COLOR="${RED}" ;;
  esac
fi
echo -e "  Regime:        ${REGIME_COLOR}$REGIME${NC}"

VOLATILITY=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep "Volatility" | tail -1 | sed -n 's/.*\([0-9.]*%\).*/\1/p' | head -1)
if [ -z "$VOLATILITY" ]; then
  VOLATILITY="Unknown"
fi
echo -e "  Volatility:    ${CYAN}$VOLATILITY${NC}"

ACTION=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep "AI Strategy executed" | tail -1 | sed -n 's/.*Action: \([a-z]*\).*/\1/p')
CONFIDENCE=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep "Confidence:" | tail -1 | sed -n 's/.*Confidence: \([0-9.]*\).*/\1/p')

if [ ! -z "$ACTION" ]; then
  case $ACTION in
    buy) ACTION_COLOR="${GREEN}"; ACTION_ICON="📈" ;;
    sell) ACTION_COLOR="${RED}"; ACTION_ICON="📉" ;;
    hold) ACTION_COLOR="${YELLOW}"; ACTION_ICON="⏸️ " ;;
    *) ACTION_COLOR="${WHITE}"; ACTION_ICON="❓" ;;
  esac
  echo -e "  Action:        ${ACTION_COLOR}${ACTION_ICON} ${ACTION^^}${NC}"
  echo -e "  Confidence:    ${CYAN}${CONFIDENCE}%${NC}"
fi

TP=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep "Take Profit:" | tail -1 | sed -n 's/.*Take Profit: \([0-9.]*%\).*/\1/p')
SL=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep "Stop Loss:" | tail -1 | sed -n 's/.*Stop Loss: \([0-9.]*%\).*/\1/p')

if [ ! -z "$TP" ]; then
  echo -e "  Take Profit:   ${GREEN}$TP${NC}"
fi
if [ ! -z "$SL" ]; then
  echo -e "  Stop Loss:     ${RED}$SL${NC}"
fi

echo ""

# Shadow Mode Stats
echo -e "${BOLD}${BLUE}👻 SHADOW MODE STATS${NC}"
echo -e "${GRAY}${HR}${NC}"

if [ -f "data/shadow_trades.json" ]; then
  SHADOW_FILE="data/shadow_trades.json"
elif [ -f ".shadow-trades.json" ]; then
  SHADOW_FILE=".shadow-trades.json"
else
  SHADOW_FILE=""
fi

if [ ! -z "$SHADOW_FILE" ]; then
  FILE_SIZE=$(du -h "$SHADOW_FILE" | cut -f1)
  LAST_UPDATE=$(stat -f "%Sm" -t "%H:%M:%S" "$SHADOW_FILE" 2>/dev/null || stat -c "%y" "$SHADOW_FILE" 2>/dev/null | cut -d' ' -f2 | cut -d'.' -f1)
  TOTAL_TRADES=$(grep -c '"action"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")
  GRID_TRADES=$(grep -c '"strategy": *"grid"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")
  RANGING_TRADES=$(grep -c '"strategy": *"ranging"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")
  MOMENTUM_TRADES=$(grep -c '"strategy": *"momentum"' "$SHADOW_FILE" 2>/dev/null | tr -d '\n' || echo "0")

  echo -e "  File:          ${CYAN}$SHADOW_FILE${NC} (${YELLOW}$FILE_SIZE${NC})"
  echo -e "  Last Update:   ${CYAN}$LAST_UPDATE${NC}"
  echo -e "  Total Trades:  ${GREEN}$TOTAL_TRADES${NC}"
  echo -e "  Grid:          ${BLUE}$GRID_TRADES${NC}"
  echo -e "  Ranging:       ${MAGENTA}$RANGING_TRADES${NC}"
  echo -e "  Momentum:      ${YELLOW}$MOMENTUM_TRADES${NC}"
else
  echo -e "  ${GRAY}No shadow mode file found${NC}"
fi

echo ""

# Recent Activity
echo -e "${BOLD}${GREEN}📈 RECENT ACTIVITY (Last 5 decisions)${NC}"
echo -e "${GRAY}${HR}${NC}"

pm2 logs algoqbot --lines 200 --nostream 2>/dev/null | \
  grep -E "AI Strategy executed|Position.*entered|Position.*exited|Shadow Trade" | \
  tail -5 | \
  while read line; do
    if echo "$line" | grep -q "AI Strategy executed"; then
      echo -e "${CYAN}$line${NC}"
    elif echo "$line" | grep -q "entered"; then
      echo -e "${GREEN}$line${NC}"
    elif echo "$line" | grep -q "exited"; then
      echo -e "${MAGENTA}$line${NC}"
    elif echo "$line" | grep -q "Shadow"; then
      echo -e "${BLUE}$line${NC}"
    else
      echo -e "${WHITE}$line${NC}"
    fi
  done

echo -e "${GRAY}${HR}${NC}"
echo ""

# Errors
ERROR_COUNT=$(pm2 logs algoqbot --lines 100 --nostream --err 2>/dev/null | wc -l | tr -d ' ')
if [ "$ERROR_COUNT" -gt 5 ]; then
  echo -e "${RED}⚠️  ERRORS: $ERROR_COUNT in last 100 lines${NC}"
else
  echo -e "${GREEN}✅ No significant errors${NC}"
fi

echo ""

# Footer
echo -e "${CYAN}${TL}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${TR}${NC}"
echo -e "${CYAN}${V}${NC}  Last updated: ${WHITE}$(date '+%Y-%m-%d %H:%M:%S')${NC}                    ${CYAN}${V}${NC}"
echo -e "${CYAN}${V}${NC}  ${GRAY}Press Ctrl+C to exit${NC}                                      ${CYAN}${V}${NC}"
echo -e "${CYAN}${BL}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${H}${BR}${NC}"
