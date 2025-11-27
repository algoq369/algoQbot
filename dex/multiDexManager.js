const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

class MultiDexManager {
  constructor(provider, wallet, txVerifier = null, batchPriceFetcher = null) {
    this.provider = provider;
    this.wallet = wallet;
    this.txVerifier = txVerifier; // ✅ SECURITY FIX #3: Pass transaction verifier to DEXs
    this.batchPriceFetcher = batchPriceFetcher; // 🚀 Phase 1: Batch price fetcher for RPC optimization
    this.dexs = {};
    this.initializeDEXs();
  }

  async initializeDEXs() {
    try {
      // PancakeSwap V2 (Primary DEX)
      // ✅ SECURITY FIX #3: Pass txVerifier to PancakeSwap
      this.dexs.pancakeSwap = new (require('../pancakeSwap'))(this.provider, this.wallet, this.txVerifier);
      logger.info('✅ PancakeSwap initialized' + (this.txVerifier ? ' with transaction verifier' : ''));
      
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
      // 🚀 Phase 1: Use batch price fetching if available
      if (this.batchPriceFetcher && Object.keys(this.dexs).length > 1) {
        return await this.getBestPriceBatched(tokenIn, tokenOut, amountIn);
      }

      // Fallback to individual price fetching
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

  // 🚀 Phase 1: Batched price fetching for RPC optimization
  async getBestPriceBatched(tokenIn, tokenOut, amountIn) {
    try {
      logger.debug(`📦 Using batch price fetching for ${Object.keys(this.dexs).length} DEXs`);
      
      // Prepare batch requests for available DEXs
      const batchPromises = [];
      const dexMap = new Map();
      
      for (const [dexName, dex] of Object.entries(this.dexs)) {
        if (dex && typeof dex.getPrice === 'function') {
          const batchPromise = this.batchPriceFetcher.getPrice(dexName, tokenIn, tokenOut, amountIn);
          batchPromises.push(batchPromise);
          dexMap.set(batchPromise, dexName);
        }
      }
      
      if (batchPromises.length === 0) {
        throw new Error('No DEXs available for price fetching');
      }
      
      // Wait for all batch requests
      const results = await Promise.allSettled(batchPromises);
      
      // Process results
      const priceResults = [];
      results.forEach((result, index) => {
        const dexName = dexMap.get(batchPromises[index]);
        
        if (result.status === 'fulfilled') {
          priceResults.push({
            dexName,
            price: result.value,
            dex: this.dexs[dexName],
            latency: 50, // Batched calls are typically faster
            success: true
          });
        } else {
          logger.warn(`Batched price fetch failed for ${dexName}:`, result.reason);
          priceResults.push({
            dexName,
            error: result.reason?.message || 'Batch fetch failed',
            success: false
          });
        }
      });
      
      // Select best price
      let bestPrice = null;
      let bestDex = null;
      
      for (const result of priceResults) {
        if (result.success && result.price && result.price.amountOut) {
          const amountOut = BigInt(result.price.amountOut);
          if (!bestPrice || amountOut > bestPrice) {
            bestPrice = amountOut;
            bestDex = result;
          }
        }
      }
      
      if (bestDex) {
        logger.debug(`📦 Best batched price: ${bestDex.dexName} (${bestDex.latency}ms)`);
        return {
          dexName: bestDex.dexName,
          price: bestDex.price,
          dex: bestDex.dex,
          latency: bestDex.latency,
          success: true,
          batched: true
        };
      }
      
      throw new Error('No valid prices found in batch fetch');
      
    } catch (error) {
      logger.error('Batch price fetching failed, falling back to individual calls:', error);
      
      // Fallback to individual price fetching
      return await this.getBestPriceIndividual(tokenIn, tokenOut, amountIn);
    }
  }

  // Fallback individual price fetching
  async getBestPriceIndividual(tokenIn, tokenOut, amountIn) {
    // Reuse the original logic but with individual calls
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
          latency,
          success: true
        };
      }
    });

    // Find best price
    let bestPrice = null;
    let bestDex = null;
    
    for (const [dexName, priceData] of Object.entries(prices)) {
      if (priceData.success && priceData.price && priceData.price.amountOut) {
        const amountOut = BigInt(priceData.price.amountOut);
        if (!bestPrice || amountOut > bestPrice) {
          bestPrice = amountOut;
          bestDex = {
            dexName,
            ...priceData
          };
        }
      }
    }

    if (bestDex) {
      logger.debug(`Best individual price: ${bestDex.dexName} (${bestDex.latency}ms)`);
      return {
        ...bestDex,
        batched: false
      };
    }

    throw new Error('No valid prices found');
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
