const { Pool } = require('pg');
const logger = require('../logger');
const CircuitBreaker = require('../resilience/improvedCircuitBreaker');

/**
 * Resilient Connection Pool with Timeout and Circuit Breaker
 * 
 * Prevents connection pool exhaustion from slow queries
 * Implements circuit breaker to fail fast when database is down
 */
class ResilientConnectionPool {
  constructor(config = {}) {
    this.config = {
      connectionString: config.connectionString || process.env.DATABASE_URL,
      max: config.max || 20, // Max connections
      min: config.min || 5,  // Min connections
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000, // 10s to acquire
      statementTimeout: config.statementTimeout || 30000, // 30s query timeout
      queryTimeout: config.queryTimeout || 60000, // 60s overall timeout
      ...config
    };
    
    // Create write pool
    this.writePool = new Pool({
      ...this.config,
      max: this.config.max,
      statement_timeout: this.config.statementTimeout,
      query_timeout: this.config.queryTimeout
    });
    
    // Create read pool (can be larger)
    this.readPool = new Pool({
      ...this.config,
      max: this.config.max * 2, // More read connections
      statement_timeout: this.config.statementTimeout / 2 // Faster timeout for reads
    });
    
    // Circuit breakers for each pool
    this.writeCircuitBreaker = new CircuitBreaker('db-write', {
      failureThreshold: 5,
      timeout: this.config.queryTimeout,
      resetTimeout: 30000
    });
    
    this.readCircuitBreaker = new CircuitBreaker('db-read', {
      failureThreshold: 10, // More tolerant for reads
      timeout: this.config.queryTimeout / 2,
      resetTimeout: 15000
    });
    
    // Metrics
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      timeouts: 0,
      circuitBreakerOpen: 0,
      poolExhausted: 0,
      avgQueryTime: 0,
      totalQueryTime: 0
    };
    
    // Setup pool event handlers
    this.setupPoolMonitoring();
    
    logger.info('🗄️ Resilient Connection Pool initialized');
  }

  /**
   * Setup monitoring for connection pools
   */
  setupPoolMonitoring() {
    // Write pool events
    this.writePool.on('connect', () => {
      logger.debug('Write pool: Client connected');
    });
    
    this.writePool.on('acquire', () => {
      logger.debug('Write pool: Client acquired');
    });
    
    this.writePool.on('remove', () => {
      logger.debug('Write pool: Client removed');
    });
    
    this.writePool.on('error', (err) => {
      logger.error('Write pool error:', err);
    });
    
    // Read pool events
    this.readPool.on('error', (err) => {
      logger.error('Read pool error:', err);
    });
  }

  /**
   * Execute query with timeout and circuit breaker protection
   */
  async executeQuery(query, params = [], type = 'read') {
    this.metrics.totalQueries++;
    const startTime = Date.now();
    
    const pool = type === 'write' ? this.writePool : this.readPool;
    const circuitBreaker = type === 'write' ? this.writeCircuitBreaker : this.readCircuitBreaker;
    
    try {
      // Check if circuit breaker is open
      if (circuitBreaker.isOpen()) {
        this.metrics.circuitBreakerOpen++;
        throw new Error(`Circuit breaker open for ${type} operations`);
      }
      
      // Execute with circuit breaker
      const result = await circuitBreaker.execute(async () => {
        // Acquire connection with timeout
        const client = await this.acquireWithTimeout(pool, this.config.connectionTimeoutMillis);
        
        try {
          // Execute query with timeout
          const queryResult = await this.queryWithTimeout(client, query, params, this.config.queryTimeout);
          
          return queryResult;
          
        } finally {
          // CRITICAL: Always release client
          client.release();
        }
      });
      
      // Update metrics
      const queryTime = Date.now() - startTime;
      this.metrics.successfulQueries++;
      this.metrics.totalQueryTime += queryTime;
      this.metrics.avgQueryTime = this.metrics.totalQueryTime / this.metrics.successfulQueries;
      
      logger.debug(`Query executed in ${queryTime}ms (${type})`);
      
      return result;
      
    } catch (error) {
      this.metrics.failedQueries++;
      
      if (error.message.includes('timeout')) {
        this.metrics.timeouts++;
      }
      
      if (error.message.includes('exhausted')) {
        this.metrics.poolExhausted++;
      }
      
      logger.error(`Query failed (${type}):`, error.message);
      throw error;
    }
  }

  /**
   * Acquire connection with timeout
   */
  async acquireWithTimeout(pool, timeout) {
    return await Promise.race([
      pool.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection acquisition timeout')), timeout)
      )
    ]);
  }

  /**
   * Execute query with timeout
   */
  async queryWithTimeout(client, query, params, timeout) {
    return await Promise.race([
      client.query(query, params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query execution timeout')), timeout)
      )
    ]);
  }

  /**
   * Execute transaction with timeout and retry
   */
  async executeTransaction(operations, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const client = await this.acquireWithTimeout(this.writePool, this.config.connectionTimeoutMillis);
      
      try {
        await client.query('BEGIN');
        
        // Set timeouts
        await client.query('SET LOCAL lock_timeout = 5000');
        await client.query('SET LOCAL deadlock_timeout = 1000');
        await client.query('SET LOCAL statement_timeout = $1', [this.config.statementTimeout]);
        
        const results = [];
        for (const op of operations) {
          const result = await this.queryWithTimeout(client, op.query, op.params, this.config.queryTimeout);
          results.push(result);
        }
        
        await client.query('COMMIT');
        return results;
        
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Check if retryable
        const isRetryable = this.isRetryableError(error);
        
        if (isRetryable && attempt < maxRetries) {
          const delay = this.exponentialBackoff(attempt);
          logger.warn(`Transaction error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
        
      } finally {
        client.release();
      }
    }
    
    throw new Error(`Transaction failed after ${maxRetries} attempts`);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '08006', // connection_failure
      '08003', // connection_does_not_exist
      '55P03', // lock_not_available
    ];
    
    return retryableCodes.includes(error.code) ||
           error.message.toLowerCase().includes('deadlock') ||
           error.message.toLowerCase().includes('timeout');
  }

  /**
   * Exponential backoff with jitter
   */
  exponentialBackoff(attempt) {
    const baseDelay = 100;
    const maxDelay = 5000;
    const exponential = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 100;
    return exponential + jitter;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      write: {
        totalCount: this.writePool.totalCount,
        idleCount: this.writePool.idleCount,
        waitingCount: this.writePool.waitingCount,
        maxSize: this.config.max,
        utilization: ((this.writePool.totalCount - this.writePool.idleCount) / this.config.max * 100).toFixed(2) + '%'
      },
      read: {
        totalCount: this.readPool.totalCount,
        idleCount: this.readPool.idleCount,
        waitingCount: this.readPool.waitingCount,
        maxSize: this.config.max * 2,
        utilization: ((this.readPool.totalCount - this.readPool.idleCount) / (this.config.max * 2) * 100).toFixed(2) + '%'
      },
      queries: this.metrics,
      circuitBreakers: {
        write: this.writeCircuitBreaker.getStats(),
        read: this.readCircuitBreaker.getStats()
      }
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    const stats = this.getStats();
    
    const writeHealthy = !this.writeCircuitBreaker.isOpen() && stats.write.waitingCount < 5;
    const readHealthy = !this.readCircuitBreaker.isOpen() && stats.read.waitingCount < 10;
    
    return {
      status: writeHealthy && readHealthy ? 'healthy' : 'degraded',
      write: {
        status: writeHealthy ? 'healthy' : 'degraded',
        circuitBreakerState: this.writeCircuitBreaker.getState(),
        poolUtilization: stats.write.utilization,
        waitingCount: stats.write.waitingCount
      },
      read: {
        status: readHealthy ? 'healthy' : 'degraded',
        circuitBreakerState: this.readCircuitBreaker.getState(),
        poolUtilization: stats.read.utilization,
        waitingCount: stats.read.waitingCount
      },
      metrics: this.metrics
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🗄️ Shutting down connection pools...');
    
    await this.writePool.end();
    await this.readPool.end();
    
    logger.info('✅ Connection pools closed');
  }
}

module.exports = ResilientConnectionPool;

