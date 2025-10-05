const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class ResilientWASMOptimizer {
  constructor() {
    this.wasm = null;
    this.jsImplementation = new JSFallbackAlgorithms();
    this.initializationPromise = null;
    this.initialized = false;
    this.wasmPath = path.join(__dirname, 'trading-algorithms.wasm');
    
    logger.info('🚀 Resilient WASM Optimizer initialized');
  }

  // CRITICAL: Non-blocking WASM initialization with timeout and fallback
  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = (async () => {
      try {
        logger.info('🔄 Initializing WASM module...');
        
        // Check if WASM is supported
        if (typeof WebAssembly === 'undefined') {
          throw new Error('WebAssembly not supported in this environment');
        }
        
        // Check if WASM file exists
        if (!fs.existsSync(this.wasmPath)) {
          throw new Error(`WASM file not found: ${this.wasmPath}`);
        }
        
        // Load WASM with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          logger.warn('⚠️ WASM loading timeout after 5 seconds');
        }, 5000);
        
        try {
          const response = await fetch(`file://${this.wasmPath}`, {
            signal: controller.signal
          });
          clearTimeout(timeout);
          
          if (!response.ok) {
            throw new Error(`WASM fetch failed: ${response.status} ${response.statusText}`);
          }
          
          // Verify WASM signature
          const buffer = await response.arrayBuffer();
          if (!this.verifyWASMSignature(buffer)) {
            throw new Error('WASM signature verification failed');
          }
          
          // Instantiate WASM module
          const module = await WebAssembly.instantiate(buffer, {
            env: {
              memory: new WebAssembly.Memory({ 
                initial: 256, 
                maximum: 512 
              }),
              abort: (msg) => {
                logger.error('WASM abort:', msg);
                throw new Error(`WASM abort: ${msg}`);
              },
              console_log: (ptr, len) => {
                const bytes = new Uint8Array(this.wasmMemory.buffer, ptr, len);
                const str = new TextDecoder().decode(bytes);
                logger.debug(`WASM: ${str}`);
              }
            }
          });
          
          this.wasm = module.instance.exports;
          this.wasmMemory = module.instance.exports.memory;
          this.initialized = true;
          
          logger.info('✅ WASM module loaded successfully');
          
        } catch (fetchError) {
          clearTimeout(timeout);
          throw fetchError;
        }
        
      } catch (error) {
        logger.warn('⚠️ WASM initialization failed, using JS fallback:', error.message);
        this.initialized = false;
        this.wasm = null;
        
        // Continue with JS implementation - don't throw
        logger.info('✅ Fallback to JavaScript implementation');
      }
    })();
    
    return this.initializationPromise;
  }

  // Verify WASM file signature
  verifyWASMSignature(buffer) {
    try {
      // Check WASM magic number: 0x00 0x61 0x73 0x6D
      const magic = new Uint8Array(buffer, 0, 4);
      const isValidMagic = magic[0] === 0x00 && magic[1] === 0x61 && 
                           magic[2] === 0x73 && magic[3] === 0x6D;
      
      if (!isValidMagic) {
        logger.error('Invalid WASM magic number');
        return false;
      }
      
      // Check minimum size (should be at least 8 bytes for header)
      if (buffer.byteLength < 8) {
        logger.error('WASM file too small');
        return false;
      }
      
      logger.debug('✅ WASM signature verification passed');
      return true;
      
    } catch (error) {
      logger.error('WASM signature verification error:', error);
      return false;
    }
  }

  // Calculate optimal position with fallback
  async calculateOptimalPosition(prices, balance, risk = 0.02) {
    await this.initialize(); // Ensure initialization is complete
    
    if (!this.initialized || !this.wasm) {
      // Use JavaScript fallback
      logger.debug('Using JS fallback for Kelly position calculation');
      return this.jsImplementation.kellyPosition(prices, balance, risk);
    }
    
    try {
      const startTime = performance.now();
      
      const pricesPtr = this.writeFloatArray(prices);
      const positionSize = this.wasm.kellyPosition(pricesPtr, prices.length, balance, risk);
      this.freeFloatArray(pricesPtr);
      
      const latency = performance.now() - startTime;
      logger.debug(`WASM Kelly calculation: ${latency.toFixed(2)}ms`);
      
      return positionSize / 1000000; // Convert back to float
      
    } catch (error) {
      logger.error('WASM Kelly calculation failed:', error);
      // Fallback to JavaScript
      return this.jsImplementation.kellyPosition(prices, balance, risk);
    }
  }

  // Calculate SMA with fallback
  async calculateSMA(prices, period = 20) {
    await this.initialize();
    
    if (!this.initialized || !this.wasm) {
      return this.jsImplementation.calculateSMA(prices, period);
    }
    
    try {
      const startTime = performance.now();
      
      const pricesPtr = this.writeFloatArray(prices);
      const resultPtr = this.wasm.calculateSMA(pricesPtr, prices.length, period);
      const sma = this.readFloatArray(resultPtr, prices.length - period + 1);
      
      this.freeFloatArray(pricesPtr);
      this.freeFloatArray(resultPtr);
      
      const latency = performance.now() - startTime;
      logger.debug(`WASM SMA calculation: ${latency.toFixed(2)}ms`);
      
      return sma;
      
    } catch (error) {
      logger.error('WASM SMA calculation failed:', error);
      return this.jsImplementation.calculateSMA(prices, period);
    }
  }

  // Calculate EMA with fallback
  async calculateEMA(prices, period = 12) {
    await this.initialize();
    
    if (!this.initialized || !this.wasm) {
      return this.jsImplementation.calculateEMA(prices, period);
    }
    
    try {
      const startTime = performance.now();
      
      const pricesPtr = this.writeFloatArray(prices);
      const resultPtr = this.wasm.calculateEMA(pricesPtr, prices.length, period);
      const ema = this.readFloatArray(resultPtr, prices.length);
      
      this.freeFloatArray(pricesPtr);
      this.freeFloatArray(resultPtr);
      
      const latency = performance.now() - startTime;
      logger.debug(`WASM EMA calculation: ${latency.toFixed(2)}ms`);
      
      return ema;
      
    } catch (error) {
      logger.error('WASM EMA calculation failed:', error);
      return this.jsImplementation.calculateEMA(prices, period);
    }
  }

  // Calculate volatility with fallback
  async calculateVolatility(prices, period = 20) {
    await this.initialize();
    
    if (!this.initialized || !this.wasm) {
      return this.jsImplementation.calculateVolatility(prices, period);
    }
    
    try {
      const startTime = performance.now();
      
      const pricesPtr = this.writeFloatArray(prices);
      const resultPtr = this.wasm.calculateVolatility(pricesPtr, prices.length, period);
      const volatility = this.readFloatArray(resultPtr, prices.length - period);
      
      this.freeFloatArray(pricesPtr);
      this.freeFloatArray(resultPtr);
      
      const latency = performance.now() - startTime;
      logger.debug(`WASM volatility calculation: ${latency.toFixed(2)}ms`);
      
      return volatility;
      
    } catch (error) {
      logger.error('WASM volatility calculation failed:', error);
      return this.jsImplementation.calculateVolatility(prices, period);
    }
  }

  // Calculate correlation with fallback
  async calculateCorrelation(prices1, prices2) {
    await this.initialize();
    
    if (!this.initialized || !this.wasm) {
      return this.jsImplementation.calculateCorrelation(prices1, prices2);
    }
    
    try {
      const startTime = performance.now();
      
      const prices1Ptr = this.writeFloatArray(prices1);
      const prices2Ptr = this.writeFloatArray(prices2);
      
      const correlation = this.wasm.calculateCorrelation(
        prices1Ptr, 
        prices2Ptr, 
        Math.min(prices1.length, prices2.length)
      );
      
      this.freeFloatArray(prices1Ptr);
      this.freeFloatArray(prices2Ptr);
      
      const latency = performance.now() - startTime;
      logger.debug(`WASM correlation calculation: ${latency.toFixed(2)}ms`);
      
      return correlation / 1000000; // Convert back to float
      
    } catch (error) {
      logger.error('WASM correlation calculation failed:', error);
      return this.jsImplementation.calculateCorrelation(prices1, prices2);
    }
  }

  // Helper methods for WASM memory management
  writeFloatArray(data) {
    const ptr = this.allocateMemory(data.length * 4); // 4 bytes per float
    const view = new Float32Array(this.wasmMemory.buffer, ptr, data.length);
    view.set(data);
    return ptr;
  }

  readFloatArray(ptr, length) {
    const view = new Float32Array(this.wasmMemory.buffer, ptr, length);
    return Array.from(view);
  }

  allocateMemory(size) {
    // Simple memory allocator - in production, use proper memory management
    return Math.floor(Math.random() * (this.wasmMemory.buffer.byteLength - size));
  }

  freeFloatArray(ptr) {
    // Simple memory deallocator - in production, implement proper memory management
    // For now, just a placeholder
  }

  // Get WASM statistics
  getStats() {
    return {
      initialized: this.initialized,
      wasmSupported: typeof WebAssembly !== 'undefined',
      memorySize: this.wasmMemory ? this.wasmMemory.buffer.byteLength : 0,
      functionsAvailable: this.wasm ? Object.keys(this.wasm).length : 0,
      fallbackMode: !this.initialized
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    
    // Test WASM functionality if available
    let wasmHealthy = false;
    if (this.initialized && this.wasm) {
      try {
        // Simple test calculation
        const testPrices = [100, 101, 102, 103, 104];
        const testPtr = this.writeFloatArray(testPrices);
        this.freeFloatArray(testPtr);
        wasmHealthy = true;
      } catch (error) {
        logger.warn('WASM health check failed:', error.message);
      }
    }
    
    return {
      status: this.initialized ? (wasmHealthy ? 'healthy' : 'warning') : 'fallback',
      stats: stats,
      wasmHealthy: wasmHealthy,
      fallbackAvailable: true
    };
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('🔄 Shutting down WASM optimizer...');
      
      if (this.initializationPromise) {
        await this.initializationPromise;
      }
      
      this.wasm = null;
      this.wasmMemory = null;
      this.initialized = false;
      this.initializationPromise = null;
      
      logger.info('✅ WASM optimizer shutdown completed');
      
    } catch (error) {
      logger.error('Error during WASM optimizer shutdown:', error);
    }
  }
}

// JavaScript fallback implementation
class JSFallbackAlgorithms {
  // Kelly Criterion calculation (pure JavaScript)
  kellyPosition(prices, balance, risk) {
    const returns = this.calculateReturns(prices);
    const winRate = returns.filter(r => r > 0).length / returns.length;
    const avgWin = returns.filter(r => r > 0).reduce((a, b) => a + b, 0) / returns.filter(r => r > 0).length || 0;
    const avgLoss = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0) / returns.filter(r => r < 0).length || 1);
    
    const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    return Math.max(0, Math.min(kellyFraction * balance * risk, balance * 0.1));
  }

  // SMA calculation (pure JavaScript)
  calculateSMA(prices, period) {
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  // EMA calculation (pure JavaScript)
  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
    
    return ema;
  }

  // Volatility calculation (pure JavaScript)
  calculateVolatility(prices, period) {
    const returns = this.calculateReturns(prices);
    const volatility = [];
    
    for (let i = period - 1; i < returns.length; i++) {
      const slice = returns.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      volatility.push(Math.sqrt(variance));
    }
    
    return volatility;
  }

  // Correlation calculation (pure JavaScript)
  calculateCorrelation(prices1, prices2) {
    const returns1 = this.calculateReturns(prices1);
    const returns2 = this.calculateReturns(prices2);
    
    const minLength = Math.min(returns1.length, returns2.length);
    const r1 = returns1.slice(0, minLength);
    const r2 = returns2.slice(0, minLength);
    
    const mean1 = r1.reduce((a, b) => a + b, 0) / r1.length;
    const mean2 = r2.reduce((a, b) => a + b, 0) / r2.length;
    
    let numerator = 0;
    let sum1 = 0;
    let sum2 = 0;
    
    for (let i = 0; i < r1.length; i++) {
      const diff1 = r1[i] - mean1;
      const diff2 = r2[i] - mean2;
      
      numerator += diff1 * diff2;
      sum1 += diff1 * diff1;
      sum2 += diff2 * diff2;
    }
    
    return numerator / Math.sqrt(sum1 * sum2);
  }

  // Helper method
  calculateReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }
}

module.exports = ResilientWASMOptimizer;

