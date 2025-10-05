const { ethers } = require('ethers');
const logger = require('../logger');

// Token Bucket Rate Limiter
class TokenBucket {
  constructor({ capacity, fillRate, initialTokens }) {
    this.capacity = capacity;
    this.fillRate = fillRate; // tokens per second
    this.tokens = initialTokens || capacity;
    this.lastRefill = Date.now();
    
    logger.info(`🪣 Token Bucket initialized: ${capacity} capacity, ${fillRate}/sec fill rate`);
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.fillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async takeToken() {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  async waitForToken() {
    while (!(await this.takeToken())) {
      // Calculate wait time
      const tokensNeeded = 1 - this.tokens;
      const waitMs = (tokensNeeded / this.fillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  getStats() {
    return {
      tokens: this.tokens.toFixed(2),
      capacity: this.capacity,
      fillRate: this.fillRate,
      utilization: ((this.capacity - this.tokens) / this.capacity * 100).toFixed(2) + '%'
    };
  }
}

class RateLimitedProvider {
  constructor(rpcUrls, options = {}) {
    this.rpcUrls = rpcUrls;
    this.options = {
      capacity: options.capacity || 100,
      fillRate: options.fillRate || 10,
      initialTokens: options.initialTokens || 100,
      maxFailures: options.maxFailures || 3,
      failureWindow: options.failureWindow || 60000,
      requestTimeout: options.requestTimeout || 5000,
      ...options
    };
    
    this.providers = rpcUrls.map(url => ({
      provider: new ethers.JsonRpcProvider(url, 'any', {
        staticNetwork: true
      }),
      limiter: new TokenBucket({
        capacity: this.options.capacity,
        fillRate: this.options.fillRate,
        initialTokens: this.options.initialTokens
      }),
      failures: 0,
      lastFailure: null,
      url: url,
      isHealthy: true
    }));
    
    this.currentIndex = 0;
    this.metrics = {
      rpcErrors: new Map(),
      rpcLatency: new Map(),
      rpcRequests: new Map(),
      rateLimitHits: 0,
      providerSwitches: 0
    };
    
    // Initialize metrics
    this.providers.forEach(provider => {
      this.metrics.rpcErrors.set(provider.url, 0);
      this.metrics.rpcLatency.set(provider.url, []);
      this.metrics.rpcRequests.set(provider.url, 0);
    });
    
    logger.info(`🚀 Rate Limited Provider initialized with ${rpcUrls.length} RPC endpoints`);
  }

  // Get healthy provider with rate limiting
  async getProvider() {
    const startIndex = this.currentIndex;
    
    do {
      const provider = this.providers[this.currentIndex];
      
      // Skip if unhealthy
      if (!this.isHealthy(provider)) {
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        continue;
      }
      
      // Check if we have rate limit tokens
      if (await provider.limiter.takeToken()) {
        return provider;
      }
      
      // Try next provider
      this.currentIndex = (this.currentIndex + 1) % this.providers.length;
      
    } while (this.currentIndex !== startIndex);
    
    // All providers exhausted, wait for token
    const provider = this.providers[this.currentIndex];
    await provider.limiter.waitForToken();
    return provider;
  }

  // Check if provider is healthy
  isHealthy(provider) {
    const now = Date.now();
    
    if (provider.failures >= this.options.maxFailures) {
      // Check if failure window has passed
      if (now - provider.lastFailure > this.options.failureWindow) {
        provider.failures = 0; // Reset
        provider.isHealthy = true;
        logger.info(`✅ Provider ${provider.url} recovered from failure window`);
        return true;
      }
      provider.isHealthy = false;
      return false; // Still in cooldown
    }
    
    provider.isHealthy = true;
    return true;
  }

  // Execute RPC call with rate limiting and error handling
  async executeCall(method, ...args) {
    const provider = await this.getProvider();
    
    try {
      const startTime = performance.now();
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC request timeout')), this.options.requestTimeout)
      );
      
      // Execute call with timeout
      const result = await Promise.race([
        provider.provider[method](...args),
        timeoutPromise
      ]);
      
      const latency = performance.now() - startTime;
      
      // Record success metrics
      this.metrics.rpcRequests.set(provider.url, this.metrics.rpcRequests.get(provider.url) + 1);
      
      // Track latency
      const latencies = this.metrics.rpcLatency.get(provider.url);
      latencies.push(latency);
      if (latencies.length > 1000) {
        latencies.splice(0, latencies.length - 1000);
      }
      
      // Success - reset failure count
      provider.failures = 0;
      
      return result;
      
    } catch (error) {
      // Record failure
      provider.failures++;
      provider.lastFailure = Date.now();
      
      this.metrics.rpcErrors.set(provider.url, this.metrics.rpcErrors.get(provider.url) + 1);
      
      // Handle rate limiting
      if (error.code === 429 || error.message.includes('rate limit') || error.message.includes('too many requests')) {
        this.metrics.rateLimitHits++;
        logger.warn(`⚠️ Rate limit hit on ${provider.url}, switching provider`);
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        this.metrics.providerSwitches++;
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.executeCall(method, ...args);
      }
      
      // Handle network errors
      if (this.isNetworkError(error)) {
        logger.warn(`⚠️ Network error on ${provider.url}: ${error.message}`);
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        this.metrics.providerSwitches++;
        
        // Retry with different provider
        return this.executeCall(method, ...args);
      }
      
      // Handle timeout
      if (error.message.includes('timeout')) {
        logger.warn(`⚠️ Timeout on ${provider.url}`);
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        this.metrics.providerSwitches++;
        
        // Retry with different provider
        return this.executeCall(method, ...args);
      }
      
      throw error;
    }
  }

  // Check if error is network-related
  isNetworkError(error) {
    const networkErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEDOUT',
      'network',
      'connection',
      'timeout'
    ];
    
    return networkErrors.some(err => 
      error.code === err || error.message.toLowerCase().includes(err)
    );
  }

  // Convenience methods for common RPC calls
  async getBalance(address) {
    return this.executeCall('getBalance', address);
  }

  async getBlockNumber() {
    return this.executeCall('getBlockNumber');
  }

  async getGasPrice() {
    return this.executeCall('getGasPrice');
  }

  async estimateGas(transaction) {
    return this.executeCall('estimateGas', transaction);
  }

  async getTransactionCount(address) {
    return this.executeCall('getTransactionCount', address);
  }

  async sendTransaction(transaction) {
    return this.executeCall('sendTransaction', transaction);
  }

  async call(transaction, blockTag = 'latest') {
    return this.executeCall('call', transaction, blockTag);
  }

  async getCode(address, blockTag = 'latest') {
    return this.executeCall('getCode', address, blockTag);
  }

  async getStorageAt(address, position, blockTag = 'latest') {
    return this.executeCall('getStorageAt', address, position, blockTag);
  }

  async getLogs(filter) {
    return this.executeCall('getLogs', filter);
  }

  // Get provider statistics
  getStats() {
    const stats = {
      totalRequests: 0,
      totalErrors: 0,
      totalLatency: 0,
      rateLimitHits: this.metrics.rateLimitHits,
      providerSwitches: this.metrics.providerSwitches,
      providers: []
    };
    
    this.providers.forEach(provider => {
      const requests = this.metrics.rpcRequests.get(provider.url);
      const errors = this.metrics.rpcErrors.get(provider.url);
      const latencies = this.metrics.rpcLatency.get(provider.url);
      
      const avgLatency = latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0;
      
      const p95Latency = latencies.length > 0
        ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
        : 0;
      
      stats.totalRequests += requests;
      stats.totalErrors += errors;
      stats.totalLatency += avgLatency;
      
      stats.providers.push({
        url: provider.url,
        isHealthy: provider.isHealthy,
        failures: provider.failures,
        requests: requests,
        errors: errors,
        errorRate: requests > 0 ? (errors / requests * 100).toFixed(2) + '%' : '0%',
        avgLatency: avgLatency.toFixed(2) + 'ms',
        p95Latency: p95Latency.toFixed(2) + 'ms',
        limiter: provider.limiter.getStats()
      });
    });
    
    stats.avgLatency = stats.totalRequests > 0 ? (stats.totalLatency / this.providers.length).toFixed(2) + 'ms' : '0ms';
    stats.overallErrorRate = stats.totalRequests > 0 ? (stats.totalErrors / stats.totalRequests * 100).toFixed(2) + '%' : '0%';
    
    return stats;
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthyProviders = stats.providers.filter(p => p.isHealthy).length;
    const totalProviders = stats.providers.length;
    
    const healthy = healthyProviders > 0 && 
                   stats.overallErrorRate < 20 && 
                   stats.rateLimitHits < 100;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      healthyProviders: healthyProviders,
      totalProviders: totalProviders,
      healthRatio: totalProviders > 0 ? (healthyProviders / totalProviders * 100).toFixed(2) : 0,
      stats: stats,
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations for optimization
  getRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    
    if (stats.healthyProviders === 0) {
      recommendations.push('CRITICAL: No healthy RPC providers available');
    }
    
    if (stats.overallErrorRate > 10) {
      recommendations.push('High error rate detected - check RPC endpoint stability');
    }
    
    if (stats.rateLimitHits > 50) {
      recommendations.push('High rate limit hits - consider increasing rate limits or adding more providers');
    }
    
    if (stats.providerSwitches > 100) {
      recommendations.push('Frequent provider switching - check provider stability');
    }
    
    return recommendations;
  }

  // Reset provider failure counts
  resetProviderFailures() {
    this.providers.forEach(provider => {
      provider.failures = 0;
      provider.lastFailure = null;
      provider.isHealthy = true;
    });
    
    logger.info('✅ All provider failure counts reset');
  }

  // Force provider switch
  switchProvider() {
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;
    this.metrics.providerSwitches++;
    
    const newProvider = this.providers[this.currentIndex];
    logger.info(`🔄 Switched to provider: ${newProvider.url}`);
    
    return newProvider;
  }
}

module.exports = RateLimitedProvider;

