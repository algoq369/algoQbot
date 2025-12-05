const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Monitoring Updater - Updates monitoring-summary.json with real-time data
 * Ensures monitoring data is always current for dashboard and health checks
 */
class MonitoringUpdater {
  constructor(bot) {
    this.bot = bot;
    this.updateInterval = 60000; // Update every minute
    this.filePath = path.join(__dirname, '../data/monitoring-summary.json');
    this.updateTimer = null;
  }

  /**
   * Start automatic monitoring updates
   */
  start() {
    if (this.updateTimer) {
      logger.warn('⚠️ Monitoring updater already running');
      return;
    }

    // Initial update
    this.update().catch(err => {
      logger.error('Error in initial monitoring update:', err);
    });

    // Schedule periodic updates
    this.updateTimer = setInterval(() => {
      this.update().catch(err => {
        logger.error('Error in periodic monitoring update:', err);
      });
    }, this.updateInterval);

    logger.info(`✅ Monitoring updater started (updates every ${this.updateInterval / 1000}s)`);
  }

  /**
   * Stop automatic monitoring updates
   */
  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      logger.info('⏸️ Monitoring updater stopped');
    }
  }

  /**
   * Update monitoring summary with current bot state
   */
  async update() {
    try {
      const startTime = Date.now();
      
      // Gather current bot state
      const monitoringData = await this.gatherMonitoringData();
      
      // Write to file
      await this.writeMonitoringData(monitoringData);
      
      const duration = Date.now() - startTime;
      logger.debug(`📊 Monitoring summary updated (${duration}ms)`);
      
      return monitoringData;
    } catch (error) {
      logger.errorWithContext(error, {
        operation: 'updateMonitoringSummary',
        filePath: this.filePath
      });
      throw error;
    }
  }

  /**
   * Gather current monitoring data from bot
   */
  async gatherMonitoringData() {
    const timestamp = new Date().toISOString();
    
    try {
      // Get current price
      let currentPrice = 0;
      try {
        currentPrice = await this.bot.getCurrentPrice();
      } catch (err) {
        logger.warn('Failed to get current price for monitoring:', err.message);
      }

      // Get portfolio balances
      let balances = { usdt: 0, bnb: 0 };
      try {
        balances = await this.bot.getBalance();
      } catch (err) {
        logger.warn('Failed to get balances for monitoring:', err.message);
      }

      // Get active positions
      const activePositions = this.bot.activePositions || new Map();
      const positions = Array.from(activePositions.values()).map(pos => ({
        id: pos.id || pos.positionId,
        profitPercent: pos.profitPercent || 0,
        entryPrice: pos.entryPrice || 0,
        side: pos.side || 'unknown',
        size: pos.size || 0
      }));

      // Get market regime
      const regime = this.bot.tradingStrategyAgent?.currentRegime || 'UNKNOWN';
      const volatility = this.bot.tradingStrategyAgent?.currentVolatility4h || 0;

      // Get risk manager state
      const riskState = this.bot.riskManager?.state || {};
      const drawdown = this.bot.riskManager?.state?.peakPortfolioValue > 0
        ? ((this.bot.riskManager.state.peakPortfolioValue - (this.bot.riskManager.state.portfolioValue || 0)) / this.bot.riskManager.state.peakPortfolioValue) * 100
        : 0;

      // Get circuit breaker status
      const circuitBreakerStatus = this.bot.circuitBreaker?.getStatus() || {};

      // Calculate portfolio value
      const portfolioValue = balances.usdt + (balances.bnb / (currentPrice || 1));

      // Get bot uptime
      const uptime = this.bot.startTime ? Date.now() - this.bot.startTime : 0;
      const uptimeDays = Math.floor(uptime / (1000 * 60 * 60 * 24));

      // ✅ Get institutional indicators from last calculation
      const lastIndicators = this.bot.tradingStrategyAgent?.lastIndicatorResults || {};
      const indicatorBreakdown = lastIndicators.indicatorBreakdown || {};
      const institutionalDetails = lastIndicators.institutionalDetails || {};
      
      // Format institutional indicators for dashboard
      const formatIndicatorScore = (score) => {
        if (score === undefined || score === null || isNaN(score)) return null;
        const percent = (score * 100).toFixed(1);
        return score >= 0 ? `+${percent}%` : `${percent}%`;
      };

      const institutionalIndicators = {
        orderFlow: {
          score: formatIndicatorScore(indicatorBreakdown.orderFlow),
          delta: institutionalDetails.orderFlow?.data?.deltaPercent 
            ? `${(institutionalDetails.orderFlow.data.deltaPercent * 100).toFixed(1)}%` 
            : null
        },
        volumeProfile: {
          score: formatIndicatorScore(indicatorBreakdown.volumeProfile),
          poc: institutionalDetails.volumeProfile?.data?.poc || null
        },
        liquidity: {
          score: formatIndicatorScore(indicatorBreakdown.liquidity),
          ratio: institutionalDetails.liquidity?.data?.ratio 
            ? `${(institutionalDetails.liquidity.data.ratio * 100).toFixed(1)}%` 
            : null
        },
        vwap: {
          score: formatIndicatorScore(indicatorBreakdown.vwap)
        },
        atr: {
          score: formatIndicatorScore(indicatorBreakdown.atr)
        },
        regime: {
          score: formatIndicatorScore(indicatorBreakdown.regime)
        },
        finalConfidence: lastIndicators.finalConfidence 
          ? `${(lastIndicators.finalConfidence * 100).toFixed(1)}%` 
          : null
      };

      return {
        timestamp,
        botStatus: {
          isRunning: this.bot.isRunning || false,
          uptime: uptimeDays,
          uptimeMs: uptime,
          shadowMode: this.bot.shadowMode?.isActive || false
        },
        marketStatus: {
          currentPrice,
          regime,
          volatility: volatility * 100, // Convert to percentage
          volatilityPercent: `${(volatility * 100).toFixed(2)}%`
        },
        portfolio: {
          usdt: balances.usdt,
          bnb: balances.bnb,
          totalValue: portfolioValue,
          bnbPercent: currentPrice > 0 ? ((balances.bnb / currentPrice) / portfolioValue) * 100 : 0
        },
        positions: {
          active: positions.length,
          positions: positions,
          exitedPositions: [] // Could be populated from trade history
        },
        risk: {
          drawdown: drawdown.toFixed(2),
          drawdownPercent: `${drawdown.toFixed(2)}%`,
          dailyLoss: riskState.dailyLoss || 0,
          circuitBreaker: {
            isTripped: circuitBreakerStatus.isTripped || false,
            consecutiveLosses: circuitBreakerStatus.consecutiveLosses || 0,
            minutesRemaining: circuitBreakerStatus.minutesRemaining || 0
          }
        },
        institutionalIndicators: institutionalIndicators,
        nextCheck: new Date(Date.now() + this.updateInterval).toISOString()
      };
    } catch (error) {
      logger.errorWithContext(error, { operation: 'gatherMonitoringData' });
      // Return minimal data on error
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        botStatus: { isRunning: false },
        marketStatus: {},
        portfolio: {},
        positions: { active: 0, positions: [] },
        risk: {},
        institutionalIndicators: {}
      };
    }
  }

  /**
   * Write monitoring data to file
   */
  async writeMonitoringData(data) {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.filePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Write atomically
      const tempPath = this.filePath + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tempPath, this.filePath);

      logger.debug(`✅ Monitoring summary written to ${this.filePath}`);
    } catch (error) {
      logger.errorWithContext(error, {
        operation: 'writeMonitoringData',
        filePath: this.filePath
      });
      throw error;
    }
  }

  /**
   * Get current monitoring data (read from file)
   */
  async getCurrentData() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('Monitoring summary file not found, creating initial data');
        return await this.update();
      }
      throw error;
    }
  }
}

module.exports = MonitoringUpdater;

