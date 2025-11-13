const logger = require('../logger');

/**
 * Smart Portfolio Rebalancer
 * Maintains 50/50 USDT/BNB split to ensure trading liquidity
 */
class SmartRebalancer {
  constructor(bot) {
    this.bot = bot;
    this.maxImbalance = 0.30;        // Trigger rebalance at 70/30 split
    this.targetRatio = 0.50;         // Target 50/50 split
    this.minRebalanceAmount = 1000;  // Min $1K to rebalance
    this.cooldownHours = 6;          // Wait 6h between rebalances
    this.lastRebalance = 0;
  }

  /**
   * Check if portfolio needs rebalancing
   * @returns {boolean} True if rebalance needed
   */
  async shouldRebalance() {
    try {
      const balances = await this.bot.getBalance();
      const currentPrice = await this.bot.getCurrentPrice();

      const usdtValue = balances.usdt;
      const bnbValue = balances.bnb / currentPrice;
      const total = usdtValue + bnbValue;

      if (total === 0) {
        logger.warn('Portfolio value is zero, cannot rebalance');
        return false;
      }

      const usdtRatio = usdtValue / total;

      // Check cooldown
      const hoursSince = (Date.now() - this.lastRebalance) / (1000 * 60 * 60);
      if (hoursSince < this.cooldownHours) {
        logger.debug(`⏰ Rebalance cooldown: ${(this.cooldownHours - hoursSince).toFixed(1)}h remaining`);
        return false;
      }

      // Check if imbalanced (outside 30/70 to 70/30 range)
      const isImbalanced = usdtRatio < this.maxImbalance || usdtRatio > (1 - this.maxImbalance);

      if (isImbalanced) {
        const amountToMove = Math.abs(usdtValue - (total * this.targetRatio));

        if (amountToMove >= this.minRebalanceAmount) {
          logger.info(`⚖️  Portfolio imbalanced: ${(usdtRatio * 100).toFixed(1)}% USDT / ${((1 - usdtRatio) * 100).toFixed(1)}% BNB`);
          logger.info(`💱 Need to move $${amountToMove.toFixed(2)} to rebalance to 50/50`);
          return true;
        } else {
          logger.debug(`Imbalance too small to rebalance: $${amountToMove.toFixed(2)}`);
        }
      }

      return false;
    } catch (error) {
      logger.error(`Error checking rebalance: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute portfolio rebalancing
   * @returns {boolean} True if rebalance successful
   */
  async rebalance() {
    try {
      logger.info('🔄 Starting portfolio rebalance...');

      const balances = await this.bot.getBalance();
      const currentPrice = await this.bot.getCurrentPrice();

      const usdtValue = balances.usdt;
      const bnbValue = balances.bnb / currentPrice;
      const total = usdtValue + bnbValue;
      const usdtRatio = usdtValue / total;

      logger.info(`📊 Current split: ${(usdtRatio * 100).toFixed(1)}% USDT / ${((1 - usdtRatio) * 100).toFixed(1)}% BNB`);

      const targetUsdtValue = total * this.targetRatio;
      const diff = targetUsdtValue - usdtValue;

      if (Math.abs(diff) < this.minRebalanceAmount) {
        logger.info('⏸️  Rebalance amount too small, skipping');
        return false;
      }

      // Execute rebalance trade
      if (diff > 0) {
        // Need more USDT - sell BNB
        const bnbToSell = Math.abs(diff) * currentPrice;
        logger.info(`💱 Rebalancing: Selling ${bnbToSell.toFixed(4)} BNB for $${Math.abs(diff).toFixed(2)} USDT`);

        if (this.bot.shadowMode && this.bot.shadowMode.isActive) {
          await this.bot.shadowMode.executeShadowTrade('sell', Math.abs(diff), currentPrice);
          logger.info('✅ Shadow rebalance trade executed (SELL BNB)');
        } else {
          // Real trading logic would go here
          logger.warn('⚠️  Real rebalancing not implemented yet');
        }
      } else {
        // Need more BNB - buy with USDT
        const bnbToBuy = Math.abs(diff) * currentPrice;
        logger.info(`💱 Rebalancing: Buying ${bnbToBuy.toFixed(4)} BNB with $${Math.abs(diff).toFixed(2)} USDT`);

        if (this.bot.shadowMode && this.bot.shadowMode.isActive) {
          await this.bot.shadowMode.executeShadowTrade('buy', Math.abs(diff), currentPrice);
          logger.info('✅ Shadow rebalance trade executed (BUY BNB)');
        } else {
          // Real trading logic would go here
          logger.warn('⚠️  Real rebalancing not implemented yet');
        }
      }

      this.lastRebalance = Date.now();

      // Verify new balances
      const newBalances = await this.bot.getBalance();
      const newUsdtValue = newBalances.usdt;
      const newBnbValue = newBalances.bnb / currentPrice;
      const newTotal = newUsdtValue + newBnbValue;
      const newUsdtRatio = newUsdtValue / newTotal;

      logger.info(`✅ Portfolio rebalanced: ${(newUsdtRatio * 100).toFixed(1)}% USDT / ${((1 - newUsdtRatio) * 100).toFixed(1)}% BNB`);

      return true;

    } catch (error) {
      logger.error(`Error rebalancing: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current portfolio balance ratio
   * @returns {Object} Portfolio stats
   */
  async getPortfolioStats() {
    try {
      const balances = await this.bot.getBalance();
      const currentPrice = await this.bot.getCurrentPrice();

      const usdtValue = balances.usdt;
      const bnbValue = balances.bnb / currentPrice;
      const total = usdtValue + bnbValue;
      const usdtRatio = total > 0 ? usdtValue / total : 0;

      return {
        usdtValue,
        bnbValue,
        total,
        usdtRatio,
        bnbRatio: 1 - usdtRatio,
        isBalanced: usdtRatio >= this.maxImbalance && usdtRatio <= (1 - this.maxImbalance)
      };
    } catch (error) {
      logger.error(`Error getting portfolio stats: ${error.message}`);
      return null;
    }
  }
}

module.exports = SmartRebalancer;








