#!/bin/bash

# ALGOQBOT LIVE MONITORING DASHBOARD
# Updates every 5 seconds with real-time bot status

while true; do
  clear
  
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║        🤖 ALGOQBOT LIVE MONITORING DASHBOARD 🤖           ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo ""
  
  # Bot Status
  echo "📊 BOT STATUS"
  echo "────────────────────────────────────────────────────────────"
  if pm2 list 2>/dev/null | grep -q "algoqbot.*online"; then
    STATUS_LINE=$(pm2 list | grep algoqbot)
    UPTIME=$(echo "$STATUS_LINE" | awk '{print $10}')
    RESTARTS=$(echo "$STATUS_LINE" | awk '{print $12}')
    MEMORY=$(echo "$STATUS_LINE" | awk '{print $16}')
    CPU=$(echo "$STATUS_LINE" | awk '{print $14}')
    
    echo "  Status:    ✅ ONLINE"
    echo "  Uptime:    $UPTIME"
    echo "  Restarts:  $RESTARTS"
    echo "  Memory:    $MEMORY"
    echo "  CPU:       $CPU"
  else
    echo "  Status:    ❌ OFFLINE"
  fi
  echo ""
  
  # Market Status
  echo "🌡️  MARKET STATUS"
  echo "────────────────────────────────────────────────────────────"
  
  # Get regime from recent logs
  REGIME_LINE=$(pm2 logs algoqbot --lines 50 --nostream 2>/dev/null | grep -i "regime:" | tail -1)
  if [ -n "$REGIME_LINE" ]; then
    REGIME=$(echo "$REGIME_LINE" | grep -o "VERY_LOW\|LOW\|MEDIUM\|HIGH\|VERY_HIGH" | head -1)
    VOL=$(echo "$REGIME_LINE" | grep -oE "[0-9]+\.[0-9]+%" | head -1)
    echo "  Regime:        $REGIME"
    echo "  Volatility:    $VOL"
  else
    echo "  Regime:        Unknown"
    echo "  Volatility:    Unknown"
  fi
  
  # Get current action
  ACTION_LINE=$(pm2 logs algoqbot --lines 20 --nostream 2>/dev/null | grep "AI Strategy executed" | tail -1)
  if [ -n "$ACTION_LINE" ]; then
    ACTION=$(echo "$ACTION_LINE" | grep -oE "Action: [A-Z]+" | cut -d' ' -f2)
    CONF=$(echo "$ACTION_LINE" | grep -oE "Confidence: [0-9]+\.[0-9]+%" | cut -d' ' -f2)
    echo "  Action:        $ACTION"
    echo "  Confidence:    $CONF"
  fi
  
  # Get TP/SL
  TPSL_LINE=$(pm2 logs algoqbot --lines 100 --nostream 2>/dev/null | grep "Take Profit:" | tail -1)
  if [ -n "$TPSL_LINE" ]; then
    TP=$(echo "$TPSL_LINE" | grep -oE "[0-9]+\.[0-9]+%" | head -1)
    SL_LINE=$(pm2 logs algoqbot --lines 100 --nostream 2>/dev/null | grep "Stop Loss:" | tail -1)
    SL=$(echo "$SL_LINE" | grep -oE "[0-9]+\.[0-9]+%" | head -1)
    echo "  Take Profit:   $TP"
    echo "  Stop Loss:     $SL"
  fi
  echo ""
  
  # Shadow Mode Stats
  echo "👻 SHADOW MODE STATS"
  echo "────────────────────────────────────────────────────────────"
  if [ -f "data/shadow_trades.json" ]; then
    SHADOW_FILE="data/shadow_trades.json"
  elif [ -f ".shadow-trades.json" ]; then
    SHADOW_FILE=".shadow-trades.json"
  else
    SHADOW_FILE=""
  fi
  
  if [ -n "$SHADOW_FILE" ]; then
    LAST_UPDATE=$(stat -f "%Sm" -t "%H:%M:%S" "$SHADOW_FILE" 2>/dev/null || stat -c "%y" "$SHADOW_FILE" 2>/dev/null | cut -d' ' -f2 | cut -d. -f1)
    FILE_SIZE=$(ls -lh "$SHADOW_FILE" | awk '{print $5}')
    
    # Try to count entries/exits
    ENTRIES=$(grep -c '"type":"ENTRY"' "$SHADOW_FILE" 2>/dev/null || echo "N/A")
    EXITS=$(grep -c '"type":"EXIT"' "$SHADOW_FILE" 2>/dev/null || echo "N/A")
    HOLDS=$(tail -100 "$SHADOW_FILE" 2>/dev/null | grep -c '"action":"HOLD"' || echo "N/A")
    
    echo "  File:          $SHADOW_FILE ($FILE_SIZE)"
    echo "  Last Update:   $LAST_UPDATE"
    echo "  Entries:       $ENTRIES"
    echo "  Exits:         $EXITS"
    echo "  HOLD (last100):$HOLDS"
  else
    echo "  ⚠️  No shadow trades file found"
  fi
  echo ""
  
  # Recent Activity
  echo "📈 RECENT ACTIVITY (Last 5 decisions)"
  echo "────────────────────────────────────────────────────────────"
  pm2 logs algoqbot --lines 100 --nostream 2>/dev/null | \
    grep "AI Strategy executed\|Volatility too low\|Portfolio balanced" | \
    tail -5 | \
    sed 's/^0|algoqbot | //' | \
    sed 's/\[32minfo\[39m//' | \
    sed 's/\[34mdebug\[39m//' | \
    cut -c1-80
  echo "────────────────────────────────────────────────────────────"
  echo ""
  
  # Error Check
  ERROR_COUNT=$(pm2 logs algoqbot --lines 100 --nostream --err 2>/dev/null | wc -l | tr -d ' ')
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "⚠️  ERRORS: $ERROR_COUNT in last 100 lines"
  fi
  
  # Footer
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║  Last updated: $(date '+%Y-%m-%d %H:%M:%S')                    "
  echo "║  Press Ctrl+C to exit                                      ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  
  # Refresh every 5 seconds
  sleep 5
done
