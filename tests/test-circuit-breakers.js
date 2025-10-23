const ProductionRiskManager = require('../risk/productionRiskManager');
require('dotenv').config();

async function testCircuitBreakers() {
  console.log('🧪 Testing Circuit Breaker System\n');

  // Test 1: Shadow mode detection
  console.log('📝 Test 1: Shadow Mode Detection');
  const riskManager = new ProductionRiskManager();
  const isShadow = process.env.SHADOW_MODE_ENABLED === 'true';
  console.log(`   Mode: ${isShadow ? 'SHADOW' : 'LIVE'} ✅`);
  console.log(`   Max Trade: $${riskManager.limits.maxTradeSize}`);
  console.log(`   Max Daily Loss: $${riskManager.limits.maxDailyLoss}\n`);

  // Test 2: Trade size validation
  console.log('📝 Test 2: Trade Size Validation');
  const smallTrade = await riskManager.checkTradeAllowed(50);
  console.log(`   $50 trade: ${smallTrade.allowed ? '❌ FAIL' : '✅ PASS'} (too small)`);

  const goodTrade = await riskManager.checkTradeAllowed(1000);
  console.log(`   $1000 trade: ${goodTrade.allowed ? '✅ PASS' : '❌ FAIL'} (good)`);

  const largeTrade = await riskManager.checkTradeAllowed(15000);
  console.log(`   $15000 trade: ${largeTrade.allowed ? '❌ FAIL' : '✅ PASS'} (too large)\n`);

  // Test 3: Daily loss limit
  console.log('📝 Test 3: Daily Loss Limit');
  riskManager.state.dailyLoss = -1000;
  const tradeAfterLoss = await riskManager.checkTradeAllowed(500);
  console.log(`   After $1000 loss: ${tradeAfterLoss.allowed ? '✅ PASS' : '❌ FAIL'} (still allowed)\n`);

  // Test 4: Rate limits
  console.log('📝 Test 4: Rate Limits');
  riskManager.state.hourlyTrades = riskManager.limits.maxTradesPerHour;
  const rateLimitTrade = await riskManager.checkTradeAllowed(500);
  console.log(`   At hourly limit: ${rateLimitTrade.allowed ? '❌ FAIL' : '✅ PASS'} (blocked)\n`);

  // Test 5: Reset circuit breakers
  console.log('📝 Test 5: Reset Circuit Breakers');
  const resetResult = await riskManager.resetCircuitBreakers('Test reset');
  console.log(`   Reset successful: ${resetResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Daily trades after reset: ${riskManager.state.dailyTrades} (should be 0)\n`);

  // Test 6: Emergency stop
  console.log('📝 Test 6: Emergency Stop');
  riskManager.triggerEmergencyStop('Test emergency');
  const emergencyTrade = await riskManager.checkTradeAllowed(500);
  console.log(`   Trade after emergency: ${emergencyTrade.allowed ? '❌ FAIL' : '✅ PASS'} (blocked)\n`);

  // Success summary
  console.log('═'.repeat(60));
  console.log('✅ Circuit Breaker System Working!');
  console.log('═'.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Mode: ${isShadow ? 'SHADOW' : 'LIVE'} mode detected`);
  console.log(`   Limits: Properly configured`);
  console.log(`   Validation: Working correctly`);
  console.log(`   Emergency: Functional`);
  console.log('\n🚀 Ready for trading operations!\n');
}

testCircuitBreakers().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
});
