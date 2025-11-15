const logger = require('../logger');

class PerformanceTracker {
  constructor() {
    this.timings = new Map();
    this.history = [];
  }

  start(label) {
    this.timings.set(label, Date.now());
  }

  end(label) {
    const start = this.timings.get(label);
    if (!start) return null;

    const duration = Date.now() - start;
    this.timings.delete(label);

    // Store in history
    this.history.push({ label, duration, timestamp: Date.now() });

    // Keep only last 100 measurements
    if (this.history.length > 100) {
      this.history.shift();
    }

    return duration;
  }

  async measure(label, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;

      // Log slow operations
      if (duration > 1000) {
        logger.warn(`🐢 SLOW: ${label} took ${duration}ms`);
      } else if (duration > 500) {
        logger.debug(`⚠️  ${label} took ${duration}ms`);
      } else {
        logger.debug(`⚡ ${label} took ${duration}ms`);
      }

      // Store in history
      this.history.push({ label, duration, timestamp: Date.now() });
      if (this.history.length > 100) this.history.shift();

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`❌ ${label} failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  getAverageTime(label) {
    const measurements = this.history.filter(h => h.label === label);
    if (measurements.length === 0) return null;

    const sum = measurements.reduce((acc, m) => acc + m.duration, 0);
    return sum / measurements.length;
  }

  getStats(label) {
    const measurements = this.history.filter(h => h.label === label);
    if (measurements.length === 0) return null;

    const durations = measurements.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return {
      count: measurements.length,
      average: Math.round(avg),
      min,
      max,
      latest: durations[durations.length - 1]
    };
  }

  getAllStats() {
    const labels = [...new Set(this.history.map(h => h.label))];
    return labels.map(label => ({
      operation: label,
      ...this.getStats(label)
    })).sort((a, b) => (b.average || 0) - (a.average || 0));
  }
}

module.exports = new PerformanceTracker();
