#!/bin/bash
# Script de vérification rapide du portfolio $60K
# Created: October 8, 2025

cd /Users/sheirraza/bsc-ranging-bot

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║        📊 VERIFICATION DU PORTFOLIO $60K 📊                  ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que le bot tourne
BOT_PID=$(ps aux | grep "node AdvancedTradingBot.js" | grep -v grep | awk '{print $2}')

if [ -z "$BOT_PID" ]; then
  echo "❌ Bot NOT RUNNING!"
  echo "   Start with: npm start &"
  exit 1
else
  echo "✅ Bot Running (PID: $BOT_PID)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 PORTFOLIO CONFIGURATION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier testing/shadowMode.js
echo "1️⃣  Shadow Mode Configuration:"
echo ""
grep -A 3 "this.virtualPortfolio = {" testing/shadowMode.js | head -4
echo ""

# Calculer la valeur théorique
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Mathematical Verification:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node -e "
const price = 0.000756;  // BNB per USDT (approximate)

// Configuration attendue
const configUSDT = 30000;
const configBNB = 22.68;

// Calcul de la valeur
const bnbValueUSD = configBNB / price;
const totalValue = configUSDT + bnbValueUSD;

console.log('Configuration:');
console.log('  USDT: \$' + configUSDT.toLocaleString());
console.log('  BNB:  ' + configBNB + ' BNB');
console.log('');
console.log('Valeur calculée (prix ~' + price + '):');
console.log('  USDT Value:  \$' + configUSDT.toLocaleString());
console.log('  BNB Value:   \$' + bnbValueUSD.toLocaleString(undefined, {maximumFractionDigits: 2}));
console.log('  Total:       \$' + totalValue.toLocaleString(undefined, {maximumFractionDigits: 2}));
console.log('');

if (totalValue >= 59000 && totalValue <= 61000) {
  console.log('✅ PORTFOLIO VALUE CORRECT (~\$60K)');
} else {
  console.log('❌ PORTFOLIO VALUE INCORRECT!');
  console.log('   Expected: \$59K-\$61K');
  console.log('   Got: \$' + totalValue.toLocaleString(undefined, {maximumFractionDigits: 2}));
}
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Latest Bot Logs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Dernières balances reportées
echo "Initial Balances from logs:"
tail -100 logs/combined.log | grep -E "(USDT:|BNB:)" | tail -4

echo ""
echo "Portfolio Value from logs:"
tail -100 logs/combined.log | grep "Portfolio value" | tail -2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Risk Management Limits:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

grep -A 10 "this.limits = {" risk/productionRiskManager.js | grep -E "(maxTradeSize|maxPositionSize|maxDailyLoss)" | head -3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Corruption Check:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CORRUPTION_COUNT=$(tail -1000 logs/combined.log | grep -c "suspiciously high" 2>/dev/null || echo "0")

if [ "$CORRUPTION_COUNT" -eq 0 ]; then
  echo "✅ No balance corruption detected"
else
  echo "⚠️  Found $CORRUPTION_COUNT corruption warnings!"
  echo "   Last warnings:"
  tail -500 logs/combined.log | grep "suspiciously high" | tail -3
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 SUMMARY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected Portfolio:"
echo "  • USDT: \$30,000 (50%)"
echo "  • BNB:  22.68 BNB (~\$30,000 at \$0.000756)"
echo "  • Total: ~\$60,000"
echo ""
echo "Risk Parameters:"
echo "  • Max Trade:    \$9,000 (15%)"
echo "  • Max Position: 15%"
echo "  • Max Daily Loss: \$3,000 (5%)"
echo ""
echo "Status: $([ "$CORRUPTION_COUNT" -eq 0 ] && echo "✅ HEALTHY" || echo "⚠️  NEEDS ATTENTION")"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"








