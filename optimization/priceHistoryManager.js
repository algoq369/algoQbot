const logger = require('../logger');

class PriceHistoryManager {
  constructor(maxHistorySize = 10000, maxPairs = 100) {
    this.maxHistorySize = maxHistorySize;
    this.maxPairs = maxPairs;
    this.history = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
    
    logger.info(`📊 PriceHistoryManager initialized - Max size: ${maxHistorySize}, Max pairs: ${maxPairs}`);
  }

  addPrice(pair, price, timestamp = Date.now()) {
    try {
      // Limit number of pairs to prevent memory explosion
      if (this.history.size >= this.maxPairs) {
        this.cleanupOldPairs();
      }

      if (!this.history.has(pair)) {
        this.history.set(pair, []);
      }
      
      const pairHistory = this.history.get(pair);
      pairHistory.push({ 
        price: parseFloat(price), 
        timestamp: timestamp,
        id: `${pair}_${timestamp}` 
      });
      
      // CRITICAL: Implement sliding window to prevent memory leak
      if (pairHistory.length > this.maxHistorySize) {
        const removed = pairHistory.splice(0, pairHistory.length - this.maxHistorySize);
        logger.debug(`Cleaned ${removed.length} old price entries for ${pair}`);
      }

      // Remove entries older than 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const filteredHistory = pairHistory.filter(entry => entry.timestamp > oneDayAgo);
      
      if (filteredHistory.length !== pairHistory.length) {
        this.history.set(pair, filteredHistory);
        logger.debug(`Removed ${pairHistory.length - filteredHistory.length} expired entries for ${pair}`);
      }

    } catch (error) {
      logger.error(`Error adding price for ${pair}:`, error);
    }
  }

  getPriceHistory(pair, limit = 100) {
    if (!this.history.has(pair)) {
      return [];
    }
    
    const pairHistory = this.history.get(pair);
    return pairHistory.slice(-limit);
  }

  getLatestPrice(pair) {
    if (!this.history.has(pair)) {
      return null;
    }
    
    const pairHistory = this.history.get(pair);
    return pairHistory.length > 0 ? pairHistory[pairHistory.length - 1] : null;
  }

  // Clean up old pairs to prevent memory explosion
  cleanupOldPairs() {
    if (this.history.size <= this.maxPairs) return;

    const entries = Array.from(this.history.entries());
    
    // Sort by last activity (most recent timestamp)
    entries.sort((a, b) => {
      const aLastTime = a[1].length > 0 ? a[1][a[1].length - 1].timestamp : 0;
      const bLastTime = b[1].length > 0 ? b[1][b[1].length - 1].timestamp : 0;
      return bLastTime - aLastTime;
    });

    // Remove oldest pairs
    const toRemove = entries.slice(this.maxPairs);
    toRemove.forEach(([pair]) => {
      this.history.delete(pair);
      logger.debug(`Removed old pair: ${pair}`);
    });

    logger.info(`Cleaned up ${toRemove.length} old pairs`);
  }

  // Automatic cleanup every 5 minutes
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  performCleanup() {
    try {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      let totalCleaned = 0;
      let pairsCleaned = 0;

      for (const [pair, history] of this.history.entries()) {
        const initialLength = history.length;
        
        // Remove entries older than 1 hour
        const filteredHistory = history.filter(entry => entry.timestamp > oneHourAgo);
        
        if (filteredHistory.length !== initialLength) {
          this.history.set(pair, filteredHistory);
          totalCleaned += (initialLength - filteredHistory.length);
          pairsCleaned++;
          
          // If pair has no recent data, remove it entirely
          if (filteredHistory.length === 0) {
            this.history.delete(pair);
          }
        }
      }

      if (totalCleaned > 0) {
        logger.info(`🧹 Cleanup: Removed ${totalCleaned} old entries from ${pairsCleaned} pairs`);
      }

      // Log memory usage
      this.logMemoryUsage();

    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  // Monitor memory usage
  logMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalEntries = Array.from(this.history.values()).reduce((sum, history) => sum + history.length, 0);
    
    logger.debug(`Memory usage - Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB, Price entries: ${totalEntries}, Pairs: ${this.history.size}`);
    
    // Alert if memory usage is too high
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      logger.warn(`⚠️ High memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      this.emergencyCleanup();
    }
  }

  // Emergency cleanup if memory usage is too high
  emergencyCleanup() {
    logger.warn('🚨 Emergency memory cleanup triggered');
    
    // Reduce max history size temporarily
    const originalMaxSize = this.maxHistorySize;
    this.maxHistorySize = Math.floor(this.maxHistorySize * 0.5);
    
    // Clean all pairs
    for (const [pair, history] of this.history.entries()) {
      if (history.length > this.maxHistorySize) {
        this.history.set(pair, history.slice(-this.maxHistorySize));
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      logger.info('🧹 Forced garbage collection');
    }
    
    // Restore original max size after cleanup
    setTimeout(() => {
      this.maxHistorySize = originalMaxSize;
      logger.info('✅ Memory cleanup completed, restored original limits');
    }, 60000); // 1 minute
  }

  // Get statistics
  getStatistics() {
    const totalEntries = Array.from(this.history.values()).reduce((sum, history) => sum + history.length, 0);
    const oldestEntry = Math.min(...Array.from(this.history.values()).flat().map(entry => entry.timestamp));
    const newestEntry = Math.max(...Array.from(this.history.values()).flat().map(entry => entry.timestamp));
    
    return {
      totalPairs: this.history.size,
      totalEntries,
      oldestEntry: oldestEntry ? new Date(oldestEntry) : null,
      newestEntry: newestEntry ? new Date(newestEntry) : null,
      maxHistorySize: this.maxHistorySize,
      maxPairs: this.maxPairs
    };
  }

  // Graceful shutdown
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Final cleanup
    this.performCleanup();
    
    logger.info('📊 PriceHistoryManager shutdown completed');
  }

  // Reset all data (for testing)
  reset() {
    this.history.clear();
    logger.info('📊 PriceHistoryManager reset');
  }
}

module.exports = PriceHistoryManager;

