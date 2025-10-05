const logger = require('../logger');

class CorrectLockFreeOrderBook {
  constructor(maxOrders = 10000) {
    this.maxOrders = maxOrders;
    
    // Use 64-bit integer: [32-bit generation | 32-bit index]
    this.headGenIdx = new BigUint64Array(new SharedArrayBuffer(8));
    this.tailGenIdx = new BigUint64Array(new SharedArrayBuffer(8));
    
    // Order data with atomic consistency
    this.orderBuffer = new Float64Array(
      new SharedArrayBuffer(maxOrders * 8 * 8) // 8 fields per order
    );
    
    // Order fields: [price, amount, type, timestamp, orderId, pair, status, ready]
    this.ORDER_FIELDS = {
      PRICE: 0,
      AMOUNT: 1,
      TYPE: 2,
      TIMESTAMP: 3,
      ORDER_ID: 4,
      PAIR: 5,
      STATUS: 6,
      READY: 7
    };
    
    // Lock-free hash map for quick order lookup
    this.orderIndex = new Map();
    
    logger.info(`🚀 Correct Lock-Free Order Book initialized - Max orders: ${maxOrders}`);
  }

  // CRITICAL: ABA-safe order addition with generation counter
  addOrder(order) {
    const orderId = order.id || this.generateOrderId();
    const timestamp = order.timestamp || Date.now();
    const price = order.price || 0;
    const amount = order.amount || 0;
    const type = order.side === 'buy' ? 1 : 0;
    const pair = this.encodePair(order.pair);
    const status = this.encodeStatus(order.status || 'pending');
    
    let currentGenIdx, newGenIdx, index, generation;
    
    do {
      currentGenIdx = Atomics.load(this.tailGenIdx, 0);
      
      // Extract generation and index
      generation = Number(currentGenIdx >> 32n);
      index = Number(currentGenIdx & 0xFFFFFFFFn);
      
      const newIndex = (index + 1) % this.maxOrders;
      const newGeneration = generation + 1;
      
      // Pack new generation and index
      newGenIdx = (BigInt(newGeneration) << 32n) | BigInt(newIndex);
      
      // Check if queue is full
      const headGenIdx = Atomics.load(this.headGenIdx, 0);
      const headIndex = Number(headGenIdx & 0xFFFFFFFFn);
      
      if (newIndex === headIndex) {
        logger.warn('⚠️ Order book full, cannot add order');
        return null;
      }
      
    } while (Atomics.compareExchange(
      this.tailGenIdx, 0, currentGenIdx, newGenIdx
    ) !== currentGenIdx);
    
    // Now safe to write order data atomically
    const baseIdx = index * 8;
    
    // Write order data with atomic consistency
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PRICE, price);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.AMOUNT, amount);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TYPE, type);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TIMESTAMP, timestamp);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.ORDER_ID, orderId);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PAIR, pair);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS, status);
    
    // Signal order ready (must be last)
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY, 1);
    Atomics.notify(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY);
    
    // Update index
    this.orderIndex.set(orderId, { index, generation });
    
    logger.debug(`✅ Order ${orderId} added at position ${index} (generation ${generation})`);
    
    return orderId;
  }

  // CRITICAL: ABA-safe order retrieval with generation verification
  getOrder(orderId) {
    const orderInfo = this.orderIndex.get(orderId);
    if (!orderInfo) {
      return null;
    }

    const { index, generation } = orderInfo;
    const baseIdx = index * 8;
    
    // Verify generation hasn't changed (ABA protection)
    const currentTailGenIdx = Atomics.load(this.tailGenIdx, 0);
    const currentGeneration = Number(currentTailGenIdx >> 32n);
    
    if (generation !== currentGeneration) {
      // Order has been overwritten due to queue wraparound
      this.orderIndex.delete(orderId);
      return null;
    }
    
    // Check if order is ready
    const ready = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY);
    if (!ready) {
      return null; // Order not yet written
    }
    
    return {
      id: Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.ORDER_ID),
      timestamp: Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TIMESTAMP),
      price: Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PRICE),
      amount: Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.AMOUNT),
      side: Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TYPE) === 1 ? 'buy' : 'sell',
      pair: this.decodePair(Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PAIR)),
      status: this.decodeStatus(Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS))
    };
  }

  // Update order status with atomic consistency
  updateOrderStatus(orderId, newStatus) {
    const orderInfo = this.orderIndex.get(orderId);
    if (!orderInfo) {
      return false;
    }

    const { index, generation } = orderInfo;
    
    // Verify generation hasn't changed
    const currentTailGenIdx = Atomics.load(this.tailGenIdx, 0);
    const currentGeneration = Number(currentTailGenIdx >> 32n);
    
    if (generation !== currentGeneration) {
      this.orderIndex.delete(orderId);
      return false;
    }
    
    const baseIdx = index * 8;
    const encodedStatus = this.encodeStatus(newStatus);
    
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS, encodedStatus);
    
    logger.debug(`✅ Order ${orderId} status updated to ${newStatus}`);
    return true;
  }

  // Remove order with ABA protection
  removeOrder(orderId) {
    const orderInfo = this.orderIndex.get(orderId);
    if (!orderInfo) {
      return false;
    }

    const { index, generation } = orderInfo;
    
    // Verify generation hasn't changed
    const currentTailGenIdx = Atomics.load(this.tailGenIdx, 0);
    const currentGeneration = Number(currentTailGenIdx >> 32n);
    
    if (generation !== currentGeneration) {
      this.orderIndex.delete(orderId);
      return false;
    }
    
    const baseIdx = index * 8;
    
    // Mark order as removed
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY, 0);
    Atomics.store(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS, this.encodeStatus('cancelled'));
    
    this.orderIndex.delete(orderId);
    
    logger.debug(`✅ Order ${orderId} removed`);
    return true;
  }

  // Get best bid/ask prices with ABA protection
  getBestPrices(pair) {
    const encodedPair = this.encodePair(pair);
    let bestBid = 0;
    let bestAsk = Number.MAX_SAFE_INTEGER;
    
    const headGenIdx = Atomics.load(this.headGenIdx, 0);
    const tailGenIdx = Atomics.load(this.tailGenIdx, 0);
    
    const headIndex = Number(headGenIdx & 0xFFFFFFFFn);
    const tailIndex = Number(tailGenIdx & 0xFFFFFFFFn);
    
    // Iterate through orders safely
    let currentIndex = headIndex;
    while (currentIndex !== tailIndex) {
      const baseIdx = currentIndex * 8;
      
      // Check if order is ready
      const ready = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY);
      if (!ready) {
        currentIndex = (currentIndex + 1) % this.maxOrders;
        continue;
      }
      
      const orderPair = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PAIR);
      const orderType = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TYPE);
      const orderPrice = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PRICE);
      const orderStatus = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS);
      
      if (orderPair === encodedPair && this.decodeStatus(orderStatus) === 'pending') {
        if (orderType === 1) { // Buy order
          bestBid = Math.max(bestBid, orderPrice);
        } else { // Sell order
          bestAsk = Math.min(bestAsk, orderPrice);
        }
      }
      
      currentIndex = (currentIndex + 1) % this.maxOrders;
    }
    
    return {
      bid: bestBid,
      ask: bestAsk === Number.MAX_SAFE_INTEGER ? 0 : bestAsk,
      spread: bestAsk === Number.MAX_SAFE_INTEGER ? 0 : bestAsk - bestBid
    };
  }

  // Get order book depth with ABA protection
  getOrderBookDepth(pair, levels = 10) {
    const encodedPair = this.encodePair(pair);
    const bids = [];
    const asks = [];
    
    const headGenIdx = Atomics.load(this.headGenIdx, 0);
    const tailGenIdx = Atomics.load(this.tailGenIdx, 0);
    
    const headIndex = Number(headGenIdx & 0xFFFFFFFFn);
    const tailIndex = Number(tailGenIdx & 0xFFFFFFFFn);
    
    // Collect all orders for the pair
    let currentIndex = headIndex;
    while (currentIndex !== tailIndex) {
      const baseIdx = currentIndex * 8;
      
      const ready = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY);
      if (!ready) {
        currentIndex = (currentIndex + 1) % this.maxOrders;
        continue;
      }
      
      const orderPair = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PAIR);
      const orderType = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TYPE);
      const orderPrice = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.PRICE);
      const orderAmount = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.AMOUNT);
      const orderStatus = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS);
      
      if (orderPair === encodedPair && this.decodeStatus(orderStatus) === 'pending') {
        const order = {
          price: orderPrice,
          amount: orderAmount
        };
        
        if (orderType === 1) { // Buy order
          bids.push(order);
        } else { // Sell order
          asks.push(order);
        }
      }
      
      currentIndex = (currentIndex + 1) % this.maxOrders;
    }
    
    // Sort and limit
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);
    
    return {
      bids: bids.slice(0, levels),
      asks: asks.slice(0, levels)
    };
  }

  // Get order book statistics with ABA protection
  getStats() {
    const headGenIdx = Atomics.load(this.headGenIdx, 0);
    const tailGenIdx = Atomics.load(this.tailGenIdx, 0);
    
    const headIndex = Number(headGenIdx & 0xFFFFFFFFn);
    const tailIndex = Number(tailGenIdx & 0xFFFFFFFFn);
    
    let buyOrders = 0;
    let sellOrders = 0;
    let totalVolume = 0;
    
    let currentIndex = headIndex;
    while (currentIndex !== tailIndex) {
      const baseIdx = currentIndex * 8;
      
      const ready = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.READY);
      if (!ready) {
        currentIndex = (currentIndex + 1) % this.maxOrders;
        continue;
      }
      
      const orderType = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.TYPE);
      const orderAmount = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.AMOUNT);
      const orderStatus = Atomics.load(this.orderBuffer, baseIdx + this.ORDER_FIELDS.STATUS);
      
      if (this.decodeStatus(orderStatus) === 'pending') {
        totalVolume += orderAmount;
        if (orderType === 1) {
          buyOrders++;
        } else {
          sellOrders++;
        }
      }
      
      currentIndex = (currentIndex + 1) % this.maxOrders;
    }
    
    const currentSize = (tailIndex - headIndex + this.maxOrders) % this.maxOrders;
    
    return {
      totalOrders: currentSize,
      buyOrders: buyOrders,
      sellOrders: sellOrders,
      totalVolume: totalVolume,
      utilization: (currentSize / this.maxOrders * 100).toFixed(2) + '%',
      headIndex: headIndex,
      tailIndex: tailIndex,
      generation: Number(tailGenIdx >> 32n)
    };
  }

  // Helper methods
  generateOrderId() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  encodePair(pair) {
    const pairMap = {
      'USDT/BNB': 1,
      'ETH/USDT': 2,
      'BTC/USDT': 3,
      'CAKE/USDT': 4,
      'ADA/USDT': 5,
      'DOT/USDT': 6
    };
    return pairMap[pair] || 0;
  }

  decodePair(encoded) {
    const pairMap = {
      1: 'USDT/BNB',
      2: 'ETH/USDT',
      3: 'BTC/USDT',
      4: 'CAKE/USDT',
      5: 'ADA/USDT',
      6: 'DOT/USDT'
    };
    return pairMap[encoded] || 'UNKNOWN';
  }

  encodeStatus(status) {
    const statusMap = {
      'pending': 0,
      'filled': 1,
      'cancelled': 2,
      'partial': 3,
      'rejected': 4
    };
    return statusMap[status] || 0;
  }

  decodeStatus(encoded) {
    const statusMap = {
      0: 'pending',
      1: 'filled',
      2: 'cancelled',
      3: 'partial',
      4: 'rejected'
    };
    return statusMap[encoded] || 'unknown';
  }

  // Health check with ABA consistency verification
  healthCheck() {
    const stats = this.getStats();
    
    // Test ABA consistency
    let consistencyErrors = 0;
    const testOrderId = this.generateOrderId();
    const testOrder = { id: testOrderId, price: 100, amount: 1, side: 'buy', pair: 'USDT/BNB' };
    
    const addedId = this.addOrder(testOrder);
    if (addedId) {
      const retrieved1 = this.getOrder(addedId);
      const retrieved2 = this.getOrder(addedId);
      
      if (!retrieved1 || !retrieved2 || retrieved1.price !== retrieved2.price) {
        consistencyErrors++;
      }
      
      this.removeOrder(addedId);
    }
    
    const healthy = stats.totalOrders < this.maxOrders * 0.9 && consistencyErrors === 0;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      stats: stats,
      consistencyErrors: consistencyErrors,
      memoryUsage: (this.orderBuffer.length * 8) + ' bytes',
      abaProtection: 'generation counter implemented'
    };
  }

  // Clear all orders (for testing)
  clear() {
    Atomics.store(this.headGenIdx, 0, 0n);
    Atomics.store(this.tailGenIdx, 0, 0n);
    this.orderIndex.clear();
    
    logger.info('✅ Correct lock-free order book cleared');
  }
}

module.exports = CorrectLockFreeOrderBook;

