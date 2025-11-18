const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');
const { getSharedVirtualBalances, updateSharedVirtualBalances, resetSharedVirtualBalances, executeTrade } = require('../utils/virtualBalanceManager');

// ═══════════════════════════════════════════════════════════════
// 🚀 ENHANCEMENT #2: Realistic Slippage Simulation (2025)
// Applies 0.3% slippage to all shadow trades for realistic PnL
// ═══════════════════════════════════════════════════════════════
const SLIPPAGE_BUFFER = 0.003; // 0.3% realistic execution cost
const SIMULATE_SLIPPAGE = process.env.SIMULATE_SLIPPAGE !== 'false'; // Default: enabled

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

    // 🔥 FIX #1: Use shared virtual balance manager
    // Prevents state isolation between shadowMode.js and TradingStrategyAgent.js
    // Balances are now stored in data/virtual_balances.json (single source of truth)

    this.liveMetrics = null; // For comparison

    // Initialize stats for slippage tracking
    const initialBalances = getSharedVirtualBalances();
    this.stats = {
      totalTrades: 0,
      totalSlippageCost: 0,
      startTime: Date.now(),
      startBalance: {
        usdt: initialBalances.usdt,
        bnb: initialBalances.bnb
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

    // CRITICAL: Balance validation BEFORE trade (using shared manager)
    const currentBalances = getSharedVirtualBalances();

    if (action === 'buy') {
      if (currentBalances.usdt < amount) {
        logger.warn(`❌ Insufficient USDT: need ${amount.toFixed(2)}, have ${currentBalances.usdt.toFixed(2)}`);
        return { success: false, wouldExecute: false, reason: 'insufficient_usdt' };
      }
    } else if (action === 'sell') {
      // For SELL, amount is in BNB units
      if (currentBalances.bnb < amount) {
        logger.warn(`❌ Insufficient BNB: need ${amount.toFixed(6)}, have ${currentBalances.bnb.toFixed(6)}`);
        return { success: false, wouldExecute: false, reason: 'insufficient_bnb' };
      }
    }

    // Calculate slippage
    const slippage = 0.005;
    const slippageCost = amount * slippage;
    const finalAmount = amount - slippageCost;

    // 🔥 CRITICAL FIX: targetPrice is ALREADY in BNB/USDT format (~0.000875)
    // DO NOT invert it! The previous inversion caused 1.46M BNB explosion
    // Correct format: 0.000875 means 1 USDT = 0.000875 BNB (BNB price ~$1,142)
    const currentPrice = targetPrice; // Already in BNB per USDT format

    // Update balances using shared manager
    if (action === 'buy') {
      // CORRECT: BUY = MULTIPLY by (BNB/USDT) rate
      let bnbReceived = amount * currentPrice;

      // 🚀 ENHANCEMENT #2: Apply slippage simulation
      if (SIMULATE_SLIPPAGE) {
        const slippageLoss = bnbReceived * SLIPPAGE_BUFFER;
        bnbReceived = bnbReceived * (1 - SLIPPAGE_BUFFER);
        logger.info(`💸 [SLIPPAGE] BUY: ${slippageLoss.toFixed(6)} BNB lost to slippage (${(SLIPPAGE_BUFFER * 100).toFixed(1)}%)`);
      }

      // Atomic update using shared manager
      const success = executeTrade({
        usdtChange: -amount,
        bnbChange: bnbReceived
      });

      if (!success) {
        logger.error('❌ Failed to update shared balances for BUY trade');
        return { success: false, wouldExecute: false, reason: 'balance_update_failed' };
      }

      logger.info(`🔍 [SIMULATE BUY] ${amount.toFixed(2)} USDT × ${currentPrice.toFixed(9)} = ${bnbReceived.toFixed(6)} BNB`);
      logger.info(`👻 Shadow Trade: ${action} ${amount.toFixed(4)} at ${targetPrice}`);

      const newBalances = getSharedVirtualBalances();
      logger.info(`👻 New Balances: ${newBalances.usdt.toFixed(2)} USDT, ${newBalances.bnb.toFixed(6)} BNB`);
    } else if (action === 'sell') {
      // CORRECT: SELL = DIVIDE by (BNB/USDT) rate
      let usdtReceived = amount / currentPrice;

      // 🚀 ENHANCEMENT #2: Apply slippage simulation
      if (SIMULATE_SLIPPAGE) {
        const slippageLoss = usdtReceived * SLIPPAGE_BUFFER;
        usdtReceived = usdtReceived * (1 - SLIPPAGE_BUFFER);
        logger.info(`💸 [SLIPPAGE] SELL: $${slippageLoss.toFixed(2)} USDT lost to slippage (${(SLIPPAGE_BUFFER * 100).toFixed(1)}%)`);
      }

      // Atomic update using shared manager
      const success = executeTrade({
        usdtChange: usdtReceived,
        bnbChange: -amount
      });

      if (!success) {
        logger.error('❌ Failed to update shared balances for SELL trade');
        return { success: false, wouldExecute: false, reason: 'balance_update_failed' };
      }

      logger.info(`🔍 [SIMULATE SELL] ${amount.toFixed(6)} BNB / ${currentPrice.toFixed(9)} = ${usdtReceived.toFixed(2)} USDT`);
      logger.info(`👻 Shadow Trade: ${action} ${amount.toFixed(4)} at ${targetPrice}`);

      const newBalances = getSharedVirtualBalances();
      logger.info(`👻 New Balances: ${newBalances.usdt.toFixed(2)} USDT, ${newBalances.bnb.toFixed(6)} BNB`);
    }

    // Calculate profit (realistic)
    const estimatedProfit = action === 'buy' ? 0 : Math.max(0, slippageCost * 0.5);

    // 🔧 FIX: Get updated balances from shared manager (not this.virtualPortfolio)
    const finalBalances = getSharedVirtualBalances();

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
        usdt: finalBalances.usdt,
        bnb: finalBalances.bnb
      },
      shadowMode: true
    };

    this.shadowTrades.push(trade);

    if (this.options.recordToFile) {
      await this.saveTradesToFile(trade);
    }

    // Record trade to database for analytics
    await this.recordTradeToDatabase(trade);

    // 🔧 FIX: Return shared balances (not this.virtualPortfolio)
    return {
      success: true,
      wouldExecute: true,
      estimatedProfit,
      balances: finalBalances,
      usdt: finalBalances.usdt,
      bnb: finalBalances.bnb
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

    // Diagnostic logging for price format verification
    if (this.tradeCount === 0) {
      logger.info(`🔬 [PRICE DIAGNOSTIC]`);
      logger.info(`   Format: ${currentPrice} BNB per USDT`);
      logger.info(`   Meaning: 1 USDT buys ${currentPrice.toFixed(9)} BNB`);
      logger.info(`   Inverse: 1 BNB costs ${(1/currentPrice).toFixed(2)} USDT`);
      logger.info(`   Portfolio check: ${this.virtualPortfolio.bnb} BNB should equal ~$${(this.virtualPortfolio.bnb / currentPrice).toFixed(2)}`);
    }
    this.tradeCount = (this.tradeCount || 0) + 1;

    if (tradeParams.action === 'buy' || tradeParams.action === 'rebalance') {
      const usdtSpent = tradeParams.amount;
      // CORRECT: BUY = MULTIPLY by (BNB/USDT) rate
      // Dimensional analysis: USDT × (BNB/USDT) = BNB ✅
      const bnbReceived = (usdtSpent * currentPrice) * slippageFactor;

      logger.info(`🔍 [SHADOW BUY] Spending ${usdtSpent.toFixed(2)} USDT`);
      logger.info(`   Rate: ${currentPrice.toFixed(9)} BNB per USDT`);
      logger.info(`   Calculation: ${usdtSpent.toFixed(2)} × ${currentPrice.toFixed(9)} = ${bnbReceived.toFixed(6)} BNB`);
      logger.info(`   Dimensional check: USDT × (BNB/USDT) = BNB ✅`);

      this.virtualPortfolio.usdt -= usdtSpent;
      this.virtualPortfolio.bnb += bnbReceived;

      logger.info(`   New balances: ${this.virtualPortfolio.usdt.toFixed(2)} USDT, ${this.virtualPortfolio.bnb.toFixed(6)} BNB`);
    } else if (tradeParams.action === 'sell') {
      const bnbSold = tradeParams.amount;
      // CORRECT: SELL = DIVIDE by (BNB/USDT) rate
      // Dimensional analysis: BNB / (BNB/USDT) = USDT ✅
      const usdtReceived = (bnbSold / currentPrice) * slippageFactor;

      logger.info(`🔍 [SHADOW SELL] Selling ${bnbSold.toFixed(6)} BNB`);
      logger.info(`   Rate: ${currentPrice.toFixed(9)} BNB per USDT`);
      logger.info(`   Calculation: ${bnbSold.toFixed(6)} / ${currentPrice.toFixed(9)} = ${usdtReceived.toFixed(2)} USDT`);
      logger.info(`   Dimensional check: BNB / (BNB/USDT) = USDT ✅`);

      this.virtualPortfolio.bnb -= bnbSold;
      this.virtualPortfolio.usdt += usdtReceived;

      logger.info(`   New balances: ${this.virtualPortfolio.usdt.toFixed(2)} USDT, ${this.virtualPortfolio.bnb.toFixed(6)} BNB`);
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
    // Use shared virtual balance manager (single source of truth)
    const balances = getSharedVirtualBalances();

    return {
      usdt: balances.usdt,
      bnb: balances.bnb,
      totalValueUSD: balances.usdt + (balances.bnb / (this.currentPrice || 0.00088)) // FIX: DIVIDE by price
    };
  }

  // Add portfolio value logging method
  async logPortfolioValue() {
    try {
      const balances = getSharedVirtualBalances();
      const currentPrice = await this.bot.multiDexManager?.dexs?.pancakeSwap?.getCurrentPrice() || 0.00088;
      const bnbValue = balances.bnb / currentPrice; // FIX: DIVIDE by price
      const totalValue = balances.usdt + bnbValue;

      logger.info(`💰 Portfolio Value: $${totalValue.toFixed(2)}`);
      logger.info(`   USDT: $${balances.usdt.toFixed(2)}`);
      logger.info(`   BNB: ${balances.bnb.toFixed(2)} ($${bnbValue.toFixed(2)} @ $${currentPrice.toFixed(6)})`);

      return totalValue;
    } catch (error) {
      logger.error(`Error logging portfolio value: ${error.message}`);
      return 0;
    }
  }

  // Add full reset method for complete cleanup
  fullReset() {
    // Reset balances to initial state using shared manager
    resetSharedVirtualBalances();

    // Reset other state if needed
    this.tradeHistory = [];
    this.currentPrice = 0.00088;

    const balances = getSharedVirtualBalances();
    logger.info('🔄 Shadow mode FULL RESET complete');
    logger.info(`💰 USDT: ${balances.usdt}, BNB: ${balances.bnb}`);
  }

  // Add reset method
  resetBalances() {
    // Use shared virtual balance manager to reset
    resetSharedVirtualBalances();
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

      // 🔥 ENHANCED: Extract strategy from reasoning field
      let strategy = 'unknown';
      if (trade.reasoning) {
        // Parse strategy from reasoning: "Exit downward_breakout: ranging" -> "ranging"
        const strategyMatch = trade.reasoning.match(/:\s*(\w+)/);
        if (strategyMatch) {
          strategy = strategyMatch[1];
        }
        // Also check for common strategy names directly in reasoning
        const strategyKeywords = ['ranging', 'momentum', 'mean_reversion', 'grid', 'breakout'];
        for (const keyword of strategyKeywords) {
          if (trade.reasoning.toLowerCase().includes(keyword)) {
            strategy = keyword;
            break;
          }
        }
      }

      // 🔥 ENHANCED: Calculate position size in USD
      const sizeUSD = trade.amount || 0;
      const currentPrice = trade.targetPrice || 0.00088;
      const sizeToken = trade.action === 'buy' ? (sizeUSD * currentPrice) : sizeUSD;

      // 🔥 ENHANCED: Filter out HOLD actions
      if (trade.action === 'HOLD') {
        logger.debug(`📝 Skipping HOLD action from shadow trades file`);
        return; // Don't save HOLD actions
      }

      // Add new trade with enhanced data
      const tradeRecord = {
        ...trade,
        timestamp: new Date().toISOString(),
        strategy: strategy,  // 🔥 NEW: Extracted strategy
        size: sizeToken,     // 🔥 NEW: Token size
        sizeUSD: sizeUSD,    // 🔥 NEW: USD size
        shadowMode: true
      };

      trades.push(tradeRecord);

      // Keep only recent trades (limit to maxRecords)
      if (trades.length > this.options.maxRecords) {
        trades = trades.slice(-this.options.maxRecords);
      }

      // Write to file
      await fs.writeFile(tradesFile, JSON.stringify(trades, null, 2));

      logger.info(`💾 Shadow trade saved: ${trade.action} ${strategy} $${sizeUSD.toFixed(2)}`);

    } catch (error) {
      logger.error(`❌ Failed to save shadow trade to file: ${error.message}`);
      // Don't throw error - file saving is not critical for trading
    }
  }
}

module.exports = ShadowMode;
