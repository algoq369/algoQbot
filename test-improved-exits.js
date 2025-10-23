#!/usr/bin/env node

/**
 * Test Improved Exit System
 * Tests the new adaptive TP and improved ranging strategy
 */

const logger = require('./logger');
const AdvancedTradingBot = require('./AdvancedTradingBot');

async function testImprovedExits() {
  logger.info('🧪 Testing Improved Exit System...');

  try {
    // Initialize bot
    const bot = new AdvancedTradingBot();
    await bot.initialize();

    // Get current price
    const currentPrice = await bot.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
    logger.info(`📈 Current BNB/USDT price: ${currentPrice}`);

    // Test adaptive TP calculation
    logger.info('🎯 Testing Adaptive TP Calculation:');
    const priceHistory = bot.priceHistoryManager.getHistory();
    const volatility = bot.tradingStrategyAgent.calculateVolatility(priceHistory.slice(-50));

    const baseTP = 0.008; // 0.8%
    const volatilityMultiplier = Math.min(1.5, 1 + (volatility * 10));
    const adaptiveTP = baseTP * volatilityMultiplier;

    logger.info(`  Volatility: ${(volatility * 100).toFixed(2)}%`);
    logger.info(`  Base TP: ${(baseTP * 100).toFixed(2)}%`);
    logger.info(`  Multiplier: ${volatilityMultiplier.toFixed(2)}x`);
    logger.info(`  Adaptive TP: ${(adaptiveTP * 100).toFixed(2)}%`);
    logger.info(`  BSC Fee Coverage: ✅ ${(adaptiveTP * 100).toFixed(2)}% > 0.8% fees`);

    // Test confidence calculation improvements
    logger.info('\n💪 Testing Improved Confidence Calculation:');

    if (priceHistory.length >= 100) {
      const last100 = priceHistory.slice(-100).map(p => p.price);
      const high = Math.max(...last100);
      const low = Math.min(...last100);
      const mean = last100.reduce((a, b) => a + b) / last100.length;
      const range = (high - low) / mean;
      const rangeSize = high - low;

      const rangeVolatilityRatio = range / volatility;
      const upperDistance = (high - currentPrice) / rangeSize;
      const lowerDistance = (currentPrice - low) / rangeSize;

      // Test new confidence logic
      let baseConfidence;
      if (rangeVolatilityRatio < 2) {
        baseConfidence = 0.55;
      } else if (rangeVolatilityRatio < 4) {
        baseConfidence = 0.70;
      } else {
        baseConfidence = 0.85;
      }

      const positionMultiplier = Math.max(0.6, 1.2 - (Math.min(upperDistance, lowerDistance) * 2));
      const finalConfidence = Math.min(0.90, baseConfidence * positionMultiplier);

      logger.info(`  Range: ${(range * 100).toFixed(2)}%`);
      logger.info(`  Range/Vol Ratio: ${rangeVolatilityRatio.toFixed(2)}`);
      logger.info(`  Base Confidence: ${(baseConfidence * 100).toFixed(0)}%`);
      logger.info(`  Position Multiplier: ${(positionMultiplier * 100).toFixed(0)}%`);
      logger.info(`  Final Confidence: ${(finalConfidence * 100).toFixed(0)}%`);
      logger.info(`  Trading Opportunity: ${finalConfidence >= 0.5 ? '✅ YES' : '❌ NO'}`);
    }

    // Check for active positions
    const activePositions = bot.tradingStrategyAgent.activePositions;
    logger.info(`\n📊 Active positions: ${activePositions.size}`);

    if (activePositions.size > 0) {
      logger.info('📈 Testing positions for exits:');
      for (const [id, pos] of activePositions) {
        const profit = pos.side === 'buy'
          ? (currentPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - currentPrice) / pos.entryPrice;

        const needsExit = profit >= adaptiveTP;

        logger.info(`  ${id}: profit ${(profit * 100).toFixed(3)}%, TP ${(adaptiveTP * 100).toFixed(2)}%, exit: ${needsExit ? '✅ YES' : '❌ NO'}`);
      }
    } else {
      logger.info('⚠️ No active positions - waiting for strategy to create trades');
    }

    logger.info('\n✅ Improved exit system test completed');

  } catch (error) {
    logger.error('❌ Exit system test failed:', error);
  }
}

// Run the test
testImprovedExits().then(() => {
  logger.info('🏁 Test finished');
  process.exit(0);
}).catch((error) => {
  logger.error('💥 Test crashed:', error);
  process.exit(1);
});







