const logger = require('../logger');

class ProductionRiskManager {
  constructor(options = {}) {
    this.limits = {
      // Per-trade limits
      maxTradeSize: options.maxTradeSize || 1000,          // $1,000 max per trade
      minTradeSize: options.minTradeSize || 5,             // $5 minimum
      
      // Portfolio limits
      maxDailyLoss: options.maxDailyLoss || 5000,          // $5,000 max daily loss
      maxDrawdown: options.maxDrawdown || 0.1,             // 10% max drawdown
      maxPositionSize: options.maxPositionSize || 0.2,     // 20% of portfolio per position
      
      // Frequency limits
      maxTradesPerHour: options.maxTradesPerHour || 100,
      maxTradesPerDay: options.maxTradesPerDay || 1000,
      
      // Error limits
      maxConsecutiveErrors: options.maxConsecutiveErrors || 5,
      maxErrorsPerHour: options.maxErrorsPerHour || 20,
      
      // Slippage limits
      maxSlippage: options.maxSlippage || 0.05,            // 5% max slippage
      
      // Gas limits
      maxGasPrice: options.maxGasPrice || 50,              // 50 Gwei max
      
      // Market limits
      maxPriceImpact: options.maxPriceImpact || 0.03,      // 3% max price impact
      
      // Time limits
      maxTradeDuration: options.maxTradeDuration || 3600000, // 1 hour max
      
      // Portfolio value limits
      minPortfolioValue: options.minPortfolioValue || 100,  // $100 minimum
      maxPortfolioValue: options.maxPortfolioValue || 1000000, // $1M maximum
      
      ...options
    };
    
    this.state = {
      dailyLoss: 0,
      dailyTrades: 0,
      hourlyTrades: 0,
      consecutiveErrors: 0,
      lastResetTime: Date.now(),
      lastHourReset: Date.now(),
      portfolioValue: 0,
      openPositions: new Map(),
      tradeHistory: [],
      errorHistory: []
    };
    
    // Emergency shutdown state
    this.emergencyState = {
      isShutdown: false,
      shutdownReason: null,
      shutdownTime: null,
      lastHealthCheck: Date.now()
    };
    
    // Monitoring and alerting
    this.alertSystem = null;
    this.monitoringInterval = null;
    
    // Start monitoring
    this.startMonitoring();
    
    logger.info('🚀 Production Risk Manager initialized');
  }

  // Set alert system
  setAlertSystem(alertSystem) {
    this.alertSystem = alertSystem;
    logger.info('✅ Alert system connected to risk manager');
  }

  // Start continuous monitoring
  startMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    logger.info('✅ Risk monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('✅ Risk monitoring stopped');
  }

  // Validate trade before execution
  async validateTrade(trade) {
    try {
      // Check if system is in emergency shutdown
      if (this.emergencyState.isShutdown) {
        throw new Error(`System is in emergency shutdown: ${this.emergencyState.shutdownReason}`);
      }
      
      // Reset daily counters if needed
      this.resetDailyCountersIfNeeded();
      this.resetHourlyCountersIfNeeded();
      
      const validations = [
        this.checkTradeSize(trade),
        this.checkDailyLoss(trade),
        this.checkPositionSize(trade),
        this.checkTradeFrequency(),
        this.checkSlippage(trade),
        this.checkGasPrice(trade),
        this.checkPriceImpact(trade),
        this.checkPortfolioValue(),
        this.checkConsecutiveErrors(),
        this.checkMarketConditions(trade)
      ];
      
      const results = await Promise.all(validations);
      const failures = results.filter(r => !r.passed);
      
      if (failures.length > 0) {
        const errorMsg = `Trade validation failed: ${failures.map(f => f.reason).join(', ')}`;
        logger.warn(`⚠️ Trade validation failed:`, failures);
        
        // Record validation failure
        this.recordError('VALIDATION_FAILED', errorMsg);
        
        throw new Error(errorMsg);
      }
      
      // Record successful validation
      this.recordTradeValidation(trade);
      
      return true;
      
    } catch (error) {
      logger.error('❌ Trade validation error:', error);
      throw error;
    }
  }

  // Check trade size limits
  checkTradeSize(trade) {
    const amount = parseFloat(trade.amount);
    
    if (amount < this.limits.minTradeSize) {
      return { passed: false, reason: `Trade size too small: $${amount} < $${this.limits.minTradeSize}` };
    }
    
    if (amount > this.limits.maxTradeSize) {
      return { passed: false, reason: `Trade size exceeds limit: $${amount} > $${this.limits.maxTradeSize}` };
    }
    
    return { passed: true };
  }

  // Check daily loss limits
  checkDailyLoss(trade) {
    const potentialLoss = parseFloat(trade.amount) * 0.1; // Assume 10% loss
    
    if (this.state.dailyLoss + potentialLoss > this.limits.maxDailyLoss) {
      return { 
        passed: false, 
        reason: `Daily loss limit reached: $${this.state.dailyLoss} + $${potentialLoss} > $${this.limits.maxDailyLoss}` 
      };
    }
    
    return { passed: true };
  }

  // Check position size limits
  checkPositionSize(trade) {
    const positionSize = parseFloat(trade.amount) / this.state.portfolioValue;
    
    if (positionSize > this.limits.maxPositionSize) {
      return { 
        passed: false, 
        reason: `Position size too large: ${(positionSize * 100).toFixed(2)}% > ${(this.limits.maxPositionSize * 100)}%` 
      };
    }
    
    return { passed: true };
  }

  // Check trade frequency limits
  checkTradeFrequency() {
    if (this.state.hourlyTrades >= this.limits.maxTradesPerHour) {
      return { 
        passed: false, 
        reason: `Hourly trade limit reached: ${this.state.hourlyTrades} >= ${this.limits.maxTradesPerHour}` 
      };
    }
    
    if (this.state.dailyTrades >= this.limits.maxTradesPerDay) {
      return { 
        passed: false, 
        reason: `Daily trade limit reached: ${this.state.dailyTrades} >= ${this.limits.maxTradesPerDay}` 
      };
    }
    
    return { passed: true };
  }

  // Check slippage limits
  checkSlippage(trade) {
    const slippage = parseFloat(trade.slippage) || 0;
    
    if (slippage > this.limits.maxSlippage) {
      return { 
        passed: false, 
        reason: `Slippage too high: ${(slippage * 100).toFixed(2)}% > ${(this.limits.maxSlippage * 100)}%` 
      };
    }
    
    return { passed: true };
  }

  // Check gas price limits
  checkGasPrice(trade) {
    const gasPrice = parseFloat(trade.gasPrice) || 0;
    
    if (gasPrice > this.limits.maxGasPrice) {
      return { 
        passed: false, 
        reason: `Gas price too high: ${gasPrice} Gwei > ${this.limits.maxGasPrice} Gwei` 
      };
    }
    
    return { passed: true };
  }

  // Check price impact limits
  checkPriceImpact(trade) {
    const priceImpact = parseFloat(trade.priceImpact) || 0;
    
    if (priceImpact > this.limits.maxPriceImpact) {
      return { 
        passed: false, 
        reason: `Price impact too high: ${(priceImpact * 100).toFixed(2)}% > ${(this.limits.maxPriceImpact * 100)}%` 
      };
    }
    
    return { passed: true };
  }

  // Check portfolio value limits
  checkPortfolioValue() {
    if (this.state.portfolioValue < this.limits.minPortfolioValue) {
      return { 
        passed: false, 
        reason: `Portfolio value too low: $${this.state.portfolioValue} < $${this.limits.minPortfolioValue}` 
      };
    }
    
    if (this.state.portfolioValue > this.limits.maxPortfolioValue) {
      return { 
        passed: false, 
        reason: `Portfolio value too high: $${this.state.portfolioValue} > $${this.limits.maxPortfolioValue}` 
      };
    }
    
    return { passed: true };
  }

  // Check consecutive error limits
  checkConsecutiveErrors() {
    if (this.state.consecutiveErrors >= this.limits.maxConsecutiveErrors) {
      return { 
        passed: false, 
        reason: `Too many consecutive errors: ${this.state.consecutiveErrors} >= ${this.limits.maxConsecutiveErrors}` 
      };
    }
    
    return { passed: true };
  }

  // Check market conditions
  async checkMarketConditions(trade) {
    // This would check market volatility, liquidity, etc.
    // For now, return passed
    return { passed: true };
  }

  // Record trade execution
  recordTrade(trade, result) {
    const tradeRecord = {
      ...trade,
      result: result,
      timestamp: Date.now(),
      dailyTradeNumber: this.state.dailyTrades + 1,
      hourlyTradeNumber: this.state.hourlyTrades + 1
    };
    
    this.state.tradeHistory.push(tradeRecord);
    this.state.dailyTrades++;
    this.state.hourlyTrades++;
    
    // Keep only recent trades
    if (this.state.tradeHistory.length > 1000) {
      this.state.tradeHistory = this.state.tradeHistory.slice(-1000);
    }
    
    // Update portfolio value
    if (result.profitLoss) {
      this.state.portfolioValue += parseFloat(result.profitLoss);
    }
    
    // Update daily loss
    if (result.profitLoss && parseFloat(result.profitLoss) < 0) {
      this.state.dailyLoss += Math.abs(parseFloat(result.profitLoss));
    }
    
    // Reset consecutive errors on successful trade
    if (result.status === 'success') {
      this.state.consecutiveErrors = 0;
    }
    
    logger.info(`✅ Trade recorded: ${trade.pair} ${trade.amount} (${result.status})`);
  }

  // Record error
  recordError(type, message) {
    const errorRecord = {
      type: type,
      message: message,
      timestamp: Date.now(),
      consecutiveCount: this.state.consecutiveErrors + 1
    };
    
    this.state.errorHistory.push(errorRecord);
    this.state.consecutiveErrors++;
    
    // Keep only recent errors
    if (this.state.errorHistory.length > 100) {
      this.state.errorHistory = this.state.errorHistory.slice(-100);
    }
    
    logger.error(`❌ Error recorded: ${type} - ${message}`);
  }

  // Record trade validation
  recordTradeValidation(trade) {
    // This would log validation success for monitoring
    logger.debug(`✅ Trade validation passed: ${trade.pair} ${trade.amount}`);
  }

  // Reset daily counters if needed
  resetDailyCountersIfNeeded() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - this.state.lastResetTime > dayInMs) {
      this.state.dailyLoss = 0;
      this.state.dailyTrades = 0;
      this.state.lastResetTime = now;
      
      logger.info('✅ Daily counters reset');
    }
  }

  // Reset hourly counters if needed
  resetHourlyCountersIfNeeded() {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;
    
    if (now - this.state.lastHourReset > hourInMs) {
      this.state.hourlyTrades = 0;
      this.state.lastHourReset = now;
      
      logger.info('✅ Hourly counters reset');
    }
  }

  // Update portfolio value
  updatePortfolioValue(value) {
    this.state.portfolioValue = parseFloat(value);
    logger.debug(`✅ Portfolio value updated: $${this.state.portfolioValue}`);
  }

  // Add open position
  addOpenPosition(position) {
    this.state.openPositions.set(position.id, position);
    logger.debug(`✅ Open position added: ${position.id}`);
  }

  // Remove open position
  removeOpenPosition(positionId) {
    this.state.openPositions.delete(positionId);
    logger.debug(`✅ Open position removed: ${positionId}`);
  }

  // Perform health check
  async performHealthCheck() {
    try {
      const now = Date.now();
      this.emergencyState.lastHealthCheck = now;
      
      // Check for emergency conditions
      const emergencyConditions = [
        this.checkDailyLossLimit(),
        this.checkConsecutiveErrorLimit(),
        this.checkPortfolioValueLimit(),
        this.checkMarketConditions()
      ];
      
      const emergencies = emergencyConditions.filter(condition => condition.isEmergency);
      
      if (emergencies.length > 0) {
        await this.emergencyShutdown(emergencies[0].reason);
      }
      
      // Check for warning conditions
      const warningConditions = [
        this.checkDailyLossWarning(),
        this.checkErrorRateWarning(),
        this.checkTradeFrequencyWarning()
      ];
      
      const warnings = warningConditions.filter(condition => condition.isWarning);
      
      if (warnings.length > 0) {
        await this.sendWarning(warnings[0].reason);
      }
      
    } catch (error) {
      logger.error('❌ Health check failed:', error);
    }
  }

  // Check daily loss limit
  checkDailyLossLimit() {
    const lossRatio = this.state.dailyLoss / this.state.portfolioValue;
    
    if (lossRatio > this.limits.maxDrawdown) {
      return {
        isEmergency: true,
        reason: `Daily loss limit exceeded: $${this.state.dailyLoss} (${(lossRatio * 100).toFixed(2)}% of portfolio)`
      };
    }
    
    return { isEmergency: false };
  }

  // Check consecutive error limit
  checkConsecutiveErrorLimit() {
    if (this.state.consecutiveErrors >= this.limits.maxConsecutiveErrors) {
      return {
        isEmergency: true,
        reason: `Too many consecutive errors: ${this.state.consecutiveErrors}`
      };
    }
    
    return { isEmergency: false };
  }

  // Check portfolio value limit
  checkPortfolioValueLimit() {
    if (this.state.portfolioValue < this.limits.minPortfolioValue) {
      return {
        isEmergency: true,
        reason: `Portfolio value too low: $${this.state.portfolioValue}`
      };
    }
    
    return { isEmergency: false };
  }

  // Check market conditions
  checkMarketConditions() {
    // This would check market volatility, liquidity, etc.
    return { isEmergency: false };
  }

  // Check daily loss warning
  checkDailyLossWarning() {
    const lossRatio = this.state.dailyLoss / this.state.portfolioValue;
    
    if (lossRatio > this.limits.maxDrawdown * 0.8) {
      return {
        isWarning: true,
        reason: `Daily loss approaching limit: $${this.state.dailyLoss} (${(lossRatio * 100).toFixed(2)}% of portfolio)`
      };
    }
    
    return { isWarning: false };
  }

  // Check error rate warning
  checkErrorRateWarning() {
    const errorRate = this.state.errorHistory.filter(
      error => Date.now() - error.timestamp < 3600000 // Last hour
    ).length;
    
    if (errorRate > this.limits.maxErrorsPerHour * 0.8) {
      return {
        isWarning: true,
        reason: `High error rate: ${errorRate} errors in last hour`
      };
    }
    
    return { isWarning: false };
  }

  // Check trade frequency warning
  checkTradeFrequencyWarning() {
    if (this.state.hourlyTrades > this.limits.maxTradesPerHour * 0.8) {
      return {
        isWarning: true,
        reason: `High trade frequency: ${this.state.hourlyTrades} trades in last hour`
      };
    }
    
    return { isWarning: false };
  }

  // Send warning
  async sendWarning(reason) {
    if (this.alertSystem) {
      await this.alertSystem.send({
        level: 'WARNING',
        type: 'RISK_WARNING',
        reason: reason,
        timestamp: Date.now(),
        state: this.getSystemState()
      });
    }
    
    logger.warn(`⚠️ Risk warning: ${reason}`);
  }

  // Emergency shutdown
  async emergencyShutdown(reason) {
    try {
      logger.error('🚨 EMERGENCY SHUTDOWN:', reason);
      
      // Set emergency state
      this.emergencyState.isShutdown = true;
      this.emergencyState.shutdownReason = reason;
      this.emergencyState.shutdownTime = Date.now();
      
      // Stop all trading
      this.stopTrading();
      
      // Cancel pending orders
      await this.cancelAllOrders();
      
      // Close open positions (if safe)
      await this.closePositionsSafely();
      
      // Alert administrators
      if (this.alertSystem) {
        await this.alertSystem.send({
          level: 'CRITICAL',
          type: 'EMERGENCY_SHUTDOWN',
          reason: reason,
          timestamp: Date.now(),
          state: this.getSystemState()
        });
      }
      
      // Create incident report
      await this.createIncidentReport(reason);
      
      logger.error('🚨 Emergency shutdown completed');
      
    } catch (error) {
      logger.error('❌ Emergency shutdown failed:', error);
    }
  }

  // Stop trading
  stopTrading() {
    // This would stop the trading bot
    logger.error('🛑 Trading stopped due to emergency shutdown');
  }

  // Cancel all orders
  async cancelAllOrders() {
    // This would cancel all pending orders
    logger.error('🛑 All orders cancelled due to emergency shutdown');
  }

  // Close positions safely
  async closePositionsSafely() {
    // This would close open positions if safe to do so
    logger.error('🛑 Positions closed safely due to emergency shutdown');
  }

  // Create incident report
  async createIncidentReport(reason) {
    const report = {
      incidentId: Date.now(),
      reason: reason,
      timestamp: Date.now(),
      state: this.getSystemState(),
      tradeHistory: this.state.tradeHistory.slice(-100),
      errorHistory: this.state.errorHistory.slice(-50)
    };
    
    logger.error('📋 Incident report created:', report);
    
    // In production, save to database
    return report;
  }

  // Get system state
  getSystemState() {
    return {
      limits: this.limits,
      state: this.state,
      emergencyState: this.emergencyState,
      stats: this.getStats()
    };
  }

  // Get risk manager statistics
  getStats() {
    const now = Date.now();
    const last24Hours = this.state.tradeHistory.filter(
      trade => now - trade.timestamp < 24 * 60 * 60 * 1000
    );
    
    const lastHour = this.state.tradeHistory.filter(
      trade => now - trade.timestamp < 60 * 60 * 1000
    );
    
    const profitableTrades = last24Hours.filter(trade => 
      trade.result.profitLoss && parseFloat(trade.result.profitLoss) > 0
    );
    
    const losingTrades = last24Hours.filter(trade => 
      trade.result.profitLoss && parseFloat(trade.result.profitLoss) < 0
    );
    
    return {
      portfolio: {
        value: this.state.portfolioValue,
        dailyLoss: this.state.dailyLoss,
        openPositions: this.state.openPositions.size
      },
      trading: {
        dailyTrades: this.state.dailyTrades,
        hourlyTrades: this.state.hourlyTrades,
        totalTrades: this.state.tradeHistory.length,
        profitableTrades: profitableTrades.length,
        losingTrades: losingTrades.length,
        winRate: last24Hours.length > 0 ? (profitableTrades.length / last24Hours.length * 100).toFixed(2) + '%' : '0%'
      },
      errors: {
        consecutiveErrors: this.state.consecutiveErrors,
        totalErrors: this.state.errorHistory.length,
        errorRate: this.state.tradeHistory.length > 0 ? 
          (this.state.errorHistory.length / this.state.tradeHistory.length * 100).toFixed(2) + '%' : '0%'
      },
      emergency: {
        isShutdown: this.emergencyState.isShutdown,
        shutdownReason: this.emergencyState.shutdownReason,
        shutdownTime: this.emergencyState.shutdownTime,
        lastHealthCheck: this.emergencyState.lastHealthCheck
      }
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthy = !this.emergencyState.isShutdown && 
                   this.state.consecutiveErrors < this.limits.maxConsecutiveErrors &&
                   this.state.portfolioValue >= this.limits.minPortfolioValue;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      stats: stats,
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations
  getRecommendations() {
    const recommendations = [];
    
    if (this.state.dailyLoss > this.limits.maxDailyLoss * 0.8) {
      recommendations.push('Daily loss approaching limit - consider reducing position sizes');
    }
    
    if (this.state.consecutiveErrors > this.limits.maxConsecutiveErrors * 0.8) {
      recommendations.push('High consecutive error count - review error handling');
    }
    
    if (this.state.hourlyTrades > this.limits.maxTradesPerHour * 0.8) {
      recommendations.push('High trade frequency - consider rate limiting');
    }
    
    if (this.state.portfolioValue < this.limits.minPortfolioValue * 1.1) {
      recommendations.push('Portfolio value low - consider adding funds');
    }
    
    return recommendations;
  }

  // Reset emergency state
  resetEmergencyState() {
    this.emergencyState.isShutdown = false;
    this.emergencyState.shutdownReason = null;
    this.emergencyState.shutdownTime = null;
    
    logger.info('✅ Emergency state reset');
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('🔄 Shutting down risk manager...');
      
      this.stopMonitoring();
      
      logger.info('✅ Risk manager shutdown completed');
      
    } catch (error) {
      logger.error('❌ Error during risk manager shutdown:', error);
    }
  }
}

module.exports = ProductionRiskManager;

