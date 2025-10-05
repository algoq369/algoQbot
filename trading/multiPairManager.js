const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

class MultiPairManager {
  constructor() {
    this.tradingPairs = {
      'USDT/BNB': {
        base: '0x55d398326f99059fF775485246999027B3197955', // USDT
        quote: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // BNB
        decimals: { base: 18, quote: 18 },
        minTradeAmount: 5,
        maxTradeAmount: 100,
        volatility: 'medium',
        liquidity: 'high'
      },
      'ETH/USDT': {
        base: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // ETH
        quote: '0x55d398326f99059fF775485246999027B3197955', // USDT
        decimals: { base: 18, quote: 18 },
        minTradeAmount: 10,
        maxTradeAmount: 200,
        volatility: 'high',
        liquidity: 'high'
      },
      'BTC/USDT': {
        base: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTC
        quote: '0x55d398326f99059fF775485246999027B3197955', // USDT
        decimals: { base: 18, quote: 18 },
        minTradeAmount: 20,
        maxTradeAmount: 500,
        volatility: 'high',
        liquidity: 'high'
      },
      'CAKE/USDT': {
        base: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
        quote: '0x55d398326f99059fF775485246999027B3197955', // USDT
        decimals: { base: 18, quote: 18 },
        minTradeAmount: 2,
        maxTradeAmount: 50,
        volatility: 'high',
        liquidity: 'medium'
      },
      'ADA/USDT': {
        base: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', // ADA
        quote: '0x55d398326f99059fF775485246999027B3197955', // USDT
        decimals: { base: 18, quote: 18 },
        minTradeAmount: 5,
        maxTradeAmount: 100,
        volatility: 'medium',
        liquidity: 'medium'
      },
      'DOT/USDT': {
        base: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', // DOT
        quote: '0x55d398326f99059fF775485246999027B3197955', // USDT
        decimals: { base: 18, quote: 18 },
        minTradeAmount: 5,
        maxTradeAmount: 100,
        volatility: 'high',
        liquidity: 'medium'
      }
    };
    
    this.activePairs = ['USDT/BNB']; // Start with primary pair
    this.pairStrategies = {};
    this.initializeStrategies();
  }

  initializeStrategies() {
    for (const pair of this.activePairs) {
      this.pairStrategies[pair] = {
        strategy: 'ranging',
        bounds: {
          lower: 0.98, // 2% below base price
          upper: 1.02  // 2% above base price
        },
        rebalanceThreshold: 0.005, // 0.5%
        position: 'neutral',
        lastTrade: null,
        profit: 0
      };
    }
  }

  getPairInfo(pair) {
    return this.tradingPairs[pair];
  }

  getActivePairs() {
    return this.activePairs;
  }

  addPair(pair) {
    if (this.tradingPairs[pair] && !this.activePairs.includes(pair)) {
      this.activePairs.push(pair);
      this.initializePairStrategy(pair);
      logger.info(`✅ Added trading pair: ${pair}`);
    }
  }

  removePair(pair) {
    const index = this.activePairs.indexOf(pair);
    if (index > -1) {
      this.activePairs.splice(index, 1);
      delete this.pairStrategies[pair];
      logger.info(`❌ Removed trading pair: ${pair}`);
    }
  }

  initializePairStrategy(pair) {
    this.pairStrategies[pair] = {
      strategy: 'ranging',
      bounds: {
        lower: 0.98,
        upper: 1.02
      },
      rebalanceThreshold: 0.005,
      position: 'neutral',
      lastTrade: null,
      profit: 0
    };
  }

  getPairStrategy(pair) {
    return this.pairStrategies[pair];
  }

  updatePairStrategy(pair, updates) {
    if (this.pairStrategies[pair]) {
      this.pairStrategies[pair] = { ...this.pairStrategies[pair], ...updates };
      logger.info(`📊 Updated strategy for ${pair}:`, updates);
    }
  }

  async getPairPrice(pair, dexManager) {
    try {
      const pairInfo = this.getPairInfo(pair);
      if (!pairInfo) throw new Error(`Pair ${pair} not found`);

      const amountIn = ethers.parseUnits('1', pairInfo.decimals.base);
      const bestPrice = await dexManager.getBestPrice(
        pairInfo.base,
        pairInfo.quote,
        amountIn
      );

      return {
        pair: pair,
        price: ethers.formatUnits(bestPrice.price, pairInfo.decimals.quote),
        dex: bestPrice.dexName,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error getting price for ${pair}:`, error);
      return null;
    }
  }

  async getAllPrices(dexManager) {
    const prices = {};
    
    for (const pair of this.activePairs) {
      const priceData = await this.getPairPrice(pair, dexManager);
      if (priceData) {
        prices[pair] = priceData;
      }
    }
    
    return prices;
  }

  getVolatilityRanking() {
    const pairs = Object.entries(this.tradingPairs)
      .filter(([pair]) => this.activePairs.includes(pair))
      .sort((a, b) => {
        const volatilityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return volatilityOrder[b[1].volatility] - volatilityOrder[a[1].volatility];
      });
    
    return pairs.map(([pair]) => pair);
  }

  getLiquidityRanking() {
    const pairs = Object.entries(this.tradingPairs)
      .filter(([pair]) => this.activePairs.includes(pair))
      .sort((a, b) => {
        const liquidityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return liquidityOrder[b[1].liquidity] - liquidityOrder[a[1].liquidity];
      });
    
    return pairs.map(([pair]) => pair);
  }

  getOptimalPairs(count = 3) {
    // Combine volatility and liquidity for optimal pair selection
    const volatilityPairs = this.getVolatilityRanking();
    const liquidityPairs = this.getLiquidityRanking();
    
    const scores = {};
    for (const pair of this.activePairs) {
      const volRank = volatilityPairs.indexOf(pair);
      const liqRank = liquidityPairs.indexOf(pair);
      scores[pair] = (volRank + liqRank) / 2;
    }
    
    return Object.entries(scores)
      .sort((a, b) => a[1] - b[1])
      .slice(0, count)
      .map(([pair]) => pair);
  }
}

module.exports = MultiPairManager;
