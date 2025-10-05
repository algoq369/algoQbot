const WebSocket = require('ws');
const logger = require('../logger');

class CleanWebSocketManager {
  constructor() {
    this.connections = new Map();
    this.listeners = new WeakMap(); // Auto-cleanup for listeners
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    
    // Heartbeat management
    this.heartbeatIntervals = new Map();
    this.lastPong = new Map();
    this.connectionTimeouts = new Map();
    
    logger.info('🚀 Clean WebSocket Manager initialized');
  }

  // CRITICAL: Clean connection with proper listener management
  async connect(url, handler, options = {}) {
    // Cleanup old connection if exists
    await this.disconnect(url);
    
    try {
      const ws = new WebSocket(url, {
        handshakeTimeout: options.timeout || 5000,
        perMessageDeflate: false, // Disable compression for lower latency
        ...options
      });
      
      // Store listeners for cleanup
      const listeners = {
        onMessage: (data) => this.handleMessage(data, handler, url),
        onClose: (code, reason) => this.handleClose(url, handler, code, reason),
        onError: (error) => this.handleError(url, error),
        onPong: () => this.handlePong(url),
        onOpen: () => this.handleOpen(url, handler)
      };
      
      // Attach listeners
      ws.on('message', listeners.onMessage);
      ws.on('close', listeners.onClose);
      ws.on('error', listeners.onError);
      ws.on('pong', listeners.onPong);
      ws.on('open', listeners.onOpen);
      
      // Store listeners for cleanup (WeakMap auto-cleanup)
      this.listeners.set(ws, listeners);
      this.connections.set(url, ws);
      
      // Set connection timeout
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          logger.warn(`⏰ Connection timeout for ${url}`);
          ws.terminate();
        }
      }, options.timeout || 5000);
      
      this.connectionTimeouts.set(url, timeout);
      
      logger.info(`🔄 Connecting to WebSocket: ${url}`);
      return ws;
      
    } catch (error) {
      logger.error(`Failed to create WebSocket for ${url}:`, error);
      throw error;
    }
  }

  // CRITICAL: Clean disconnection with listener removal
  async disconnect(url) {
    const ws = this.connections.get(url);
    if (!ws) {
      return;
    }
    
    try {
      // Remove all listeners first
      const listeners = this.listeners.get(ws);
      if (listeners) {
        ws.off('message', listeners.onMessage);
        ws.off('close', listeners.onClose);
        ws.off('error', listeners.onError);
        ws.off('pong', listeners.onPong);
        ws.off('open', listeners.onOpen);
        
        // Clear from WeakMap (automatic)
        this.listeners.delete(ws);
      }
      
      // Clear heartbeat interval
      if (this.heartbeatIntervals.has(url)) {
        clearInterval(this.heartbeatIntervals.get(url));
        this.heartbeatIntervals.delete(url);
      }
      
      // Clear connection timeout
      if (this.connectionTimeouts.has(url)) {
        clearTimeout(this.connectionTimeouts.get(url));
        this.connectionTimeouts.delete(url);
      }
      
      // Close connection if still open
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Normal closure');
      }
      
      // Clean up tracking data
      this.connections.delete(url);
      this.lastPong.delete(url);
      this.reconnectAttempts.delete(url);
      
      logger.info(`✅ Disconnected from WebSocket: ${url}`);
      
    } catch (error) {
      logger.error(`Error disconnecting from ${url}:`, error);
    }
  }

  // Handle WebSocket open event
  handleOpen(url, handler) {
    logger.info(`✅ WebSocket connected: ${url}`);
    this.reconnectAttempts.set(url, 0);
    
    // Clear connection timeout
    if (this.connectionTimeouts.has(url)) {
      clearTimeout(this.connectionTimeouts.get(url));
      this.connectionTimeouts.delete(url);
    }
    
    // Start heartbeat
    this.startHeartbeat(url);
    
    // Notify handler
    if (handler && handler.onOpen) {
      handler.onOpen(url);
    }
  }

  // Handle WebSocket message with error protection
  handleMessage(data, handler, url) {
    try {
      if (handler && handler.onMessage) {
        handler.onMessage(data, url);
      }
    } catch (error) {
      logger.error(`Error handling message from ${url}:`, error);
    }
  }

  // Handle WebSocket close with reconnection logic
  handleClose(url, handler, code, reason) {
    logger.warn(`🔌 WebSocket disconnected: ${url} (${code}: ${reason})`);
    
    // Cleanup resources
    this.cleanupConnection(url);
    
    // Notify handler
    if (handler && handler.onClose) {
      handler.onClose(url, code, reason);
    }
    
    // Attempt reconnection if not a normal closure
    if (code !== 1000) {
      this.handleReconnection(url, handler);
    }
  }

  // Handle WebSocket error
  handleError(url, error) {
    logger.error(`❌ WebSocket error ${url}:`, error);
    
    // Notify handler
    const ws = this.connections.get(url);
    if (ws) {
      const listeners = this.listeners.get(ws);
      if (listeners && listeners.onError) {
        listeners.onError(error);
      }
    }
  }

  // Handle pong response
  handlePong(url) {
    this.lastPong.set(url, Date.now());
    logger.debug(`Pong received from ${url}`);
  }

  // Start heartbeat monitoring with cleanup
  startHeartbeat(url) {
    // Clear existing heartbeat
    if (this.heartbeatIntervals.has(url)) {
      clearInterval(this.heartbeatIntervals.get(url));
    }
    
    const heartbeat = setInterval(() => {
      const ws = this.connections.get(url);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeat);
        this.heartbeatIntervals.delete(url);
        return;
      }
      
      ws.ping();
      logger.debug(`Ping sent to ${url}`);
      
      // Check if we received pong within 30 seconds
      setTimeout(() => {
        const lastPongTime = this.lastPong.get(url) || 0;
        const timeSincePong = Date.now() - lastPongTime;
        
        if (timeSincePong > 30000) { // 30 seconds
          logger.warn(`⚠️ No pong received from ${url} in 30s, reconnecting...`);
          ws.terminate();
        }
      }, 30000);
      
    }, 30000); // Ping every 30 seconds
    
    this.heartbeatIntervals.set(url, heartbeat);
  }

  // Handle reconnection with exponential backoff
  async handleReconnection(url, handler) {
    const attempts = this.reconnectAttempts.get(url) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error(`❌ Max reconnection attempts reached for ${url}`);
      return;
    }
    
    this.reconnectAttempts.set(url, attempts + 1);
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, attempts) + Math.random() * 1000,
      this.maxReconnectDelay
    );
    
    logger.warn(`Reconnecting to ${url} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect(url, handler);
      } catch (error) {
        logger.error(`Reconnection failed for ${url}:`, error);
      }
    }, delay);
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
    
    // Remove from tracking
    this.lastPong.delete(url);
  }

  // Get connection status
  getConnectionStatus(url) {
    const ws = this.connections.get(url);
    if (!ws) {
      return { connected: false, state: 'not_connected' };
    }
    
    const stateMap = {
      [WebSocket.CONNECTING]: 'connecting',
      [WebSocket.OPEN]: 'open',
      [WebSocket.CLOSING]: 'closing',
      [WebSocket.CLOSED]: 'closed'
    };
    
    return {
      connected: ws.readyState === WebSocket.OPEN,
      state: stateMap[ws.readyState] || 'unknown',
      reconnectAttempts: this.reconnectAttempts.get(url) || 0,
      lastPong: this.lastPong.get(url) || 0
    };
  }

  // Get all connection statuses
  getAllConnectionStatuses() {
    const statuses = {};
    for (const url of this.connections.keys()) {
      statuses[url] = this.getConnectionStatus(url);
    }
    return statuses;
  }

  // Get manager statistics
  getStats() {
    const totalConnections = this.connections.size;
    const connectedCount = Array.from(this.connections.values())
      .filter(ws => ws.readyState === WebSocket.OPEN).length;
    
    return {
      totalConnections: totalConnections,
      connectedConnections: connectedCount,
      disconnectedConnections: totalConnections - connectedCount,
      heartbeatIntervals: this.heartbeatIntervals.size,
      pendingTimeouts: this.connectionTimeouts.size,
      reconnectAttempts: Object.fromEntries(this.reconnectAttempts)
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthyConnections = stats.connectedConnections;
    const totalConnections = stats.totalConnections;
    
    const healthy = totalConnections === 0 || (healthyConnections / totalConnections) > 0.5;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      stats: stats,
      healthRatio: totalConnections > 0 ? (healthyConnections / totalConnections * 100).toFixed(2) : 0
    };
  }

  // CRITICAL: Graceful shutdown with proper cleanup
  async shutdown() {
    logger.info('🔄 Shutting down WebSocket manager...');
    
    try {
      // Disconnect all connections
      const disconnectPromises = Array.from(this.connections.keys())
        .map(url => this.disconnect(url));
      
      await Promise.all(disconnectPromises);
      
      // Clear all intervals and timeouts
      for (const interval of this.heartbeatIntervals.values()) {
        clearInterval(interval);
      }
      
      for (const timeout of this.connectionTimeouts.values()) {
        clearTimeout(timeout);
      }
      
      // Clear all maps
      this.connections.clear();
      this.heartbeatIntervals.clear();
      this.connectionTimeouts.clear();
      this.lastPong.clear();
      this.reconnectAttempts.clear();
      
      logger.info('✅ WebSocket manager shutdown completed');
      
    } catch (error) {
      logger.error('Error during WebSocket manager shutdown:', error);
      throw error;
    }
  }

  // Force cleanup (for testing)
  forceCleanup() {
    // Force close all connections
    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.terminate();
      }
    }
    
    // Clear all resources
    this.connections.clear();
    this.heartbeatIntervals.clear();
    this.connectionTimeouts.clear();
    this.lastPong.clear();
    this.reconnectAttempts.clear();
    
    logger.info('✅ Force cleanup completed');
  }
}

module.exports = CleanWebSocketManager;

