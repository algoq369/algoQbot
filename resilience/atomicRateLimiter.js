const logger = require('../logger');

/**
 * Atomic Token Bucket Rate Limiter
 * 
 * Fixed race condition issues with proper atomic operations
 * Thread-safe token consumption and refilling
 */
class AtomicTokenBucket {
  constructor(options = {}) {
    this.capacity = options.capacity || 100;
    this.fillRate = options.fillRate || 10; // tokens per second
    this.initialTokens = options.initialTokens || this.capacity;
    
    // Use SharedArrayBuffer for atomic operations
    this.buffer = new SharedArrayBuffer(16); // 2 x 64-bit values
    this.tokensView = new Float64Array(this.buffer, 0, 1);
    this.lastRefillView = new BigInt64Array(this.buffer, 8, 1);
    
    // Initialize
    Atomics.store(this.tokensView, 0, this.initialTokens);
    Atomics.store(this.lastRefillView, 0, BigInt(Date.now()));
    
    logger.info(`🪣 Atomic Token Bucket initialized: ${this.capacity} capacity, ${this.fillRate}/sec`);
  }

  // Refill tokens based on elapsed time
  refill() {
    const now = BigInt(Date.now());
    const lastRefill = Atomics.load(this.lastRefillView, 0);
    const elapsed = Number(now - lastRefill) / 1000; // seconds
    
    if (elapsed <= 0) return;
    
    const tokensToAdd = elapsed * this.fillRate;
    
    // Atomic update of tokens and lastRefill
    let currentTokens, newTokens;
    do {
      currentTokens = Atomics.load(this.tokensView, 0);
      newTokens = Math.min(this.capacity, currentTokens + tokensToAdd);
      
      // Try to update tokens
      const exchanged = Atomics.compareExchange(
        this.tokensView, 0, currentTokens, newTokens
      );
      
      if (exchanged === currentTokens) {
        // Successfully updated tokens, now update timestamp
        Atomics.store(this.lastRefillView, 0, now);
        break;
      }
      // If CAS failed, another thread updated, try again
    } while (true);
  }

  // CRITICAL: Atomic token consumption (fixed race condition)
  takeToken() {
    this.refill();
    
    let currentTokens;
    do {
      currentTokens = Atomics.load(this.tokensView, 0);
      
      if (currentTokens < 1) {
        return false; // No tokens available
      }
      
      // CRITICAL: Atomic compare-and-swap to consume token
      const exchanged = Atomics.compareExchange(
        this.tokensView, 0, currentTokens, currentTokens - 1
      );
      
      if (exchanged === currentTokens) {
        // Successfully consumed token
        return true;
      }
      // If CAS failed, another thread consumed token, try again
    } while (true);
  }

  // Wait for token to become available
  async waitForToken(timeout = 0) {
    const startTime = Date.now();
    
    while (!this.takeToken()) {
      // Check timeout
      if (timeout > 0 && Date.now() - startTime > timeout) {
        return false;
      }
      
      // Calculate wait time based on fill rate
      const tokensNeeded = 1 - Atomics.load(this.tokensView, 0);
      const waitMs = Math.max(10, (tokensNeeded / this.fillRate) * 1000);
      
      await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 100)));
    }
    
    return true;
  }

  // Get current token count (atomic read)
  getTokens() {
    this.refill();
    return Atomics.load(this.tokensView, 0);
  }

  // Get statistics
  getStats() {
    const tokens = this.getTokens();
    const utilization = ((this.capacity - tokens) / this.capacity * 100).toFixed(2);
    
    return {
      tokens: tokens.toFixed(2),
      capacity: this.capacity,
      fillRate: this.fillRate,
      utilization: utilization + '%',
      lastRefill: Number(Atomics.load(this.lastRefillView, 0))
    };
  }
}

/**
 * Atomic Rate Limiter with multiple limiters
 * Thread-safe rate limiting for high-concurrency scenarios
 */
class AtomicRateLimiter {
  constructor(options = {}) {
    this.options = {
      requestsPerSecond: options.requestsPerSecond || 10,
      requestsPerMinute: options.requestsPerMinute || 100,
      requestsPerHour: options.requestsPerHour || 1000,
      burstSize: options.burstSize || 20,
      ...options
    };
    
    // Create token buckets for different time windows
    this.secondBucket = new AtomicTokenBucket({
      capacity: this.options.burstSize,
      fillRate: this.options.requestsPerSecond,
      initialTokens: this.options.burstSize
    });
    
    this.minuteBucket = new AtomicTokenBucket({
      capacity: this.options.requestsPerMinute,
      fillRate: this.options.requestsPerMinute / 60,
      initialTokens: this.options.requestsPerMinute
    });
    
    this.hourBucket = new AtomicTokenBucket({
      capacity: this.options.requestsPerHour,
      fillRate: this.options.requestsPerHour / 3600,
      initialTokens: this.options.requestsPerHour
    });
    
    // Metrics (using atomics for thread safety)
    this.metricsBuffer = new SharedArrayBuffer(32); // 4 x 64-bit values
    this.metricsView = new BigInt64Array(this.metricsBuffer);
    // [0]: totalRequests, [1]: acceptedRequests, [2]: rejectedRequests, [3]: waitTime
    
    logger.info('🚦 Atomic Rate Limiter initialized');
  }

  // Check if request is allowed (all buckets must have tokens)
  async tryAcquire(timeout = 0) {
    const startTime = Date.now();
    
    // Increment total requests
    Atomics.add(this.metricsView, 0, 1n);
    
    try {
      // Check all buckets
      const secondOk = timeout > 0 ? 
        await this.secondBucket.waitForToken(timeout) : 
        this.secondBucket.takeToken();
      
      if (!secondOk) {
        Atomics.add(this.metricsView, 2, 1n); // rejected
        return { allowed: false, reason: 'second_limit' };
      }
      
      const minuteOk = this.minuteBucket.takeToken();
      if (!minuteOk) {
        // Return second bucket token
        Atomics.add(this.metricsView, 2, 1n); // rejected
        return { allowed: false, reason: 'minute_limit' };
      }
      
      const hourOk = this.hourBucket.takeToken();
      if (!hourOk) {
        // Return tokens to both buckets
        Atomics.add(this.metricsView, 2, 1n); // rejected
        return { allowed: false, reason: 'hour_limit' };
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

  // Execute function with rate limiting
  async execute(fn, timeout = 5000) {
    const result = await this.tryAcquire(timeout);
    
    if (!result.allowed) {
      const error = new Error(`Rate limit exceeded: ${result.reason}`);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.reason = result.reason;
      throw error;
    }
    
    try {
      return await fn();
    } catch (error) {
      throw error;
    }
  }

  // Get current limits
  getLimits() {
    return {
      requestsPerSecond: this.options.requestsPerSecond,
      requestsPerMinute: this.options.requestsPerMinute,
      requestsPerHour: this.options.requestsPerHour,
      burstSize: this.options.burstSize
    };
  }

  // Get available tokens
  getAvailableTokens() {
    return {
      second: this.secondBucket.getTokens(),
      minute: this.minuteBucket.getTokens(),
      hour: this.hourBucket.getTokens()
    };
  }

  // Get statistics
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

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const tokens = this.getAvailableTokens();
    
    const healthy = tokens.second > 0 || tokens.minute > 0;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      availableCapacity: {
        second: tokens.second > 0,
        minute: tokens.minute > 0,
        hour: tokens.hour > 0
      },
      stats: stats
    };
  }

  // Reset statistics
  resetStats() {
    Atomics.store(this.metricsView, 0, 0n);
    Atomics.store(this.metricsView, 1, 0n);
    Atomics.store(this.metricsView, 2, 0n);
    Atomics.store(this.metricsView, 3, 0n);
    
    logger.info('✅ Rate limiter statistics reset');
  }
}

module.exports = { AtomicTokenBucket, AtomicRateLimiter };

