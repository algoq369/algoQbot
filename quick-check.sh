#!/bin/bash

# ═══════════════════════════════════════════════════════════
# ALGOQBOT QUICK STATUS CHECK
# Run this anytime to see what's happening
# ═══════════════════════════════════════════════════════════

cd ~/algoQbot

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           ALGOQBOT QUICK STATUS CHECK                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 1. Process Status
echo "1️⃣  BOT PROCESS STATUS"
echo "────────────────────────────────────────────────────"
if pm2 list 2>/dev/null | grep -q "online"; then
  echo "✅ Bot is RUNNING"
  pm2 list | head -10
else
  echo "❌ Bot is NOT RUNNING"
  echo ""
  echo "   To start: pm2 start ecosystem.config.js"
  echo "             OR"
  echo "             npm start"
fi
echo ""

# 2. Shadow Mode Activity
echo "2️⃣  SHADOW MODE ACTIVITY"
echo "────────────────────────────────────────────────────"
if [ -f "data/shadow_trades.json" ]; then
  FILE_AGE=$(( $(date +%s) - $(stat -f %m data/shadow_trades.json 2>/dev/null || stat -c %Y data/shadow_trades.json 2>/dev/null) ))
  MINUTES_AGO=$(( FILE_AGE / 60 ))
  
  echo "Last update: ${MINUTES_AGE} minutes ago"
  echo ""
  echo "Recent actions (last 10):"
  tail -10 data/shadow_trades.json | grep -o '"action":"[^"]*"' | cut -d'"' -f4 | nl
  
  HOLD_COUNT=$(tail -20 data/shadow_trades.json | grep -c '"action":"HOLD"')
  echo ""
  echo "Last 20 signals: ${HOLD_COUNT}/20 are HOLD"
  
  if [ "$HOLD_COUNT" -ge 15 ]; then
    echo "⚠️  Bot is cautious (many HOLD signals)"
    echo "   This is NORMAL in uncertain markets"
  fi
else
  echo "❌ No shadow trades file found"
fi
echo ""

# 3. Current Balances
echo "3️⃣  CURRENT BALANCES (from shadow mode)"
echo "────────────────────────────────────────────────────"
if [ -f "data/shadow_trades.json" ]; then
  tail -5 data/shadow_trades.json | grep -A 2 '"balances"' | head -3
fi
echo ""

# 4. Recent Logs
echo "4️⃣  RECENT LOG ACTIVITY"
echo "────────────────────────────────────────────────────"
if pm2 list 2>/dev/null | grep -q "online"; then
  echo "Last 5 log entries:"
  pm2 logs --lines 5 --nostream 2>/dev/null | tail -10
elif [ -f "logs/combined.log" ]; then
  echo "Last 5 log entries:"
  tail -5 logs/combined.log
else
  echo "No logs available"
fi
echo ""

# 5. Next Steps
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    NEXT STEPS                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

if ! pm2 list 2>/dev/null | grep -q "online"; then
  echo "🚀 START THE BOT:"
  echo "   pm2 start ecosystem.config.js"
  echo "   pm2 logs --lines 50"
  echo ""
fi

echo "📊 MONITOR SHADOW TRADES:"
echo "   watch -n 5 'tail -5 ~/algoQbot/data/shadow_trades.json'"
echo ""

echo "📈 VIEW FULL STATUS REPORT:"
echo "   cat ~/algoQbot/STATUS_REPORT.md"
echo ""

echo "🔍 CHECK REGIME DETECTION:"
echo "   grep 'Regime:' logs/combined.log | tail -20"
echo ""

echo "═══════════════════════════════════════════════════════════"

