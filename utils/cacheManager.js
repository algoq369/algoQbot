/**
 * Cache Manager - LRU Cache with TTL support
 * Provides efficient caching for expensive operations
 */
class CacheManager {
  constructor(maxSize = 100, defaultTTL = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.timers = new Map();
  }

  /**
   * Generate cache key from arguments
   */
  _generateKey(prefix, ...args) {
    const key = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join('_');
    return `${prefix}_${key}`;
  }

  /**
   * Get value from cache
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl = null) {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }

    // Set new value
    this.cache.set(key, { value, expiresAt });

    // Set expiration timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl || this.defaultTTL);
    this.timers.set(key, timer);
  }

  /**
   * Delete from cache
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      hits: this.hits || 0,
      misses: this.misses || 0
    };
  }

  /**
   * Memoize function with caching
   */
  memoize(fn, keyPrefix, ttl = null) {
    return async (...args) => {
      const key = this._generateKey(keyPrefix, ...args);
      const cached = this.get(key);
      if (cached !== null) {
        this.hits = (this.hits || 0) + 1;
        return cached;
      }
      this.misses = (this.misses || 0) + 1;
      const result = await fn(...args);
      this.set(key, result, ttl);
      return result;
    };
  }
}

module.exports = CacheManager;

