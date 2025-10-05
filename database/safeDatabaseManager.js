const { Pool } = require('pg');
const copyFrom = require('pg-copy-streams').from;
const logger = require('../logger');
const config = require('../config');

class SafeDatabaseManager {
  constructor() {
    this.writePool = new Pool({
      connectionString: process.env.DATABASE_URL || config.database.connectionString,
      max: 5, // Limited connections for writes
      statement_timeout: 1000,
      query_timeout: 2000,
      idleTimeoutMillis: 30000,
    });

    this.readPool = new Pool({
      connectionString: process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL || config.database.connectionString,
      max: 20, // More connections for reads
      statement_timeout: 500,
      idleTimeoutMillis: 30000,
    });

    // Metrics for monitoring
    this.metrics = {
      dbTransactionErrors: 0,
      dbConnectionLeaks: 0,
      dbQueryLatency: [],
      dbRetryCount: 0
    };

    // Prepared statements for common queries
    this.preparedStatements = {
      insertTrade: 'INSERT INTO trades (time, pair, action, amount, price, "gasUsed", slippage, "profitLoss", dex, "txHash", status, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
      getRecentTrades: 'SELECT * FROM trades WHERE time > NOW() - INTERVAL $1 ORDER BY time DESC',
      updateTradeStatus: 'UPDATE trades SET status = $1, "txHash" = $2, "gasUsed" = $3, "profitLoss" = $4, metadata = $5 WHERE id = $6',
      getTradeById: 'SELECT * FROM trades WHERE id = $1',
    };

    this.initialize();
    logger.info('🗄️ Safe Database Manager initialized');
  }

  async initialize() {
    try {
      await this.writePool.query('SELECT 1');
      logger.info('✅ PostgreSQL Write Pool connected');
      await this.readPool.query('SELECT 1');
      logger.info('✅ PostgreSQL Read Pool connected');
    } catch (error) {
      logger.error('❌ Failed to connect to PostgreSQL pools:', error);
      throw error;
    }
  }

  // CRITICAL: Safe transaction execution with deadlock detection and retry
  async executeTransaction(operations, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const client = await this.writePool.connect();
      
      try {
        await client.query('BEGIN');
        
        // CRITICAL: Set deadlock and lock timeouts
        await client.query('SET LOCAL lock_timeout = 5000'); // 5 second timeout
        await client.query('SET LOCAL deadlock_timeout = 1000'); // 1 second deadlock detection
        await client.query('SET LOCAL statement_timeout = 10000'); // 10 second statement timeout
        
        const results = [];
        for (const op of operations) {
          const result = await client.query(op.query, op.params);
          results.push(result);
        }
        
        await client.query('COMMIT');
        return results;
        
      } catch (error) {
        await client.query('ROLLBACK');
        
        // CRITICAL: Check for retryable errors
        const isRetryable = this.isRetryableTransactionError(error);
        
        if (isRetryable && attempt < maxRetries) {
          const delay = this.exponentialBackoff(attempt);
          logger.warn(`⚠️ Transaction error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);
          this.metrics.dbTransactionErrors++;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        }
        
        // Not retryable or max retries reached
        this.metrics.dbTransactionErrors++;
        logger.error('❌ Transaction failed:', error);
        throw error;
        
      } finally {
        // CRITICAL: Always release connection
        client.release();
      }
    }
    
    throw new Error(`Transaction failed after ${maxRetries} attempts`);
  }

  // Check if transaction error is retryable
  isRetryableTransactionError(error) {
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '08006', // connection_failure
      '08003', // connection_does_not_exist
      '08000', // connection_exception
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '57P03', // cannot_connect_now
      '55P03', // lock_not_available
    ];
    
    return retryableCodes.includes(error.code) || 
           error.message.toLowerCase().includes('deadlock') ||
           error.message.toLowerCase().includes('lock timeout');
  }

  // Exponential backoff with jitter
  exponentialBackoff(attempt) {
    const baseDelay = 100; // 100ms base
    const maxDelay = 5000; // 5s max
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 100; // Add jitter to avoid thundering herd
    return exponentialDelay + jitter;
  }

  // CRITICAL: Execute query with retry and proper cleanup
  async executeWithRetry(query, params = [], maxRetries = 3, type = 'write') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const client = await this.getPool(type).connect();
      
      try {
        const startTime = performance.now();
        const statement = this.preparedStatements[query] || query;
        const result = await client.query(statement, params);
        const latency = performance.now() - startTime;
        
        // Track latency
        this.metrics.dbQueryLatency.push(latency);
        if (this.metrics.dbQueryLatency.length > 1000) {
          this.metrics.dbQueryLatency = this.metrics.dbQueryLatency.slice(-1000);
        }
        
        return result;
        
      } catch (error) {
        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempt), 5000);
          logger.warn(`Query failed (attempt ${attempt}), retrying in ${delay}ms`);
          this.metrics.dbRetryCount++;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
        
      } finally {
        // CRITICAL: Always release connection
        client.release();
      }
    }
  }

  // CRITICAL: Safe query execution with automatic cleanup
  async executeQuery(queryName, params = [], type = 'write') {
    const client = await this.getPool(type).connect();
    
    try {
      const startTime = performance.now();
      const statement = this.preparedStatements[queryName] || queryName;
      const res = await client.query(statement, params);
      const latency = performance.now() - startTime;
      
      // Track latency
      this.metrics.dbQueryLatency.push(latency);
      if (this.metrics.dbQueryLatency.length > 1000) {
        this.metrics.dbQueryLatency = this.metrics.dbQueryLatency.slice(-1000);
      }
      
      return res;
      
    } catch (error) {
      logger.error(`❌ Database query failed (${queryName}, type: ${type}):`, error);
      throw error;
      
    } finally {
      // CRITICAL: Always release connection
      client.release();
    }
  }

  // Get appropriate connection pool
  getPool(type) {
    return type === 'read' ? this.readPool : this.writePool;
  }

  // Check if error is retryable
  isRetryableError(error) {
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '08006', // connection_failure
      '08003', // connection_does_not_exist
      '08000', // connection_exception
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
    ];
    
    const retryableMessages = [
      'connection',
      'timeout',
      'network',
      'temporary'
    ];
    
    return retryableCodes.includes(error.code) || 
           retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
  }

  // Insert single trade with proper error handling
  async insertTrade(trade) {
    const { time, pair, action, amount, price, gasUsed, slippage, profitLoss, dex, txHash, status, metadata } = trade;
    
    return await this.executeQuery('insertTrade', [
      time || new Date(), pair, action, amount, price, gasUsed, slippage, profitLoss, dex, txHash, status, metadata
    ], 'write');
  }

  // Update trade with proper error handling
  async updateTrade(id, updates) {
    const { status, txHash, gasUsed, profitLoss, metadata } = updates;
    return await this.executeQuery('updateTradeStatus', [status, txHash, gasUsed, profitLoss, metadata, id], 'write');
  }

  // Get recent trades with proper error handling
  async getRecentTrades(interval) {
    return await this.executeQuery('getRecentTrades', [interval], 'read');
  }

  // CRITICAL: Batch insert with proper connection management
  async batchInsertTrades(trades) {
    if (trades.length === 0) {
      logger.info('No trades to batch insert.');
      return;
    }

    const client = await this.writePool.connect();
    
    try {
      const stream = client.query(copyFrom(
        'COPY trades (time, pair, action, amount, price, "gasUsed", slippage, "profitLoss", dex, "txHash", status, metadata) FROM STDIN WITH (FORMAT CSV, DELIMITER \',\', NULL \'\')'
      ));

      const promises = [];
      
      stream.on('error', (err) => {
        logger.error('❌ COPY stream error:', err);
        promises.forEach((p) => p.reject(err));
      });
      
      stream.on('end', () => {
        logger.info(`✅ Successfully batch inserted ${trades.length} trades.`);
        promises.forEach((p) => p.resolve());
      });

      for (const trade of trades) {
        const { time, pair, action, amount, price, gasUsed, slippage, profitLoss, dex, txHash, status, metadata } = trade;
        const row = [
          (time || new Date()).toISOString(),
          pair,
          action,
          amount,
          price,
          gasUsed || '',
          slippage || '',
          profitLoss || '',
          dex || '',
          txHash || '',
          status || 'completed',
          metadata ? JSON.stringify(metadata) : ''
        ].map(val => String(val).replace(/,/g, '\\,')).join(',');

        stream.write(row + '\n');
      }
      
      stream.end();

      await Promise.all(promises);
      
    } catch (error) {
      logger.error('❌ Error during batch insert:', error);
      throw error;
      
    } finally {
      // CRITICAL: Always release connection
      client.release();
    }
  }

  // Health check with connection pool monitoring
  async healthCheck() {
    try {
      // Test write pool
      const writeStart = performance.now();
      await this.writePool.query('SELECT 1');
      const writeLatency = performance.now() - writeStart;
      
      // Test read pool
      const readStart = performance.now();
      await this.readPool.query('SELECT 1');
      const readLatency = performance.now() - readStart;
      
      // Check pool stats
      const writeStats = {
        totalCount: this.writePool.totalCount,
        idleCount: this.writePool.idleCount,
        waitingCount: this.writePool.waitingCount
      };
      
      const readStats = {
        totalCount: this.readPool.totalCount,
        idleCount: this.readPool.idleCount,
        waitingCount: this.readPool.waitingCount
      };
      
      // Calculate average latency
      const avgLatency = this.metrics.dbQueryLatency.length > 0 
        ? this.metrics.dbQueryLatency.reduce((a, b) => a + b, 0) / this.metrics.dbQueryLatency.length
        : 0;
      
      const healthy = writeLatency < 1000 && readLatency < 1000 && 
                     writeStats.waitingCount < 5 && readStats.waitingCount < 10;
      
      return {
        status: healthy ? 'healthy' : 'warning',
        writePool: {
          ...writeStats,
          latency: writeLatency
        },
        readPool: {
          ...readStats,
          latency: readLatency
        },
        metrics: {
          avgLatency: avgLatency.toFixed(2),
          transactionErrors: this.metrics.dbTransactionErrors,
          retryCount: this.metrics.dbRetryCount,
          queryCount: this.metrics.dbQueryLatency.length
        }
      };
      
    } catch (error) {
      logger.error('❌ Database health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Get database statistics
  getStats() {
    const avgLatency = this.metrics.dbQueryLatency.length > 0 
      ? this.metrics.dbQueryLatency.reduce((a, b) => a + b, 0) / this.metrics.dbQueryLatency.length
      : 0;
    
    const p95Latency = this.metrics.dbQueryLatency.length > 0
      ? this.metrics.dbQueryLatency.sort((a, b) => a - b)[Math.floor(this.metrics.dbQueryLatency.length * 0.95)]
      : 0;
    
    return {
      writePool: {
        total: this.writePool.totalCount,
        idle: this.writePool.idleCount,
        waiting: this.writePool.waitingCount
      },
      readPool: {
        total: this.readPool.totalCount,
        idle: this.readPool.idleCount,
        waiting: this.readPool.waitingCount
      },
      performance: {
        avgLatency: avgLatency.toFixed(2) + 'ms',
        p95Latency: p95Latency.toFixed(2) + 'ms',
        queryCount: this.metrics.dbQueryLatency.length
      },
      errors: {
        transactionErrors: this.metrics.dbTransactionErrors,
        retryCount: this.metrics.dbRetryCount,
        connectionLeaks: this.metrics.dbConnectionLeaks
      }
    };
  }

  // Graceful shutdown with proper cleanup
  async disconnect() {
    try {
      logger.info('🔄 Shutting down database connections...');
      
      await this.writePool.end();
      await this.readPool.end();
      
      logger.info('✅ Database connections closed');
      
    } catch (error) {
      logger.error('❌ Error during database shutdown:', error);
      throw error;
    }
  }

  // Force cleanup (for testing)
  async forceCleanup() {
    try {
      // Force close all connections
      await this.writePool.end();
      await this.readPool.end();
      
      // Reset metrics
      this.metrics.dbQueryLatency = [];
      this.metrics.dbTransactionErrors = 0;
      this.metrics.dbRetryCount = 0;
      
      logger.info('✅ Database force cleanup completed');
      
    } catch (error) {
      logger.error('❌ Error during force cleanup:', error);
    }
  }
}

module.exports = SafeDatabaseManager;
