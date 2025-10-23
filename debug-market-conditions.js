#!/usr/bin/env node

/**
 * Debug Market Conditions Script
 * Checks why positions aren't being created - likely market not ranging
 */

const logger = require('./logger');
const AdvancedTradingBot = require('./AdvancedTradingBot');

async function debugMarketConditions() {
  logger.info('🔍 Debugging market conditions...');

  try {
    // Initialize bot
    const bot = new AdvancedTradingBot();
    await bot.initialize();

    // Get current price
    const currentPrice = await bot.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
    logger.info(`📈 Current BNB/USDT price: ${currentPrice}`);

    // Get price history
    const priceHistory = bot.priceHistoryManager.getHistory();
    logger.info(`📊 Price history points: ${priceHistory.length}`);

    if (priceHistory.length < 100) {
      logger.warn(`⚠️ Insufficient price history: ${priceHistory.length} < 100 needed for ranging detection`);
      return;
    }

    // Check market ranging (same logic as TradingStrategyAgent)
    const last100 = priceHistory.slice(-100).map(p => p.price);
    const high = Math.max(...last100);
    const low = Math.min(...last100);
    const mean = last100.reduce((a, b) => a + b) / last100.length;
    const range = (high - low) / mean;

    logger.info(`📊 Range analysis (last 100 prices):`);
    logger.info(`  High: ${high.toFixed(8)}`);
    logger.info(`  Low: ${low.toFixed(8)}`);
    logger.info(`  Mean: ${mean.toFixed(8)}`);
    logger.info(`  Range: ${(range * 100).toFixed(4)}%`);

    // Check for trend
    const firstHalf = last100.slice(0, 50);
    const secondHalf = last100.slice(50);
    const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    const trendStrength = Math.abs(secondAvg - firstAvg) / firstAvg;

    logger.info(`📈 Trend analysis:`);
    logger.info(`  First half avg: ${firstAvg.toFixed(8)}`);
    logger.info(`  Second half avg: ${secondAvg.toFixed(8)}`);
    logger.info(`  Trend strength: ${(trendStrength * 100).toFixed(4)}%`);

    // Ranging decision logic
    let isRanging = true;
    let reason = '';

    if (range < 0.0001) {
      isRanging = false;
      reason = `Range too tight (${(range * 100).toFixed(2)}% < 0.01%)`;
    } else if (range > 0.06) {
      isRanging = false;
      reason = `Range too wide (${(range * 100).toFixed(1)}% > 6%)`;
    } else if (trendStrength > 0.03) {
      isRanging = false;
      reason = `Strong trend detected (${(trendStrength * 100).toFixed(1)}% move)`;
    }

    logger.info(`🎯 Ranging analysis:`);
    logger.info(`  Is ranging: ${isRanging ? '✅ YES' : '❌ NO'}`);
    if (!isRanging) {
      logger.info(`  Reason: ${reason}`);
    }

    // Check current position relative to bounds
    const rangeSize = high - low;
    const upperDistance = (high - currentPrice) / rangeSize;
    const lowerDistance = (currentPrice - low) / rangeSize;
    const thresholdPercent = 0.05; // 5%

    logger.info(`📍 Position in range:`);
    logger.info(`  Current price: ${currentPrice.toFixed(8)}`);
    logger.info(`  Distance to upper: ${(upperDistance * 100).toFixed(2)}%`);
    logger.info(`  Distance to lower: ${(lowerDistance * 100).toFixed(2)}%`);
    logger.info(`  Near upper (5%): ${upperDistance <= thresholdPercent ? '✅ YES' : '❌ NO'}`);
    logger.info(`  Near lower (5%): ${lowerDistance <= thresholdPercent ? '✅ YES' : '❌ NO'}`);

    // Test strategy selection
    const selectedStrategy = bot.selectBestStrategy(currentPrice, priceHistory);
    logger.info(`🎯 Selected strategy: ${selectedStrategy}`);

    // Test confidence calculation for ranging strategy
    if (isRanging) {
      let confidence;
      if (range < 0.015) {
        confidence = 0.60;
      } else if (range < 0.03) {
        confidence = 0.75;
      } else {
        confidence = 0.85;
      }
      logger.info(`💪 Expected confidence for ranging: ${confidence}`);

      // Check if would trigger trade
      const canTradeUpper = upperDistance <= thresholdPercent && confidence >= 0.5;
      const canTradeLower = lowerDistance <= thresholdPercent && confidence >= 0.5;

      logger.info(`🔄 Trading opportunities:`);
      logger.info(`  Can trade upper: ${canTradeUpper ? '✅ YES' : '❌ NO'}`);
      logger.info(`  Can trade lower: ${canTradeLower ? '✅ YES' : '❌ NO'}`);
    }

    // Check bot configuration
    logger.info(`\n⚙️ Bot configuration:`);
    logger.info(`  Shadow mode: ${bot.shadowMode.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    logger.info(`  Min confidence (live): 0.7`);
    logger.info(`  Min confidence (shadow): 0.5`);

  } catch (error) {
    logger.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugMarketConditions().then(() => {
  logger.info('🏁 Debug completed');
  process.exit(0);
}).catch((error) => {
  logger.error('💥 Debug crashed:', error);
  process.exit(1);
});







