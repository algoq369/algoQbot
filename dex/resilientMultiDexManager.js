const logger = require('../logger');

// Simple Circuit Breaker implementation
class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.timeout = options.timeout || 5000;
    this.errorThresholdPercentage = options.errorThresholdPercentage || 50;
    this.resetTimeout = options.resetTimeout || 30000;
    this.name = options.name || 'circuit-breaker';
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
    
    this.eventEmitter = new (require('events'))();
    
    logger.info(`🚀 Circuit Breaker initialized: ${this.name}`);
  }

  async fire(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      } else {
        this.state = 'HALF_OPEN';
        this.eventEmitter.emit('halfOpen');
        logger.info(`🔄 Circuit breaker ${this.name} moved to HALF_OPEN`);
      }
    }

    try {
      const result = await Promise.race([
        this.fn(...args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);

      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.successCount++;
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.eventEmitter.emit('close');
      logger.info(`✅ Circuit breaker ${this.name} moved to CLOSED`);
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    const totalRequests = this.successCount + this.failureCount;
    const errorPercentage = (this.failureCount / totalRequests) * 100;
    
    if (errorPercentage >= this.errorThresholdPercentage && this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.eventEmitter.emit('open');
      logger.warn(`⚠️ Circuit breaker ${this.name} moved to OPEN (${errorPercentage.toFixed(2)}% errors)`);
    }
  }

  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  get opened() {
    return this.state === 'OPEN';
  }

  get stats() {
    const totalRequests = this.successCount + this.failureCount;
    const errorPercentage = totalRequests > 0 ? (this.failureCount / totalRequests) * 100 : 0;
    
    return {
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
      errorPercentage: errorPercentage.toFixed(2),
      nextAttempt: this.nextAttempt,
      lastFailureTime: this.lastFailureTime
    };
  }
}

class ResilientMultiDexManager {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    
    this.dexes = new Map();
    this.circuitBreakers = new Map();
    this.metrics = {
      dexCircuitOpen: new Map(),
      dexCircuitClose: new Map(),
      dexCircuitHalfOpen: new Map(),
      dexQueries: new Map(),
      dexErrors: new Map()
    };
    
    // Initialize DEXes with circuit breakers
    this.initializeDEXes();
    
    logger.info('🚀 Resilient Multi-DEX Manager initialized');
  }

  // Initialize DEXes with circuit breakers
  initializeDEXes() {
    try {
      // Initialize PancakeSwap
      this.initializeDEX('pancakeswap', new (require('../pancakeSwap'))(this.provider, this.wallet));
      
      // Initialize other DEXes with error handling
      try {
        this.initializeDEX('uniswapv2', new (require('./uniswapV2'))(this.provider, this.wallet));
      } catch (error) {
        logger.warn('⚠️ UniswapV2 not available:', error.message);
      }
      
      try {
        this.initializeDEX('sushiswap', new (require('./sushiSwap'))(this.provider, this.wallet));
      } catch (error) {
        logger.warn('⚠️ SushiSwap not available:', error.message);
      }
      
      try {
        this.initializeDEX('1inch', new (require('./oneInch'))(this.provider, this.wallet));
      } catch (error) {
        logger.warn('⚠️ 1inch not available:', error.message);
      }
      
    } catch (error) {
      logger.error('❌ Error initializing DEXes:', error);
      throw error;
    }
  }

  // Initialize individual DEX with circuit breaker
  initializeDEX(name, dex) {
    this.dexes.set(name, dex);
    
    const breaker = new CircuitBreaker(
      async (...args) => dex.getPrice(...args),
      {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        name: `dex-${name}`
      }
    );
    
    // Monitor circuit state
    breaker.on('open', () => {
      logger.warn(`⚠️ Circuit breaker OPEN for ${name}`);
      this.metrics.dexCircuitOpen.set(name, (this.metrics.dexCircuitOpen.get(name) || 0) + 1);
    });
    
    breaker.on('halfOpen', () => {
      logger.info(`🔄 Circuit breaker HALF-OPEN for ${name}`);
      this.metrics.dexCircuitHalfOpen.set(name, (this.metrics.dexCircuitHalfOpen.get(name) || 0) + 1);
    });
    
    breaker.on('close', () => {
      logger.info(`✅ Circuit breaker CLOSED for ${name}`);
      this.metrics.dexCircuitClose.set(name, (this.metrics.dexCircuitClose.get(name) || 0) + 1);
    });
    
    this.circuitBreakers.set(name, breaker);
    
    logger.info(`✅ Initialized DEX: ${name} with circuit breaker`);
  }

  // CRITICAL: Get best price with circuit breaker protection
  async getBestPrice(tokenIn, tokenOut, amountIn) {
    const startTime = performance.now();
    const pricePromises = [];
    const activeDexes = [];
    
    for (const [name, breaker] of this.circuitBreakers) {
      // Skip if circuit is open
      if (breaker.opened) {
        logger.debug(`Skipping ${name} (circuit open)`);
        continue;
      }
      
      activeDexes.push(name);
      pricePromises.push(
        breaker.fire(tokenIn, tokenOut, amountIn)
          .then(price => {
            this.metrics.dexQueries.set(name, (this.metrics.dexQueries.get(name) || 0) + 1);
            return { dex: name, price: price, latency: performance.now() - startTime };
          })
          .catch(err => {
            logger.warn(`${name} query failed:`, err.message);
            this.metrics.dexErrors.set(name, (this.metrics.dexErrors.get(name) || 0) + 1);
            return null; // Don't fail entire operation
          })
      );
    }
    
    if (pricePromises.length === 0) {
      throw new Error('All DEX circuits are open - no available liquidity sources');
    }
    
    try {
      // Wait for all price queries with timeout
      const results = await Promise.allSettled(
        pricePromises.map(promise => 
          Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Price query timeout')), 5000)
            )
          ])
        )
      );
      
      // Filter successful results
      const validPrices = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value)
        .filter(price => price.price > 0);
      
      if (validPrices.length === 0) {
        throw new Error('No valid prices received from any DEX');
      }
      
      // Find best price
      const bestPrice = validPrices.reduce((best, current) => 
        current.price > best.price ? current : best
      );
      
      const totalLatency = performance.now() - startTime;
      
      logger.info(`✅ Best price found: ${bestPrice.dex} - ${bestPrice.price} (${validPrices.length}/${activeDexes.length} DEXes, ${totalLatency.toFixed(2)}ms)`);
      
      return {
        price: bestPrice.price,
        dex: bestPrice.dex,
        source: bestPrice.dex,
        latency: totalLatency,
        alternatives: validPrices.filter(p => p.dex !== bestPrice.dex),
        dexCount: validPrices.length,
        totalDexCount: activeDexes.length
      };
      
    } catch (error) {
      logger.error('❌ Failed to get best price:', error);
      throw error;
    }
  }

  // Execute trade with circuit breaker protection
  async executeTrade(tokenIn, tokenOut, amountIn, slippage = 0.02, preferredDex = null) {
    try {
      // Get best price first
      const priceInfo = await this.getBestPrice(tokenIn, tokenOut, amountIn);
      
      // Use preferred DEX if available and healthy
      let targetDex = priceInfo.dex;
      if (preferredDex && this.circuitBreakers.has(preferredDex) && !this.circuitBreakers.get(preferredDex).opened) {
        targetDex = preferredDex;
        logger.info(`Using preferred DEX: ${preferredDex}`);
      }
      
      // Execute trade on selected DEX
      const dex = this.dexes.get(targetDex);
      if (!dex) {
        throw new Error(`DEX not available: ${targetDex}`);
      }
      
      const breaker = this.circuitBreakers.get(targetDex);
      if (breaker.opened) {
        throw new Error(`DEX circuit is open: ${targetDex}`);
      }
      
      // Execute trade with circuit breaker protection
      const tradeResult = await breaker.fire(
        tokenIn, tokenOut, amountIn, slippage
      );
      
      logger.info(`✅ Trade executed on ${targetDex}:`, tradeResult);
      
      return {
        ...tradeResult,
        dex: targetDex,
        priceInfo: priceInfo
      };
      
    } catch (error) {
      logger.error('❌ Trade execution failed:', error);
      throw error;
    }
  }

  // Get DEX status and health
  getDexStatus() {
    const status = {};
    
    for (const [name, breaker] of this.circuitBreakers) {
      status[name] = {
        circuitState: breaker.state,
        circuitStats: breaker.stats,
        isHealthy: !breaker.opened,
        queries: this.metrics.dexQueries.get(name) || 0,
        errors: this.metrics.dexErrors.get(name) || 0,
        circuitOpens: this.metrics.dexCircuitOpen.get(name) || 0,
        circuitCloses: this.metrics.dexCircuitClose.get(name) || 0
      };
    }
    
    return status;
  }

  // Get manager statistics
  getStats() {
    const totalQueries = Array.from(this.metrics.dexQueries.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.metrics.dexErrors.values()).reduce((a, b) => a + b, 0);
    const errorRate = totalQueries > 0 ? (totalErrors / totalQueries * 100).toFixed(2) : 0;
    
    const healthyDexes = Array.from(this.circuitBreakers.values())
      .filter(breaker => !breaker.opened).length;
    const totalDexes = this.circuitBreakers.size;
    
    return {
      totalDexes: totalDexes,
      healthyDexes: healthyDexes,
      unhealthyDexes: totalDexes - healthyDexes,
      healthRatio: totalDexes > 0 ? (healthyDexes / totalDexes * 100).toFixed(2) : 0,
      totalQueries: totalQueries,
      totalErrors: totalErrors,
      errorRate: errorRate + '%',
      dexStatus: this.getDexStatus()
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthy = stats.healthyDexes > 0 && stats.errorRate < 50;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      stats: stats,
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations for optimization
  getRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    
    if (stats.healthyDexes === 0) {
      recommendations.push('CRITICAL: No healthy DEXes available - check network connectivity');
    }
    
    if (stats.errorRate > 20) {
      recommendations.push('High error rate detected - consider increasing timeouts or checking DEX endpoints');
    }
    
    if (stats.healthyDexes < stats.totalDexes) {
      recommendations.push(`${stats.unhealthyDexes} DEX(es) are unhealthy - monitor circuit breaker states`);
    }
    
    return recommendations;
  }

  // Reset circuit breaker for specific DEX
  resetCircuitBreaker(dexName) {
    const breaker = this.circuitBreakers.get(dexName);
    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.nextAttempt = Date.now();
      logger.info(`✅ Circuit breaker reset for ${dexName}`);
    }
  }

  // Reset all circuit breakers
  resetAllCircuitBreakers() {
    for (const [name, breaker] of this.circuitBreakers) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.nextAttempt = Date.now();
    }
    logger.info('✅ All circuit breakers reset');
  }
}

module.exports = ResilientMultiDexManager;

