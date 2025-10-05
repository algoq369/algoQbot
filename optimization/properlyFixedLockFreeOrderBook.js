const logger = require('../logger');

/**
 * PROPERLY FIXED Lock-Free Order Book
 * 
 * Fixes based on expert review:
 * 1. Remove fake memory fences (Atomics.add(..., 0))
 * 2. Use status field as proper synchronization point
 * 3. Regular stores for data (synchronized via atomic status)
 * 4. Generation counter for ABA prevention
 */
class ProperlyFixedLockFreeOrderBook {
  constructor(maxOrders = 10000) {
    this.maxOrders = maxOrders;
    
    // Order fields (using regular Float64Array for data)
    this.ORDER_FIELDS = {
      PRICE: 0,
      AMOUNT: 1,
      TYPE: 2,
      ORDER_ID: 3,
      TIMESTAMP: 4,
      GENERATION: 5
    };
    
    this.FIELDS_PER_ORDER = 6;
    
    // Data buffer (regular, not atomic - synchronized via status)
    const dataBufferSize = maxOrders * this.FIELDS_PER_ORDER * Float64Array.BYTES_PER_ELEMENT;
    this.orderBuffer = new Float64Array(
      new SharedArrayBuffer(dataBufferSize)
    );
    
    // ✅ FIX: Status buffer as synchronization point (atomic)
    const statusBufferSize = maxOrders * Int32Array.BYTES_PER_ELEMENT;
    this.statusBuffer = new Int32Array(
      new SharedArrayBuffer(statusBufferSize)
    );
    
    // Status values
    this.STATUS_EMPTY = 0;
    this.STATUS_PENDING = 1;
    this.STATUS_READY = 2;
    this.STATUS_PROCESSING = 3;
    
    // Control structures (head/tail with generation)
    this.controlBuffer = new SharedArrayBuffer(16);
    this.headGenIdx = new BigUint64Array(this.controlBuffer, 0, 1);
    this.tailGenIdx = new BigUint64Array(this.controlBuffer, 8, 1);
    
    // Initialize
    Atomics.store(this.headGenIdx, 0, 0n);
    Atomics.store(this.tailGenIdx, 0, 0n);
    
    // Initialize all statuses to EMPTY
    for (let i = 0; i < maxOrders; i++) {
      Atomics.store(this.statusBuffer, i, this.STATUS_EMPTY);
    }
    
    logger.info(`✅ PROPERLY Fixed Lock-Free Order Book: ${maxOrders} capacity`);
  }

  _packGenIdx(generation, index) {
    return (BigInt(generation) << 32n) | BigInt(index);
  }

  _unpackGenIdx(packed) {
    return {
      generation: Number(packed >> 32n),
      index: Number(packed & 0xFFFFFFFFn)
    };
  }

  /**
   * ✅ FIX: Add order with proper memory ordering via status field
   * 
   * Key insight: We don't need explicit memory fences.
   * By spec, atomic store "happens before" any subsequent atomic load.
   * So we write data first (regular stores), then atomically set status to READY.
   * Any thread that sees READY is guaranteed to see all the data.
   */
  addOrder(order) {
    let currentGenIdx, newGenIdx, index, generation;
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;

    // Phase 1: Claim a slot
    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.warn('Max CAS attempts for addOrder');
        return false;
      }
      
      currentGenIdx = Atomics.load(this.tailGenIdx, 0);
      ({ generation, index } = this._unpackGenIdx(currentGenIdx));

      const newIndex = (index + 1) % this.maxOrders;
      const newGeneration = (newIndex === 0) ? generation + 1 : generation;
      newGenIdx = this._packGenIdx(newGeneration, newIndex);

      // Check if full
      const headGenIdx = Atomics.load(this.headGenIdx, 0);
      const { generation: headGen, index: headIdx } = this._unpackGenIdx(headGenIdx);

      if (newIndex === headIdx && newGeneration === headGen) {
        logger.warn('Order book is full');
        return false;
      }

      // Try to claim
      const exchanged = Atomics.compareExchange(
        this.tailGenIdx, 0, currentGenIdx, newGenIdx
      );
      
      if (exchanged !== currentGenIdx) {
        // Backoff
        if (attempts > 10) {
          const backoff = Math.min(100, 2 ** (attempts - 10));
          Atomics.wait(this.tailGenIdx, 0, newGenIdx, backoff);
        }
        continue;
      }

      break; // Successfully claimed slot

    } while (true);

    // Phase 2: Write data
    const baseIdx = index * this.FIELDS_PER_ORDER;
    
    // ✅ FIX: Write data with regular stores (synchronized via status)
    this.orderBuffer[baseIdx + this.ORDER_FIELDS.PRICE] = order.price || 0;
    this.orderBuffer[baseIdx + this.ORDER_FIELDS.AMOUNT] = order.amount || 0;
    this.orderBuffer[baseIdx + this.ORDER_FIELDS.TYPE] = order.type || 0;
    this.orderBuffer[baseIdx + this.ORDER_FIELDS.ORDER_ID] = order.orderId || 0;
    this.orderBuffer[baseIdx + this.ORDER_FIELDS.TIMESTAMP] = Date.now();
    this.orderBuffer[baseIdx + this.ORDER_FIELDS.GENERATION] = generation;
    
    // ✅ CRITICAL: Atomic store to READY establishes happens-before relationship
    // By JavaScript spec, all previous writes are guaranteed visible to any thread
    // that sees this READY status
    Atomics.store(this.statusBuffer, index, this.STATUS_READY);
    Atomics.notify(this.statusBuffer, index);
    
    logger.debug(`Order ${order.orderId} added at index ${index}`);
    return true;
  }

  /**
   * ✅ FIX: Get order with proper memory ordering via status field
   */
  getOrder(timeout = 0) {
    let currentGenIdx, newGenIdx, index, generation;
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;
    const startTime = Date.now();

    do {
      if (attempts++ > MAX_ATTEMPTS) {
        logger.warn('Max attempts for getOrder');
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
        
        // Wait for new order
        Atomics.wait(this.statusBuffer, index, this.STATUS_EMPTY, 
          Math.min(100, timeout - (Date.now() - startTime)));
        continue;
      }

      // ✅ FIX: Wait for READY status (guarantees all data visible)
      let status;
      let waitAttempts = 0;
      do {
        status = Atomics.load(this.statusBuffer, index);
        
        if (status === this.STATUS_READY) {
          break; // Ready to read
        }
        
        if (status === this.STATUS_EMPTY || waitAttempts++ > 100) {
          continue; // Retry main loop
        }
        
        Atomics.wait(this.statusBuffer, index, status, 10);
        
      } while (status !== this.STATUS_READY);
      
      // ✅ CRITICAL: Because we saw READY via atomic load, all data writes
      // are guaranteed visible by JavaScript memory model
      const baseIdx = index * this.FIELDS_PER_ORDER;
      
      const order = {
        price: this.orderBuffer[baseIdx + this.ORDER_FIELDS.PRICE],
        amount: this.orderBuffer[baseIdx + this.ORDER_FIELDS.AMOUNT],
        type: this.orderBuffer[baseIdx + this.ORDER_FIELDS.TYPE],
        orderId: this.orderBuffer[baseIdx + this.ORDER_FIELDS.ORDER_ID],
        timestamp: this.orderBuffer[baseIdx + this.ORDER_FIELDS.TIMESTAMP],
        generation: this.orderBuffer[baseIdx + this.ORDER_FIELDS.GENERATION]
      };
      
      // Validate generation (ABA prevention)
      if (order.generation !== generation) {
        logger.warn(`Generation mismatch at index ${index}`);
        continue;
      }

      // Try to advance head
      const newIndex = (index + 1) % this.maxOrders;
      const newGeneration = (newIndex === 0) ? generation + 1 : generation;
      newGenIdx = this._packGenIdx(newGeneration, newIndex);

      const exchanged = Atomics.compareExchange(
        this.headGenIdx, 0, currentGenIdx, newGenIdx
      );

      if (exchanged !== currentGenIdx) {
        // Another thread got it, retry
        if (attempts > 10) {
          const backoff = Math.min(100, 2 ** (attempts - 10));
          Atomics.wait(this.headGenIdx, 0, newGenIdx, backoff);
        }
        continue;
      }

      // Successfully consumed
      // Mark as EMPTY
      Atomics.store(this.statusBuffer, index, this.STATUS_EMPTY);
      
      logger.debug(`Order ${order.orderId} retrieved from index ${index}`);
      return order;

    } while (true);
  }

  isEmpty() {
    const head = Atomics.load(this.headGenIdx, 0);
    const tail = Atomics.load(this.tailGenIdx, 0);
    return head === tail;
  }

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

  getStats() {
    return {
      maxOrders: this.maxOrders,
      currentSize: this.size(),
      isEmpty: this.isEmpty(),
      head: this._unpackGenIdx(Atomics.load(this.headGenIdx, 0)),
      tail: this._unpackGenIdx(Atomics.load(this.tailGenIdx, 0))
    };
  }

  healthCheck() {
    return {
      status: 'healthy',
      size: this.size(),
      maxOrders: this.maxOrders,
      utilization: (this.size() / this.maxOrders * 100).toFixed(2) + '%'
    };
  }
}

module.exports = ProperlyFixedLockFreeOrderBook;

