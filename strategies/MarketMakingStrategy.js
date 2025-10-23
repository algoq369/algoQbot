const logger = require('../logger');

class MarketMakingStrategy {
  constructor(pancakeSwap, allocation = 4000) {
    this.pancakeSwap = pancakeSwap;
    this.allocation = allocation;
    this.spread = 0.002; // 0.2% spread
    this.orders = [];
    this.activeOrders = new Map();
  }

  async placeOrders(currentPrice) {
    const config = require('../config');

    if (!config.trading.marketMaking.enabled) {
      return [];
    }

    const buyPrice = currentPrice * (1 - this.spread);
    const sellPrice = currentPrice * (1 + this.spread);
    const orderSize = config.trading.marketMaking.orderSize || 800; // $800 per order

    this.orders = [
      {
        id: `mm_buy_${Date.now()}`,
        side: 'buy',
        price: buyPrice,
        size: orderSize,
        timestamp: Date.now()
      },
      {
        id: `mm_sell_${Date.now()}`,
        side: 'sell',
        price: sellPrice,
        size: orderSize,
        timestamp: Date.now()
      }
    ];

    // Store active orders
    this.orders.forEach(order => {
      this.activeOrders.set(order.id, order);
    });

    logger.info(`📊 Market making: Buy @ ${buyPrice.toFixed(6)} | Sell @ ${sellPrice.toFixed(6)} | Size: $${orderSize}`);
    return this.orders;
  }

  async execute() {
    const config = require('../config');

    if (!config.trading.marketMaking.enabled) {
      return;
    }

    try {
      for (const pair of config.trading.marketMaking.pairs) {
        const currentPrice = await this.getCurrentPrice(pair);
        if (currentPrice) {
          // Cancel old orders
          await this.cancelOrders(pair);

          // Place new orders
          await this.placeOrders(currentPrice);

          logger.info(`📊 Market making executed for ${pair}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Market making execution error: ${error.message}`);
    }
  }

  async getCurrentPrice(pair) {
    try {
      // This would integrate with your price feed
      // For now, return a mock price
      return 0.0008; // Mock BNB/USDT price
    } catch (error) {
      logger.error(`❌ Error getting current price for ${pair}: ${error.message}`);
      return null;
    }
  }

  async cancelOrders(pair) {
    try {
      // Cancel existing orders for this pair
      const ordersToCancel = Array.from(this.activeOrders.values())
        .filter(order => order.pair === pair);

      for (const order of ordersToCancel) {
        this.activeOrders.delete(order.id);
      }

      if (ordersToCancel.length > 0) {
        logger.info(`📊 Cancelled ${ordersToCancel.length} orders for ${pair}`);
      }
    } catch (error) {
      logger.error(`❌ Error cancelling orders for ${pair}: ${error.message}`);
    }
  }

  async checkOrderFills(currentPrice) {
    const filledOrders = [];

    for (const [id, order] of this.activeOrders) {
      let filled = false;

      if (order.side === 'buy' && currentPrice <= order.price) {
        filled = true;
        logger.info(`📈 Market making BUY filled at ${currentPrice.toFixed(6)} (order: ${order.price.toFixed(6)})`);
      } else if (order.side === 'sell' && currentPrice >= order.price) {
        filled = true;
        logger.info(`📉 Market making SELL filled at ${currentPrice.toFixed(6)} (order: ${order.price.toFixed(6)})`);
      }

      if (filled) {
        filledOrders.push(order);
        this.activeOrders.delete(id);
      }
    }

    return filledOrders;
  }

  getActiveOrders() {
    return Array.from(this.activeOrders.values());
  }

  getTotalExposure() {
    return this.activeOrders.size * 400; // $400 per order
  }

  async updateSpread(volatility) {
    // Adjust spread based on market volatility
    if (volatility > 0.05) {
      this.spread = 0.003; // 0.3% for high volatility
    } else if (volatility < 0.02) {
      this.spread = 0.001; // 0.1% for low volatility
    } else {
      this.spread = 0.002; // 0.2% default
    }

    logger.debug(`📊 Market making spread updated to ${(this.spread * 100).toFixed(1)}% (volatility: ${(volatility * 100).toFixed(1)}%)`);
  }
}

module.exports = MarketMakingStrategy;
