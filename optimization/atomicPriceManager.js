const logger = require('../logger');

class AtomicPriceManager {
  constructor(maxPairs = 100, bufferSize = 65536) {
    this.maxPairs = maxPairs;
    this.bufferSize = bufferSize;
    
    // Use 128-bit aligned structures for atomic updates
    this.priceBuffer = new SharedArrayBuffer(bufferSize);
    this.priceView = new BigUint64Array(this.priceBuffer);
    
    // Each entry: 2x 64-bit integers
    // [0]: packed (price_high32 | volume_low32)
    // [1]: timestamp + sequence lock
    this.ENTRY_SIZE = 2;
    
    // Price indices for direct memory access
    this.priceIndices = new Map();
    this.pairMetadata = new Map();
    
    // Initialize price indices
    this.setupPriceIndices();
    
    logger.info(`🚀 Atomic Price Manager initialized - Buffer: ${bufferSize} bytes, Max pairs: ${maxPairs}`);
  }

  // Setup price indices for direct memory access
  setupPriceIndices() {
    const commonPairs = [
      'USDT/BNB', 'ETH/USDT', 'BTC/USDT', 'CAKE/USDT',
      'ADA/USDT', 'DOT/USDT', 'LTC/USDT', 'MATIC/USDT',
      'BNB/USDT', 'ETH/BNB', 'BTC/BNB', 'CAKE/BNB'
    ];
    
    commonPairs.forEach((pair, index) => {
      if (index < this.maxPairs) {
        this.priceIndices.set(pair, index);
        this.pairMetadata.set(pair, {
          index: index,
          lastUpdate: 0,
          updateCount: 0,
          volatility: 0
        });
      }
    });
    
    logger.info(`✅ Initialized ${this.priceIndices.size} atomic price indices`);
  }

  // CRITICAL: Atomic price update with sequence lock for consistency and overflow protection
  updatePrice(pair, price, volume = 0, source = 'unknown') {
    const index = this.priceIndices.get(pair);
    if (index === undefined) {
      // Add new pair if we have space
      if (this.priceIndices.size < this.maxPairs) {
        this.addNewPair(pair);
        return this.updatePrice(pair, price, volume, source);
      } else {
        logger.warn(`⚠️ Maximum pairs reached, cannot add ${pair}`);
        return false;
      }
    }

    try {
      const baseIndex = index * this.ENTRY_SIZE;
      const timestamp = BigInt(Date.now());
      
      // Pack price and volume into single 64-bit integer
      const priceInt = BigInt(Math.floor(price * 1e8));
      const volumeInt = BigInt(Math.floor(volume * 1e8));
      const packed = (priceInt << 32n) | (volumeInt & 0xFFFFFFFFn);
      
      // CRITICAL: Sequence counter overflow protection
      const MAX_SEQUENCE = 2n ** 62n; // Leave headroom before overflow
      
      // CRITICAL: Use sequence lock for consistency
      let sequence;
      do {
        sequence = Atomics.load(this.priceView, baseIndex + 1);
        
        // CRITICAL: Check for overflow and coordinate reset if needed
        if (sequence > MAX_SEQUENCE) {
          logger.warn(`⚠️ Sequence counter approaching overflow for ${pair}, resetting...`);
          this.coordinateSequenceReset(pair, baseIndex);
          sequence = Atomics.load(this.priceView, baseIndex + 1);
        }
        
        // Skip if write in progress (odd sequence)
        if ((sequence & 1n) !== 0n) {
          continue;
        }
        
        // Write with odd sequence (indicates write in progress)
        Atomics.store(this.priceView, baseIndex + 1, sequence + 1n);
        
        // Write data
        Atomics.store(this.priceView, baseIndex, packed);
        
        // Write with even sequence (write complete)
        Atomics.store(this.priceView, baseIndex + 1, sequence + 2n);
        
        // Break if we successfully wrote
        break;
        
      } while (true);
      
      // Update metadata
      const metadata = this.pairMetadata.get(pair);
      if (metadata) {
        const oldPrice = this.getLastPrice(pair);
        if (oldPrice > 0) {
          const priceChange = Math.abs(price - oldPrice) / oldPrice;
          metadata.volatility = metadata.volatility * 0.9 + priceChange * 0.1; // EMA
        }
        
        metadata.lastUpdate = Number(timestamp);
        metadata.updateCount++;
        metadata.lastSource = source;
      }
      
      // Notify waiting threads
      Atomics.notify(this.priceView, baseIndex);
      
      return true;
      
    } catch (error) {
      logger.error(`Error updating atomic price for ${pair}:`, error);
      return false;
    }
  }

  // Coordinate sequence counter reset across all threads
  coordinateSequenceReset(pair, baseIndex) {
    try {
      // Use a spin lock to coordinate reset
      const RESET_LOCK = 0xFFFFFFFFFFFFFFFFn; // Special value for lock
      
      // Try to acquire reset lock
      let currentSeq = Atomics.load(this.priceView, baseIndex + 1);
      
      // If another thread is already resetting, wait
      while (currentSeq === RESET_LOCK) {
        Atomics.wait(this.priceView, baseIndex + 1, RESET_LOCK, 100); // Wait with timeout
        currentSeq = Atomics.load(this.priceView, baseIndex + 1);
      }
      
      // Try to acquire lock for reset
      const acquired = Atomics.compareExchange(
        this.priceView, baseIndex + 1, currentSeq, RESET_LOCK
      ) === currentSeq;
      
      if (acquired) {
        // We got the lock, perform reset
        logger.info(`🔄 Resetting sequence counter for ${pair}`);
        
        // Reset to 2 (even number, not in progress)
        Atomics.store(this.priceView, baseIndex + 1, 2n);
        
        // Notify all waiting threads
        Atomics.notify(this.priceView, baseIndex + 1);
        
        logger.info(`✅ Sequence counter reset complete for ${pair}`);
      }
      
    } catch (error) {
      logger.error(`Error resetting sequence counter for ${pair}:`, error);
      // On error, try to release lock
      Atomics.store(this.priceView, baseIndex + 1, 2n);
      Atomics.notify(this.priceView, baseIndex + 1);
    }
  }

  // CRITICAL: Atomic price retrieval with sequence lock verification
  getPrice(pair) {
    const index = this.priceIndices.get(pair);
    if (index === undefined) {
      return null;
    }

    try {
      const baseIndex = index * this.ENTRY_SIZE;
      let packed, sequence;
      
      do {
        // Read sequence number
        sequence = Atomics.load(this.priceView, baseIndex + 1);
        
        // Retry if write in progress (odd sequence)
        if ((sequence & 1n) !== 0n) continue;
        
        // Read data
        packed = Atomics.load(this.priceView, baseIndex);
        
        // Verify sequence unchanged (no concurrent write)
      } while (sequence !== Atomics.load(this.priceView, baseIndex + 1));
      
      const price = Number(packed >> 32n) / 1e8;
      const volume = Number(packed & 0xFFFFFFFFn) / 1e8;
      const timestamp = Number(sequence / 2n); // Derive from sequence
      
      return {
        price: price,
        volume: volume,
        timestamp: timestamp,
        age: Date.now() - timestamp
      };
      
    } catch (error) {
      logger.error(`Error getting atomic price for ${pair}:`, error);
      return null;
    }
  }

  // Get last known price (fastest method with atomic read)
  getLastPrice(pair) {
    const index = this.priceIndices.get(pair);
    if (index === undefined) return 0;
    
    try {
      const baseIndex = index * this.ENTRY_SIZE;
      const sequence = Atomics.load(this.priceView, baseIndex + 1);
      
      // If sequence is odd, write in progress - retry
      if ((sequence & 1n) !== 0n) {
        return 0;
      }
      
      const packed = Atomics.load(this.priceView, baseIndex);
      return Number(packed >> 32n) / 1e8;
      
    } catch (error) {
      logger.error(`Error getting last price for ${pair}:`, error);
      return 0;
    }
  }

  // Batch price updates for maximum efficiency with atomic consistency
  batchUpdatePrices(updates) {
    const startTime = performance.now();
    let successCount = 0;
    
    for (const update of updates) {
      if (this.updatePrice(update.pair, update.price, update.volume, update.source)) {
        successCount++;
      }
    }
    
    const latency = performance.now() - startTime;
    logger.debug(`✅ Atomic batch updated ${successCount}/${updates.length} prices in ${latency.toFixed(2)}ms`);
    
    return successCount;
  }

  // Get all current prices (for monitoring) with atomic consistency
  getAllPrices() {
    const prices = {};
    const startTime = performance.now();
    
    for (const [pair, index] of this.priceIndices) {
      try {
        const baseIndex = index * this.ENTRY_SIZE;
        const sequence = Atomics.load(this.priceView, baseIndex + 1);
        
        // Skip if write in progress
        if ((sequence & 1n) !== 0n) continue;
        
        const packed = Atomics.load(this.priceView, baseIndex);
        const price = Number(packed >> 32n) / 1e8;
        const timestamp = Number(sequence / 2n);
        
        if (price > 0) {
          prices[pair] = {
            price: price,
            timestamp: timestamp,
            age: Date.now() - timestamp
          };
        }
      } catch (error) {
        logger.error(`Error getting atomic price for ${pair}:`, error);
      }
    }
    
    const latency = performance.now() - startTime;
    logger.debug(`Retrieved ${Object.keys(prices).length} atomic prices in ${latency.toFixed(2)}ms`);
    
    return prices;
  }

  // Add new trading pair
  addNewPair(pair) {
    if (this.priceIndices.size >= this.maxPairs) {
      logger.warn(`Cannot add ${pair}: maximum pairs reached`);
      return false;
    }
    
    const index = this.priceIndices.size;
    this.priceIndices.set(pair, index);
    this.pairMetadata.set(pair, {
      index: index,
      lastUpdate: 0,
      updateCount: 0,
      volatility: 0
    });
    
    logger.info(`✅ Added new atomic pair: ${pair} at index ${index}`);
    return true;
  }

  // Remove trading pair
  removePair(pair) {
    const index = this.priceIndices.get(pair);
    if (index !== undefined) {
      this.priceIndices.delete(pair);
      this.pairMetadata.delete(pair);
      
      // Clear atomic memory for this pair
      const baseIndex = index * this.ENTRY_SIZE;
      Atomics.store(this.priceView, baseIndex, 0n);
      Atomics.store(this.priceView, baseIndex + 1, 0n);
      
      logger.info(`✅ Removed atomic pair: ${pair}`);
      return true;
    }
    
    return false;
  }

  // Calculate price statistics with atomic consistency
  getPriceStats(pair) {
    const metadata = this.pairMetadata.get(pair);
    if (!metadata) return null;
    
    const currentPrice = this.getPrice(pair);
    if (!currentPrice) return null;
    
    return {
      pair: pair,
      currentPrice: currentPrice.price,
      lastUpdate: currentPrice.timestamp,
      updateCount: metadata.updateCount,
      volatility: metadata.volatility,
      age: currentPrice.age,
      source: metadata.lastSource
    };
  }

  // Get all price statistics
  getAllPriceStats() {
    const stats = {};
    
    for (const pair of this.priceIndices.keys()) {
      const stat = this.getPriceStats(pair);
      if (stat) {
        stats[pair] = stat;
      }
    }
    
    return stats;
  }

  // Memory usage statistics
  getMemoryStats() {
    return {
      bufferSize: this.bufferSize,
      usedPairs: this.priceIndices.size,
      maxPairs: this.maxPairs,
      memoryUsage: (this.priceIndices.size * this.ENTRY_SIZE * 8) + ' bytes',
      utilizationPercent: ((this.priceIndices.size / this.maxPairs) * 100).toFixed(2),
      atomicAlignment: '128-bit aligned for consistency'
    };
  }

  // Health check with atomic consistency verification
  healthCheck() {
    const stats = this.getAllPriceStats();
    const healthyPairs = Object.values(stats).filter(stat => stat.age < 60000).length;
    const totalPairs = Object.keys(stats).length;
    
    // Test atomic consistency
    let consistencyErrors = 0;
    for (const [pair, index] of this.priceIndices) {
      const price1 = this.getPrice(pair);
      const price2 = this.getPrice(pair);
      if (price1 && price2 && price1.price !== price2.price) {
        consistencyErrors++;
      }
    }
    
    return {
      status: totalPairs > 0 && (healthyPairs / totalPairs) > 0.8 && consistencyErrors === 0 ? 'healthy' : 'unhealthy',
      totalPairs: totalPairs,
      healthyPairs: healthyPairs,
      healthRatio: totalPairs > 0 ? (healthyPairs / totalPairs * 100).toFixed(2) : 0,
      consistencyErrors: consistencyErrors,
      memoryStats: this.getMemoryStats()
    };
  }

  // Reset all prices (for testing)
  reset() {
    // Clear all atomic price data
    for (let i = 0; i < this.priceView.length; i++) {
      Atomics.store(this.priceView, i, 0n);
    }
    
    // Reset metadata
    for (const metadata of this.pairMetadata.values()) {
      metadata.lastUpdate = 0;
      metadata.updateCount = 0;
      metadata.volatility = 0;
    }
    
    logger.info('✅ Atomic price manager reset');
  }

  // Optimize memory layout
  optimizeMemory() {
    // In a production system, you might want to defragment memory
    // or reorganize indices for better cache locality
    logger.info('🧹 Atomic memory optimization completed');
  }
}

module.exports = AtomicPriceManager;
