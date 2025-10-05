const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

class MultiDexManager {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.dexs = {};
    this.initializeDEXs();
  }

  async initializeDEXs() {
    try {
      // PancakeSwap V2 (Primary DEX)
      this.dexs.pancakeSwap = new (require('../pancakeSwap'))(this.provider, this.wallet);
      logger.info('✅ PancakeSwap initialized');
      
      // Try to initialize other DEXs (optional)
      try {
        this.dexs.uniswapV2 = new (require('./uniswapV2'))(this.provider, this.wallet);
        logger.info('✅ Uniswap V2 initialized');
      } catch (error) {
        logger.warn('⚠️ Uniswap V2 not available:', error.message);
      }
      
      try {
        this.dexs.sushiSwap = new (require('./sushiSwap'))(this.provider, this.wallet);
        logger.info('✅ SushiSwap initialized');
      } catch (error) {
        logger.warn('⚠️ SushiSwap not available:', error.message);
      }
      
      try {
        this.dexs.oneInch = new (require('./oneInch'))(this.provider, this.wallet);
        logger.info('✅ 1inch initialized');
      } catch (error) {
        logger.warn('⚠️ 1inch not available:', error.message);
      }
      
      const availableDEXs = Object.keys(this.dexs).length;
      logger.info(`✅ Multi-DEX manager initialized with ${availableDEXs} DEXs`);
    } catch (error) {
      logger.error('❌ Error initializing multi-DEX manager:', error);
      throw error;
    }
  }

  async getBestPrice(tokenIn, tokenOut, amountIn) {
    const prices = {};
    
    try {
      // Parallel price fetching for optimal performance
      const pricePromises = Object.entries(this.dexs).map(async ([dexName, dex]) => {
        if (dex && typeof dex.getPrice === 'function') {
          try {
            const startTime = Date.now();
            const price = await dex.getPrice(tokenIn, tokenOut, amountIn);
            const latency = Date.now() - startTime;
            
            return {
              dexName,
              price,
              dex,
              latency,
              success: true
            };
          } catch (error) {
            logger.warn(`Failed to get price from ${dexName}:`, error.message);
            return {
              dexName,
              error: error.message,
              success: false
            };
          }
        }
        return null;
      });

      // Wait for all price requests with timeout
      const results = await Promise.allSettled(
        pricePromises.map(promise => 
          Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Price fetch timeout')), 5000)
            )
          ])
        )
      );

      // Process results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.success) {
          const { dexName, price, dex, latency } = result.value;
          prices[dexName] = {
            price,
            dex,
            dexName,
            latency
          };
        }
      });

      if (Object.keys(prices).length === 0) {
        throw new Error('No DEXs available for price comparison');
      }

      // Find best price considering latency and price
      const bestDex = Object.entries(prices).reduce((best, [name, data]) => {
        // Consider both price and latency (prefer lower latency for similar prices)
        const priceScore = Number(data.price);
        const latencyPenalty = data.latency > 1000 ? 0.95 : 1.0; // Penalize slow responses
        
        const adjustedScore = priceScore * latencyPenalty;
        const bestAdjustedScore = best.price * (best.latency > 1000 ? 0.95 : 1.0);
        
        return adjustedScore > bestAdjustedScore ? data : best;
      }, { price: 0, latency: Infinity });

      logger.info(`🏆 Best price found on ${bestDex.dexName}: ${ethers.formatEther(bestDex.price)} (${bestDex.latency}ms)`);
      return bestDex;
    } catch (error) {
      logger.error('Error getting best price:', error);
      throw error;
    }
  }

  async executeOptimalTrade(tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const bestDex = await this.getBestPrice(tokenIn, tokenOut, amountIn);
      
      if (!bestDex.dex) {
        throw new Error('No DEX available for trading');
      }

      logger.info(`🎯 Executing trade on ${bestDex.dexName}`);
      return await bestDex.dex.swapTokens(tokenIn, tokenOut, amountIn, minAmountOut);
    } catch (error) {
      logger.error('Error executing optimal trade:', error);
      throw error;
    }
  }

  async getLiquidity(tokenIn, tokenOut) {
    const liquidity = {};
    
    for (const [dexName, dex] of Object.entries(this.dexs)) {
      try {
        const liq = await dex.getLiquidity(tokenIn, tokenOut);
        liquidity[dexName] = liq;
      } catch (error) {
        logger.warn(`Failed to get liquidity from ${dexName}:`, error.message);
      }
    }
    
    return liquidity;
  }
}

module.exports = MultiDexManager;
