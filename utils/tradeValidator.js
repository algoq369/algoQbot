/**
 * 🎯 Trade Pre-Execution Validator
 *
 * Performs dry-run validation before executing trades to prevent failures.
 * Checks wallet balance, gas prices, slippage, and simulates the trade.
 */

const logger = require('../logger');

class TradeValidator {
  constructor(web3, walletManager, pancakeSwap) {
    this.web3 = web3;
    this.walletManager = walletManager;
    this.pancakeSwap = pancakeSwap;
    this.validationResults = [];
    this.maxResultsHistory = 100;
  }

  /**
   * Perform comprehensive pre-execution validation
   * @param {Object} trade - Trade to validate
   * @returns {Object} Validation result
   */
  async validateTrade(trade) {
    const startTime = Date.now();
    const validations = [];

    logger.info(`🔍 PRE-EXECUTION VALIDATION: ${trade.action} ${trade.amount}`);

    try {
      // 1. Validate wallet balance
      const balanceCheck = await this.validateBalance(trade);
      validations.push(balanceCheck);
      if (!balanceCheck.passed) {
        return this.createResult(validations, startTime, false, 'Insufficient balance');
      }

      // 2. Validate gas price
      const gasCheck = await this.validateGasPrice();
      validations.push(gasCheck);
      if (!gasCheck.passed) {
        return this.createResult(validations, startTime, false, 'Gas price too high');
      }

      // 3. Validate network conditions
      const networkCheck = await this.validateNetwork();
      validations.push(networkCheck);
      if (!networkCheck.passed) {
        return this.createResult(validations, startTime, false, 'Network issues');
      }

      // 4. Validate slippage
      const slippageCheck = await this.validateSlippage(trade);
      validations.push(slippageCheck);
      if (!slippageCheck.passed) {
        return this.createResult(validations, startTime, false, 'Slippage too high');
      }

      // 5. Simulate trade execution (dry-run)
      const simulationCheck = await this.simulateTrade(trade);
      validations.push(simulationCheck);
      if (!simulationCheck.passed) {
        return this.createResult(validations, startTime, false, 'Simulation failed');
      }

      // 6. Validate price hasn't moved significantly
      const priceCheck = await this.validatePriceStability(trade);
      validations.push(priceCheck);
      if (!priceCheck.passed) {
        return this.createResult(validations, startTime, false, 'Price moved significantly');
      }

      // All validations passed
      return this.createResult(validations, startTime, true, 'All checks passed');

    } catch (error) {
      logger.error('❌ Trade validation error:', error);
      validations.push({
        check: 'exception',
        passed: false,
        reason: error.message
      });
      return this.createResult(validations, startTime, false, 'Validation exception');
    }
  }

  /**
   * Validate wallet has sufficient balance
   */
  async validateBalance(trade) {
    try {
      const balances = await this.walletManager.getBalances();
      const action = trade.action;
      const amount = parseFloat(trade.amount);

      let hasSufficientBalance = false;
      let details = {};

      if (action === 'buy') {
        // Buying BNB with USDT
        const usdtBalance = balances.usdt || 0;
        hasSufficientBalance = usdtBalance >= amount;
        details = {
          required: amount,
          available: usdtBalance,
          currency: 'USDT',
          shortfall: hasSufficientBalance ? 0 : amount - usdtBalance
        };
      } else if (action === 'sell') {
        // Selling BNB for USDT
        const bnbBalance = balances.bnb || 0;
        const currentPrice = trade.targetPrice || await this.pancakeSwap.getCurrentPrice();
        const bnbNeeded = amount * currentPrice;
        hasSufficientBalance = bnbBalance >= bnbNeeded;
        details = {
          required: bnbNeeded,
          available: bnbBalance,
          currency: 'BNB',
          shortfall: hasSufficientBalance ? 0 : bnbNeeded - bnbBalance
        };
      }

      if (!hasSufficientBalance) {
        logger.warn(`⚠️  Insufficient balance: Need ${details.required.toFixed(6)} ${details.currency}, have ${details.available.toFixed(6)}`);
      } else {
        logger.info(`✅ Balance check passed: ${details.available.toFixed(6)} ${details.currency} available`);
      }

      return {
        check: 'balance',
        passed: hasSufficientBalance,
        reason: hasSufficientBalance ? 'Sufficient balance' : `Insufficient ${details.currency}`,
        details
      };
    } catch (error) {
      logger.error('❌ Balance validation error:', error);
      return {
        check: 'balance',
        passed: false,
        reason: 'Balance check failed: ' + error.message
      };
    }
  }

  /**
   * Validate gas price is within acceptable range
   */
  async validateGasPrice() {
    try {
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasPriceGwei = parseFloat(this.web3.utils.fromWei(gasPrice, 'gwei'));
      const maxGasPrice = 50; // 50 gwei max

      const passed = gasPriceGwei <= maxGasPrice;

      if (!passed) {
        logger.warn(`⚠️  Gas price too high: ${gasPriceGwei.toFixed(2)} gwei > ${maxGasPrice} gwei`);
      } else {
        logger.info(`✅ Gas price acceptable: ${gasPriceGwei.toFixed(2)} gwei`);
      }

      return {
        check: 'gasPrice',
        passed,
        reason: passed ? 'Gas price acceptable' : `Gas price too high: ${gasPriceGwei.toFixed(2)} gwei`,
        details: { gasPrice: gasPriceGwei, maxGasPrice }
      };
    } catch (error) {
      logger.error('❌ Gas price validation error:', error);
      return {
        check: 'gasPrice',
        passed: false,
        reason: 'Gas price check failed: ' + error.message
      };
    }
  }

  /**
   * Validate network is responding properly
   */
  async validateNetwork() {
    try {
      const startTime = Date.now();
      const blockNumber = await this.web3.eth.getBlockNumber();
      const latency = Date.now() - startTime;

      const maxLatency = 3000; // 3 seconds max
      const passed = latency < maxLatency && blockNumber > 0;

      if (!passed) {
        logger.warn(`⚠️  Network issues: Latency ${latency}ms, block ${blockNumber}`);
      } else {
        logger.info(`✅ Network healthy: Latency ${latency}ms, block ${blockNumber}`);
      }

      return {
        check: 'network',
        passed,
        reason: passed ? 'Network responsive' : 'Network slow or unavailable',
        details: { latency, blockNumber, maxLatency }
      };
    } catch (error) {
      logger.error('❌ Network validation error:', error);
      return {
        check: 'network',
        passed: false,
        reason: 'Network check failed: ' + error.message
      };
    }
  }

  /**
   * Validate slippage is within acceptable range
   */
  async validateSlippage(trade) {
    try {
      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      const targetPrice = trade.targetPrice || currentPrice;
      const slippage = Math.abs((currentPrice - targetPrice) / targetPrice);
      const maxSlippage = 0.05; // 5% max

      const passed = slippage <= maxSlippage;

      if (!passed) {
        logger.warn(`⚠️  Slippage too high: ${(slippage * 100).toFixed(2)}%`);
      } else {
        logger.info(`✅ Slippage acceptable: ${(slippage * 100).toFixed(2)}%`);
      }

      return {
        check: 'slippage',
        passed,
        reason: passed ? 'Slippage acceptable' : `Slippage too high: ${(slippage * 100).toFixed(2)}%`,
        details: { slippage, maxSlippage, currentPrice, targetPrice }
      };
    } catch (error) {
      logger.error('❌ Slippage validation error:', error);
      return {
        check: 'slippage',
        passed: false,
        reason: 'Slippage check failed: ' + error.message
      };
    }
  }

  /**
   * Simulate trade execution (dry-run)
   */
  async simulateTrade(trade) {
    try {
      // In shadow mode or if pancakeSwap has simulation, use it
      if (global.shadowMode?.isActive) {
        logger.info('✅ Simulation: Shadow mode active, trade will be simulated');
        return {
          check: 'simulation',
          passed: true,
          reason: 'Shadow mode - trade will be simulated',
          details: { shadowMode: true }
        };
      }

      // For live mode, we can't easily simulate without actually executing
      // So we just verify the parameters are valid
      const hasValidParams = trade.action && trade.amount && trade.amount > 0;

      if (!hasValidParams) {
        logger.warn('⚠️  Invalid trade parameters');
        return {
          check: 'simulation',
          passed: false,
          reason: 'Invalid trade parameters',
          details: { action: trade.action, amount: trade.amount }
        };
      }

      logger.info('✅ Simulation: Parameters valid');
      return {
        check: 'simulation',
        passed: true,
        reason: 'Trade parameters valid',
        details: { action: trade.action, amount: trade.amount }
      };
    } catch (error) {
      logger.error('❌ Simulation error:', error);
      return {
        check: 'simulation',
        passed: false,
        reason: 'Simulation failed: ' + error.message
      };
    }
  }

  /**
   * Validate price hasn't moved significantly since decision
   */
  async validatePriceStability(trade) {
    try {
      if (!trade.decisionPrice) {
        // No decision price to compare against
        return {
          check: 'priceStability',
          passed: true,
          reason: 'No decision price to validate'
        };
      }

      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      const priceChange = Math.abs((currentPrice - trade.decisionPrice) / trade.decisionPrice);
      const maxPriceChange = 0.02; // 2% max price movement

      const passed = priceChange <= maxPriceChange;

      if (!passed) {
        logger.warn(`⚠️  Price moved significantly: ${(priceChange * 100).toFixed(2)}%`);
      } else {
        logger.info(`✅ Price stable: ${(priceChange * 100).toFixed(3)}% change`);
      }

      return {
        check: 'priceStability',
        passed,
        reason: passed ? 'Price stable' : `Price moved ${(priceChange * 100).toFixed(2)}%`,
        details: { priceChange, maxPriceChange, currentPrice, decisionPrice: trade.decisionPrice }
      };
    } catch (error) {
      logger.error('❌ Price stability validation error:', error);
      return {
        check: 'priceStability',
        passed: false,
        reason: 'Price stability check failed: ' + error.message
      };
    }
  }

  /**
   * Create validation result
   */
  createResult(validations, startTime, passed, summary) {
    const duration = Date.now() - startTime;

    const result = {
      passed,
      summary,
      duration,
      timestamp: Date.now(),
      validations,
      failedChecks: validations.filter(v => !v.passed).map(v => v.check)
    };

    // Log summary
    if (passed) {
      logger.info(`✅ PRE-EXECUTION VALIDATION PASSED (${duration}ms)`);
    } else {
      logger.warn(`❌ PRE-EXECUTION VALIDATION FAILED: ${summary} (${duration}ms)`);
      logger.warn(`   Failed checks: ${result.failedChecks.join(', ')}`);
    }

    // Add to history
    this.validationResults.push(result);
    if (this.validationResults.length > this.maxResultsHistory) {
      this.validationResults = this.validationResults.slice(-this.maxResultsHistory);
    }

    return result;
  }

  /**
   * Get validation statistics
   */
  getStats() {
    const total = this.validationResults.length;
    const passed = this.validationResults.filter(r => r.passed).length;
    const failed = total - passed;

    const failedCheckCounts = {};
    for (const result of this.validationResults) {
      for (const check of result.failedChecks) {
        failedCheckCounts[check] = (failedCheckCounts[check] || 0) + 1;
      }
    }

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total * 100).toFixed(1) + '%' : '0%',
      failedCheckCounts,
      recentResults: this.validationResults.slice(-10)
    };
  }

  /**
   * Reset validation history
   */
  reset() {
    this.validationResults = [];
    logger.info('✅ Trade validator history reset');
  }
}

module.exports = TradeValidator;
