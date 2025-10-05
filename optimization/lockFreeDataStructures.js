const logger = require('../logger');

class LockFreeOrderBook {
  constructor(maxOrders = 100000) {
    this.maxOrders = maxOrders;
    
    // Lock-free ring buffer for orders
    this.orderBuffer = new Int32Array(new SharedArrayBuffer(maxOrders * 8 * 4)); // 8 fields * 4 bytes
    this.head = new Int32Array(new SharedArrayBuffer(4));
    this.tail = new Int32Array(new SharedArrayBuffer(4));
    this.size = new Int32Array(new SharedArrayBuffer(4));
    
    // Order fields: [timestamp, price, amount, side, orderId, pair, status, priority]
    this.ORDER_FIELDS = {
      TIMESTAMP: 0,
      PRICE: 1,
      AMOUNT: 2,
      SIDE: 3,
      ORDER_ID: 4,
      PAIR: 5,
      STATUS: 6,
      PRIORITY: 7
    };
    
    // Lock-free hash map for quick order lookup
    this.orderIndex = new Map();
    this.indexBuffer = new Int32Array(new SharedArrayBuffer(maxOrders * 2 * 4)); // [orderId, position]
    
    logger.info(`🚀 Lock-Free Order Book initialized - Max orders: ${maxOrders}`);
  }

  // Add order with lock-free algorithm
  addOrder(order) {
    const orderId = order.id || this.generateOrderId();
    const timestamp = order.timestamp || Date.now();
    const price = Math.floor(order.price * 1000000); // Convert to integer (micro-units)
    const amount = Math.floor(order.amount * 1000000); // Convert to integer (micro-units)
    const side = order.side === 'buy' ? 1 : 0;
    const pair = this.encodePair(order.pair);
    const status = this.encodeStatus(order.status || 'pending');
    const priority = order.priority || 0;

    // Get next position atomically
    let currentTail;
    let newTail;
    
    do {
      currentTail = Atomics.load(this.tail, 0);
      newTail = (currentTail + 1) % this.maxOrders;
      
      // Check if buffer is full
      if (newTail === Atomics.load(this.head, 0)) {
        logger.warn('⚠️ Order book buffer full, dropping oldest order');
        this.removeOldestOrder();
      }
    } while (!Atomics.compareExchange(this.tail, 0, currentTail, newTail));

    // Write order data atomically
    const baseIndex = currentTail * 8;
    
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.TIMESTAMP, timestamp);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PRICE, price);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.AMOUNT, amount);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.SIDE, side);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.ORDER_ID, orderId);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PAIR, pair);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.STATUS, status);
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PRIORITY, priority);
    
    // Update size atomically
    Atomics.add(this.size, 0, 1);
    
    // Update index
    this.orderIndex.set(orderId, currentTail);
    
    logger.debug(`✅ Order ${orderId} added at position ${currentTail}`);
    
    return orderId;
  }

  // Get order by ID (lock-free read)
  getOrder(orderId) {
    const position = this.orderIndex.get(orderId);
    if (position === undefined) {
      return null;
    }

    const baseIndex = position * 8;
    
    return {
      id: Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.ORDER_ID),
      timestamp: Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.TIMESTAMP),
      price: Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PRICE) / 1000000,
      amount: Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.AMOUNT) / 1000000,
      side: Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.SIDE) === 1 ? 'buy' : 'sell',
      pair: this.decodePair(Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PAIR)),
      status: this.decodeStatus(Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.STATUS)),
      priority: Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PRIORITY)
    };
  }

  // Update order status (lock-free)
  updateOrderStatus(orderId, newStatus) {
    const position = this.orderIndex.get(orderId);
    if (position === undefined) {
      return false;
    }

    const baseIndex = position * 8;
    const encodedStatus = this.encodeStatus(newStatus);
    
    Atomics.store(this.orderBuffer, baseIndex + this.ORDER_FIELDS.STATUS, encodedStatus);
    
    logger.debug(`✅ Order ${orderId} status updated to ${newStatus}`);
    return true;
  }

  // Remove oldest order (lock-free)
  removeOldestOrder() {
    let currentHead = Atomics.load(this.head, 0);
    const newHead = (currentHead + 1) % this.maxOrders;
    
    if (Atomics.compareExchange(this.head, 0, currentHead, newHead)) {
      const baseIndex = currentHead * 8;
      const orderId = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.ORDER_ID);
      
      this.orderIndex.delete(orderId);
      Atomics.sub(this.size, 0, 1);
      
      logger.debug(`🗑️ Removed oldest order ${orderId}`);
      return orderId;
    }
    
    return null;
  }

  // Get best bid/ask prices (lock-free)
  getBestPrices(pair) {
    const encodedPair = this.encodePair(pair);
    let bestBid = 0;
    let bestAsk = Number.MAX_SAFE_INTEGER;
    
    const currentSize = Atomics.load(this.size, 0);
    const head = Atomics.load(this.head, 0);
    const tail = Atomics.load(this.tail, 0);
    
    // Iterate through orders
    for (let i = 0; i < currentSize; i++) {
      const position = (head + i) % this.maxOrders;
      const baseIndex = position * 8;
      
      const orderPair = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PAIR);
      const orderSide = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.SIDE);
      const orderPrice = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PRICE);
      const orderStatus = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.STATUS);
      
      if (orderPair === encodedPair && this.decodeStatus(orderStatus) === 'pending') {
        if (orderSide === 1) { // Buy order
          bestBid = Math.max(bestBid, orderPrice);
        } else { // Sell order
          bestAsk = Math.min(bestAsk, orderPrice);
        }
      }
    }
    
    return {
      bid: bestBid / 1000000,
      ask: bestAsk === Number.MAX_SAFE_INTEGER ? 0 : bestAsk / 1000000,
      spread: bestAsk === Number.MAX_SAFE_INTEGER ? 0 : (bestAsk - bestBid) / 1000000
    };
  }

  // Get order book depth (lock-free)
  getOrderBookDepth(pair, levels = 10) {
    const encodedPair = this.encodePair(pair);
    const bids = [];
    const asks = [];
    
    const currentSize = Atomics.load(this.size, 0);
    const head = Atomics.load(this.head, 0);
    
    // Collect all orders for the pair
    for (let i = 0; i < currentSize; i++) {
      const position = (head + i) % this.maxOrders;
      const baseIndex = position * 8;
      
      const orderPair = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PAIR);
      const orderSide = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.SIDE);
      const orderPrice = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.PRICE);
      const orderAmount = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.AMOUNT);
      const orderStatus = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.STATUS);
      
      if (orderPair === encodedPair && this.decodeStatus(orderStatus) === 'pending') {
        const order = {
          price: orderPrice / 1000000,
          amount: orderAmount / 1000000
        };
        
        if (orderSide === 1) { // Buy order
          bids.push(order);
        } else { // Sell order
          asks.push(order);
        }
      }
    }
    
    // Sort and limit
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);
    
    return {
      bids: bids.slice(0, levels),
      asks: asks.slice(0, levels)
    };
  }

  // Get order book statistics (lock-free)
  getStats() {
    const currentSize = Atomics.load(this.size, 0);
    const head = Atomics.load(this.head, 0);
    const tail = Atomics.load(this.tail, 0);
    
    let buyOrders = 0;
    let sellOrders = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < currentSize; i++) {
      const position = (head + i) % this.maxOrders;
      const baseIndex = position * 8;
      
      const orderSide = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.SIDE);
      const orderAmount = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.AMOUNT);
      const orderStatus = Atomics.load(this.orderBuffer, baseIndex + this.ORDER_FIELDS.STATUS);
      
      if (this.decodeStatus(orderStatus) === 'pending') {
        totalVolume += orderAmount;
        if (orderSide === 1) {
          buyOrders++;
        } else {
          sellOrders++;
        }
      }
    }
    
    return {
      totalOrders: currentSize,
      buyOrders: buyOrders,
      sellOrders: sellOrders,
      totalVolume: totalVolume / 1000000,
      utilization: (currentSize / this.maxOrders * 100).toFixed(2) + '%',
      head: head,
      tail: tail
    };
  }

  // Helper methods
  generateOrderId() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  encodePair(pair) {
    // Simple encoding - in production, use proper string encoding
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

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthy = stats.totalOrders < this.maxOrders * 0.9; // Less than 90% full
    
    return {
      status: healthy ? 'healthy' : 'warning',
      stats: stats,
      memoryUsage: (this.orderBuffer.length * 4) + ' bytes'
    };
  }

  // Clear all orders (for testing)
  clear() {
    Atomics.store(this.head, 0, 0);
    Atomics.store(this.tail, 0, 0);
    Atomics.store(this.size, 0, 0);
    this.orderIndex.clear();
    
    logger.info('✅ Order book cleared');
  }
}

class LockFreeRingBuffer {
  constructor(size, elementSize) {
    this.size = size;
    this.elementSize = elementSize;
    this.buffer = new SharedArrayBuffer(size * elementSize * 4);
    this.data = new Int32Array(this.buffer);
    this.head = new Int32Array(new SharedArrayBuffer(4));
    this.tail = new Int32Array(new SharedArrayBuffer(4));
    this.count = new Int32Array(new SharedArrayBuffer(4));
    
    logger.info(`🚀 Lock-Free Ring Buffer initialized - Size: ${size}, Element size: ${elementSize}`);
  }

  // Push element (lock-free)
  push(element) {
    if (Array.isArray(element) && element.length !== this.elementSize) {
      throw new Error(`Element size mismatch: expected ${this.elementSize}, got ${element.length}`);
    }

    let currentTail;
    let newTail;
    
    do {
      currentTail = Atomics.load(this.tail, 0);
      newTail = (currentTail + 1) % this.size;
      
      if (newTail === Atomics.load(this.head, 0)) {
        // Buffer full, overwrite oldest element
        Atomics.add(this.head, 0, 1);
        Atomics.sub(this.count, 0, 1);
      }
    } while (!Atomics.compareExchange(this.tail, 0, currentTail, newTail));

    // Write element data
    const baseIndex = currentTail * this.elementSize;
    for (let i = 0; i < this.elementSize; i++) {
      Atomics.store(this.data, baseIndex + i, element[i]);
    }
    
    Atomics.add(this.count, 0, 1);
    
    return true;
  }

  // Pop element (lock-free)
  pop() {
    let currentHead = Atomics.load(this.head, 0);
    
    if (currentHead === Atomics.load(this.tail, 0)) {
      return null; // Buffer empty
    }

    if (Atomics.compareExchange(this.head, 0, currentHead, (currentHead + 1) % this.size)) {
      const baseIndex = currentHead * this.elementSize;
      const element = new Array(this.elementSize);
      
      for (let i = 0; i < this.elementSize; i++) {
        element[i] = Atomics.load(this.data, baseIndex + i);
      }
      
      Atomics.sub(this.count, 0, 1);
      
      return element;
    }
    
    return null;
  }

  // Get current count (lock-free)
  getCount() {
    return Atomics.load(this.count, 0);
  }

  // Get buffer utilization
  getUtilization() {
    return (Atomics.load(this.count, 0) / this.size * 100).toFixed(2) + '%';
  }
}

class LockFreeHashMap {
  constructor(size) {
    this.size = size;
    this.buffer = new Int32Array(new SharedArrayBuffer(size * 3 * 4)); // [key, value, next]
    this.heads = new Int32Array(new SharedArrayBuffer(size * 4));
    
    // Initialize heads to -1 (empty)
    for (let i = 0; i < size; i++) {
      Atomics.store(this.heads, i, -1);
    }
    
    this.freeList = new Int32Array(new SharedArrayBuffer(4));
    Atomics.store(this.freeList, 0, 0);
    
    logger.info(`🚀 Lock-Free HashMap initialized - Size: ${size}`);
  }

  // Hash function
  hash(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.size;
  }

  // Get value (lock-free read)
  get(key) {
    const bucket = this.hash(key);
    let current = Atomics.load(this.heads, bucket);
    
    while (current !== -1) {
      const keyIndex = current * 3;
      const valueIndex = current * 3 + 1;
      const nextIndex = current * 3 + 2;
      
      const storedKey = Atomics.load(this.buffer, keyIndex);
      const storedValue = Atomics.load(this.buffer, valueIndex);
      
      if (storedKey === key) {
        return storedValue;
      }
      
      current = Atomics.load(this.buffer, nextIndex);
    }
    
    return null;
  }

  // Put value (lock-free write)
  put(key, value) {
    const bucket = this.hash(key);
    const keyHash = this.hash(key);
    
    // Try to update existing
    let current = Atomics.load(this.heads, bucket);
    while (current !== -1) {
      const keyIndex = current * 3;
      const valueIndex = current * 3 + 1;
      const nextIndex = current * 3 + 2;
      
      if (Atomics.compareExchange(this.buffer, keyIndex, keyHash, keyHash)) {
        Atomics.store(this.buffer, valueIndex, value);
        return true;
      }
      
      current = Atomics.load(this.buffer, nextIndex);
    }
    
    // Add new entry
    const freeIndex = Atomics.load(this.freeList, 0);
    if (freeIndex >= this.size) {
      return false; // HashMap full
    }
    
    const newIndex = freeIndex * 3;
    Atomics.store(this.buffer, newIndex, keyHash);
    Atomics.store(this.buffer, newIndex + 1, value);
    Atomics.store(this.buffer, newIndex + 2, Atomics.load(this.heads, bucket));
    
    Atomics.store(this.heads, bucket, freeIndex);
    Atomics.add(this.freeList, 0, 1);
    
    return true;
  }

  // Get statistics
  getStats() {
    let entries = 0;
    let buckets = 0;
    
    for (let i = 0; i < this.size; i++) {
      if (Atomics.load(this.heads, i) !== -1) {
        buckets++;
        let current = Atomics.load(this.heads, i);
        while (current !== -1) {
          entries++;
          current = Atomics.load(this.buffer, current * 3 + 2);
        }
      }
    }
    
    return {
      totalEntries: entries,
      usedBuckets: buckets,
      utilization: (buckets / this.size * 100).toFixed(2) + '%',
      loadFactor: (entries / this.size).toFixed(2)
    };
  }
}

module.exports = {
  LockFreeOrderBook,
  LockFreeRingBuffer,
  LockFreeHashMap
};

