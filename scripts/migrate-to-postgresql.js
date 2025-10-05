const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'trading_bot',
  user: process.env.POSTGRES_USER || 'trading_bot',
  password: process.env.POSTGRES_PASSWORD || 'password'
};

// TimescaleDB extension setup
const setupTimescaleDB = `
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create optimized trades table
CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  pair VARCHAR(20) NOT NULL,
  action VARCHAR(10) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  gas_used DECIMAL(20, 8),
  gas_price DECIMAL(20, 8),
  slippage DECIMAL(5, 4),
  profit_loss DECIMAL(20, 8),
  dex VARCHAR(20),
  tx_hash VARCHAR(66) UNIQUE,
  status VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create market data table
CREATE TABLE IF NOT EXISTS market_data (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  pair VARCHAR(20) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8),
  source VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bot logs table
CREATE TABLE IF NOT EXISTS bot_logs (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  service VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create agent activity table
CREATE TABLE IF NOT EXISTS agent_activity (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  agent_name VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  result TEXT,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_time ON trades(time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_pair_time ON trades(pair, time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash);

CREATE INDEX IF NOT EXISTS idx_market_data_time ON market_data(time DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_pair_time ON market_data(pair, time DESC);

CREATE INDEX IF NOT EXISTS idx_bot_logs_time ON bot_logs(time DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON bot_logs(level);

CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

CREATE INDEX IF NOT EXISTS idx_agent_activity_time ON agent_activity(time DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity(agent_name);

-- Convert tables to hypertables for time-series optimization
SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);
SELECT create_hypertable('market_data', 'time', if_not_exists => TRUE);
SELECT create_hypertable('bot_logs', 'time', if_not_exists => TRUE);
SELECT create_hypertable('alerts', 'time', if_not_exists => TRUE);
SELECT create_hypertable('agent_activity', 'time', if_not_exists => TRUE);

-- Add compression policies for older data
ALTER TABLE trades SET (timescaledb.compress, timescaledb.compress_segmentby = 'pair');
ALTER TABLE market_data SET (timescaledb.compress, timescaledb.compress_segmentby = 'pair');
ALTER TABLE bot_logs SET (timescaledb.compress);
ALTER TABLE alerts SET (timescaledb.compress);
ALTER TABLE agent_activity SET (timescaledb.compress);

-- Add compression policies (compress data older than 7 days)
SELECT add_compression_policy('trades', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('market_data', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('bot_logs', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('alerts', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_compression_policy('agent_activity', INTERVAL '30 days', if_not_exists => TRUE);

-- Add retention policies (keep data for 1 year)
SELECT add_retention_policy('trades', INTERVAL '1 year', if_not_exists => TRUE);
SELECT add_retention_policy('market_data', INTERVAL '6 months', if_not_exists => TRUE);
SELECT add_retention_policy('bot_logs', INTERVAL '3 months', if_not_exists => TRUE);
SELECT add_retention_policy('alerts', INTERVAL '6 months', if_not_exists => TRUE);
SELECT add_retention_policy('agent_activity', INTERVAL '3 months', if_not_exists => TRUE);
`;

class DatabaseMigrator {
  constructor() {
    this.client = null;
    this.sqlitePath = path.join(__dirname, '../database/trading_bot.db');
  }

  async connect() {
    try {
      this.client = new Client(pgConfig);
      await this.client.connect();
      logger.info('✅ Connected to PostgreSQL database');
    } catch (error) {
      logger.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async setupTimescaleDB() {
    try {
      logger.info('🔧 Setting up TimescaleDB extension and tables...');
      await this.client.query(setupTimescaleDB);
      logger.info('✅ TimescaleDB setup completed');
    } catch (error) {
      logger.error('❌ TimescaleDB setup failed:', error);
      throw error;
    }
  }

  async migrateData() {
    try {
      // Check if SQLite database exists
      if (!fs.existsSync(this.sqlitePath)) {
        logger.warn('⚠️ SQLite database not found, skipping data migration');
        return;
      }

      logger.info('📦 Migrating data from SQLite to PostgreSQL...');

      // Import SQLite data (simplified version - in production, use proper migration tools)
      const sqlite = require('sqlite3').verbose();
      const sqliteDb = new sqlite.Database(this.sqlitePath);

      // Migrate trades
      await this.migrateTable(sqliteDb, 'trades', 'trades');
      
      // Migrate market data
      await this.migrateTable(sqliteDb, 'market_data', 'market_data');
      
      // Migrate bot logs
      await this.migrateTable(sqliteDb, 'bot_logs', 'bot_logs');
      
      // Migrate alerts
      await this.migrateTable(sqliteDb, 'alerts', 'alerts');
      
      // Migrate agent activity
      await this.migrateTable(sqliteDb, 'agent_activity', 'agent_activity');

      sqliteDb.close();
      logger.info('✅ Data migration completed');

    } catch (error) {
      logger.error('❌ Data migration failed:', error);
      throw error;
    }
  }

  async migrateTable(sqliteDb, tableName, pgTableName) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
        if (err) {
          logger.warn(`⚠️ Table ${tableName} not found or error reading: ${err.message}`);
          resolve();
          return;
        }

        if (rows.length === 0) {
          logger.info(`📋 Table ${tableName} is empty, skipping migration`);
          resolve();
          return;
        }

        logger.info(`📋 Migrating ${rows.length} records from ${tableName}`);

        try {
          for (const row of rows) {
            // Convert SQLite row to PostgreSQL format
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row).map(value => 
              value === null ? 'NULL' : 
              typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : 
              value
            ).join(', ');

            const insertQuery = `INSERT INTO ${pgTableName} (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING`;
            await this.client.query(insertQuery);
          }

          logger.info(`✅ Migrated ${rows.length} records to ${pgTableName}`);
        } catch (error) {
          logger.error(`❌ Error migrating ${tableName}:`, error);
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async createConnectionPool() {
    try {
      // Create connection pool configuration
      const poolConfig = `
-- Connection pool settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Reload configuration
SELECT pg_reload_conf();
`;

      await this.client.query(poolConfig);
      logger.info('✅ PostgreSQL connection pool configured');

    } catch (error) {
      logger.warn('⚠️ Could not configure connection pool (requires superuser):', error.message);
    }
  }

  async verifyMigration() {
    try {
      logger.info('🔍 Verifying migration...');

      const tables = ['trades', 'market_data', 'bot_logs', 'alerts', 'agent_activity'];
      
      for (const table of tables) {
        const result = await this.client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        logger.info(`📊 ${table}: ${count} records`);
      }

      // Check TimescaleDB hypertables
      const hypertables = await this.client.query(`
        SELECT table_name, num_dimensions 
        FROM timescaledb_information.hypertables
      `);
      
      logger.info('📈 TimescaleDB hypertables:');
      hypertables.rows.forEach(row => {
        logger.info(`  - ${row.table_name} (${row.num_dimensions} dimensions)`);
      });

      logger.info('✅ Migration verification completed');

    } catch (error) {
      logger.error('❌ Migration verification failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      logger.info('✅ PostgreSQL connection closed');
    }
  }

  async runMigration() {
    try {
      logger.info('🚀 Starting database migration to PostgreSQL + TimescaleDB...');

      await this.connect();
      await this.setupTimescaleDB();
      await this.migrateData();
      await this.createConnectionPool();
      await this.verifyMigration();

      logger.info('🎉 Database migration completed successfully!');
      
      // Create .env update script
      this.createEnvUpdate();

    } catch (error) {
      logger.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  createEnvUpdate() {
    const envUpdate = `
# PostgreSQL Configuration (add to .env file)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=trading_bot
POSTGRES_USER=trading_bot
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration (add to .env file)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# BSCScan API Key for contract verification
BSCSCAN_API_KEY=your_bscscan_api_key
`;

    fs.writeFileSync(path.join(__dirname, '../.env.postgresql'), envUpdate);
    logger.info('📝 Created .env.postgresql with new configuration');
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  migrator.runMigration().catch(error => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = DatabaseMigrator;

