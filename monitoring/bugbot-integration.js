/**
 * BugBot Integration Module
 * Enhances error detection and reporting for Cursor's BugBot
 */

const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

class BugBotIntegration {
  constructor() {
    this.bugReportPath = path.join(__dirname, '../logs/bugbot-reports.json');
    this.criticalBugs = [];
    this.bugPatterns = this.initializeBugPatterns();
  }

  /**
   * Initialize known bug patterns specific to trading bot
   */
  initializeBugPatterns() {
    return {
      // Exit system bugs
      exitFailure: {
        pattern: /executeExit.*failed|exit.*not.*triggered|no.*exits/i,
        severity: 'critical',
        category: 'trading_logic',
        description: 'Exit system not working properly'
      },

      // Position monitoring bugs
      monitoringFailure: {
        pattern: /monitoring.*failed|position.*not.*monitored|monitorPositions.*error/i,
        severity: 'critical',
        category: 'trading_logic',
        description: 'Position monitoring not executing'
      },

      // Take profit bugs
      takeProfitIssue: {
        pattern: /take.*profit.*not.*reached|TP.*never.*hit|0.*wins/i,
        severity: 'high',
        category: 'trading_logic',
        description: 'Take profit targets not being reached'
      },

      // Price data bugs
      priceDataError: {
        pattern: /price.*undefined|price.*null|getCurrentPrice.*failed/i,
        severity: 'critical',
        category: 'data_integrity',
        description: 'Price data unavailable or invalid'
      },

      // Database bugs
      databaseError: {
        pattern: /database.*error|sequelize.*error|trade.*save.*failed/i,
        severity: 'high',
        category: 'persistence',
        description: 'Database operation failed'
      },

      // Rate limiter bugs
      rateLimiterBug: {
        pattern: /rate.*limit.*bypass|too.*many.*trades|exceeded.*limit/i,
        severity: 'medium',
        category: 'risk_management',
        description: 'Rate limiter not working properly'
      },

      // Risk management bugs
      riskManagementBug: {
        pattern: /risk.*check.*failed|position.*size.*exceeded|daily.*loss.*limit/i,
        severity: 'critical',
        category: 'risk_management',
        description: 'Risk management checks failed'
      },

      // Memory leaks
      memoryLeak: {
        pattern: /heap.*out.*of.*memory|memory.*leak|high.*memory.*usage/i,
        severity: 'high',
        category: 'performance',
        description: 'Potential memory leak detected'
      }
    };
  }

  /**
   * Analyze log entries for bug patterns
   * @param {string} logEntry - Log entry to analyze
   */
  async analyzeLogs(logEntry) {
    try {
      for (const [bugType, config] of Object.entries(this.bugPatterns)) {
        if (config.pattern.test(logEntry)) {
          await this.reportBug({
            type: bugType,
            severity: config.severity,
            category: config.category,
            description: config.description,
            logEntry: logEntry,
            timestamp: new Date().toISOString(),
            detected: true
          });
        }
      }
    } catch (error) {
      logger.error('BugBot analysis failed:', error);
    }
  }

  /**
   * Report a detected bug
   * @param {Object} bugReport - Bug report details
   */
  async reportBug(bugReport) {
    try {
      // Add to in-memory critical bugs
      if (bugReport.severity === 'critical') {
        this.criticalBugs.push(bugReport);

        // Alert immediately for critical bugs
        logger.error(`🚨 CRITICAL BUG DETECTED: ${bugReport.description}`, {
          type: bugReport.type,
          category: bugReport.category,
          logEntry: bugReport.logEntry
        });
      }

      // Persist to file for BugBot dashboard
      await this.persistBugReport(bugReport);

      // Generate fix suggestion
      const suggestion = this.generateFixSuggestion(bugReport);
      if (suggestion) {
        logger.info(`💡 Fix suggestion: ${suggestion}`);
      }
    } catch (error) {
      logger.error('Failed to report bug:', error);
    }
  }

  /**
   * Persist bug report to file
   * @param {Object} bugReport - Bug report to persist
   */
  async persistBugReport(bugReport) {
    try {
      let reports = [];

      // Read existing reports
      try {
        const data = await fs.readFile(this.bugReportPath, 'utf8');
        reports = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start fresh
        reports = [];
      }

      // Add new report
      reports.push(bugReport);

      // Keep only last 1000 reports
      if (reports.length > 1000) {
        reports = reports.slice(-1000);
      }

      // Write back
      await fs.writeFile(
        this.bugReportPath,
        JSON.stringify(reports, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.error('Failed to persist bug report:', error);
    }
  }

  /**
   * Generate fix suggestion based on bug type
   * @param {Object} bugReport - Bug report
   * @returns {string} Fix suggestion
   */
  generateFixSuggestion(bugReport) {
    const suggestions = {
      exitFailure: 'Check if monitorPositions() cron job is running. Verify TP/SL thresholds are reachable.',
      monitoringFailure: 'Verify cron job is scheduled and executing. Check for errors in monitorPositions() function.',
      takeProfitIssue: 'Consider lowering TP percentage from 0.8% to 0.3-0.5% for more frequent exits.',
      priceDataError: 'Check RPC provider connection. Verify getCurrentPrice() implementation.',
      databaseError: 'Check database connection. Ensure sequelize is properly initialized.',
      rateLimiterBug: 'Review rate limiter configuration. Check for bypass conditions.',
      riskManagementBug: 'Review position sizing logic. Check risk manager state.',
      memoryLeak: 'Check for unclosed connections or growing arrays. Consider using connection pooling.'
    };

    return suggestions[bugReport.type] || 'Review related code and logs for more details.';
  }

  /**
   * Get critical bugs count
   * @returns {number} Number of critical bugs
   */
  getCriticalBugsCount() {
    return this.criticalBugs.length;
  }

  /**
   * Get all critical bugs
   * @returns {Array} Array of critical bug reports
   */
  getCriticalBugs() {
    return this.criticalBugs;
  }

  /**
   * Monitor trading metrics for anomalies
   * @param {Object} metrics - Trading metrics
   */
  async monitorTradingMetrics(metrics) {
    try {
      const anomalies = [];

      // Check for 0 exits over extended period
      if (metrics.totalTrades > 50 && metrics.exits === 0) {
        anomalies.push({
          type: 'zero_exits',
          severity: 'critical',
          description: `${metrics.totalTrades} trades created but 0 exits`,
          suggestion: 'Exit system may be blocked. Check TP/SL logic.'
        });
      }

      // Check for 0 P&L with many trades
      if (metrics.totalTrades > 20 && metrics.totalPnL === 0) {
        anomalies.push({
          type: 'zero_pnl',
          severity: 'high',
          description: 'No P&L despite many trades',
          suggestion: 'Positions may not be closing. Check exit conditions.'
        });
      }

      // Check for extreme win/loss ratios
      if (metrics.wins > 0 && metrics.losses === 0 && metrics.totalTrades > 100) {
        anomalies.push({
          type: 'suspicious_winrate',
          severity: 'medium',
          description: '100% win rate may indicate SL not triggering',
          suggestion: 'Verify stop loss implementation.'
        });
      }

      // Report anomalies
      for (const anomaly of anomalies) {
        await this.reportBug({
          type: anomaly.type,
          severity: anomaly.severity,
          category: 'trading_metrics',
          description: anomaly.description,
          timestamp: new Date().toISOString(),
          detected: true,
          metrics: metrics
        });

        logger.warn(`🔍 Anomaly detected: ${anomaly.description}`);
        logger.info(`💡 ${anomaly.suggestion}`);
      }
    } catch (error) {
      logger.error('Failed to monitor trading metrics:', error);
    }
  }

  /**
   * Clear old bug reports
   */
  async clearOldReports(olderThanDays = 7) {
    try {
      const data = await fs.readFile(this.bugReportPath, 'utf8');
      const reports = JSON.parse(data);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const filteredReports = reports.filter(report => {
        const reportDate = new Date(report.timestamp);
        return reportDate > cutoffDate;
      });

      await fs.writeFile(
        this.bugReportPath,
        JSON.stringify(filteredReports, null, 2),
        'utf8'
      );

      logger.info(`Cleared ${reports.length - filteredReports.length} old bug reports`);
    } catch (error) {
      logger.error('Failed to clear old reports:', error);
    }
  }
}

module.exports = BugBotIntegration;







