const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../data/trading_bot.db'),
  logging: false, // Set to console.log for debugging
  define: {
    timestamps: true,
    underscored: true,
  }
});

// Trade Model
const Trade = sequelize.define('Trade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('buy', 'sell', 'rebalance'),
    allowNull: false
  },
  token_pair: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount_in: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  amount_out: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  slippage: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true
  },
  gas_used: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  gas_price: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  transaction_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  block_number: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  strategy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profit_loss: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  }
});

// Market Data Model
const MarketData = sequelize.define('MarketData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  token_pair: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  volume_24h: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  market_cap: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  price_change_24h: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Bot Log Model
const BotLog = sequelize.define('BotLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  level: {
    type: DataTypes.ENUM('error', 'warn', 'info', 'debug'),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  component: {
    type: DataTypes.STRING,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  error_stack: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Strategy Performance Model
const StrategyPerformance = sequelize.define('StrategyPerformance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  strategy_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  period_start: {
    type: DataTypes.DATE,
    allowNull: false
  },
  period_end: {
    type: DataTypes.DATE,
    allowNull: false
  },
  total_trades: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  successful_trades: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failed_trades: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_profit: {
    type: DataTypes.DECIMAL(20, 8),
    defaultValue: 0
  },
  total_volume: {
    type: DataTypes.DECIMAL(20, 8),
    defaultValue: 0
  },
  win_rate: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0
  },
  sharpe_ratio: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: true
  },
  max_drawdown: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: true
  }
});

// News and Research Model
const NewsArticle = sequelize.define('NewsArticle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  sentiment: {
    type: DataTypes.ENUM('positive', 'negative', 'neutral'),
    allowNull: true
  },
  relevance_score: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true
  }
});

// Alert Model
const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('price', 'volume', 'news', 'system', 'trade'),
    allowNull: false
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  triggered_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  acknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  acknowledged_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

// Agent Activity Model
const AgentActivity = sequelize.define('AgentActivity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  agent_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  input: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  output: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  execution_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
});

// Grid State Model
const GridState = sequelize.define('GridState', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  token_pair: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'BNB/USDT'
  },
  upper_bound: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  lower_bound: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  grid_levels: {
    type: DataTypes.JSON,
    allowNull: false
  },
  last_price: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  last_updated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
});

// Define associations
Trade.belongsTo(StrategyPerformance, { foreignKey: 'strategy_performance_id' });
StrategyPerformance.hasMany(Trade, { foreignKey: 'strategy_performance_id' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  Trade,
  MarketData,
  BotLog,
  StrategyPerformance,
  NewsArticle,
  Alert,
  AgentActivity,
  GridState
};
