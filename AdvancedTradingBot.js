const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
let RateLimiterMemory;
try {
  RateLimiterMemory = require('rate-limiter-flexible').RateLimiterMemory;
} catch (error) {
  console.log('Rate limiter not available, using simple fallback');
  RateLimiterMemory = null;
}

// Import existing modules
const config = require('./config');
const logger = require('./logger');
const WalletManager = require('./walletManager');
const MultiDexManager = require('./dex/multiDexManager');
const MultiPairManager = require('./trading/multiPairManager');
const AvantisIntegration = require('./leverage/avantisIntegration');
const TechnicalAnalysis = require('./analysis/technicalAnalysis');
const RangingStrategy = require('./rangingStrategy');

// Import new AI modules
const MarketResearchAgent = require('./agents/MarketResearchAgent');
const TradingStrategyAgent = require('./agents/TradingStrategyAgent');
const RAGSystem = require('./rag/RAGSystem');
const { sequelize, Trade, MarketData, BotLog, Alert, AgentActivity } = require('./database/models');

// Import critical security and optimization modules
const SecureKeyManager = require('./security/keyManager');
const CircuitBreaker = require('./risk/circuitBreaker');
const GasOptimizer = require('./optimization/gasOptimizer');
const MetricsCollector = require('./monitoring/metricsCollector');
const EventManager = require('./events/eventManager');
const PriceHistoryManager = require('./optimization/priceHistoryManager');
const CacheManager = require('./optimization/cacheManager');
const MEVProtection = require('./security/mevProtection');
const SmartContractVerifier = require('./security/contractVerifier');

class AdvancedTradingBot {
  constructor() {
    this.walletManager = new WalletManager();
    this.multiDexManager = null;
    this.multiPairManager = null;
    this.avantisIntegration = null;
    this.technicalAnalysis = null;
    this.strategy = null;
    this.isRunning = false;
    
    // AI Agents
    this.marketResearchAgent = new MarketResearchAgent();
    this.tradingStrategyAgent = null; // Will be initialized after PancakeSwap
    this.ragSystem = new RAGSystem();
    
    // Critical security and optimization components
    this.keyManager = new SecureKeyManager();
    this.circuitBreaker = new CircuitBreaker();
    this.gasOptimizer = null; // Will be initialized with provider
    this.metricsCollector = new MetricsCollector();
    this.eventManager = new EventManager();
    this.priceHistoryManager = new PriceHistoryManager();
    this.cacheManager = new CacheManager();
    this.mevProtection = null; // Will be initialized with provider and wallet
    this.contractVerifier = null; // Will be initialized with provider
    
    // API Server
    this.app = null;
    this.server = null;
    
    // Rate limiter
    if (RateLimiterMemory) {
      this.rateLimiter = new RateLimiterMemory({
        keyPrefix: 'trading_bot',
        points: 100, // Number of requests
        duration: 60, // Per 60 seconds
      });
    } else {
      this.rateLimiter = null;
    }
    
    this.stats = {
      startTime: null,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      lastPrice: null,
      agents: {
        marketResearch: { executions: 0, success: 0, lastActivity: null },
        tradingStrategy: { executions: 0, success: 0, lastActivity: null }
      }
    };
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Advanced BSC Trading Bot...');

      // Initialize database
      await sequelize.authenticate();
      logger.info('✅ Database connected');

      // Initialize RAG system
      await this.ragSystem.initialize();
      logger.info('✅ RAG system initialized');

      // Initialize security components with provider
      this.gasOptimizer = new GasOptimizer(this.walletManager.getProvider());
      this.mevProtection = new MEVProtection(this.walletManager.getProvider(), this.walletManager.getWallet());
      this.contractVerifier = new SmartContractVerifier(this.walletManager.getProvider());

      // Connect wallet (using KeyManager for secure key handling)
      const privateKey = this.keyManager.getDecryptedKey(process.env.ENCRYPTED_PRIVATE_KEY, process.env.KEY_PASSWORD);
      const walletInfo = await this.walletManager.connect(privateKey);
      logger.info('✅ Wallet connected:', walletInfo);

      // Initialize Multi-DEX Manager
      this.multiDexManager = new MultiDexManager(
        this.walletManager.getProvider(),
        this.walletManager.getWallet()
      );
      
      // Initialize Multi-Pair Manager
      this.multiPairManager = new MultiPairManager();
      
      // Initialize Leverage Integration
      this.avantisIntegration = new AvantisIntegration(
        this.walletManager.getProvider(),
        this.walletManager.getWallet()
      );
      
      // Initialize Technical Analysis
      this.technicalAnalysis = new TechnicalAnalysis();

      // Initialize trading strategy agent (using first DEX for compatibility)
      this.tradingStrategyAgent = new TradingStrategyAgent(this.multiDexManager.dexs.pancakeSwap);

      // Initialize strategy (using first DEX for compatibility)
      this.strategy = new RangingStrategy(this.multiDexManager.dexs.pancakeSwap);
      await this.strategy.initialize();

      // Check initial balances
      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
      
      logger.info(`Initial Balances:`);
      logger.info(`USDT: ${usdtBalance.toFixed(2)}`);
      logger.info(`BNB: ${bnbBalance.toFixed(6)}`);

      // Store initial market data
      await this.storeMarketData({
        symbol: 'USDT/BNB',
        price: await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice(),
        volume: 0,
        timestamp: new Date()
      });

      // Check if we have enough balance to start
      if (usdtBalance < config.trading.minTradeAmount && bnbBalance < 0.001) {
        throw new Error('Insufficient balance to start trading');
      }

      this.stats.startTime = new Date();
      
      // Initialize API server
      await this.initializeAPI();
      
      logger.info('✅ Advanced Trading Bot initialized successfully!');
      return true;
    } catch (error) {
      logger.error('❌ Error initializing bot:', error);
      await this.logError('initialization', error);
      throw error;
    }
  }

  async initializeAPI() {
    this.app = express();
    
    // Middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    
    // Rate limiting
    if (this.rateLimiter) {
      this.app.use(async (req, res, next) => {
        try {
          await this.rateLimiter.consume(req.ip);
          next();
        } catch (rejRes) {
          res.status(429).json({ error: 'Too many requests' });
        }
      });
    }

    // API Routes
    this.setupAPIRoutes();
    
    // Start server
    const PORT = process.env.API_PORT || 3001;
    this.server = this.app.listen(PORT, () => {
      logger.info(`🌐 API server running on port ${PORT}`);
    });
  }

  setupAPIRoutes() {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date(),
          uptime: this.getUptime(),
          bot: {
            running: this.isRunning,
            startTime: this.stats.startTime
          },
          agents: {
            marketResearch: await this.marketResearchAgent.healthCheck(),
            tradingStrategy: await this.tradingStrategyAgent.healthCheck()
          },
          rag: await this.ragSystem.healthCheck()
        };
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bot status
    this.app.get('/api/status', async (req, res) => {
      try {
        const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
        const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
        const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
        
        const totalValue = usdtBalance + (bnbBalance * currentPrice);
        const profit = totalValue - config.trading.initialBudget;

        const status = {
          status: 'healthy',
          running: this.isRunning,
          balances: {
            usdt: usdtBalance,
            bnb: bnbBalance,
            totalValue: totalValue
          },
          performance: {
            profit: profit,
            profitPercent: (profit / config.trading.initialBudget) * 100,
            totalTrades: this.stats.totalTrades,
            successRate: this.stats.totalTrades > 0 ? (this.stats.successfulTrades / this.stats.totalTrades) * 100 : 0
          },
          currentPrice: currentPrice,
          strategy: this.strategy.getStatus(),
          uptime: this.getUptime()
        };

        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // RAG query endpoint
    this.app.post('/api/rag/query', async (req, res) => {
      try {
        const { query, contextTypes } = req.body;
        
        if (!query) {
          return res.status(400).json({ error: 'Query is required' });
        }

        const result = await this.ragSystem.query(query, contextTypes);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Market analysis
    this.app.get('/api/market/analysis', async (req, res) => {
      try {
        const analysis = await this.marketResearchAgent.execute({
          action: 'research',
          query: 'BSC BNB USDT market analysis',
          timeframe: '24h'
        });
        
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Trading logs
    this.app.get('/api/trades', async (req, res) => {
      try {
        const { limit = 50, offset = 0 } = req.query;
        
        const trades = await Trade.findAndCountAll({
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['created_at', 'DESC']]
        });
        
        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bot logs
    this.app.get('/api/logs', async (req, res) => {
      try {
        const { level, limit = 100 } = req.query;
        
        const where = {};
        if (level) where.level = level;
        
        const logs = await BotLog.findAll({
          where,
          limit: parseInt(limit),
          order: [['created_at', 'DESC']]
        });
        
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Agent activity
    this.app.get('/api/agents/activity', async (req, res) => {
      try {
        const { agent_name, limit = 50 } = req.query;
        
        const where = {};
        if (agent_name) where.agent_name = agent_name;
        
        const activity = await AgentActivity.findAll({
          where,
          limit: parseInt(limit),
          order: [['created_at', 'DESC']]
        });
        
        res.json(activity);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Control endpoints
    this.app.post('/api/control/start', async (req, res) => {
      try {
        if (this.isRunning) {
          return res.json({ message: 'Bot is already running' });
        }
        
        await this.start();
        res.json({ message: 'Bot started successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/control/stop', async (req, res) => {
      try {
        if (!this.isRunning) {
          return res.json({ message: 'Bot is not running' });
        }
        
        await this.stop();
        res.json({ message: 'Bot stopped successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/control/emergency-stop', async (req, res) => {
      try {
        await this.emergencyStop();
        res.json({ message: 'Emergency stop executed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Bot is already running');
        return;
      }

      await this.initialize();
      this.isRunning = true;

      logger.info('🚀 Starting Advanced BSC Trading Bot...');
      logger.info(`Trading Pair: ${config.trading.pair}`);
      logger.info(`Initial Budget: ${config.trading.initialBudget} USDT`);

      // Enhanced strategy execution with AI agents
      cron.schedule('*/30 * * * * *', async () => {
        if (this.isRunning) {
          await this.runAdvancedStrategy();
        }
      });

      // Market research every 5 minutes
      cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning) {
          await this.performMarketResearch();
        }
      });

      // Log status every 10 minutes
      cron.schedule('*/10 * * * *', async () => {
        if (this.isRunning) {
          await this.logStatus();
        }
      });

      // Data cleanup every hour
      cron.schedule('0 * * * *', async () => {
        if (this.isRunning) {
          await this.performDataCleanup();
        }
      });

      // Initial strategy run
      await this.runAdvancedStrategy();

      logger.info('✅ Advanced Trading Bot started successfully!');
    } catch (error) {
      logger.error('❌ Error starting bot:', error);
      this.isRunning = false;
      await this.logError('startup', error);
      throw error;
    }
  }

  async runAdvancedStrategy() {
    try {
      // Get current market data
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();

      // Store market data
      await this.storeMarketData({
        symbol: 'USDT/BNB',
        price: currentPrice,
        volume: 0, // Would be fetched from DEX API
        timestamp: new Date()
      });

      // Get AI-powered market analysis
      const marketAnalysis = await this.tradingStrategyAgent.execute({
        action: 'analyze',
        marketData: {
          currentPrice,
          priceHistory: await this.getPriceHistory(100)
        },
        researchData: this.latestResearchData
      });

      // Make AI-powered trading decision
      const tradingDecision = await this.tradingStrategyAgent.execute({
        action: 'decide',
        strategy: marketAnalysis.recommended_strategy || 'ranging',
        marketData: {
          currentPrice,
          priceHistory: await this.getPriceHistory(50)
        },
        researchData: this.latestResearchData
      });

      // Execute decision if confidence is high enough
      if (tradingDecision.confidence > 0.7) {
        await this.executeTradingDecision(tradingDecision);
      }

      // Store trading log in RAG system
      await this.ragSystem.storeTradingLog({
        action: tradingDecision.action,
        pair: 'USDT/BNB',
        amount: tradingDecision.position_size || 0,
        price: currentPrice,
        timestamp: new Date(),
        reasoning: tradingDecision.reasoning,
        success: tradingDecision.action !== 'hold'
      });

      this.stats.lastPrice = currentPrice;
      
      logger.info(`🧠 AI Strategy executed - Action: ${tradingDecision.action}, Confidence: ${(tradingDecision.confidence * 100).toFixed(1)}%, Reasoning: ${tradingDecision.reasoning}`);
      
    } catch (error) {
      logger.error('❌ Error running advanced strategy:', error);
      this.stats.failedTrades++;
      await this.logError('strategy_execution', error);
    }
  }

  async executeTradingDecision(decision) {
    try {
      const { action, position_size, parameters } = decision;
      
      if (action === 'hold') {
        return;
      }

      let receipt = null;

      if (action === 'buy' && position_size > 0) {
        const minBnbAmount = ethers.parseEther((position_size / parameters.currentPrice * 0.995).toString());
        receipt = await this.multiDexManager.dexs.pancakeSwap.swapUSDTForBNB(position_size, minBnbAmount);
      } else if (action === 'sell' && position_size > 0) {
        const minUsdtAmount = ethers.parseEther((position_size * parameters.currentPrice * 0.995).toString());
        receipt = await this.multiDexManager.dexs.pancakeSwap.swapBNBForUSDT(position_size, minUsdtAmount);
      }

      if (receipt && receipt.transactionHash) {
        // Store trade in database
        await Trade.create({
          type: action,
          token_pair: 'USDT/BNB',
          amount_in: position_size,
          amount_out: action === 'buy' ? position_size / parameters.currentPrice : position_size * parameters.currentPrice,
          price: parameters.currentPrice,
          transaction_hash: receipt.transactionHash,
          status: 'completed',
          strategy: decision.reasoning,
          profit_loss: 0 // Would calculate based on previous trades
        });

        this.stats.totalTrades++;
        this.stats.successfulTrades++;

        // Create success alert
        await Alert.create({
          type: 'trade',
          severity: 'medium',
          title: `Trade Executed: ${action.toUpperCase()}`,
          message: `Successfully executed ${action} order for ${position_size} USDT/BNB at ${parameters.currentPrice}`,
          triggered_by: 'AI Strategy Agent',
          acknowledged: false
        });

        logger.info(`✅ Trade executed successfully: ${receipt.transactionHash}`);
      }

    } catch (error) {
      logger.error('❌ Error executing trading decision:', error);
      this.stats.failedTrades++;
      
      // Create error alert
      await Alert.create({
        type: 'trade',
        severity: 'high',
        title: `Trade Execution Failed: ${decision.action.toUpperCase()}`,
        message: `Failed to execute ${decision.action} order: ${error.message}`,
        triggered_by: 'AI Strategy Agent',
        acknowledged: false
      });
      
      throw error;
    }
  }

  async performMarketResearch() {
    try {
      logger.info('🔍 Performing market research...');
      
      const research = await this.marketResearchAgent.execute({
        action: 'research',
        query: 'BSC BNB USDT',
        timeframe: '24h'
      });

      this.latestResearchData = research;
      this.stats.agents.marketResearch.executions++;
      this.stats.agents.marketResearch.success++;
      this.stats.agents.marketResearch.lastActivity = new Date();

      // Store news articles in RAG system
      if (research.news && research.news.length > 0) {
        for (const article of research.news.slice(0, 5)) {
          await this.ragSystem.storeNewsArticle(article);
        }
      }

      logger.info(`✅ Market research completed - Found ${research.news?.length || 0} articles, Sentiment: ${research.sentiment?.sentiment || 'neutral'}`);
      
    } catch (error) {
      logger.error('❌ Error performing market research:', error);
      this.stats.agents.marketResearch.executions++;
      await this.logError('market_research', error);
    }
  }

  async storeMarketData(data) {
    try {
      await MarketData.create({
        token_pair: data.symbol,
        price: data.price,
        volume_24h: data.volume,
        source: 'pancakeswap',
        price_change_24h: 0 // Would calculate from historical data
      });

      await this.ragSystem.storeMarketData(data);
    } catch (error) {
      logger.error('Error storing market data:', error);
    }
  }

  async getPriceHistory(limit = 100) {
    try {
      const marketData = await MarketData.findAll({
        limit,
        order: [['created_at', 'DESC']]
      });

      return marketData.map(data => ({
        timestamp: data.created_at,
        price: parseFloat(data.price)
      }));
    } catch (error) {
      logger.error('Error getting price history:', error);
      return [];
    }
  }

  async logStatus() {
    try {
      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      
      const totalValue = usdtBalance + (bnbBalance * currentPrice);
      const profit = totalValue - config.trading.initialBudget;
      
      this.stats.totalProfit = profit;

      const status = {
        uptime: this.getUptime(),
        currentPrice: currentPrice.toFixed(6),
        usdtBalance: usdtBalance.toFixed(2),
        bnbBalance: bnbBalance.toFixed(6),
        totalValue: totalValue.toFixed(2),
        profit: profit.toFixed(2),
        profitPercent: ((profit / config.trading.initialBudget) * 100).toFixed(2),
        totalTrades: this.stats.totalTrades,
        successfulTrades: this.stats.successfulTrades,
        failedTrades: this.stats.failedTrades,
        agents: this.stats.agents
      };

      logger.info('=== ADVANCED BOT STATUS ===');
      logger.info(`Uptime: ${status.uptime}`);
      logger.info(`Current Price: ${status.currentPrice} BNB per USDT`);
      logger.info(`USDT Balance: ${status.usdtBalance}`);
      logger.info(`BNB Balance: ${status.bnbBalance}`);
      logger.info(`Total Value: ${status.totalValue} USDT`);
      logger.info(`Profit/Loss: ${status.profit} USDT (${status.profitPercent}%)`);
      logger.info(`Total Trades: ${status.totalTrades}`);
      logger.info(`Success Rate: ${this.stats.totalTrades > 0 ? ((this.stats.successfulTrades / this.stats.totalTrades) * 100).toFixed(1) : 0}%`);
      logger.info('==========================');

      // Store status in database
      await BotLog.create({
        level: 'info',
        message: 'Bot status logged',
        component: 'status_logger',
        action: 'log_status',
        metadata: status
      });

    } catch (error) {
      logger.error('❌ Error logging status:', error);
    }
  }

  async performDataCleanup() {
    try {
      logger.info('🧹 Performing data cleanup...');
      
      // Clean old logs (keep last 10000)
      const oldLogs = await BotLog.findAll({
        order: [['created_at', 'DESC']],
        offset: 10000
      });
      
      if (oldLogs.length > 0) {
        await BotLog.destroy({
          where: {
            id: oldLogs.map(log => log.id)
          }
        });
        logger.info(`Cleaned up ${oldLogs.length} old log entries`);
      }

      // Clean old market data (keep last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await MarketData.destroy({
        where: {
          created_at: {
            [sequelize.Sequelize.Op.lt]: sevenDaysAgo
          }
        }
      });

      logger.info('✅ Data cleanup completed');
      
    } catch (error) {
      logger.error('❌ Error during data cleanup:', error);
    }
  }

  async logError(component, error) {
    try {
      await BotLog.create({
        level: 'error',
        message: error.message,
        component: component,
        action: 'error_handling',
        metadata: {
          stack: error.stack,
          timestamp: new Date()
        },
        error_stack: error.stack
      });

      await Alert.create({
        type: 'system',
        severity: 'high',
        title: `Error in ${component}`,
        message: error.message,
        triggered_by: component,
        acknowledged: false
      });
    } catch (logError) {
      logger.error('Failed to log error:', logError);
    }
  }

  getUptime() {
    if (!this.stats.startTime) return '0s';
    
    const uptime = Date.now() - this.stats.startTime.getTime();
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  async stop() {
    try {
      this.isRunning = false;
      logger.info('🛑 Stopping Advanced Trading Bot...');
      
      // Log final status
      await this.logStatus();
      
      // Close API server
      if (this.server) {
        this.server.close();
        logger.info('🌐 API server stopped');
      }
      
      // Close RAG system
      await this.ragSystem.close();
      
      // Disconnect wallet
      this.walletManager.disconnect();
      
      logger.info('✅ Advanced Trading Bot stopped successfully!');
    } catch (error) {
      logger.error('❌ Error stopping bot:', error);
    }
  }

  async emergencyStop() {
    try {
      logger.warn('🚨 EMERGENCY STOP INITIATED!');
      this.isRunning = false;
      
      // Log emergency status
      await this.logStatus();
      
      // Create emergency alert
      await Alert.create({
        type: 'system',
        severity: 'critical',
        title: 'Emergency Stop Executed',
        message: 'Trading bot has been emergency stopped',
        triggered_by: 'emergency_stop',
        acknowledged: false
      });
      
      logger.warn('🚨 Emergency stop completed!');
    } catch (error) {
      logger.error('❌ Error in emergency stop:', error);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (global.bot) {
    await global.bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (global.bot) {
    await global.bot.stop();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  if (global.bot) {
    await global.bot.emergencyStop();
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (global.bot) {
    await global.bot.emergencyStop();
  }
  process.exit(1);
});

// Start the bot
async function main() {
  try {
    global.bot = new AdvancedTradingBot();
    await global.bot.start();
  } catch (error) {
    logger.error('Failed to start advanced bot:', error);
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  main();
}

module.exports = AdvancedTradingBot;
