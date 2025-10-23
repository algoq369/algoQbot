const logger = require('../logger');
const { Trade, Alert } = require('../database/models');

class LeverageStrategy {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.positions = new Map();
    this.dailyTrades = 0;
    this.lastTradeDate = new Date().toDateString();
  }

  calculateLeverage(confidence, zScore, rsi, volatility = 0.2) {
    const config = require('../config');

    // 🚀 CRITICAL FIX #6: Never leverage in high volatility
    if (volatility > 0.50) { // >50% annualized vol
      logger.warn(`⚠️ No leverage: High volatility ${(volatility * 100).toFixed(0)}%`);
      return 1;
    }

    // Adjust leverage tiers based on market conditions
    const volAdjustment = 1 - (volatility / 0.50); // Reduce leverage as vol increases

    for (const tier of config.trading.leverageTrading.tiers) {
      const adjustedMinConf = tier.minConfidence + (volatility * 0.10); // Higher bar in vol

      if (confidence >= adjustedMinConf &&
        Math.abs(zScore) <= tier.zScore &&
        (rsi <= tier.rsi || rsi >= (100 - tier.rsi))) {

        const baseLeverage = tier.leverage;
        const adjustedLeverage = Math.max(1, Math.floor(baseLeverage * volAdjustment));

        logger.warn(`🔥 ${adjustedLeverage}x leverage (conf: ${(confidence * 100).toFixed(0)}%, vol: ${(volatility * 100).toFixed(0)}%, z: ${zScore.toFixed(2)})`);
        return adjustedLeverage;
      }
    }
    return 1;
  }

  async openLeveragedPosition(decision, marketData) {
    const config = require('../config');

    const today = new Date().toDateString();
    if (today !== this.lastTradeDate) {
      this.dailyTrades = 0;
      this.lastTradeDate = today;
    }

    if (this.dailyTrades >= config.trading.leverageTrading.maxDailyTrades) {
      logger.info(`🚫 Daily leverage limit reached: ${this.dailyTrades}/${config.trading.leverageTrading.maxDailyTrades}`);
      return null;
    }

    const { zScore, rsi, volatility } = marketData.parameters;
    const leverage = this.calculateLeverage(decision.confidence, zScore, rsi, volatility);

    if (leverage === 1) {
      logger.debug(`No leverage: confidence ${(decision.confidence * 100).toFixed(0)}%, z-score ${zScore.toFixed(2)}, RSI ${rsi.toFixed(0)}`);
      return null;
    }

    const collateral = decision.position_size;
    const effectiveSize = collateral * leverage;

    const stopLoss = decision.action === 'buy'
      ? marketData.currentPrice * (1 - config.trading.leverageTrading.stopLossPercent)
      : marketData.currentPrice * (1 + config.trading.leverageTrading.stopLossPercent);

    const position = {
      id: `lev_${Date.now()}`,
      pair: 'BNB/USDT',
      side: decision.action,
      collateral,
      leverage,
      effectiveSize,
      entryPrice: marketData.currentPrice,
      stopLoss,
      confidence: decision.confidence,
      timestamp: Date.now()
    };

    this.positions.set(position.id, position);
    this.dailyTrades++;

    logger.warn(`🚀 ${leverage}x ${position.side.toUpperCase()}: $${collateral.toFixed(0)} × ${leverage}x = $${effectiveSize.toFixed(0)}`);

    try {
      await Alert.create({
        type: 'leverage_trade',
        severity: 'high',
        title: `${leverage}x Leveraged ${position.side.toUpperCase()}`,
        message: `$${collateral.toFixed(0)} × ${leverage}x at ${position.entryPrice.toFixed(6)}`,
        triggered_by: 'LeverageStrategy'
      });
    } catch (error) {
      logger.error('Failed to create leverage alert:', error);
    }

    return position;
  }

  async monitorPositions(currentPrice) {
    for (const [id, pos] of this.positions) {
      if ((pos.side === 'buy' && currentPrice <= pos.stopLoss) ||
        (pos.side === 'sell' && currentPrice >= pos.stopLoss)) {
        await this.closePosition(id, currentPrice, 'stop_loss');
      }
    }
  }

  async closePosition(id, currentPrice, reason) {
    const pos = this.positions.get(id);
    if (!pos) return;

    const pnl = pos.side === 'buy'
      ? (currentPrice - pos.entryPrice) * pos.effectiveSize / pos.entryPrice
      : (pos.entryPrice - currentPrice) * pos.effectiveSize / pos.entryPrice;

    logger.warn(`${pnl > 0 ? '✅' : '❌'} ${pos.leverage}x ${pos.side.toUpperCase()}: ${reason} | P&L: $${pnl.toFixed(2)}`);

    this.positions.delete(id);

    try {
      await Trade.create({
        type: pos.side,
        token_pair: pos.pair,
        amount_in: pos.collateral,
        amount_out: pos.collateral + pnl,
        price: currentPrice,
        status: 'completed',
        strategy: `leverage_${pos.leverage}x`,
        profit_loss: pnl
      });
    } catch (error) {
      logger.error('Failed to create leverage trade record:', error);
    }

    return { pnl };
  }

  getPositions() {
    return Array.from(this.positions.values());
  }

  getDailyTradeCount() {
    const today = new Date().toDateString();
    return today === this.lastTradeDate ? this.dailyTrades : 0;
  }
}

module.exports = LeverageStrategy;
