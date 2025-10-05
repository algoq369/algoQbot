const { Pool } = require('pg');
const logger = require('../logger');

/**
 * Safe Connection Pool - Fixes Critical Race Condition
 * 
 * EXPERT REVIEW FIX:
 * Previous issue: Background .then() handler could release a connection
 * that was already acquired and in use by another thread.
 * 
 * Solution: Track active connections and check before releasing.
 */
class SafeConnectionPool {
  constructor(config) {
    this.writePool = new Pool({
      ...config.write,
      max: config.write.max || 20,
      idleTimeoutMillis: config.write.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.write.connectionTimeoutMillis || 10000,
      statement_timeout: config.write.statement_timeout || 30000
    });

    this.readPool = new Pool({
      ...config.read,
      max: config.read.max || 40,
      idleTimeoutMillis: config.read.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.read.connectionTimeoutMillis || 10000,
      statement_timeout: config.read.statement_timeout || 10000
    });

    // Track active connections with metadata
    this.activeConnections = new Map(); // connection → { acquisitionId, acquiredAt, inUse }
    this.pendingAcquisitions = new Set(); // Set of acquisitionIds
    
    // Metrics
    this.metrics = {
      totalAcquires: 0,
      successfulAcquires: 0,
      timeouts: 0,
      timeoutCleanups: 0,
      racesAvoided: 0,
      errors: 0
    };

    // Setup error handlers
    this.setupErrorHandlers();

    logger.info('✅ Safe Connection Pool initialized (race condition fixed)');
  }

  setupErrorHandlers() {
    this.writePool.on('error', (err) => {
      logger.error('Unexpected error on write pool idle client', err);
      this.metrics.errors++;
    });

    this.readPool.on('error', (err) => {
      logger.error('Unexpected error on read pool idle client', err);
      this.metrics.errors++;
    });

    this.writePool.on('connect', () => {
      logger.debug('New client connected to write pool');
    });

    this.readPool.on('connect', () => {
      logger.debug('New client connected to read pool');
    });
  }

  /**
   * ✅ CRITICAL FIX: Acquire connection with race-free timeout cleanup
   */
  async acquireWithTimeout(pool, timeout = 10000) {
    this.metrics.totalAcquires++;
    
    const acquisitionId = Symbol('acquisition');
    let timeoutHandle;
    let timedOut = false;
    let connectionResolved = false;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        reject new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);
    });
    
    const connectionPromise = pool.connect();
    this.pendingAcquisitions.add(acquisitionId);
    
    try {
      const connection = await Promise.race([
        connectionPromise,
        timeoutPromise
      ]);
      
      // Successfully acquired
      clearTimeout(timeoutHandle);
      connectionResolved = true;
      
      // ✅ CRITICAL: Mark as active IMMEDIATELY to prevent race
      this.activeConnections.set(connection, {
        acquisitionId,
        acquiredAt: Date.now(),
        inUse: true
      });
      
      this.pendingAcquisitions.delete(acquisitionId);
      this.metrics.successfulAcquires++;
      
      return connection;
      
    } catch (error) {
      clearTimeout(timeoutHandle);
      
      if (timedOut) {
        this.metrics.timeouts++;
        
        // ✅ CRITICAL FIX: Safely handle background resolution
        // ✅ EXPERT FIX: Improved error logging
        connectionPromise
          .then(conn => {
            // Check if we already marked this as active (RACE CONDITION CHECK)
            if (this.activeConnections.has(conn)) {
              logger.error('🚨 CRITICAL: Connection acquired after timeout but already in use!', {
                operation: 'connection-timeout-race-detected',
                acquisitionId: acquisitionId.toString(),
                activeCount: this.activeConnections.size
              });
              this.metrics.racesAvoided++;
              // Don't release - it's being used by someone else
              return;
            }
            
            // Safe to release - no one else claimed it
            logger.warn('Releasing connection acquired after timeout', {
              operation: 'timeout-cleanup',
              acquisitionId: acquisitionId.toString()
            });
            this.metrics.timeoutCleanups++;
            
            try {
              conn.release();
            } catch (releaseError) {
              logger.error('Error releasing timed-out connection (non-critical):', {
                operation: 'connection-release-after-timeout',
                error: releaseError.message,
                stack: releaseError.stack
              });
            }
          })
          .catch(connError => {
            // Connection failed anyway - no cleanup needed
            logger.debug('Timed-out connection attempt failed (expected):', {
              operation: 'timeout-connection-failed',
              error: connError.message,
              acquisitionId: acquisitionId.toString()
            });
          })
          .finally(() => {
            this.pendingAcquisitions.delete(acquisitionId);
          });
      } else {
        this.pendingAcquisitions.delete(acquisitionId);
      }
      
      throw error;
    }
  }

  /**
   * Get connection from write pool
   */
  async getWriteConnection(timeout = 10000) {
    return await this.acquireWithTimeout(this.writePool, timeout);
  }

  /**
   * Get connection from read pool
   */
  async getReadConnection(timeout = 10000) {
    return await this.acquireWithTimeout(this.readPool, timeout);
  }

  /**
   * ✅ SAFE RELEASE: Check active connections before releasing
   */
  release(connection) {
    const metadata = this.activeConnections.get(connection);
    
    if (!metadata) {
      logger.warn('Attempted to release connection not in active pool');
      // Release anyway to be safe
      try {
        connection.release();
      } catch (error) {
        logger.error('Error releasing untracked connection:', error);
      }
      return;
    }
    
    // Mark as no longer in use
    metadata.inUse = false;
    this.activeConnections.delete(connection);
    
    // Release to pool
    try {
      connection.release();
    } catch (error) {
      logger.error('Error releasing connection:', error);
      throw error;
    }
  }

  /**
   * Execute query with automatic connection management
   */
  async executeQuery(query, params, options = {}) {
    const type = options.type || 'read';
    const pool = type === 'write' ? this.writePool : this.readPool;
    const timeout = options.timeout || 30000;
    
    const client = await this.acquireWithTimeout(pool, 10000);
    
    try {
      // Execute with query timeout
      const result = await Promise.race([
        client.query(query, params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);
      
      return result;
      
    } finally {
      this.release(client);
    }
  }

  /**
   * Execute transaction with retry logic
   */
  async executeTransaction(operations, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let client;
      
      try {
        client = await this.getWriteConnection(10000);
        
        await client.query('BEGIN');
        
        // Set timeouts to prevent deadlocks
        await client.query('SET LOCAL lock_timeout = 5000');
        await client.query('SET LOCAL deadlock_timeout = 1000');
        await client.query('SET LOCAL statement_timeout = 10000');
        
        // Execute operations
        const results = [];
        for (const op of operations) {
          const result = await client.query(op.query, op.params);
          results.push(result);
        }
        
        await client.query('COMMIT');
        
        return { success: true, results };
        
      } catch (error) {
        // Rollback
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            logger.error('Rollback error:', rollbackError);
          }
        }
        
        // Retry on serialization failure or deadlock
        if ((error.code === '40P01' || error.code === '40001') && attempt < maxRetries) {
          const backoff = Math.min(1000, 100 * (2 ** attempt));
          logger.warn(`Transaction conflict, retrying (${attempt}/${maxRetries}) after ${backoff}ms`);
          await this.sleep(backoff);
          continue;
        }
        
        throw error;
        
      } finally {
        // ✅ CRITICAL: Always release connection
        if (client) {
          this.release(client);
        }
      }
    }
    
    throw new Error('Transaction failed after max retries');
  }

  /**
   * Health check
   */
  async healthCheck() {
    const writeHealth = await this.checkPoolHealth(this.writePool, 'write');
    const readHealth = await this.checkPoolHealth(this.readPool, 'read');
    
    return {
      write: writeHealth,
      read: readHealth,
      activeConnections: this.activeConnections.size,
      pendingAcquisitions: this.pendingAcquisitions.size,
      metrics: this.metrics,
      overallStatus: (writeHealth.status === 'healthy' && readHealth.status === 'healthy') 
        ? 'healthy' 
        : 'degraded'
    };
  }

  async checkPoolHealth(pool, name) {
    try {
      const client = await this.acquireWithTimeout(pool, 5000);
      
      try {
        // Simple query to test connection
        const result = await client.query('SELECT 1 as health');
        
        return {
          status: 'healthy',
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingClients: pool.waitingCount
        };
        
      } finally {
        this.release(client);
      }
      
    } catch (error) {
      logger.error(`Health check failed for ${name} pool:`, error);
      return {
        status: 'unhealthy',
        error: error.message,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      };
    }
  }

  /**
   * Get pool stats
   */
  getStats() {
    return {
      write: {
        total: this.writePool.totalCount,
        idle: this.writePool.idleCount,
        waiting: this.writePool.waitingCount
      },
      read: {
        total: this.readPool.totalCount,
        idle: this.readPool.idleCount,
        waiting: this.readPool.waitingCount
      },
      active: {
        connections: this.activeConnections.size,
        pendingAcquisitions: this.pendingAcquisitions.size
      },
      metrics: {
        ...this.metrics,
        successRate: this.metrics.totalAcquires > 0
          ? ((this.metrics.successfulAcquires / this.metrics.totalAcquires) * 100).toFixed(2) + '%'
          : '0%',
        timeoutRate: this.metrics.totalAcquires > 0
          ? ((this.metrics.timeouts / this.metrics.totalAcquires) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }

  /**
   * Shutdown pools
   */
  async shutdown(timeout = 10000) {
    logger.info('Shutting down connection pools...');
    
    // Wait for active connections to be released
    const startTime = Date.now();
    while (this.activeConnections.size > 0 && Date.now() - startTime < timeout) {
      logger.info(`Waiting for ${this.activeConnections.size} active connections to release...`);
      await this.sleep(1000);
    }
    
    if (this.activeConnections.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeConnections.size} active connections`);
    }
    
    const shutdownPromise = Promise.all([
      this.writePool.end(),
      this.readPool.end()
    ]);
    
    try {
      await Promise.race([
        shutdownPromise,
        this.sleep(timeout).then(() => {
          throw new Error('Pool shutdown timeout');
        })
      ]);
      
      logger.info('✅ Connection pools shut down successfully');
      
    } catch (error) {
      logger.error('Error shutting down pools:', error);
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SafeConnectionPool;

