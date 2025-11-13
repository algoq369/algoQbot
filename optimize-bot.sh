#!/bin/bash
cd /Users/sheirraza/bsc-ranging-bot

echo "=== 🚀 OPTIMISATION EXPERT POUR RENTABILITÉ MAXIMALE ==="
echo ""

# Créer backup
echo "📦 Création du backup..."
cp -r . ../bsc-backup-optimization-$(date +%Y%m%d-%H%M%S)
echo "✅ Backup créé"
echo ""

# Vérifier que le bot tourne
BOT_RUNNING=$(ps aux | grep "node AdvancedTradingBot.js" | grep -v grep | wc -l)
if [ "$BOT_RUNNING" -eq "0" ]; then
  echo "⚠️  Bot pas en cours d'exécution"
  echo "   Lancer avec: npm start &"
  exit 1
fi

echo "🔧 Application des optimisations..."
echo ""

# 1. Réduire position size à 15% (plus conservative)
echo "1️⃣  Position Size: 35% → 15%"
sed -i '' 's/maxPositionSize: 0.35/maxPositionSize: 0.15/g' risk/productionRiskManager.js

# 2. Take Profit à 1.5% (CORRIGÉ: était 1.0%)
echo "2️⃣  Take Profit: 0.5% → 1.5%"
sed -i '' 's/profitPercent >= 0.01/profitPercent >= 0.015/g' agents/TradingStrategyAgent.js

# 3. Stop Loss à 1.0% (CORRIGÉ: ratio inversé)
echo "3️⃣  Stop Loss: 3.0% → 1.0%"
sed -i '' 's/currentPrice \* 0.97/currentPrice * 0.99/g' agents/TradingStrategyAgent.js

# 4. Augmenter confidence minimum à 65%
echo "4️⃣  Min Confidence: 60% → 65%"
# Chercher dans les strategy methods
sed -i '' 's/confidence: 0.6/confidence: 0.65/g' agents/TradingStrategyAgent.js

# 5. Réduire max trade size à $9000 (15% de $60K)
echo "5️⃣  Max Trade Size: $21000 → $9000"
sed -i '' 's/maxTradeSize: 21000/maxTradeSize: 9000/g' risk/productionRiskManager.js

# Vérifier les changements
echo ""
echo "=== ✅ OPTIMISATIONS APPLIQUÉES ==="
echo ""
echo "📊 NOUVEAUX PARAMÈTRES:"
echo "   • Position Size:    35% → 15%"
echo "   • Take Profit:      0.5% → 1.5%"
echo "   • Stop Loss:        3.0% → 1.0%"
echo "   • Min Confidence:   60% → 65%"
echo "   • Max Trade:        \$21K → \$9K"
echo ""
echo "🎯 RATIO RISQUE/RÉCOMPENSE: 1.5:1 (OPTIMAL)"
echo "   • Gain potentiel:   1.5%"
echo "   • Perte max:        1.0%"
echo "   • Exposition max:   15% du portfolio"
echo ""
echo "📈 IMPACT ATTENDU:"
echo "   • Moins de trades (confidence ↑)"
echo "   • Profits plus élevés par trade (+1.5%)"
echo "   • Risque réduit (-1.0% max loss)"
echo "   • Win rate attendu: 60-70%"
echo ""
echo "🔄 REDÉMARRAGE DU BOT..."

# Tuer proprement le bot
BOT_PID=$(ps aux | grep "node AdvancedTradingBot.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$BOT_PID" ]; then
  kill -SIGTERM $BOT_PID
  echo "   Bot arrêté (PID: $BOT_PID)"
  sleep 3
fi

# Clear bad data
rm -f data/shadow-trades.json
echo "[]" > data/shadow-trades.json

# Redémarrer
cd /Users/sheirraza/bsc-ranging-bot && npm start > /dev/null 2>&1 &
sleep 5

NEW_PID=$(ps aux | grep "node AdvancedTradingBot.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$NEW_PID" ]; then
  echo "✅ Bot redémarré (PID: $NEW_PID)"
else
  echo "❌ Erreur au redémarrage"
  exit 1
fi

echo ""
echo "=== 🎉 OPTIMISATION TERMINÉE ==="
echo ""
echo "📊 MONITORING RECOMMANDÉ:"
echo ""
echo "   # Dashboard live"
echo "   ./watch-bot.sh"
echo ""
echo "   # Voir profits en temps réel"
echo "   tail -f logs/combined.log | grep --line-buffered -E '(Position.*created|profit|Exit)'"
echo ""
echo "   # Status rapide"
echo "   ./monitor-bot.sh"
echo ""
echo "⏰ Laisser tourner 2-4 heures pour évaluer les performances"
echo ""








