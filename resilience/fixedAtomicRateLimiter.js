const logger = require('../logger');

/**
 * FIXED Atomic Rate Limiter - Addresses TOCTOU Bug
 * 
 * Critical fix for Time-Of-Check-Time-Of-Use bug in refill()
 * where multiple threads could over-credit tokens.
 * 
 * Now uses fully atomic timestamp and token updates.
 */
class FixedAtomicTokenBucket {
  constructor(options = {}) {
    this.capacity = options.capacity || 100;
    this.fillRate = options.fillRate || 10; // tokens per second
    
    // CRITICAL FIX: Use SharedArrayBuffer with atomic operations
    // Layout: [tokens (float), lastRefillMs (bigint)]
    this.buffer = new SharedArrayBuffer(16);
    this.tokensView = new Float64Array(this.buffer, 0, 1);
    this.timestampView = new BigInt64Array(this.buffer, 8, 1);
    
    // Initialize atomically
    Atomics.store(this.tokensView, 0, options.initialTokens || this.capacity);
    Atomics.store(this.timestampView, 0, BigInt(Date.now()));
    
    logger.info(`🪣 Fixed Atomic Token Bucket: ${this.capacity} capacity, ${this.fillRate}/sec`);
  }

  /**
   * CRITICAL FIX: Atomic refill with proper TOCTOU protection
   * 
   * Uses compareExchange on timestamp to ensure only ONE thread
   * performs refill for a given time period.
   */
  refill() {
    const now = BigInt(Date.now());
    
    let lastRefill, elapsed, tokensToAdd;
    let attempts = 0;
    const MAX_ATTEMPTS = 100;
    
    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.warn('⚠️ Max refill attempts reached');
        return;
      }
      
      // CRITICAL: Atomic read of last refill time
      lastRefill = Atomics.load(this.timestampView, 0);
      
      // Calculate elapsed time
      elapsed = Number(now - lastRefill) / 1000; // seconds
      
      // Skip if no time has passed
      if (elapsed <= 0) {
        return;
      }
      
      // Calculate tokens to add
      tokensToAdd = elapsed * this.fillRate;
      
      // CRITICAL: Atomic CAS on timestamp - only winner refills
      const exchanged = Atomics.compareExchange(
        this.timestampView, 0,
        lastRefill, // Expected: old timestamp
        now         // New: current timestamp
      );
      
      if (exchanged !== lastRefill) {
        // Another thread won the race, they will refill
        // Our calculation is now stale, exit
        return;
      }
      
      // We won the CAS, we're responsible for refilling
      break;
      
    } while (true);
    
    // CRITICAL: Atomic token update with capacity limit
    let currentTokens, newTokens;
    do {
      currentTokens = Atomics.load(this.tokensView, 0);
      newTokens = Math.min(this.capacity, currentTokens + tokensToAdd);
      
      const exchanged = Atomics.compareExchange(
        this.tokensView, 0,
        currentTokens,
        newTokens
      );
      
      if (exchanged === currentTokens) {
        // Successfully updated tokens
        break;
      }
      
      // Another thread modified tokens, retry
    } while (true);
    
    logger.debug(`Refilled ${tokensToAdd.toFixed(2)} tokens, now ${newTokens.toFixed(2)}`);
  }

  /**
   * CRITICAL: Atomic token consumption (fixed race condition from previous version)
   */
  takeToken() {
    // Refill first
    this.refill();
    
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;
    
    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.warn('⚠️ Max takeToken attempts reached');
        return false;
      }
      
      const currentTokens = Atomics.load(this.tokensView, 0);
      
      if (currentTokens < 1) {
        return false; // No tokens available
      }
      
      // CRITICAL: Atomic compare-and-swap to consume token
      const exchanged = Atomics.compareExchange(
        this.tokensView, 0,
        currentTokens,
        currentTokens - 1
      );
      
      if (exchanged === currentTokens) {
        // Successfully consumed token
        return true;
      }
      
      // Another thread modified tokens, retry with exponential backoff
      if (attempts > 10) {
        const backoff = Math.min(100, 2 ** (attempts - 10));
        // Busy wait with backoff
        const start = Date.now();
        while (Date.now() - start < backoff) {
          // Spin
        }
      }
      
    } while (true);
  }

  /**
   * Wait for token with timeout
   */
  async waitForToken(timeout = 0) {
    const startTime = Date.now();
    
    while (!this.takeToken()) {
      // Check timeout
      if (timeout > 0 && Date.now() - startTime > timeout) {
        return false;
      }
      
      // Calculate wait time based on fill rate
      const currentTokens = Atomics.load(this.tokensView, 0);
      const tokensNeeded = 1 - currentTokens;
      const waitMs = Math.max(10, (tokensNeeded / this.fillRate) * 1000);
      
      await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 100)));
    }
    
    return true;
  }

  /**
   * Get current token count (atomic read)
   */
  getTokens() {
    this.refill();
    return Atomics.load(this.tokensView, 0);
  }

  /**
   * Get statistics
   */
  getStats() {
    const tokens = this.getTokens();
    const utilization = ((this.capacity - tokens) / this.capacity * 100).toFixed(2);
    
    return {
      tokens: tokens.toFixed(2),
      capacity: this.capacity,
      fillRate: this.fillRate,
      utilization: utilization + '%',
      lastRefill: Number(Atomics.load(this.timestampView, 0))
    };
  }
}

/**
 * FIXED Atomic Rate Limiter with multiple time windows
 */
class FixedAtomicRateLimiter {
  constructor(options = {}) {
    this.options = {
      requestsPerSecond: options.requestsPerSecond || 10,
      requestsPerMinute: options.requestsPerMinute || 100,
      requestsPerHour: options.requestsPerHour || 1000,
      burstSize: options.burstSize || 20,
      ...options
    };
    
    // Create token buckets for different time windows
    this.secondBucket = new FixedAtomicTokenBucket({
      capacity: this.options.burstSize,
      fillRate: this.options.requestsPerSecond,
      initialTokens: this.options.burstSize
    });
    
    this.minuteBucket = new FixedAtomicTokenBucket({
      capacity: this.options.requestsPerMinute,
      fillRate: this.options.requestsPerMinute / 60,
      initialTokens: this.options.requestsPerMinute
    });
    
    this.hourBucket = new FixedAtomicTokenBucket({
      capacity: this.options.requestsPerHour,
      fillRate: this.options.requestsPerHour / 3600,
      initialTokens: this.options.requestsPerHour
    });
    
    // Metrics (atomic counters)
    this.metricsBuffer = new SharedArrayBuffer(32);
    this.metricsView = new BigInt64Array(this.metricsBuffer);
    // [0]: totalRequests, [1]: acceptedRequests, [2]: rejectedRequests, [3]: totalWaitTime
    
    logger.info('🚦 Fixed Atomic Rate Limiter initialized');
  }

  /**
   * Try to acquire permission (all buckets must have tokens)
   */
  async tryAcquire(timeout = 0) {
    const startTime = Date.now();
    
    // Increment total requests
    Atomics.add(this.metricsView, 0, 1n);
    
    try {
      // Check second bucket (with optional wait)
      const secondOk = timeout > 0 ? 
        await this.secondBucket.waitForToken(timeout) : 
        this.secondBucket.takeToken();
      
      if (!secondOk) {
        Atomics.add(this.metricsView, 2, 1n); // rejected
        return { allowed: false, reason: 'second_limit', waitTime: Date.now() - startTime };
      }
      
      // Check minute bucket
      const minuteOk = this.minuteBucket.takeToken();
      if (!minuteOk) {
        Atomics.add(this.metricsView, 2, 1n); // rejected
        return { allowed: false, reason: 'minute_limit', waitTime: Date.now() - startTime };
      }
      
      // Check hour bucket
      const hourOk = this.hourBucket.takeToken();
      if (!hourOk) {
        Atomics.add(this.metricsView, 2, 1n); // rejected
        return { allowed: false, reason: 'hour_limit', waitTime: Date.now() - startTime };
      }
      
      // All checks passed
      const waitTime = Date.now() - startTime;
      Atomics.add(this.metricsView, 1, 1n); // accepted
      Atomics.add(this.metricsView, 3, BigInt(waitTime)); // wait time
      
      return { allowed: true, waitTime: waitTime };
      
    } catch (error) {
      logger.error('Error in rate limiter:', error);
      Atomics.add(this.metricsView, 2, 1n); // rejected
      return { allowed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Execute function with rate limiting
   */
  async execute(fn, timeout = 5000) {
    const result = await this.tryAcquire(timeout);
    
    if (!result.allowed) {
      const error = new Error(`Rate limit exceeded: ${result.reason}`);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.reason = result.reason;
      throw error;
    }
    
    return await fn();
  }

  /**
   * Get current limits
   */
  getLimits() {
    return {
      requestsPerSecond: this.options.requestsPerSecond,
      requestsPerMinute: this.options.requestsPerMinute,
      requestsPerHour: this.options.requestsPerHour,
      burstSize: this.options.burstSize
    };
  }

  /**
   * Get available tokens
   */
  getAvailableTokens() {
    return {
      second: this.secondBucket.getTokens(),
      minute: this.minuteBucket.getTokens(),
      hour: this.hourBucket.getTokens()
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalRequests = Number(Atomics.load(this.metricsView, 0));
    const acceptedRequests = Number(Atomics.load(this.metricsView, 1));
    const rejectedRequests = Number(Atomics.load(this.metricsView, 2));
    const totalWaitTime = Number(Atomics.load(this.metricsView, 3));
    
    const acceptanceRate = totalRequests > 0 ? 
      (acceptedRequests / totalRequests * 100).toFixed(2) : 100;
    
    const avgWaitTime = acceptedRequests > 0 ? 
      (totalWaitTime / acceptedRequests).toFixed(2) : 0;
    
    return {
      totalRequests: totalRequests,
      acceptedRequests: acceptedRequests,
      rejectedRequests: rejectedRequests,
      acceptanceRate: acceptanceRate + '%',
      avgWaitTime: avgWaitTime + 'ms',
      availableTokens: this.getAvailableTokens(),
      buckets: {
        second: this.secondBucket.getStats(),
        minute: this.minuteBucket.getStats(),
        hour: this.hourBucket.getStats()
      }
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    const tokens = this.getAvailableTokens();
    const healthy = tokens.second > 0 || tokens.minute > 0;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      availableCapacity: {
        second: tokens.second > 0,
        minute: tokens.minute > 0,
        hour: tokens.hour > 0
      },
      stats: this.getStats()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    Atomics.store(this.metricsView, 0, 0n);
    Atomics.store(this.metricsView, 1, 0n);
    Atomics.store(this.metricsView, 2, 0n);
    Atomics.store(this.metricsView, 3, 0n);
    
    logger.info('✅ Rate limiter statistics reset');
  }
}

module.exports = { FixedAtomicTokenBucket, FixedAtomicRateLimiter };

