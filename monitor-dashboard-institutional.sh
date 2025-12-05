#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# algoQbot INSTITUTIONAL DASHBOARD
# 6-Indicator Professional System with Institutional Tools
# Updated: December 4, 2025
# Auto-refresh: Every 30 seconds
# ═══════════════════════════════════════════════════════════════

# ✅ AUTO-REFRESH: Set refresh interval (30 seconds)
REFRESH_INTERVAL=30

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ✅ AUTO-REFRESH: Set refresh interval (30 seconds)
REFRESH_INTERVAL=30

# ✅ AUTO-REFRESH: Main loop - refresh every 30 seconds
while true; do
clear

# ✅ FIX: Check both log files - .log.1 (rotated) and .log (current)
# Use the numbered log file (.1 extension) which contains the actual runtime data
LOGFILE="logs/combined-$(date +%Y-%m-%d).log.1"
if [ ! -f "$LOGFILE" ] || [ ! -s "$LOGFILE" ]; then
  # Fallback to main log file if .1 doesn't exist or is empty
  LOGFILE="logs/combined-$(date +%Y-%m-%d).log"
fi

# ✅ ENHANCEMENT: If still no file, try to find the most recent log file
if [ ! -f "$LOGFILE" ]; then
  LOGFILE=$(ls -t logs/combined-*.log* 2>/dev/null | head -1)
  if [ -z "$LOGFILE" ]; then
    echo "⚠️  No log files found in logs/ directory"
    exit 1
  fi
fi

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

# Check for both start-shadow-mode.js AND start-with-web-interface.js
BOT_PROCESS=$(ps aux | grep -E "start-shadow-mode.js|start-with-web-interface.js" | grep -v grep | head -1)
if [ ! -z "$BOT_PROCESS" ]; then
    PID=$(echo "$BOT_PROCESS" | awk '{print $2}')
    CPU=$(echo "$BOT_PROCESS" | awk '{print $3}')
    MEM=$(echo "$BOT_PROCESS" | awk '{print $4}')
    UPTIME=$(ps -p $PID -o etime= 2>/dev/null | xargs)
    echo -e "  Status:      ${GREEN}●${NC} ${GREEN}Running${NC}"
    echo -e "  PID:         ${BLUE}$PID${NC}"
    echo -e "  Uptime:      ${BLUE}$UPTIME${NC}"
    echo -e "  CPU:         ${BLUE}${CPU}%${NC}"
    echo -e "  Memory:      ${BLUE}${MEM}%${NC}"
else
    echo -e "  Status:      ${RED}●${NC} ${RED}Not Running${NC}"
    echo -e "  ${YELLOW}Start with: npm run start-web${NC}"
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

# ✅ FIX: Read from monitoring-summary.json first (more reliable)
MONITORING_JSON="data/monitoring-summary.json"
if [ -f "$MONITORING_JSON" ]; then
    ORDER_FLOW_SCORE=$(jq -r '.institutionalIndicators.orderFlow.score // empty' "$MONITORING_JSON" 2>/dev/null)
    ORDER_FLOW_DELTA=$(jq -r '.institutionalIndicators.orderFlow.delta // empty' "$MONITORING_JSON" 2>/dev/null)
    
    if [ ! -z "$ORDER_FLOW_SCORE" ] && [ "$ORDER_FLOW_SCORE" != "null" ] && [ "$ORDER_FLOW_SCORE" != "" ]; then
        echo -e "  ${BLUE}[1/6] Order Flow (20%):${NC}    ${ORDER_FLOW_SCORE} | Delta: ${ORDER_FLOW_DELTA}%"
    else
        echo -e "  ${YELLOW}[1/6] Order Flow:${NC}           Waiting for data..."
    fi
else
    echo -e "  ${YELLOW}[1/6] Order Flow:${NC}           Waiting for data..."
fi

# ✅ FIX: Read from monitoring-summary.json
if [ -f "$MONITORING_JSON" ]; then
    VOL_PROF_SCORE=$(jq -r '.institutionalIndicators.volumeProfile.score // empty' "$MONITORING_JSON" 2>/dev/null)
    VOL_PROF_POC=$(jq -r '.institutionalIndicators.volumeProfile.poc // empty' "$MONITORING_JSON" 2>/dev/null)
    
    if [ ! -z "$VOL_PROF_SCORE" ] && [ "$VOL_PROF_SCORE" != "null" ] && [ "$VOL_PROF_SCORE" != "" ]; then
        echo -e "  ${BLUE}[2/6] Volume Profile (18%):${NC} ${VOL_PROF_SCORE} | POC: ${VOL_PROF_POC}"
    else
        echo -e "  ${YELLOW}[2/6] Volume Profile:${NC}       Waiting for data..."
    fi
else
    echo -e "  ${YELLOW}[2/6] Volume Profile:${NC}       Waiting for data..."
fi

# ✅ FIX: Read from monitoring-summary.json
if [ -f "$MONITORING_JSON" ]; then
    LIQUIDITY_SCORE=$(jq -r '.institutionalIndicators.liquidity.score // empty' "$MONITORING_JSON" 2>/dev/null)
    LIQUIDITY_RATIO=$(jq -r '.institutionalIndicators.liquidity.ratio // empty' "$MONITORING_JSON" 2>/dev/null)
    
    if [ ! -z "$LIQUIDITY_SCORE" ] && [ "$LIQUIDITY_SCORE" != "null" ] && [ "$LIQUIDITY_SCORE" != "" ]; then
        echo -e "  ${BLUE}[3/6] Liquidity (18%):${NC}      ${LIQUIDITY_SCORE} | Ratio: ${LIQUIDITY_RATIO}%"
    else
        echo -e "  ${YELLOW}[3/6] Liquidity:${NC}            Waiting for data..."
    fi
else
    echo -e "  ${YELLOW}[3/6] Liquidity:${NC}            Waiting for data..."
fi

echo ""
echo -e "${CYAN}  📊 TECHNICAL TOOLS (44% total weight):${NC}"
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"

# ✅ FIX: Read from monitoring-summary.json
if [ -f "$MONITORING_JSON" ]; then
    VWAP_SCORE=$(jq -r '.institutionalIndicators.vwap.score // empty' "$MONITORING_JSON" 2>/dev/null)
    if [ ! -z "$VWAP_SCORE" ] && [ "$VWAP_SCORE" != "null" ] && [ "$VWAP_SCORE" != "" ]; then
        echo -e "  ${BLUE}[4/6] VWAP (15%):${NC}           ${VWAP_SCORE}"
    else
        echo -e "  ${YELLOW}[4/6] VWAP:${NC}                 Waiting for data..."
    fi
    
    ATR_SCORE=$(jq -r '.institutionalIndicators.atr.score // empty' "$MONITORING_JSON" 2>/dev/null)
    if [ ! -z "$ATR_SCORE" ] && [ "$ATR_SCORE" != "null" ] && [ "$ATR_SCORE" != "" ]; then
        echo -e "  ${BLUE}[5/6] ATR (12%):${NC}            ${ATR_SCORE}"
    else
        echo -e "  ${YELLOW}[5/6] ATR:${NC}                  Waiting for data..."
    fi
    
    REGIME_SCORE=$(jq -r '.institutionalIndicators.regime.score // empty' "$MONITORING_JSON" 2>/dev/null)
    if [ ! -z "$REGIME_SCORE" ] && [ "$REGIME_SCORE" != "null" ] && [ "$REGIME_SCORE" != "" ]; then
        echo -e "  ${BLUE}[6/6] Regime (9%):${NC}          ${REGIME_SCORE}"
    else
        echo -e "  ${YELLOW}[6/6] Regime:${NC}               Waiting for data..."
    fi
else
    echo -e "  ${YELLOW}[4/6] VWAP:${NC}                 Waiting for data..."
    echo -e "  ${YELLOW}[5/6] ATR:${NC}                  Waiting for data..."
    echo -e "  ${YELLOW}[6/6] Regime:${NC}               Waiting for data..."
fi

# ✅ FIX: Final Confidence - Read from monitoring-summary.json
echo ""
echo -e "${CYAN}  ────────────────────────────────────────────────────────────${NC}"
if [ -f "$MONITORING_JSON" ]; then
    FINAL_CONF=$(jq -r '.institutionalIndicators.finalConfidence // empty' "$MONITORING_JSON" 2>/dev/null)
    CONF_VAL=$(echo "$FINAL_CONF" | grep -o '[0-9.]*' | head -1)
    
    if [ ! -z "$CONF_VAL" ] && [ "$CONF_VAL" != "null" ] && [ "$CONF_VAL" != "" ]; then
        CONF_PERCENT="${CONF_VAL}%"
        if (( $(echo "$CONF_VAL >= 70" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  ${GREEN}✅ FINAL INSTITUTIONAL CONFIDENCE: ${CONF_PERCENT}${NC}"
        elif (( $(echo "$CONF_VAL >= 60" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  ${YELLOW}✅ FINAL INSTITUTIONAL CONFIDENCE: ${CONF_PERCENT}${NC}"
        else
            echo -e "  ${BLUE}✅ FINAL INSTITUTIONAL CONFIDENCE: ${CONF_PERCENT}${NC}"
        fi
        
        # Show timestamp from JSON
        JSON_TIMESTAMP=$(jq -r '.timestamp // empty' "$MONITORING_JSON" 2>/dev/null)
        if [ ! -z "$JSON_TIMESTAMP" ] && [ "$JSON_TIMESTAMP" != "null" ]; then
            echo -e "       ${BLUE}Last updated: $JSON_TIMESTAMP${NC}"
        fi
    else
        echo -e "  ${YELLOW}⏳ Waiting for confidence calculation...${NC}"
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
echo -e "${GREEN}Auto-refreshing every ${REFRESH_INTERVAL} seconds...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

# ✅ AUTO-REFRESH: Wait 30 seconds before next refresh
sleep $REFRESH_INTERVAL
done
