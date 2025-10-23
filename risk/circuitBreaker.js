const logger = require('../logger');

/**
 * Circuit Breaker - Stops trading after excessive losses
 * Expert-optimized version focused on loss protection
 */
class CircuitBreaker {
  constructor() {
    this.isTripped = false;
    this.trippedAt = null;
    this.cooldownMinutes = 30;

    // Thresholds
    this.maxConsecutiveLosses = 3;
    this.maxHourlyLoss = 1000;
    this.maxDailyLoss = 3000;

    // Tracking
    this.consecutiveLosses = 0;
    this.hourlyLosses = [];
    this.dailyLosses = [];
  }

  recordTrade(profit, tradeSize) {
    const now = Date.now();

    if (profit < 0) {
      this.consecutiveLosses++;
      const loss = Math.abs(profit);
      this.hourlyLosses.push({ time: now, loss });
      this.dailyLosses.push({ time: now, loss });

      logger.warn(`⚠️  Loss recorded: $${loss.toFixed(2)} (consecutive: ${this.consecutiveLosses})`);
    } else {
      this.consecutiveLosses = 0;
    }

    // Clean old data
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    this.hourlyLosses = this.hourlyLosses.filter(l => l.time > oneHourAgo);
    this.dailyLosses = this.dailyLosses.filter(l => l.time > oneDayAgo);

    this.checkCircuit();
  }

  checkCircuit() {
    const hourlyTotal = this.hourlyLosses.reduce((sum, l) => sum + l.loss, 0);
    const dailyTotal = this.dailyLosses.reduce((sum, l) => sum + l.loss, 0);

    let reason = null;

    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      reason = `${this.consecutiveLosses} consecutive losses`;
    } else if (hourlyTotal >= this.maxHourlyLoss) {
      reason = `$${hourlyTotal.toFixed(2)} hourly loss`;
    } else if (dailyTotal >= this.maxDailyLoss) {
      reason = `$${dailyTotal.toFixed(2)} daily loss`;
    }

    if (reason && !this.isTripped) {
      this.trip(reason);
    }
  }

  trip(reason) {
    this.isTripped = true;
    this.trippedAt = Date.now();
    logger.error(`🚨 CIRCUIT BREAKER TRIPPED: ${reason}`);
    logger.error(`⏸️  Trading PAUSED for ${this.cooldownMinutes} minutes`);
  }

  canTrade() {
    if (!this.isTripped) return true;

    const minutesSince = (Date.now() - this.trippedAt) / (1000 * 60);

    if (minutesSince >= this.cooldownMinutes) {
      logger.info('✅ Circuit breaker reset - Trading resumed');
      this.reset();
      return true;
    }

    logger.debug(`Circuit breaker active: ${(this.cooldownMinutes - minutesSince).toFixed(1)}min remaining`);
    return false;
  }

  reset() {
    this.isTripped = false;
    this.trippedAt = null;
    this.consecutiveLosses = 0;
    this.hourlyLosses = [];
    this.dailyLosses = [];
    logger.info('🔄 Circuit breaker reset');
  }

  getStatus() {
    return {
      isTripped: this.isTripped,
      consecutiveLosses: this.consecutiveLosses,
      hourlyLoss: this.hourlyLosses.reduce((sum, l) => sum + l.loss, 0),
      dailyLoss: this.dailyLosses.reduce((sum, l) => sum + l.loss, 0),
      trippedAt: this.trippedAt,
      minutesRemaining: this.isTripped
        ? Math.max(0, this.cooldownMinutes - (Date.now() - this.trippedAt) / (1000 * 60))
        : 0
    };
  }
}

module.exports = CircuitBreaker;
