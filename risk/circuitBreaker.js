const logger = require('../logger');
const config = require('../config');

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringWindow = options.monitoringWindow || 300000; // 5 minutes
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN. Next attempt at: ${new Date(this.nextAttempt)}`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    logger.debug('Circuit breaker: Success - resetting failure count');
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
      logger.error(`Circuit breaker OPENED after ${this.failureCount} failures. Next attempt: ${new Date(this.nextAttempt)}`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

class RiskManager {
  constructor() {
    this.dailyLossLimit = config.risk.dailyLossLimit || 50; // 50 USDT
    this.maxPositionSize = config.risk.maxPositionSize || 0.1; // 10% of portfolio
    this.maxConsecutiveLosses = config.risk.maxConsecutiveLosses || 5;
    this.emergencyStopThreshold = config.risk.emergencyStopThreshold || 100; // 100 USDT loss
    
    this.dailyLoss = 0;
    this.consecutiveLosses = 0;
    this.tradingEnabled = true;
    this.emergencyStop = false;
    
    this.circuitBreakers = {
      trading: new CircuitBreaker({ failureThreshold: 3, recoveryTimeout: 300000 }),
      dex: new CircuitBreaker({ failureThreshold: 5, recoveryTimeout: 60000 }),
      priceFeed: new CircuitBreaker({ failureThreshold: 10, recoveryTimeout: 30000 })
    };

    this.riskMetrics = {
      dailyPnL: 0,
      maxDrawdown: 0,
      winRate: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      profitableTrades: 0
    };

    logger.info('🛡️ Risk Manager initialized');
  }

  // Position sizing based on Kelly Criterion
  calculatePositionSize(winRate, avgWin, avgLoss, portfolioValue) {
    if (avgLoss === 0) return 0;
    
    const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    const optimalSize = Math.max(0, Math.min(kellyFraction, this.maxPositionSize));
    
    return portfolioValue * optimalSize;
  }

  // Check if trade is allowed
  async canTrade(amount, pair, operation) {
    if (this.emergencyStop) {
      throw new Error('🚨 EMERGENCY STOP ACTIVATED - Trading disabled');
    }

    if (!this.tradingEnabled) {
      throw new Error('Trading is currently disabled');
    }

    // Check daily loss limit
    if (this.dailyLoss >= this.dailyLossLimit) {
      this.disableTrading('Daily loss limit reached');
      throw new Error(`Daily loss limit reached: ${this.dailyLoss}/${this.dailyLossLimit} USDT`);
    }

    // Check consecutive losses
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      this.disableTrading('Max consecutive losses reached');
      throw new Error(`Max consecutive losses reached: ${this.consecutiveLosses}`);
    }

    // Check position size
    if (amount > this.maxPositionSize) {
      throw new Error(`Position size too large: ${amount} > ${this.maxPositionSize}`);
    }

    // Check circuit breakers
    try {
      await this.circuitBreakers.trading.execute(async () => {
        // This will throw if circuit is open
        return true;
      });
    } catch (error) {
      throw new Error(`Trading circuit breaker is open: ${error.message}`);
    }

    return true;
  }

  // Update risk metrics after trade
  updateMetrics(trade) {
    this.riskMetrics.totalTrades++;
    
    if (trade.profitLoss > 0) {
      this.riskMetrics.profitableTrades++;
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses++;
      this.dailyLoss += Math.abs(trade.profitLoss);
    }

    this.riskMetrics.dailyPnL += trade.profitLoss;
    
    // Update win rate
    this.riskMetrics.winRate = this.riskMetrics.profitableTrades / this.riskMetrics.totalTrades;

    // Check for emergency stop
    if (this.dailyLoss >= this.emergencyStopThreshold) {
      this.activateEmergencyStop();
    }

    logger.info(`Risk metrics updated - Daily P&L: ${this.riskMetrics.dailyPnL.toFixed(2)} USDT, Win Rate: ${(this.riskMetrics.winRate * 100).toFixed(1)}%`);
  }

  // Disable trading with reason
  disableTrading(reason) {
    this.tradingEnabled = false;
    logger.warn(`🚫 Trading disabled: ${reason}`);
  }

  // Enable trading
  enableTrading(reason = 'Manual override') {
    this.tradingEnabled = true;
    this.emergencyStop = false;
    logger.info(`✅ Trading enabled: ${reason}`);
  }

  // Activate emergency stop
  activateEmergencyStop() {
    this.emergencyStop = true;
    this.tradingEnabled = false;
    logger.error(`🚨 EMERGENCY STOP ACTIVATED - Daily loss: ${this.dailyLoss} USDT`);
    
    // Send alerts (implement notification system)
    this.sendEmergencyAlert();
  }

  // Send emergency alert
  sendEmergencyAlert() {
    // Implement notification system (email, SMS, Discord, etc.)
    logger.error('🚨 EMERGENCY ALERT: Trading bot stopped due to excessive losses');
  }

  // Reset daily metrics
  resetDailyMetrics() {
    this.dailyLoss = 0;
    this.riskMetrics.dailyPnL = 0;
    logger.info('📊 Daily risk metrics reset');
  }

  // Get current risk status
  getRiskStatus() {
    return {
      tradingEnabled: this.tradingEnabled,
      emergencyStop: this.emergencyStop,
      dailyLoss: this.dailyLoss,
      dailyLossLimit: this.dailyLossLimit,
      consecutiveLosses: this.consecutiveLosses,
      maxConsecutiveLosses: this.maxConsecutiveLosses,
      riskMetrics: this.riskMetrics,
      circuitBreakers: {
        trading: this.circuitBreakers.trading.getState(),
        dex: this.circuitBreakers.dex.getState(),
        priceFeed: this.circuitBreakers.priceFeed.getState()
      }
    };
  }

  // Market condition analysis
  analyzeMarketConditions(priceHistory, volatility) {
    const conditions = {
      isVolatile: volatility > 0.05, // 5% volatility threshold
      isTrending: this.detectTrend(priceHistory),
      liquidityRisk: this.assessLiquidityRisk(priceHistory)
    };

    // Adjust risk parameters based on market conditions
    if (conditions.isVolatile) {
      this.maxPositionSize *= 0.5; // Reduce position size in volatile markets
      logger.warn('⚠️ High volatility detected - reducing position sizes');
    }

    return conditions;
  }

  detectTrend(priceHistory) {
    if (priceHistory.length < 20) return false;
    
    const recent = priceHistory.slice(-20);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    return Math.abs(last - first) / first > 0.02; // 2% move indicates trend
  }

  assessLiquidityRisk(priceHistory) {
    // Simple liquidity risk assessment
    const recent = priceHistory.slice(-10);
    const volatility = this.calculateVolatility(recent);
    
    return volatility > 0.03; // 3% volatility indicates liquidity risk
  }

  calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
}

module.exports = { CircuitBreaker, RiskManager };
