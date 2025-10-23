const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Shadow Mode Testing System
 *
 * Allows testing trading strategies in production without executing real trades.
 * Records what WOULD have happened for analysis and validation.
 *
 * Features:
 * - Parallel execution with live system
 * - Full strategy execution without real trades
 * - Performance comparison
 * - Risk validation
 * - Trade simulation and recording
 */
class ShadowMode {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.options = {
      enabled: options.enabled || false,
      recordToFile: options.recordToFile !== false,
      recordPath: options.recordPath || path.join(__dirname, '../.shadow-trades'),
      compareWithLive: options.compareWithLive !== false,
      maxRecords: options.maxRecords || 10000,
      ...options
    };

    this.isActive = false;
    this.shadowTrades = [];
    this.shadowMetrics = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      winRate: 0,
      avgProfit: 0,
      avgLoss: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalSlippageCost: 0,
      startTime: null,
      endTime: null
    };

    // 🔥 FIX #1: Track virtual portfolio to prevent infinite rebalance loop
    // 60/40 split: 60% USDT ($36K), 40% BNB ($24K)
    this.virtualPortfolio = {
      usdt: 36000,  // 60% of $60K
      bnb: 22.0     // 40% of $60K (~$24K at ~$1,093/BNB)
    };

    this.liveMetrics = null; // For comparison

    // Initialize stats for slippage tracking
    this.stats = {
      totalTrades: 0,
      totalSlippageCost: 0,
      startTime: Date.now(),
      startBalance: {
        usdt: this.virtualPortfolio.usdt,
        bnb: this.virtualPortfolio.bnb
      }
    };

    logger.info('👻 Shadow Mode initialized with virtual portfolio tracking');
  }

  // Start shadow mode
  async start() {
    if (this.isActive) {
      logger.warn('⚠️ Shadow mode already active');
      return;
    }

    try {
      logger.info('👻 Starting Shadow Mode...');

      this.isActive = true;
      this.shadowMetrics.startTime = Date.now();

      // Load previous shadow trades if exist
      await this.loadPreviousTrades();

      logger.info('✅ Shadow Mode started - trades will be simulated only');
      logger.warn('⚠️ NO REAL TRADES WILL BE EXECUTED');

    } catch (error) {
      logger.error('❌ Failed to start shadow mode:', error);
      throw error;
    }
  }

  // Stop shadow mode
  async stop() {
    if (!this.isActive) {
      return;
    }

    try {
      logger.info('👻 Stopping Shadow Mode...');

      this.isActive = false;
      this.shadowMetrics.endTime = Date.now();

      // Save shadow trades
      await this.saveTrades();

      // Generate report
      await this.generateReport();

      logger.info('✅ Shadow Mode stopped');

    } catch (error) {
      logger.error('❌ Error stopping shadow mode:', error);
    }
  }

  // Execute trade in shadow mode
  async executeShadowTrade(params) {
    const { action, pair, amount, targetPrice, confidence, reasoning } = params;

    if (!this.isActive) {
      logger.warn('Shadow mode not active, skipping trade simulation');
      return null;
    }

    // CRITICAL: Balance validation BEFORE trade
    if (action === 'buy') {
      if (this.virtualPortfolio.usdt < amount) {
        logger.warn(`❌ Insufficient USDT: need ${amount}, have ${this.virtualPortfolio.usdt}`);
        return { success: false, wouldExecute: false, reason: 'insufficient_usdt' };
      }
    } else if (action === 'sell') {
      // ✅ FIX: Convert USD amount to BNB for validation
      // targetPrice is in USD/BNB format (e.g., 1067 USD per BNB)
      // To convert USD to BNB: USD / (USD/BNB) = BNB
      const bnbNeeded = amount / targetPrice; // USD / (USD/BNB) = BNB
      if (this.virtualPortfolio.bnb < bnbNeeded) {
        logger.warn(`❌ Insufficient BNB: need ${bnbNeeded.toFixed(6)}, have ${this.virtualPortfolio.bnb.toFixed(6)}`);
        return { success: false, wouldExecute: false, reason: 'insufficient_bnb' };
      }
    }

    // Calculate slippage
    const slippage = 0.005;
    const slippageCost = amount * slippage;
    const finalAmount = amount - slippageCost;

    // Update balances
    if (action === 'buy') {
      this.virtualPortfolio.usdt -= amount;
      // ✅ FIX: targetPrice is USD/BNB, so divide to get BNB received
      // When buying BNB: USD / (USD/BNB) = BNB
      this.virtualPortfolio.bnb += amount / targetPrice;
    } else if (action === 'sell') {
      // ✅ FIX: amount is in USD, convert to BNB to subtract
      // targetPrice is USD/BNB, so divide to get BNB to sell
      const bnbToSell = amount / targetPrice; // USD / (USD/BNB) = BNB
      this.virtualPortfolio.bnb -= bnbToSell;
      this.virtualPortfolio.usdt += finalAmount;
    }

    // Calculate profit (realistic)
    const estimatedProfit = action === 'buy' ? 0 : Math.max(0, slippageCost * 0.5);

    logger.info(`👻 Shadow Trade: ${action} ${finalAmount.toFixed(4)} at ${targetPrice}`);
    logger.info(`👻 Estimated Profit: ${estimatedProfit.toFixed(2)} USDT`);
    logger.info(`👻 New Balances: ${this.virtualPortfolio.usdt.toFixed(2)} USDT, ${this.virtualPortfolio.bnb.toFixed(6)} BNB`);

    // Save trade
    const trade = {
      timestamp: Date.now(),
      action,
      pair,
      amount,
      targetPrice,
      confidence,
      reasoning,
      balances: {
        usdt: this.virtualPortfolio.usdt,
        bnb: this.virtualPortfolio.bnb
      }
    };

    this.shadowTrades.push(trade);

    if (this.options.recordToFile) {
      await this.saveTradesToFile(trade);
    }

    // Record trade to database for analytics
    await this.recordTradeToDatabase(trade);

    return {
      success: true,
      wouldExecute: true,
      estimatedProfit,
      balances: this.virtualPortfolio
    };
  }

  _calculateSlippage(orderSizeUSD) {
    // Realistic slippage model for BSC/PancakeSwap based on order size
    // These are conservative estimates based on typical low-cap pair liquidity

    if (orderSizeUSD < 100) {
      return 0.0005; // 0.05% for tiny orders
    } else if (orderSizeUSD < 500) {
      return 0.001; // 0.1% for small orders
    } else if (orderSizeUSD < 1000) {
      return 0.002; // 0.2% for medium-small orders
    } else if (orderSizeUSD < 2000) {
      return 0.003; // 0.3% for medium orders
    } else if (orderSizeUSD < 5000) {
      return 0.006; // 0.6% for large orders
    } else if (orderSizeUSD < 10000) {
      return 0.01; // 1% for very large orders
    } else {
      // For extremely large orders, slippage increases non-linearly
      return 0.01 + (orderSizeUSD - 10000) / 200000; // 1%+ scaling
    }
  }

  // Simulate a trade without executing
  async simulateTrade(tradeParams) {
    try {
      const simulation = {
        wouldExecute: false,
        estimatedProfit: 0,
        estimatedGasCost: 0,
        estimatedSlippage: 0,
        estimatedPriceImpact: 0,
        reason: null,
        timestamp: Date.now()
      };

      // Simulate price fetch
      const currentPrice = await this.simulatePriceFetch(tradeParams.pair);

      // Simulate gas cost
      simulation.estimatedGasCost = await this.simulateGasCost(tradeParams);

      // Simulate slippage
      simulation.estimatedSlippage = await this.simulateSlippage(tradeParams);

      // Simulate price impact
      simulation.estimatedPriceImpact = await this.simulatePriceImpact(tradeParams);

      // Calculate estimated profit
      const executionPrice = currentPrice * (1 + simulation.estimatedSlippage);
      const profitMargin = tradeParams.action === 'buy' ?
        (tradeParams.targetPrice - executionPrice) / executionPrice :
        (executionPrice - tradeParams.targetPrice) / tradeParams.targetPrice;

      // Calculate gross profit
      const grossProfit = tradeParams.amount * profitMargin;

      // Subtract ALL costs
      const totalCosts = simulation.estimatedGasCost +
        (tradeParams.amount * simulation.estimatedSlippage) +
        (tradeParams.amount * simulation.estimatedPriceImpact);

      simulation.estimatedProfit = grossProfit - totalCosts;

      // 🚨 MINIMUM PROFIT THRESHOLD
      // Don't execute trades with <$0.50 profit (gas cost is $0.15-0.25)
      const MIN_PROFIT_THRESHOLD = 0.50;

      // Determine if trade would execute
      if (simulation.estimatedProfit > MIN_PROFIT_THRESHOLD) {
        simulation.wouldExecute = true;
        simulation.reason = `Profitable trade: $${simulation.estimatedProfit.toFixed(4)} profit`;

        // 🔥 FIX #1: Update virtual portfolio when trade would execute
        // DISABLED: executeShadowTrade() already updates balances - this was causing DOUBLE updates!
        // this.updateVirtualPortfolio(tradeParams, simulation);

        // 🔥 FIX #2: Update cooldown ONLY after confirmed execution
        if (global.tradingStrategyAgent) {
          global.tradingStrategyAgent.lastTradeTime = Date.now();
          logger.debug(`⏱️ Cooldown activated: next trade allowed in 1 hour`);
        }
      } else {
        simulation.wouldExecute = false;
        simulation.reason = `Unprofitable: $${simulation.estimatedProfit.toFixed(4)} profit < $${MIN_PROFIT_THRESHOLD} threshold`;
      }

      // Check risk limits
      if (this.bot.riskManager) {
        try {
          await this.bot.riskManager.validateTrade(tradeParams);
        } catch (error) {
          simulation.wouldExecute = false;
          simulation.reason = `Risk check failed: ${error.message}`;
        }
      }

      return simulation;

    } catch (error) {
      logger.error('Error simulating trade:', error);
      return {
        wouldExecute: false,
        reason: `Simulation error: ${error.message}`,
        estimatedProfit: 0,
        estimatedGasCost: 0,
        estimatedSlippage: 0
      };
    }
  }

  // Simulate price fetch
  async simulatePriceFetch(pair) {
    try {
      // ✅ FIX #3: Use actual price fetching logic with correct method
      if (this.bot.multiDexManager && this.bot.multiDexManager.dexs && this.bot.multiDexManager.dexs.pancakeSwap) {
        const price = await this.bot.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
        return price;
      }

      // Fallback to mock price
      logger.debug('Using mock price for shadow mode simulation');
      return 100; // Mock price

    } catch (error) {
      logger.debug('Error fetching price in shadow mode:', error.message);
      return 100; // Mock price
    }
  }

  // Simulate gas cost
  async simulateGasCost(tradeParams) {
    // 🚨 REALISTIC BSC GAS COSTS
    // Real-world BSC gas: $0.10 - $0.50 per swap
    // Using conservative estimate of $0.15 per trade
    const realisticGasCostUSD = 0.15;

    // Additional costs for complex trades
    const actionMultipliers = {
      buy: 1.0,        // Simple swap
      sell: 1.0,       // Simple swap
      rebalance: 1.5,  // Two swaps
      swap: 1.2,       // Swap with approval
      mev: 2.0         // MEV protection overhead
    };

    const multiplier = actionMultipliers[tradeParams.action] || 1.0;

    return realisticGasCostUSD * multiplier;
  }

  // Simulate slippage
  async simulateSlippage(tradeParams) {
    // 🚨 REALISTIC SLIPPAGE
    // Real-world slippage on DEX: 0.3% - 1.0%
    const baseSlippage = 0.005; // 0.5% realistic slippage
    const sizeMultiplier = Math.min(tradeParams.amount / 1000, 5); // Scales with trade size

    return baseSlippage * (1 + sizeMultiplier);
  }

  // Simulate price impact
  async simulatePriceImpact(tradeParams) {
    // 🚨 REALISTIC PRICE IMPACT
    // Small trades still have 0.1% spread (bid/ask)
    const baseSpread = 0.001; // 0.1% minimum spread
    const basePriceImpact = 0.001; // 0.1% base impact
    const sizeMultiplier = Math.min(tradeParams.amount / 1000, 10); // Scales with size

    return baseSpread + (basePriceImpact * (1 + sizeMultiplier));
  }

  // 🔥 FIX #1: Update virtual portfolio after successful trades
  updateVirtualPortfolio(tradeParams, simulation) {
    const currentPrice = tradeParams.price || tradeParams.parameters?.price || 0.000855;
    const slippageFactor = 1 - simulation.estimatedSlippage;

    if (tradeParams.action === 'buy' || tradeParams.action === 'rebalance') {
      // Buying BNB with USDT - amount is in USDT
      const usdtSpent = tradeParams.amount;
      const bnbReceived = (usdtSpent / currentPrice) * slippageFactor;

      this.virtualPortfolio.usdt -= usdtSpent;
      this.virtualPortfolio.bnb += bnbReceived;

      logger.info(`📊 Virtual portfolio updated: -$${usdtSpent.toFixed(2)} USDT, +${bnbReceived.toFixed(6)} BNB`);
    } else if (tradeParams.action === 'sell') {
      // 🔥 FIX #3: For sell, amount is already in BNB (strategy divided by price)
      const bnbSold = tradeParams.amount; // Don't divide again!
      const usdtReceived = (bnbSold * currentPrice) * slippageFactor;

      this.virtualPortfolio.bnb -= bnbSold;
      this.virtualPortfolio.usdt += usdtReceived;

      logger.info(`📊 Virtual portfolio updated: -${bnbSold.toFixed(6)} BNB, +$${usdtReceived.toFixed(2)} USDT`);
    }

    // 🔥 Safety checks for negative balances
    if (this.virtualPortfolio.usdt < 0) {
      logger.error(`⚠️ Virtual USDT went negative: ${this.virtualPortfolio.usdt}`);
      this.virtualPortfolio.usdt = 0;
    }
    if (this.virtualPortfolio.bnb < 0) {
      logger.error(`⚠️ Virtual BNB went negative: ${this.virtualPortfolio.bnb}`);
      this.virtualPortfolio.bnb = 0;
    }

    const totalValue = this.virtualPortfolio.usdt + (this.virtualPortfolio.bnb / currentPrice); // FIX: DIVIDE by price
    logger.info(`💼 Virtual portfolio total: $${totalValue.toFixed(2)} (${this.virtualPortfolio.usdt.toFixed(2)} USDT + ${this.virtualPortfolio.bnb.toFixed(6)} BNB)`);

    // Validate balances after trade
    logger.debug(`💰 Post-trade balance: ${this.virtualPortfolio.usdt.toFixed(2)} USDT, ${this.virtualPortfolio.bnb.toFixed(4)} BNB, Total: $${totalValue.toFixed(2)}`);

    // Alert if balances are unreasonable
    if (this.virtualPortfolio.bnb > 100000 || this.virtualPortfolio.usdt > 1000000) {
      logger.error('🚨 ALERT: Virtual balances exceeded reasonable limits!');
      this.resetBalances();
    }
  }

  getVirtualBalances() {
    // Validate balances are reasonable
    if (this.virtualPortfolio.bnb > 50000) { // More than 50K BNB is unrealistic (allows for 20K starting + trades)
      logger.warn(`⚠️ Virtual BNB balance suspiciously high: ${this.virtualPortfolio.bnb.toFixed(2)}, resetting to initial`);
      this.resetBalances();
    }

    if (this.virtualPortfolio.usdt > 100000) { // More than $100K USDT is unrealistic for testing
      logger.warn(`⚠️ Virtual USDT balance suspiciously high: ${this.virtualPortfolio.usdt.toFixed(2)}, resetting to initial`);
      this.resetBalances();
    }

    return {
      usdt: this.virtualPortfolio.usdt,
      bnb: this.virtualPortfolio.bnb,
      totalValueUSD: this.virtualPortfolio.usdt + (this.virtualPortfolio.bnb / this.currentPrice) // FIX: DIVIDE by price
    };
  }

  // Add portfolio value logging method
  async logPortfolioValue() {
    try {
      const currentPrice = await this.bot.multiDexManager?.dexs?.pancakeSwap?.getCurrentPrice() || 0.00077;
      const bnbValue = this.virtualPortfolio.bnb / currentPrice; // FIX: DIVIDE by price
      const totalValue = this.virtualPortfolio.usdt + bnbValue;

      logger.info(`💰 Portfolio Value: $${totalValue.toFixed(2)}`);
      logger.info(`   USDT: $${this.virtualPortfolio.usdt.toFixed(2)}`);
      logger.info(`   BNB: ${this.virtualPortfolio.bnb.toFixed(2)} ($${bnbValue.toFixed(2)} @ $${currentPrice.toFixed(6)})`);

      return totalValue;
    } catch (error) {
      logger.error(`Error logging portfolio value: ${error.message}`);
      return 0;
    }
  }

  // Add full reset method for complete cleanup
  fullReset() {
    // Reset balances to initial state (60/40 split)
    this.virtualPortfolio = {
      usdt: 36000,  // 60% of $60K
      bnb: 22.0     // 40% of $60K (~$24K at ~$1,093/BNB)
    };

    // Reset other state if needed
    this.tradeHistory = [];
    this.currentPrice = 0.00077;

    logger.info('🔄 Shadow mode FULL RESET complete');
    logger.info(`💰 USDT: ${this.virtualPortfolio.usdt}, BNB: ${this.virtualPortfolio.bnb}`);
  }

  // Add reset method
  resetBalances() {
    logger.warn('🔄 Resetting virtual balances to initial state');
    this.virtualPortfolio = {
      usdt: 36000,  // 60% of $60K
      bnb: 22.0     // 40% of $60K (~$24K at ~$1,093/BNB)
    };
    logger.info(`✅ Virtual balances reset: ${this.virtualPortfolio.usdt} USDT, ${this.virtualPortfolio.bnb} BNB`);
  }

  // Record trade to database for analytics
  async recordTradeToDatabase(trade) {
    try {
      // ✅ VOLATILITY_FILTER_PATCH - Added by Claude Terminal
      const priceHistory = this.bot.priceHistoryManager.priceHistory;
      if (priceHistory.length < 20) {
        logger.debug('👻 Shadow: Insufficient price history, skipping trade');
        return false;
      }

      const returns = [];
      for (let i = 1; i < priceHistory.length; i++) {
        const change = (priceHistory[i].price - priceHistory[i - 1].price) / priceHistory[i - 1].price;
        returns.push(Math.abs(change));
      }
      const avgVolatility = returns.reduce((a, b) => a + b, 0) / returns.length;

      const MIN_VOLATILITY_FOR_PROFIT = 0.02; // 2.0%

      if (avgVolatility < MIN_VOLATILITY_FOR_PROFIT) {
        logger.debug(`👻 Shadow: Skipped - volatility ${(avgVolatility * 100).toFixed(2)}% < 2.0%`);
        if (!this.metricsSkipped) this.metricsSkipped = { lowVolatility: 0 };
        this.metricsSkipped.lowVolatility++;
        return false;
      }

      logger.debug(`👻 Shadow: Allowed - volatility ${(avgVolatility * 100).toFixed(2)}% >= 2.0%`);
      // ✅ END VOLATILITY_FILTER_PATCH

      const { Trade } = require('../database/models');

      await Trade.create({
        type: trade.action,
        token_pair: 'BNB/USDT',
        amount_in: trade.action === 'buy' ? trade.amount : trade.amount / (trade.price || 0.00077),
        amount_out: trade.action === 'buy' ? trade.amount / (trade.price || 0.00077) : trade.amount,
        price: trade.price || 0.00077, // Ensure price is never null
        status: 'completed',
        strategy: trade.strategy || 'ranging',
        profit_loss: trade.estimatedProfit || 0,
        timestamp: new Date(trade.timestamp || Date.now()),
        confidence: trade.confidence || 0.6,
        reasoning: trade.reasoning || 'Shadow mode trade'
      });

      logger.debug('✅ Trade recorded to database for analytics');
    } catch (error) {
      logger.error(`Error recording trade to database: ${error.message}`);
    }
  }

  // Record shadow trade
  recordShadowTrade(trade) {
    this.shadowTrades.push(trade);

    // Keep only recent trades
    if (this.shadowTrades.length > this.options.maxRecords) {
      this.shadowTrades = this.shadowTrades.slice(-this.options.maxRecords);
    }

    // Update metrics
    this.updateMetrics(trade);

    // ✅ FIX: Save trades immediately after each trade (async, don't block)
    this.saveTrades().catch(err =>
      logger.debug('Error saving trades:', err.message)
    );
  }

  // Update shadow metrics
  updateMetrics(trade) {
    this.shadowMetrics.totalTrades++;

    if (trade.wouldExecute) {
      this.shadowMetrics.successfulTrades++;

      if (trade.estimatedProfit > 0) {
        this.shadowMetrics.totalProfit += trade.estimatedProfit;
      } else {
        this.shadowMetrics.totalLoss += Math.abs(trade.estimatedProfit);
      }
    } else {
      this.shadowMetrics.failedTrades++;
    }

    // Calculate derived metrics
    this.shadowMetrics.netProfit = this.shadowMetrics.totalProfit - this.shadowMetrics.totalLoss;
    this.shadowMetrics.winRate = this.shadowMetrics.totalTrades > 0 ?
      (this.shadowMetrics.successfulTrades / this.shadowMetrics.totalTrades * 100).toFixed(2) : 0;

    const profitableTrades = this.shadowTrades.filter(t => t.estimatedProfit > 0);
    this.shadowMetrics.avgProfit = profitableTrades.length > 0 ?
      profitableTrades.reduce((sum, t) => sum + t.estimatedProfit, 0) / profitableTrades.length : 0;

    const losingTrades = this.shadowTrades.filter(t => t.estimatedProfit < 0);
    this.shadowMetrics.avgLoss = losingTrades.length > 0 ?
      losingTrades.reduce((sum, t) => sum + Math.abs(t.estimatedProfit), 0) / losingTrades.length : 0;
  }

  // Save shadow trades to file
  async saveTrades() {
    if (!this.options.recordToFile) {
      return;
    }

    try {
      const data = {
        trades: this.shadowTrades,
        metrics: this.shadowMetrics,
        savedAt: Date.now()
      };

      await fs.writeFile(
        this.options.recordPath,
        JSON.stringify(data, null, 2),
        'utf8'
      );

      logger.info(`✅ Shadow trades saved: ${this.shadowTrades.length} trades`);

    } catch (error) {
      logger.error('❌ Error saving shadow trades:', error);
    }
  }

  // Load previous shadow trades
  async loadPreviousTrades() {
    try {
      const exists = await fs.access(this.options.recordPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const content = await fs.readFile(this.options.recordPath, 'utf8');
        const data = JSON.parse(content);

        this.shadowTrades = data.trades || [];
        this.shadowMetrics = data.metrics || this.shadowMetrics;

        logger.info(`✅ Loaded ${this.shadowTrades.length} previous shadow trades`);
      }

    } catch (error) {
      logger.debug('No previous shadow trades found');
    }
  }

  // Generate shadow mode report
  async generateReport() {
    try {
      const report = {
        summary: {
          totalTrades: this.shadowMetrics.totalTrades,
          successfulTrades: this.shadowMetrics.successfulTrades,
          failedTrades: this.shadowMetrics.failedTrades,
          winRate: this.shadowMetrics.winRate + '%',
          netProfit: this.shadowMetrics.netProfit.toFixed(4),
          avgProfit: this.shadowMetrics.avgProfit.toFixed(4),
          avgLoss: this.shadowMetrics.avgLoss.toFixed(4),
          duration: this.shadowMetrics.endTime - this.shadowMetrics.startTime
        },
        comparison: null,
        recommendations: []
      };

      // Compare with live metrics if available
      if (this.options.compareWithLive && this.liveMetrics) {
        report.comparison = this.compareWithLive();
      }

      // Generate recommendations
      report.recommendations = this.generateRecommendations();

      // Save report
      const reportPath = path.join(path.dirname(this.options.recordPath), 'shadow-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

      logger.info('✅ Shadow mode report generated');
      logger.info(`📊 Total trades: ${report.summary.totalTrades}`);
      logger.info(`💰 Net profit: ${report.summary.netProfit}`);
      logger.info(`📈 Win rate: ${report.summary.winRate}`);

      return report;

    } catch (error) {
      logger.error('❌ Error generating report:', error);
      return null;
    }
  }

  // Compare shadow metrics with live metrics
  compareWithLive() {
    if (!this.liveMetrics) {
      return null;
    }

    return {
      profitDifference: this.shadowMetrics.netProfit - this.liveMetrics.netProfit,
      winRateDifference: this.shadowMetrics.winRate - this.liveMetrics.winRate,
      tradeCountDifference: this.shadowMetrics.totalTrades - this.liveMetrics.totalTrades,
      recommendation: this.shadowMetrics.netProfit > this.liveMetrics.netProfit ?
        'Shadow strategy outperformed live' :
        'Live strategy outperformed shadow'
    };
  }

  // Generate recommendations based on shadow mode results
  generateRecommendations() {
    const recommendations = [];

    if (this.shadowMetrics.winRate < 50) {
      recommendations.push('Low win rate - review strategy parameters');
    }

    if (this.shadowMetrics.avgLoss > this.shadowMetrics.avgProfit * 2) {
      recommendations.push('Large average losses - implement better stop-loss');
    }

    if (this.shadowMetrics.failedTrades > this.shadowMetrics.successfulTrades) {
      recommendations.push('High failure rate - review trade validation logic');
    }

    if (this.shadowMetrics.netProfit > 0 && this.shadowMetrics.winRate > 60) {
      recommendations.push('✅ Strategy shows promise - consider gradual live rollout');
    }

    return recommendations;
  }

  // Get shadow mode statistics
  getStats() {
    return {
      isActive: this.isActive,
      metrics: this.shadowMetrics,
      recentTrades: this.shadowTrades.slice(-10),
      totalRecords: this.shadowTrades.length
    };
  }

  // Health check
  healthCheck() {
    return {
      status: 'healthy',
      isActive: this.isActive,
      recordCount: this.shadowTrades.length,
      metrics: this.shadowMetrics
    };
  }

  // Save trades to file
  async saveTradesToFile(trade) {
    try {
      // ✅ FIX: Use configured path from .env instead of hardcoded path
      const tradesFile = this.options.recordPath;
      let trades = [];

      // Ensure data directory exists
      const dataDir = path.dirname(tradesFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Read existing trades if file exists
      try {
        const data = await fs.readFile(tradesFile, 'utf8');
        const parsed = JSON.parse(data);

        // Handle both formats:
        // 1. Direct array: [...]
        // 2. Wrapper object: { trades: [...], metrics: {...}, savedAt: ... }
        if (Array.isArray(parsed)) {
          trades = parsed;
        } else if (parsed && parsed.trades && Array.isArray(parsed.trades)) {
          trades = parsed.trades;
        } else {
          trades = [];
        }
      } catch (error) {
        // File doesn't exist or is empty, start with empty array
        trades = [];
      }

      // Add new trade with timestamp
      const tradeRecord = {
        ...trade,
        timestamp: new Date().toISOString(),
        shadowMode: true
      };

      trades.push(tradeRecord);

      // Keep only recent trades (limit to maxRecords)
      if (trades.length > this.options.maxRecords) {
        trades = trades.slice(-this.options.maxRecords);
      }

      // Write to file
      await fs.writeFile(tradesFile, JSON.stringify(trades, null, 2));

      logger.info(`💾 Shadow trade saved to file: ${trade.action} ${trade.amount} ${trade.pair || 'BNB/USDT'}`);

    } catch (error) {
      logger.error(`❌ Failed to save shadow trade to file: ${error.message}`);
      // Don't throw error - file saving is not critical for trading
    }
  }
}

module.exports = ShadowMode;
