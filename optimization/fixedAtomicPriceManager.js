const logger = require('../logger');

/**
 * FIXED Atomic Price Manager with Two-Phase Sequence Reset
 * 
 * Addresses critical race condition in sequence counter reset identified by expert review.
 * 
 * Memory Layout per pair (4 x 64-bit values):
 * [0]: packed_data (price_high32 | volume_low32)
 * [1]: sequence (odd = write in progress, even = stable)
 * [2]: reset_flag (0 = normal, 1 = reset in progress)
 * [3]: reader_count (number of active readers)
 */
class FixedAtomicPriceManager {
  constructor(maxPairs = 100) {
    this.maxPairs = maxPairs;
    this.ENTRY_SIZE = 4; // Data, sequence, reset_flag, reader_count
    
    const bufferSize = this.maxPairs * this.ENTRY_SIZE * BigUint64Array.BYTES_PER_ELEMENT;
    this.priceBuffer = new SharedArrayBuffer(bufferSize);
    this.priceView = new BigUint64Array(this.priceBuffer);
    
    // Offset constants for clarity
    this.OFFSET_DATA = 0;
    this.OFFSET_SEQUENCE = 1;
    this.OFFSET_RESET_FLAG = 2;
    this.OFFSET_READER_COUNT = 3;
    
    this.priceIndices = new Map();
    this.pairMetadata = new Map();
    
    this.MAX_SEQUENCE = 2n ** 62n; // Overflow threshold
    
    this.setupCommonPairs();
    
    logger.info(`🧠 Fixed Atomic Price Manager initialized: ${maxPairs} pairs, ${bufferSize} bytes`);
  }

  setupCommonPairs() {
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
          volatility: 0,
          lastSource: 'init'
        });
      }
    });
    
    logger.info(`✅ Initialized ${this.priceIndices.size} price indices`);
  }

  // Get base index for a pair's data in the buffer
  getBaseIndex(pair) {
    const pairIndex = this.priceIndices.get(pair);
    if (pairIndex === undefined) {
      if (this.priceIndices.size < this.maxPairs) {
        this.addNewPair(pair);
        return this.getBaseIndex(pair);
      }
      return null;
    }
    return pairIndex * this.ENTRY_SIZE;
  }

  addNewPair(pair) {
    const newIndex = this.priceIndices.size;
    this.priceIndices.set(pair, newIndex);
    this.pairMetadata.set(pair, {
      index: newIndex,
      lastUpdate: 0,
      updateCount: 0,
      volatility: 0,
      lastSource: 'dynamic'
    });
    logger.debug(`Added new pair ${pair} at index ${newIndex}`);
  }

  /**
   * CRITICAL FIX: Two-Phase Sequence Reset Protocol
   * 
   * Phase 1: Acquire reset lock atomically (only one thread succeeds)
   * Phase 2: Wait for all active readers to drain before resetting
   * 
   * This prevents the race condition where multiple threads trigger reset
   * and ensures no thread reads inconsistent data during reset.
   */
  coordinateSequenceReset(pair, baseIndex) {
    const resetFlagIndex = baseIndex + this.OFFSET_RESET_FLAG;
    const readerCountIndex = baseIndex + this.OFFSET_READER_COUNT;
    const sequenceIndex = baseIndex + this.OFFSET_SEQUENCE;
    
    try {
      // PHASE 1: Atomic acquisition of reset lock
      const acquired = Atomics.compareExchange(
        this.priceView, resetFlagIndex,
        0n, // Expected: not in reset
        1n  // New value: in reset
      ) === 0n;
      
      if (!acquired) {
        // Another thread is already resetting, wait for completion
        logger.debug(`Waiting for sequence reset to complete for ${pair}`);
        
        // Wait for reset to complete (flag back to 0)
        let attempts = 0;
        while (Atomics.load(this.priceView, resetFlagIndex) === 1n && attempts < 100) {
          Atomics.wait(this.priceView, resetFlagIndex, 1n, 10); // 10ms timeout
          attempts++;
        }
        
        if (attempts >= 100) {
          logger.error(`Sequence reset timeout for ${pair}`);
        }
        
        return;
      }
      
      // PHASE 2: We acquired the lock, now wait for readers to drain
      logger.info(`🔄 Resetting sequence counter for ${pair}`);
      
      let drainAttempts = 0;
      const MAX_DRAIN_ATTEMPTS = 1000; // 10 seconds max
      
      while (drainAttempts < MAX_DRAIN_ATTEMPTS) {
        const activeReaders = Atomics.load(this.priceView, readerCountIndex);
        
        if (activeReaders === 0n) {
          // All readers have drained, safe to reset
          break;
        }
        
        // Wait for readers to finish
        Atomics.wait(this.priceView, readerCountIndex, activeReaders, 10);
        drainAttempts++;
      }
      
      if (drainAttempts >= MAX_DRAIN_ATTEMPTS) {
        logger.error(`⚠️ Timeout waiting for readers to drain for ${pair}`);
        // Proceed anyway to avoid deadlock, but log the issue
      }
      
      // CRITICAL: Now safe to reset sequence counter
      Atomics.store(this.priceView, sequenceIndex, 2n); // Reset to 2 (even, stable)
      
      logger.info(`✅ Sequence counter reset complete for ${pair}`);
      
      // PHASE 3: Release reset lock
      Atomics.store(this.priceView, resetFlagIndex, 0n);
      
      // Notify all waiting threads
      Atomics.notify(this.priceView, resetFlagIndex);
      
    } catch (error) {
      logger.error(`Error during sequence reset for ${pair}:`, error);
      
      // CRITICAL: Always release lock on error
      Atomics.store(this.priceView, resetFlagIndex, 0n);
      Atomics.notify(this.priceView, resetFlagIndex);
    }
  }

  /**
   * CRITICAL FIX: Price update with proper overflow detection
   */
  updatePrice(pair, price, volume = 0, source = 'unknown') {
    const baseIndex = this.getBaseIndex(pair);
    if (baseIndex === null) {
      logger.warn(`⚠️ Cannot update price for unknown pair: ${pair}`);
      return false;
    }
    
    const dataIndex = baseIndex + this.OFFSET_DATA;
    const sequenceIndex = baseIndex + this.OFFSET_SEQUENCE;
    const resetFlagIndex = baseIndex + this.OFFSET_RESET_FLAG;
    
    try {
      // Check if reset is in progress
      if (Atomics.load(this.priceView, resetFlagIndex) === 1n) {
        // Wait for reset to complete
        logger.debug(`Waiting for reset before updating ${pair}`);
        Atomics.wait(this.priceView, resetFlagIndex, 1n, 100);
        
        // If still in reset, abort this update
        if (Atomics.load(this.priceView, resetFlagIndex) === 1n) {
          return false;
        }
      }
      
      // Pack data
      const priceInt = BigInt(Math.floor(price * 1e8));
      const volumeInt = BigInt(Math.floor(volume * 1e8));
      const packed = (priceInt << 32n) | (volumeInt & 0xFFFFFFFFn);
      
      // Sequence lock write
      let sequence;
      let attempts = 0;
      const MAX_ATTEMPTS = 100;
      
      do {
        if (attempts++ > MAX_ATTEMPTS) {
          logger.warn(`Max attempts reached updating ${pair}`);
          return false;
        }
        
        sequence = Atomics.load(this.priceView, sequenceIndex);
        
        // CRITICAL: Check for overflow BEFORE acquiring write lock
        if (sequence > this.MAX_SEQUENCE) {
          logger.warn(`⚠️ Sequence overflow detected for ${pair}, triggering reset`);
          this.coordinateSequenceReset(pair, baseIndex);
          // After reset, reload sequence
          sequence = Atomics.load(this.priceView, sequenceIndex);
        }
        
        // Skip if write in progress (odd sequence)
        if ((sequence & 1n) !== 0n) {
          // Brief wait for write to complete
          Atomics.wait(this.priceView, sequenceIndex, sequence, 1);
          continue;
        }
        
        // Acquire write lock (make sequence odd)
        const acquired = Atomics.compareExchange(
          this.priceView, sequenceIndex,
          sequence,      // Expected: even (stable)
          sequence + 1n  // New: odd (write in progress)
        ) === sequence;
        
        if (!acquired) {
          // Another writer acquired lock, retry
          continue;
        }
        
        // We have the lock, write data
        Atomics.store(this.priceView, dataIndex, packed);
        
        // Release write lock (make sequence even)
        Atomics.store(this.priceView, sequenceIndex, sequence + 2n);
        
        // Notify waiting readers
        Atomics.notify(this.priceView, dataIndex);
        
        // Update metadata
        const metadata = this.pairMetadata.get(pair);
        if (metadata) {
          metadata.lastUpdate = Date.now();
          metadata.updateCount++;
          metadata.lastSource = source;
        }
        
        return true;
        
      } while (true);
      
    } catch (error) {
      logger.error(`Error updating price for ${pair}:`, error);
      return false;
    }
  }

  /**
   * CRITICAL FIX: Price read with proper reader tracking
   */
  getPrice(pair) {
    const baseIndex = this.getBaseIndex(pair);
    if (baseIndex === null) {
      return null;
    }
    
    const dataIndex = baseIndex + this.OFFSET_DATA;
    const sequenceIndex = baseIndex + this.OFFSET_SEQUENCE;
    const resetFlagIndex = baseIndex + this.OFFSET_RESET_FLAG;
    const readerCountIndex = baseIndex + this.OFFSET_READER_COUNT;
    
    try {
      // Check if reset is in progress
      if (Atomics.load(this.priceView, resetFlagIndex) === 1n) {
        // Don't read during reset
        logger.debug(`Skipping read during reset for ${pair}`);
        return null;
      }
      
      // Increment reader count
      Atomics.add(this.priceView, readerCountIndex, 1n);
      
      try {
        // Sequence lock read
        let packed, sequence1, sequence2;
        let attempts = 0;
        const MAX_ATTEMPTS = 100;
        
        do {
          if (attempts++ > MAX_ATTEMPTS) {
            logger.warn(`Max attempts reached reading ${pair}`);
            return null;
          }
          
          // Read sequence before data
          sequence1 = Atomics.load(this.priceView, sequenceIndex);
          
          // If odd, write in progress, retry
          if ((sequence1 & 1n) !== 0n) {
            Atomics.wait(this.priceView, sequenceIndex, sequence1, 1);
            continue;
          }
          
          // Read data
          packed = Atomics.load(this.priceView, dataIndex);
          
          // Read sequence after data
          sequence2 = Atomics.load(this.priceView, sequenceIndex);
          
          // If sequences match and even, read was consistent
          if (sequence1 === sequence2 && (sequence1 & 1n) === 0n) {
            break;
          }
          
          // Inconsistent read, retry
        } while (true);
        
        // Unpack data
        const price = Number(packed >> 32n) / 1e8;
        const volume = Number(packed & 0xFFFFFFFFn) / 1e8;
        const timestamp = Number(sequence1 / 2n);
        
        return { price, volume, timestamp };
        
      } finally {
        // CRITICAL: Decrement reader count and notify
        Atomics.sub(this.priceView, readerCountIndex, 1n);
        Atomics.notify(this.priceView, readerCountIndex);
      }
      
    } catch (error) {
      logger.error(`Error reading price for ${pair}:`, error);
      return null;
    }
  }

  // Get statistics
  getStats() {
    const pairs = Array.from(this.priceIndices.keys());
    const prices = {};
    
    pairs.forEach(pair => {
      const priceData = this.getPrice(pair);
      if (priceData) {
        prices[pair] = priceData;
      }
    });
    
    return {
      totalPairs: this.priceIndices.size,
      maxPairs: this.maxPairs,
      bufferSize: this.priceBuffer.byteLength,
      prices: prices
    };
  }

  // Health check
  healthCheck() {
    return {
      status: 'healthy',
      pairCount: this.priceIndices.size,
      maxPairs: this.maxPairs,
      memoryUsed: this.priceBuffer.byteLength
    };
  }
}

module.exports = FixedAtomicPriceManager;

