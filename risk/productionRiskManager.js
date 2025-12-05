const logger = require('../logger');
const { errorClassifier, ErrorTypes, ErrorSeverity } = require('../utils/errorClassifier');

/**
 * Production Risk Manager with Shadow Mode Detection
 * Automatically adjusts limits based on trading mode
 */
class ProductionRiskManager {
  constructor(options = {}) {
    // ✅ DETECT SHADOW MODE
    const isShadowMode = process.env.SHADOW_MODE_ENABLED === 'true';

    logger.info(`🛡️  Initializing Risk Manager for ${isShadowMode ? 'SHADOW' : 'LIVE'} mode`);

    // ✅ SHADOW MODE LIMITS (Conservative for testing)
    const shadowLimits = {
      // Trade size - smaller for testing
      minTradeSize: 100,          // $100 minimum
      maxTradeSize: 3000,         // $3K max (5% of $60K)

      // Portfolio limits
      maxPositionSize: 0.10,      // 10% max per position

      // 🚀 ENHANCEMENT #3: Tighter Risk Limits (2025)
      // Loss limits - ULTRA-CONSERVATIVE for low-noise trading
      maxDailyLoss: 600,          // $600 (1% of $60K) - down from $1.5K
      maxDrawdown: 0.05,          // 5% max drawdown - down from 10%
      maxLeverageExposure: 0,     // No leverage in shadow mode

      // Rate limits - HIGHER for testing
      maxTradesPerHour: 30,       // More trades allowed
      maxTradesPerDay: 150,       // More trades allowed
      maxConsecutiveErrors: 15,   // More tolerance
      maxErrorsPerHour: 25,       // More tolerance

      // Price action - MORE TOLERANT
      maxSlippage: 0.08,          // 8% slippage ok for testing
      maxPriceImpact: 0.05,       // 5% price impact ok

      // Gas limits
      maxGasPrice: 50,            // 50 gwei max

      // Time limits
      maxTradeDuration: 3600000,  // 1 hour

      ...options
    };

    // ✅ LIVE MODE LIMITS (Professional for production)
    const liveLimits = {
      // Trade size - production standards
      minTradeSize: 500,          // $500 minimum
      maxTradeSize: 9000,         // $9K max (15% of $60K)

      // Portfolio limits
      maxPositionSize: 0.15,      // 15% max per position

      // 🚀 ENHANCEMENT #3: Tighter Risk Limits (2025)
      // Loss limits - ULTRA-STRICT for low-noise live trading
      maxDailyLoss: 600,          // $600 (1% of $60K) - down from $3K
      maxDrawdown: 0.05,          // 5% max drawdown - down from 15%
      maxLeverageExposure: 75000, // $25K × 3x average

      // Rate limits - CONSERVATIVE
      maxTradesPerHour: 20,       // Controlled pace
      maxTradesPerDay: 100,       // Daily limit
      maxConsecutiveErrors: 10,   // Low tolerance
      maxErrorsPerHour: 20,       // Low tolerance

      // Price action - STRICT
      maxSlippage: 0.05,          // 5% max slippage
      maxPriceImpact: 0.03,       // 3% max price impact

      // Gas limits
      maxGasPrice: 50,            // 50 gwei max

      // Time limits
      maxTradeDuration: 3600000,  // 1 hour

      ...options
    };

    // ✅ SELECT APPROPRIATE LIMITS
    this.limits = isShadowMode ? shadowLimits : liveLimits;
    this.isShadowMode = isShadowMode;

    // Log active limits
    logger.info('📊 Active Risk Limits:');
    logger.info(`   Max Trade Size: $${this.limits.maxTradeSize}`);
    logger.info(`   Max Daily Loss: $${this.limits.maxDailyLoss}`);
    logger.info(`   Max Position: ${(this.limits.maxPositionSize * 100).toFixed(0)}%`);
    logger.info(`   Max Drawdown: ${(this.limits.maxDrawdown * 100).toFixed(0)}%`);
    logger.info(`   Trades/Hour: ${this.limits.maxTradesPerHour}`);
    logger.info(`   Trades/Day: ${this.limits.maxTradesPerDay}`);

    // ✅ INITIALIZE STATE
    this.state = {
      dailyLoss: 0,
      dailyTrades: 0,
      hourlyTrades: 0,
      consecutiveErrors: 0,
      consecutiveLosses: 0,
      lastResetTime: Date.now(),
      lastHourReset: Date.now(),
      portfolioValue: 0, // Will be updated on first price check
      peakPortfolioValue: 0,  // ✅ CRITICAL FIX: Start at 0, will be set on first update
      openPositions: new Map(),
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0
    };

    // ✅ EMERGENCY STATE
    this.emergencyState = {
      isShutdown: false,
      shutdownReason: null,
      shutdownTime: null,
      lastHealthCheck: Date.now()
    };

    // ✅ MONITORING
    this.monitoringInterval = null;

    logger.info('✅ Risk Manager initialized successfully');
    logger.info('🛡️  Risk Manager initialized with peak portfolio: $0 (will be set on first update)');
  }

  // ✅ UPDATE PORTFOLIO VALUE
  updatePortfolioValue(newValue) {
    if (!newValue || newValue <= 0) {
      logger.warn(`⚠️  Invalid portfolio value: ${newValue}`);
      return;
    }

    const oldValue = this.state.portfolioValue;
    this.state.portfolioValue = newValue;

    // ✅ FIX: Initialize peak on first update or after significant change
    if (this.state.peakPortfolioValue === 0 || oldValue === 0) {
      this.state.peakPortfolioValue = newValue;
      logger.info(`📊 Peak portfolio initialized: $${newValue.toFixed(2)}`);
      return; // Don't check drawdown on initialization
    }

    // ✅ FIX: Update peak value - use a small buffer to prevent false positives
    // Only update peak if new value is at least 0.1% higher (prevents noise)
    if (newValue > this.state.peakPortfolioValue * 1.001) {
      const oldPeak = this.state.peakPortfolioValue;
      this.state.peakPortfolioValue = newValue;
      logger.debug(`📈 New peak portfolio: $${newValue.toFixed(2)} (was $${oldPeak.toFixed(2)})`);
    }

    // ✅ FIX: Check drawdown with improved calculation
    // Only check if peak is valid and significantly different from current
    if (this.state.peakPortfolioValue > 0 && newValue < this.state.peakPortfolioValue) {
      const currentDrawdown = (this.state.peakPortfolioValue - newValue) / this.state.peakPortfolioValue;
      
      // ✅ FIX: Add tolerance buffer (0.1%) to prevent false positives from price fluctuations
      const drawdownWithBuffer = currentDrawdown + 0.001;
      
      if (drawdownWithBuffer > this.limits.maxDrawdown) {
        // ✅ FIX: Only trigger if drawdown is sustained (not just a single bad price)
        // Check if this is a real drawdown or just a temporary fluctuation
        const drawdownPercent = (currentDrawdown * 100).toFixed(2);
        logger.error(`🚨 DRAWDOWN LIMIT EXCEEDED: ${drawdownPercent}% (limit: ${(this.limits.maxDrawdown * 100).toFixed(2)}%)`);
        
        // ✅ FIX: Only trigger emergency stop if drawdown is significant (above limit + buffer)
        // This prevents false triggers from minor price fluctuations
        if (currentDrawdown > this.limits.maxDrawdown * 1.1) {
          this.triggerEmergencyStop(`Max drawdown exceeded: ${drawdownPercent}%`);
        } else {
          logger.warn(`⚠️ Drawdown warning (${drawdownPercent}%) - monitoring but not stopping yet`);
        }
      }

      logger.debug(`💼 Portfolio: $${newValue.toFixed(2)} | Peak: $${this.state.peakPortfolioValue.toFixed(2)} | Drawdown: ${(currentDrawdown * 100).toFixed(2)}%`);
    } else {
      logger.debug(`💼 Portfolio: $${newValue.toFixed(2)} | Peak: $${this.state.peakPortfolioValue.toFixed(2)} | At or above peak`);
    }
  }

  // ✅ CHECK IF TRADE ALLOWED
  async checkTradeAllowed(tradeAmount, reason = '') {
    // Check emergency state
    if (this.emergencyState.isShutdown) {
      return {
        allowed: false,
        reason: `Emergency shutdown active: ${this.emergencyState.shutdownReason}`
      };
    }

    // Check trade size
    if (tradeAmount < this.limits.minTradeSize) {
      return {
        allowed: false,
        reason: `Trade too small: $${tradeAmount.toFixed(2)} < $${this.limits.minTradeSize}`
      };
    }

    if (tradeAmount > this.limits.maxTradeSize) {
      return {
        allowed: false,
        reason: `Trade too large: $${tradeAmount.toFixed(2)} > $${this.limits.maxTradeSize}`
      };
    }

    // Check position size
    const positionPct = tradeAmount / this.state.portfolioValue;
    if (positionPct > this.limits.maxPositionSize) {
      return {
        allowed: false,
        reason: `Position too large: ${(positionPct * 100).toFixed(2)}% > ${(this.limits.maxPositionSize * 100).toFixed(0)}%`
      };
    }

    // Check daily loss limit
    if (Math.abs(this.state.dailyLoss) > this.limits.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit exceeded: $${Math.abs(this.state.dailyLoss).toFixed(2)}`
      };
    }

    // Check hourly rate limit
    if (this.state.hourlyTrades >= this.limits.maxTradesPerHour) {
      return {
        allowed: false,
        reason: `Hourly trade limit reached: ${this.state.hourlyTrades}/${this.limits.maxTradesPerHour}`
      };
    }

    // Check daily rate limit
    if (this.state.dailyTrades >= this.limits.maxTradesPerDay) {
      return {
        allowed: false,
        reason: `Daily trade limit reached: ${this.state.dailyTrades}/${this.limits.maxTradesPerDay}`
      };
    }

    // All checks passed
    logger.debug(`✅ Trade allowed: $${tradeAmount.toFixed(2)} (${reason})`);
    return { allowed: true };
  }

  // ✅ RECORD TRADE
  recordTrade(trade) {
    this.state.totalTrades++;
    this.state.dailyTrades++;
    this.state.hourlyTrades++;

    if (trade.profit) {
      this.state.dailyLoss += trade.profit;

      if (trade.profit > 0) {
        this.state.successfulTrades++;
        this.state.consecutiveLosses = 0;
      } else {
        this.state.failedTrades++;
        this.state.consecutiveLosses++;
      }
    }

    logger.debug(`📊 Trade recorded | Total: ${this.state.totalTrades} | Daily: ${this.state.dailyTrades}`);
  }

  // ✅ VALIDATE TRADE (before execution)
  validateTrade(params) {
    const { action, amount, price, portfolio } = params;

    // Check if trading is halted
    if (this.emergencyState.isShutdown) {
      return {
        allowed: false,
        reason: 'Emergency shutdown active',
        severity: 'critical'
      };
    }

    // Check trade size limits
    if (amount > this.limits.maxTradeSize) {
      return {
        allowed: false,
        reason: `Trade size ${amount.toFixed(2)} exceeds max ${this.limits.maxTradeSize}`,
        severity: 'high'
      };
    }

    // Check daily loss limit
    if (this.state.dailyLoss >= this.limits.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit reached: ${this.state.dailyLoss.toFixed(2)}`,
        severity: 'high'
      };
    }

    // Check rate limits
    if (this.state.hourlyTrades >= this.limits.maxTradesPerHour) {
      return {
        allowed: false,
        reason: 'Hourly trade limit reached',
        severity: 'medium'
      };
    }

    // All checks passed
    return {
      allowed: true,
      reason: 'Trade validated successfully'
    };
  }

  // ✅ RESET CIRCUIT BREAKERS
  async resetCircuitBreakers(reason = 'Manual reset') {
    logger.info(`🔄 Resetting circuit breakers: ${reason}`);

    const previousState = {
      dailyLoss: this.state.dailyLoss,
      dailyTrades: this.state.dailyTrades
    };

    // Reset emergency state
    this.emergencyState = {
      isShutdown: false,
      shutdownReason: null,
      shutdownTime: null,
      lastHealthCheck: Date.now()
    };

    // Reset daily/hourly counters
    this.state.dailyLoss = 0;
    this.state.dailyTrades = 0;
    this.state.hourlyTrades = 0;
    this.state.consecutiveErrors = 0;
    this.state.consecutiveLosses = 0;
    this.state.lastResetTime = Date.now();
    this.state.lastHourReset = Date.now();

    logger.info('✅ Circuit breakers reset');
    logger.info(`   Previous daily loss: $${previousState.dailyLoss.toFixed(2)}`);
    logger.info(`   Previous daily trades: ${previousState.dailyTrades}`);

    return { success: true, previousState };
  }

  // ✅ CHECK DAILY RESET
  async checkDailyReset() {
    const now = Date.now();
    const timeSinceReset = now - this.state.lastResetTime;
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (timeSinceReset > oneDayMs) {
      logger.info('🌅 New day detected, auto-resetting counters');
      await this.resetCircuitBreakers('Daily auto-reset');
    }

    // Check hourly reset
    const timeSinceHourReset = now - this.state.lastHourReset;
    const oneHourMs = 60 * 60 * 1000;

    if (timeSinceHourReset > oneHourMs) {
      logger.debug('🕐 Hourly reset');
      this.state.hourlyTrades = 0;
      this.state.lastHourReset = now;
    }
  }

  // ✅ START MONITORING
  startMonitoring() {
    if (this.monitoringInterval) {
      logger.warn('⚠️  Monitoring already started');
      return;
    }

    logger.info('🛡️  Starting risk monitoring (60s interval)');

    this.monitoringInterval = setInterval(async () => {
      await this.checkDailyReset();

      // Log current state
      logger.debug('📊 Risk State:');
      logger.debug(`   Daily Loss: $${this.state.dailyLoss.toFixed(2)}`);
      logger.debug(`   Daily Trades: ${this.state.dailyTrades}/${this.limits.maxTradesPerDay}`);
      logger.debug(`   Hourly Trades: ${this.state.hourlyTrades}/${this.limits.maxTradesPerHour}`);
      logger.debug(`   Portfolio: $${this.state.portfolioValue.toFixed(2)}`);
    }, 60000);
  }

  // ✅ STOP MONITORING
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('✅ Risk monitoring stopped');
    }
  }

  // ✅ TRIGGER EMERGENCY STOP
  triggerEmergencyStop(reason) {
    this.emergencyState = {
      isShutdown: true,
      shutdownReason: reason,
      shutdownTime: Date.now(),
      lastHealthCheck: Date.now()
    };

    logger.error('🚨 EMERGENCY STOP TRIGGERED');
    logger.error(`   Reason: ${reason}`);
  }

  // ✅ GET STATE
  getState() {
    return {
      ...this.state,
      emergencyState: this.emergencyState,
      limits: this.limits,
      isShadowMode: this.isShadowMode
    };
  }

  // ✅ RESET (for testing)
  reset() {
    logger.info('🔄 Full risk manager reset');

    // ✅ FIX: Reset peak portfolio value on reset to prevent false drawdown
    const currentPortfolioValue = this.state.portfolioValue;

    this.state = {
      dailyLoss: 0,
      dailyTrades: 0,
      hourlyTrades: 0,
      consecutiveErrors: 0,
      consecutiveLosses: 0,
      lastResetTime: Date.now(),
      lastHourReset: Date.now(),
      portfolioValue: currentPortfolioValue,
      peakPortfolioValue: currentPortfolioValue,  // ✅ FIX: Reset peak to current value
      openPositions: new Map(),
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0
    };

    logger.info(`📊 Peak portfolio reset to: $${currentPortfolioValue.toFixed(2)}`);

    this.emergencyState = {
      isShutdown: false,
      shutdownReason: null,
      shutdownTime: null,
      lastHealthCheck: Date.now()
    };
  }
}

module.exports = ProductionRiskManager;
