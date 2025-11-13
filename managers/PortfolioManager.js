const logger = require('../logger');

/**
 * PortfolioManager - Single source of truth for portfolio value
 * Prevents race conditions and inconsistencies across components
 */
class PortfolioManager {
  constructor(shadowMode = null, multiDexManager = null) {
    this.shadowMode = shadowMode;
    this.multiDexManager = multiDexManager;
    this.cachedValue = 0;
    this.lastUpdate = 0;
    this.updateInterval = 5000; // Update every 5 seconds max
    this.listeners = new Set();
  }

  /**
   * Get current portfolio value (cached if recent)
   */
  async getValue(forceRefresh = false) {
    const now = Date.now();

    // Return cached value if recent (unless forced)
    if (!forceRefresh && (now - this.lastUpdate) < this.updateInterval) {
      logger.debug(`💼 Using cached portfolio value: $${this.cachedValue.toFixed(2)}`);
      return this.cachedValue;
    }

    // Recalculate
    await this.refresh();
    return this.cachedValue;
  }

  /**
   * Force refresh portfolio value
   */
  async refresh() {
    try {
      let usdtBalance, bnbBalance, currentPrice;

      if (this.shadowMode && this.shadowMode.isActive) {
        // Shadow mode: use virtual balances
        const virtualBalances = this.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;

        // Get current price from DEX
        if (this.multiDexManager && this.multiDexManager.dexs && this.multiDexManager.dexs.pancakeSwap) {
          currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
        } else {
          currentPrice = this.shadowMode.currentPrice || 0.00078;
        }

        logger.debug(`💼 Shadow mode balances: ${usdtBalance.toFixed(2)} USDT, ${bnbBalance.toFixed(6)} BNB @ ${currentPrice.toFixed(6)}`);
      } else {
        // Live mode: query actual balances
        if (!this.multiDexManager || !this.multiDexManager.dexs || !this.multiDexManager.dexs.pancakeSwap) {
          throw new Error('MultiDexManager not initialized');
        }

        usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
        currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      }

      // Calculate total value (BNB/USDT price means BNB÷price = USDT)
      const bnbInUsd = bnbBalance / currentPrice;
      const totalValue = usdtBalance + bnbInUsd;

      // Update cache
      const oldValue = this.cachedValue;
      this.cachedValue = totalValue;
      this.lastUpdate = Date.now();

      // Notify listeners of significant changes (> $0.01)
      if (Math.abs(totalValue - oldValue) > 0.01) {
        logger.info(`💰 Portfolio value updated: $${oldValue.toFixed(2)} → $${totalValue.toFixed(2)}`);
        this.notifyListeners(totalValue);
      }

      return totalValue;
    } catch (error) {
      logger.error('❌ Error refreshing portfolio value:', error);
      return this.cachedValue; // Return last known value on error
    }
  }

  /**
   * Subscribe to portfolio value changes
   */
  subscribe(callback) {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of value change
   */
  notifyListeners(newValue) {
    for (const callback of this.listeners) {
      try {
        callback(newValue);
      } catch (error) {
        logger.error('Error in portfolio value listener:', error);
      }
    }
  }

  /**
   * Get percentage of portfolio for a given amount
   */
  getPercentage(amount) {
    if (this.cachedValue === 0) return 100; // Avoid division by zero
    return (amount / this.cachedValue) * 100;
  }

  /**
   * Get amount for a given percentage
   */
  getAmount(percentage) {
    return this.cachedValue * (percentage / 100);
  }
}

module.exports = PortfolioManager;









