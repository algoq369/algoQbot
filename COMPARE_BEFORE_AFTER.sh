#!/bin/bash

# Script de comparaison AVANT/APRÈS 9 heures de sleep
# Usage: ./COMPARE_BEFORE_AFTER.sh

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║   📊 COMPARAISON AVANT/APRÈS 9H SLEEP 📊                         ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Heure actuelle
echo "⏰ HEURE: $(date '+%Hh%M - %d/%m/%Y')"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Bots status
echo "🤖 STATUS DES BOTS:"
echo ""

if ps aux | grep "AdvancedTradingBot" | grep -v grep > /dev/null; then
  BOT_STATUS="✅ ACTIF"
  BOT_PID=$(ps aux | grep "AdvancedTradingBot" | grep -v grep | awk '{print $2}')
else
  BOT_STATUS="❌ ARRÊTÉ"
  BOT_PID="N/A"
fi

if ps aux | grep "monitor-positions" | grep -v grep > /dev/null; then
  MON_STATUS="✅ ACTIF"
  MON_PID=$(ps aux | grep "monitor-positions" | grep -v grep | awk '{print $2}')
else
  MON_STATUS="❌ ARRÊTÉ"
  MON_PID="N/A"
fi

echo "   Bot Principal: $BOT_STATUS (PID: $BOT_PID)"
echo "   Monitoring: $MON_STATUS (PID: $MON_PID)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Trade count & P&L comparison
echo "📊 TRADE COUNT & P&L:"
echo ""

cd /Users/sheirraza/bsc-ranging-bot

# Get current values
CURRENT_TRADES=$(sqlite3 data/trading_bot.db "SELECT COUNT(*) FROM trades;" 2>/dev/null)
CURRENT_PNL=$(sqlite3 data/trading_bot.db "SELECT ROUND(SUM(profit_loss), 2) FROM trades;" 2>/dev/null)
CURRENT_WINS=$(sqlite3 data/trading_bot.db "SELECT COUNT(*) FROM trades WHERE profit_loss > 0;" 2>/dev/null)
CURRENT_LOSSES=$(sqlite3 data/trading_bot.db "SELECT COUNT(*) FROM trades WHERE profit_loss < 0;" 2>/dev/null)

# Reference values (from 22h30 snapshot)
REF_TRADES=95
REF_PNL=0.00

# Calculate changes
TRADE_DIFF=$((CURRENT_TRADES - REF_TRADES))
PNL_DIFF=$(echo "$CURRENT_PNL - $REF_PNL" | bc 2>/dev/null)

echo "   AVANT (22h30):"
echo "   ├─ Trades: $REF_TRADES"
echo "   ├─ P&L: \$$REF_PNL"
echo "   ├─ Wins: 0"
echo "   └─ Losses: 0"
echo ""

echo "   APRÈS (maintenant):"
echo "   ├─ Trades: $CURRENT_TRADES"
echo "   ├─ P&L: \$$CURRENT_PNL"
echo "   ├─ Wins: $CURRENT_WINS"
echo "   └─ Losses: $CURRENT_LOSSES"
echo ""

echo "   📈 CHANGEMENT:"
if [ "$TRADE_DIFF" -gt 0 ]; then
  echo "   ├─ Nouveaux trades: +$TRADE_DIFF ✅"
else
  echo "   ├─ Nouveaux trades: $TRADE_DIFF ⚠️"
fi

if [ $(echo "$PNL_DIFF > 0" | bc -l 2>/dev/null) -eq 1 ]; then
  echo "   └─ P&L: +\$$PNL_DIFF 🟢"
elif [ $(echo "$PNL_DIFF < 0" | bc -l 2>/dev/null) -eq 1 ]; then
  echo "   └─ P&L: \$$PNL_DIFF 🔴"
else
  echo "   └─ P&L: \$0.00 ⚪"
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Win rate
if [ "$CURRENT_WINS" -gt 0 ] || [ "$CURRENT_LOSSES" -gt 0 ]; then
  TOTAL_EXITS=$((CURRENT_WINS + CURRENT_LOSSES))
  WIN_RATE=$(echo "scale=1; $CURRENT_WINS * 100 / $TOTAL_EXITS" | bc 2>/dev/null)

  echo "🎯 WIN RATE:"
  echo ""
  echo "   Win Rate: ${WIN_RATE}%"
  echo "   Wins: $CURRENT_WINS"
  echo "   Losses: $CURRENT_LOSSES"
  echo "   Total Exits: $TOTAL_EXITS"
  echo ""

  if [ $(echo "$WIN_RATE > 60" | bc -l 2>/dev/null) -eq 1 ]; then
    echo "   ✅ EXCELLENT (>60%)"
  elif [ $(echo "$WIN_RATE > 50" | bc -l 2>/dev/null) -eq 1 ]; then
    echo "   ⚠️ ACCEPTABLE (50-60%)"
  else
    echo "   🚨 FAIBLE (<50%)"
  fi
  echo ""
else
  echo "🎯 WIN RATE:"
  echo ""
  echo "   ⏳ Pas encore de sorties"
  echo "   Wins: 0"
  echo "   Losses: 0"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Portfolio
echo "💰 PORTFOLIO:"
echo ""

LATEST_BALANCE=$(tail -20 logs/combined.log 2>/dev/null | grep "virtual balances" | tail -1 | grep -o "balances: [^}]*" | sed 's/balances: //')

if [ -n "$LATEST_BALANCE" ]; then
  echo "   AVANT (22h30):"
  echo "   ├─ USDT: 217.70"
  echo "   ├─ BNB: 45.314845"
  echo "   └─ Total: \$59,842.49"
  echo ""

  echo "   APRÈS (maintenant):"
  echo "   └─ $LATEST_BALANCE"
  echo ""
else
  echo "   ⚠️ Impossible de récupérer les balances actuelles"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open positions
echo "📈 POSITIONS ACTIVES:"
echo ""

ACTIVE_POS=$(tail -100 logs/combined.log 2>/dev/null | grep "Monitoring position" | wc -l | tr -d ' ')

echo "   AVANT (22h30): 14 positions"
echo "   APRÈS (maintenant): $ACTIVE_POS positions"
echo ""

if [ "$ACTIVE_POS" -gt 14 ]; then
  DIFF=$((ACTIVE_POS - 14))
  echo "   📈 +$DIFF nouvelles positions"
elif [ "$ACTIVE_POS" -lt 14 ]; then
  DIFF=$((14 - ACTIVE_POS))
  echo "   📉 -$DIFF positions (sorties)"
else
  echo "   ⚪ Pas de changement"
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Errors check
echo "🔍 VÉRIFICATION ERREURS:"
echo ""

ERRORS=$(tail -200 logs/combined.log 2>/dev/null | grep -c "ERROR")
WARNINGS=$(tail -200 logs/combined.log 2>/dev/null | grep -c "WARN")

if [ "$ERRORS" -eq 0 ]; then
  echo "   Erreurs: ✅ AUCUNE"
else
  echo "   Erreurs: ⚠️ $ERRORS dans dernières 200 lignes"
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "   Warnings: ⚠️ $WARNINGS (normal si Claude API deprecated)"
else
  echo "   Warnings: ✅ AUCUNE"
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Final summary
echo "✅ RÉSUMÉ:"
echo ""

if [ "$BOT_STATUS" = "✅ ACTIF" ] && [ "$MON_STATUS" = "✅ ACTIF" ]; then
  echo "   🎉 Les 2 bots fonctionnent!"

  if [ "$TRADE_DIFF" -gt 50 ]; then
    echo "   📈 Bonne activité de trading (+$TRADE_DIFF trades)"
  elif [ "$TRADE_DIFF" -gt 0 ]; then
    echo "   📊 Trading actif (+$TRADE_DIFF trades)"
  else
    echo "   ⚠️ Peu ou pas de nouveaux trades"
  fi

  if [ -n "$PNL_DIFF" ] && [ $(echo "$PNL_DIFF > 0" | bc -l 2>/dev/null) -eq 1 ]; then
    echo "   💰 Profit réalisé: +\$$PNL_DIFF ✅"
  elif [ -n "$PNL_DIFF" ] && [ $(echo "$PNL_DIFF < -100" | bc -l 2>/dev/null) -eq 1 ]; then
    echo "   💸 Perte importante: \$$PNL_DIFF 🚨"
  elif [ -n "$PNL_DIFF" ] && [ $(echo "$PNL_DIFF < 0" | bc -l 2>/dev/null) -eq 1 ]; then
    echo "   💸 Perte mineure: \$$PNL_DIFF ⚠️"
  else
    echo "   ⏳ Pas encore de P&L réalisé"
  fi

  if [ "$ERRORS" -eq 0 ]; then
    echo "   ✅ Aucune erreur"
  else
    echo "   ⚠️ $ERRORS erreurs détectées"
  fi
else
  echo "   🚨 UN OU PLUSIEURS BOTS ARRÊTÉS!"
  echo "   Redémarrer avec: npm start & sleep 10 && ./start-monitoring.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Next steps
echo "🎯 PROCHAINES ÉTAPES:"
echo ""
echo "   1. Lire SNAPSHOT_22H30_AVANT_SLEEP.md (état de base)"
echo "   2. Comparer avec métriques actuelles ci-dessus"
echo "   3. Analyser le P&L et win rate"
echo "   4. Ajuster paramètres si nécessaire"
echo ""








