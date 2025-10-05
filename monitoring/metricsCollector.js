const logger = require('../logger');
const { performance } = require('perf_hooks');

class MetricsCollector {
  constructor() {
    this.metrics = {
      trading: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalVolume: 0,
        totalFees: 0,
        averageSlippage: 0,
        averageLatency: 0
      },
      performance: {
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
        throughput: 0
      },
      risk: {
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        profitFactor: 0
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0,
        apiCalls: 0,
        errors: 0
      }
    };

    this.latencyHistory = [];
    this.errorHistory = [];
    this.tradeHistory = [];
    this.startTime = Date.now();

    // Start monitoring
    this.startSystemMonitoring();
    
    logger.info('📊 Metrics Collector initialized');
  }

  // Record trade execution
  recordTrade(trade) {
    const startTime = performance.now();
    
    this.metrics.trading.totalTrades++;
    
    if (trade.success) {
      this.metrics.trading.successfulTrades++;
      this.metrics.trading.totalVolume += trade.amount;
      this.metrics.trading.totalFees += trade.fees || 0;
      
      if (trade.slippage) {
        this.updateAverageSlippage(trade.slippage);
      }
    } else {
      this.metrics.trading.failedTrades++;
      this.recordError(trade.error);
    }

    // Record latency
    const latency = performance.now() - startTime;
    this.recordLatency(latency);
    
    // Store trade history
    this.tradeHistory.push({
      ...trade,
      timestamp: Date.now(),
      latency
    });

    // Keep only last 1000 trades
    if (this.tradeHistory.length > 1000) {
      this.tradeHistory = this.tradeHistory.slice(-1000);
    }

    logger.debug(`Trade recorded - Success: ${trade.success}, Latency: ${latency.toFixed(2)}ms`);
  }

  // Record latency measurement
  recordLatency(latency) {
    this.latencyHistory.push({
      latency,
      timestamp: Date.now()
    });

    // Keep only last 1000 measurements
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory = this.latencyHistory.slice(-1000);
    }

    this.updateLatencyMetrics();
  }

  // Update latency metrics (p50, p95, p99)
  updateLatencyMetrics() {
    if (this.latencyHistory.length === 0) return;

    const latencies = this.latencyHistory.map(h => h.latency).sort((a, b) => a - b);
    const len = latencies.length;

    this.metrics.performance.p50Latency = latencies[Math.floor(len * 0.5)];
    this.metrics.performance.p95Latency = latencies[Math.floor(len * 0.95)];
    this.metrics.performance.p99Latency = latencies[Math.floor(len * 0.99)];
    this.metrics.trading.averageLatency = latencies.reduce((a, b) => a + b, 0) / len;
  }

  // Record error
  recordError(error) {
    this.errorHistory.push({
      error: error.message || error,
      timestamp: Date.now(),
      stack: error.stack
    });

    this.metrics.trading.failedTrades++;
    this.metrics.system.errors++;

    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }

    this.updateErrorRate();
  }

  // Update error rate
  updateErrorRate() {
    const totalOperations = this.metrics.trading.totalTrades + this.metrics.system.apiCalls;
    this.metrics.performance.errorRate = totalOperations > 0 ? 
      this.metrics.system.errors / totalOperations : 0;
  }

  // Update average slippage
  updateAverageSlippage(slippage) {
    const currentAvg = this.metrics.trading.averageSlippage;
    const totalTrades = this.metrics.trading.successfulTrades;
    
    this.metrics.trading.averageSlippage = 
      (currentAvg * (totalTrades - 1) + slippage) / totalTrades;
  }

  // Record API call
  recordApiCall(endpoint, latency, success) {
    this.metrics.system.apiCalls++;
    
    if (!success) {
      this.metrics.system.errors++;
    }

    this.recordLatency(latency);
    
    logger.debug(`API call recorded - ${endpoint}: ${latency.toFixed(2)}ms, Success: ${success}`);
  }

  // Calculate risk metrics
  calculateRiskMetrics() {
    if (this.tradeHistory.length < 2) return;

    const trades = this.tradeHistory.filter(t => t.success);
    if (trades.length === 0) return;

    // Calculate P&L
    const pnls = trades.map(t => t.profitLoss || 0);
    const totalPnL = pnls.reduce((a, b) => a + b, 0);
    
    // Win rate
    const winningTrades = trades.filter(t => (t.profitLoss || 0) > 0);
    this.metrics.risk.winRate = winningTrades.length / trades.length;

    // Profit factor
    const totalWins = winningTrades.reduce((a, t) => a + (t.profitLoss || 0), 0);
    const totalLosses = Math.abs(trades.filter(t => (t.profitLoss || 0) < 0)
      .reduce((a, t) => a + (t.profitLoss || 0), 0));
    
    this.metrics.risk.profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    // Sharpe ratio (simplified)
    const avgReturn = totalPnL / trades.length;
    const variance = pnls.reduce((a, pnl) => a + Math.pow(pnl - avgReturn, 2), 0) / trades.length;
    const stdDev = Math.sqrt(variance);
    
    this.metrics.risk.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let current = 0;
    
    for (const pnl of pnls) {
      current += pnl;
      if (current > peak) {
        peak = current;
      }
      const drawdown = peak - current;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    this.metrics.risk.maxDrawdown = maxDrawdown;

    logger.debug(`Risk metrics updated - Win Rate: ${(this.metrics.risk.winRate * 100).toFixed(1)}%, Sharpe: ${this.metrics.risk.sharpeRatio.toFixed(2)}`);
  }

  // Start system monitoring
  startSystemMonitoring() {
    setInterval(() => {
      this.updateSystemMetrics();
    }, 10000); // Every 10 seconds
  }

  // Update system metrics
  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.system.uptime = Date.now() - this.startTime;

    // Calculate throughput (trades per minute)
    const recentTrades = this.tradeHistory.filter(t => 
      Date.now() - t.timestamp < 60000 // Last minute
    );
    this.metrics.performance.throughput = recentTrades.length;

    logger.debug(`System metrics updated - Memory: ${this.metrics.system.memoryUsage.toFixed(2)}MB, Throughput: ${this.metrics.performance.throughput} trades/min`);
  }

  // Get comprehensive metrics
  getMetrics() {
    this.calculateRiskMetrics();
    
    return {
      ...this.metrics,
      summary: {
        uptime: this.formatUptime(this.metrics.system.uptime),
        totalTrades: this.metrics.trading.totalTrades,
        successRate: this.metrics.trading.totalTrades > 0 ? 
          (this.metrics.trading.successfulTrades / this.metrics.trading.totalTrades * 100).toFixed(1) + '%' : '0%',
        totalVolume: this.metrics.trading.totalVolume.toFixed(2) + ' USDT',
        averageLatency: this.metrics.trading.averageLatency.toFixed(2) + 'ms'
      },
      alerts: this.generateAlerts()
    };
  }

  // Generate alerts based on metrics
  generateAlerts() {
    const alerts = [];

    // High error rate
    if (this.metrics.performance.errorRate > 0.1) {
      alerts.push({
        type: 'error',
        message: `High error rate: ${(this.metrics.performance.errorRate * 100).toFixed(1)}%`,
        severity: 'high'
      });
    }

    // High latency
    if (this.metrics.performance.p95Latency > 5000) {
      alerts.push({
        type: 'performance',
        message: `High latency: P95 = ${this.metrics.performance.p95Latency.toFixed(2)}ms`,
        severity: 'medium'
      });
    }

    // Low win rate
    if (this.metrics.risk.winRate < 0.3) {
      alerts.push({
        type: 'risk',
        message: `Low win rate: ${(this.metrics.risk.winRate * 100).toFixed(1)}%`,
        severity: 'high'
      });
    }

    // High memory usage
    if (this.metrics.system.memoryUsage > 500) {
      alerts.push({
        type: 'system',
        message: `High memory usage: ${this.metrics.system.memoryUsage.toFixed(2)}MB`,
        severity: 'medium'
      });
    }

    return alerts;
  }

  // Format uptime
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      tradeHistory: this.tradeHistory.slice(-100), // Last 100 trades
      errorHistory: this.errorHistory.slice(-50), // Last 50 errors
      latencyHistory: this.latencyHistory.slice(-200) // Last 200 measurements
    };
  }

  // Reset metrics
  resetMetrics() {
    this.metrics.trading.totalTrades = 0;
    this.metrics.trading.successfulTrades = 0;
    this.metrics.trading.failedTrades = 0;
    this.metrics.trading.totalVolume = 0;
    this.metrics.trading.totalFees = 0;
    this.metrics.system.errors = 0;
    this.metrics.system.apiCalls = 0;
    
    this.tradeHistory = [];
    this.errorHistory = [];
    this.latencyHistory = [];
    
    logger.info('📊 Metrics reset');
  }
}

module.exports = MetricsCollector;
