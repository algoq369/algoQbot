const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');

class RangingStrategy {
  constructor(pancakeSwap) {
    this.pancakeSwap = pancakeSwap;
    this.basePrice = null;
    this.lowerBound = null;
    this.upperBound = null;
    this.position = 'neutral'; // 'long', 'short', 'neutral'
    this.lastRebalancePrice = null;
  }

  async initialize() {
    try {
      // Get initial price to set bounds
      this.basePrice = await this.pancakeSwap.getCurrentPrice();
      this.lowerBound = this.basePrice * config.strategy.lowerBoundPercent;
      this.upperBound = this.basePrice * config.strategy.upperBoundPercent;
      this.lastRebalancePrice = this.basePrice;

      logger.info(`Strategy initialized:`);
      logger.info(`Base Price: ${this.basePrice.toFixed(6)} BNB per USDT`);
      logger.info(`Lower Bound: ${this.lowerBound.toFixed(6)} BNB per USDT`);
      logger.info(`Upper Bound: ${this.upperBound.toFixed(6)} BNB per USDT`);

      return true;
    } catch (error) {
      logger.error('Error initializing strategy:', error);
      throw error;
    }
  }

  async checkAndExecute() {
    try {
      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      const usdtBalance = await this.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.pancakeSwap.getBNBBalance();

      logger.info(`Current Price: ${currentPrice.toFixed(6)} BNB per USDT`);
      logger.info(`USDT Balance: ${usdtBalance.toFixed(2)}`);
      logger.info(`BNB Balance: ${bnbBalance.toFixed(6)}`);

      // Check if price is below lower bound (buy signal)
      if (currentPrice <= this.lowerBound && this.position !== 'long') {
        await this.executeBuy(currentPrice, usdtBalance);
      }
      // Check if price is above upper bound (sell signal)
      else if (currentPrice >= this.upperBound && this.position !== 'short') {
        await this.executeSell(currentPrice, bnbBalance);
      }
      // Check for rebalancing opportunity
      else if (this.shouldRebalance(currentPrice)) {
        await this.rebalance(currentPrice, usdtBalance, bnbBalance);
      }

      return {
        currentPrice,
        lowerBound: this.lowerBound,
        upperBound: this.upperBound,
        position: this.position,
        usdtBalance,
        bnbBalance
      };
    } catch (error) {
      logger.error('Error in checkAndExecute:', error);
      throw error;
    }
  }

  async executeBuy(currentPrice, usdtBalance) {
    try {
      if (usdtBalance < config.trading.minTradeAmount) {
        logger.warn('Insufficient USDT balance for buy order');
        return;
      }

      const tradeAmount = Math.min(usdtBalance * 0.5, config.trading.maxTradeAmount);
      const minBnbAmount = ethers.parseEther((tradeAmount / currentPrice * 0.995).toFixed(18)); // 0.5% slippage

      logger.info(`Executing BUY: ${tradeAmount.toFixed(2)} USDT for BNB at ${currentPrice.toFixed(6)}`);

      const receipt = await this.pancakeSwap.swapUSDTForBNB(tradeAmount, minBnbAmount);

      this.position = 'long';
      this.lastRebalancePrice = currentPrice;

      logger.info(`Buy order executed successfully: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error executing buy order:', error);
      // Don't throw error, just log it to prevent bot from stopping
      return null;
    }
  }

  async executeSell(currentPrice, bnbBalance) {
    try {
      if (bnbBalance < 0.001) { // Minimum BNB balance
        logger.warn('Insufficient BNB balance for sell order');
        return;
      }

      const tradeAmount = Math.min(bnbBalance * 0.5, config.trading.maxTradeAmount / currentPrice);
      const minUsdtAmount = ethers.parseEther((tradeAmount * currentPrice * 0.995).toFixed(18)); // 0.5% slippage

      logger.info(`Executing SELL: ${tradeAmount.toFixed(6)} BNB for USDT at ${currentPrice.toFixed(6)}`);

      const receipt = await this.pancakeSwap.swapBNBForUSDT(tradeAmount, minUsdtAmount);

      this.position = 'short';
      this.lastRebalancePrice = currentPrice;

      logger.info(`Sell order executed successfully: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error executing sell order:', error);
      // Don't throw error, just log it to prevent bot from stopping
      return null;
    }
  }

  shouldRebalance(currentPrice) {
    if (!this.lastRebalancePrice) return false;

    const priceChange = Math.abs(currentPrice - this.lastRebalancePrice) / this.lastRebalancePrice;
    return priceChange >= config.strategy.rebalanceThreshold;
  }

  async rebalance(currentPrice, usdtBalance, bnbBalance) {
    try {
      const totalValue = usdtBalance + (bnbBalance * currentPrice);
      const targetUsdtValue = totalValue * 0.5; // 50/50 split
      const currentUsdtValue = usdtBalance;

      const usdtDifference = currentUsdtValue - targetUsdtValue;

      if (Math.abs(usdtDifference) > config.trading.minTradeAmount) {
        if (usdtDifference > 0) {
          // Too much USDT, buy BNB
          const tradeAmount = Math.min(usdtDifference, config.trading.maxTradeAmount);
          const minBnbAmount = ethers.parseEther((tradeAmount / currentPrice * 0.995).toFixed(18));

          logger.info(`Rebalancing: Buying ${tradeAmount.toFixed(2)} USDT worth of BNB`);
          const receipt = await this.pancakeSwap.swapUSDTForBNB(tradeAmount, minBnbAmount);
          if (receipt) {
            this.lastRebalancePrice = currentPrice;
            this.position = 'neutral';
          }
        } else {
          // Too little USDT, sell BNB
          const bnbToSell = Math.min(Math.abs(usdtDifference) / currentPrice, bnbBalance * 0.5);
          const minUsdtAmount = ethers.parseEther((bnbToSell * currentPrice * 0.995).toFixed(18));

          logger.info(`Rebalancing: Selling ${bnbToSell.toFixed(6)} BNB for USDT`);
          const receipt = await this.pancakeSwap.swapBNBForUSDT(bnbToSell, minUsdtAmount);
          if (receipt) {
            this.lastRebalancePrice = currentPrice;
            this.position = 'neutral';
          }
        }
      }
    } catch (error) {
      logger.error('Error rebalancing:', error);
      // Don't throw error, just log it to prevent bot from stopping
    }
  }

  updateBounds(newBasePrice) {
    this.basePrice = newBasePrice;
    this.lowerBound = this.basePrice * config.strategy.lowerBoundPercent;
    this.upperBound = this.basePrice * config.strategy.upperBoundPercent;

    logger.info(`Bounds updated:`);
    logger.info(`New Base Price: ${this.basePrice.toFixed(6)} BNB per USDT`);
    logger.info(`New Lower Bound: ${this.lowerBound.toFixed(6)} BNB per USDT`);
    logger.info(`New Upper Bound: ${this.upperBound.toFixed(6)} BNB per USDT`);
  }

  getStatus() {
    return {
      basePrice: this.basePrice,
      lowerBound: this.lowerBound,
      upperBound: this.upperBound,
      position: this.position,
      lastRebalancePrice: this.lastRebalancePrice
    };
  }

  /**
   * Detect breakout from ranging zone to protect positions
   * @param {number} currentPrice - Current market price
   * @param {Array} priceHistory - Recent price history
   * @returns {string|boolean} - 'upward', 'downward', or false
   */
  detectBreakout(currentPrice, priceHistory) {
    if (!priceHistory || priceHistory.length < 50) return false;

    const prices = priceHistory.slice(-50).map(p => p.price);
    const upperBound = Math.max(...prices);
    const lowerBound = Math.min(...prices);
    const range = upperBound - lowerBound;

    // Breakout threshold: 5% beyond the recent range
    const breakoutThreshold = range * 0.05;

    if (currentPrice > upperBound + breakoutThreshold) {
      logger.warn(`🚀 UPWARD BREAKOUT: ${currentPrice.toFixed(6)} > ${upperBound.toFixed(6)}`);
      return 'upward';
    }

    if (currentPrice < lowerBound - breakoutThreshold) {
      logger.warn(`📉 DOWNWARD BREAKOUT: ${currentPrice.toFixed(6)} < ${lowerBound.toFixed(6)}`);
      return 'downward';
    }

    return false;
  }
}

module.exports = RangingStrategy;
