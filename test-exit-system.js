#!/usr/bin/env node

/**
 * Exit System Test Script
 * Tests the critical exit functionality that's currently failing
 */

const logger = require('./logger');
const AdvancedTradingBot = require('./AdvancedTradingBot');

async function testExitSystem() {
  logger.info('🧪 Starting Exit System Test...');

  try {
    // Initialize bot
    const bot = new AdvancedTradingBot();
    await bot.initialize();

    // Get current price
    const currentPrice = await bot.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
    logger.info(`📈 Current BNB/USDT price: ${currentPrice}`);

    // Check if trading strategy agent exists
    if (!bot.tradingStrategyAgent) {
      logger.error('❌ TradingStrategyAgent not initialized');
      return;
    }

    // Check active positions
    const activePositions = bot.tradingStrategyAgent.activePositions;
    logger.info(`📊 Active positions: ${activePositions.size}`);

    if (activePositions.size === 0) {
      logger.warn('⚠️ No active positions to test exits with');
      logger.info('💡 This is likely why you have 0 exits - no positions are being created');
      return;
    }

    // Test each position
    for (const [positionId, position] of activePositions) {
      logger.info(`\n🔍 Testing position ${positionId}:`);
      logger.info(`  Side: ${position.side || 'UNDEFINED'}`);
      logger.info(`  Entry: ${position.entryPrice?.toFixed(8) || 'UNDEFINED'}`);
      logger.info(`  Size: ${position.size?.toFixed(2) || 'UNDEFINED'}`);
      logger.info(`  Strategy: ${position.strategy || 'UNDEFINED'}`);

      // Check if position.side is properly defined
      if (!position.side) {
        logger.error(`❌ Position ${positionId} has undefined side!`);
        continue;
      }

      // Calculate profit
      const profit = position.side === 'buy'
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice;

      logger.info(`  Current profit: ${(profit * 100).toFixed(3)}%`);

      // Check exit conditions
      const FIXED_TP_PERCENT = 0.003; // 0.3%

      logger.info(`  TP check (0.3%): ${profit >= FIXED_TP_PERCENT ? '✅ PASS' : '❌ FAIL'}`);

      // Test max hold time
      const holdTime = Date.now() - (position.entryTime || Date.now());
      const maxHoldTime = 4 * 3600000; // 4 hours
      logger.info(`  Hold time: ${(holdTime / 3600000).toFixed(1)}h (max: 4h)`);
      logger.info(`  Max time check: ${holdTime > maxHoldTime ? '✅ PASS' : '❌ FAIL'}`);

      // Test stop loss
      if (position.stopLoss) {
        const stopLossHit = position.side === 'buy'
          ? currentPrice <= position.stopLoss
          : currentPrice >= position.stopLoss;
        logger.info(`  Stop loss check: ${stopLossHit ? '✅ PASS' : '❌ FAIL'}`);
      } else {
        logger.warn(`  ⚠️ Position ${positionId} has no stop loss set!`);
      }
    }

    // Test BugBot integration
    if (bot.bugBot) {
      logger.info('\n🐛 Testing BugBot integration...');

      const metrics = {
        totalTrades: activePositions.size,
        exits: 0, // We expect this to be 0 since exits aren't working
        wins: 0,
        losses: 0,
        totalPnL: 0
      };

      await bot.bugBot.monitorTradingMetrics(metrics);

      const criticalBugs = bot.bugBot.getCriticalBugs();
      logger.info(`🐛 Critical bugs detected: ${criticalBugs.length}`);

      if (criticalBugs.length > 0) {
        logger.warn('🐛 Critical bugs found:');
        criticalBugs.forEach((bug, i) => {
          logger.warn(`  ${i + 1}. ${bug.description}`);
        });
      }
    }

    logger.info('\n✅ Exit system test completed');

  } catch (error) {
    logger.error('❌ Exit system test failed:', error);
  }
}

// Run the test
testExitSystem().then(() => {
  logger.info('🏁 Test finished');
  process.exit(0);
}).catch((error) => {
  logger.error('💥 Test crashed:', error);
  process.exit(1);
});









