const cron = require('node-cron');
const config = require('./config');
const logger = require('./logger');
const WalletManager = require('./walletManager');
const PancakeSwap = require('./pancakeSwap');
const RangingStrategy = require('./rangingStrategy');

class BSCRangingBot {
  constructor() {
    this.walletManager = new WalletManager();
    this.pancakeSwap = null;
    this.strategy = null;
    this.isRunning = false;
    this.stats = {
      startTime: null,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      lastPrice: null
    };
  }

  async initialize() {
    try {
      logger.info('Initializing BSC Ranging Bot...');

      // Connect wallet
      const walletInfo = await this.walletManager.connect();
      logger.info('Wallet connected:', walletInfo);

      // Initialize PancakeSwap
      this.pancakeSwap = new PancakeSwap(
        this.walletManager.getProvider(),
        this.walletManager.getWallet()
      );

      // Initialize strategy
      this.strategy = new RangingStrategy(this.pancakeSwap);
      await this.strategy.initialize();

      // Check initial balances
      const usdtBalance = await this.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.pancakeSwap.getBNBBalance();
      
      logger.info(`Initial Balances:`);
      logger.info(`USDT: ${usdtBalance.toFixed(2)}`);
      logger.info(`BNB: ${bnbBalance.toFixed(6)}`);

      // Check if we have enough balance to start
      if (usdtBalance < config.trading.minTradeAmount && bnbBalance < 0.001) {
        throw new Error('Insufficient balance to start trading');
      }

      this.stats.startTime = new Date();
      logger.info('Bot initialized successfully!');

      return true;
    } catch (error) {
      logger.error('Error initializing bot:', error);
      throw error;
    }
  }

  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Bot is already running');
        return;
      }

      await this.initialize();
      this.isRunning = true;

      logger.info('Starting BSC Ranging Bot...');
      logger.info(`Trading Pair: ${config.trading.pair}`);
      logger.info(`Initial Budget: ${config.trading.initialBudget} USDT`);
      logger.info(`Strategy: Ranging between ${config.strategy.lowerBoundPercent * 100}% and ${config.strategy.upperBoundPercent * 100}% of base price`);

      // Run strategy check every 30 seconds
      cron.schedule('*/30 * * * * *', async () => {
        if (this.isRunning) {
          await this.runStrategy();
        }
      });

      // Log status every 5 minutes
      cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning) {
          await this.logStatus();
        }
      });

      // Initial strategy run
      await this.runStrategy();

      logger.info('Bot started successfully!');
    } catch (error) {
      logger.error('Error starting bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async runStrategy() {
    try {
      const result = await this.strategy.checkAndExecute();
      
      if (result) {
        this.stats.lastPrice = result.currentPrice;
        
        // Log current status
        logger.info(`Strategy executed - Price: ${result.currentPrice.toFixed(6)}, Position: ${result.position}`);
      }
    } catch (error) {
      logger.error('Error running strategy:', error);
      this.stats.failedTrades++;
    }
  }

  async logStatus() {
    try {
      const usdtBalance = await this.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.pancakeSwap.getBNBBalance();
      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      
      const totalValue = usdtBalance + (bnbBalance * currentPrice);
      const profit = totalValue - config.trading.initialBudget;
      
      this.stats.totalProfit = profit;

      logger.info('=== BOT STATUS ===');
      logger.info(`Uptime: ${this.getUptime()}`);
      logger.info(`Current Price: ${currentPrice.toFixed(6)} BNB per USDT`);
      logger.info(`USDT Balance: ${usdtBalance.toFixed(2)}`);
      logger.info(`BNB Balance: ${bnbBalance.toFixed(6)}`);
      logger.info(`Total Value: ${totalValue.toFixed(2)} USDT`);
      logger.info(`Profit/Loss: ${profit.toFixed(2)} USDT (${((profit / config.trading.initialBudget) * 100).toFixed(2)}%)`);
      logger.info(`Total Trades: ${this.stats.totalTrades}`);
      logger.info(`Successful Trades: ${this.stats.successfulTrades}`);
      logger.info(`Failed Trades: ${this.stats.failedTrades}`);
      
      const strategyStatus = this.strategy.getStatus();
      logger.info(`Position: ${strategyStatus.position}`);
      logger.info(`Lower Bound: ${strategyStatus.lowerBound.toFixed(6)}`);
      logger.info(`Upper Bound: ${strategyStatus.upperBound.toFixed(6)}`);
      logger.info('==================');
    } catch (error) {
      logger.error('Error logging status:', error);
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
      logger.info('Stopping BSC Ranging Bot...');
      
      // Log final status
      await this.logStatus();
      
      // Disconnect wallet
      this.walletManager.disconnect();
      
      logger.info('Bot stopped successfully!');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
  }

  async emergencyStop() {
    try {
      logger.warn('EMERGENCY STOP INITIATED!');
      this.isRunning = false;
      
      // Log emergency status
      await this.logStatus();
      
      logger.warn('Emergency stop completed!');
    } catch (error) {
      logger.error('Error in emergency stop:', error);
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
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  if (global.bot) {
    global.bot.emergencyStop();
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (global.bot) {
    global.bot.emergencyStop();
  }
  process.exit(1);
});

// Start the bot
async function main() {
  try {
    global.bot = new BSCRangingBot();
    await global.bot.start();
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  main();
}

module.exports = BSCRangingBot;
