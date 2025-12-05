#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        📊 OVERNIGHT TRADING AUDIT REPORT                  ║"
echo "║           $(date '+%Y-%m-%d %H:%M:%S')                       "
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 1. BOT STATUS & UPTIME
echo "1️⃣  BOT STATUS & UPTIME"
echo "────────────────────────────────────────────────────────────"
if pm2 list 2>/dev/null | grep -q "algoqbot.*online"; then
  echo "✅ Status: ONLINE"
  pm2 info algoqbot 2>/dev/null | grep -E "uptime|restarts|created at" | head -5
else
  echo "❌ Status: OFFLINE"
  echo "Bot is not running!"
fi
echo ""

# 2. TRADE ACTIVITY SUMMARY
echo "2️⃣  TRADE ACTIVITY SUMMARY"
echo "────────────────────────────────────────────────────────────"

# Check shadow trades file
if [ -f "data/shadow_trades.json" ]; then
  SHADOW_FILE="data/shadow_trades.json"
elif [ -f ".shadow-trades.json" ]; then
  SHADOW_FILE=".shadow-trades.json"
else
  SHADOW_FILE=""
fi

if [ -n "$SHADOW_FILE" ]; then
  echo "📁 Shadow trades file: $SHADOW_FILE"
  echo "   Size: $(ls -lh "$SHADOW_FILE" | awk '{print $5}')"
  echo "   Last modified: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$SHADOW_FILE" 2>/dev/null || stat -c "%y" "$SHADOW_FILE" 2>/dev/null | cut -d. -f1)"
  echo ""
  
  # Count trades
  TOTAL_ENTRIES=$(wc -l < "$SHADOW_FILE")
  ENTRIES=$(grep -c '"type":"ENTRY"' "$SHADOW_FILE" 2>/dev/null || echo "0")
  EXITS=$(grep -c '"type":"EXIT"' "$SHADOW_FILE" 2>/dev/null || echo "0")
  HOLDS=$(grep -c '"action":"HOLD"' "$SHADOW_FILE" 2>/dev/null || echo "0")
  BUYS=$(grep -c '"action":"buy"' "$SHADOW_FILE" 2>/dev/null || echo "0")
  SELLS=$(grep -c '"action":"sell"' "$SHADOW_FILE" 2>/dev/null || echo "0")
  
  echo "📊 Trade Counts:"
  echo "   Total records: $TOTAL_ENTRIES"
  echo "   Entries: $ENTRIES"
  echo "   Exits: $EXITS"
  echo "   HOLD signals: $HOLDS"
  echo "   Buy actions: $BUYS"
  echo "   Sell actions: $SELLS"
  
  # Get date range
  echo ""
  echo "📅 Time Range:"
  FIRST_TIMESTAMP=$(grep -o '"timestamp":"[^"]*"' "$SHADOW_FILE" | head -1 | cut -d'"' -f4)
  LAST_TIMESTAMP=$(grep -o '"timestamp":"[^"]*"' "$SHADOW_FILE" | tail -1 | cut -d'"' -f4)
  echo "   First record: $FIRST_TIMESTAMP"
  echo "   Last record: $LAST_TIMESTAMP"
else
  echo "⚠️  No shadow trades file found"
fi
echo ""

# 3. PM2 LOG ANALYSIS
echo "3️⃣  PM2 LOG ANALYSIS (Last 12 Hours)"
echo "────────────────────────────────────────────────────────────"

# Get log lines from last 12 hours
TWELVE_HOURS_AGO=$(date -u -v-12H '+%Y-%m-%d %H:%M' 2>/dev/null || date -u -d '12 hours ago' '+%Y-%m-%d %H:%M' 2>/dev/null)
echo "Analyzing logs since: $TWELVE_HOURS_AGO UTC"
echo ""

# Trade executions
TRADE_COUNT=$(pm2 logs algoqbot --lines 5000 --nostream 2>/dev/null | grep -c "AI Strategy executed" || echo "0")
echo "📈 Strategy Executions: $TRADE_COUNT"

# Regime detections
echo ""
echo "🌡️  Volatility Regimes Detected:"
pm2 logs algoqbot --lines 5000 --nostream 2>/dev/null | \
  grep -i "regime:" | \
  grep -o "VERY_LOW\|LOW\|MEDIUM\|HIGH\|VERY_HIGH" | \
  sort | uniq -c | \
  awk '{printf "   %s: %d occurrences\n", $2, $1}'

# Actions breakdown
echo ""
echo "🎯 Actions Taken:"
pm2 logs algoqbot --lines 5000 --nostream 2>/dev/null | \
  grep "AI Strategy executed" | \
  grep -o "Action: [A-Z]*" | \
  cut -d' ' -f2 | \
  sort | uniq -c | \
  awk '{printf "   %s: %d\n", $2, $1}'

echo ""

# 4. ERROR ANALYSIS
echo "4️⃣  ERROR & WARNING ANALYSIS"
echo "────────────────────────────────────────────────────────────"

ERROR_COUNT=$(pm2 logs algoqbot --lines 5000 --nostream --err 2>/dev/null | wc -l | tr -d ' ')
WARN_COUNT=$(pm2 logs algoqbot --lines 5000 --nostream 2>/dev/null | grep -c "WARN" || echo "0")

echo "⚠️  Error count: $ERROR_COUNT"
echo "⚠️  Warning count: $WARN_COUNT"

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo ""
  echo "Recent errors (last 10):"
  pm2 logs algoqbot --lines 5000 --nostream --err 2>/dev/null | tail -10
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  echo ""
  echo "Recent warnings (last 5):"
  pm2 logs algoqbot --lines 5000 --nostream 2>/dev/null | grep "WARN" | tail -5
fi
echo ""

# 5. MARKET CONDITIONS
echo "5️⃣  MARKET CONDITIONS"
echo "────────────────────────────────────────────────────────────"

# Get latest volatility
LATEST_VOL=$(pm2 logs algoqbot --lines 100 --nostream 2>/dev/null | grep -i "volatility:" | tail -1)
if [ -n "$LATEST_VOL" ]; then
  echo "Latest: $LATEST_VOL" | sed 's/^0|algoqbot | //'
else
  echo "No recent volatility data found"
fi

# Get latest price
LATEST_PRICE=$(pm2 logs algoqbot --lines 100 --nostream 2>/dev/null | grep -o "Price.*BNB" | tail -1)
if [ -n "$LATEST_PRICE" ]; then
  echo "Latest: $LATEST_PRICE"
fi
echo ""

# 6. PORTFOLIO STATUS
echo "6️⃣  PORTFOLIO STATUS"
echo "────────────────────────────────────────────────────────────"

# Get latest portfolio balance
PORTFOLIO_LINE=$(pm2 logs algoqbot --lines 100 --nostream 2>/dev/null | grep "Portfolio balanced" | tail -1)
if [ -n "$PORTFOLIO_LINE" ]; then
  echo "$PORTFOLIO_LINE" | sed 's/^.*Portfolio balanced: /Portfolio: /'
else
  echo "No recent portfolio data"
fi

# Get from shadow file if available
if [ -n "$SHADOW_FILE" ]; then
  echo ""
  echo "Latest shadow mode balances:"
  tail -1 "$SHADOW_FILE" | grep -o '"balances":{[^}]*}' | sed 's/"//g' | sed 's/balances://g'
fi
echo ""

# 7. PERFORMANCE GRADE
echo "7️⃣  PERFORMANCE ASSESSMENT"
echo "────────────────────────────────────────────────────────────"

# Calculate grade
GRADE="A"
ISSUES=()

if [ "$ERROR_COUNT" -gt 10 ]; then
  GRADE="C"
  ISSUES+=("High error count ($ERROR_COUNT)")
fi

if ! pm2 list 2>/dev/null | grep -q "algoqbot.*online"; then
  GRADE="F"
  ISSUES+=("Bot offline")
fi

RESTARTS=$(pm2 info algoqbot 2>/dev/null | grep "restarts" | grep -o "[0-9]*" | head -1)
if [ "$RESTARTS" -gt 5 ]; then
  GRADE="D"
  ISSUES+=("Multiple restarts ($RESTARTS)")
fi

echo "Overall Grade: $GRADE"
echo ""

if [ ${#ISSUES[@]} -gt 0 ]; then
  echo "⚠️  Issues Detected:"
  for issue in "${ISSUES[@]}"; do
    echo "   - $issue"
  done
else
  echo "✅ No major issues detected"
fi
echo ""

# 8. RECOMMENDATIONS
echo "8️⃣  RECOMMENDATIONS"
echo "────────────────────────────────────────────────────────────"

if [ "$HOLDS" -gt $((BUYS + SELLS)) ] && [ "$HOLDS" -gt 100 ]; then
  echo "📊 High HOLD rate detected"
  echo "   - This is expected in VERY_LOW/LOW volatility regimes"
  echo "   - Bot is protecting capital by not trading"
  echo "   - Consider checking market conditions"
fi

if [ "$ENTRIES" -ne "$EXITS" ]; then
  echo "⚠️  Unmatched entries and exits"
  echo "   - Entries: $ENTRIES"
  echo "   - Exits: $EXITS"
  echo "   - May have open positions or logging issue"
fi

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "⚠️  Errors detected in logs"
  echo "   - Review error logs with: pm2 logs algoqbot --err"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    AUDIT COMPLETE                          ║"
echo "╚═══════════════════════════════════════════════════════════╝"

