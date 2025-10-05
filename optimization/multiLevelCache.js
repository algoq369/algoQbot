const LRUCache = require('lru-cache');
const Redis = require('ioredis');
const logger = require('../logger');

class MultiLevelCache {
  constructor() {
    // L1: In-process memory cache (fastest)
    this.l1Cache = new LRUCache({ 
      max: 1000,
      ttl: 1000, // 1 second
      updateAgeOnGet: true,
      allowStale: false
    });
    
    // L2: Redis cache (fast)
    this.l2Cache = null;
    this.redisConnected = false;
    
    // L3: Database/materialized views (persistent)
    this.l3Cache = new Map();
    
    // Cache statistics
    this.stats = {
      l1: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      l2: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      l3: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      total: { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };
    
    // Different TTLs for different data types
    this.ttls = {
      price: { l1: 1000, l2: 5000, l3: 300000 },      // 1s, 5s, 5min
      balance: { l1: 30000, l2: 60000, l3: 300000 },  // 30s, 1min, 5min
      analytics: { l1: 60000, l2: 300000, l3: 1800000 }, // 1min, 5min, 30min
      static: { l1: 300000, l2: 1800000, l3: 7200000 },  // 5min, 30min, 2h
      contract: { l1: 600000, l2: 3600000, l3: 86400000 } // 10min, 1h, 24h
    };
    
    // Cache invalidation patterns
    this.invalidationPatterns = new Map();
    this.setupInvalidationPatterns();
    
    this.initializeRedis();
    logger.info('🚀 Multi-Level Cache initialized');
  }

  // Initialize Redis connection
  async initializeRedis() {
    try {
      this.l2Cache = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis retry ${times}, delay: ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false
      });

      this.l2Cache.on('connect', () => {
        logger.info('✅ Redis L2 cache connected');
        this.redisConnected = true;
      });

      this.l2Cache.on('error', (error) => {
        logger.error('❌ Redis L2 cache error:', error);
        this.redisConnected = false;
      });

      this.l2Cache.on('close', () => {
        logger.warn('🔌 Redis L2 cache disconnected');
        this.redisConnected = false;
      });

      // Test connection
      await this.l2Cache.ping();
      
    } catch (error) {
      logger.warn('⚠️ Redis not available, using L1 and L3 only:', error.message);
      this.redisConnected = false;
    }
  }

  // Setup cache invalidation patterns
  setupInvalidationPatterns() {
    // Price data invalidation
    this.invalidationPatterns.set('price:*', {
      triggers: ['price:update', 'market:close'],
      ttl: 5000,
      cascade: ['analytics:*', 'signals:*']
    });
    
    // Balance data invalidation
    this.invalidationPatterns.set('balance:*', {
      triggers: ['trade:completed', 'deposit', 'withdrawal'],
      ttl: 60000,
      cascade: ['portfolio:*', 'risk:*']
    });
    
    // Analytics data invalidation
    this.invalidationPatterns.set('analytics:*', {
      triggers: ['price:update', 'trade:completed'],
      ttl: 300000,
      cascade: ['signals:*', 'recommendations:*']
    });
    
    // Contract data invalidation
    this.invalidationPatterns.set('contract:*', {
      triggers: ['contract:verified', 'contract:updated'],
      ttl: 3600000,
      cascade: []
    });
  }

  // Get data with multi-level fallback
  async get(key, fetcher, dataType = 'static') {
    const startTime = performance.now();
    
    try {
      // Try L1 cache first
      let value = this.l1Cache.get(key);
      if (value !== undefined) {
        this.stats.l1.hits++;
        this.stats.total.hits++;
        const latency = performance.now() - startTime;
        logger.debug(`L1 cache hit: ${key} (${latency.toFixed(2)}ms)`);
        return { value, source: 'L1', latency: Math.round(latency) };
      }
      this.stats.l1.misses++;

      // Try L2 cache (Redis)
      if (this.redisConnected) {
        const l2Start = performance.now();
        const cached = await this.l2Cache.get(key);
        const l2Latency = performance.now() - l2Start;
        
        if (cached !== null) {
          try {
            value = JSON.parse(cached);
            this.l1Cache.set(key, value, { ttl: this.ttls[dataType]?.l1 || 1000 });
            
            this.stats.l2.hits++;
            this.stats.total.hits++;
            const latency = performance.now() - startTime;
            logger.debug(`L2 cache hit: ${key} (${latency.toFixed(2)}ms)`);
            return { value, source: 'L2', latency: Math.round(latency) };
          } catch (parseError) {
            logger.error(`L2 cache parse error for ${key}:`, parseError);
          }
        }
        this.stats.l2.misses++;
      }

      // Try L3 cache (database/materialized views)
      value = this.l3Cache.get(key);
      if (value !== undefined) {
        this.l3Cache.delete(key); // Remove from L3 after read
        this.l1Cache.set(key, value, { ttl: this.ttls[dataType]?.l1 || 1000 });
        
        // Async write to L2
        if (this.redisConnected) {
          this.l2Cache.setex(key, Math.floor((this.ttls[dataType]?.l2 || 5000) / 1000), JSON.stringify(value)).catch(() => {});
        }
        
        this.stats.l3.hits++;
        this.stats.total.hits++;
        const latency = performance.now() - startTime;
        logger.debug(`L3 cache hit: ${key} (${latency.toFixed(2)}ms)`);
        return { value, source: 'L3', latency: Math.round(latency) };
      }
      this.stats.l3.misses++;

      // Cache miss - fetch fresh data
      const fetchStart = performance.now();
      value = await fetcher();
      const fetchLatency = performance.now() - fetchStart;
      
      // Warm all cache levels asynchronously
      this.warmCache(key, value, dataType);
      
      this.stats.total.misses++;
      const latency = performance.now() - startTime;
      logger.debug(`Cache miss: ${key} (${latency.toFixed(2)}ms, fetch: ${fetchLatency.toFixed(2)}ms)`);
      return { value, source: 'FETCH', latency: Math.round(latency), fetchLatency: Math.round(fetchLatency) };

    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
      this.stats.total.misses++;
      throw error;
    }
  }

  // Set data in all cache levels
  async set(key, data, dataType = 'static', customTtl = null) {
    try {
      const ttl = customTtl || this.ttls[dataType] || { l1: 1000, l2: 5000, l3: 300000 };
      
      // Set in L1
      this.l1Cache.set(key, data, { ttl: ttl.l1 });
      this.stats.l1.sets++;
      
      // Set in L2 (async)
      if (this.redisConnected) {
        this.l2Cache.setex(key, Math.floor(ttl.l2 / 1000), JSON.stringify(data)).catch(() => {});
        this.stats.l2.sets++;
      }
      
      // Set in L3 (async)
      this.l3Cache.set(key, data);
      setTimeout(() => {
        this.l3Cache.delete(key);
      }, ttl.l3);
      this.stats.l3.sets++;
      
      this.stats.total.sets++;
      logger.debug(`Cache set: ${key} in all levels`);
      
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
      throw error;
    }
  }

  // Warm cache levels asynchronously
  async warmCache(key, data, dataType = 'static') {
    const ttl = this.ttls[dataType] || { l1: 1000, l2: 5000, l3: 300000 };
    
    // Set in L1
    this.l1Cache.set(key, data, { ttl: ttl.l1 });
    this.stats.l1.sets++;
    
    // Set in L2 (fire and forget)
    if (this.redisConnected) {
      this.l2Cache.setex(key, Math.floor(ttl.l2 / 1000), JSON.stringify(data)).catch(() => {});
      this.stats.l2.sets++;
    }
    
    // Set in L3 (fire and forget)
    this.l3Cache.set(key, data);
    setTimeout(() => {
      this.l3Cache.delete(key);
    }, ttl.l3);
    this.stats.l3.sets++;
    
    this.stats.total.sets++;
  }

  // Invalidate cache entries by pattern
  async invalidate(pattern, cascade = true) {
    try {
      let invalidatedCount = 0;
      
      // Invalidate L1 cache
      const l1Keys = Array.from(this.l1Cache.keys()).filter(key => this.matchesPattern(key, pattern));
      for (const key of l1Keys) {
        this.l1Cache.delete(key);
        this.stats.l1.deletes++;
        invalidatedCount++;
      }
      
      // Invalidate L2 cache (Redis)
      if (this.redisConnected) {
        const l2Keys = await this.l2Cache.keys(pattern);
        if (l2Keys.length > 0) {
          await this.l2Cache.del(...l2Keys);
          this.stats.l2.deletes += l2Keys.length;
          invalidatedCount += l2Keys.length;
        }
      }
      
      // Invalidate L3 cache
      const l3Keys = Array.from(this.l3Cache.keys()).filter(key => this.matchesPattern(key, pattern));
      for (const key of l3Keys) {
        this.l3Cache.delete(key);
        this.stats.l3.deletes++;
        invalidatedCount++;
      }
      
      this.stats.total.deletes += invalidatedCount;
      
      // Cascade invalidation
      if (cascade) {
        const invalidationRule = this.getInvalidationRule(pattern);
        if (invalidationRule && invalidationRule.cascade.length > 0) {
          for (const cascadePattern of invalidationRule.cascade) {
            await this.invalidate(cascadePattern, false);
          }
        }
      }
      
      logger.info(`✅ Invalidated ${invalidatedCount} cache entries matching: ${pattern}`);
      
    } catch (error) {
      logger.error(`Error invalidating cache pattern ${pattern}:`, error);
      throw error;
    }
  }

  // Check if key matches pattern
  matchesPattern(key, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(key);
    }
    return key === pattern;
  }

  // Get invalidation rule for pattern
  getInvalidationRule(pattern) {
    for (const [rulePattern, rule] of this.invalidationPatterns) {
      if (this.matchesPattern(pattern, rulePattern)) {
        return rule;
      }
    }
    return null;
  }

  // Preload cache with frequently accessed data
  async preload(keys, fetcher, dataType = 'static') {
    const startTime = performance.now();
    let loadedCount = 0;
    
    try {
      const promises = keys.map(async (key) => {
        try {
          const result = await this.get(key, () => fetcher(key), dataType);
          if (result.source === 'FETCH') {
            loadedCount++;
          }
        } catch (error) {
          logger.error(`Error preloading ${key}:`, error);
        }
      });
      
      await Promise.allSettled(promises);
      
      const latency = performance.now() - startTime;
      logger.info(`✅ Preloaded ${loadedCount}/${keys.length} cache entries in ${latency.toFixed(2)}ms`);
      
    } catch (error) {
      logger.error('Error during cache preload:', error);
    }
  }

  // Batch get multiple keys
  async batchGet(keys, fetcher, dataType = 'static') {
    const startTime = performance.now();
    const results = {};
    
    try {
      const promises = keys.map(async (key) => {
        try {
          const result = await this.get(key, () => fetcher(key), dataType);
          results[key] = result;
        } catch (error) {
          logger.error(`Error batch getting ${key}:`, error);
          results[key] = { error: error.message };
        }
      });
      
      await Promise.allSettled(promises);
      
      const latency = performance.now() - startTime;
      logger.debug(`✅ Batch get ${keys.length} keys in ${latency.toFixed(2)}ms`);
      
      return results;
      
    } catch (error) {
      logger.error('Error during batch get:', error);
      throw error;
    }
  }

  // Batch set multiple keys
  async batchSet(entries, dataType = 'static') {
    const startTime = performance.now();
    
    try {
      const promises = Object.entries(entries).map(async ([key, data]) => {
        try {
          await this.set(key, data, dataType);
        } catch (error) {
          logger.error(`Error batch setting ${key}:`, error);
        }
      });
      
      await Promise.allSettled(promises);
      
      const latency = performance.now() - startTime;
      logger.debug(`✅ Batch set ${Object.keys(entries).length} entries in ${latency.toFixed(2)}ms`);
      
    } catch (error) {
      logger.error('Error during batch set:', error);
      throw error;
    }
  }

  // Get cache statistics
  getStats() {
    const l1HitRate = this.stats.l1.hits + this.stats.l1.misses > 0 ? 
      (this.stats.l1.hits / (this.stats.l1.hits + this.stats.l1.misses) * 100).toFixed(2) : 0;
    
    const l2HitRate = this.stats.l2.hits + this.stats.l2.misses > 0 ? 
      (this.stats.l2.hits / (this.stats.l2.hits + this.stats.l2.misses) * 100).toFixed(2) : 0;
    
    const l3HitRate = this.stats.l3.hits + this.stats.l3.misses > 0 ? 
      (this.stats.l3.hits / (this.stats.l3.hits + this.stats.l3.misses) * 100).toFixed(2) : 0;
    
    const totalHitRate = this.stats.total.hits + this.stats.total.misses > 0 ? 
      (this.stats.total.hits / (this.stats.total.hits + this.stats.total.misses) * 100).toFixed(2) : 0;

    return {
      l1: {
        ...this.stats.l1,
        hitRate: l1HitRate + '%',
        size: this.l1Cache.size,
        maxSize: this.l1Cache.max
      },
      l2: {
        ...this.stats.l2,
        hitRate: l2HitRate + '%',
        connected: this.redisConnected
      },
      l3: {
        ...this.stats.l3,
        hitRate: l3HitRate + '%',
        size: this.l3Cache.size
      },
      total: {
        ...this.stats.total,
        hitRate: totalHitRate + '%'
      },
      ttls: this.ttls,
      invalidationPatterns: Array.from(this.invalidationPatterns.keys())
    };
  }

  // Health check
  async healthCheck() {
    try {
      const l2Healthy = this.redisConnected ? await this.l2Cache.ping() === 'PONG' : false;
      
      return {
        status: 'healthy',
        l1: { status: 'healthy', size: this.l1Cache.size },
        l2: { status: l2Healthy ? 'healthy' : 'unhealthy', connected: this.redisConnected },
        l3: { status: 'healthy', size: this.l3Cache.size },
        stats: this.getStats()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        stats: this.getStats()
      };
    }
  }

  // Clear all cache levels
  async clearAll() {
    try {
      // Clear L1
      this.l1Cache.clear();
      
      // Clear L2
      if (this.redisConnected) {
        await this.l2Cache.flushall();
      }
      
      // Clear L3
      this.l3Cache.clear();
      
      // Reset stats
      this.stats = {
        l1: { hits: 0, misses: 0, sets: 0, deletes: 0 },
        l2: { hits: 0, misses: 0, sets: 0, deletes: 0 },
        l3: { hits: 0, misses: 0, sets: 0, deletes: 0 },
        total: { hits: 0, misses: 0, sets: 0, deletes: 0 }
      };
      
      logger.info('✅ All cache levels cleared');
      
    } catch (error) {
      logger.error('Error clearing cache:', error);
      throw error;
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('🔄 Shutting down multi-level cache...');
      
      if (this.l2Cache) {
        await this.l2Cache.quit();
        logger.info('✅ Redis L2 cache disconnected');
      }
      
      this.l1Cache.clear();
      this.l3Cache.clear();
      
      logger.info('✅ Multi-level cache shutdown completed');
      
    } catch (error) {
      logger.error('Error during cache shutdown:', error);
      throw error;
    }
  }
}

module.exports = MultiLevelCache;

