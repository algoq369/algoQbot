const crypto = require('crypto');
const logger = require('../logger');

class BinaryProtocolManager {
  constructor() {
    // Protocol constants
    this.MAGIC_NUMBER = 0xDEADBEEF;
    this.VERSION = 1;
    this.HEADER_SIZE = 16; // 4 + 1 + 1 + 2 + 4 + 4 bytes
    
    // Message types
    this.MESSAGE_TYPES = {
      PRICE_UPDATE: 0x01,
      TRADE_SIGNAL: 0x02,
      ORDER_UPDATE: 0x03,
      BALANCE_UPDATE: 0x04,
      HEARTBEAT: 0x05,
      ERROR: 0x06,
      ACK: 0x07,
      MARKET_DATA: 0x08,
      ANALYTICS: 0x09,
      EMERGENCY_STOP: 0x0A
    };
    
    // Priority levels
    this.PRIORITIES = {
      LOW: 0x00,
      NORMAL: 0x01,
      HIGH: 0x02,
      CRITICAL: 0x03
    };
    
    // Compression types
    this.COMPRESSION = {
      NONE: 0x00,
      GZIP: 0x01,
      LZ4: 0x02
    };
    
    this.compressionEnabled = true;
    this.encryptionEnabled = false;
    this.encryptionKey = null;
    
    logger.info('🚀 Binary Protocol Manager initialized');
  }

  // Encode trade data to binary (10x faster than JSON)
  encodeTrade(trade) {
    const startTime = performance.now();
    
    try {
      // Calculate buffer size
      const pairLength = trade.pair ? Buffer.byteLength(trade.pair, 'utf8') : 0;
      const metadataLength = trade.metadata ? JSON.stringify(trade.metadata).length : 0;
      const totalSize = this.HEADER_SIZE + 32 + pairLength + metadataLength; // 32 bytes for trade data
      
      const buffer = Buffer.allocUnsafe(totalSize);
      let offset = 0;
      
      // Header (16 bytes)
      buffer.writeUInt32BE(this.MAGIC_NUMBER, offset); offset += 4; // Magic number
      buffer.writeUInt8(this.VERSION, offset); offset += 1; // Version
      buffer.writeUInt8(this.MESSAGE_TYPES.ORDER_UPDATE, offset); offset += 1; // Message type
      buffer.writeUInt8(this.PRIORITIES.NORMAL, offset); offset += 1; // Priority
      buffer.writeUInt8(this.COMPRESSION.NONE, offset); offset += 1; // Compression
      buffer.writeUInt16BE(totalSize - this.HEADER_SIZE, offset); offset += 2; // Payload size
      buffer.writeUInt32BE(Date.now(), offset); offset += 4; // Timestamp
      buffer.writeUInt32BE(0, offset); offset += 4; // Reserved/checksum
      
      // Trade data (32 bytes)
      buffer.writeBigInt64BE(BigInt(trade.timestamp || Date.now()), offset); offset += 8; // Timestamp
      buffer.writeBigInt64BE(BigInt(Math.floor((trade.price || 0) * 1000000)), offset); offset += 8; // Price (micro-units)
      buffer.writeBigInt64BE(BigInt(Math.floor((trade.amount || 0) * 1000000)), offset); offset += 8; // Amount (micro-units)
      buffer.writeUInt32BE(trade.orderId || 0, offset); offset += 4; // Order ID
      buffer.writeUInt8(trade.side === 'buy' ? 1 : 0, offset); offset += 1; // Side
      buffer.writeUInt8(trade.status === 'pending' ? 0 : trade.status === 'filled' ? 1 : 2, offset); offset += 1; // Status
      buffer.writeUInt8(trade.pair ? pairLength : 0, offset); offset += 1; // Pair length
      buffer.writeUInt8(0, offset); offset += 1; // Reserved
      
      // Variable length data
      if (trade.pair && pairLength > 0) {
        buffer.write(trade.pair, offset, 'utf8'); offset += pairLength;
      }
      
      if (trade.metadata && metadataLength > 0) {
        const metadataStr = JSON.stringify(trade.metadata);
        buffer.writeUInt32BE(metadataLength, offset); offset += 4;
        buffer.write(metadataStr, offset, 'utf8'); offset += metadataLength;
      }
      
      // Calculate and write checksum
      const checksum = this.calculateChecksum(buffer.slice(0, offset));
      buffer.writeUInt32BE(checksum, 12); // Write checksum in header
      
      const latency = performance.now() - startTime;
      logger.debug(`Trade encoded in ${latency.toFixed(2)}ms, size: ${offset} bytes`);
      
      return buffer.slice(0, offset);
      
    } catch (error) {
      logger.error('Error encoding trade:', error);
      throw error;
    }
  }

  // Decode trade data from binary
  decodeTrade(buffer) {
    const startTime = performance.now();
    
    try {
      let offset = 0;
      
      // Validate header
      const magic = buffer.readUInt32BE(offset); offset += 4;
      if (magic !== this.MAGIC_NUMBER) {
        throw new Error('Invalid magic number');
      }
      
      const version = buffer.readUInt8(offset); offset += 1;
      const messageType = buffer.readUInt8(offset); offset += 1;
      const priority = buffer.readUInt8(offset); offset += 1;
      const compression = buffer.readUInt8(offset); offset += 1;
      const payloadSize = buffer.readUInt16BE(offset); offset += 2;
      const timestamp = buffer.readUInt32BE(offset); offset += 4;
      const checksum = buffer.readUInt32BE(offset); offset += 4;
      
      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(buffer.slice(0, offset - 4));
      if (checksum !== calculatedChecksum) {
        throw new Error('Checksum mismatch');
      }
      
      // Decode trade data
      const tradeTimestamp = Number(buffer.readBigInt64BE(offset)); offset += 8;
      const price = Number(buffer.readBigInt64BE(offset)) / 1000000; offset += 8;
      const amount = Number(buffer.readBigInt64BE(offset)) / 1000000; offset += 8;
      const orderId = buffer.readUInt32BE(offset); offset += 4;
      const side = buffer.readUInt8(offset) === 1 ? 'buy' : 'sell'; offset += 1;
      const statusCode = buffer.readUInt8(offset); offset += 1;
      const pairLength = buffer.readUInt8(offset); offset += 1;
      offset += 1; // Reserved
      
      const statusMap = ['pending', 'filled', 'cancelled'];
      const status = statusMap[statusCode] || 'unknown';
      
      // Decode variable length data
      let pair = null;
      if (pairLength > 0) {
        pair = buffer.toString('utf8', offset, offset + pairLength);
        offset += pairLength;
      }
      
      let metadata = null;
      if (offset < buffer.length) {
        const metadataLength = buffer.readUInt32BE(offset); offset += 4;
        if (metadataLength > 0) {
          const metadataStr = buffer.toString('utf8', offset, offset + metadataLength);
          metadata = JSON.parse(metadataStr);
        }
      }
      
      const latency = performance.now() - startTime;
      logger.debug(`Trade decoded in ${latency.toFixed(2)}ms`);
      
      return {
        timestamp: tradeTimestamp,
        price: price,
        amount: amount,
        orderId: orderId,
        side: side,
        status: status,
        pair: pair,
        metadata: metadata,
        header: {
          version: version,
          messageType: messageType,
          priority: priority,
          compression: compression,
          timestamp: timestamp
        }
      };
      
    } catch (error) {
      logger.error('Error decoding trade:', error);
      throw error;
    }
  }

  // Encode price update (ultra-fast)
  encodePriceUpdate(priceData) {
    const startTime = performance.now();
    
    try {
      const pairLength = Buffer.byteLength(priceData.pair, 'utf8');
      const totalSize = this.HEADER_SIZE + 24 + pairLength; // 24 bytes for price data
      
      const buffer = Buffer.allocUnsafe(totalSize);
      let offset = 0;
      
      // Header
      buffer.writeUInt32BE(this.MAGIC_NUMBER, offset); offset += 4;
      buffer.writeUInt8(this.VERSION, offset); offset += 1;
      buffer.writeUInt8(this.MESSAGE_TYPES.PRICE_UPDATE, offset); offset += 1;
      buffer.writeUInt8(this.PRIORITIES.HIGH, offset); offset += 1;
      buffer.writeUInt8(this.COMPRESSION.NONE, offset); offset += 1;
      buffer.writeUInt16BE(totalSize - this.HEADER_SIZE, offset); offset += 2;
      buffer.writeUInt32BE(Date.now(), offset); offset += 4;
      buffer.writeUInt32BE(0, offset); offset += 4; // Checksum placeholder
      
      // Price data (24 bytes)
      buffer.writeBigInt64BE(BigInt(Math.floor(priceData.price * 1000000)), offset); offset += 8; // Price
      buffer.writeBigInt64BE(BigInt(Math.floor((priceData.volume || 0) * 1000000)), offset); offset += 8; // Volume
      buffer.writeUInt32BE(priceData.timestamp || Date.now(), offset); offset += 4; // Timestamp
      buffer.writeUInt8(pairLength, offset); offset += 1; // Pair length
      buffer.writeUInt8(0, offset); offset += 1; // Reserved
      buffer.writeUInt8(0, offset); offset += 1; // Reserved
      buffer.writeUInt8(0, offset); offset += 1; // Reserved
      
      // Pair string
      buffer.write(priceData.pair, offset, 'utf8'); offset += pairLength;
      
      // Calculate checksum
      const checksum = this.calculateChecksum(buffer.slice(0, offset));
      buffer.writeUInt32BE(checksum, 12);
      
      const latency = performance.now() - startTime;
      logger.debug(`Price update encoded in ${latency.toFixed(2)}ms, size: ${offset} bytes`);
      
      return buffer.slice(0, offset);
      
    } catch (error) {
      logger.error('Error encoding price update:', error);
      throw error;
    }
  }

  // Decode price update
  decodePriceUpdate(buffer) {
    const startTime = performance.now();
    
    try {
      let offset = 0;
      
      // Validate header
      const magic = buffer.readUInt32BE(offset); offset += 4;
      if (magic !== this.MAGIC_NUMBER) {
        throw new Error('Invalid magic number');
      }
      
      const version = buffer.readUInt8(offset); offset += 1;
      const messageType = buffer.readUInt8(offset); offset += 1;
      const priority = buffer.readUInt8(offset); offset += 1;
      const compression = buffer.readUInt8(offset); offset += 1;
      const payloadSize = buffer.readUInt16BE(offset); offset += 2;
      const timestamp = buffer.readUInt32BE(offset); offset += 4;
      const checksum = buffer.readUInt32BE(offset); offset += 4;
      
      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(buffer.slice(0, offset - 4));
      if (checksum !== calculatedChecksum) {
        throw new Error('Checksum mismatch');
      }
      
      // Decode price data
      const price = Number(buffer.readBigInt64BE(offset)) / 1000000; offset += 8;
      const volume = Number(buffer.readBigInt64BE(offset)) / 1000000; offset += 8;
      const priceTimestamp = buffer.readUInt32BE(offset); offset += 4;
      const pairLength = buffer.readUInt8(offset); offset += 1;
      offset += 3; // Reserved bytes
      
      const pair = buffer.toString('utf8', offset, offset + pairLength);
      
      const latency = performance.now() - startTime;
      logger.debug(`Price update decoded in ${latency.toFixed(2)}ms`);
      
      return {
        price: price,
        volume: volume,
        timestamp: priceTimestamp,
        pair: pair,
        header: {
          version: version,
          messageType: messageType,
          priority: priority,
          compression: compression,
          timestamp: timestamp
        }
      };
      
    } catch (error) {
      logger.error('Error decoding price update:', error);
      throw error;
    }
  }

  // Encode trade signal
  encodeTradeSignal(signal) {
    const startTime = performance.now();
    
    try {
      const pairLength = Buffer.byteLength(signal.pair, 'utf8');
      const totalSize = this.HEADER_SIZE + 20 + pairLength;
      
      const buffer = Buffer.allocUnsafe(totalSize);
      let offset = 0;
      
      // Header
      buffer.writeUInt32BE(this.MAGIC_NUMBER, offset); offset += 4;
      buffer.writeUInt8(this.VERSION, offset); offset += 1;
      buffer.writeUInt8(this.MESSAGE_TYPES.TRADE_SIGNAL, offset); offset += 1;
      buffer.writeUInt8(this.PRIORITIES.HIGH, offset); offset += 1;
      buffer.writeUInt8(this.COMPRESSION.NONE, offset); offset += 1;
      buffer.writeUInt16BE(totalSize - this.HEADER_SIZE, offset); offset += 2;
      buffer.writeUInt32BE(Date.now(), offset); offset += 4;
      buffer.writeUInt32BE(0, offset); offset += 4;
      
      // Signal data (20 bytes)
      buffer.writeUInt8(signal.action === 'buy' ? 1 : signal.action === 'sell' ? 2 : 0, offset); offset += 1; // Action
      buffer.writeUInt8(signal.confidence || 0, offset); offset += 1; // Confidence (0-255)
      buffer.writeBigInt64BE(BigInt(Math.floor((signal.amount || 0) * 1000000)), offset); offset += 8; // Amount
      buffer.writeBigInt64BE(BigInt(Math.floor((signal.price || 0) * 1000000)), offset); offset += 8; // Price
      buffer.writeUInt16BE(pairLength, offset); offset += 2; // Pair length
      
      // Pair string
      buffer.write(signal.pair, offset, 'utf8'); offset += pairLength;
      
      // Calculate checksum
      const checksum = this.calculateChecksum(buffer.slice(0, offset));
      buffer.writeUInt32BE(checksum, 12);
      
      const latency = performance.now() - startTime;
      logger.debug(`Trade signal encoded in ${latency.toFixed(2)}ms, size: ${offset} bytes`);
      
      return buffer.slice(0, offset);
      
    } catch (error) {
      logger.error('Error encoding trade signal:', error);
      throw error;
    }
  }

  // Decode trade signal
  decodeTradeSignal(buffer) {
    const startTime = performance.now();
    
    try {
      let offset = 0;
      
      // Validate header (same as other messages)
      const magic = buffer.readUInt32BE(offset); offset += 4;
      if (magic !== this.MAGIC_NUMBER) {
        throw new Error('Invalid magic number');
      }
      
      const version = buffer.readUInt8(offset); offset += 1;
      const messageType = buffer.readUInt8(offset); offset += 1;
      const priority = buffer.readUInt8(offset); offset += 1;
      const compression = buffer.readUInt8(offset); offset += 1;
      const payloadSize = buffer.readUInt16BE(offset); offset += 2;
      const timestamp = buffer.readUInt32BE(offset); offset += 4;
      const checksum = buffer.readUInt32BE(offset); offset += 4;
      
      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(buffer.slice(0, offset - 4));
      if (checksum !== calculatedChecksum) {
        throw new Error('Checksum mismatch');
      }
      
      // Decode signal data
      const actionCode = buffer.readUInt8(offset); offset += 1;
      const confidence = buffer.readUInt8(offset); offset += 1;
      const amount = Number(buffer.readBigInt64BE(offset)) / 1000000; offset += 8;
      const price = Number(buffer.readBigInt64BE(offset)) / 1000000; offset += 8;
      const pairLength = buffer.readUInt16BE(offset); offset += 2;
      
      const actionMap = { 0: 'hold', 1: 'buy', 2: 'sell' };
      const action = actionMap[actionCode] || 'unknown';
      
      const pair = buffer.toString('utf8', offset, offset + pairLength);
      
      const latency = performance.now() - startTime;
      logger.debug(`Trade signal decoded in ${latency.toFixed(2)}ms`);
      
      return {
        action: action,
        confidence: confidence,
        amount: amount,
        price: price,
        pair: pair,
        header: {
          version: version,
          messageType: messageType,
          priority: priority,
          compression: compression,
          timestamp: timestamp
        }
      };
      
    } catch (error) {
      logger.error('Error decoding trade signal:', error);
      throw error;
    }
  }

  // Encode heartbeat (minimal size)
  encodeHeartbeat() {
    const buffer = Buffer.allocUnsafe(this.HEADER_SIZE);
    let offset = 0;
    
    buffer.writeUInt32BE(this.MAGIC_NUMBER, offset); offset += 4;
    buffer.writeUInt8(this.VERSION, offset); offset += 1;
    buffer.writeUInt8(this.MESSAGE_TYPES.HEARTBEAT, offset); offset += 1;
    buffer.writeUInt8(this.PRIORITIES.LOW, offset); offset += 1;
    buffer.writeUInt8(this.COMPRESSION.NONE, offset); offset += 1;
    buffer.writeUInt16BE(0, offset); offset += 2; // No payload
    buffer.writeUInt32BE(Date.now(), offset); offset += 4;
    
    const checksum = this.calculateChecksum(buffer.slice(0, offset));
    buffer.writeUInt32BE(checksum, offset);
    
    return buffer;
  }

  // Decode heartbeat
  decodeHeartbeat(buffer) {
    if (buffer.length < this.HEADER_SIZE) {
      throw new Error('Buffer too small for heartbeat');
    }
    
    const magic = buffer.readUInt32BE(0);
    if (magic !== this.MAGIC_NUMBER) {
      throw new Error('Invalid magic number');
    }
    
    const timestamp = buffer.readUInt32BE(8);
    const checksum = buffer.readUInt32BE(12);
    
    const calculatedChecksum = this.calculateChecksum(buffer.slice(0, 12));
    if (checksum !== calculatedChecksum) {
      throw new Error('Checksum mismatch');
    }
    
    return {
      timestamp: timestamp,
      type: 'heartbeat'
    };
  }

  // Calculate checksum for data integrity
  calculateChecksum(buffer) {
    let checksum = 0;
    for (let i = 0; i < buffer.length; i++) {
      checksum = (checksum + buffer[i]) & 0xFFFFFFFF;
    }
    return checksum;
  }

  // Enable/disable compression
  setCompression(enabled) {
    this.compressionEnabled = enabled;
    logger.info(`Compression ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Enable/disable encryption
  setEncryption(enabled, key = null) {
    this.encryptionEnabled = enabled;
    this.encryptionKey = key;
    logger.info(`Encryption ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Get protocol statistics
  getStats() {
    return {
      magicNumber: '0x' + this.MAGIC_NUMBER.toString(16),
      version: this.VERSION,
      headerSize: this.HEADER_SIZE,
      compressionEnabled: this.compressionEnabled,
      encryptionEnabled: this.encryptionEnabled,
      messageTypes: Object.keys(this.MESSAGE_TYPES).length,
      priorities: Object.keys(this.PRIORITIES).length
    };
  }

  // Performance benchmark
  async benchmark(iterations = 10000) {
    const testTrade = {
      timestamp: Date.now(),
      price: 123.456789,
      amount: 0.123456,
      orderId: 12345,
      side: 'buy',
      status: 'pending',
      pair: 'USDT/BNB',
      metadata: { source: 'test', priority: 'high' }
    };

    const testPriceUpdate = {
      price: 123.456789,
      volume: 1000.123456,
      timestamp: Date.now(),
      pair: 'USDT/BNB'
    };

    // Benchmark trade encoding/decoding
    const encodeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.encodeTrade(testTrade);
    }
    const encodeTime = performance.now() - encodeStart;

    const encodedTrade = this.encodeTrade(testTrade);
    const decodeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.decodeTrade(encodedTrade);
    }
    const decodeTime = performance.now() - decodeStart;

    // Benchmark price update encoding/decoding
    const priceEncodeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.encodePriceUpdate(testPriceUpdate);
    }
    const priceEncodeTime = performance.now() - priceEncodeStart;

    const encodedPrice = this.encodePriceUpdate(testPriceUpdate);
    const priceDecodeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.decodePriceUpdate(encodedPrice);
    }
    const priceDecodeTime = performance.now() - priceDecodeStart;

    return {
      iterations: iterations,
      trade: {
        encodeTime: encodeTime,
        decodeTime: decodeTime,
        encodePerSecond: Math.round(iterations / (encodeTime / 1000)),
        decodePerSecond: Math.round(iterations / (decodeTime / 1000)),
        encodedSize: encodedTrade.length
      },
      priceUpdate: {
        encodeTime: priceEncodeTime,
        decodeTime: priceDecodeTime,
        encodePerSecond: Math.round(iterations / (priceEncodeTime / 1000)),
        decodePerSecond: Math.round(iterations / (priceDecodeTime / 1000)),
        encodedSize: encodedPrice.length
      }
    };
  }
}

module.exports = BinaryProtocolManager;

