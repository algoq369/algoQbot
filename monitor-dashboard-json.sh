#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BOT_PID=$(pgrep -f "node.*start-shadow" | head -1)
LOG_FILE="logs/combined-$(date +%Y-%m-%d).log"

clean_num() {
    local raw="$1"
    local cleaned=$(echo "$raw" | tr -d '\n\r\t ' | grep -o '[0-9]*' | head -1)
    cleaned=$(echo "$cleaned" | sed 's/^0*//')
    [ -z "$cleaned" ] && cleaned=0
    echo "$cleaned"
}

# Format USD with 2 decimals and comma separator
format_usd() {
    local num=$(printf "%.2f" "$1" 2>/dev/null)
    # Pure bash comma formatting (works on macOS and Linux)
    local int="${num%.*}"
    local dec="${num#*.}"

    # Add commas to integer part
    local result=""
    while [ ${#int} -gt 3 ]; do
        result=",${int: -3}${result}"
        int="${int:0:${#int}-3}"
    done
    result="$int$result"

    echo "$result.$dec"
}

# Format BNB with 3 decimals (reasonable precision)
format_bnb() {
    local num="$1"
    printf "%.3f" "$num" 2>/dev/null
}

# Format percentage with 1 decimal
format_pct() {
    local num="$1"
    printf "%.1f" "$num" 2>/dev/null
}

while true; do
    clear

    USDT=36000
    BNB=22
    PRICE=1135
    PRICE_SOURCE="default"

    # Get balances
    if [ -f data/virtual_balances.json ]; then
        USDT=$(grep -o '"usdt"[[:space:]]*:[[:space:]]*[0-9.]*' data/virtual_balances.json | grep -o '[0-9.]*' | head -1)
        BNB=$(grep -o '"bnb"[[:space:]]*:[[:space:]]*[0-9.]*' data/virtual_balances.json | grep -o '[0-9.]*' | head -1)
        [ -z "$USDT" ] && USDT=36000
        [ -z "$BNB" ] && BNB=22
    fi

    # CRITICAL: Extract Base Price from today's log
    if [ -f "$LOG_FILE" ]; then
        # Look for EXACT match: "Base Price: 0.000881"
        BASE_PRICE_RAW=$(cat "$LOG_FILE" | grep "Base Price:" | tail -1 | awk '{print $3}')

        if [ -n "$BASE_PRICE_RAW" ]; then
            # Validate it's a proper decimal
            if echo "$BASE_PRICE_RAW" | grep -qE "^0\.[0-9]+$"; then
                # Convert to USD (1 / BNB_per_USDT)
                CALC_PRICE=$(echo "scale=2; 1 / $BASE_PRICE_RAW" | bc -l 2>/dev/null)

                # Validate range (BNB should be $1000-$1300) using bc for decimal comparison
                if [ -n "$CALC_PRICE" ] && [ $(echo "$CALC_PRICE >= 1000" | bc) -eq 1 ] && [ $(echo "$CALC_PRICE <= 1300" | bc) -eq 1 ]; then
                    PRICE=$CALC_PRICE
                    PRICE_SOURCE="Base Price"
                fi
            fi
        fi

        # Fallback: Try Current Price
        if [ "$PRICE_SOURCE" = "default" ]; then
            CURRENT_RAW=$(cat "$LOG_FILE" | grep "Current Price:.*0\.[0-9]" | tail -1 | grep -o "0\.[0-9]*" | head -1)

            if [ -n "$CURRENT_RAW" ]; then
                CALC_PRICE=$(echo "scale=2; 1 / $CURRENT_RAW" | bc -l 2>/dev/null)

                if [ -n "$CALC_PRICE" ] && [ $(echo "$CALC_PRICE >= 1000" | bc) -eq 1 ] && [ $(echo "$CALC_PRICE <= 1300" | bc) -eq 1 ]; then
                    PRICE=$CALC_PRICE
                    PRICE_SOURCE="Current Price"
                fi
            fi
        fi
    fi

    # Historical fallback for price if today's log missing/empty
    if [ "$PRICE_SOURCE" = "default" ]; then
        for log in $(ls -t logs/combined-*.log 2>/dev/null | grep -v "$(date +%Y-%m-%d)"); do
            [ ! -s "$log" ] && continue

            # Try Base Price from historical log
            BASE_PRICE_RAW=$(cat "$log" | grep "Base Price:" | tail -1 | awk '{print $3}')
            if [ -n "$BASE_PRICE_RAW" ]; then
                if echo "$BASE_PRICE_RAW" | grep -qE "^0\.[0-9]+$"; then
                    CALC_PRICE=$(echo "scale=2; 1 / $BASE_PRICE_RAW" | bc -l 2>/dev/null)
                    if [ -n "$CALC_PRICE" ] && [ $(echo "$CALC_PRICE >= 1000" | bc) -eq 1 ] && [ $(echo "$CALC_PRICE <= 1300" | bc) -eq 1 ]; then
                        PRICE=$CALC_PRICE
                        PRICE_SOURCE="Base Price"
                        break
                    fi
                fi
            fi

            # Try Current Price from historical log
            CURRENT_RAW=$(cat "$log" | grep "Current Price:.*0\.[0-9]" | tail -1 | grep -o "0\.[0-9]*" | head -1)
            if [ -n "$CURRENT_RAW" ]; then
                CALC_PRICE=$(echo "scale=2; 1 / $CURRENT_RAW" | bc -l 2>/dev/null)
                if [ -n "$CALC_PRICE" ] && [ $(echo "$CALC_PRICE >= 1000" | bc) -eq 1 ] && [ $(echo "$CALC_PRICE <= 1300" | bc) -eq 1 ]; then
                    PRICE=$CALC_PRICE
                    PRICE_SOURCE="Current Price"
                    break
                fi
            fi
        done
    fi

    # Calculate portfolio
    BNB_VALUE=$(echo "scale=0; $BNB * $PRICE" | bc 2>/dev/null)
    TOTAL=$(echo "scale=0; $USDT + $BNB_VALUE" | bc 2>/dev/null)
    BNB_PCT=$(echo "scale=1; ($BNB_VALUE * 100) / $TOTAL" | bc 2>/dev/null)
    USDT_PCT=$(echo "scale=1; 100 - $BNB_PCT" | bc 2>/dev/null)

    INITIAL=60000
    PNL=$(echo "scale=0; $TOTAL - $INITIAL" | bc 2>/dev/null)
    PNL_PCT=$(echo "scale=2; ($PNL * 100) / $INITIAL" | bc 2>/dev/null)

    # Trading stats
    DECISIONS=0
    ENTRIES=0
    COMPLETED=0
    WINS=0

    if [ -f "$LOG_FILE" ]; then
        RAW_DEC=$(cat "$LOG_FILE" | grep -c "Trading decision" 2>/dev/null || echo "0")
        DECISIONS=$(clean_num "$RAW_DEC")
    fi

    if [ -f data/shadow_trades.json ] && [ -s data/shadow_trades.json ]; then
        RAW_ENT=$(grep -c '"action"' data/shadow_trades.json 2>/dev/null || echo "0")
        ENTRIES=$(clean_num "$RAW_ENT")

        RAW_COMP=$(grep -c '"status":"closed"' data/shadow_trades.json 2>/dev/null || echo "0")
        COMPLETED=$(clean_num "$RAW_COMP")

        RAW_WINS=$(grep '"status":"closed"' data/shadow_trades.json 2>/dev/null | grep -c '"profit":[1-9]' || echo "0")
        WINS=$(clean_num "$RAW_WINS")
    fi

    LOSSES=$((COMPLETED - WINS))
    [ $LOSSES -lt 0 ] && LOSSES=0

    WIN_RATE="0.0"
    [ $COMPLETED -gt 0 ] && WIN_RATE=$(echo "scale=1; ($WINS * 100) / $COMPLETED" | bc 2>/dev/null)

    # Active positions - use "activePositions size:" from logs
    ACTIVE=0
    if [ -f "$LOG_FILE" ]; then
        # Extract from "activePositions size: N" log entries (take last one)
        # Handle JSON format: "activePositions size: 11"
        ACTIVE_RAW=$(grep "activePositions size:" "$LOG_FILE" 2>/dev/null | tail -1 | grep -o "size: [0-9]*" | grep -o "[0-9]*")
        ACTIVE=$(clean_num "${ACTIVE_RAW:-0}")
    fi
    [ -z "$ACTIVE" ] && ACTIVE=0

    # Market conditions
    REGIME=""
    VOL=""

    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
        # Try today's log first
        REGIME=$(cat "$LOG_FILE" | grep "REGIME.*Detected" | tail -1 | grep -o "VERY_LOW\|LOW\|MEDIUM\|HIGH\|VERY_HIGH" | head -1)
        VOL=$(cat "$LOG_FILE" | grep "4h Volatility:" | tail -1 | grep -o "[0-9]\.[0-9]*" | head -1)
    fi

    # Fallback to most recent non-empty log if today's is empty/missing
    if [ -z "$REGIME" ] || [ -z "$VOL" ]; then
        for log in $(ls -t logs/combined-*.log 2>/dev/null | grep -v "$(date +%Y-%m-%d)"); do
            if [ -s "$log" ]; then
                [ -z "$REGIME" ] && REGIME=$(cat "$log" | grep "REGIME.*Detected" | tail -1 | grep -o "VERY_LOW\|LOW\|MEDIUM\|HIGH\|VERY_HIGH" | head -1)
                [ -z "$VOL" ] && VOL=$(cat "$log" | grep "4h Volatility:" | tail -1 | grep -o "[0-9]\.[0-9]*" | head -1)
                # Stop once we have both values or tried the first non-empty log
                [ -n "$REGIME" ] && [ -n "$VOL" ] && break
            fi
        done
    fi

    [ -z "$REGIME" ] && REGIME="N/A"
    [ -z "$VOL" ] && VOL="0.00"

    # P&L color
    PNL_COLOR=$RED
    PNL_SYM=""
    if [ $(echo "$PNL > 0" | bc 2>/dev/null) -eq 1 ]; then
        PNL_COLOR=$GREEN
        PNL_SYM="+"
    fi

    # Price source color
    if [ "$PRICE_SOURCE" = "Base Price" ]; then
        PRICE_COLOR=$GREEN
    elif [ "$PRICE_SOURCE" = "Current Price" ]; then
        PRICE_COLOR=$GREEN
    else
        PRICE_COLOR=$RED
    fi

    echo "════════════════════════════════════════════════════════════════"
    echo "          BSC TRADING BOT - ENHANCED DASHBOARD"
    echo "════════════════════════════════════════════════════════════════"
    date '+%Y-%m-%d %H:%M:%S'
    echo ""

    echo "[1] BOT STATUS"
    echo "────────────────────────────────────────────────────────────────"
    if [ -n "$BOT_PID" ]; then
        echo "  Status:      ● RUNNING"
        echo "  PID:         $BOT_PID"
        echo "  Uptime:      $(ps -p $BOT_PID -o etime= 2>/dev/null | tr -d ' ')"
        echo "  Memory:      $(ps -p $BOT_PID -o rss= 2>/dev/null | awk '{printf "%.1fMB", $1/1024}')"
    else
        echo "  Status:      ○ STOPPED"
    fi
    echo ""

    echo "[2] PORTFOLIO & P&L"
    echo "────────────────────────────────────────────────────────────────"
    echo "  Total Value:  \$$(format_usd $TOTAL)"
    echo -e "  P&L:          ${PNL_COLOR}\$${PNL_SYM}$(format_usd $PNL) (${PNL_SYM}$(format_pct $PNL_PCT)%)${NC}"
    echo "  USDT:         \$$(format_usd $USDT) ($(format_pct $USDT_PCT)%)"
    echo "  BNB:          $(format_bnb $BNB) (\$$(format_usd $BNB_VALUE) - $(format_pct $BNB_PCT)%)"
    echo -e "  BNB Price:    \$$(format_usd $PRICE) ${PRICE_COLOR}[$PRICE_SOURCE]${NC}"
    echo ""

    echo "[3] TRADING ACTIVITY"
    echo "────────────────────────────────────────────────────────────────"
    echo "  Total Decisions:  $DECISIONS"
    echo "  Shadow Entries:   $ENTRIES"
    echo "  Active Positions: $ACTIVE"
    echo "  Completed Trades: $COMPLETED"
    echo "  ├─ Wins:          $WINS"
    echo "  ├─ Losses:        $LOSSES"
    echo "  └─ Win Rate:      $(format_pct $WIN_RATE)%"
    echo ""

    echo "[4] MARKET CONDITIONS"
    echo "────────────────────────────────────────────────────────────────"
    echo "  Regime:      $REGIME"
    echo "  Volatility:  $(format_pct $VOL)%"
    echo "  Mode:        👻 Shadow Trading"
    echo ""

    echo "[5] ENHANCEMENTS"
    echo "────────────────────────────────────────────────────────────────"
    if [ -f "$LOG_FILE" ] && cat "$LOG_FILE" | grep -q "DYNAMIC-THRESHOLD"; then
        echo "  Dynamic Thresholds: ✅ ACTIVE"
    else
        echo "  Dynamic Thresholds: ⏳ Waiting"
    fi
    echo "  Virtual Balance:    ✅ Fixed"
    if [ "$PRICE_SOURCE" = "Base Price" ]; then
        echo -e "  Price Sync:         ${GREEN}✅ Bot-synced (Base)${NC}"
    elif [ "$PRICE_SOURCE" = "Current Price" ]; then
        echo -e "  Price Sync:         ${GREEN}✅ Bot-synced (Current)${NC}"
    else
        echo -e "  Price Sync:         ${RED}❌ Using default${NC}"
    fi
    echo ""

    echo "════════════════════════════════════════════════════════════════"
    echo "Dashboard: Enhanced | Bot: ${BOT_PID:-Stopped} | Refresh: 30s"
    echo "════════════════════════════════════════════════════════════════"

    sleep 30
done
