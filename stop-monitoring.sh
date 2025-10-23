#!/bin/bash

# Script d'arrêt du monitoring automatique
# Usage: ./stop-monitoring.sh

cd /Users/sheirraza/bsc-ranging-bot

echo "🛑 Arrêt du monitoring automatique..."
echo ""

# Trouver le PID du processus de monitoring
MONITOR_PID=$(pgrep -f "monitor-positions.js")

if [ -z "$MONITOR_PID" ]; then
  echo "⚠️  Aucun processus de monitoring en cours"
  exit 0
fi

# Arrêter le processus
kill $MONITOR_PID

echo "✅ Monitoring arrêté (PID: $MONITOR_PID)"
echo ""
echo "📁 Les logs et rapports sont toujours disponibles:"
echo "   - logs/position-monitoring.log"
echo "   - data/monitoring-summary.json"
echo ""






