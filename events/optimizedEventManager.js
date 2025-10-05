const EventEmitter = require('events');
const PQueue = require('p-queue');
const WebSocket = require('ws');
const logger = require('../logger');
const config = require('../config');

class OptimizedEventManager extends EventEmitter {
  constructor() {
    super();
    
    // Priority queues for different event types
    this.highPriorityQueue = new PQueue({ 
      concurrency: 10, 
      interval: 100,
      intervalCap: 1000 // 1000 events per 100ms
    });
    
    this.normalPriorityQueue = new PQueue({ 
      concurrency: 5, 
      interval: 1000,
      intervalCap: 500 // 500 events per second
    });
    
    this.lowPriorityQueue = new PQueue({ 
      concurrency: 2, 
      interval: 5000,
      intervalCap: 100 // 100 events per 5 seconds
    });
    
    // Event processing metrics
    this.metrics = {
      processed: 0,
      errors: 0,
      latency: {
        high: [],
        normal: [],
        low: []
      },
      queueSizes: {
        high: 0,
        normal: 0,
        low: 0
      }
    };
    
    // WebSocket connections with optimized management
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    
    // Event batching for performance
    this.eventBatch = [];
    this.batchSize = 100;
    this.batchTimeout = 50; // 50ms batch timeout
    this.batchTimer = null;
    
    // Connection monitoring
    this.heartbeatIntervals = new Map();
    this.lastPong = new Map();
    this.connectionTimeouts = new Map();
    
    this.startMetricsCollection();
    logger.info('🚀 Optimized Event Manager initialized');
  }

  // Process event with priority-based routing
  async processEvent(event) {
    const startTime = performance.now();
    
    try {
      const priority = this.getEventPriority(event);
      
      let result;
      switch(priority) {
        case 'HIGH':
          result = await this.highPriorityQueue.add(() => this.handleEvent(event));
          this.metrics.latency.high.push(performance.now() - startTime);
          break;
        case 'NORMAL':
          result = await this.normalPriorityQueue.add(() => this.handleEvent(event));
          this.metrics.latency.normal.push(performance.now() - startTime);
          break;
        case 'LOW':
          result = await this.lowPriorityQueue.add(() => this.handleEvent(event));
          this.metrics.latency.low.push(performance.now() - startTime);
          break;
      }
      
      this.metrics.processed++;
      this.updateQueueMetrics();
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Event processing error:`, error);
      throw error;
    }
  }

  // Determine event priority based on type and content
  getEventPriority(event) {
    // High priority: Critical trading events
    if (event.type === 'PRICE_UPDATE' && event.urgent) return 'HIGH';
    if (event.type === 'TRADE_SIGNAL') return 'HIGH';
    if (event.type === 'EMERGENCY_STOP') return 'HIGH';
    if (event.type === 'MEV_ATTACK_DETECTED') return 'HIGH';
    if (event.type === 'CIRCUIT_BREAKER_TRIGGERED') return 'HIGH';
    
    // Normal priority: Standard trading events
    if (event.type === 'PRICE_UPDATE') return 'NORMAL';
    if (event.type === 'BALANCE_UPDATE') return 'NORMAL';
    if (event.type === 'TRADE_COMPLETED') return 'NORMAL';
    if (event.type === 'ANALYTICS_UPDATE') return 'NORMAL';
    
    // Low priority: Logging and metrics
    if (event.type === 'LOG_ENTRY') return 'LOW';
    if (event.type === 'METRICS_UPDATE') return 'LOW';
    if (event.type === 'HEALTH_CHECK') return 'LOW';
    
    return 'NORMAL'; // Default priority
  }

  // Handle individual event
  async handleEvent(event) {
    try {
      // Emit event to listeners
      this.emit(event.type, event);
      
      // Handle specific event types
      switch(event.type) {
        case 'PRICE_UPDATE':
          await this.handlePriceUpdate(event);
          break;
        case 'TRADE_SIGNAL':
          await this.handleTradeSignal(event);
          break;
        case 'EMERGENCY_STOP':
          await this.handleEmergencyStop(event);
          break;
        case 'MEV_ATTACK_DETECTED':
          await this.handleMEVAttack(event);
          break;
        case 'CIRCUIT_BREAKER_TRIGGERED':
          await this.handleCircuitBreaker(event);
          break;
        default:
          // Generic event handling
          break;
      }
      
    } catch (error) {
      logger.error(`Error handling event ${event.type}:`, error);
      throw error;
    }
  }

  // Batch event processing for high throughput
  addToBatch(event) {
    this.eventBatch.push(event);
    
    if (this.eventBatch.length >= this.batchSize) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchTimeout);
    }
  }

  // Process batched events
  async processBatch() {
    if (this.eventBatch.length === 0) return;
    
    const batch = [...this.eventBatch];
    this.eventBatch = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    const startTime = performance.now();
    
    try {
      // Group events by priority
      const groupedEvents = this.groupEventsByPriority(batch);
      
      // Process high priority events first
      if (groupedEvents.high.length > 0) {
        await Promise.all(
          groupedEvents.high.map(event => this.processEvent(event))
        );
      }
      
      // Process normal priority events
      if (groupedEvents.normal.length > 0) {
        await Promise.all(
          groupedEvents.normal.map(event => this.processEvent(event))
        );
      }
      
      // Process low priority events
      if (groupedEvents.low.length > 0) {
        await Promise.all(
          groupedEvents.low.map(event => this.processEvent(event))
        );
      }
      
      const latency = performance.now() - startTime;
      logger.debug(`✅ Processed batch of ${batch.length} events in ${latency.toFixed(2)}ms`);
      
    } catch (error) {
      logger.error('❌ Batch processing error:', error);
    }
  }

  // Group events by priority
  groupEventsByPriority(events) {
    const grouped = {
      high: [],
      normal: [],
      low: []
    };
    
    events.forEach(event => {
      const priority = this.getEventPriority(event);
      grouped[priority].push(event);
    });
    
    return grouped;
  }

  // Handle price update events
  async handlePriceUpdate(event) {
    try {
      // Emit to price subscribers
      this.emit('priceUpdate', event.data);
      
      // Update price history
      this.emit('updatePriceHistory', event.data);
      
      // Check for trading signals
      this.emit('checkTradingSignals', event.data);
      
    } catch (error) {
      logger.error('Error handling price update:', error);
    }
  }

  // Handle trade signal events
  async handleTradeSignal(event) {
    try {
      // Emit to trading strategy
      this.emit('executeTrade', event.data);
      
      // Log trade signal
      logger.info(`Trade signal: ${event.data.action} ${event.data.amount} ${event.data.pair}`);
      
    } catch (error) {
      logger.error('Error handling trade signal:', error);
    }
  }

  // Handle emergency stop events
  async handleEmergencyStop(event) {
    try {
      logger.error('🚨 EMERGENCY STOP ACTIVATED:', event.data);
      
      // Emit emergency stop to all components
      this.emit('emergencyStop', event.data);
      
      // Stop all trading activities
      this.emit('stopAllTrading');
      
    } catch (error) {
      logger.error('Error handling emergency stop:', error);
    }
  }

  // Handle MEV attack detection
  async handleMEVAttack(event) {
    try {
      logger.warn('⚠️ MEV attack detected:', event.data);
      
      // Emit MEV protection activation
      this.emit('activateMEVProtection', event.data);
      
      // Implement protection measures
      this.emit('implementMEVProtection', event.data);
      
    } catch (error) {
      logger.error('Error handling MEV attack:', error);
    }
  }

  // Handle circuit breaker events
  async handleCircuitBreaker(event) {
    try {
      logger.warn('🛡️ Circuit breaker triggered:', event.data);
      
      // Emit circuit breaker activation
      this.emit('circuitBreakerActivated', event.data);
      
      // Implement protection measures
      this.emit('implementCircuitBreaker', event.data);
      
    } catch (error) {
      logger.error('Error handling circuit breaker:', error);
    }
  }

  // Optimized WebSocket connection management
  async connectWithRetry(url, handler, priority = 'normal') {
    try {
      const ws = new WebSocket(url, {
        handshakeTimeout: 5000,
        perMessageDeflate: false // Disable compression for lower latency
      });
      
      // Set connection timeout
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          logger.warn(`⏰ Connection timeout for ${url}`);
          ws.terminate();
        }
      }, 5000); // 5 second timeout
      
      this.connectionTimeouts.set(url, timeout);
      
      ws.on('open', () => {
        logger.info(`✅ Connected to WebSocket: ${url}`);
        this.reconnectAttempts.set(url, 0);
        
        // Clear timeout
        if (this.connectionTimeouts.has(url)) {
          clearTimeout(this.connectionTimeouts.get(url));
          this.connectionTimeouts.delete(url);
        }
        
        // Start heartbeat
        this.startHeartbeat(url, ws);
        
        // Store connection
        this.connections.set(url, ws);
      });

      ws.on('message', (data) => {
        const startTime = performance.now();
        
        try {
          const event = this.parseMessage(data, url);
          event.urgent = priority === 'high';
          
          // Add to batch for processing
          this.addToBatch(event);
          
        } catch (error) {
          logger.error(`Error parsing message from ${url}:`, error);
        }
      });

      ws.on('pong', () => {
        this.lastPong.set(url, Date.now());
      });

      ws.on('error', (error) => {
        logger.error(`❌ WebSocket error ${url}:`, error);
        this.handleConnectionError(url, error);
      });

      ws.on('close', (code, reason) => {
        logger.warn(`🔌 WebSocket disconnected: ${url} (${code}: ${reason})`);
        this.cleanupConnection(url);
        this.handleConnectionClose(url);
      });

    } catch (error) {
      logger.error(`Failed to create WebSocket for ${url}:`, error);
      this.handleConnectionError(url, error);
    }
  }

  // Parse incoming messages
  parseMessage(data, source) {
    try {
      const parsed = JSON.parse(data);
      
      // Create event object
      return {
        type: this.determineEventType(parsed, source),
        data: parsed,
        source: source,
        timestamp: Date.now(),
        id: this.generateEventId()
      };
      
    } catch (error) {
      return {
        type: 'PARSE_ERROR',
        data: { raw: data.toString(), error: error.message },
        source: source,
        timestamp: Date.now(),
        id: this.generateEventId()
      };
    }
  }

  // Determine event type from parsed data
  determineEventType(data, source) {
    if (source.includes('binance') && data.s) {
      return 'PRICE_UPDATE';
    }
    if (data.type === 'trade') {
      return 'TRADE_COMPLETED';
    }
    if (data.type === 'signal') {
      return 'TRADE_SIGNAL';
    }
    if (data.type === 'emergency') {
      return 'EMERGENCY_STOP';
    }
    
    return 'UNKNOWN';
  }

  // Generate unique event ID
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start heartbeat monitoring
  startHeartbeat(url, ws) {
    if (this.heartbeatIntervals.has(url)) {
      clearInterval(this.heartbeatIntervals.get(url));
    }
    
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        
        // Check pong response
        setTimeout(() => {
          const lastPongTime = this.lastPong.get(url) || 0;
          const timeSincePong = Date.now() - lastPongTime;
          
          if (timeSincePong > 30000) { // 30 seconds
            logger.warn(`⚠️ No pong received from ${url}, reconnecting...`);
            ws.terminate();
          }
        }, 30000);
      } else {
        clearInterval(heartbeat);
        this.heartbeatIntervals.delete(url);
      }
    }, 30000); // Ping every 30 seconds
    
    this.heartbeatIntervals.set(url, heartbeat);
  }

  // Handle connection errors with exponential backoff
  handleConnectionError(url, error) {
    const attempts = this.reconnectAttempts.get(url) || 0;
    this.reconnectAttempts.set(url, attempts + 1);
    
    if (attempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, attempts) + Math.random() * 1000,
        this.maxReconnectDelay
      );
      
      logger.warn(`Reconnecting to ${url} in ${delay}ms (attempt ${attempts + 1})`);
      
      setTimeout(() => {
        this.connectWithRetry(url, null);
      }, delay);
    } else {
      logger.error(`❌ Max reconnection attempts reached for ${url}`);
      this.emit('CONNECTION_FAILED', { url, error });
    }
  }

  // Handle connection close
  handleConnectionClose(url) {
    this.cleanupConnection(url);
    this.emit('CONNECTION_CLOSED', { url });
  }

  // Cleanup connection resources
  cleanupConnection(url) {
    // Clear heartbeat
    if (this.heartbeatIntervals.has(url)) {
      clearInterval(this.heartbeatIntervals.get(url));
      this.heartbeatIntervals.delete(url);
    }
    
    // Clear timeout
    if (this.connectionTimeouts.has(url)) {
      clearTimeout(this.connectionTimeouts.get(url));
      this.connectionTimeouts.delete(url);
    }
    
    // Remove connection
    this.connections.delete(url);
    this.lastPong.delete(url);
  }

  // Start metrics collection
  startMetricsCollection() {
    setInterval(() => {
      this.updateQueueMetrics();
      this.emitMetrics();
    }, 5000); // Update every 5 seconds
  }

  // Update queue metrics
  updateQueueMetrics() {
    this.metrics.queueSizes = {
      high: this.highPriorityQueue.size,
      normal: this.normalPriorityQueue.size,
      low: this.lowPriorityQueue.size
    };
  }

  // Emit metrics
  emitMetrics() {
    this.emit('metrics', this.getMetrics());
  }

  // Get performance metrics
  getMetrics() {
    const calculatePercentile = (values, percentile) => {
      if (values.length === 0) return 0;
      const sorted = values.sort((a, b) => a - b);
      const index = Math.ceil(sorted.length * percentile / 100) - 1;
      return sorted[index] || 0;
    };

    return {
      processed: this.metrics.processed,
      errors: this.metrics.errors,
      errorRate: this.metrics.processed > 0 ? (this.metrics.errors / this.metrics.processed * 100).toFixed(2) : 0,
      queueSizes: this.metrics.queueSizes,
      latency: {
        high: {
          p50: calculatePercentile(this.metrics.latency.high, 50),
          p95: calculatePercentile(this.metrics.latency.high, 95),
          p99: calculatePercentile(this.metrics.latency.high, 99)
        },
        normal: {
          p50: calculatePercentile(this.metrics.latency.normal, 50),
          p95: calculatePercentile(this.metrics.latency.normal, 95),
          p99: calculatePercentile(this.metrics.latency.normal, 99)
        },
        low: {
          p50: calculatePercentile(this.metrics.latency.low, 50),
          p95: calculatePercentile(this.metrics.latency.low, 95),
          p99: calculatePercentile(this.metrics.latency.low, 99)
        }
      },
      connections: this.connections.size
    };
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('🔄 Shutting down event manager...');
    
    // Clear all timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    // Clear heartbeat intervals
    for (const [url, interval] of this.heartbeatIntervals) {
      clearInterval(interval);
    }
    
    // Clear connection timeouts
    for (const [url, timeout] of this.connectionTimeouts) {
      clearTimeout(timeout);
    }
    
    // Close all WebSocket connections
    for (const [url, ws] of this.connections) {
      ws.close();
    }
    
    // Wait for queues to drain
    await Promise.all([
      this.highPriorityQueue.onIdle(),
      this.normalPriorityQueue.onIdle(),
      this.lowPriorityQueue.onIdle()
    ]);
    
    logger.info('✅ Event manager shutdown completed');
  }
}

module.exports = OptimizedEventManager;

