#!/bin/bash
# Quick monitoring script

echo "🤖 Bot Status: $(pgrep -f "AdvancedTradingBot.js" > /dev/null && echo "RUNNING" || echo "STOPPED")"
echo "📊 Today's Cycles: $(grep "Making trading decision" logs/combined-$(date +%Y-%m-%d).log* 2>/dev/null | wc -l | tr -d ' ')"
echo "💰 Shadow Trades: $(grep "👻 Shadow.*Allowed" logs/combined-$(date +%Y-%m-%d).log* 2>/dev/null | wc -l | tr -d ' ')"
