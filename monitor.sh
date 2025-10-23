#!/bin/bash
echo "═══════════════════════════════════════════════════════════"
echo "📊 BSC TRADING BOT MONITOR - $(date)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Bot Status
echo "🤖 BOT STATUS:"
if ps aux | grep -E "node.*shadow" | grep -v grep > /dev/null; then
  echo "  ✅ Running"
  ps aux | grep -E "node.*shadow" | grep -v grep | awk '{print "  PID: "$2", CPU: "$3"%, Memory: "$4"%"}'
else
  echo "  ❌ Not running"
fi
echo ""

# Trade Statistics
LOG_FILE="logs/combined-$(date +%Y-%m-%d).log*"
echo "📈 TODAY'S ACTIVITY:"
echo "  Total Decisions:" $(grep -c "Trading decision made" $LOG_FILE 2>/dev/null || echo 0)
echo "  HOLD:" $(grep -c '"action":"hold"' $LOG_FILE 2>/dev/null || echo 0)
echo "  BUY:" $(grep -c '"action":"buy"' $LOG_FILE 2>/dev/null || echo 0)
echo "  SELL:" $(grep -c '"action":"sell"' $LOG_FILE 2>/dev/null || echo 0)
echo ""

# Hybrid Tracking
echo "🔄 HYBRID SYSTEM:"
TRACKED=$(grep -c "HYBRID TRACKING" $LOG_FILE 2>/dev/null || echo 0)
echo "  Tracked Trades: $TRACKED"
if [ $TRACKED -gt 0 ]; then
  echo "  Last Tracking:"
  grep "HYBRID TRACKING" $LOG_FILE 2>/dev/null | tail -1 | grep -oE 'Multiplier: [0-9.]+x.*Total Missed: \$[0-9.]+'
fi
echo ""

# Portfolio Status
echo "💼 PORTFOLIO:"
PORTFOLIO=$(grep "Portfolio BNB %" $LOG_FILE 2>/dev/null | tail -1)
if [ -n "$PORTFOLIO" ]; then
  echo "$PORTFOLIO" | grep -oE 'USDT [0-9]+\.[0-9]+%.*BNB [0-9]+\.[0-9]+%'
else
  echo "  No portfolio data found"
fi
echo ""

# Blocking Summary
echo "⛔ BLOCKS TODAY:"
echo "  Portfolio Blocks:" $(grep -c "PORTFOLIO BLOCK" $LOG_FILE 2>/dev/null || echo 0)
echo "  R:R Rejections:" $(grep -c "R:R too low" $LOG_FILE 2>/dev/null || echo 0)
echo ""

# Errors & Warnings
ERRORS=$(grep -c '"level":"error"' $LOG_FILE 2>/dev/null || echo 0)
WARNINGS=$(grep -c '"level":"warn"' $LOG_FILE 2>/dev/null || echo 0)
echo "⚠️  HEALTH:"
echo "  Errors: $ERRORS"
echo "  Warnings: $WARNINGS"
if [ $ERRORS -gt 0 ]; then
  echo "  Recent Error:"
  grep '"level":"error"' $LOG_FILE 2>/dev/null | tail -1 | jq -r .message | sed 's/^/    /'
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "Run 'npm run report' for detailed shadow mode statistics"
echo "═══════════════════════════════════════════════════════════"
