#!/bin/bash
# IMMEDIATE ACTION SCRIPT - Run This Now
# Created: 2025-10-25

echo "🔍 STEP 1: Checking Circuit Breaker Status..."
echo "===================="
tail -100 /Users/sheirraza/bsc-ranging-bot/logs/error-2025-10-25.log | grep -i "circuit\|failure" | tail -20

echo ""
echo "🔍 STEP 2: Checking Risk Manager State..."
echo "===================="
cat /Users/sheirraza/bsc-ranging-bot/logs/combined-2025-10-25.log.1 | grep -i "daily loss\|drawdown\|emergency\|risk limit" | tail -10

echo ""
echo "🔍 STEP 3: Current Active Positions..."
echo "===================="
tail -50 /Users/sheirraza/bsc-ranging-bot/logs/combined-2025-10-25.log.1 | grep "Active Positions:" | tail -3

echo ""
echo "🔍 STEP 4: Recent Trading Decisions..."
echo "===================="
tail -100 /Users/sheirraza/bsc-ranging-bot/logs/combined-2025-10-25.log.1 | grep "Making trading decision\|HOLD\|BUY\|SELL" | tail -10

echo ""
echo "📊 ANALYSIS COMPLETE"
echo "===================="
echo ""
echo "Next Steps:"
echo "1. If circuit breaker active due to error → Fix error then reset"
echo "2. If circuit breaker active due to loss limit → Wait for daily reset"
echo "3. If no errors found → Manually reset circuit breaker:"
echo "   curl -X POST http://localhost:3001/api/circuit-breaker/reset"
echo ""
echo "4. To lower TP targets for low volatility (RECOMMENDED):"
echo "   Add to .env file:"
echo "   BASE_TP_PERCENT=0.006"
echo "   BASE_SL_PERCENT=0.004"
echo ""
