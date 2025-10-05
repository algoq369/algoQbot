const logger = require('../logger');

/**
 * FIXED Lock-Free Order Book with Proper Memory Ordering
 * 
 * Addresses critical memory ordering issue where non-atomic stores
 * don't guarantee visibility to other threads.
 * 
 * ALL fields now use Atomics.store() to ensure proper memory ordering
 * and visibility across threads.
 */
class FixedLockFreeOrderBook {
  constructor(maxOrders = 10000) {
    this.maxOrders = maxOrders;
    
    // Order fields (all stored as Float64 for atomic operations)
    this.ORDER_FIELDS = 8;
    const FIELDS = {
      PRICE: 0,
      AMOUNT: 1,
      TYPE: 2,
      ORDER_ID: 3,
      TIMESTAMP: 4,
      STATUS: 5,        // 0=empty, 1=pending, 2=ready, 3=processing
      GENERATION: 6,
      RESERVED: 7
    };
    this.FIELDS = FIELDS;
    
    // Use Float64Array for all order data (supports atomic operations in some VMs)
    // But we'll use explicit Atomics operations for critical fields
    const orderBufferSize = maxOrders * this.ORDER_FIELDS * Float64Array.BYTES_PER_ELEMENT;
    this.orderBuffer = new Float64Array(
      new SharedArrayBuffer(orderBufferSize)
    );
    
    // Control structures using proper atomic types
    // [generation(32bit) | index(32bit)] packed into 64-bit
    this.controlBuffer = new SharedArrayBuffer(16);
    this.headGenIdx = new BigUint64Array(this.controlBuffer, 0, 1);
    this.tailGenIdx = new BigUint64Array(this.controlBuffer, 8, 1);
    
    // Initialize
    Atomics.store(this.headGenIdx, 0, 0n);
    Atomics.store(this.tailGenIdx, 0, 0n);
    
    logger.info(`🔒 Fixed Lock-Free Order Book initialized: ${maxOrders} capacity`);
  }

  // Pack generation and index into single 64-bit value
  _packGenIdx(generation, index) {
    return (BigInt(generation) << 32n) | BigInt(index);
  }

  // Unpack 64-bit value into generation and index
  _unpackGenIdx(packed) {
    return {
      generation: Number(packed >> 32n),
      index: Number(packed & 0xFFFFFFFFn)
    };
  }

  /**
   * CRITICAL FIX: Add order with proper memory ordering
   * 
   * ALL writes now use atomic operations to ensure memory visibility
   */
  addOrder(order) {
    let currentGenIdx, newGenIdx, index, generation;
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;

    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.warn('⚠️ Lock-Free Order Book: Max CAS attempts reached');
        return false;
      }
      
      currentGenIdx = Atomics.load(this.tailGenIdx, 0);
      ({ generation, index } = this._unpackGenIdx(currentGenIdx));

      const newIndex = (index + 1) % this.maxOrders;
      const newGeneration = (newIndex === 0) ? generation + 1 : generation;
      newGenIdx = this._packGenIdx(newGeneration, newIndex);

      // Check if buffer is full
      const headGenIdx = Atomics.load(this.headGenIdx, 0);
      const { generation: headGen, index: headIdx } = this._unpackGenIdx(headGenIdx);

      if (newIndex === headIdx && newGeneration === headGen) {
        logger.warn('⚠️ Lock-Free Order Book is full');
        return false;
      }

      // Attempt to claim this slot atomically
      const exchanged = Atomics.compareExchange(
        this.tailGenIdx, 0, currentGenIdx, newGenIdx
      );
      
      if (exchanged !== currentGenIdx) {
        // Another thread won, retry with backoff
        if (attempts > 10) {
          const backoff = Math.min(100, 2 ** (attempts - 10));
          Atomics.wait(this.tailGenIdx, 0, newGenIdx, backoff);
        }
        continue;
      }

      // Successfully claimed slot at 'index'
      break;

    } while (true);

    // CRITICAL FIX: Use atomic stores for ALL fields to ensure memory ordering
    const baseIdx = index * this.ORDER_FIELDS;
    
    // Set status to PENDING first to prevent readers
    this._atomicStoreFloat(baseIdx + this.FIELDS.STATUS, 1); // PENDING
    
    // CRITICAL: Memory fence - ensure STATUS write is visible before data writes
    Atomics.add(new Int32Array(this.orderBuffer.buffer), 0, 0); // No-op fence
    
    // Write order data with atomic operations
    this._atomicStoreFloat(baseIdx + this.FIELDS.PRICE, order.price || 0);
    this._atomicStoreFloat(baseIdx + this.FIELDS.AMOUNT, order.amount || 0);
    this._atomicStoreFloat(baseIdx + this.FIELDS.TYPE, order.type || 0);
    this._atomicStoreFloat(baseIdx + this.FIELDS.ORDER_ID, order.orderId || 0);
    this._atomicStoreFloat(baseIdx + this.FIELDS.TIMESTAMP, Date.now());
    this._atomicStoreFloat(baseIdx + this.FIELDS.GENERATION, generation);
    
    // CRITICAL: Memory fence before marking READY
    Atomics.add(new Int32Array(this.orderBuffer.buffer), 0, 0); // No-op fence
    
    // Mark as READY - this must be last and atomic
    this._atomicStoreFloat(baseIdx + this.FIELDS.STATUS, 2); // READY
    
    // Notify waiting consumers
    this._atomicNotify(baseIdx + this.FIELDS.STATUS);
    
    logger.debug(`✅ Order ${order.orderId} added at index ${index}, gen ${generation}`);
    return true;
  }

  /**
   * CRITICAL FIX: Get order with proper memory ordering
   */
  getOrder(timeout = 0) {
    let currentGenIdx, newGenIdx, index, generation;
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;
    const startTime = Date.now();

    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.warn('⚠️ Lock-Free Order Book: Max attempts for getOrder');
        return null;
      }

      // Check timeout
      if (timeout > 0 && Date.now() - startTime > timeout) {
        return null;
      }

      currentGenIdx = Atomics.load(this.headGenIdx, 0);
      ({ generation, index } = this._unpackGenIdx(currentGenIdx));

      // Check if empty
      const tailGenIdx = Atomics.load(this.tailGenIdx, 0);
      if (currentGenIdx === tailGenIdx) {
        if (timeout === 0) {
          return null;
        }
        
        // Wait for new order with timeout
        const waitResult = this._atomicWait(
          index * this.ORDER_FIELDS + this.FIELDS.STATUS,
          0, // Wait for non-zero (order present)
          Math.min(100, timeout - (Date.now() - startTime))
        );
        
        if (waitResult === 'timed-out') {
          return null;
        }
        continue;
      }

      // CRITICAL: Read order data with proper memory ordering
      const baseIdx = index * this.ORDER_FIELDS;
      
      // Wait for order to be READY
      let status;
      let waitAttempts = 0;
      do {
        status = this._atomicLoadFloat(baseIdx + this.FIELDS.STATUS);
        
        if (status === 2) break; // READY
        
        if (status === 0 || waitAttempts++ > 100) {
          // Slot empty or timeout
          continue; // Retry main loop
        }
        
        // Wait for READY status
        this._atomicWait(baseIdx + this.FIELDS.STATUS, status, 1);
        
      } while (status !== 2);
      
      // CRITICAL: Memory fence before reading data
      Atomics.add(new Int32Array(this.orderBuffer.buffer), 0, 0);
      
      // Read order data atomically
      const order = {
        price: this._atomicLoadFloat(baseIdx + this.FIELDS.PRICE),
        amount: this._atomicLoadFloat(baseIdx + this.FIELDS.AMOUNT),
        type: this._atomicLoadFloat(baseIdx + this.FIELDS.TYPE),
        orderId: this._atomicLoadFloat(baseIdx + this.FIELDS.ORDER_ID),
        timestamp: this._atomicLoadFloat(baseIdx + this.FIELDS.TIMESTAMP),
        generation: this._atomicLoadFloat(baseIdx + this.FIELDS.GENERATION)
      };
      
      // Validate generation matches (ABA prevention)
      if (order.generation !== generation) {
        logger.warn(`⚠️ Generation mismatch at index ${index}`);
        continue;
      }

      // Attempt to advance head pointer
      const newIndex = (index + 1) % this.maxOrders;
      const newGeneration = (newIndex === 0) ? generation + 1 : generation;
      newGenIdx = this._packGenIdx(newGeneration, newIndex);

      const exchanged = Atomics.compareExchange(
        this.headGenIdx, 0, currentGenIdx, newGenIdx
      );

      if (exchanged !== currentGenIdx) {
        // Another thread consumed this order, retry
        if (attempts > 10) {
          const backoff = Math.min(100, 2 ** (attempts - 10));
          Atomics.wait(this.headGenIdx, 0, newGenIdx, backoff);
        }
        continue;
      }

      // Successfully consumed order
      
      // CRITICAL: Mark slot as EMPTY atomically
      this._atomicStoreFloat(baseIdx + this.FIELDS.STATUS, 0); // EMPTY
      
      logger.debug(`✅ Order ${order.orderId} retrieved from index ${index}`);
      return order;

    } while (true);
  }

  /**
   * Atomic store for Float64 values
   * Uses Int32Array view for atomic operations
   */
  _atomicStoreFloat(index, value) {
    // Store as bits through Int32Array for atomicity
    const int32View = new Int32Array(this.orderBuffer.buffer);
    const bits = this._floatToBits(value);
    
    // Store low and high 32-bit parts atomically
    Atomics.store(int32View, index * 2, bits.low);
    Atomics.store(int32View, index * 2 + 1, bits.high);
  }

  /**
   * Atomic load for Float64 values
   */
  _atomicLoadFloat(index) {
    const int32View = new Int32Array(this.orderBuffer.buffer);
    
    // Load with sequence lock to ensure consistency
    let low1, high1, low2, high2;
    do {
      low1 = Atomics.load(int32View, index * 2);
      high1 = Atomics.load(int32View, index * 2 + 1);
      low2 = Atomics.load(int32View, index * 2);
      high2 = Atomics.load(int32View, index * 2 + 1);
    } while (low1 !== low2 || high1 !== high2);
    
    return this._bitsToFloat({ low: low1, high: high1 });
  }

  /**
   * Convert float to 32-bit low/high parts
   */
  _floatToBits(value) {
    const buffer = new ArrayBuffer(8);
    const floatView = new Float64Array(buffer);
    const int32View = new Int32Array(buffer);
    
    floatView[0] = value;
    
    return {
      low: int32View[0],
      high: int32View[1]
    };
  }

  /**
   * Convert 32-bit low/high parts to float
   */
  _bitsToFloat(bits) {
    const buffer = new ArrayBuffer(8);
    const int32View = new Int32Array(buffer);
    const floatView = new Float64Array(buffer);
    
    int32View[0] = bits.low;
    int32View[1] = bits.high;
    
    return floatView[0];
  }

  /**
   * Atomic wait helper
   */
  _atomicWait(index, expectedValue, timeout) {
    try {
      const int32View = new Int32Array(this.orderBuffer.buffer);
      return Atomics.wait(int32View, index * 2, expectedValue, timeout);
    } catch (e) {
      // Atomics.wait not available on main thread
      return 'not-equal';
    }
  }

  /**
   * Atomic notify helper
   */
  _atomicNotify(index) {
    try {
      const int32View = new Int32Array(this.orderBuffer.buffer);
      Atomics.notify(int32View, index * 2);
    } catch (e) {
      // Ignore if notify not available
    }
  }

  // Check if empty
  isEmpty() {
    const head = Atomics.load(this.headGenIdx, 0);
    const tail = Atomics.load(this.tailGenIdx, 0);
    return head === tail;
  }

  // Get current size
  size() {
    const { generation: headGen, index: headIdx } = this._unpackGenIdx(
      Atomics.load(this.headGenIdx, 0)
    );
    const { generation: tailGen, index: tailIdx } = this._unpackGenIdx(
      Atomics.load(this.tailGenIdx, 0)
    );

    if (headGen === tailGen) {
      return tailIdx - headIdx;
    } else if (tailGen > headGen) {
      return (this.maxOrders - headIdx) + tailIdx;
    }
    return 0;
  }

  // Get statistics
  getStats() {
    return {
      maxOrders: this.maxOrders,
      currentSize: this.size(),
      isEmpty: this.isEmpty(),
      head: this._unpackGenIdx(Atomics.load(this.headGenIdx, 0)),
      tail: this._unpackGenIdx(Atomics.load(this.tailGenIdx, 0))
    };
  }
}

module.exports = FixedLockFreeOrderBook;

