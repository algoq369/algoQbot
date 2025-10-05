const EventEmitter = require('events');
const WebSocket = require('ws');
const logger = require('../logger');
const config = require('../config');

class EventManager extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map();
    this.priceFeeds = new Map();
    this.isConnected = false;
    this.reconnectAttempts = new Map(); // Track per connection
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000; // 30 seconds max
    
    // WebSocket connections
    this.bnbPriceWS = null;
    this.dexWebSockets = new Map();
    this.heartbeatIntervals = new Map();
    this.lastPong = new Map();
    this.connectionTimeouts = new Map();
    
    // Event queues
    this.eventQueue = [];
    this.processingQueue = false;
    this.maxQueueSize = 10000; // Prevent memory explosion
    
    logger.info('🔄 Event Manager initialized');
  }

  // Initialize WebSocket connections
  async initialize() {
    try {
      await this.connectPriceFeeds();
      await this.connectDexFeeds();
      
      this.isConnected = true;
      this.setupEventHandlers();
      this.startEventProcessing();
      
      logger.info('✅ Event Manager connected and ready');
    } catch (error) {
      logger.error('❌ Error initializing Event Manager:', error);
      throw error;
    }
  }

  // Connect to BNB price feeds with proper management
  async connectPriceFeeds() {
    const priceFeeds = [
      'wss://stream.binance.com:9443/ws/bnbusdt@ticker',
      'wss://stream.binance.com:9443/ws/ethusdt@ticker',
      'wss://stream.binance.com:9443/ws/btcusdt@ticker'
    ];

    for (const feed of priceFeeds) {
      await this.connectWithRetry(feed);
    }
  }

  // Connect with proper error handling and retry logic
  async connectWithRetry(feed) {
    try {
      const ws = new WebSocket(feed);
      
      // Set connection timeout
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          logger.warn(`⏰ Connection timeout for ${feed}`);
          ws.terminate();
        }
      }, 10000); // 10 second timeout
      
      this.connectionTimeouts.set(feed, timeout);
      
      ws.on('open', () => {
        logger.info(`✅ Connected to price feed: ${feed}`);
        this.reconnectAttempts.set(feed, 0);
        
        // Clear timeout
        if (this.connectionTimeouts.has(feed)) {
          clearTimeout(this.connectionTimeouts.get(feed));
          this.connectionTimeouts.delete(feed);
        }
        
        // Start heartbeat
        this.startHeartbeat(feed, ws);
      });

      ws.on('message', (data) => {
        this.handlePriceUpdate(data, feed);
      });

      ws.on('pong', () => {
        this.lastPong.set(feed, Date.now());
        logger.debug(`Pong received from ${feed}`);
      });

      ws.on('error', (error) => {
        logger.error(`❌ Price feed error: ${feed}`, error);
        this.handleConnectionError(feed, error);
      });

      ws.on('close', (code, reason) => {
        logger.warn(`🔌 Price feed disconnected: ${feed} (${code}: ${reason})`);
        this.cleanupConnection(feed);
        this.handleConnectionClose(feed);
      });

      this.priceFeeds.set(feed, ws);
      
    } catch (error) {
      logger.error(`Failed to create WebSocket for ${feed}:`, error);
      this.handleConnectionError(feed, error);
    }
  }

  // Start heartbeat to detect dead connections
  startHeartbeat(feed, ws) {
    // Clear existing heartbeat
    if (this.heartbeatIntervals.has(feed)) {
      clearInterval(this.heartbeatIntervals.get(feed));
    }
    
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        logger.debug(`Ping sent to ${feed}`);
        
        // Check if we received pong within 30 seconds
        setTimeout(() => {
          const lastPongTime = this.lastPong.get(feed) || 0;
          const timeSincePong = Date.now() - lastPongTime;
          
          if (timeSincePong > 30000) { // 30 seconds
            logger.warn(`⚠️ No pong received from ${feed} in 30s, reconnecting...`);
            ws.terminate();
          }
        }, 30000);
      } else {
        clearInterval(heartbeat);
        this.heartbeatIntervals.delete(feed);
      }
    }, 30000); // Ping every 30 seconds
    
    this.heartbeatIntervals.set(feed, heartbeat);
  }

  // Cleanup connection resources
  cleanupConnection(feed) {
    // Clear heartbeat
    if (this.heartbeatIntervals.has(feed)) {
      clearInterval(this.heartbeatIntervals.get(feed));
      this.heartbeatIntervals.delete(feed);
    }
    
    // Clear timeout
    if (this.connectionTimeouts.has(feed)) {
      clearTimeout(this.connectionTimeouts.get(feed));
      this.connectionTimeouts.delete(feed);
    }
    
    // Remove from maps
    this.priceFeeds.delete(feed);
    this.lastPong.delete(feed);
  }

  // Connect to DEX WebSocket feeds
  async connectDexFeeds() {
    // PancakeSwap WebSocket (if available)
    const pancakeWS = 'wss://api.pancakeswap.finance/api/v1/ws';
    
    try {
      const ws = new WebSocket(pancakeWS);
      
      ws.on('open', () => {
        logger.info('✅ Connected to PancakeSwap WebSocket');
      });

      ws.on('message', (data) => {
        this.handleDexUpdate(data, 'pancakeswap');
      });

      ws.on('error', (error) => {
        logger.warn('PancakeSwap WebSocket error:', error);
      });

      this.dexWebSockets.set('pancakeswap', ws);
    } catch (error) {
      logger.warn('PancakeSwap WebSocket not available:', error.message);
    }
  }

  // Handle price updates from WebSocket
  handlePriceUpdate(data, feed) {
    try {
      const ticker = JSON.parse(data);
      const symbol = ticker.s || ticker.symbol;
      const price = parseFloat(ticker.c || ticker.lastPrice);
      
      if (symbol && price) {
        const event = {
          type: 'PRICE_UPDATE',
          symbol: symbol.toLowerCase(),
          price: price,
          timestamp: Date.now(),
          source: 'binance',
          feed: feed
        };

        this.emitEvent(event);
      }
    } catch (error) {
      logger.error('Error parsing price update:', error);
    }
  }

  // Handle DEX updates
  handleDexUpdate(data, dex) {
    try {
      const update = JSON.parse(data);
      
      const event = {
        type: 'DEX_UPDATE',
        dex: dex,
        data: update,
        timestamp: Date.now()
      };

      this.emitEvent(event);
    } catch (error) {
      logger.error(`Error parsing ${dex} update:`, error);
    }
  }

  // Emit event to all subscribers
  emitEvent(event) {
    // Add to queue for processing
    this.eventQueue.push(event);
    
    // Emit to subscribers
    this.emit(event.type, event);
    
    // Emit to specific symbol subscribers
    if (event.symbol) {
      this.emit(`PRICE_${event.symbol.toUpperCase()}`, event);
    }
  }

  // Subscribe to specific events
  subscribe(eventType, callback, filter = null) {
    const subscription = {
      id: Date.now() + Math.random(),
      callback,
      filter,
      active: true
    };

    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Map());
    }

    this.subscribers.get(eventType).set(subscription.id, subscription);
    
    logger.debug(`New subscription: ${eventType} (ID: ${subscription.id})`);
    
    return subscription.id;
  }

  // Unsubscribe from events
  unsubscribe(eventType, subscriptionId) {
    if (this.subscribers.has(eventType)) {
      this.subscribers.get(eventType).delete(subscriptionId);
      logger.debug(`Unsubscribed: ${eventType} (ID: ${subscriptionId})`);
    }
  }

  // Start event processing queue
  startEventProcessing() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    this.processEventQueue();
  }

  // Process event queue
  async processEventQueue() {
    while (this.processingQueue && this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      
      try {
        // Process event with subscribers
        const subscribers = this.subscribers.get(event.type);
        if (subscribers) {
          for (const [id, subscription] of subscribers) {
            if (subscription.active) {
              try {
                // Apply filter if provided
                if (!subscription.filter || subscription.filter(event)) {
                  await subscription.callback(event);
                }
              } catch (error) {
                logger.error(`Error in event callback (${id}):`, error);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error processing event:', error);
      }
    }

    // Continue processing
    if (this.processingQueue) {
      setTimeout(() => this.processEventQueue(), 10);
    }
  }

  // Setup event handlers
  setupEventHandlers() {
    // Handle system events
    this.on('SYSTEM_START', (event) => {
      logger.info('🚀 System start event received');
    });

    this.on('SYSTEM_STOP', (event) => {
      logger.info('🛑 System stop event received');
      this.cleanup();
    });

    // Handle trading events
    this.on('TRADE_EXECUTED', (event) => {
      logger.info(`💰 Trade executed: ${event.pair} ${event.action} ${event.amount}`);
    });

    this.on('TRADE_FAILED', (event) => {
      logger.error(`❌ Trade failed: ${event.pair} ${event.action} - ${event.error}`);
    });

    // Handle risk events
    this.on('RISK_LIMIT_EXCEEDED', (event) => {
      logger.error(`🚨 Risk limit exceeded: ${event.type} - ${event.value}`);
    });

    this.on('EMERGENCY_STOP', (event) => {
      logger.error('🚨 EMERGENCY STOP ACTIVATED');
      this.emit('SYSTEM_STOP', { reason: 'emergency_stop' });
    });
  }

  // Handle connection errors with exponential backoff
  handleConnectionError(feed, error) {
    const attempts = this.reconnectAttempts.get(feed) || 0;
    this.reconnectAttempts.set(feed, attempts + 1);
    
    if (attempts < this.maxReconnectAttempts) {
      // Exponential backoff with jitter
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, attempts) + Math.random() * 1000,
        this.maxReconnectDelay
      );
      
      logger.warn(`Reconnecting to ${feed} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.reconnect(feed);
      }, delay);
    } else {
      logger.error(`Max reconnection attempts reached for ${feed}`);
      this.emit('CONNECTION_FAILED', { feed, error });
    }
  }

  // Handle connection close
  handleConnectionClose(feed) {
    logger.warn(`Connection closed: ${feed}`);
    this.emit('CONNECTION_CLOSED', { feed });
  }

  // Reconnect to feed
  async reconnect(feed) {
    try {
      if (this.priceFeeds.has(feed)) {
        this.priceFeeds.get(feed).terminate();
      }
      
      await this.connectPriceFeeds();
      logger.info(`✅ Reconnected to ${feed}`);
    } catch (error) {
      logger.error(`Failed to reconnect to ${feed}:`, error);
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      priceFeeds: Array.from(this.priceFeeds.keys()).map(feed => ({
        feed,
        readyState: this.priceFeeds.get(feed)?.readyState
      })),
      dexWebSockets: Array.from(this.dexWebSockets.keys()).map(dex => ({
        dex,
        readyState: this.dexWebSockets.get(dex)?.readyState
      })),
      subscribers: Array.from(this.subscribers.keys()).map(eventType => ({
        eventType,
        count: this.subscribers.get(eventType).size
      })),
      queueSize: this.eventQueue.length
    };
  }

  // Cleanup connections
  cleanup() {
    this.processingQueue = false;
    
    // Close price feeds
    for (const [feed, ws] of this.priceFeeds) {
      ws.close();
    }
    
    // Close DEX WebSockets
    for (const [dex, ws] of this.dexWebSockets) {
      ws.close();
    }
    
    logger.info('🧹 Event Manager cleaned up');
  }

  // Publish custom event
  publish(eventType, data) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now()
    };
    
    this.emitEvent(event);
  }

  // Get event statistics
  getEventStats() {
    return {
      totalSubscribers: Array.from(this.subscribers.values())
        .reduce((total, subs) => total + subs.size, 0),
      activeConnections: this.priceFeeds.size + this.dexWebSockets.size,
      queueSize: this.eventQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

module.exports = EventManager;
