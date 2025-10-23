/**
 * 🎯 Error Severity Classification System
 *
 * Classifies errors by severity level to prevent false emergency shutdowns.
 * Only CRITICAL errors should increment the consecutive error counter.
 */

const logger = require('../logger');

// Error severity levels
const ErrorSeverity = {
  DEBUG: 'DEBUG',       // Development/debugging info
  INFO: 'INFO',         // Informational messages
  WARN: 'WARN',         // Warning - no action needed but worth noting
  ERROR: 'ERROR',       // Error - needs attention but not critical
  CRITICAL: 'CRITICAL'  // Critical - may require emergency shutdown
};

// Error types and their default severity
const ErrorTypes = {
  // Business logic (not errors)
  VALIDATION_FAILED: ErrorSeverity.INFO,
  CONFIDENCE_TOO_LOW: ErrorSeverity.INFO,
  POSITION_SIZE_TOO_LARGE: ErrorSeverity.WARN,
  DAILY_LIMIT_REACHED: ErrorSeverity.WARN,
  HOURLY_LIMIT_REACHED: ErrorSeverity.WARN,

  // Operational warnings
  SLIPPAGE_HIGH: ErrorSeverity.WARN,
  GAS_PRICE_HIGH: ErrorSeverity.WARN,
  NETWORK_SLOW: ErrorSeverity.WARN,
  API_RATE_LIMIT: ErrorSeverity.WARN,

  // Errors (need attention)
  TRANSACTION_FAILED: ErrorSeverity.ERROR,
  DATABASE_ERROR: ErrorSeverity.ERROR,
  PRICE_FETCH_FAILED: ErrorSeverity.ERROR,
  WALLET_ERROR: ErrorSeverity.ERROR,

  // Critical (emergency shutdown candidates)
  WALLET_COMPROMISED: ErrorSeverity.CRITICAL,
  EXCHANGE_UNAVAILABLE: ErrorSeverity.CRITICAL,
  DATABASE_CORRUPTED: ErrorSeverity.CRITICAL,
  CATASTROPHIC_LOSS: ErrorSeverity.CRITICAL,
  SYSTEM_CRASH: ErrorSeverity.CRITICAL
};

class ErrorClassifier {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 1000;
    this.severityThresholds = {
      [ErrorSeverity.CRITICAL]: {
        maxConsecutive: 3,      // 3 consecutive critical errors = shutdown
        maxPerHour: 10,         // 10 critical errors/hour = shutdown
        requiresShutdown: true
      },
      [ErrorSeverity.ERROR]: {
        maxConsecutive: 10,     // 10 consecutive errors = warning
        maxPerHour: 50,         // 50 errors/hour = warning
        requiresShutdown: false
      },
      [ErrorSeverity.WARN]: {
        maxConsecutive: 20,
        maxPerHour: 100,
        requiresShutdown: false
      }
    };
  }

  /**
   * Classify an error and determine if action is needed
   * @param {string} errorType - Type of error (from ErrorTypes)
   * @param {Error|string} error - The actual error
   * @param {Object} context - Additional context
   * @returns {Object} Classification result
   */
  classify(errorType, error, context = {}) {
    const severity = this.determineSeverity(errorType, error, context);
    const shouldCount = this.shouldCountError(severity);
    const shouldShutdown = this.shouldTriggerShutdown(severity);

    const classification = {
      type: errorType,
      severity,
      shouldCount,
      shouldShutdown,
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      context
    };

    // Add to history
    this.errorHistory.push(classification);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }

    // Log with appropriate level
    this.logError(classification);

    return classification;
  }

  /**
   * Determine severity based on error type and context
   */
  determineSeverity(errorType, error, context) {
    // Use predefined severity
    let severity = ErrorTypes[errorType] || ErrorSeverity.ERROR;

    // Context-based overrides
    if (context.isRetryable === false) {
      severity = ErrorSeverity.CRITICAL;
    }

    if (context.portfolioLoss && context.portfolioLoss > 0.1) { // 10% loss
      severity = ErrorSeverity.CRITICAL;
    }

    if (context.consecutiveCount && context.consecutiveCount > 5) {
      // Escalate severity if many consecutive errors
      if (severity === ErrorSeverity.ERROR) {
        severity = ErrorSeverity.CRITICAL;
      }
    }

    return severity;
  }

  /**
   * Determine if error should be counted toward consecutive error limit
   */
  shouldCountError(severity) {
    // Only count ERROR and CRITICAL toward consecutive error limit
    return severity === ErrorSeverity.ERROR || severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Determine if error should trigger emergency shutdown
   */
  shouldTriggerShutdown(severity) {
    if (severity !== ErrorSeverity.CRITICAL) {
      return false;
    }

    // Check if we've hit the threshold for critical errors
    const recentCritical = this.getRecentErrors(ErrorSeverity.CRITICAL, 3600000); // 1 hour
    const consecutiveCritical = this.getConsecutiveErrors(ErrorSeverity.CRITICAL);

    const threshold = this.severityThresholds[ErrorSeverity.CRITICAL];

    return consecutiveCritical >= threshold.maxConsecutive ||
           recentCritical.length >= threshold.maxPerHour;
  }

  /**
   * Log error with appropriate severity
   */
  logError(classification) {
    const { severity, type, message } = classification;
    const prefix = this.getSeverityIcon(severity);
    const logMsg = `${prefix} [${severity}] ${type}: ${message}`;

    switch (severity) {
      case ErrorSeverity.DEBUG:
        logger.debug(logMsg);
        break;
      case ErrorSeverity.INFO:
        logger.info(logMsg);
        break;
      case ErrorSeverity.WARN:
        logger.warn(logMsg);
        break;
      case ErrorSeverity.ERROR:
        logger.error(logMsg);
        break;
      case ErrorSeverity.CRITICAL:
        logger.error(`🚨 ${logMsg}`);
        break;
      default:
        logger.info(logMsg);
    }
  }

  /**
   * Get icon for severity level
   */
  getSeverityIcon(severity) {
    const icons = {
      [ErrorSeverity.DEBUG]: '🔍',
      [ErrorSeverity.INFO]: 'ℹ️',
      [ErrorSeverity.WARN]: '⚠️',
      [ErrorSeverity.ERROR]: '❌',
      [ErrorSeverity.CRITICAL]: '🚨'
    };
    return icons[severity] || 'ℹ️';
  }

  /**
   * Get recent errors by severity
   */
  getRecentErrors(severity, timeWindowMs = 3600000) {
    const cutoff = Date.now() - timeWindowMs;
    return this.errorHistory.filter(e =>
      e.severity === severity && e.timestamp > cutoff
    );
  }

  /**
   * Get consecutive errors by severity
   */
  getConsecutiveErrors(severity) {
    let count = 0;
    for (let i = this.errorHistory.length - 1; i >= 0; i--) {
      if (this.errorHistory[i].severity === severity) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Get error statistics
   */
  getStats(timeWindowMs = 3600000) {
    const cutoff = Date.now() - timeWindowMs;
    const recentErrors = this.errorHistory.filter(e => e.timestamp > cutoff);

    const stats = {
      total: recentErrors.length,
      bySeverity: {},
      byType: {},
      consecutiveCritical: this.getConsecutiveErrors(ErrorSeverity.CRITICAL),
      consecutiveError: this.getConsecutiveErrors(ErrorSeverity.ERROR)
    };

    // Count by severity
    for (const severity of Object.values(ErrorSeverity)) {
      stats.bySeverity[severity] = recentErrors.filter(e => e.severity === severity).length;
    }

    // Count by type
    for (const error of recentErrors) {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Reset error history
   */
  reset() {
    this.errorHistory = [];
    logger.info('✅ Error classifier history reset');
  }

  /**
   * Clear non-critical errors (keep critical for analysis)
   */
  clearNonCritical() {
    this.errorHistory = this.errorHistory.filter(e => e.severity === ErrorSeverity.CRITICAL);
    logger.info(`✅ Cleared non-critical errors, kept ${this.errorHistory.length} critical errors`);
  }
}

// Export singleton instance
const errorClassifier = new ErrorClassifier();

module.exports = {
  ErrorSeverity,
  ErrorTypes,
  ErrorClassifier,
  errorClassifier
};
