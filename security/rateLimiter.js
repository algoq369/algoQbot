const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

class RateLimiter {
  constructor(config = {}) {
    // Configuration
    this.maxTradesPerHour = config.maxTradesPerHour || 20;   // Conservative hourly limit
    this.maxTradesPerDay = config.maxTradesPerDay || 100;     // Daily cap
    
    // Counters
    this.hourlyTradeCount = 0;
    this.dailyTradeCount = 0;
    
    // Reset times
    this.hourlyReset = Date.now() + 3600000;  // 1 hour
    this.dailyReset = Date.now() + 86400000;  // 24 hours
    
    // Trade history for analysis
    this.recentTrades = [];
    this.maxHistorySize = 100;
    
    // ✅ SECURITY FIX #2: State persistence
    this.statePath = path.join(__dirname, '..', 'ratelimit-state.json');
    this.loadState(); // Load saved state on startup
    
    logger.info('🚦 Rate limiter initialized', {
      maxPerHour: this.maxTradesPerHour,
      maxPerDay: this.maxTradesPerDay
    });
  }

  /**
   * ✅ SECURITY FIX #2: Load persisted state from disk
   * This prevents the bot from bypassing rate limits on restart
   */
  async loadState() {
    try {
      const data = JSON.parse(await fs.readFile(this.statePath, 'utf8'));
      const now = Date.now();
      
      // Only restore counters if their reset times haven't passed yet
      if (now < data.hourlyReset) {
        this.hourlyTradeCount = data.hourlyTradeCount || 0;
        this.hourlyReset = data.hourlyReset;
        logger.info(`✅ Hourly rate limit restored: ${this.hourlyTradeCount}/${this.maxTradesPerHour}`);
      } else {
        logger.debug('Hourly reset time passed, starting fresh');
      }
      
      if (now < data.dailyReset) {
        this.dailyTradeCount = data.dailyTradeCount || 0;
        this.dailyReset = data.dailyReset;
        logger.info(`✅ Daily rate limit restored: ${this.dailyTradeCount}/${this.maxTradesPerDay}`);
      } else {
        logger.debug('Daily reset time passed, starting fresh');
      }
      
      // Restore recent trades (filter out old ones)
      if (data.recentTrades && Array.isArray(data.recentTrades)) {
        const fiveMinutesAgo = now - 300000;
        this.recentTrades = data.recentTrades.filter(t => t > fiveMinutesAgo);
        logger.debug(`Restored ${this.recentTrades.length} recent trades`);
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No previous rate limiter state found (first run or state file deleted)');
      } else {
        logger.warn('Failed to load rate limiter state:', error.message);
      }
      // Continue with default values - not a critical error
    }
  }

  /**
   * ✅ SECURITY FIX #2: Save state to disk after each trade
   * This ensures rate limits persist across bot restarts
   */
  async saveState() {
    try {
      const state = {
        hourlyTradeCount: this.hourlyTradeCount,
        dailyTradeCount: this.dailyTradeCount,
        hourlyReset: this.hourlyReset,
        dailyReset: this.dailyReset,
        recentTrades: this.recentTrades,
        savedAt: Date.now(),
        version: '1.0'
      };
      
      // 🔒 EXPERT FIX: Atomic write with permissions (no timing window)
      const tempPath = this.statePath + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(state, null, 2));
      await fs.chmod(tempPath, 0o600);
      await fs.rename(tempPath, this.statePath);  // Atomic operation
      
      logger.debug('Rate limiter state saved');
      
    } catch (error) {
      logger.warn('Failed to save rate limiter state:', error.message);
      // Don't throw - saving state is important but not critical enough to stop trading
    }
  }

  /**
   * Check if trade is allowed under rate limits
   * @throws {Error} if rate limit exceeded
   * @returns {boolean} true if allowed
   */
  async checkLimit() {
    const now = Date.now();
    
    // Reset hourly counter
    if (now > this.hourlyReset) {
      logger.info(`📊 Hourly rate limit reset. Trades last hour: ${this.hourlyTradeCount}`);
      this.hourlyTradeCount = 0;
      this.hourlyReset = now + 3600000;
    }
    
    // Reset daily counter
    if (now > this.dailyReset) {
      logger.info(`📊 Daily rate limit reset. Trades yesterday: ${this.dailyTradeCount}`);
      this.dailyTradeCount = 0;
      this.dailyReset = now + 86400000;
      
      // Clear old trade history
      this.recentTrades = [];
    }
    
    // Check hourly limit
    if (this.hourlyTradeCount >= this.maxTradesPerHour) {
      const minutesUntilReset = Math.ceil((this.hourlyReset - now) / 60000);
      throw new Error(
        `🚨 Hourly trade limit reached (${this.maxTradesPerHour}). ` +
        `Wait ${minutesUntilReset} minutes for reset.`
      );
    }
    
    // Check daily limit
    if (this.dailyTradeCount >= this.maxTradesPerDay) {
      const hoursUntilReset = Math.ceil((this.dailyReset - now) / 3600000);
      throw new Error(
        `🚨 Daily trade limit reached (${this.maxTradesPerDay}). ` +
        `Trading paused until tomorrow (${hoursUntilReset}h remaining).`
      );
    }
    
    // Check for suspicious rapid trading (more than 5 trades in 5 minutes)
    const fiveMinutesAgo = now - 300000;
    const recentCount = this.recentTrades.filter(t => t > fiveMinutesAgo).length;
    
    if (recentCount >= 5) {
      logger.debug('⚠️  Rapid trading detected: 5+ trades in 5 minutes');
      // Don't block, just warn - might be legitimate opportunity
    }
    
    // Increment counters
    this.hourlyTradeCount++;
    this.dailyTradeCount++;
    this.recentTrades.push(now);
    
    // Trim history
    if (this.recentTrades.length > this.maxHistorySize) {
      this.recentTrades = this.recentTrades.slice(-this.maxHistorySize);
    }
    
    logger.debug('✅ Rate limit check passed', {
      hourly: `${this.hourlyTradeCount}/${this.maxTradesPerHour}`,
      daily: `${this.dailyTradeCount}/${this.maxTradesPerDay}`,
      recent5min: recentCount
    });
    
    // ✅ SECURITY FIX #2: Save state after each trade
    await this.saveState();
    
    return true;
  }

  /**
   * Get current statistics
   * @returns {Object} Stats object
   */
  getStats() {
    const now = Date.now();
    
    return {
      hourly: {
        count: this.hourlyTradeCount,
        max: this.maxTradesPerHour,
        remaining: this.maxTradesPerHour - this.hourlyTradeCount,
        resetsIn: Math.ceil((this.hourlyReset - now) / 60000) + ' minutes'
      },
      daily: {
        count: this.dailyTradeCount,
        max: this.maxTradesPerDay,
        remaining: this.maxTradesPerDay - this.dailyTradeCount,
        resetsIn: Math.ceil((this.dailyReset - now) / 3600000) + ' hours'
      },
      recentTrades: this.recentTrades.length
    };
  }

  /**
   * Reset all counters (for testing or emergency)
   */
  reset() {
    logger.warn('⚠️  Rate limiter manually reset');
    this.hourlyTradeCount = 0;
    this.dailyTradeCount = 0;
    this.hourlyReset = Date.now() + 3600000;
    this.dailyReset = Date.now() + 86400000;
    this.recentTrades = [];
  }

  /**
   * Update rate limits
   * @param {Object} config - New configuration
   */
  updateLimits(config) {
    if (config.maxTradesPerHour) {
      this.maxTradesPerHour = config.maxTradesPerHour;
      logger.info(`Rate limit updated: ${config.maxTradesPerHour} trades/hour`);
    }
    
    if (config.maxTradesPerDay) {
      this.maxTradesPerDay = config.maxTradesPerDay;
      logger.info(`Rate limit updated: ${config.maxTradesPerDay} trades/day`);
    }
  }
}

module.exports = RateLimiter;

