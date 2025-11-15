#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# algoQbot INSTITUTIONAL DASHBOARD
# 6-Indicator Professional System with Institutional Tools
# Updated: November 13, 2025
# ═══════════════════════════════════════════════════════════════

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear

LOGFILE="logs/combined-$(date +%Y-%m-%d).log"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}${BOLD}           🤖 algoQbot INSTITUTIONAL DASHBOARD${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Updated: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# [1] BOT STATUS
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}${BOLD}[1] BOT STATUS${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

if ps aux | grep "start-shadow-mode.js" | grep -v grep > /dev/null; then
    PID=$(ps aux | grep "start-shadow-mode.js" | grep -v grep | awk '{print $2}' | head -1)
    CPU=$(ps aux | grep "start-shadow-mode.js" | grep -v grep | awk '{print $3}' | head -1)
    MEM=$(ps aux | grep "start-shadow-mode.js" | grep -v grep | awk '{print $4}' | head -1)
    UPTIME=$(ps -p $PID -o etime= 2>/dev/null | xargs)
    echo -e "  Status:      ${GREEN}●${NC} ${GREEN}Running${NC}"
    echo -e "  PID:         ${BLUE}$PID${NC}"
    echo -e "  Uptime:      ${BLUE}$UPTIME${NC}"
    echo -e "  CPU:         ${BLUE}${CPU}%${NC}"
    echo -e "  Memory:      ${BLUE}${MEM}%${NC}"
else
    echo -e "  Status:      ${RED}●${NC} ${RED}Not Running${NC}"
    echo -e "  ${YELLOW}Start with: npm run start-shadow${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# [2] PORTFOLIO STATUS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}[2] PORTFOLIO STATUS${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

PORTFOLIO=$(grep "Portfolio value updated" "$LOGFILE" 2>/dev/null | tail -1 | sed 's/.*updated: //' | sed 's/ .*//')
DISTRIBUTION=$(tail -200 "$LOGFILE" 2>/dev/null | grep "PORTFOLIO CHECK DEBUG.*Percentages" | tail -1 | sed 's/.*Percentages: //' | sed 's/".*//')

if [ ! -z "$PORTFOLIO" ]; then
    echo -e "  Total Value: ${GREEN}$PORTFOLIO${NC}"
    [ ! -z "$DISTRIBUTION" ] && echo -e "  Balance:     ${BLUE}$DISTRIBUTION${NC}"
else
    echo -e "  ${YELLOW}No portfolio data available${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# [3] MARKET CONDITIONS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}[3] MARKET CONDITIONS${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

PRICE=$(tail -200 "$LOGFILE" 2>/dev/null | grep "Current Price:" | tail -1 | sed 's/.*Current Price: //' | sed 's/".*//')
VOL_4H=$(tail -200 "$LOGFILE" 2>/dev/null | grep "4h Volatility:" | tail -1 | sed 's/.*4h Volatility: //' | sed 's/".*//')
REGIME=$(tail -200 "$LOGFILE" 2>/dev/null | grep "REGIME.*Detected:" | tail -1 | sed 's/.*Detected: //' | sed 's/".*//')

if [ ! -z "$PRICE" ]; then
    echo -e "  Price:       ${BLUE}$PRICE BNB/USDT${NC}"
fi

if [ ! -z "$VOL_4H" ]; then
    echo -e "  Volatility:  ${BLUE}$VOL_4H${NC}"
fi

if [ ! -z "$REGIME" ]; then
    case "$REGIME" in
        "HIGH")
            echo -e "  Regime:      ${RED}$REGIME${NC} (High volatility)"
            ;;
        "MEDIUM")
            echo -e "  Regime:      ${YELLOW}$REGIME${NC} (Medium volatility)"
            ;;
        "LOW"|"VERY_LOW")
            echo -e "  Regime:      ${BLUE}$REGIME${NC} (Low volatility)"
            ;;
        *)
            echo -e "  Regime:      ${BLUE}$REGIME${NC}"
            ;;
    esac
fi

# ═══════════════════════════════════════════════════════════════
# [4] INSTITUTIONAL TOOLS (6-Indicator System)
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${MAGENTA}${BOLD}[4] INSTITUTIONAL TOOLS (6-Indicator System)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}  📊 INSTITUTIONAL TOOLS (56% total weight):${NC}"
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"

# Order Flow (20%)
ORDER_FLOW=$(grep "Order Flow" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$ORDER_FLOW" ]; then
    SCORE=$(echo "$ORDER_FLOW" | sed 's/.*Order Flow (20%): //' | sed 's/ |.*//')
    DELTA=$(echo "$ORDER_FLOW" | sed 's/.*Delta: //' | sed 's/".*//')
    TIMESTAMP=$(echo "$ORDER_FLOW" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
    echo -e "  ${BLUE}[1/6] Order Flow (20%):${NC}    $SCORE | Delta: $DELTA"
    echo -e "       ${BLUE}Last updated: $TIMESTAMP${NC}"
else
    echo -e "  ${YELLOW}[1/6] Order Flow:${NC}           Waiting for data..."
fi

# Volume Profile (18%)
VOL_PROF=$(grep "Volume Profile" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$VOL_PROF" ]; then
    SCORE=$(echo "$VOL_PROF" | sed 's/.*Volume Profile (18%): //' | sed 's/ |.*//')
    POC=$(echo "$VOL_PROF" | sed 's/.*POC: //' | sed 's/".*//')
    TIMESTAMP=$(echo "$VOL_PROF" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
    echo -e "  ${BLUE}[2/6] Volume Profile (18%):${NC} $SCORE | POC: $POC"
    echo -e "       ${BLUE}Last updated: $TIMESTAMP${NC}"
else
    echo -e "  ${YELLOW}[2/6] Volume Profile:${NC}       Waiting for data..."
fi

# Liquidity (18%)
LIQUIDITY=$(grep "Liquidity (18%)" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$LIQUIDITY" ]; then
    SCORE=$(echo "$LIQUIDITY" | sed 's/.*Liquidity (18%): //' | sed 's/ |.*//')
    RATIO=$(echo "$LIQUIDITY" | sed 's/.*Ratio: //' | sed 's/".*//')
    TIMESTAMP=$(echo "$LIQUIDITY" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
    echo -e "  ${BLUE}[3/6] Liquidity (18%):${NC}      $SCORE | Ratio: $RATIO"
    echo -e "       ${BLUE}Last updated: $TIMESTAMP${NC}"
else
    echo -e "  ${YELLOW}[3/6] Liquidity:${NC}            Waiting for data..."
fi

echo ""
echo -e "${CYAN}  📊 TECHNICAL TOOLS (44% total weight):${NC}"
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"

# VWAP (15%)
VWAP=$(grep "VWAP (15%)" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$VWAP" ]; then
    SCORE=$(echo "$VWAP" | sed 's/.*VWAP (15%): //' | sed 's/".*//')
    echo -e "  ${BLUE}[4/6] VWAP (15%):${NC}           $SCORE"
else
    echo -e "  ${YELLOW}[4/6] VWAP:${NC}                 Waiting for data..."
fi

# ATR (12%)
ATR=$(grep "ATR (12%)" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$ATR" ]; then
    SCORE=$(echo "$ATR" | sed 's/.*ATR (12%): //' | sed 's/".*//')
    echo -e "  ${BLUE}[5/6] ATR (12%):${NC}            $SCORE"
else
    echo -e "  ${YELLOW}[5/6] ATR:${NC}                  Waiting for data..."
fi

# Regime (9%)
REGIME_IND=$(grep "Regime (9%)" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$REGIME_IND" ]; then
    SCORE=$(echo "$REGIME_IND" | sed 's/.*Regime (9%): //' | sed 's/".*//')
    echo -e "  ${BLUE}[6/6] Regime (9%):${NC}          $SCORE"
else
    echo -e "  ${YELLOW}[6/6] Regime:${NC}               Waiting for data..."
fi

# Final Confidence
echo ""
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"
FINAL_CONF_LINE=$(grep "FINAL.*INSTITUTIONAL.*CONFIDENCE" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$FINAL_CONF_LINE" ]; then
    FINAL_CONF=$(echo "$FINAL_CONF_LINE" | sed 's/.*CONFIDENCE: //' | sed 's/".*//')
    TIMESTAMP=$(echo "$FINAL_CONF_LINE" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)

    # Parse confidence value
    CONF_VAL=$(echo "$FINAL_CONF" | tr -d '"%' | tr -d ',' | tr -d '"')

    # Color code based on value
    if (( $(echo "$CONF_VAL >= 70" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${GREEN}✅ FINAL INSTITUTIONAL CONFIDENCE: $FINAL_CONF${NC}"
    elif (( $(echo "$CONF_VAL >= 60" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${YELLOW}✅ FINAL INSTITUTIONAL CONFIDENCE: $FINAL_CONF${NC}"
    else
        echo -e "  ${BLUE}✅ FINAL INSTITUTIONAL CONFIDENCE: $FINAL_CONF${NC}"
    fi

    echo -e "       ${BLUE}Last calculated: $TIMESTAMP${NC}"

    # Show breakdown if available
    INST_CONTRIB=$(tail -500 "$LOGFILE" 2>/dev/null | grep "Institutional tools:" | tail -1 | sed 's/.*Institutional tools: //' | sed 's/ .*//')
    if [ ! -z "$INST_CONTRIB" ]; then
        echo -e "  ${CYAN}📊 Institutional contribution: $INST_CONTRIB${NC}"
    fi
else
    echo -e "  ${YELLOW}⏳ Waiting for confidence calculation...${NC}"
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

# ═══════════════════════════════════════════════════════════════
# [5] RECENT TRADING ACTIVITY
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}[5] RECENT TRADING ACTIVITY${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

TRADES_TODAY=$(grep "👻 Shadow Trade:" "$LOGFILE" 2>/dev/null | wc -l | xargs)
LAST_DECISION=$(tail -100 "$LOGFILE" 2>/dev/null | grep "Trading decision made" | tail -1)

echo -e "  Trades Today: ${BLUE}$TRADES_TODAY${NC}"

if [ ! -z "$LAST_DECISION" ]; then
    ACTION=$(echo "$LAST_DECISION" | grep -o '"action":"[^"]*"' | cut -d'"' -f4)
    CONFIDENCE=$(echo "$LAST_DECISION" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
    CONF_PERCENT=$(echo "$CONFIDENCE * 100" | bc | cut -d'.' -f1)

    case "$ACTION" in
        "buy")
            echo -e "  Last Decision: ${GREEN}BUY${NC} ($CONF_PERCENT%)"
            ;;
        "sell")
            echo -e "  Last Decision: ${RED}SELL${NC} ($CONF_PERCENT%)"
            ;;
        "hold")
            echo -e "  Last Decision: ${YELLOW}HOLD${NC} ($CONF_PERCENT%)"
            ;;
        *)
            echo -e "  Last Decision: ${BLUE}$ACTION${NC}"
            ;;
    esac
fi

# ═══════════════════════════════════════════════════════════════
# [6] LAST 3 TRADES
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}[6] LAST 3 TRADES${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

LAST_TRADES=$(grep "👻 Shadow Trade:" "$LOGFILE" 2>/dev/null | tail -3)
if [ ! -z "$LAST_TRADES" ]; then
    echo "$LAST_TRADES" | while read line; do
        TRADE=$(echo "$line" | sed 's/.*Shadow Trade: //' | sed 's/".*//')
        ACTION=$(echo "$TRADE" | grep -o 'buy\|sell\|HOLD' | head -1)
        case "$ACTION" in
            "buy"|"BUY")
                echo -e "  ${GREEN}$TRADE${NC}"
                ;;
            "sell"|"SELL")
                echo -e "  ${RED}$TRADE${NC}"
                ;;
            "HOLD")
                echo -e "  ${YELLOW}$TRADE${NC}"
                ;;
            *)
                echo -e "  ${BLUE}$TRADE${NC}"
                ;;
        esac
    done
else
    echo -e "  ${YELLOW}No trades yet${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# [7] ACTIVE POSITIONS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}[7] ACTIVE POSITIONS${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

ACTIVE_POS=$(tail -200 "$LOGFILE" 2>/dev/null | grep "activePositions size:" | tail -1 | sed 's/.*size: //' | sed 's/".*//')
if [ ! -z "$ACTIVE_POS" ]; then
    if [ "$ACTIVE_POS" = "0" ]; then
        echo -e "  Active: ${YELLOW}0${NC} (No open positions)"
    else
        echo -e "  Active: ${GREEN}$ACTIVE_POS${NC}"
    fi
else
    echo -e "  ${YELLOW}No position data${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# [8] RECENT ERRORS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}[8] RECENT ERRORS${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

ERRORS=$(tail -500 "$LOGFILE" 2>/dev/null | grep '"level":"error"' | grep -v "error handling" | tail -3)
if [ -z "$ERRORS" ]; then
    echo -e "  ${GREEN}✅ No errors${NC}"
else
    echo "$ERRORS" | sed 's/^/  /' | sed 's/{"level":"error"//' | head -3
fi

# ═══════════════════════════════════════════════════════════════
# FOOTER
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Dashboard: monitor-dashboard-institutional.sh${NC}"
echo -e "${BLUE}Refresh: watch -n 10 ./monitor-dashboard-institutional.sh${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
