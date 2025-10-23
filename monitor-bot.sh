#!/bin/bash
# Script de monitoring du bot BSC

echo "🤖 BSC TRADING BOT - LIVE MONITORING"
echo "===================================="
echo ""

# 1. Statut du bot
echo "📊 BOT STATUS:"
ps aux | grep "node.*AdvancedTradingBot" | grep -v grep | awk '{print "   PID: "$2" | CPU: "$3"% | Memory: "$4"% | Runtime: "$10}'
echo ""

# 2. Portfolio actuel
echo "💰 CURRENT PORTFOLIO:"
tail -100 logs/combined.log | grep "virtual balances" | tail -1 | grep -o '[0-9.]\+ USDT, [0-9.]\+ BNB' | awk '{print "   "$0}'
echo ""

# 3. Dernières décisions
echo "🎯 LAST 3 TRADING DECISIONS:"
tail -200 logs/combined.log | grep "Trading decision made" | tail -3 | grep -o 'action":"[^"]*","confidence":[^,]*,"reasoning":"[^"]*' | awk -F'"' '{print "   "$2" (conf: "$4") - "$6}' | sed 's/,confidence://'
echo ""

# 4. Positions actives
echo "📈 ACTIVE POSITIONS:"
POSITIONS=$(tail -100 logs/combined.log | grep "monitorPositions() called" | tail -1)
if [ -z "$POSITIONS" ]; then
    echo "   No recent monitoring data"
else
    tail -100 logs/combined.log | grep "Monitoring position" | tail -5 | awk -F'"' '{print "   "$4}' | grep -o 'profit [^,]*' || echo "   No active positions"
fi
echo ""

# 5. Corruption check
echo "⚠️  CORRUPTION CHECK:"
CORRUPTION=$(tail -500 logs/combined.log | grep -c "suspiciously high")
echo "   $CORRUPTION warnings (0 = perfect!)"
echo ""

# 6. Derniers trades
echo "💼 RECENT TRADES:"
tail -200 logs/combined.log | grep "Shadow Trade:" | tail -3 | awk -F'"' '{print "   "$4}'
echo ""

echo "📁 Pour plus de détails, utilisez:"
echo "   tail -f logs/combined.log                    # Logs en temps réel"
echo "   tail -f logs/combined.log | grep Position    # Positions seulement"
echo "   tail -f logs/combined.log | grep profit      # Profits seulement"
