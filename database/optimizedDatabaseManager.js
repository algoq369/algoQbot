const { Pool } = require('pg');
const { copyFrom } = require('pg-copy-streams');
const logger = require('../logger');

class OptimizedDatabaseManager {
  constructor() {
    // Separate connection pools for read and write operations
    this.writePool = new Pool({
      max: 5, // Fewer connections for writes
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      statement_timeout: 1000, // 1 second timeout
      query_timeout: 2000, // 2 second query timeout
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      application_name: 'trading-bot-write'
    });

    this.readPool = new Pool({
      max: 20, // More connections for reads
      connectionString: process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL,
      statement_timeout: 500, // 500ms timeout for reads
      query_timeout: 1000,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      application_name: 'trading-bot-read'
    });

    // Prepared statements for common queries
    this.preparedStatements = {
      insertTrade: `
        INSERT INTO trades (time, pair, action, amount, price, gas_used, gas_price, slippage, profit_loss, dex, tx_hash, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `,
      getRecentTrades: `
        SELECT * FROM trades 
        WHERE time > NOW() - INTERVAL $1 
        ORDER BY time DESC 
        LIMIT $2
      `,
      updateProfitLoss: `
        UPDATE trades 
        SET profit_loss = $1, status = $2, updated_at = NOW() 
        WHERE id = $3
      `,
      getTradeStats: `
        SELECT 
          pair,
          COUNT(*) as total_trades,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_trades,
          AVG(profit_loss) as avg_profit_loss,
          SUM(profit_loss) as total_profit_loss,
          AVG(gas_used) as avg_gas_used
        FROM trades 
        WHERE time > NOW() - INTERVAL $1
        GROUP BY pair
      `,
      getMarketData: `
        SELECT * FROM market_data 
        WHERE pair = $1 AND time > NOW() - INTERVAL $2 
        ORDER BY time DESC 
        LIMIT $3
      `
    };

    this.initializePreparedStatements();
    this.setupConnectionMonitoring();
    
    logger.info('🚀 Optimized Database Manager initialized');
  }

  // Initialize prepared statements for better performance
  async initializePreparedStatements() {
    try {
      // Prepare statements on write pool
      for (const [name, query] of Object.entries(this.preparedStatements)) {
        await this.writePool.query(`PREPARE ${name} AS ${query}`);
      }
      
      logger.info('✅ Prepared statements initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize prepared statements:', error);
    }
  }

  // Setup connection monitoring
  setupConnectionMonitoring() {
    // Monitor write pool
    this.writePool.on('connect', (client) => {
      logger.debug('Write pool: New client connected');
    });

    this.writePool.on('error', (err, client) => {
      logger.error('Write pool error:', err);
    });

    // Monitor read pool
    this.readPool.on('connect', (client) => {
      logger.debug('Read pool: New client connected');
    });

    this.readPool.on('error', (err, client) => {
      logger.error('Read pool error:', err);
    });
  }

  // Ultra-fast bulk insert using COPY command (100x faster than INSERT)
  async batchInsertTrades(trades) {
    if (!trades || trades.length === 0) return;

    const startTime = performance.now();
    
    try {
      const client = await this.writePool.connect();
      
      try {
        // Use COPY command for bulk inserts
        const stream = client.query(copyFrom(
          'COPY trades (time, pair, action, amount, price, gas_used, gas_price, slippage, profit_loss, dex, tx_hash, status, metadata) FROM STDIN WITH CSV'
        ));
        
        // Convert trades to CSV format
        const csvData = trades.map(trade => {
          const metadata = trade.metadata ? JSON.stringify(trade.metadata) : '';
          return [
            trade.time || new Date().toISOString(),
            trade.pair || '',
            trade.action || '',
            trade.amount || 0,
            trade.price || 0,
            trade.gas_used || 0,
            trade.gas_price || 0,
            trade.slippage || 0,
            trade.profit_loss || 0,
            trade.dex || '',
            trade.tx_hash || '',
            trade.status || 'pending',
            metadata
          ].join(',');
        }).join('\n');
        
        stream.write(csvData);
        stream.end();
        
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
        
        const latency = performance.now() - startTime;
        logger.info(`✅ Bulk inserted ${trades.length} trades in ${latency.toFixed(2)}ms`);
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('❌ Batch insert failed:', error);
      
      // Fallback to individual inserts
      await this.fallbackBatchInsert(trades);
    }
  }

  // Fallback to individual inserts if bulk insert fails
  async fallbackBatchInsert(trades) {
    const startTime = performance.now();
    
    try {
      const client = await this.writePool.connect();
      
      try {
        await client.query('BEGIN');
        
        for (const trade of trades) {
          await client.query('EXECUTE insertTrade', [
            trade.time || new Date(),
            trade.pair,
            trade.action,
            trade.amount,
            trade.price,
            trade.gas_used,
            trade.gas_price,
            trade.slippage,
            trade.profit_loss,
            trade.dex,
            trade.tx_hash,
            trade.status,
            trade.metadata ? JSON.stringify(trade.metadata) : null
          ]);
        }
        
        await client.query('COMMIT');
        
        const latency = performance.now() - startTime;
        logger.warn(`⚠️ Fallback batch insert: ${trades.length} trades in ${latency.toFixed(2)}ms`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('❌ Fallback batch insert failed:', error);
      throw error;
    }
  }

  // Fast trade insertion with prepared statement
  async insertTrade(trade) {
    const startTime = performance.now();
    
    try {
      const result = await this.writePool.query('EXECUTE insertTrade', [
        trade.time || new Date(),
        trade.pair,
        trade.action,
        trade.amount,
        trade.price,
        trade.gas_used,
        trade.gas_price,
        trade.slippage,
        trade.profit_loss,
        trade.dex,
        trade.tx_hash,
        trade.status,
        trade.metadata ? JSON.stringify(trade.metadata) : null
      ]);
      
      const latency = performance.now() - startTime;
      logger.debug(`Trade inserted in ${latency.toFixed(2)}ms`);
      
      return result.rows[0];
      
    } catch (error) {
      logger.error('❌ Trade insertion failed:', error);
      throw error;
    }
  }

  // Fast read with prepared statement
  async getRecentTrades(interval = '1 hour', limit = 100) {
    const startTime = performance.now();
    
    try {
      const result = await this.readPool.query('EXECUTE getRecentTrades', [interval, limit]);
      
      const latency = performance.now() - startTime;
      logger.debug(`Recent trades fetched in ${latency.toFixed(2)}ms`);
      
      return result.rows;
      
    } catch (error) {
      logger.error('❌ Get recent trades failed:', error);
      throw error;
    }
  }

  // Fast profit/loss update
  async updateProfitLoss(tradeId, profitLoss, status = 'completed') {
    const startTime = performance.now();
    
    try {
      await this.writePool.query('EXECUTE updateProfitLoss', [profitLoss, status, tradeId]);
      
      const latency = performance.now() - startTime;
      logger.debug(`Profit/loss updated in ${latency.toFixed(2)}ms`);
      
    } catch (error) {
      logger.error('❌ Update profit/loss failed:', error);
      throw error;
    }
  }

  // Fast trade statistics
  async getTradeStats(interval = '24 hours') {
    const startTime = performance.now();
    
    try {
      const result = await this.readPool.query('EXECUTE getTradeStats', [interval]);
      
      const latency = performance.now() - startTime;
      logger.debug(`Trade stats fetched in ${latency.toFixed(2)}ms`);
      
      return result.rows;
      
    } catch (error) {
      logger.error('❌ Get trade stats failed:', error);
      throw error;
    }
  }

  // Fast market data retrieval
  async getMarketData(pair, interval = '1 hour', limit = 1000) {
    const startTime = performance.now();
    
    try {
      const result = await this.readPool.query('EXECUTE getMarketData', [pair, interval, limit]);
      
      const latency = performance.now() - startTime;
      logger.debug(`Market data fetched in ${latency.toFixed(2)}ms`);
      
      return result.rows;
      
    } catch (error) {
      logger.error('❌ Get market data failed:', error);
      throw error;
    }
  }

  // Bulk insert market data
  async batchInsertMarketData(marketData) {
    if (!marketData || marketData.length === 0) return;

    const startTime = performance.now();
    
    try {
      const client = await this.writePool.connect();
      
      try {
        const stream = client.query(copyFrom(
          'COPY market_data (time, pair, price, volume, source) FROM STDIN WITH CSV'
        ));
        
        const csvData = marketData.map(data => {
          return [
            data.time || new Date().toISOString(),
            data.pair || '',
            data.price || 0,
            data.volume || 0,
            data.source || ''
          ].join(',');
        }).join('\n');
        
        stream.write(csvData);
        stream.end();
        
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
        
        const latency = performance.now() - startTime;
        logger.info(`✅ Bulk inserted ${marketData.length} market data points in ${latency.toFixed(2)}ms`);
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('❌ Batch market data insert failed:', error);
      throw error;
    }
  }

  // Database health check
  async healthCheck() {
    try {
      const startTime = performance.now();
      
      // Test write pool
      await this.writePool.query('SELECT 1');
      const writeLatency = performance.now() - startTime;
      
      // Test read pool
      const readStartTime = performance.now();
      await this.readPool.query('SELECT 1');
      const readLatency = performance.now() - readStartTime;
      
      return {
        status: 'healthy',
        writePool: {
          connected: true,
          latency: Math.round(writeLatency),
          idleConnections: this.writePool.idleCount,
          totalConnections: this.writePool.totalCount
        },
        readPool: {
          connected: true,
          latency: Math.round(readLatency),
          idleConnections: this.readPool.idleCount,
          totalConnections: this.readPool.totalCount
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Get database statistics
  async getDatabaseStats() {
    try {
      const queries = [
        'SELECT COUNT(*) as total_trades FROM trades',
        'SELECT COUNT(*) as total_market_data FROM market_data',
        'SELECT COUNT(*) as total_alerts FROM alerts',
        'SELECT COUNT(*) as total_logs FROM bot_logs',
        `SELECT 
           schemaname, 
           tablename, 
           pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
         FROM pg_tables 
         WHERE schemaname = 'public'
         ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC`
      ];
      
      const results = await Promise.all(
        queries.map(query => this.readPool.query(query))
      );
      
      return {
        totalTrades: parseInt(results[0].rows[0].total_trades),
        totalMarketData: parseInt(results[1].rows[0].total_market_data),
        totalAlerts: parseInt(results[2].rows[0].total_alerts),
        totalLogs: parseInt(results[3].rows[0].total_logs),
        tableSizes: results[4].rows
      };
      
    } catch (error) {
      logger.error('❌ Get database stats failed:', error);
      throw error;
    }
  }

  // Optimize database performance
  async optimizeDatabase() {
    try {
      const optimizationQueries = [
        'VACUUM ANALYZE trades',
        'VACUUM ANALYZE market_data',
        'VACUUM ANALYZE bot_logs',
        'VACUUM ANALYZE alerts',
        'REINDEX DATABASE trading_bot'
      ];
      
      for (const query of optimizationQueries) {
        try {
          await this.writePool.query(query);
          logger.info(`✅ Executed: ${query}`);
        } catch (error) {
          logger.warn(`⚠️ Failed to execute ${query}:`, error.message);
        }
      }
      
      logger.info('✅ Database optimization completed');
      
    } catch (error) {
      logger.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('🔄 Shutting down database connections...');
      
      await Promise.all([
        this.writePool.end(),
        this.readPool.end()
      ]);
      
      logger.info('✅ Database connections closed');
      
    } catch (error) {
      logger.error('❌ Error during database shutdown:', error);
      throw error;
    }
  }
}

module.exports = OptimizedDatabaseManager;

