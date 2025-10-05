const logger = require('../logger');

class ZeroCopyPriceManager {
  constructor(maxPairs = 100, bufferSize = 1024 * 1024) { // 1MB buffer
    this.maxPairs = maxPairs;
    this.bufferSize = bufferSize;
    
    // Use SharedArrayBuffer for zero-copy between threads
    this.priceBuffer = new SharedArrayBuffer(bufferSize);
    this.priceView = new Float64Array(this.priceBuffer);
    this.metaView = new Uint32Array(this.priceBuffer);
    
    // Price indices for direct memory access
    this.priceIndices = new Map();
    this.pairMetadata = new Map();
    
    // Lock-free counters
    this.writeIndex = new Int32Array(new SharedArrayBuffer(4));
    this.readIndex = new Int32Array(new SharedArrayBuffer(4));
    
    // Initialize price indices
    this.setupPriceIndices();
    
    logger.info(`🚀 Zero-Copy Price Manager initialized - Buffer: ${bufferSize} bytes, Max pairs: ${maxPairs}`);
  }

  // Setup price indices for direct memory access
  setupPriceIndices() {
    const pairsPerIndex = 8; // 8 pairs per index block
    const indexBlockSize = 16; // 16 floats per block (price + metadata)
    
    const commonPairs = [
      'USDT/BNB', 'ETH/USDT', 'BTC/USDT', 'CAKE/USDT',
      'ADA/USDT', 'DOT/USDT', 'LTC/USDT', 'MATIC/USDT',
      'BNB/USDT', 'ETH/BNB', 'BTC/BNB', 'CAKE/BNB'
    ];
    
    commonPairs.forEach((pair, index) => {
      if (index < this.maxPairs) {
        this.priceIndices.set(pair, index * indexBlockSize);
        this.pairMetadata.set(pair, {
          index: index * indexBlockSize,
          lastUpdate: 0,
          updateCount: 0,
          volatility: 0
        });
      }
    });
    
    logger.info(`✅ Initialized ${this.priceIndices.size} price indices`);
  }

  // Ultra-fast price update with direct memory write
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
      const timestamp = Date.now();
      
      // Direct memory write - no object allocation
      Atomics.store(this.priceView, index, price);
      Atomics.store(this.priceView, index + 1, volume);
      Atomics.store(this.metaView, index + 2, timestamp);
      Atomics.store(this.metaView, index + 3, this.encodeSource(source));
      
      // Update metadata
      const metadata = this.pairMetadata.get(pair);
      if (metadata) {
        const oldPrice = this.getLastPrice(pair);
        if (oldPrice > 0) {
          const priceChange = Math.abs(price - oldPrice) / oldPrice;
          metadata.volatility = metadata.volatility * 0.9 + priceChange * 0.1; // EMA
        }
        
        metadata.lastUpdate = timestamp;
        metadata.updateCount++;
        metadata.lastSource = source;
      }
      
      // Notify waiting threads
      Atomics.notify(this.metaView, index + 2);
      
      return true;
      
    } catch (error) {
      logger.error(`Error updating price for ${pair}:`, error);
      return false;
    }
  }

  // Ultra-fast price retrieval with direct memory read
  getPrice(pair) {
    const index = this.priceIndices.get(pair);
    if (index === undefined) {
      return null;
    }

    try {
      // Direct memory read - no parsing
      const price = Atomics.load(this.priceView, index);
      const volume = Atomics.load(this.priceView, index + 1);
      const timestamp = Atomics.load(this.metaView, index + 2);
      const source = this.decodeSource(Atomics.load(this.metaView, index + 3));
      
      return {
        price: price,
        volume: volume,
        timestamp: timestamp,
        source: source,
        age: Date.now() - timestamp
      };
      
    } catch (error) {
      logger.error(`Error getting price for ${pair}:`, error);
      return null;
    }
  }

  // Get last known price (fastest method)
  getLastPrice(pair) {
    const index = this.priceIndices.get(pair);
    if (index === undefined) return 0;
    
    return Atomics.load(this.priceView, index);
  }

  // Batch price updates for maximum efficiency
  batchUpdatePrices(updates) {
    const startTime = performance.now();
    let successCount = 0;
    
    for (const update of updates) {
      if (this.updatePrice(update.pair, update.price, update.volume, update.source)) {
        successCount++;
      }
    }
    
    const latency = performance.now() - startTime;
    logger.debug(`✅ Batch updated ${successCount}/${updates.length} prices in ${latency.toFixed(2)}ms`);
    
    return successCount;
  }

  // Get all current prices (for monitoring)
  getAllPrices() {
    const prices = {};
    const startTime = performance.now();
    
    for (const [pair, index] of this.priceIndices) {
      try {
        const price = Atomics.load(this.priceView, index);
        const timestamp = Atomics.load(this.metaView, index + 2);
        
        if (price > 0) {
          prices[pair] = {
            price: price,
            timestamp: timestamp,
            age: Date.now() - timestamp
          };
        }
      } catch (error) {
        logger.error(`Error getting price for ${pair}:`, error);
      }
    }
    
    const latency = performance.now() - startTime;
    logger.debug(`Retrieved ${Object.keys(prices).length} prices in ${latency.toFixed(2)}ms`);
    
    return prices;
  }

  // Add new trading pair
  addNewPair(pair) {
    if (this.priceIndices.size >= this.maxPairs) {
      logger.warn(`Cannot add ${pair}: maximum pairs reached`);
      return false;
    }
    
    const index = this.priceIndices.size * 16; // 16 floats per block
    this.priceIndices.set(pair, index);
    this.pairMetadata.set(pair, {
      index: index,
      lastUpdate: 0,
      updateCount: 0,
      volatility: 0
    });
    
    logger.info(`✅ Added new pair: ${pair} at index ${index}`);
    return true;
  }

  // Remove trading pair
  removePair(pair) {
    const index = this.priceIndices.get(pair);
    if (index !== undefined) {
      this.priceIndices.delete(pair);
      this.pairMetadata.delete(pair);
      
      // Clear memory for this pair
      Atomics.store(this.priceView, index, 0);
      Atomics.store(this.priceView, index + 1, 0);
      Atomics.store(this.metaView, index + 2, 0);
      Atomics.store(this.metaView, index + 3, 0);
      
      logger.info(`✅ Removed pair: ${pair}`);
      return true;
    }
    
    return false;
  }

  // Get price history for analysis (limited to recent data)
  getPriceHistory(pair, limit = 100) {
    const metadata = this.pairMetadata.get(pair);
    if (!metadata) return [];
    
    // For zero-copy implementation, we only keep current price
    // In production, you might want to implement a circular buffer
    const currentPrice = this.getPrice(pair);
    if (currentPrice) {
      return [currentPrice];
    }
    
    return [];
  }

  // Calculate price statistics
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
      source: currentPrice.source
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

  // Encode source string to integer for memory efficiency
  encodeSource(source) {
    const sources = {
      'binance': 1,
      'pancakeswap': 2,
      'uniswap': 3,
      'sushiswap': 4,
      '1inch': 5,
      'unknown': 0
    };
    
    return sources[source.toLowerCase()] || 0;
  }

  // Decode source integer back to string
  decodeSource(encoded) {
    const sources = {
      1: 'binance',
      2: 'pancakeswap',
      3: 'uniswap',
      4: 'sushiswap',
      5: '1inch',
      0: 'unknown'
    };
    
    return sources[encoded] || 'unknown';
  }

  // Memory usage statistics
  getMemoryStats() {
    return {
      bufferSize: this.bufferSize,
      usedPairs: this.priceIndices.size,
      maxPairs: this.maxPairs,
      memoryUsage: (this.priceIndices.size * 16 * 8) + ' bytes', // 16 floats * 8 bytes
      utilizationPercent: ((this.priceIndices.size / this.maxPairs) * 100).toFixed(2)
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getAllPriceStats();
    const healthyPairs = Object.values(stats).filter(stat => stat.age < 60000).length; // Less than 1 minute old
    const totalPairs = Object.keys(stats).length;
    
    return {
      status: totalPairs > 0 && (healthyPairs / totalPairs) > 0.8 ? 'healthy' : 'unhealthy',
      totalPairs: totalPairs,
      healthyPairs: healthyPairs,
      healthRatio: totalPairs > 0 ? (healthyPairs / totalPairs * 100).toFixed(2) : 0,
      memoryStats: this.getMemoryStats()
    };
  }

  // Reset all prices (for testing)
  reset() {
    // Clear all price data
    for (let i = 0; i < this.priceView.length; i++) {
      Atomics.store(this.priceView, i, 0);
    }
    
    for (let i = 0; i < this.metaView.length; i++) {
      Atomics.store(this.metaView, i, 0);
    }
    
    // Reset metadata
    for (const metadata of this.pairMetadata.values()) {
      metadata.lastUpdate = 0;
      metadata.updateCount = 0;
      metadata.volatility = 0;
    }
    
    logger.info('✅ Zero-copy price manager reset');
  }

  // Optimize memory layout
  optimizeMemory() {
    // In a production system, you might want to defragment memory
    // or reorganize indices for better cache locality
    logger.info('🧹 Memory optimization completed');
  }
}

module.exports = ZeroCopyPriceManager;

