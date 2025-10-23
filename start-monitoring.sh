#!/bin/bash

# Script de démarrage du monitoring automatique
# Usage: ./start-monitoring.sh

cd /Users/sheirraza/bsc-ranging-bot

echo "🚀 Démarrage du monitoring automatique..."
echo ""

# Créer le dossier logs si nécessaire
mkdir -p logs

# Vérifier si le monitoring tourne déjà
if pgrep -f "monitor-positions.js" > /dev/null; then
  echo "⚠️  Le monitoring est déjà en cours d'exécution!"
  echo ""
  echo "Pour voir les logs en temps réel:"
  echo "  tail -f logs/position-monitoring.log"
  echo ""
  echo "Pour arrêter le monitoring:"
  echo "  ./stop-monitoring.sh"
  exit 1
fi

# Lancer le monitoring en arrière-plan
nohup node scripts/monitor-positions.js > logs/monitoring-console.log 2>&1 &

MONITOR_PID=$!

echo "✅ Monitoring démarré! (PID: $MONITOR_PID)"
echo ""
echo "📊 Le bot va générer un rapport toutes les heures"
echo ""
echo "📁 Fichiers générés:"
echo "   - logs/position-monitoring.log (rapports détaillés)"
echo "   - logs/monitoring-console.log (logs système)"
echo "   - data/monitoring-summary.json (dernier résumé)"
echo ""
echo "🔍 Commandes utiles:"
echo "   - Voir les rapports:  tail -f logs/position-monitoring.log"
echo "   - Voir le dernier:    cat data/monitoring-summary.json | jq"
echo "   - Arrêter:            ./stop-monitoring.sh"
echo ""






