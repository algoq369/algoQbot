const logger = require('../logger');

class VolatilityTracker {
  constructor(lookbackDays = 5) {
    this.lookbackDays = lookbackDays;
    this.volatilityHistory = [];
    this.maxHistorySize = lookbackDays * 288; // 5 days × 288 5-min periods
  }

  // Add new volatility reading
  addReading(volatility, timestamp = Date.now()) {
    this.volatilityHistory.push({
      value: volatility,
      timestamp: timestamp
    });

    // Keep only last 5 days
    if (this.volatilityHistory.length > this.maxHistorySize) {
      this.volatilityHistory.shift();
    }
  }

  // Get 5-day moving average
  getMovingAverage() {
    if (this.volatilityHistory.length === 0) {
      return 0.03; // 3% default
    }

    const sum = this.volatilityHistory.reduce((acc, reading) => acc + reading.value, 0);
    return sum / this.volatilityHistory.length;
  }

  // Calculate dynamic cap
  getDynamicCap() {
    const avgVolatility = this.getMovingAverage();
    const dynamicCap = Math.min(avgVolatility * 2, 0.10); // 2x avg, max 10%

    logger.debug(`📊 Dynamic cap: ${(dynamicCap * 100).toFixed(2)}% (5-day avg: ${(avgVolatility * 100).toFixed(2)}%)`);

    return dynamicCap;
  }

  // Check if current volatility is suspicious
  isSuspicious(currentVolatility) {
    const dynamicCap = this.getDynamicCap();
    return currentVolatility > dynamicCap;
  }

  // Get statistics
  getStats() {
    const avgVolatility = this.getMovingAverage();
    const dynamicCap = this.getDynamicCap();
    const readings = this.volatilityHistory.length;

    return {
      avgVolatility: avgVolatility,
      dynamicCap: dynamicCap,
      totalReadings: readings,
      daysOfData: readings / 288
    };
  }
}

module.exports = VolatilityTracker;
