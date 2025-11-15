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

# Use the numbered log file (.1 extension) which contains the actual runtime data
LOGFILE="logs/combined-$(date +%Y-%m-%d).log.1"

# Helper function to parse JSON log messages
parse_log_json() {
    local pattern="$1"
    local json_field="$2"

    if [ -f "$LOGFILE" ]; then
        grep "$pattern" "$LOGFILE" 2>/dev/null | tail -1 | jq -r ".${json_field}" 2>/dev/null
    fi
}

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

# Parse portfolio value from JSON logs
PORTFOLIO_MSG=$(grep "Total portfolio" "$LOGFILE" 2>/dev/null | tail -1 | jq -r '.message' 2>/dev/null)
BALANCE_MSG=$(grep "Portfolio balanced" "$LOGFILE" 2>/dev/null | tail -1 | jq -r '.message' 2>/dev/null)

if [ ! -z "$PORTFOLIO_MSG" ]; then
    # Extract total value (e.g., "$56657.15" from "Total portfolio: $33620.00 + $23037.15 = $56657.15")
    TOTAL_VALUE=$(echo "$PORTFOLIO_MSG" | grep -o '= \$[0-9.,]*' | sed 's/= //')
    if [ -z "$TOTAL_VALUE" ]; then
        # Try alternative format: "Total portfolio value: $56,698.08"
        TOTAL_VALUE=$(echo "$PORTFOLIO_MSG" | sed 's/.*value: //' | sed 's/ .*//')
    fi

    if [ ! -z "$TOTAL_VALUE" ]; then
        echo -e "  Total Value: ${GREEN}$TOTAL_VALUE${NC}"

        # Extract BNB info if available
        BNB_INFO=$(echo "$PORTFOLIO_MSG" | grep -o '([^)]* BNB @ [^)]*)')
        [ ! -z "$BNB_INFO" ] && echo -e "  Holdings:    ${BLUE}$BNB_INFO${NC}"
    else
        echo -e "  ${YELLOW}No portfolio total available${NC}"
    fi
else
    echo -e "  ${YELLOW}No portfolio data available${NC}"
fi

# Show balance status
if [ ! -z "$BALANCE_MSG" ]; then
    # Extract BNB percentage (e.g., "40.7% BNB (target 35-45%)")
    BNB_PERCENT=$(echo "$BALANCE_MSG" | grep -o '[0-9.]*% BNB' | sed 's/ BNB//')
    TARGET=$(echo "$BALANCE_MSG" | grep -o 'target [0-9-]*%' | sed 's/target //')

    if echo "$BALANCE_MSG" | grep -q "✅"; then
        echo -e "  BNB %:       ${GREEN}$BNB_PERCENT (target $TARGET) ✅${NC}"
    elif echo "$BALANCE_MSG" | grep -q "⚠️"; then
        echo -e "  BNB %:       ${YELLOW}$BNB_PERCENT (target $TARGET) ⚠️${NC}"
    else
        echo -e "  BNB %:       ${BLUE}$BNB_PERCENT (target $TARGET)${NC}"
    fi
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
ORDER_FLOW_LINE=$(grep "\[1/6\] Order Flow" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$ORDER_FLOW_LINE" ]; then
    ORDER_FLOW_MSG=$(echo "$ORDER_FLOW_LINE" | jq -r '.message' 2>/dev/null)
    TIMESTAMP=$(echo "$ORDER_FLOW_LINE" | jq -r '.timestamp' 2>/dev/null)
    SCORE=$(echo "$ORDER_FLOW_MSG" | sed 's/.*Order Flow (20%): //' | sed 's/ |.*//')
    DELTA=$(echo "$ORDER_FLOW_MSG" | sed 's/.*Delta: //')
    echo -e "  ${BLUE}[1/6] Order Flow (20%):${NC}    $SCORE | Delta: $DELTA"
    echo -e "       ${BLUE}Last updated: $TIMESTAMP${NC}"
else
    echo -e "  ${YELLOW}[1/6] Order Flow:${NC}           Waiting for data..."
fi

# Volume Profile (18%)
VOL_PROF_LINE=$(grep "\[2/6\] Volume Profile" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$VOL_PROF_LINE" ]; then
    VOL_PROF_MSG=$(echo "$VOL_PROF_LINE" | jq -r '.message' 2>/dev/null)
    TIMESTAMP=$(echo "$VOL_PROF_LINE" | jq -r '.timestamp' 2>/dev/null)
    SCORE=$(echo "$VOL_PROF_MSG" | sed 's/.*Volume Profile (18%): //' | sed 's/ |.*//')
    POC=$(echo "$VOL_PROF_MSG" | sed 's/.*POC: //')
    echo -e "  ${BLUE}[2/6] Volume Profile (18%):${NC} $SCORE | POC: $POC"
    echo -e "       ${BLUE}Last updated: $TIMESTAMP${NC}"
else
    echo -e "  ${YELLOW}[2/6] Volume Profile:${NC}       Waiting for data..."
fi

# Liquidity (18%)
LIQUIDITY_LINE=$(grep "\[3/6\] Liquidity" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$LIQUIDITY_LINE" ]; then
    LIQUIDITY_MSG=$(echo "$LIQUIDITY_LINE" | jq -r '.message' 2>/dev/null)
    TIMESTAMP=$(echo "$LIQUIDITY_LINE" | jq -r '.timestamp' 2>/dev/null)
    SCORE=$(echo "$LIQUIDITY_MSG" | sed 's/.*Liquidity (18%): //' | sed 's/ |.*//')
    RATIO=$(echo "$LIQUIDITY_MSG" | sed 's/.*Ratio: //')
    echo -e "  ${BLUE}[3/6] Liquidity (18%):${NC}      $SCORE | Ratio: $RATIO"
    echo -e "       ${BLUE}Last updated: $TIMESTAMP${NC}"
else
    echo -e "  ${YELLOW}[3/6] Liquidity:${NC}            Waiting for data..."
fi

echo ""
echo -e "${CYAN}  📊 TECHNICAL TOOLS (44% total weight):${NC}"
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"

# VWAP (15%)
VWAP_LINE=$(grep "\[4/6\] VWAP" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$VWAP_LINE" ]; then
    VWAP_MSG=$(echo "$VWAP_LINE" | jq -r '.message' 2>/dev/null)
    SCORE=$(echo "$VWAP_MSG" | sed 's/.*VWAP (15%): //')
    echo -e "  ${BLUE}[4/6] VWAP (15%):${NC}           $SCORE"
else
    echo -e "  ${YELLOW}[4/6] VWAP:${NC}                 Waiting for data..."
fi

# ATR (12%)
ATR_LINE=$(grep "\[5/6\] ATR" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$ATR_LINE" ]; then
    ATR_MSG=$(echo "$ATR_LINE" | jq -r '.message' 2>/dev/null)
    SCORE=$(echo "$ATR_MSG" | sed 's/.*ATR (12%): //')
    echo -e "  ${BLUE}[5/6] ATR (12%):${NC}            $SCORE"
else
    echo -e "  ${YELLOW}[5/6] ATR:${NC}                  Waiting for data..."
fi

# Regime (9%)
REGIME_IND_LINE=$(grep "\[6/6\] Regime" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$REGIME_IND_LINE" ]; then
    REGIME_IND_MSG=$(echo "$REGIME_IND_LINE" | jq -r '.message' 2>/dev/null)
    SCORE=$(echo "$REGIME_IND_MSG" | sed 's/.*Regime (9%): //')
    echo -e "  ${BLUE}[6/6] Regime (9%):${NC}          $SCORE"
else
    echo -e "  ${YELLOW}[6/6] Regime:${NC}               Waiting for data..."
fi

# Final Confidence
echo ""
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"
FINAL_CONF_LINE=$(grep "FINAL.*INSTITUTIONAL.*CONFIDENCE" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$FINAL_CONF_LINE" ]; then
    FINAL_CONF_MSG=$(echo "$FINAL_CONF_LINE" | jq -r '.message' 2>/dev/null)
    TIMESTAMP=$(echo "$FINAL_CONF_LINE" | jq -r '.timestamp' 2>/dev/null)
    FINAL_CONF=$(echo "$FINAL_CONF_MSG" | sed 's/.*CONFIDENCE: //')

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
    INST_CONTRIB_LINE=$(grep "Institutional tools:" "$LOGFILE" 2>/dev/null | tail -1)
    if [ ! -z "$INST_CONTRIB_LINE" ]; then
        INST_CONTRIB_MSG=$(echo "$INST_CONTRIB_LINE" | jq -r '.message' 2>/dev/null)
        INST_CONTRIB=$(echo "$INST_CONTRIB_MSG" | sed 's/.*Institutional tools: //' | sed 's/ .*//')
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

# Parse position monitoring data from JSON logs
POS_LINE=$(grep "Monitoring.*active position" "$LOGFILE" 2>/dev/null | tail -1)
if [ ! -z "$POS_LINE" ]; then
    POS_MSG=$(echo "$POS_LINE" | jq -r '.message' 2>/dev/null)

    # Extract total, virtual, and live counts (e.g., "📊 Monitoring 6 active position(s): 2 virtual, 4 live")
    TOTAL=$(echo "$POS_MSG" | grep -o '[0-9]* active position' | grep -o '[0-9]*')
    VIRTUAL=$(echo "$POS_MSG" | grep -o '[0-9]* virtual' | grep -o '[0-9]*')
    LIVE=$(echo "$POS_MSG" | grep -o '[0-9]* live' | grep -o '[0-9]*')

    if [ "$TOTAL" = "0" ] || [ -z "$TOTAL" ]; then
        echo -e "  Total Active: ${YELLOW}0${NC} (No open positions)"
    else
        echo -e "  Total Active: ${GREEN}$TOTAL${NC}"
        [ ! -z "$VIRTUAL" ] && echo -e "  Virtual:      ${BLUE}$VIRTUAL${NC}"
        [ ! -z "$LIVE" ] && echo -e "  Live:         ${BLUE}$LIVE${NC}"
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
