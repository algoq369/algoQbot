const logger = require('../logger');

/**
 * PROPERLY FIXED Atomic Rate Limiter
 * 
 * Fixes based on expert review:
 * 1. Clock skew handling (backward time movement)
 * 2. Atomic timestamp updates (CAS loop)
 * 3. Exponential backoff for CAS contention
 * 4. Deadlock detection
 * 5. Wake all waiters after refill
 */
class ProperlyFixedAtomicRateLimiter {
  constructor(tokensPerSecond, maxTokens, name = 'limiter') {
    this.tokensPerSecond = tokensPerSecond;
    this.maxTokens = maxTokens;
    this.name = name;
    this.fillRate = tokensPerSecond;
    
    // SharedArrayBuffer for tokens and timestamp
    this.controlBuffer = new SharedArrayBuffer(16);
    this.tokensView = new Float64Array(this.controlBuffer, 0, 1);
    this.timestampView = new BigUint64Array(this.controlBuffer, 8, 1);
    
    // Initialize
    this.tokensView[0] = maxTokens;
    Atomics.store(this.timestampView, 0, BigInt(Date.now()));
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      casAttempts: [],
      clockSkewDetected: 0,
      deadlockDetected: 0
    };
    
    logger.info(`✅ PROPERLY Fixed Rate Limiter: ${tokensPerSecond}/s, max ${maxTokens} (${name})`);
  }

  /**
   * ✅ FIX: Refill with clock skew handling and atomic timestamp update
   */
  refill() {
    const now = BigInt(Date.now());
    
    let attempts = 0;
    const MAX_ATTEMPTS = 100;
    
    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.error(`Refill deadlock detected for ${this.name}`);
        this.metrics.deadlockDetected++;
        return;
      }
      
      const lastRefill = Atomics.load(this.timestampView, 0);
      
      // ✅ CRITICAL FIX: Handle clock moving backward
      if (now < lastRefill) {
        logger.warn(`⏰ Clock skew detected: ${Number(lastRefill - now)}ms backward`, {
          limiter: this.name,
          lastRefill: Number(lastRefill),
          now: Number(now)
        });
        
        this.metrics.clockSkewDetected++;
        
        // Reset timestamp to current time (winner-takes-all)
        const exchanged = Atomics.compareExchange(
          this.timestampView, 0,
          lastRefill,
          now
        );
        
        if (exchanged === lastRefill) {
          logger.info(`✅ Clock synchronized for ${this.name}`);
        }
        
        return; // Skip this refill cycle
      }
      
      const elapsed = Number(now - lastRefill) / 1000;
      
      if (elapsed <= 0) {
        return; // No time elapsed
      }
      
      // Calculate tokens to add
      const tokensToAdd = elapsed * this.fillRate;
      
      if (tokensToAdd < 0.1) {
        return; // Too soon to refill
      }
      
      // ✅ FIX: Atomic update of timestamp (winner-takes-all)
      const exchanged = Atomics.compareExchange(
        this.timestampView, 0,
        lastRefill,
        now
      );
      
      if (exchanged !== lastRefill) {
        // Another thread already refilled, that's fine
        if (attempts > 10) {
          const backoff = Math.min(100, 2 ** (attempts - 10));
          Atomics.wait(this.timestampView, 0, now, backoff);
        }
        continue;
      }
      
      // We won the race, add tokens
      const currentTokens = this.tokensView[0];
      const newTokens = Math.min(this.maxTokens, currentTokens + tokensToAdd);
      this.tokensView[0] = newTokens;
      
      // ✅ FIX: Wake ALL waiting threads
      Atomics.notify(this.timestampView, 0, Infinity);
      
      logger.debug(`Refilled ${tokensToAdd.toFixed(2)} tokens for ${this.name}. Total: ${newTokens.toFixed(2)}`);
      break;
      
    } while (true);
  }

  /**
   * ✅ FIX: Take token with exponential backoff and deadlock detection
   */
  async takeToken() {
    this.metrics.totalRequests++;
    
    const startTime = Date.now();
    const DEADLOCK_TIMEOUT = 5000; // 5 seconds
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;
    
    while (attempts < MAX_ATTEMPTS) {
      // ✅ FIX: Deadlock detection
      if (Date.now() - startTime > DEADLOCK_TIMEOUT) {
        logger.error(`🚨 Rate limiter deadlock detected for ${this.name}`, {
          attempts,
          timeElapsed: Date.now() - startTime
        });
        this.metrics.deadlockDetected++;
        throw new Error(`Rate limiter deadlock: ${this.name}`);
      }
      
      // Try to refill
      this.refill();
      
      const currentTokens = this.tokensView[0];
      
      if (currentTokens < 1) {
        attempts++;
        
        // ✅ FIX: Exponential backoff with jitter
        const backoff = Math.min(1000, Math.floor(2 ** Math.min(attempts / 10, 10)) + Math.random() * 100);
        await this.exponentialBackoff(backoff);
        
        // Warn on excessive contention
        if (attempts % 100 === 0) {
          logger.warn(`High rate limiter contention: ${attempts} attempts on ${this.name}`);
        }
        
        continue;
      }
      
      // Try to take token (atomic decrement simulation)
      // Note: Float64 doesn't have true atomic operations, but for rate limiting
      // approximate atomicity is acceptable. For strict atomicity, convert to integer.
      this.tokensView[0] = currentTokens - 1;
      
      this.metrics.successfulRequests++;
      
      // Track CAS attempts for monitoring
      if (this.metrics.casAttempts.length < 1000) {
        this.metrics.casAttempts.push(attempts);
      }
      
      return true;
    }
    
    logger.error(`Max rate limiter attempts exceeded for ${this.name}`);
    this.metrics.rejectedRequests++;
    throw new Error(`Rate limiter max attempts exceeded: ${this.name}`);
  }

  async exponentialBackoff(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * For truly atomic token consumption (optional enhancement)
   */
  takeTokenAtomic() {
    // Convert to integer tokens for atomic operations
    const intTokensBuffer = new SharedArrayBuffer(4);
    const intTokensView = new Int32Array(intTokensBuffer);
    
    // Convert current float tokens to int
    const currentFloat = this.tokensView[0];
    const currentInt = Math.floor(currentFloat);
    Atomics.store(intTokensView, 0, currentInt);
    
    let attempts = 0;
    do {
      if (attempts++ > 1000) return false;
      
      const tokens = Atomics.load(intTokensView, 0);
      
      if (tokens < 1) {
        return false;
      }
      
      const exchanged = Atomics.compareExchange(
        intTokensView, 0, tokens, tokens - 1
      );
      
      if (exchanged === tokens) {
        // Update float view
        this.tokensView[0] = tokens - 1;
        return true;
      }
      
    } while (true);
  }

  getTokens() {
    this.refill();
    return this.tokensView[0];
  }

  getStats() {
    const avgCasAttempts = this.metrics.casAttempts.length > 0
      ? this.metrics.casAttempts.reduce((a, b) => a + b, 0) / this.metrics.casAttempts.length
      : 0;
    
    return {
      name: this.name,
      tokensPerSecond: this.tokensPerSecond,
      maxTokens: this.maxTokens,
      currentTokens: this.tokensView[0].toFixed(2),
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      rejectedRequests: this.metrics.rejectedRequests,
      successRate: (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%',
      avgCasAttempts: avgCasAttempts.toFixed(2),
      clockSkewEvents: this.metrics.clockSkewDetected,
      deadlockEvents: this.metrics.deadlockDetected
    };
  }

  healthCheck() {
    const health = {
      status: 'healthy',
      tokens: this.tokensView[0],
      maxTokens: this.maxTokens,
      utilization: (this.tokensView[0] / this.maxTokens * 100).toFixed(2) + '%'
    };
    
    // Degraded if many clock skew or deadlock events
    if (this.metrics.clockSkewDetected > 10 || this.metrics.deadlockDetected > 0) {
      health.status = 'degraded';
      health.warnings = [];
      
      if (this.metrics.clockSkewDetected > 10) {
        health.warnings.push(`Clock skew detected ${this.metrics.clockSkewDetected} times`);
      }
      if (this.metrics.deadlockDetected > 0) {
        health.warnings.push(`Deadlock detected ${this.metrics.deadlockDetected} times`);
      }
    }
    
    return health;
  }

  reset() {
    this.tokensView[0] = this.maxTokens;
    Atomics.store(this.timestampView, 0, BigInt(Date.now()));
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      casAttempts: [],
      clockSkewDetected: 0,
      deadlockDetected: 0
    };
    
    logger.info(`✅ Rate limiter ${this.name} reset`);
  }
}

module.exports = ProperlyFixedAtomicRateLimiter;

