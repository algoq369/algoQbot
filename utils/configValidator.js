/**
 * ⚙️ Configuration Validation System
 *
 * Validates bot configuration before startup to prevent runtime errors.
 */

const logger = require('../logger');

class ConfigValidator {
  constructor() {
    this.validationRules = {
      // RPC and network
      'network.rpc_url': {
        type: 'string',
        required: true,
        validate: (val) => val.startsWith('http'),
        message: 'RPC URL must start with http'
      },
      'network.chain_id': {
        type: 'number',
        required: true,
        validate: (val) => val > 0,
        message: 'Chain ID must be positive'
      },

      // Risk limits
      'risk.maxPositionSize': {
        type: 'number',
        required: true,
        min: 0.01,
        max: 0.1,
        message: 'Max position size must be between 1% and 10%'
      },
      'risk.maxTradeSize': {
        type: 'number',
        required: true,
        min: 10,
        max: 10000,
        message: 'Max trade size must be between $10 and $10,000'
      },
      'risk.maxDailyLoss': {
        type: 'number',
        required: true,
        min: 100,
        max: 5000,
        message: 'Max daily loss must be between $100 and $5,000'
      },

      // Trading parameters
      'trading.takeProfitPercent': {
        type: 'number',
        required: true,
        min: 0.005,
        max: 0.05,
        message: 'Take profit must be between 0.5% and 5%'
      },
      'trading.stopLossPercent': {
        type: 'number',
        required: true,
        min: 0.01,
        max: 0.1,
        message: 'Stop loss must be between 1% and 10%'
      },

      // Logging
      'logging.level': {
        type: 'string',
        required: true,
        validate: (val) => ['debug', 'info', 'warn', 'error'].includes(val),
        message: 'Log level must be debug, info, warn, or error'
      }
    };
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validate(config) {
    const errors = [];
    const warnings = [];

    // Validate each rule
    for (const [path, rule] of Object.entries(this.validationRules)) {
      const value = this.getNestedValue(config, path);

      // Check required
      if (rule.required && value === undefined) {
        errors.push(`Missing required config: ${path}`);
        continue;
      }

      if (value === undefined) {
        continue; // Optional field not provided
      }

      // Check type
      if (rule.type && typeof value !== rule.type) {
        errors.push(`Invalid type for ${path}: expected ${rule.type}, got ${typeof value}`);
        continue;
      }

      // Check min/max
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${path} value ${value} below minimum ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${path} value ${value} above maximum ${rule.max}`);
        }
      }

      // Custom validation
      if (rule.validate && !rule.validate(value)) {
        errors.push(`${path}: ${rule.message}`);
      }
    }

    // Additional cross-field validations
    if (config.risk) {
      // Ensure stop loss < take profit makes sense
      if (config.trading?.stopLossPercent && config.trading?.takeProfitPercent) {
        if (config.trading.stopLossPercent > config.trading.takeProfitPercent) {
          warnings.push('Stop loss is greater than take profit - ensure this is intentional');
        }
      }

      // Warn if position size allows very few trades
      if (config.risk.maxPositionSize && config.risk.maxPositionSize > 0.05) {
        warnings.push('Position size >5% limits portfolio diversification');
      }
    }

    const isValid = errors.length === 0;

    return {
      valid: isValid,
      errors,
      warnings
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) =>
      current?.[key], obj
    );
  }

  /**
   * Validate and log results
   */
  validateAndLog(config) {
    logger.info('⚙️  Validating configuration...');

    const result = this.validate(config);

    if (result.valid) {
      logger.info('✅ Configuration validation passed');
    } else {
      logger.error('❌ Configuration validation failed');
      result.errors.forEach(err => logger.error(`   - ${err}`));
    }

    if (result.warnings.length > 0) {
      logger.warn('⚠️  Configuration warnings:');
      result.warnings.forEach(warn => logger.warn(`   - ${warn}`));
    }

    return result;
  }
}

module.exports = new ConfigValidator();
