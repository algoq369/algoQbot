const Redis = require('ioredis');
const logger = require('../logger');
const config = require('../config');

class CacheManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.fallbackCache = new Map(); // In-memory fallback
    this.maxFallbackSize = 1000;
    
    // Different TTLs for different data types
    this.ttls = {
      price: 5,        // 5 seconds for prices
      balance: 30,     // 30 seconds for balances
      analytics: 300,  // 5 minutes for analytics
      static: 3600,    // 1 hour for static data
      dex: 10,         // 10 seconds for DEX data
      gas: 60          // 1 minute for gas prices
    };

    this.initializeRedis();
  }

  async initializeRedis() {
    // Skip Redis if explicitly disabled
    if (process.env.SKIP_REDIS === 'true') {
      logger.info('ℹ️  Redis disabled - using in-memory cache only');
      this.redis = null;
      this.isConnected = false;
      return;
    }

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis connection retry ${times}, delay: ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('connect', () => {
        logger.info('✅ Redis connected');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('❌ Redis connection error:', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('🔌 Redis connection closed');
        this.isConnected = false;
      });

      // Test connection
      await this.redis.ping();
      logger.info('✅ Redis cache manager initialized');

    } catch (error) {
      logger.info('ℹ️  Redis not available - using in-memory cache only');
      if (this.redis) {
        try {
          this.redis.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        this.redis = null;
      }
      this.isConnected = false;
    }
  }

  // Get cached data with fallback
  async get(key, dataType = 'static') {
    try {
      if (this.isConnected && this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          logger.debug(`Cache hit: ${key}`);
          return JSON.parse(cached);
        }
      }

      // Fallback to in-memory cache
      if (this.fallbackCache.has(key)) {
        const cached = this.fallbackCache.get(key);
        if (cached.expiry > Date.now()) {
          logger.debug(`Fallback cache hit: ${key}`);
          return cached.data;
        } else {
          this.fallbackCache.delete(key);
        }
      }

      logger.debug(`Cache miss: ${key}`);
      return null;

    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  // Set cached data with TTL
  async set(key, data, dataType = 'static', customTtl = null) {
    try {
      const ttl = customTtl || this.ttls[dataType] || 300; // Default 5 minutes
      const serialized = JSON.stringify(data);

      if (this.isConnected && this.redis) {
        await this.redis.setex(key, ttl, serialized);
        logger.debug(`Cached in Redis: ${key} (TTL: ${ttl}s)`);
      }

      // Always store in fallback cache
      this.fallbackCache.set(key, {
        data: data,
        expiry: Date.now() + (ttl * 1000)
      });

      // Cleanup fallback cache if it gets too large
      if (this.fallbackCache.size > this.maxFallbackSize) {
        this.cleanupFallbackCache();
      }

    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  // Get cached price with automatic refresh
  async getCachedPrice(pair, fetcher, dataType = 'price') {
    const key = `price:${pair}`;
    
    try {
      // Try to get from cache first
      let price = await this.get(key, dataType);
      
      if (price && price.timestamp) {
        const age = Date.now() - price.timestamp;
        const maxAge = this.ttls[dataType] * 1000;
        
        if (age < maxAge) {
          logger.debug(`Using cached price for ${pair}: ${price.value}`);
          return price.value;
        }
      }

      // Cache miss or expired, fetch fresh data
      logger.debug(`Fetching fresh price for ${pair}`);
      const freshPrice = await fetcher();
      
      // Cache the fresh data
      await this.set(key, {
        value: freshPrice,
        timestamp: Date.now(),
        pair: pair
      }, dataType);

      return freshPrice;

    } catch (error) {
      logger.error(`Error getting cached price for ${pair}:`, error);
      
      // Return stale data if available
      const staleData = await this.get(key, dataType);
      if (staleData && staleData.value) {
        logger.warn(`Using stale price data for ${pair}`);
        return staleData.value;
      }
      
      throw error;
    }
  }

  // Get cached balance
  async getCachedBalance(address, token, fetcher) {
    const key = `balance:${address}:${token}`;
    
    try {
      const balance = await this.getCachedPrice(key, fetcher, 'balance');
      return balance;
    } catch (error) {
      logger.error(`Error getting cached balance for ${address}:${token}:`, error);
      throw error;
    }
  }

  // Get cached DEX data
  async getCachedDexData(dexName, pair, fetcher) {
    const key = `dex:${dexName}:${pair}`;
    
    try {
      const data = await this.getCachedPrice(key, fetcher, 'dex');
      return data;
    } catch (error) {
      logger.error(`Error getting cached DEX data for ${dexName}:${pair}:`, error);
      throw error;
    }
  }

  // Get cached gas price
  async getCachedGasPrice(fetcher) {
    const key = 'gas:price';
    
    try {
      const gasPrice = await this.getCachedPrice(key, fetcher, 'gas');
      return gasPrice;
    } catch (error) {
      logger.error('Error getting cached gas price:', error);
      throw error;
    }
  }

  // Cache analytics data
  async cacheAnalytics(key, data) {
    await this.set(`analytics:${key}`, {
      data: data,
      timestamp: Date.now()
    }, 'analytics');
  }

  // Get cached analytics
  async getCachedAnalytics(key) {
    return await this.get(`analytics:${key}`, 'analytics');
  }

  // Invalidate cache entries
  async invalidate(pattern) {
    try {
      if (this.isConnected && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.info(`Invalidated ${keys.length} cache entries matching: ${pattern}`);
        }
      }

      // Also clean fallback cache
      for (const key of this.fallbackCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          this.fallbackCache.delete(key);
        }
      }

    } catch (error) {
      logger.error(`Error invalidating cache pattern ${pattern}:`, error);
    }
  }

  // Cleanup fallback cache
  cleanupFallbackCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.fallbackCache.entries()) {
      if (value.expiry <= now) {
        this.fallbackCache.delete(key);
        cleaned++;
      }
    }

    // If still too large, remove oldest entries
    if (this.fallbackCache.size > this.maxFallbackSize) {
      const entries = Array.from(this.fallbackCache.entries());
      entries.sort((a, b) => a[1].expiry - b[1].expiry);
      
      const toRemove = entries.slice(0, Math.floor(this.maxFallbackSize * 0.2));
      toRemove.forEach(([key]) => {
        this.fallbackCache.delete(key);
        cleaned++;
      });
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired fallback cache entries`);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    const stats = {
      redisConnected: this.isConnected,
      fallbackSize: this.fallbackCache.size,
      maxFallbackSize: this.maxFallbackSize,
      ttls: this.ttls
    };

    if (this.isConnected && this.redis) {
      try {
        const info = await this.redis.info('memory');
        const keyspace = await this.redis.info('keyspace');
        
        stats.redisMemory = info;
        stats.redisKeyspace = keyspace;
        stats.redisKeys = await this.redis.dbsize();
      } catch (error) {
        logger.error('Error getting Redis stats:', error);
      }
    }

    return stats;
  }

  // Clear all cache
  async clearAll() {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.flushall();
        logger.info('✅ Redis cache cleared');
      }

      this.fallbackCache.clear();
      logger.info('✅ Fallback cache cleared');

    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.ping();
        return { status: 'healthy', type: 'redis' };
      } else {
        return { status: 'healthy', type: 'fallback' };
      }
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      if (this.redis) {
        await this.redis.quit();
        logger.info('✅ Redis connection closed');
      }
      
      this.fallbackCache.clear();
      logger.info('✅ Cache manager shutdown completed');

    } catch (error) {
      logger.error('Error during cache manager shutdown:', error);
    }
  }
}

module.exports = CacheManager;

