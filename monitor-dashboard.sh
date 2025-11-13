#!/bin/bash

# ════════════════════════════════════════════════════════════════
# BSC TRADING BOT - LIVE MONITORING DASHBOARD
# Updates every 30 seconds with color-coded information
# 4-Strategy System: gridTrading, momentum, mean_reversion, arbitrage
# 8-Indicator Professional Confidence Scoring
# ════════════════════════════════════════════════════════════════

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Log file location - try multiple possible locations
# Priority: dated combined logs > simple combined > other logs
TODAY=$(date +%Y-%m-%d)

if [ -f "logs/combined-$TODAY.log" ]; then
    LOG_FILE="logs/combined-$TODAY.log"
elif [ -f "logs/combined.log" ]; then
    LOG_FILE="logs/combined.log"
elif [ -f "logs/combined-2025-10-22.log" ]; then
    LOG_FILE="logs/combined-2025-10-22.log"
elif [ -f "/tmp/bot-portfolio-fix.log" ]; then
    LOG_FILE="/tmp/bot-portfolio-fix.log"
elif [ -f "bot-getprice-fix.log" ]; then
    LOG_FILE="bot-getprice-fix.log"
elif [ -f "bot-fresh-start.log" ]; then
    LOG_FILE="bot-fresh-start.log"
elif [ -f "bot-multiplier-fix.log" ]; then
    LOG_FILE="bot-multiplier-fix.log"
elif [ -f "bot-clean-start.log" ]; then
    LOG_FILE="bot-clean-start.log"
elif [ -f "bot-bnb-calc-fix.log" ]; then
    LOG_FILE="bot-bnb-calc-fix.log"
else
    # Find most recent combined or log file
    LOG_FILE=$(find logs -maxdepth 1 -name "combined-*.log" -type f ! -name "*.gz" 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
    if [ -z "$LOG_FILE" ]; then
        LOG_FILE=$(find . -maxdepth 2 -name "*.log" -type f ! -name "*.gz" 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
    fi
fi

# Function to get bot PID
get_bot_pid() {
    pgrep -f "node.*AdvancedTradingBot" | head -1
}

# Function to format large numbers
format_number() {
    printf "%'d" "$1" 2>/dev/null || echo "$1"
}

# Function to calculate uptime
get_uptime() {
    local pid=$1
    if [ -z "$pid" ]; then
        echo "Not running"
        return
    fi

    # Get process start time (seconds since epoch)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        local start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | xargs -I {} date -j -f "%a %b %d %T %Y" "{}" "+%s" 2>/dev/null)
        local current_time=$(date +%s)
    else
        # Linux
        local start_time=$(ps -p "$pid" -o etimes= 2>/dev/null)
        local current_time=0
    fi

    if [ -z "$start_time" ]; then
        echo "Unknown"
        return
    fi

    local uptime_seconds=$((current_time - start_time))
    if [ "$uptime_seconds" -lt 0 ]; then
        uptime_seconds=$(ps -p "$pid" -o etimes= 2>/dev/null | tr -d ' ')
    fi

    local days=$((uptime_seconds / 86400))
    local hours=$(((uptime_seconds % 86400) / 3600))
    local minutes=$(((uptime_seconds % 3600) / 60))

    if [ "$days" -gt 0 ]; then
        echo "${days}d ${hours}h ${minutes}m"
    elif [ "$hours" -gt 0 ]; then
        echo "${hours}h ${minutes}m"
    else
        echo "${minutes}m"
    fi
}

# Function to display dashboard
show_dashboard() {
    clear

    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}          BSC TRADING BOT - LIVE MONITORING DASHBOARD${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 1. BOT STATUS
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[1] BOT STATUS${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    BOT_PID=$(get_bot_pid)

    if [ -n "$BOT_PID" ]; then
        echo -e "  Status:      ${GREEN}●${NC} ${GREEN}Running${NC}"
        echo -e "  PID:         ${BLUE}$BOT_PID${NC}"

        UPTIME=$(get_uptime "$BOT_PID")
        echo -e "  Uptime:      ${BLUE}$UPTIME${NC}"

        # Get memory usage (in KB)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            MEM_KB=$(ps -p "$BOT_PID" -o rss= 2>/dev/null | tr -d ' ')
        else
            MEM_KB=$(ps -p "$BOT_PID" -o rss= 2>/dev/null | tr -d ' ')
        fi

        if [ -n "$MEM_KB" ]; then
            MEM_MB=$((MEM_KB / 1024))
            echo -e "  Memory:      ${BLUE}${MEM_MB} MB${NC}"
        fi

        # Get CPU usage
        CPU=$(ps -p "$BOT_PID" -o %cpu= 2>/dev/null | tr -d ' ')
        if [ -n "$CPU" ]; then
            echo -e "  CPU:         ${BLUE}${CPU}%${NC}"
        fi
    else
        echo -e "  Status:      ${RED}●${NC} ${RED}Not Running${NC}"
        echo -e "  ${YELLOW}⚠️  Bot is not currently running${NC}"
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 2. MARKET REGIME
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[2] MARKET REGIME${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # Get latest regime info
        REGIME=$(tail -500 "$LOG_FILE" | grep -i "\[REGIME\] Detected:" | tail -1 | sed 's/.*Detected: //' | awk '{print $1}')
        REGIME_DESC=$(tail -500 "$LOG_FILE" | grep -i "\[REGIME\] Description:" | tail -1 | sed 's/.*Description: //')
        VOLATILITY=$(tail -500 "$LOG_FILE" | grep -i "\[REGIME\] 4h Volatility:" | tail -1 | sed 's/.*Volatility: //')
        STRATEGY=$(tail -500 "$LOG_FILE" | grep -i "\[REGIME\] Selected strategy:" | tail -1 | sed 's/.*strategy: //')
        CURRENT_PRICE=$(tail -500 "$LOG_FILE" | grep -i "Current Price:" | tail -1 | sed 's/.*Current Price: //' | awk '{print $1}')

        if [ -n "$REGIME" ]; then
            case "$REGIME" in
                "HIGH")
                    echo -e "  Regime:      ${RED}${BOLD}$REGIME${NC} 🔴"
                    ;;
                "MEDIUM")
                    echo -e "  Regime:      ${YELLOW}${BOLD}$REGIME${NC} 🟡"
                    ;;
                "LOW")
                    echo -e "  Regime:      ${BLUE}${BOLD}$REGIME${NC} 🔵"
                    ;;
                "VERY_LOW")
                    echo -e "  Regime:      ${BLUE}$REGIME${NC} ⚪"
                    ;;
                *)
                    echo -e "  Regime:      ${BLUE}$REGIME${NC}"
                    ;;
            esac

            [ -n "$REGIME_DESC" ] && echo -e "  Description: ${BLUE}$REGIME_DESC${NC}"
            [ -n "$VOLATILITY" ] && echo -e "  Volatility:  ${BLUE}$VOLATILITY${NC}"
            [ -n "$STRATEGY" ] && echo -e "  Strategy:    ${GREEN}$STRATEGY${NC}"
            [ -n "$CURRENT_PRICE" ] && echo -e "  Price:       ${BLUE}\$$CURRENT_PRICE${NC}"
        else
            echo -e "  ${YELLOW}No regime data available${NC}"
        fi
    else
        echo -e "  ${RED}Log file not found${NC}"
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 3. PORTFOLIO STATUS
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[3] PORTFOLIO STATUS${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # Get latest portfolio info
        # ✅ FIX: Get USDT and BNB separately, then calculate total
        USDT_BALANCE=$(tail -500 "$LOG_FILE" | grep -i "Shadow mode balances:" | tail -1 | sed 's/.*balances: \([0-9.]*\) USDT.*/\1/' | tr -d '[:space:]')
        BNB_BALANCE=$(tail -500 "$LOG_FILE" | grep -i "Shadow mode balances:" | tail -1 | sed 's/.*USDT, \([0-9.]*\) BNB.*/\1/' | tr -d '[:space:]')
        BNB_PRICE=$(tail -500 "$LOG_FILE" | grep -i "Shadow mode balances:" | tail -1 | sed 's/.*@ \([0-9.]*\).*/\1/' | tr -d '[:space:]')

        # Validate all values are numbers
        if [ -z "$USDT_BALANCE" ] || [ "$USDT_BALANCE" = "" ]; then USDT_BALANCE=0; fi
        if [ -z "$BNB_BALANCE" ] || [ "$BNB_BALANCE" = "" ]; then BNB_BALANCE=0; fi
        if [ -z "$BNB_PRICE" ] || [ "$BNB_PRICE" = "" ]; then BNB_PRICE=0; fi

        # ✅ FIX: Calculate total portfolio value correctly
        # Total = USDT + (BNB × Price)
        if [ -n "$USDT_BALANCE" ] && [ -n "$BNB_BALANCE" ] && [ -n "$BNB_PRICE" ]; then
            BNB_VALUE=$(echo "scale=2; $BNB_BALANCE * $BNB_PRICE" | bc 2>/dev/null || echo "0")
            PORTFOLIO_VALUE=$(echo "scale=2; $USDT_BALANCE + $BNB_VALUE" | bc 2>/dev/null || echo "0")

            if [ -n "$PORTFOLIO_VALUE" ] && [ "$PORTFOLIO_VALUE" != "0" ]; then
                # ✅ FIX: Calculate percentages correctly
                USDT_PERCENT=$(echo "scale=1; ($USDT_BALANCE * 100) / $PORTFOLIO_VALUE" | bc 2>/dev/null || echo "60")
                BNB_PERCENT=$(echo "scale=1; ($BNB_VALUE * 100) / $PORTFOLIO_VALUE" | bc 2>/dev/null || echo "40")

                echo -e "  Total Value: ${GREEN}${BOLD}\$$(printf "%.2f" "$PORTFOLIO_VALUE")${NC}"
                echo -e "  USDT:        ${BLUE}\$$(printf "%.2f" "$USDT_BALANCE")${NC} (${BLUE}${USDT_PERCENT}%${NC})"
                echo -e "  BNB:         ${BLUE}$(printf "%.6f" "$BNB_BALANCE")${NC} (${BLUE}${BNB_PERCENT}%${NC})"

                # Balance check (target 35-45%)
                if (( $(echo "$BNB_PERCENT >= 35" | bc -l 2>/dev/null || echo "0") )) && (( $(echo "$BNB_PERCENT <= 45" | bc -l 2>/dev/null || echo "0") )); then
                    echo -e "  Balance:     ${GREEN}✅ Optimal${NC} (target 35-45%)"
                else
                    if (( $(echo "$BNB_PERCENT > 45" | bc -l 2>/dev/null || echo "0") )); then
                        echo -e "  Balance:     ${YELLOW}⚠️  BNB High${NC} (${BNB_PERCENT}% > 45%)"
                    else
                        echo -e "  Balance:     ${YELLOW}⚠️  BNB Low${NC} (${BNB_PERCENT}% < 35%)"
                    fi
                fi
            else
                echo -e "  ${YELLOW}No portfolio data available${NC}"
            fi
        else
            echo -e "  ${YELLOW}No portfolio data available${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 4. ACTIVE POSITIONS
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[4] ACTIVE POSITIONS${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # Count active positions
        ACTIVE_COUNT=$(tail -1000 "$LOG_FILE" | grep -c "Position opened:" 2>/dev/null | tr -d '[:space:]')
        REMOVED_COUNT=$(tail -1000 "$LOG_FILE" | grep -c "Position removed:" 2>/dev/null | tr -d '[:space:]')

        # Ensure variables are valid integers
        [ -z "$ACTIVE_COUNT" ] && ACTIVE_COUNT=0
        [ -z "$REMOVED_COUNT" ] && REMOVED_COUNT=0

        CURRENT_ACTIVE=$((ACTIVE_COUNT - REMOVED_COUNT))

        if [ "$CURRENT_ACTIVE" -lt 0 ]; then
            CURRENT_ACTIVE=0
        fi

        echo -e "  Active:      ${GREEN}$CURRENT_ACTIVE${NC}"

        # Show last 3 positions
        echo -e "\n  ${CYAN}Recent Positions:${NC}"

        POSITIONS=$(tail -1000 "$LOG_FILE" | grep "Position opened:" | tail -3)

        if [ -n "$POSITIONS" ]; then
            echo "$POSITIONS" | while IFS= read -r line; do
                POS_ID=$(echo "$line" | sed 's/.*Position opened: \([^ ]*\).*/\1/')
                POS_ACTION=$(echo "$line" | grep -o "action=[^,]*" | cut -d= -f2)
                POS_SIZE=$(echo "$line" | grep -o "size=[^,]*" | cut -d= -f2)
                POS_ENTRY=$(echo "$line" | grep -o "entry=[^,]*" | cut -d= -f2)

                if [ -n "$POS_ID" ]; then
                    ACTION_COLOR="$BLUE"
                    [ "$POS_ACTION" = "buy" ] && ACTION_COLOR="$GREEN"
                    [ "$POS_ACTION" = "sell" ] && ACTION_COLOR="$RED"

                    echo -e "    ${ACTION_COLOR}${POS_ACTION^^}${NC} \$$POS_SIZE @ \$$POS_ENTRY"
                fi
            done
        else
            echo -e "    ${YELLOW}No recent positions${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 5. TRADING STATISTICS
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[5] TRADING STATISTICS${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # ✅ FIX: Strip whitespace and validate integers
        TOTAL_POSITIONS=$(tail -2000 "$LOG_FILE" | grep -c "Position opened:" 2>/dev/null | tr -d '[:space:]')
        TP_EXITS=$(tail -2000 "$LOG_FILE" | grep -c "TP hit" 2>/dev/null | tr -d '[:space:]')
        SL_EXITS=$(tail -2000 "$LOG_FILE" | grep -c "SL hit" 2>/dev/null | tr -d '[:space:]')

        # Ensure variables are valid integers
        [ -z "$TOTAL_POSITIONS" ] && TOTAL_POSITIONS=0
        [ -z "$TP_EXITS" ] && TP_EXITS=0
        [ -z "$SL_EXITS" ] && SL_EXITS=0

        echo -e "  Total Positions: ${BLUE}$TOTAL_POSITIONS${NC}"
        echo -e "  TP Exits:        ${GREEN}$TP_EXITS${NC}"
        echo -e "  SL Exits:        ${RED}$SL_EXITS${NC}"

        # Calculate win rate
        if [ "$TOTAL_POSITIONS" -gt 0 ] 2>/dev/null; then
            WIN_RATE=$(echo "scale=1; ($TP_EXITS * 100) / $TOTAL_POSITIONS" | bc 2>/dev/null || echo "0")

            if (( $(echo "$WIN_RATE >= 60" | bc -l) )); then
                echo -e "  Win Rate:        ${GREEN}${WIN_RATE}%${NC}"
            elif (( $(echo "$WIN_RATE >= 40" | bc -l) )); then
                echo -e "  Win Rate:        ${YELLOW}${WIN_RATE}%${NC}"
            else
                echo -e "  Win Rate:        ${RED}${WIN_RATE}%${NC}"
            fi
        else
            echo -e "  Win Rate:        ${YELLOW}N/A${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 6. RECENT ERRORS
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[6] RECENT ERRORS${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # ✅ FIX: Only count ACTUAL error-level log entries, not JSON fields
        # Winston JSON format uses "level":"error" for actual errors
        ERROR_COUNT=$(tail -1000 "$LOG_FILE" | grep -c '"level":"error"' 2>/dev/null | tr -d '[:space:]')

        # Ensure variable is a valid integer
        [ -z "$ERROR_COUNT" ] && ERROR_COUNT=0

        if [ "$ERROR_COUNT" -gt 0 ] 2>/dev/null; then
            echo -e "  Error Count:     ${RED}$ERROR_COUNT${NC} (last 1000 lines)"
            echo -e "\n  ${CYAN}Last 2 Errors:${NC}"

            tail -1000 "$LOG_FILE" | grep '"level":"error"' | tail -2 | while IFS= read -r line; do
                # Extract message field from JSON
                ERROR_MSG=$(echo "$line" | grep -o '"message":"[^"]*"' | sed 's/"message":"//' | sed 's/"$//' | cut -c1-60)
                if [ -z "$ERROR_MSG" ]; then
                    ERROR_MSG=$(echo "$line" | cut -c1-60)
                fi
                echo -e "    ${RED}●${NC} $ERROR_MSG"
            done
        else
            echo -e "  ${GREEN}✅ No errors found${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 7. LAST TRADING DECISION
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[7] LAST TRADING DECISION${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        LAST_ACTION=$(tail -500 "$LOG_FILE" | grep -i "Trading decision made:" | tail -1 | grep -o "action=[^,]*" | cut -d= -f2 | tr -d '"')
        LAST_STRATEGY=$(tail -500 "$LOG_FILE" | grep -i "Trading decision made:" | tail -1 | grep -o "strategy=[^,]*" | cut -d= -f2 | tr -d '"')
        LAST_CONFIDENCE=$(tail -500 "$LOG_FILE" | grep -i "Trading decision made:" | tail -1 | grep -o "confidence=[^,]*" | cut -d= -f2 | tr -d '"')
        LAST_REASONING=$(tail -500 "$LOG_FILE" | grep -i "Trading decision made:" | tail -1 | grep -o "reasoning=[^}]*" | cut -d= -f2 | tr -d '"' | cut -c1-50)

        if [ -n "$LAST_ACTION" ]; then
            case "$LAST_ACTION" in
                "buy")
                    echo -e "  Action:      ${GREEN}${BOLD}BUY${NC}"
                    ;;
                "sell")
                    echo -e "  Action:      ${RED}${BOLD}SELL${NC}"
                    ;;
                "hold")
                    echo -e "  Action:      ${YELLOW}${BOLD}HOLD${NC}"
                    ;;
                *)
                    echo -e "  Action:      ${BLUE}$LAST_ACTION${NC}"
                    ;;
            esac

            [ -n "$LAST_STRATEGY" ] && echo -e "  Strategy:    ${BLUE}$LAST_STRATEGY${NC}"

            if [ -n "$LAST_CONFIDENCE" ]; then
                CONF_PERCENT=$(echo "scale=0; $LAST_CONFIDENCE * 100" | bc 2>/dev/null || echo "0")

                if [ "$CONF_PERCENT" -ge 70 ]; then
                    echo -e "  Confidence:  ${GREEN}${CONF_PERCENT}%${NC}"
                elif [ "$CONF_PERCENT" -ge 50 ]; then
                    echo -e "  Confidence:  ${YELLOW}${CONF_PERCENT}%${NC}"
                else
                    echo -e "  Confidence:  ${RED}${CONF_PERCENT}%${NC}"
                fi
            fi

            [ -n "$LAST_REASONING" ] && echo -e "  Reasoning:   ${BLUE}$LAST_REASONING...${NC}"
        else
            echo -e "  ${YELLOW}No recent trading decisions${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 8. OPEN POSITIONS DETAIL
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[8] OPEN POSITIONS DETAIL${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # Get positions being monitored
        OPEN_POS_COUNT=$(tail -1000 "$LOG_FILE" | grep "Monitoring position" | tail -5 | wc -l | tr -d '[:space:]')

        if [ -n "$OPEN_POS_COUNT" ] && [ "$OPEN_POS_COUNT" -gt 0 ] 2>/dev/null; then
            echo -e "  ${CYAN}Active Positions: ${GREEN}$OPEN_POS_COUNT${NC}\n"

            tail -1000 "$LOG_FILE" | grep "Monitoring position" | tail -5 | while IFS= read -r line; do
                POS_ID=$(echo "$line" | grep -o 'pos_[^,]*' | cut -c1-20)
                POS_SIDE=$(echo "$line" | grep -o 'side: [^,]*' | cut -d: -f2 | tr -d ' ')
                ENTRY_PRICE=$(echo "$line" | grep -o 'entry: [0-9.]*' | cut -d: -f2)
                CURRENT_PRICE=$(echo "$line" | grep -o 'current: [0-9.]*' | cut -d: -f2)

                if [ -n "$POS_ID" ]; then
                    if [ "$POS_SIDE" = "buy" ]; then
                        echo -e "  ${POS_ID} │ ${GREEN}BUY${NC}  │ Entry: \$${ENTRY_PRICE} │ Now: \$${CURRENT_PRICE}"
                    else
                        echo -e "  ${POS_ID} │ ${RED}SELL${NC} │ Entry: \$${ENTRY_PRICE} │ Now: \$${CURRENT_PRICE}"
                    fi
                fi
            done
        else
            echo -e "  ${YELLOW}No open positions currently${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 9. RECENT TRADE HISTORY
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[9] RECENT TRADE HISTORY${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        TP_TRADES=$(tail -2000 "$LOG_FILE" | grep -E "TP hit|Take profit" | tail -5 | wc -l | tr -d '[:space:]')
        SL_TRADES=$(tail -2000 "$LOG_FILE" | grep -E "SL hit|Stop loss" | tail -5 | wc -l | tr -d '[:space:]')

        TOTAL_TRADES=$((TP_TRADES + SL_TRADES))

        if [ "$TOTAL_TRADES" -gt 0 ] 2>/dev/null; then
            echo -e "  ${CYAN}Last 5 Closed Trades:${NC}\n"

            tail -2000 "$LOG_FILE" | grep -E "TP hit|SL hit" | tail -5 | while IFS= read -r line; do
                TIMESTAMP=$(echo "$line" | cut -d' ' -f1-2)
                if echo "$line" | grep -q "TP hit"; then
                    echo -e "  ${TIMESTAMP} │ ${GREEN}✅ TP hit${NC}"
                else
                    echo -e "  ${TIMESTAMP} │ ${RED}❌ SL hit${NC}"
                fi
            done
        else
            echo -e "  ${YELLOW}No closed trades yet${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 10. PERFORMANCE SUMMARY
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[10] PERFORMANCE SUMMARY${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        TP_COUNT=$(tail -2000 "$LOG_FILE" | grep -c "TP hit" 2>/dev/null | tr -d '[:space:]')
        SL_COUNT=$(tail -2000 "$LOG_FILE" | grep -c "SL hit" 2>/dev/null | tr -d '[:space:]')

        [ -z "$TP_COUNT" ] && TP_COUNT=0
        [ -z "$SL_COUNT" ] && SL_COUNT=0

        TOTAL_CLOSED=$((TP_COUNT + SL_COUNT))

        if [ "$TOTAL_CLOSED" -gt 0 ] 2>/dev/null; then
            WIN_RATE=$(echo "scale=1; ($TP_COUNT * 100) / $TOTAL_CLOSED" | bc 2>/dev/null || echo "0")

            echo -e "  Total Closed:    ${BLUE}$TOTAL_CLOSED${NC}"
            echo -e "  Wins (TP):       ${GREEN}$TP_COUNT${NC}"
            echo -e "  Losses (SL):     ${RED}$SL_COUNT${NC}"

            if (( $(echo "$WIN_RATE >= 60" | bc -l 2>/dev/null || echo "0") )); then
                echo -e "  Win Rate:        ${GREEN}${WIN_RATE}% 🔥${NC}"
            elif (( $(echo "$WIN_RATE >= 40" | bc -l 2>/dev/null || echo "0") )); then
                echo -e "  Win Rate:        ${YELLOW}${WIN_RATE}%${NC}"
            else
                echo -e "  Win Rate:        ${RED}${WIN_RATE}%${NC}"
            fi

            if [ "$TP_COUNT" -gt "$SL_COUNT" ]; then
                STREAK="$TP_COUNT wins"
                echo -e "  Current Streak:  ${GREEN}$STREAK ✅${NC}"
            else
                STREAK="$SL_COUNT losses"
                echo -e "  Current Streak:  ${RED}$STREAK${NC}"
            fi
        else
            echo -e "  ${YELLOW}No closed trades yet - collecting data...${NC}"
        fi
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 11. LIVE LOG STREAM
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[11] LIVE LOG STREAM${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        echo -e "  ${CYAN}Recent Activity:${NC}\n"

        tail -20 "$LOG_FILE" | grep -E "Trading decision|Position tracked|TP hit|SL hit|Shadow Trade|Portfolio value" | tail -8 | while IFS= read -r line; do
            TIMESTAMP=$(echo "$line" | awk '{print $1}')
            LEVEL=$(echo "$line" | grep -o '\[.*\]' | head -1 | tr -d '[]')
            MESSAGE=$(echo "$line" | sed 's/^[^]]*]//' | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-70)

            case "$LEVEL" in
                *error*)
                    echo -e "  ${TIMESTAMP} ${RED}[ERROR]${NC} ${MESSAGE}"
                    ;;
                *warn*)
                    echo -e "  ${TIMESTAMP} ${YELLOW}[WARN]${NC}  ${MESSAGE}"
                    ;;
                *info*)
                    echo -e "  ${TIMESTAMP} ${BLUE}[INFO]${NC}  ${MESSAGE}"
                    ;;
                *)
                    echo -e "  ${TIMESTAMP} ${BLUE}[INFO]${NC}  ${MESSAGE}"
                    ;;
            esac
        done
    else
        echo -e "  ${YELLOW}No log data available${NC}"
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 12. ERROR & BUG DETECTION
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[12] ERROR & BUG DETECTION${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # ✅ FIX: Recent errors (last 30 minutes = ~last 1000 lines)
        # Only count ACTUAL error/warn level logs, not JSON fields
        ERROR_COUNT_30MIN=$(tail -1000 "$LOG_FILE" | grep -c '"level":"error"' 2>/dev/null | tr -d '[:space:]')
        WARN_COUNT_30MIN=$(tail -1000 "$LOG_FILE" | grep -c '"level":"warn"' 2>/dev/null | tr -d '[:space:]')

        [ -z "$ERROR_COUNT_30MIN" ] && ERROR_COUNT_30MIN=0
        [ -z "$WARN_COUNT_30MIN" ] && WARN_COUNT_30MIN=0

        echo -e "  ${CYAN}Recent Issues (30min):${NC}"

        if [ "$ERROR_COUNT_30MIN" -gt 10 ] 2>/dev/null; then
            echo -e "  🔴 Errors:       ${RED}${ERROR_COUNT_30MIN}${NC} ⚠️  HIGH ERROR RATE"
        elif [ "$ERROR_COUNT_30MIN" -gt 0 ] 2>/dev/null; then
            echo -e "  🟡 Errors:       ${YELLOW}${ERROR_COUNT_30MIN}${NC}"
        else
            echo -e "  🟢 Errors:       ${GREEN}${ERROR_COUNT_30MIN}${NC}"
        fi

        if [ "$WARN_COUNT_30MIN" -gt 20 ] 2>/dev/null; then
            echo -e "  🟠 Warnings:     ${YELLOW}${WARN_COUNT_30MIN}${NC} ⚠️  HIGH WARNING RATE"
        else
            echo -e "  🟢 Warnings:     ${BLUE}${WARN_COUNT_30MIN}${NC}"
        fi

        # Check for specific critical issues
        echo -e "\n  ${CYAN}Potential Issues:${NC}"

        INSUFFICIENT=$(tail -1000 "$LOG_FILE" | grep -c "Insufficient" 2>/dev/null | tr -d '[:space:]')
        INVALID_PRICE=$(tail -1000 "$LOG_FILE" | grep -c "Invalid price" 2>/dev/null | tr -d '[:space:]')
        EMERGENCY=$(tail -1000 "$LOG_FILE" | grep -c "emergency shutdown" 2>/dev/null | tr -d '[:space:]')

        [ -z "$INSUFFICIENT" ] && INSUFFICIENT=0
        [ -z "$INVALID_PRICE" ] && INVALID_PRICE=0
        [ -z "$EMERGENCY" ] && EMERGENCY=0

        if [ "$EMERGENCY" -gt 0 ] 2>/dev/null; then
            echo -e "  🚨 CRITICAL: Emergency shutdown detected ($EMERGENCY)"
        fi

        if [ "$INSUFFICIENT" -gt 0 ] 2>/dev/null; then
            echo -e "  ⚠️  Insufficient balance warnings: $INSUFFICIENT"
        fi

        if [ "$INVALID_PRICE" -gt 0 ] 2>/dev/null; then
            echo -e "  ⚠️  Invalid price errors: $INVALID_PRICE"
        fi

        if [ "$INSUFFICIENT" -eq 0 ] && [ "$INVALID_PRICE" -eq 0 ] && [ "$EMERGENCY" -eq 0 ] && [ "$ERROR_COUNT_30MIN" -eq 0 ]; then
            echo -e "  ${GREEN}✅ No critical issues detected${NC}"
        fi

        # Health indicators
        echo -e "\n  ${CYAN}Health Indicators:${NC}"

        BOT_PID=$(get_bot_pid)
        if [ -n "$BOT_PID" ]; then
            echo -e "  ${GREEN}✅${NC} Bot running (PID: $BOT_PID)"

            RECENT_DECISIONS=$(tail -500 "$LOG_FILE" | grep -c "Trading decision" 2>/dev/null | tr -d '[:space:]')
            [ -z "$RECENT_DECISIONS" ] && RECENT_DECISIONS=0

            if [ "$RECENT_DECISIONS" -gt 0 ] 2>/dev/null; then
                echo -e "  ${GREEN}✅${NC} Decision cycles active ($RECENT_DECISIONS recent)"
            else
                echo -e "  ${YELLOW}ℹ️${NC}  Low activity (no recent decisions)"
            fi

            if [ "$ERROR_COUNT_30MIN" -eq 0 ]; then
                echo -e "  ${GREEN}✅${NC} System healthy"
            else
                echo -e "  ${YELLOW}⚠️${NC}  Issues detected (review errors above)"
            fi
        else
            echo -e "  ${RED}❌${NC} Bot not running"
        fi
    else
        echo -e "  ${YELLOW}No log data available${NC}"
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 13. LIVE MARKET DATA
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[13] LIVE MARKET DATA${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # Current market state
        CURRENT_PRICE=$(tail -500 "$LOG_FILE" | grep -i "Current Price:" | tail -1 | sed 's/.*Current Price: //' | awk '{print $1}' | tr -d '[:space:]')
        VOLATILITY_4H=$(tail -500 "$LOG_FILE" | grep -i "4h Volatility:" | tail -1 | sed 's/.*Volatility: //' | awk '{print $1}' | tr -d '[:space:]')
        CURRENT_REGIME=$(tail -500 "$LOG_FILE" | grep -i "\[REGIME\] Detected:" | tail -1 | sed 's/.*Detected: //' | awk '{print $1}' | tr -d '[:space:]')
        STRATEGY=$(tail -500 "$LOG_FILE" | grep -i "Selected strategy:" | tail -1 | sed 's/.*strategy: //' | awk '{print $1}' | tr -d '[:space:]')

        echo -e "  ${CYAN}Current Market:${NC}"

        if [ -n "$CURRENT_PRICE" ]; then
            echo -e "  Price:       ${BLUE}\$$CURRENT_PRICE${NC}"
        fi

        if [ -n "$CURRENT_REGIME" ]; then
            case "$CURRENT_REGIME" in
                "HIGH")
                    echo -e "  Regime:      ${RED}${BOLD}$CURRENT_REGIME${NC} 🔴"
                    ;;
                "MEDIUM")
                    echo -e "  Regime:      ${YELLOW}${BOLD}$CURRENT_REGIME${NC} 🟡"
                    ;;
                "LOW")
                    echo -e "  Regime:      ${BLUE}${BOLD}$CURRENT_REGIME${NC} 🔵"
                    ;;
                "VERY_LOW")
                    echo -e "  Regime:      ${BLUE}$CURRENT_REGIME${NC} ⚪"
                    ;;
            esac
        fi

        if [ -n "$VOLATILITY_4H" ]; then
            echo -e "  Volatility:  ${BLUE}$VOLATILITY_4H${NC}"
        fi

        echo -e "\n  ${CYAN}Trading Conditions:${NC}"

        if [ -n "$STRATEGY" ]; then
            echo -e "  Strategy:    ${GREEN}$STRATEGY${NC}"
        fi

        LAST_ACTION=$(tail -500 "$LOG_FILE" | grep -i "Trading decision made:" | tail -1 | grep -o "action=[^,]*" | cut -d= -f2 | tr -d '"' | tr -d '[:space:]')
        LAST_CONFIDENCE=$(tail -500 "$LOG_FILE" | grep -i "Trading decision made:" | tail -1 | grep -o "confidence=[^,]*" | cut -d= -f2 | tr -d '"' | tr -d '[:space:]')

        if [ -n "$LAST_ACTION" ]; then
            case "$LAST_ACTION" in
                "buy")
                    echo -e "  Signal:      ${GREEN}🟢 BUY${NC}"
                    ;;
                "sell")
                    echo -e "  Signal:      ${RED}🔴 SELL${NC}"
                    ;;
                "hold")
                    echo -e "  Signal:      ${YELLOW}🟡 HOLD${NC}"
                    ;;
            esac
        fi

        if [ -n "$LAST_CONFIDENCE" ]; then
            CONF_PERCENT=$(echo "scale=0; $LAST_CONFIDENCE * 100" | bc 2>/dev/null || echo "0")
            echo -e "  Confidence:  ${BLUE}${CONF_PERCENT}%${NC}"
        fi

        POSITION_SIZE=$(tail -500 "$LOG_FILE" | grep -i "Position tracked:" | tail -1 | sed 's/.*tracked: [A-Z]* \$\([0-9]*\).*/\1/' | tr -d '[:space:]')
        if [ -n "$POSITION_SIZE" ]; then
            echo -e "  Position:    ${BLUE}\$$POSITION_SIZE${NC}"
        fi
    else
        echo -e "  ${YELLOW}No market data available${NC}"
    fi

    # ═══════════════════════════════════════════════════════════════
    # 14. 8-INDICATOR PROFESSIONAL SCORING SYSTEM
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[14] 8-INDICATOR SCORING SYSTEM${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        # Check if 8-indicator system is active
        INDICATOR_ACTIVE=$(tail -500 "$LOG_FILE" | grep -c "\[1/8\]" 2>/dev/null | tr -d '[:space:]')
        [ -z "$INDICATOR_ACTIVE" ] && INDICATOR_ACTIVE=0

        if [ "$INDICATOR_ACTIVE" -gt 0 ]; then
            echo -e "  ${GREEN}✅ 8-Indicator System: ACTIVE${NC}\n"

            # Extract latest 8-indicator scores
            VWAP_SCORE=$(tail -500 "$LOG_FILE" | grep "\[1/8\] VWAP" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            ATR_SCORE=$(tail -500 "$LOG_FILE" | grep "\[2/8\] ATR" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            MULTITF_SCORE=$(tail -500 "$LOG_FILE" | grep "\[3/8\] Multi-TF" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            VOLUME_SCORE=$(tail -500 "$LOG_FILE" | grep "\[4/8\] Volume" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            RSI_SCORE=$(tail -500 "$LOG_FILE" | grep "\[5/8\] RSI" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            REGIME_SCORE=$(tail -500 "$LOG_FILE" | grep "\[6/8\] Regime" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            EMA_SCORE=$(tail -500 "$LOG_FILE" | grep "\[7/8\] EMA" | tail -1 | grep -o '[+-][0-9.]*%' | head -1)
            TIME_FACTOR=$(tail -500 "$LOG_FILE" | grep "\[8/8\] Time Factor:" | tail -1 | grep -o '[0-9.]*x')
            TIME_DESC=$(tail -500 "$LOG_FILE" | grep "\[8/8\] Time Factor:" | tail -1 | sed 's/.*| //')

            FINAL_CONF=$(tail -500 "$LOG_FILE" | grep "FINAL CONFIDENCE:" | tail -1 | grep -o '[0-9.]*%')

            echo -e "  ${CYAN}Indicator Contributions:${NC}"
            [ -n "$VWAP_SCORE" ] && echo -e "  [1] VWAP (18%):      ${BLUE}$VWAP_SCORE${NC}"
            [ -n "$ATR_SCORE" ] && echo -e "  [2] ATR (20%):       ${BLUE}$ATR_SCORE${NC}"
            [ -n "$MULTITF_SCORE" ] && echo -e "  [3] Multi-TF (20%):  ${BLUE}$MULTITF_SCORE${NC}"
            [ -n "$VOLUME_SCORE" ] && echo -e "  [4] Volume (18%):    ${BLUE}$VOLUME_SCORE${NC}"
            [ -n "$RSI_SCORE" ] && echo -e "  [5] RSI (12%):       ${BLUE}$RSI_SCORE${NC} ${YELLOW}(reduced from 45%)${NC}"
            [ -n "$REGIME_SCORE" ] && echo -e "  [6] Regime (12%):    ${BLUE}$REGIME_SCORE${NC}"
            [ -n "$EMA_SCORE" ] && echo -e "  [7] EMA (10%):       ${BLUE}$EMA_SCORE${NC}"
            [ -n "$TIME_FACTOR" ] && echo -e "  [8] Time Factor:     ${BLUE}$TIME_FACTOR${NC} ${YELLOW}$TIME_DESC${NC}"

            if [ -n "$FINAL_CONF" ]; then
                echo -e "\n  ${GREEN}${BOLD}✅ FINAL CONFIDENCE: $FINAL_CONF${NC}"

                # Check for confidence override
                OVERRIDE=$(tail -500 "$LOG_FILE" | grep "Confidence overridden:" | tail -1)
                if [ -n "$OVERRIDE" ]; then
                    ORIG_CONF=$(echo "$OVERRIDE" | grep -o '[0-9.]*%' | head -1)
                    OVERRIDE_CONF=$(echo "$OVERRIDE" | grep -o '[0-9.]*%' | tail -1)
                    echo -e "  ${YELLOW}Override: $ORIG_CONF → $OVERRIDE_CONF${NC}"
                fi
            fi
        else
            echo -e "  ${YELLOW}⏸️  8-Indicator system not active in recent logs${NC}"
            echo -e "  ${BLUE}System applies professional confidence scoring to all decisions${NC}"
        fi
    else
        echo -e "  ${YELLOW}No log data available${NC}"
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════
    # 15. 4-STRATEGY PERFORMANCE BREAKDOWN
    # ═══════════════════════════════════════════════════════════════
    echo -e "${CYAN}${BOLD}[15] 4-STRATEGY PERFORMANCE${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"

    if [ -f "$LOG_FILE" ]; then
        echo -e "  ${CYAN}Active Strategies:${NC}\n"

        # Count decisions per strategy
        GRID_COUNT=$(tail -2000 "$LOG_FILE" | grep -c "strategy.*gridTrading" 2>/dev/null | tr -d '[:space:]')
        MOMENTUM_COUNT=$(tail -2000 "$LOG_FILE" | grep -c "strategy.*momentum" 2>/dev/null | tr -d '[:space:]')
        MEANREV_COUNT=$(tail -2000 "$LOG_FILE" | grep -c "strategy.*mean_reversion" 2>/dev/null | tr -d '[:space:]')
        ARB_COUNT=$(tail -2000 "$LOG_FILE" | grep -c "strategy.*arbitrage" 2>/dev/null | tr -d '[:space:]')

        [ -z "$GRID_COUNT" ] && GRID_COUNT=0
        [ -z "$MOMENTUM_COUNT" ] && MOMENTUM_COUNT=0
        [ -z "$MEANREV_COUNT" ] && MEANREV_COUNT=0
        [ -z "$ARB_COUNT" ] && ARB_COUNT=0

        TOTAL_DECISIONS=$((GRID_COUNT + MOMENTUM_COUNT + MEANREV_COUNT + ARB_COUNT))

        if [ "$TOTAL_DECISIONS" -gt 0 ]; then
            GRID_PERCENT=$(echo "scale=1; ($GRID_COUNT * 100) / $TOTAL_DECISIONS" | bc 2>/dev/null || echo "0")
            MOMENTUM_PERCENT=$(echo "scale=1; ($MOMENTUM_COUNT * 100) / $TOTAL_DECISIONS" | bc 2>/dev/null || echo "0")
            MEANREV_PERCENT=$(echo "scale=1; ($MEANREV_COUNT * 100) / $TOTAL_DECISIONS" | bc 2>/dev/null || echo "0")
            ARB_PERCENT=$(echo "scale=1; ($ARB_COUNT * 100) / $TOTAL_DECISIONS" | bc 2>/dev/null || echo "0")

            echo -e "  ${GREEN}[1] gridTrading${NC}        │ \$18,000 │ ${BLUE}$GRID_COUNT decisions${NC} (${BLUE}$GRID_PERCENT%${NC})"
            echo -e "  ${GREEN}[2] momentum${NC}           │ \$15,000 │ ${BLUE}$MOMENTUM_COUNT decisions${NC} (${BLUE}$MOMENTUM_PERCENT%${NC})"
            echo -e "  ${GREEN}[3] mean_reversion${NC}     │ \$15,000 │ ${BLUE}$MEANREV_COUNT decisions${NC} (${BLUE}$MEANREV_PERCENT%${NC})"
            echo -e "  ${GREEN}[4] arbitrage${NC}          │ \$12,000 │ ${BLUE}$ARB_COUNT decisions${NC} (${BLUE}$ARB_PERCENT%${NC})"
            echo -e "\n  ${CYAN}Total Portfolio: ${GREEN}${BOLD}\$60,000${NC}"

            # Regime-strategy mapping
            echo -e "\n  ${CYAN}Volatility Regime Mapping:${NC}"
            echo -e "  ${RED}HIGH${NC}    → momentum, gridTrading"
            echo -e "  ${YELLOW}MEDIUM${NC}  → mean_reversion, gridTrading"
            echo -e "  ${BLUE}LOW${NC}     → gridTrading, arbitrage"
        else
            echo -e "  ${YELLOW}No strategy decisions in recent logs${NC}\n"
            echo -e "  ${CYAN}Portfolio Allocation:${NC}"
            echo -e "  [1] gridTrading:     \$18,000 (30%)"
            echo -e "  [2] momentum:        \$15,000 (25%)"
            echo -e "  [3] mean_reversion:  \$15,000 (25%)"
            echo -e "  [4] arbitrage:       \$12,000 (20%)"
            echo -e "\n  ${CYAN}Total: ${GREEN}${BOLD}\$60,000${NC}"
        fi
    else
        echo -e "  ${YELLOW}No log data available${NC}"
    fi
    echo ""

    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Next update in 30 seconds... (Ctrl+C to exit)${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
}

# ═══════════════════════════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════════════════════════

# Change to bot directory
cd ~/bsc-ranging-bot 2>/dev/null || cd "$(dirname "$0")"

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}Error: Log file not found at $LOG_FILE${NC}"
    echo -e "${YELLOW}Make sure the bot is running and logging to the correct location${NC}"
    exit 1
fi

# Main loop
while true; do
    show_dashboard
    sleep 30
done
