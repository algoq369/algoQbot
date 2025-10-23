/**
 * 📊 Performance Monitoring System
 *
 * Tracks and monitors system performance metrics:
 * - API call latency
 * - Database query performance
 * - Memory usage
 * - Trade execution times
 * - Event loop lag
 */

const logger = require('../logger');
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      apiCalls: new Map(),
      dbQueries: new Map(),
      trades: [],
      system: {
        memoryUsage: [],
        eventLoopLag: [],
        cpuUsage: []
      }
    };

    this.thresholds = {
      apiLatency: 3000,      // 3 seconds
      dbLatency: 1000,       // 1 second
      tradeLatency: 5000,    // 5 seconds
      memoryUsage: 500,      // 500 MB
      eventLoopLag: 100      // 100ms
    };

    this.monitoringInterval = null;
    this.eventLoopStart = null;
  }

  /**
   * Start performance monitoring
   */
  start() {
    // Monitor event loop lag
    this.startEventLoopMonitoring();

    // Monitor system metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkThresholds();
    }, 30000);

    logger.info('📊 Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('📊 Performance monitoring stopped');
  }

  /**
   * Track API call performance
   */
  trackApiCall(name, startTime, success = true, error = null) {
    const duration = Date.now() - startTime;

    if (!this.metrics.apiCalls.has(name)) {
      this.metrics.apiCalls.set(name, {
        name,
        calls: [],
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0
      });
    }

    const metric = this.metrics.apiCalls.get(name);
    metric.calls.push({ duration, success, error, timestamp: Date.now() });
    metric.totalCalls++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.totalCalls;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);

    if (success) {
      metric.successCalls++;
    } else {
      metric.failedCalls++;
    }

    // Keep only last 100 calls
    if (metric.calls.length > 100) {
      metric.calls = metric.calls.slice(-100);
    }

    // Log slow API calls
    if (duration > this.thresholds.apiLatency) {
      logger.warn(`⚠️  Slow API call: ${name} took ${duration}ms (threshold: ${this.thresholds.apiLatency}ms)`);
      this.emit('slowApiCall', { name, duration });
    }

    return duration;
  }

  /**
   * Track database query performance
   */
  trackDbQuery(query, startTime, success = true, rowCount = 0) {
    const duration = Date.now() - startTime;

    if (!this.metrics.dbQueries.has(query)) {
      this.metrics.dbQueries.set(query, {
        query,
        executions: [],
        totalExecutions: 0,
        successExecutions: 0,
        failedExecutions: 0,
        totalDuration: 0,
        avgDuration: 0,
        totalRows: 0
      });
    }

    const metric = this.metrics.dbQueries.get(query);
    metric.executions.push({ duration, success, rowCount, timestamp: Date.now() });
    metric.totalExecutions++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.totalExecutions;
    metric.totalRows += rowCount;

    if (success) {
      metric.successExecutions++;
    } else {
      metric.failedExecutions++;
    }

    // Keep only last 100 executions
    if (metric.executions.length > 100) {
      metric.executions = metric.executions.slice(-100);
    }

    // Log slow queries
    if (duration > this.thresholds.dbLatency) {
      logger.warn(`⚠️  Slow DB query: ${query.substring(0, 50)}... took ${duration}ms`);
      this.emit('slowDbQuery', { query, duration });
    }

    return duration;
  }

  /**
   * Track trade execution performance
   */
  trackTrade(tradeId, action, startTime, success = true, result = {}) {
    const duration = Date.now() - startTime;

    const tradeMetric = {
      tradeId,
      action,
      duration,
      success,
      timestamp: Date.now(),
      result
    };

    this.metrics.trades.push(tradeMetric);

    // Keep only last 1000 trades
    if (this.metrics.trades.length > 1000) {
      this.metrics.trades = this.metrics.trades.slice(-1000);
    }

    // Log slow trades
    if (duration > this.thresholds.tradeLatency) {
      logger.warn(`⚠️  Slow trade execution: ${action} took ${duration}ms`);
      this.emit('slowTrade', { tradeId, action, duration });
    }

    logger.performance(`trade_execution_${action}`, duration, { tradeId, success });

    return duration;
  }

  /**
   * Start event loop monitoring
   */
  startEventLoopMonitoring() {
    this.eventLoopStart = Date.now();

    const checkEventLoop = () => {
      const now = Date.now();
      const lag = now - this.eventLoopStart - 100; // Expected 100ms interval

      if (lag > 0) {
        this.metrics.system.eventLoopLag.push({ lag, timestamp: now });

        if (this.metrics.system.eventLoopLag.length > 100) {
          this.metrics.system.eventLoopLag = this.metrics.system.eventLoopLag.slice(-100);
        }

        if (lag > this.thresholds.eventLoopLag) {
          logger.warn(`⚠️  Event loop lag detected: ${lag}ms`);
          this.emit('eventLoopLag', { lag });
        }
      }

      this.eventLoopStart = now;
      setTimeout(checkEventLoop, 100);
    };

    checkEventLoop();
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    this.metrics.system.memoryUsage.push({
      ...memoryMB,
      timestamp: Date.now()
    });

    // Keep only last 100 samples
    if (this.metrics.system.memoryUsage.length > 100) {
      this.metrics.system.memoryUsage = this.metrics.system.memoryUsage.slice(-100);
    }

    // CPU usage
    const cpuUsage = process.cpuUsage();
    this.metrics.system.cpuUsage.push({
      user: cpuUsage.user,
      system: cpuUsage.system,
      timestamp: Date.now()
    });

    if (this.metrics.system.cpuUsage.length > 100) {
      this.metrics.system.cpuUsage = this.metrics.system.cpuUsage.slice(-100);
    }

    // Log current metrics
    logger.performance('memory_heap_used', memoryMB.heapUsed);
    logger.performance('memory_rss', memoryMB.rss);
  }

  /**
   * Check if metrics exceed thresholds
   */
  checkThresholds() {
    // Check memory usage
    const recentMemory = this.metrics.system.memoryUsage.slice(-5);
    const avgHeapUsed = recentMemory.reduce((sum, m) => sum + m.heapUsed, 0) / recentMemory.length;

    if (avgHeapUsed > this.thresholds.memoryUsage) {
      logger.warn(`⚠️  High memory usage: ${avgHeapUsed.toFixed(0)} MB (threshold: ${this.thresholds.memoryUsage} MB)`);
      this.emit('highMemoryUsage', { avgHeapUsed });
    }

    // Check event loop lag
    const recentLag = this.metrics.system.eventLoopLag.slice(-10);
    if (recentLag.length > 0) {
      const avgLag = recentLag.reduce((sum, l) => sum + l.lag, 0) / recentLag.length;
      if (avgLag > this.thresholds.eventLoopLag) {
        logger.warn(`⚠️  Persistent event loop lag: ${avgLag.toFixed(0)}ms`);
        this.emit('persistentEventLoopLag', { avgLag });
      }
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const stats = {
      apiCalls: {},
      dbQueries: {},
      trades: {
        total: this.metrics.trades.length,
        successful: this.metrics.trades.filter(t => t.success).length,
        failed: this.metrics.trades.filter(t => !t.success).length,
        avgDuration: 0
      },
      system: {
        currentMemory: this.metrics.system.memoryUsage[this.metrics.system.memoryUsage.length - 1] || {},
        avgEventLoopLag: 0
      }
    };

    // API call stats
    for (const [name, metric] of this.metrics.apiCalls) {
      stats.apiCalls[name] = {
        totalCalls: metric.totalCalls,
        successRate: ((metric.successCalls / metric.totalCalls) * 100).toFixed(1) + '%',
        avgDuration: Math.round(metric.avgDuration),
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration
      };
    }

    // DB query stats
    for (const [query, metric] of this.metrics.dbQueries) {
      const shortQuery = query.substring(0, 50);
      stats.dbQueries[shortQuery] = {
        totalExecutions: metric.totalExecutions,
        successRate: ((metric.successExecutions / metric.totalExecutions) * 100).toFixed(1) + '%',
        avgDuration: Math.round(metric.avgDuration),
        avgRows: Math.round(metric.totalRows / metric.totalExecutions)
      };
    }

    // Trade stats
    if (this.metrics.trades.length > 0) {
      const totalDuration = this.metrics.trades.reduce((sum, t) => sum + t.duration, 0);
      stats.trades.avgDuration = Math.round(totalDuration / this.metrics.trades.length);
    }

    // Event loop lag
    if (this.metrics.system.eventLoopLag.length > 0) {
      const totalLag = this.metrics.system.eventLoopLag.reduce((sum, l) => sum + l.lag, 0);
      stats.system.avgEventLoopLag = Math.round(totalLag / this.metrics.system.eventLoopLag.length);
    }

    return stats;
  }

  /**
   * Get detailed report
   */
  getReport() {
    const stats = this.getStats();

    return {
      timestamp: new Date().toISOString(),
      summary: {
        apiCalls: Object.keys(stats.apiCalls).length,
        dbQueries: Object.keys(stats.dbQueries).length,
        trades: stats.trades.total,
        memoryUsageMB: stats.system.currentMemory.heapUsed,
        eventLoopLagMs: stats.system.avgEventLoopLag
      },
      details: stats,
      alerts: this.getAlerts()
    };
  }

  /**
   * Get current alerts
   */
  getAlerts() {
    const alerts = [];

    // Check for slow API calls
    for (const [name, metric] of this.metrics.apiCalls) {
      if (metric.avgDuration > this.thresholds.apiLatency) {
        alerts.push({
          type: 'slowApiCall',
          severity: 'warning',
          message: `${name} avg latency ${metric.avgDuration}ms exceeds threshold ${this.thresholds.apiLatency}ms`
        });
      }
    }

    // Check for slow queries
    for (const [query, metric] of this.metrics.dbQueries) {
      if (metric.avgDuration > this.thresholds.dbLatency) {
        alerts.push({
          type: 'slowDbQuery',
          severity: 'warning',
          message: `Query avg latency ${metric.avgDuration}ms exceeds threshold ${this.thresholds.dbLatency}ms`
        });
      }
    }

    // Check memory
    const currentMem = this.metrics.system.memoryUsage[this.metrics.system.memoryUsage.length - 1];
    if (currentMem && currentMem.heapUsed > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'highMemoryUsage',
        severity: 'error',
        message: `Memory usage ${currentMem.heapUsed}MB exceeds threshold ${this.thresholds.memoryUsage}MB`
      });
    }

    return alerts;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.apiCalls.clear();
    this.metrics.dbQueries.clear();
    this.metrics.trades = [];
    this.metrics.system.memoryUsage = [];
    this.metrics.system.eventLoopLag = [];
    this.metrics.system.cpuUsage = [];

    logger.info('✅ Performance metrics reset');
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  performanceMonitor
};
