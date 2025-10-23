# 📦 CODE SOURCE COMPLET - BSC Trading Bot
# Généré: 11 Octobre 2025 - 06:30 UTC
# Pour: Expert Claude Review

**STATUS:** ✅ Code complet avec tous les fichiers principaux

---

## 📋 TABLE DES MATIÈRES

1. **agents/TradingStrategyAgent.js** (3,443 lignes) - CORE TRADING LOGIC
2. **AdvancedTradingBot.js** (2,024 lignes) - BOT ORCHESTRATION  
3. **testing/shadowMode.js** (752 lignes) - VIRTUAL PORTFOLIO
4. **risk/productionRiskManager.js** (777 lignes) - RISK MANAGEMENT
5. **rangingStrategy.js** (223 lignes) - RANGING STRATEGY

**TOTAL:** 7,219 lignes de code

---
═══════════════════════════════════════════════════════════════════════
FICHIER 1: agents/TradingStrategyAgent.js (3,443 lignes)
═══════════════════════════════════════════════════════════════════════

const BaseAgent = require('./BaseAgent');
const { Trade, StrategyPerformance, GridState } = require('../database/models');
const logger = require('../logger');
const Anthropic = require('@anthropic-ai/sdk');

// ═══════════════════════════════════════════════════════════════
// TAKE PROFIT CONFIGURATION
// Phase 1: Fixed 0.8% (CURRENT - validating exit works)
// Phase 2: Dynamic (after validation - see calculateDynamicTP below)
// ═══════════════════════════════════════════════════════════════
const FIXED_TP_PERCENT = 0.008; // 0.8% Phase 1 - Realistic profit after 0.3% fees
// Phase 2: Will implement dynamic TP after 5+ successful exits confirmed

class TradingStrategyAgent extends BaseAgent {
  constructor(pancakeSwap, priceHistoryManager, config = {}) {
    super(
      'TradingStrategyAgent',
      'Advanced trading strategy agent with ML-enhanced decision making'
    );

    this.pancakeSwap = pancakeSwap;
    this.priceHistoryManager = priceHistoryManager;

    // Initialize Claude AI client
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.strategies = {
      ranging: this.rangingStrategy.bind(this),
      momentum: this.momentumStrategy.bind(this),
      mean_reversion: this.meanReversionStrategy.bind(this),
      breakout: this.breakoutStrategy.bind(this),
      gridTrading: this.gridTradingStrategy.bind(this),
      vwap: this.vwapStrategy.bind(this),
      ichimoku: this.ichimokuCloudStrategy.bind(this)
    };

    this.currentStrategy = 'ranging';
    this.performanceHistory = [];
    this.marketContext = null;

    // 🚨 CRITICAL FIX: Position tracking for stop-loss monitoring
    this.activePositions = new Map();
    this.positionHistory = [];
    this.lastTradeTime = 0;

    // ═══════════════════════════════════════════════════════════
    // EXIT STATISTICS TRACKING (Phase 1)
    // ═══════════════════════════════════════════════════════════
    this.exitStats = {
      total: 0,
      byReason: {
        take_profit: 0,
        stop_loss: 0,
        max_hold_time_exceeded: 0,
        emergency_time: 0,
        breakout: 0,
        reversion_complete: 0
      },
      totalProfit: 0,
      avgProfit: 0,
      lastExitTime: 0
    };

    // 🔥 FIX #7: Make parameters configurable
    this.config = {
      // Range detection
      rangeMin: config.rangeMin || 0.02,        // 2%
      rangeMax: config.rangeMax || 0.06,        // 6%
      trendThreshold: config.trendThreshold || 0.01, // TEMPORARILY LOWERED FOR TESTING (was 3%)

      // Trading
      boundsThreshold: config.boundsThreshold || 0.20, // 20% - FIXED: More trading opportunities (was 5%)
      minProfit: config.minProfit || 1.00,      // $1.00 - Lowered for more trades
      cooldownMs: config.cooldownMs || 60000, // 1 minute - OPTIMIZED FOR $60K

      // Position sizing - OPTIMIZED FOR $30K PORTFOLIO
      lowConfidenceSize: config.lowConfidenceSize || 0.10,    // 10% = $3,000 for confidence < 0.70
      mediumConfidenceSize: config.mediumConfidenceSize || 0.15, // 15% = $4,500 for confidence 0.70-0.80
      highConfidenceSize: config.highConfidenceSize || 0.20,  // 20% = $6,000 for confidence >= 0.80
      veryHighConfidenceSize: config.veryHighConfidenceSize || 0.30, // 30% = $9,000 for confidence >= 0.90
      confidenceThreshold: config.confidenceThreshold || 0.70, // Threshold for medium confidence
      superHighThreshold: config.superHighThreshold || 0.85,  // Threshold for high confidence
      extremeThreshold: config.extremeThreshold || 0.90,      // Threshold for very high confidence
      maxPositionPct: config.maxPositionPct || 0.30, // 30% (legacy, kept for compatibility)
      minBalance: config.minBalance || 10,         // $10 minimum (was $100)

      // Safety
      priceStalenessMs: config.priceStalenessMs || 60000, // 1 minute
      minPriceHistory: config.minPriceHistory || 200,     // 200 data points

      // Grid Trading
      gridLevels: config.gridLevels || 10,
      gridMinTradeInterval: config.gridMinTradeInterval || 300000, // 5 minutes
    };

    // 🔥 FIX #2: Add trade cooldown to prevent spam (max 24 trades/day)
    this.lastTradeTime = 0;
    this.MIN_TIME_BETWEEN_TRADES = this.config.cooldownMs;
  }

  async enhanceMarketDataWithVolume(marketData) {
    try {
      // Get price history with volume data
      const priceVolumeHistory = this.priceHistoryManager.getPriceVolumeHistory();

      // Validate volume data
      const isValidVolume = this.priceHistoryManager.validateVolumeData();

      if (!isValidVolume) {
        logger.warn('⚠️ Volume data validation failed, using fallback');
      }

      // Enhance market data with volume information
      const enhancedData = {
        ...marketData,
        priceHistory: priceVolumeHistory,
        volumeHistory: this.priceHistoryManager.getVolumeArray(),
        latestVolume: this.priceHistoryManager.getLatestVolume(),
        hasVolumeData: isValidVolume && priceVolumeHistory.length > 0
      };

      logger.debug(`📊 Enhanced market data with volume: ${priceVolumeHistory.length} price/volume points`);

      return enhancedData;

    } catch (error) {
      logger.error('Error enhancing market data with volume:', error);

      // Return original market data if volume enhancement fails
      return {
        ...marketData,
        priceHistory: marketData.priceHistory || [],
        volumeHistory: [],
        latestVolume: 0,
        hasVolumeData: false
      };
    }
  }

  // 🚀 CRITICAL FIX #3: Kelly Criterion Position Sizing (OPTIMIZE RETURNS)
  async _calculatePositionSizeByConfidence(action, confidence, usdtBalance, bnbBalance, currentPrice) {
    if (action === 'hold' || action === 'rebalance') return 0;

    // Get historical win rate for current strategy
    const winRate = await this.getStrategyWinRate(this.currentStrategy);
    const avgWin = await this.getStrategyAvgWin(this.currentStrategy);
    const avgLoss = await this.getStrategyAvgLoss(this.currentStrategy);

    // Kelly Criterion: f = (p * b - q) / b
    // where p = win probability, q = loss probability, b = win/loss ratio
    let kellyFraction = 0;
    if (winRate > 0 && avgWin > 0 && avgLoss > 0) {
      const p = winRate;
      const q = 1 - p;
      const b = avgWin / avgLoss;
      kellyFraction = (p * b - q) / b;
      kellyFraction = Math.max(0, Math.min(kellyFraction, 0.06)); // Cap at 6% (was 25% - CRITICAL FIX)
    }

    // Blend Kelly with confidence-based sizing
    let baseSize = 0.03; // 3% default (was 10% - CRITICAL FIX)
    if (kellyFraction > 0) {
      baseSize = kellyFraction * 0.5; // Use half-Kelly for safety
    }

    // Adjust by confidence
    const confidenceMultiplier = confidence / 0.70; // Normalize to 70% baseline
    const calculatedSize = baseSize * confidenceMultiplier;

    // Hard caps - PROFESSIONAL RISK MANAGEMENT: 3% max position (was 5% - CRITICAL FIX)
    const positionSize = Math.max(0.02, Math.min(calculatedSize, 0.03)); // 2-3% range (safer than industry 5%)

    // 🔍 DEBUG: Log position size calculation
    logger.info(`📊 Position Size Calc:
  Kelly: ${(kellyFraction * 100).toFixed(1)}%
  Confidence: ${(confidence * 100).toFixed(0)}%
  Calculated: ${(calculatedSize * 100).toFixed(1)}%
  Capped to: ${(positionSize * 100).toFixed(1)}% (max 3% - conservative risk to pass validation)
`);

    // 🔍 DEBUG: Log input values
    logger.info(`🔍 POSITION SIZE INPUTS:
  usdtBalance: $${usdtBalance.toFixed(2)}
  bnbBalance: ${bnbBalance.toFixed(4)} BNB
  currentPrice: ${currentPrice.toFixed(9)} (BNB per USDT)
  positionSize: ${(positionSize * 100).toFixed(1)}%
`);

    // CRITICAL FIX: Price is BNB per USDT, so 1 BNB = 1/price USDT
    const bnbValueInUsdt = bnbBalance / currentPrice;
    const totalBalance = usdtBalance + bnbValueInUsdt;
    const dollarSize = totalBalance * positionSize;

    logger.info(`📊 Dollar Size: $${dollarSize.toFixed(2)} (${(positionSize * 100).toFixed(1)}% of $${totalBalance.toFixed(2)}) [BNB=$${bnbValueInUsdt.toFixed(2)}]`);
    // Ensure we don't exceed available balance
    if (action === 'buy' && dollarSize > usdtBalance) {
      return usdtBalance * 0.95; // Use 95% of available USDT
    } else if (action === 'sell') {
      // For sell, check if dollar value exceeds BNB holdings value
      if (dollarSize > bnbValueInUsdt) {
        return bnbValueInUsdt * 0.95; // Use 95% of available BNB value in USDT
      }
    }

    return dollarSize;
  }

  // Helper methods to get strategy performance
  async getStrategyWinRate(strategy) {
    try {
      const { Trade } = require('../database/models');
      const { Op } = require('sequelize');

      const trades = await Trade.findAll({
        where: { strategy: strategy },
        limit: 100,
        order: [['created_at', 'DESC']]
      });

      if (trades.length < 20) {
        logger.debug(`Insufficient data for ${strategy}: ${trades.length} trades, using conservative default`);
        return 0.55; // Conservative 55% when lacking data
      }

      const wins = trades.filter(t => t.profit_loss > 0).length;
      const winRate = wins / trades.length;

      logger.debug(`${strategy} win rate: ${(winRate * 100).toFixed(1)}% (${wins}/${trades.length} trades)`);
      return winRate;
    } catch (error) {
      logger.error(`Error getting win rate for ${strategy}: ${error.message}`);
      return 0.55; // Conservative fallback
    }
  }

  async getStrategyAvgWin(strategy) {
    try {
      const { Trade } = require('../database/models');
      const { Op } = require('sequelize');

      const trades = await Trade.findAll({
        where: { strategy: strategy, profit_loss: { [Op.gt]: 0 } },
        limit: 50
      });

      if (trades.length < 10) {
        logger.debug(`Insufficient winning trades for ${strategy}: ${trades.length}, using conservative default`);
        return 45; // Conservative $45 average win
      }

      const avgWin = trades.reduce((sum, t) => sum + t.profit_loss, 0) / trades.length;
      logger.debug(`${strategy} avg win: $${avgWin.toFixed(2)} (${trades.length} winning trades)`);
      return avgWin;
    } catch (error) {
      logger.error(`Error getting avg win for ${strategy}: ${error.message}`);
      return 45; // Conservative fallback
    }
  }

  async getStrategyAvgLoss(strategy) {
    try {
      const { Trade } = require('../database/models');
      const { Op } = require('sequelize');

      const trades = await Trade.findAll({
        where: { strategy: strategy, profit_loss: { [Op.lt]: 0 } },
        limit: 50
      });

      if (trades.length < 10) {
        logger.debug(`Insufficient losing trades for ${strategy}: ${trades.length}, using conservative default`);
        return 25; // Conservative $25 average loss
      }

      const avgLoss = Math.abs(trades.reduce((sum, t) => sum + t.profit_loss, 0) / trades.length);
      logger.debug(`${strategy} avg loss: $${avgLoss.toFixed(2)} (${trades.length} losing trades)`);
      return avgLoss;
    } catch (error) {
      logger.error(`Error getting avg loss for ${strategy}: ${error.message}`);
      return 25; // Conservative fallback
    }
  }

  async performAction(input, metadata) {
    const {
      action = 'analyze',
      strategy = this.currentStrategy,
      marketData = null,
      researchData = null
    } = input;

    switch (action) {
      case 'analyze':
        return await this.analyzeMarket(marketData, researchData);
      case 'decide':
        return await this.makeTradingDecision(strategy, marketData, researchData);
      case 'backtest':
        return await this.backtestStrategy(strategy, input.period);
      case 'optimize':
        return await this.optimizeStrategy(strategy, input.parameters);
      default:
        return await this.analyzeMarket(marketData, researchData);
    }
  }

  async analyzeMarket(marketData, researchData) {
    try {
      logger.info('🧠 Analyzing market conditions...');

      const analysis = {
        timestamp: new Date(),
        price_analysis: await this.analyzePriceAction(marketData),
        volume_analysis: await this.analyzeVolume(marketData),
        sentiment_analysis: this.analyzeSentiment(researchData),
        technical_indicators: await this.calculateTechnicalIndicators(marketData),
        market_structure: await this.analyzeMarketStructure(marketData),
        risk_assessment: await this.assessRisk(marketData, researchData)
      };

      // Determine best strategy based on analysis
      analysis.recommended_strategy = this.selectOptimalStrategy(analysis);
      analysis.confidence = this.calculateConfidence(analysis);

      this.marketContext = analysis;
      return analysis;
    } catch (error) {
      logger.error('Error analyzing market:', error);
      throw error;
    }
  }

  async _getAIStrategySelection(marketData, availableStrategies) {
    try {
      // Check if API key is available and has credits
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your-anthropic-api-key')) {
        logger.info('🤖 AI strategy selection disabled: No API key configured');
        return null;
      }

      const message = await this.claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: `You're a crypto trading analyst. Analyze market data and select the best strategy.

Market Data:
- Current Price: $${marketData.currentPrice}
- Latest Volume: ${marketData.latestVolume || 'N/A'}
- Price History Points: ${marketData.priceHistory?.length || 0}
- Available Strategies: ${availableStrategies.join(', ')}

Consider:
- Use 'vwap' or 'ichimoku' for trending markets with volume
- Use 'ranging' for sideways markets
- Use 'momentum' for strong trends
- Use 'mean_reversion' for oversold/overbought
- Use 'gridTrading' for tight ranges

Return JSON only:
{
  "strategy": "best_strategy_name",
  "confidence": 0.XX,
  "reasoning": "brief explanation",
  "riskLevel": "low|medium|high"
}`
        }]
      });

      // 🐛 FIX: Strip markdown code blocks from AI response
      let responseText = message.content[0].text;

      // Remove markdown code blocks (```json ... ``` or ``` ... ```)
      responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Trim whitespace
      responseText = responseText.trim();

      const response = JSON.parse(responseText);
      logger.info(`🤖 AI selected strategy: ${response.strategy} (confidence: ${response.confidence})`);
      return response;

    } catch (error) {
      if (error.message.includes('credit balance is too low')) {
        logger.warn('🤖 AI strategy selection disabled: Insufficient API credits. Please add credits to your Anthropic account.');
      } else if (error.message.includes('authentication')) {
        logger.warn('🤖 AI strategy selection disabled: Invalid API key. Please check your ANTHROPIC_API_KEY in .env file.');
      } else {
        logger.error('AI strategy selection error:', {
          message: error.message,
          code: error.code,
          status: error.status,
          type: error.type,
          stack: error.stack?.substring(0, 200) // First 200 chars of stack
        });
      }
      return null; // Fallback to algorithmic selection
    }
  }

  // 🚨 CRITICAL FIX: Position monitoring and stop-loss execution
  async monitorPositions() {
    logger.info('🔍 monitorPositions() called');
    if (!this.activePositions || this.activePositions.size === 0) {
      logger.info('No active positions to monitor');
      return;
    }
    logger.info(`📊 Monitoring ${this.activePositions.size} active positions`);

    try {
      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      const now = Date.now();

      // 🎯 EXPERT: Calculate market volatility for dynamic take profit
      const priceHistory = this.priceHistoryManager ?
        await this.priceHistoryManager.getHistory(100) : [];
      const volatility = this.calculateVolatility(priceHistory);

      for (const [id, position] of this.activePositions) {
        // ═══════════════════════════════════════════════════════════════
        // 🧹 AUTO-CLEANUP: Remove old positions with undefined side
        // (Created before validation fix was applied)
        // ═══════════════════════════════════════════════════════════════
        if (!position.side || position.side === 'undefined' || position.side === '') {
          logger.warn(`🧹 AUTO-CLEANUP: Removing old invalid position from tracking`);
          logger.warn(`   Position ID: ${id}`);
          logger.warn(`   Side: "${position.side}" (invalid)`);
          logger.warn(`   Entry Price: ${position.entryPrice || 'unknown'}`);
          logger.warn(`   Entry Time: ${position.timestamp ? new Date(position.timestamp).toISOString() : 'unknown'}`);
          logger.warn(`   Has TP: ${position.takeProfit ? 'YES' : 'NO'}`);
          logger.warn(`   Reason: Created before validation fix - cannot determine buy/sell direction`);

          // Remove from active positions map
          this.activePositions.delete(id);

          logger.info(`✅ Position ${id} removed from tracking (invalid side)`);
          logger.info(`📊 Remaining active positions: ${this.activePositions.size}`);

          continue; // Skip to next position
        }

        // ═══════════════════════════════════════════════════════════════
        // 🛡️ VALIDATION: Ensure position has required fields
        // ═══════════════════════════════════════════════════════════════
        if (!position.entryPrice || !position.timestamp) {
          logger.warn(`🧹 AUTO-CLEANUP: Removing position with missing data`);
          logger.warn(`   Position ID: ${id}`);
          logger.warn(`   Has Entry Price: ${!!position.entryPrice}`);
          logger.warn(`   Has Timestamp: ${!!position.timestamp}`);

          this.activePositions.delete(id);
          logger.info(`✅ Position ${id} removed from tracking (missing required fields)`);
          continue;
        }

        const profit = (currentPrice - position.entryPrice) / position.entryPrice;
        const profitUSD = profit * position.size;
        const holdTime = now - position.timestamp;

        // ═══ FIX: Force exit after max hold time ═══
        const MAX_HOLD_TIME = 2 * 3600000; // 2 hours (reduced from 4h for faster testing)

        if (holdTime > MAX_HOLD_TIME) {
          const holdHours = (holdTime / 3600000).toFixed(1);
          logger.warn(`⏰ FORCED EXIT: Position ${id} exceeded max hold time (${holdHours}h)`);
          logger.warn(`   Entry: ${position.entryPrice.toFixed(8)} | Current: ${currentPrice.toFixed(8)}`);
          logger.warn(`   P&L: ${(profit * 100).toFixed(2)}% | TP was: ${position.takeProfit ? position.takeProfit.toFixed(8) : 'NOT SET'}`);

          await this.executeExit(position, currentPrice, 'max_hold_time_exceeded');
          continue; // Move to next position
        }

        // Log aging positions (warn before forced exit)
        if (holdTime > 1800000) { // 30+ minutes
          const ageMin = (holdTime / 60000).toFixed(1);
          const remainingMin = ((MAX_HOLD_TIME - holdTime) / 60000).toFixed(0);
          logger.info(`⏳ Position ${id}: ${ageMin} min old | Force exit in ${remainingMin} min if not closed`);
        }

        logger.info(`📊 Monitoring position ${id}: profit ${(profit * 100).toFixed(2)}%, hold time ${(holdTime / 60000).toFixed(1)}min, current: ${currentPrice.toFixed(6)}, entry: ${position.entryPrice.toFixed(6)}`);

        // 🔍 DEBUG: Detailed exit condition analysis
        logger.info(`🔍 Position ${id} EXIT CONDITIONS CHECK:
  Side: ${position.side}
  Entry: ${position.entryPrice.toFixed(8)}
  Current: ${currentPrice.toFixed(8)}
  PnL: ${(profit * 100).toFixed(2)}%
  Stop Loss: ${position.stopLoss ? position.stopLoss.toFixed(8) : 'NOT SET'}
  Take Profit Target: Calculated below
  Has TP: ${position.takeProfit ? 'YES' : 'NO'}
  Should Exit SL (buy): ${position.side === 'buy' && position.stopLoss ? currentPrice <= position.stopLoss : 'N/A'}
  Should Exit SL (sell): ${position.side === 'sell' && position.stopLoss ? currentPrice >= position.stopLoss : 'N/A'}`);

        // 📈 Trailing Stop Loss - Move stop up as profit increases (EXPERT OPTIMIZED)
        const pnlPercent = profit;
        if (pnlPercent > 0.005) { // If >0.5% profit (expert threshold)
          const trailingStopPercent = 0.01;  // Trail by 1% (expert recommended)
          const newStopLoss = position.side === 'buy'
            ? currentPrice * (1 - trailingStopPercent)
            : currentPrice * (1 + trailingStopPercent);

          // Only move stop loss in favorable direction
          if (position.side === 'buy' && newStopLoss > position.stopLoss) {
            const oldStop = position.stopLoss;
            position.stopLoss = newStopLoss;
            logger.info(`📈 Trailing stop updated: ${oldStop.toFixed(8)} → ${newStopLoss.toFixed(8)} (profit: ${(pnlPercent * 100).toFixed(2)}%)`);
          } else if (position.side === 'sell' && newStopLoss < position.stopLoss) {
            const oldStop = position.stopLoss;
            position.stopLoss = newStopLoss;
            logger.info(`📉 Trailing stop updated: ${oldStop.toFixed(8)} → ${newStopLoss.toFixed(8)} (profit: ${(pnlPercent * 100).toFixed(2)}%)`);
          }
        }

        // Exit condition 1: Take Profit (use stored value)
        if (position.takeProfit) {
          const profitPercent = (profit * 100).toFixed(2);
          const tpPercent = position.takeProfitPercent
            ? (position.takeProfitPercent * 100).toFixed(2)
            : ((position.takeProfit / position.entryPrice - 1) * 100).toFixed(2);

          // 🔍 DETAILED DEBUG LOGGING FOR EXIT ANALYSIS
          logger.info(`
🔍 DETAILED TP CHECK for ${id}:
  ═══════════════════════════════════════
  Current Price: ${currentPrice.toFixed(11)}
  TP Target: ${position.takeProfit ? position.takeProfit.toFixed(11) : 'NOT SET'}
  Entry Price: ${position.entryPrice.toFixed(11)}

  Current P&L%: ${(profit * 100).toFixed(3)}%
  TP Percent Setting: ${tpPercent}%
  Side: ${position.side || 'UNDEFINED'}

  ═══ EXIT LOGIC EVALUATION ═══
  FOR BUY: currentPrice >= TP? ${position.side === 'buy' ? (currentPrice >= position.takeProfit) : 'N/A'}
           (${currentPrice.toFixed(8)} >= ${position.takeProfit ? position.takeProfit.toFixed(8) : 'none'})

  FOR SELL: currentPrice <= TP? ${position.side === 'sell' ? (currentPrice <= position.takeProfit) : 'N/A'}
            (${currentPrice.toFixed(8)} <= ${position.takeProfit ? position.takeProfit.toFixed(8) : 'none'})

  WILL EXIT NOW: ${position.side === 'buy' ? (currentPrice >= position.takeProfit) : position.side === 'sell' ? (currentPrice <= position.takeProfit) : 'UNKNOWN SIDE'}
  ═══════════════════════════════════════
`);

          // Check if TP hit based on side
          const tpHit = position.side === 'buy'
            ? currentPrice >= position.takeProfit
            : currentPrice <= position.takeProfit;

          if (tpHit) {
            logger.info(`🎯 Take profit hit! Exiting position at ${profitPercent}% profit`);
            await this.executeExit(position, currentPrice, 'take_profit');
            continue;
          }
        } else {
          logger.warn(`⚠️ Position ${id} missing takeProfit value, using fallback ${(FIXED_TP_PERCENT * 100).toFixed(1)}%`);
          // Fallback to fixed TP
          if (profit >= FIXED_TP_PERCENT) {
            await this.executeExit(position, currentPrice, 'take_profit_fallback');
            continue;
          }
        }

        // Exit condition 2: Stop loss
        if (position.side === 'buy' && currentPrice <= position.stopLoss) {
          logger.warn(`🛑 Stop loss hit: ${currentPrice} <= ${position.stopLoss}`);
          await this.executeExit(position, currentPrice, 'stop_loss');
          continue;
        }

        // Exit condition 3: Max hold time
        if (holdTime > 4 * 3600000) {
          logger.warn(`⏰ Max hold time exceeded: ${(holdTime / 3600000).toFixed(1)}h`);
          await this.executeExit(position, currentPrice, 'max_time');
          continue;
        }

        // Exit condition 4: Breakout Detection (EXPERT: Protects ranging positions)
        if (position.strategy === 'ranging') {
          const priceHistory = this.priceHistoryManager ?
            await this.priceHistoryManager.getHistory(100) : [];

          // Find ranging strategy instance
          const rangingStrategy = require('../rangingStrategy');
          const rangingInstance = new rangingStrategy(this.pancakeSwap);
          const breakout = rangingInstance.detectBreakout(currentPrice, priceHistory);

          // 🐛 FIX: Null check for breakout before calling toUpperCase()
          if (breakout) {
            const breakoutType = (breakout || 'unknown').toUpperCase();
            logger.warn(`🚨 ${breakoutType} breakout detected - Exiting ranging position`);
            await this.executeExit(position, currentPrice, `${breakout}_breakout`);
            continue;
          }
        }

        // Exit condition 5: Mean reversion complete
        if (position.strategy === 'mean_reversion' && position.entryZScore < -0.5) {
          const currentZScore = this.calculateZScore(currentPrice);
          if (currentZScore > 0.2) {
            logger.info(`📈 Mean reversion complete: z-score ${position.entryZScore} → ${currentZScore}`);
            await this.executeExit(position, currentPrice, 'reversion_complete');
          }
        }
      }
    } catch (error) {
      logger.error('Error monitoring positions:', error);
    }
  }

  async checkExitConditions(position, currentPrice) {
    const profit = position.side === 'buy'
      ? (currentPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - currentPrice) / position.entryPrice;

    // Take profit at 2%
    if (profit >= 0.02) {
      return { action: 'exit', reason: 'take_profit' };
    }

    // Exit if z-score reverses significantly
    if (position.entryZScore < -0.7 && position.currentZScore > 0) {
      return { action: 'exit', reason: 'mean_reversion_complete' };
    }

    return null;
  }

  async executeStopLoss(positionId, reason) {
    const position = this.activePositions.get(positionId);
    if (!position) return;

    try {
      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      const profit = position.side === 'buy'
        ? (currentPrice - position.entryPrice) * position.size / position.entryPrice
        : (position.entryPrice - currentPrice) * position.size / position.entryPrice;

      // 🐛 FIX: Null check for position.side before calling toUpperCase()
      const side = (position.side || 'unknown').toUpperCase();
      logger.warn(`${profit > 0 ? '✅' : '❌'} STOP-LOSS: ${side} ${reason} | P&L: $${profit.toFixed(2)}`);

      // 🚨 CRITICAL FIX: Execute opposite trade to close position
      await this.executeExit(position, currentPrice, reason);

      // Move to history
      this.positionHistory.push({
        ...position,
        exitPrice: currentPrice,
        exitTime: Date.now(),
        profit,
        exitReason: reason
      });

      // Remove from active
      this.activePositions.delete(positionId);

      return { success: true, profit, reason };
    } catch (error) {
      logger.error('Error executing stop-loss:', error);
      return { success: false, error };
    }
  }

  // 🚨 CRITICAL FIX: Execute opposite trade to close position
  async executeExit(position, currentPrice, reason) {
    try {
      const profit = (currentPrice - position.entryPrice) / position.entryPrice;
      const profitUSD = profit * position.size;
      const holdTime = Date.now() - position.timestamp;
      const holdMinutes = (holdTime / 60000).toFixed(0);

      // 🐛 FIX: Null check for position.side before calling toUpperCase()
      const side = (position.side || 'unknown').toUpperCase();

      // ═══════════════════════════════════════════════════════════
      // 🎯 EXIT EXECUTION - Enhanced Logging (Phase 1)
      // ═══════════════════════════════════════════════════════════
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║              🎯 POSITION EXIT EXECUTING                    ║
╠═══════════════════════════════════════════════════════════╣
║  Position ID: ${position.id}
║  Side: ${side}
║  Pair: ${position.pair || 'BNB/USDT'}
║
║  ENTRY:
║  ├── Price: ${position.entryPrice?.toFixed(8)}
║  ├── Time: ${new Date(position.timestamp).toISOString()}
║  └── Amount: $${position.size?.toFixed(2)}
║
║  EXIT:
║  ├── Price: ${currentPrice.toFixed(8)}
║  ├── Time: ${new Date().toISOString()}
║  └── Hold: ${holdMinutes} minutes
║
║  RESULT:
║  ├── Profit: ${(profit * 100).toFixed(3)}%
║  ├── Dollar: $${profitUSD.toFixed(2)}
║  └── Reason: ${reason}
║
║  TARGET:
║  ├── Take Profit: ${position.takeProfit?.toFixed(8)} (${position.takeProfitPercent ? (position.takeProfitPercent * 100).toFixed(1) : 'N/A'}%)
║  └── Stop Loss: ${position.stopLoss?.toFixed(8)}
╚═══════════════════════════════════════════════════════════╝
`);

      // 🚨 EXPERT: Record trade in circuit breaker
      if (global.bot && global.bot.circuitBreaker) {
        global.bot.circuitBreaker.recordTrade(profitUSD, position.size);
      }

      // Execute opposite trade
      const exitAction = position.side === 'buy' ? 'sell' : 'buy';

      if (global.shadowMode?.isActive) {
        await global.shadowMode.executeShadowTrade({
          action: exitAction,
          pair: 'USDT/BNB',
          amount: position.size,
          targetPrice: currentPrice,
          confidence: 0.95,
          reasoning: `Exit ${reason}: ${position.strategy}`
        });
      } else {
        // Live trade execution
        await this.executeTradingDecision({
          action: exitAction,
          position_size: position.size,
          confidence: 0.95,
          parameters: { currentPrice }
        }, 'position_exit');
      }

      // ═══════════════════════════════════════════════════════════
      // UPDATE EXIT STATISTICS (Phase 1)
      // ═══════════════════════════════════════════════════════════
      this.exitStats.total++;
      this.exitStats.byReason[reason] = (this.exitStats.byReason[reason] || 0) + 1;
      this.exitStats.totalProfit += profit;
      this.exitStats.avgProfit = this.exitStats.totalProfit / this.exitStats.total;
      this.exitStats.lastExitTime = Date.now();

      // Log stats every 5 exits
      if (this.exitStats.total % 5 === 0 || this.exitStats.total === 1) {
        logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           📊 EXIT STATISTICS (${this.exitStats.total} exits)              ║
╠═══════════════════════════════════════════════════════════╣
║  BY REASON:
║  ├── Take Profit: ${this.exitStats.byReason.take_profit}
║  ├── Stop Loss: ${this.exitStats.byReason.stop_loss}
║  ├── Max Hold Time: ${this.exitStats.byReason.max_hold_time_exceeded}
║  └── Emergency: ${this.exitStats.byReason.emergency_time}
║
║  PERFORMANCE:
║  ├── Total Profit: ${(this.exitStats.totalProfit * 100).toFixed(2)}%
║  ├── Avg Profit: ${(this.exitStats.avgProfit * 100).toFixed(3)}%
║  └── Win Rate: ${this.exitStats.total > 0 ? ((this.exitStats.byReason.take_profit / this.exitStats.total * 100).toFixed(1)) : '0'}%
╚═══════════════════════════════════════════════════════════╝
        `);
      }

      // Remove from active positions
      this.activePositions.delete(position.id);
      logger.info(`✅ Position ${position.id} removed from tracking (Total exits: ${this.exitStats.total})`);

      // Record in history
      if (!this.positionHistory) this.positionHistory = [];
      this.positionHistory.push({
        ...position,
        exitPrice: currentPrice,
        exitTime: Date.now(),
        profit: profitUSD,
        profitPercent: profit * 100,
        exitReason: reason,
        holdDuration: Date.now() - position.entryTime
      });

      // Update strategy performance
      await this.recordStrategyPerformance(position.strategy, {
        profit: profitUSD,
        success: profitUSD > 0
      });

      return { success: true, profit: profitUSD };

    } catch (error) {
      logger.error(`❌ Error executing exit: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 🚨 CRITICAL FIX: Add calculateZScore method for position monitoring
  calculateZScore(currentPrice) {
    const priceHistory = this.priceHistoryManager.getHistory();
    if (priceHistory.length < 50) return 0;

    const last50 = priceHistory.slice(-50).map(p => p.price);
    const mean = last50.reduce((a, b) => a + b) / last50.length;
    const variance = last50.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / last50.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : (currentPrice - mean) / stdDev;
  }

  // 🚀 CRITICAL FIX #1: Transaction Cost Modeling (KILLING YOUR PROFITS)
  calculateNetProfit(grossProfit, tradeSize) {
    // BSC/PancakeSwap realistic costs
    const PANCAKESWAP_FEE = 0.0025; // 0.25%
    const GAS_COST_BSC = 0.50; // ~$0.50 per swap on BSC
    const SLIPPAGE_ESTIMATE = 0.001; // 0.1% slippage for liquid pairs

    const tradingFees = tradeSize * PANCAKESWAP_FEE;
    const slippageCost = tradeSize * SLIPPAGE_ESTIMATE;
    const totalCosts = tradingFees + slippageCost + GAS_COST_BSC;

    const netProfit = grossProfit - totalCosts;

    logger.debug(`💰 Cost breakdown: Gross $${grossProfit.toFixed(2)} - Fees $${tradingFees.toFixed(2)} - Slippage $${slippageCost.toFixed(2)} - Gas $${GAS_COST_BSC} = Net $${netProfit.toFixed(2)}`);

    return netProfit;
  }

  // 🚀 CRITICAL FIX #4: Volatility-Based Strategy Selection (HUGE EDGE)
  detectMarketRegime(priceHistory) {
    if (priceHistory.length < 50) {
      return { regime: 'ranging', volatility: 0.2, trendStrength: 0, optimalStrategy: 'mean_reversion' };
    }

    const prices = priceHistory.map(p => p.price);
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Calculate realized volatility (20-period)
    const recentReturns = returns.slice(-20);
    const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

    // Calculate trend strength
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const trendStrength = Math.abs((sma20 - sma50) / sma50);

    // Regime classification
    let regime = 'ranging';
    let optimalStrategy = 'mean_reversion';

    if (volatility > 0.40) { // High vol (>40% annualized)
      regime = 'high_volatility';
      optimalStrategy = 'momentum'; // Trend follow in high vol
    } else if (volatility < 0.15) { // Low vol (<15% annualized)
      regime = 'low_volatility';
      optimalStrategy = 'ranging'; // Range trade in low vol
    } else if (trendStrength > 0.03) { // Strong trend (>3%)
      regime = 'trending';
      optimalStrategy = 'momentum';
    }

    logger.info(`📊 Market Regime: ${regime} | Vol: ${(volatility * 100).toFixed(1)}% | Trend: ${(trendStrength * 100).toFixed(2)}% | Strategy: ${optimalStrategy}`);

    return { regime, volatility, trendStrength, optimalStrategy };
  }

  // 🚨 CRITICAL FIX: Add updateStrategyPerformance method
  async updateStrategyPerformance(strategy, isWin) {
    try {
      // Update strategy performance tracking
      if (!this.strategyPerformance) {
        this.strategyPerformance = new Map();
      }

      if (!this.strategyPerformance.has(strategy)) {
        this.strategyPerformance.set(strategy, {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          totalProfit: 0
        });
      }

      const perf = this.strategyPerformance.get(strategy);
      perf.totalTrades++;
      if (isWin) {
        perf.wins++;
      } else {
        perf.losses++;
      }

      const winRate = (perf.wins / perf.totalTrades) * 100;
      logger.info(`${strategy} performance: ${winRate.toFixed(1)}% win rate, ${perf.totalTrades} total trades`);

    } catch (error) {
      logger.error('Error updating strategy performance:', error);
    }
  }

  // 🚨 CRITICAL FIX: Add missing recordStrategyPerformance method
  async recordStrategyPerformance(strategy, result) {
    try {
      const { StrategyPerformance } = require('../database/models');

      await StrategyPerformance.create({
        strategy: strategy,
        profit: result.profit || 0,
        success: result.success || false,
        timestamp: new Date()
      });

      logger.debug(`Strategy performance recorded: ${strategy} - ${result.success ? 'WIN' : 'LOSS'} - $${result.profit?.toFixed(2) || 0}`);
    } catch (error) {
      logger.debug(`Strategy performance tracking skipped: ${error.message}`);
    }
  }

  /**
   * Calculate market volatility for dynamic take profit
   * @param {Array} priceHistory - Recent price history
   * @returns {number} Volatility (0-1 scale)
   */
  calculateVolatility(priceHistory) {
    // 🔧 FIX: Validate input and provide sensible defaults
    if (!priceHistory || !Array.isArray(priceHistory)) {
      logger.warn('⚠️ Invalid priceHistory for volatility calculation, using default 1.5%');
      return 0.015; // Default medium volatility
    }

    if (priceHistory.length < 20) {
      logger.warn(`⚠️ Insufficient data (${priceHistory.length} points), using default 1.5%`);
      return 0.015;
    }

    const prices = priceHistory.slice(-20).map(p => {
      // Handle both object and numeric formats
      if (typeof p === 'object' && p.price !== undefined) {
        return p.price;
      } else if (typeof p === 'number') {
        return p;
      } else {
        logger.warn(`⚠️ Invalid price data point: ${JSON.stringify(p)}`);
        return null;
      }
    }).filter(p => p !== null && !isNaN(p));

    if (prices.length < 10) {
      logger.warn(`⚠️ Too many invalid prices, using default volatility`);
      return 0.015;
    }

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
      if (!isNaN(ret) && isFinite(ret)) {
        returns.push(ret);
      }
    }

    if (returns.length === 0) {
      logger.warn('⚠️ No valid returns calculated, using default volatility');
      return 0.015;
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // 🔧 FIX: Validate result and cap at realistic max
    if (isNaN(volatility) || !isFinite(volatility)) {
      logger.warn('⚠️ Invalid volatility calculation, using default');
      return 0.015;
    }

    const cappedVolatility = Math.min(Math.max(volatility, 0.005), 0.05); // 0.5% to 5% range

    logger.debug(`📊 Volatility: ${(volatility * 100).toFixed(2)}% (capped: ${(cappedVolatility * 100).toFixed(2)}%)`);

    return cappedVolatility;
  }

  /**
   * Calculate dynamic take profit based on market volatility
   * @param {number} currentPrice - Current market price
   * @param {string} side - 'buy' or 'sell'
   * @param {number} volatility - Market volatility
   * @returns {number} Take profit price
   */
  calculateDynamicTakeProfit(currentPrice, side, volatility) {
    let tpPercent;

    // 🔧 FIX: REDUCED TP thresholds to match realistic BSC market conditions
    // ═══════════════════════════════════════════════════════════
    // PHASE 1: Fixed TP for all volatility levels
    // Simplified: 0.8% for ALL conditions (validate exit works)
    // ═══════════════════════════════════════════════════════════
    tpPercent = FIXED_TP_PERCENT; // 0.8% fixed for Phase 1

    // Phase 1: Comment out dynamic TP (restore in Phase 2)
    /*
    if (volatility < 0.015) {
      tpPercent = 0.008;  // Low vol
    } else if (volatility < 0.025) {
      tpPercent = 0.010;  // Medium vol
    } else {
      tpPercent = 0.015;  // High vol
    }
    */

    const tp = side === 'buy'
      ? currentPrice * (1 + tpPercent)
      : currentPrice * (1 - tpPercent);

    logger.info(`🎯 Dynamic TP: ${(tpPercent * 100).toFixed(1)}% (vol: ${(volatility * 100).toFixed(2)}%)`);

    return tp;
  }

  async makeTradingDecision(strategy, marketData, researchData) {
    try {
      logger.info(`🎯 Making trading decision using ${strategy} strategy...`);

      const analysis = this.marketContext || await this.analyzeMarket(marketData, researchData);

      // Enhance market data with volume information
      const enhancedMarketData = await this.enhanceMarketDataWithVolume(marketData);

      // 🚀 CRITICAL FIX #2: Stale Price Protection (PREVENTS BAD FILLS)
      const priceHistory = this.priceHistoryManager.getHistory();
      if (priceHistory.length > 0) {
        const latestPrice = priceHistory[priceHistory.length - 1];
        const priceAge = Date.now() - latestPrice.timestamp;

        if (priceAge > this.config.priceStalenessMs) {
          logger.warn(`⚠️ Stale price data: ${(priceAge / 1000).toFixed(0)}s old`);
          return {
            action: 'hold',
            confidence: 0,
            reasoning: `Stale price: ${(priceAge / 1000).toFixed(0)}s old, max ${this.config.priceStalenessMs / 1000}s`
          };
        }

        // Check for price anomalies (flash crashes/pumps)
        if (priceHistory.length >= 3) {
          const recentPrices = priceHistory.slice(-3);
          const priceChanges = recentPrices.map((p, i) =>
            i > 0 ? Math.abs((p.price - recentPrices[i - 1].price) / recentPrices[i - 1].price) : 0
          );
          const maxChange = Math.max(...priceChanges);

          if (maxChange > 0.10) { // 10% move in single candle
            logger.warn(`⚠️ Anomalous price movement: ${(maxChange * 100).toFixed(1)}%`);
            return {
              action: 'hold',
              confidence: 0,
              reasoning: 'Extreme price volatility detected, waiting for stability'
            };
          }
        }
      }

      // 🚀 CRITICAL FIX #4: Auto-select optimal strategy based on market regime
      const marketRegime = this.detectMarketRegime(priceHistory);
      this.currentStrategy = marketRegime.optimalStrategy;
      logger.debug(`🎯 Auto-selected strategy: ${this.currentStrategy} (was: ${strategy})`);

      // Get AI strategy recommendation
      const aiRecommendation = await this._getAIStrategySelection(
        enhancedMarketData,
        Object.keys(this.strategies)
      );

      // Use AI-recommended strategy if confidence > 0.7
      if (aiRecommendation && aiRecommendation.confidence > 0.7) {
        strategy = aiRecommendation.strategy;
        logger.info(`✨ AI override: Using ${strategy} (${aiRecommendation.reasoning})`);
      }

      if (!this.strategies[strategy]) {
        throw new Error(`Unknown strategy: ${strategy}`);
      }

      const decision = await this.strategies[strategy](analysis, enhancedMarketData, researchData);

      // Apply AI risk adjustment
      if (aiRecommendation && aiRecommendation.riskLevel === 'high') {
        decision.confidence *= 0.8; // Reduce confidence in high-risk conditions
        decision.position_size *= 0.7; // Reduce position size
        logger.info(`⚠️ AI risk adjustment: Reduced confidence and position size`);
      }

      // 🚨 CRITICAL FIX: Track position when trade is executed
      if (decision.action !== 'hold' && decision.position_size > 0) {
        const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Calculate stop-loss (2% for buys, 2% for sells)
        const stopLoss = decision.action === 'buy'
          ? decision.parameters.currentPrice * 0.98  // 2% stop for buys
          : decision.parameters.currentPrice * 1.02; // 2% stop for sells

        // 🔧 FIX 3: Ensure side is ALWAYS set and valid
        const side = decision.action && (decision.action === 'buy' || decision.action === 'sell')
          ? decision.action
          : 'buy'; // Default to 'buy' if undefined

        if (!decision.action || (decision.action !== 'buy' && decision.action !== 'sell')) {
          logger.warn(`⚠️ Invalid decision.action: ${decision.action}, defaulting to 'buy'`);
        }

        // 🔧 FIX: Calculate and store adaptive TP at position creation
        const entryPrice = decision.parameters.currentPrice;

        // Calculate volatility once at position creation
        const priceHistory = this.priceHistoryManager
          ? this.priceHistoryManager.getHistory()
          : [];
        const volatility = this.calculateVolatility(priceHistory.slice(-50));

        // Calculate adaptive TP based on volatility
        // ═══════════════════════════════════════════════════════════
        // PHASE 1: Fixed TP for all volatility levels
        // Simplified: 0.8% for ALL conditions (validate exit works)
        // Phase 2: Will restore dynamic TP after validation
        // ═══════════════════════════════════════════════════════════
        let tpPercent = FIXED_TP_PERCENT; // 0.8% fixed for Phase 1

        // Phase 1: Comment out dynamic TP (restore in Phase 2)
        /*
        if (volatility < 0.015) {
          tpPercent = FIXED_TP_PERCENT; // Low vol
        } else if (volatility < 0.025) {
          tpPercent = 0.010; // Medium vol
        } else {
          tpPercent = 0.015; // High vol
        }
        */

        const takeProfit = side === 'buy'
          ? entryPrice * (1 + tpPercent)
          : entryPrice * (1 - tpPercent);

        // 🔍 DEBUG LOGGING FOR TP CALCULATION
        logger.info(`
📊 TP SET AT POSITION ENTRY (${positionId}):
  Entry Price: ${entryPrice.toFixed(11)}
  TP Percent: ${(tpPercent * 100).toFixed(2)}%
  Side: ${side}

  BUY Formula: ${entryPrice.toFixed(8)} × (1 + ${tpPercent}) = ${(entryPrice * (1 + tpPercent)).toFixed(11)}
  SELL Formula: ${entryPrice.toFixed(8)} × (1 - ${tpPercent}) = ${(entryPrice * (1 - tpPercent)).toFixed(11)}

  CALCULATED TP: ${takeProfit.toFixed(11)}
  CALCULATED SL: ${stopLoss.toFixed(11)}
`);

        const position = {
          id: positionId,
          side: side, // FIX 3: ALWAYS valid side ('buy' or 'sell')
          entryPrice: entryPrice,
          size: decision.position_size,
          confidence: decision.confidence,
          strategy: strategy,
          timestamp: Date.now(), // FIX: Use 'timestamp' instead of 'entryTime' for consistency
          stopLoss: stopLoss,
          takeProfit: takeProfit, // ✅ Always defined
          takeProfitPercent: tpPercent, // Store the % for reference
          volatilityAtEntry: volatility, // Store for analysis
          entryZScore: decision.parameters.zScore || 0,
          currentZScore: decision.parameters.zScore || 0,
          pair: 'USDT/BNB' // 🚨 FIX: Add explicit pair
        };

        // ✅ VALIDATE POSITION BEFORE STORING
        if (!position.side || (position.side !== 'buy' && position.side !== 'sell')) {
          logger.error(`❌ CRITICAL: Invalid position side: "${position.side}"`);
          logger.error(`Position: ${JSON.stringify(position, null, 2)}`);
          throw new Error(`Cannot create position with invalid side: ${position.side}`);
        }

        if (!position.takeProfit) {
          logger.error(`❌ Position ${position.id} created without take profit!`);
          throw new Error(`Cannot create position without take profit`);
        }

        logger.info(`✅ Position validated: ${position.id}, side: ${position.side}, TP: ${position.takeProfit.toFixed(8)}`);

        this.activePositions.set(positionId, position);
        logger.info(`📊 Position tracked: ${side.toUpperCase()} $${position.size.toFixed(0)} @ ${position.entryPrice.toFixed(6)} | Stop: ${position.stopLoss.toFixed(6)} | TP: ${position.takeProfit.toFixed(6)} (${(tpPercent * 100).toFixed(2)}%)`);
      }

      // Log the decision
      logger.info('Trading decision made:', {
        strategy,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning
      });

      return decision;
    } catch (error) {
      logger.error('Error making trading decision:', error);
      throw error;
    }
  }

  // 🔥 FIX #3: Detect if market is actually ranging before trading
  isMarketRanging(priceHistory) {
    if (!priceHistory || priceHistory.length < 100) {
      return {
        isRanging: false,
        reason: 'Insufficient price history (need 100+ data points)'
      };
    }

    const last100 = priceHistory.slice(-100).map(p => p.price);
    const high = Math.max(...last100);
    const low = Math.min(...last100);
    const mean = last100.reduce((a, b) => a + b) / last100.length;
    const range = (high - low) / mean;

    // Support smaller ranges with tiered confidence
    if (range < 0.0001) { // Only reject VERY tight ranges (0.01%)
      return {
        isRanging: false,
        reason: `Range too tight (${(range * 100).toFixed(2)}% < 0.01%) - likely flat or trending`
      };
    }

    if (range > 0.06) {
      return {
        isRanging: false,
        reason: `Range too wide (${(range * 100).toFixed(1)}% > 6%) - unstable, not ranging`
      };
    }

    // Check for trend - compare first half vs second half
    const firstHalf = last100.slice(0, 50);
    const secondHalf = last100.slice(50);
    const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    const trendStrength = Math.abs(secondAvg - firstAvg) / firstAvg;

    if (trendStrength > 0.03) {
      const direction = secondAvg > firstAvg ? 'uptrend' : 'downtrend';
      return {
        isRanging: false,
        reason: `Strong ${direction} detected (${(trendStrength * 100).toFixed(1)}% move) - not ranging`
      };
    }

    return {
      isRanging: true,
      upperBound: high,
      lowerBound: low,
      midpoint: mean,
      rangePercent: range * 100
    };
  }

  async rangingStrategy(analysis, marketData, researchData) {
    try {
      // 🔥 Safety check: Price staleness
      if (marketData?.priceTimestamp && Date.now() - marketData.priceTimestamp > this.config.priceStalenessMs) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `📊 Price data too old (>${this.config.priceStalenessMs / 1000}s)`,
          position_size: 0,
          parameters: {}
        };
      }

      // 🔥 FIX #2: Check cooldown to prevent spam trades
      const timeSinceLastTrade = Date.now() - this.lastTradeTime;
      if (timeSinceLastTrade < this.MIN_TIME_BETWEEN_TRADES) {
        const minutesRemaining = Math.floor((this.MIN_TIME_BETWEEN_TRADES - timeSinceLastTrade) / 60000);
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `⏱️ Cooldown active: ${minutesRemaining} minutes remaining`,
          position_size: 0,
          parameters: {}
        };
      }

      // 🔥 FIX #3: Use persistent price history instead of marketData
      const priceHistory = this.priceHistoryManager ? this.priceHistoryManager.getHistory() : (marketData?.priceHistory || []);

      // 🔥 Safety check: Range detection warm-up
      if (priceHistory.length < this.config.minPriceHistory) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `📊 Building price history (${priceHistory.length}/${this.config.minPriceHistory} data points) - need more data for range detection`,
          position_size: 0,
          parameters: {}
        };
      }

      const rangeCheck = this.isMarketRanging(priceHistory);

      if (!rangeCheck.isRanging) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `📊 ${rangeCheck.reason}`,
          position_size: 0,
          parameters: {}
        };
      }

      const { upperBound, lowerBound, midpoint } = rangeCheck;
      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();

      // 🔥 FIX #4: Only trade near bounds (within configured % of range)
      const rangeSize = upperBound - lowerBound;

      // 🚨 CRITICAL FIX: Calculate distance as percentage of range, not range size
      const upperDistance = (upperBound - currentPrice) / rangeSize;
      const lowerDistance = (currentPrice - lowerBound) / rangeSize;
      const thresholdPercent = this.config.boundsThreshold; // 0.05 = 5%

      // 🔥 FIX #7: Get balances from shadow mode if active
      let usdtBalance, bnbBalance;

      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
        logger.info(`📊 Using virtual balances: ${usdtBalance.toFixed(2)} USDT, ${bnbBalance.toFixed(6)} BNB`);
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      const bnbValueInUsdt = bnbBalance * currentPrice;

      // 🚨 CRITICAL FIX: SELL at upper bound (within 5% of range)
      if (upperDistance <= thresholdPercent) {
        if (bnbBalance < 1.0) { // Check actual BNB balance, not USD value
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: '🔴 At upper bound but insufficient BNB to sell',
            position_size: 0,
            parameters: { upperBound, lowerBound, currentPrice }
          };
        }

        // 🚨 CRITICAL FIX: Calculate expected profit from selling high and buying low later
        const sellPrice = currentPrice;
        const buyBackPrice = lowerBound + (rangeSize * 0.5); // Buy back at middle of range
        const profitPerUnit = sellPrice - buyBackPrice;

        // Calculate volatility for adaptive confidence
        const volatility = this.calculateVolatility(priceHistory.slice(-50));
        const rangeVolatilityRatio = rangeSize / volatility;

        // Position-based confidence (closer to bounds = higher confidence)
        const distanceFromBound = upperDistance;

        // Base confidence from range quality
        let baseConfidence;
        if (rangeVolatilityRatio < 2) {
          baseConfidence = 0.55; // Tight range relative to volatility
        } else if (rangeVolatilityRatio < 4) {
          baseConfidence = 0.70; // Good range quality
        } else {
          baseConfidence = 0.85; // Excellent range quality
        }

        // Adjust for position in range (closer to bounds = more confident)
        const positionMultiplier = Math.max(0.6, 1.2 - (distanceFromBound * 2));
        const confidence = Math.min(0.90, baseConfidence * positionMultiplier);

        logger.info(`💪 SELL confidence calc: base=${(baseConfidence * 100).toFixed(0)}%, pos=${(positionMultiplier * 100).toFixed(0)}%, dist=${(distanceFromBound * 100).toFixed(0)}%, vol=${(volatility * 100).toFixed(1)}%, final=${(confidence * 100).toFixed(0)}%`);

        const positionSizeUSD = await this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);
        const unitsToSell = positionSizeUSD / sellPrice;
        const grossProfit = unitsToSell * profitPerUnit;
        const netProfit = this.calculateNetProfit(grossProfit, positionSizeUSD);

        if (netProfit < this.config.minProfit) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `🔴 At upper bound but profit too low: $${netProfit.toFixed(2)} < $${this.config.minProfit}`,
            position_size: 0,
            parameters: { upperBound, lowerBound, currentPrice, expectedProfit: netProfit }
          };
        }

        // 🔥 FIX: Don't update cooldown here - only after confirmed execution in shadow mode

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `🟢 SELL at top: price ${currentPrice.toFixed(6)} near upper ${upperBound.toFixed(6)}, expected profit: $${netProfit.toFixed(2)} (range: ${(rangeSize * 100).toFixed(2)}%)`,
          position_size: positionSizeUSD, // Keep in USD - conversion happens in executeTradingDecision
          parameters: {
            upperBound,
            lowerBound,
            currentPrice,
            expectedProfit: netProfit,
            price: currentPrice
          }
        };
      }

      // 🚨 CRITICAL FIX: BUY at lower bound (within 5% of range)
      if (lowerDistance <= thresholdPercent) {
        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: '🔴 At lower bound but insufficient USDT to buy',
            position_size: 0,
            parameters: { upperBound, lowerBound, currentPrice }
          };
        }

        // Calculate expected profit from buying low and selling high later
        const expectedRise = (upperBound - currentPrice) / currentPrice;

        // Calculate volatility for adaptive confidence
        const volatility = this.calculateVolatility(priceHistory.slice(-50));
        const rangeVolatilityRatio = rangeSize / volatility;

        // Position-based confidence (closer to bounds = higher confidence)
        const distanceFromBound = lowerDistance;

        // Base confidence from range quality
        let baseConfidence;
        if (rangeVolatilityRatio < 2) {
          baseConfidence = 0.55; // Tight range relative to volatility
        } else if (rangeVolatilityRatio < 4) {
          baseConfidence = 0.70; // Good range quality
        } else {
          baseConfidence = 0.85; // Excellent range quality
        }

        // Adjust for position in range (closer to bounds = more confident)
        const positionMultiplier = Math.max(0.6, 1.2 - (distanceFromBound * 2));
        const confidence = Math.min(0.90, baseConfidence * positionMultiplier);

        logger.info(`💪 BUY confidence calc: base=${(baseConfidence * 100).toFixed(0)}%, pos=${(positionMultiplier * 100).toFixed(0)}%, dist=${(distanceFromBound * 100).toFixed(0)}%, vol=${(volatility * 100).toFixed(1)}%, final=${(confidence * 100).toFixed(0)}%`);

        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);
        const grossProfit = positionSize * expectedRise;
        const netProfit = this.calculateNetProfit(grossProfit, positionSize);

        if (netProfit < this.config.minProfit) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `🔴 At lower bound but profit too low: $${netProfit.toFixed(2)} < $${this.config.minProfit}`,
            position_size: 0,
            parameters: { upperBound, lowerBound, currentPrice, expectedProfit: netProfit }
          };
        }

        // 🔥 FIX: Don't update cooldown here - only after confirmed execution in shadow mode

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `🟢 BUY at bottom: price ${currentPrice.toFixed(6)} near lower ${lowerBound.toFixed(6)}, expected profit: $${netProfit.toFixed(2)} (range: ${(rangeSize * 100).toFixed(2)}%)`,
          position_size: positionSize, // USDT amount
          parameters: {
            upperBound,
            lowerBound,
            currentPrice,
            expectedProfit: netProfit,
            price: currentPrice
          }
        };
      }

      // 🚨 CRITICAL FIX: In middle of range - HOLD
      const distToUpperPercent = (upperDistance * 100).toFixed(1);
      const distToLowerPercent = (lowerDistance * 100).toFixed(1);
      const boundsThresholdPercent = (thresholdPercent * 100).toFixed(1);

      return {
        action: 'hold',
        confidence: 0.5,
        reasoning: `⏸️ Price ${currentPrice.toFixed(6)} in middle of range [${lowerBound.toFixed(6)}, ${upperBound.toFixed(6)}] - ${distToUpperPercent}% to upper, ${distToLowerPercent}% to lower (need within ${boundsThresholdPercent}% of bounds)`,
        position_size: 0,
        parameters: {
          upperBound,
          lowerBound,
          currentPrice,
          midpoint,
          upperDistance: distToUpperPercent,
          lowerDistance: distToLowerPercent,
          threshold: boundsThresholdPercent,
          rangeSize: rangeSize
        }
      };
    } catch (error) {
      logger.error('Error in ranging strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Error: ${error.message}`,
        position_size: 0,
        parameters: { error: error.message }
      };
    }
  }

  async momentumStrategy(analysis, marketData, researchData) {
    try {
      const { RSI, MACD, EMA } = require('technicalindicators');

      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = this.priceHistoryManager.getHistory();

      // Need at least 50 data points for reliable indicators
      if (priceHistory.length < 50) {
        return {
          action: 'hold',
          confidence: 0.3,
          reasoning: `📊 Building price history (${priceHistory.length}/50 data points) - need more data for momentum indicators`,
          parameters: {},
          position_size: 0
        };
      }

      // Extract closing prices for indicator calculations
      const closePrices = priceHistory.map(p => p.price);

      // Calculate RSI (14 period)
      const rsiValues = RSI.calculate({
        values: closePrices,
        period: 14
      });
      const currentRSI = rsiValues[rsiValues.length - 1];

      // Calculate MACD (12, 26, 9)
      const macdValues = MACD.calculate({
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      const currentMACD = macdValues[macdValues.length - 1];
      const previousMACD = macdValues[macdValues.length - 2];

      // Calculate EMAs (20 and 50 period)
      const ema20Values = EMA.calculate({
        values: closePrices,
        period: 20
      });
      const ema50Values = EMA.calculate({
        values: closePrices,
        period: 50
      });
      const currentEMA20 = ema20Values[ema20Values.length - 1];
      const currentEMA50 = ema50Values[ema50Values.length - 1];

      // Calculate trend strength (price distance from EMA20)
      const trendStrength = ((currentPrice - currentEMA20) / currentEMA20) * 100;

      // Detect MACD crossovers
      const macdBullishCross = currentMACD.MACD > currentMACD.signal &&
        previousMACD.MACD <= previousMACD.signal;
      const macdBearishCross = currentMACD.MACD < currentMACD.signal &&
        previousMACD.MACD >= previousMACD.signal;

      // Trend detection
      const isUptrend = currentPrice > currentEMA20 && currentEMA20 > currentEMA50;
      const isDowntrend = currentPrice < currentEMA20 && currentEMA20 < currentEMA50;
      const isSideways = Math.abs(trendStrength) < 1.0; // Within 1% of EMA20

      // RSI conditions
      const isOversold = currentRSI < 30;
      const isOverbought = currentRSI > 70;
      const isNeutralRSI = currentRSI >= 40 && currentRSI <= 60;

      // Get balances for position sizing
      const usdtBalance = await this.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.pancakeSwap.getBNBBalance();

      let action = 'hold';
      let confidence = 0.5;
      let reasoning = '';

      // TRADING LOGIC

      // Strong Buy Signal
      if (isUptrend && macdBullishCross && currentRSI > 40 && currentRSI < 70) {
        action = 'buy';
        confidence = 0.85;
        reasoning = `🚀 Strong uptrend detected: Price > EMA20 > EMA50, MACD bullish crossover, RSI ${currentRSI.toFixed(1)} (healthy range)`;
      }
      // Moderate Buy Signal
      else if (isUptrend && currentMACD.MACD > currentMACD.signal && !isOverbought) {
        action = 'buy';
        confidence = 0.70;
        reasoning = `📈 Uptrend continuation: Price above EMAs, MACD positive (${currentMACD.MACD.toFixed(6)}), RSI ${currentRSI.toFixed(1)}`;
      }
      // Oversold Bounce
      else if (isOversold && macdBullishCross) {
        action = 'buy';
        confidence = 0.75;
        reasoning = `💎 Oversold bounce: RSI ${currentRSI.toFixed(1)} (oversold), MACD turning bullish, potential reversal`;
      }
      // Strong Sell Signal
      else if ((isDowntrend && macdBearishCross) || isOverbought) {
        action = 'sell';
        confidence = 0.80;
        reasoning = isOverbought
          ? `⚠️ Overbought conditions: RSI ${currentRSI.toFixed(1)} (>70), taking profits`
          : `📉 Downtrend confirmed: Price < EMA20 < EMA50, MACD bearish crossover`;
      }
      // Moderate Sell Signal
      else if (isDowntrend && currentMACD.MACD < 0) {
        action = 'sell';
        confidence = 0.65;
        reasoning = `🔻 Downtrend active: Price below EMAs, MACD negative (${currentMACD.MACD.toFixed(6)}), RSI ${currentRSI.toFixed(1)}`;
      }
      // Sideways - Hold
      else if (isSideways || isNeutralRSI) {
        action = 'hold';
        confidence = 0.50;
        reasoning = `⏸️ No clear trend: Price near EMA20 (${trendStrength.toFixed(2)}%), RSI neutral (${currentRSI.toFixed(1)}), waiting for direction`;
      }
      // Default - Hold
      else {
        action = 'hold';
        confidence = 0.50;
        reasoning = `📊 Mixed signals: Uptrend=${isUptrend}, RSI=${currentRSI.toFixed(1)}, MACD=${currentMACD.MACD > 0 ? 'positive' : 'negative'}, waiting for clearer setup`;
      }

      return {
        action,
        confidence,
        reasoning,
        parameters: {
          currentPrice,
          rsi: currentRSI,
          macd: currentMACD.MACD,
          macdSignal: currentMACD.signal,
          macdHistogram: currentMACD.histogram,
          ema20: currentEMA20,
          ema50: currentEMA50,
          trendStrength: trendStrength,
          isUptrend,
          isDowntrend,
          isSideways
        },
        position_size: await this.calculatePositionSize(action, confidence, usdtBalance, bnbBalance, currentPrice)
      };

    } catch (error) {
      this.logger.error('Error in momentum strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `❌ Error calculating momentum indicators: ${error.message}`,
        parameters: {},
        position_size: 0
      };
    }
  }

  async breakoutStrategy(analysis, marketData, researchData) {
    try {
      logger.info('Executing breakout strategy...');

      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = this.priceHistoryManager ? this.priceHistoryManager.getHistory() : (marketData?.priceHistory || []);

      if (priceHistory.length < this.config.minPriceHistory) {
        return {
          action: 'hold',
          confidence: 0.3,
          reasoning: `Building price history (${priceHistory.length}/${this.config.minPriceHistory}) - need more data for breakout detection`,
          position_size: 0,
          parameters: {}
        };
      }

      const levels = this._calculateSupportResistanceLevels(priceHistory);
      const breakoutAnalysis = this._detectBreakout(currentPrice, levels, priceHistory);
      const volumeConfirmed = await this._confirmBreakoutWithVolume(breakoutAnalysis, marketData);

      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      const bnbValueInUsdt = bnbBalance * currentPrice;

      if (breakoutAnalysis.type === 'bullish' && volumeConfirmed) {
        const confidence = Math.min(0.90, 0.65 + (breakoutAnalysis.strength / 100) * 0.25);
        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Bullish breakout detected but insufficient USDT balance',
            position_size: 0,
            parameters: { ...levels, currentPrice, breakout: breakoutAnalysis }
          };
        }

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `Bullish breakout: Price broke above resistance ${levels.resistance.toFixed(6)}, strength ${breakoutAnalysis.strength}/100`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            resistance: levels.resistance,
            support: levels.support,
            breakoutLevel: levels.resistance,
            stopLoss: levels.support,
            target: levels.resistance * 1.05,
            strength: breakoutAnalysis.strength,
            price: currentPrice
          }
        };
      }
      else if (breakoutAnalysis.type === 'bearish' && volumeConfirmed) {
        const confidence = Math.min(0.90, 0.65 + (breakoutAnalysis.strength / 100) * 0.25);
        const sellAmount = await this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);
        const positionSize = sellAmount;

        if (bnbValueInUsdt < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Bearish breakout detected but insufficient BNB balance',
            position_size: 0,
            parameters: { ...levels, currentPrice, breakout: breakoutAnalysis }
          };
        }

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `Bearish breakout: Price broke below support ${levels.support.toFixed(6)}, strength ${breakoutAnalysis.strength}/100`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            resistance: levels.resistance,
            support: levels.support,
            breakoutLevel: levels.support,
            stopLoss: levels.resistance,
            target: levels.support * 0.95,
            strength: breakoutAnalysis.strength,
            price: currentPrice
          }
        };
      }
      else if (breakoutAnalysis.type === 'building') {
        return {
          action: 'hold',
          confidence: 0.65,
          reasoning: `Consolidation forming: Price between ${levels.support.toFixed(6)} - ${levels.resistance.toFixed(6)}, watching for breakout`,
          position_size: 0,
          parameters: { ...levels, currentPrice, breakout: breakoutAnalysis }
        };
      }
      else {
        const distToResistance = ((levels.resistance - currentPrice) / currentPrice * 100).toFixed(2);
        const distToSupport = ((currentPrice - levels.support) / currentPrice * 100).toFixed(2);

        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `No breakout: Price ${currentPrice.toFixed(6)} within range, ${distToSupport}% from support, ${distToResistance}% from resistance`,
          position_size: 0,
          parameters: { ...levels, currentPrice, distToResistance, distToSupport }
        };
      }

    } catch (error) {
      logger.error('Error in breakout strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Error in breakout strategy: ${error.message}`,
        parameters: {},
        position_size: 0
      };
    }
  }

  _calculateSupportResistanceLevels(priceHistory) {
    const last50 = priceHistory.slice(-50).map(p => p.price);
    const last20 = priceHistory.slice(-20).map(p => p.price);

    const high = Math.max(...last20);
    const low = Math.min(...last20);
    const close = last20[last20.length - 1];

    const pivot = (high + low + close) / 3;
    const resistance1 = (2 * pivot) - low;
    const support1 = (2 * pivot) - high;
    const resistance2 = pivot + (high - low);
    const support2 = pivot - (high - low);

    const mean = last50.reduce((a, b) => a + b) / last50.length;
    const variance = last50.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / last50.length;
    const volatility = (Math.sqrt(variance) / mean) * 100;

    return {
      resistance: resistance1,
      support: support1,
      resistance2: resistance2,
      support2: support2,
      pivot: pivot,
      high: high,
      low: low,
      range: high - low,
      rangePercent: ((high - low) / low) * 100,
      volatility: volatility
    };
  }

  _detectBreakout(currentPrice, levels, priceHistory) {
    const recentPrices = priceHistory.slice(-10).map(p => p.price);
    const last5Prices = priceHistory.slice(-5).map(p => p.price);

    const momentum = (last5Prices[last5Prices.length - 1] - last5Prices[0]) / last5Prices[0];
    const momentumPercent = momentum * 100;

    const breakoutThreshold = 0.0001; // TEMPORARILY LOWERED FOR TESTING (was 0.005, then 0.001)
    const consolidationThreshold = 0.001; // TEMPORARILY LOWERED FOR TESTING (was 0.02, then 0.005)

    const previousPrice = recentPrices[recentPrices.length - 2];

    if (currentPrice > levels.resistance * (1 + breakoutThreshold) &&
      previousPrice <= levels.resistance * (1 + breakoutThreshold)) {

      const breakoutDistance = (currentPrice - levels.resistance) / levels.resistance;
      const consistency = this._calculateMomentumConsistency(last5Prices);
      const strength = Math.min(100, (breakoutDistance * 500 + consistency * 50));

      return {
        type: 'bullish',
        strength: Math.round(strength),
        momentum: momentumPercent,
        consistency: consistency,
        volatility: levels.volatility
      };
    }

    if (currentPrice < levels.support * (1 - breakoutThreshold) &&
      previousPrice >= levels.support * (1 - breakoutThreshold)) {

      const breakoutDistance = (levels.support - currentPrice) / levels.support;
      const consistency = this._calculateMomentumConsistency(last5Prices);
      const strength = Math.min(100, (breakoutDistance * 500 + consistency * 50));

      return {
        type: 'bearish',
        strength: Math.round(strength),
        momentum: momentumPercent,
        consistency: consistency,
        volatility: levels.volatility
      };
    }

    if (levels.rangePercent < consolidationThreshold && levels.volatility < 2.0) {
      return {
        type: 'building',
        strength: 0,
        momentum: momentumPercent,
        consistency: 0,
        volatility: levels.volatility
      };
    }

    return {
      type: null,
      strength: 0,
      momentum: momentumPercent,
      consistency: 0,
      volatility: levels.volatility
    };
  }

  _calculateMomentumConsistency(prices) {
    let upMoves = 0;
    let downMoves = 0;

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) upMoves++;
      if (prices[i] < prices[i - 1]) downMoves++;
    }

    const total = prices.length - 1;
    if (total === 0) return 0;

    const consistency = (Math.max(upMoves, downMoves) / total) * 100;
    return Math.round(consistency);
  }

  async _confirmBreakoutWithVolume(breakoutAnalysis, marketData) {
    if (!breakoutAnalysis.type || breakoutAnalysis.type === 'building') {
      return true;
    }

    try {
      const volumeAnalysis = await this.analyzeVolume(marketData);

      // Skip volume confirmation if volume data is not available
      if (!volumeAnalysis || !volumeAnalysis.available) {
        logger.debug('Skipping volume confirmation - volume data not available');
        return true; // Don't block on unavailable data
      }

      const avgVolume = volumeAnalysis.average_24h;
      const currentVolume = volumeAnalysis.current;
      const volumeConfirmed = currentVolume > (avgVolume * 1.2);

      return volumeConfirmed;

    } catch (error) {
      logger.debug('Error in volume confirmation, allowing trade:', error.message);
      return true; // Don't block on errors
    }
  }

  // ============================================================================
  // VWAP STRATEGY - Volume Weighted Average Price
  // ============================================================================

  async vwapStrategy(analysis, marketData, researchData) {
    try {
      logger.info('Executing VWAP strategy...');

      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = marketData?.priceHistory || (this.priceHistoryManager ? this.priceHistoryManager.getPriceVolumeHistory() : []);

      if (priceHistory.length < 20) {
        return {
          action: 'hold',
          confidence: 0.3,
          reasoning: `Building price history (${priceHistory.length}/20) - need more data for VWAP calculation`,
          position_size: 0,
          parameters: {}
        };
      }

      // Execute VWAP strategy with enhanced volume analysis
      return await this._executeVWAPStrategy(marketData, currentPrice, priceHistory);

    } catch (error) {
      logger.error('Error in VWAP strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Error in VWAP strategy: ${error.message}`,
        parameters: {},
        position_size: 0
      };
    }
  }

  async _executeVWAPStrategy(marketData, currentPrice, priceHistory) {
    try {
      // Get balances
      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      // Calculate VWAP over last 20 periods
      const last20Periods = priceHistory.slice(-20);
      let totalVolume = 0;
      let totalVolumePrice = 0;

      last20Periods.forEach(point => {
        const volume = point.volume || 0;
        totalVolume += volume;
        totalVolumePrice += point.price * volume;
      });

      const vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : currentPrice;

      // Calculate price deviation from VWAP
      const priceDeviation = ((currentPrice - vwap) / vwap) * 100;

      // Calculate volume trend (recent 5 vs previous 5 period average)
      const recent5Volumes = last20Periods.slice(-5).map(p => p.volume || 0);
      const previous5Volumes = last20Periods.slice(-10, -5).map(p => p.volume || 0);

      const recent5Avg = recent5Volumes.reduce((a, b) => a + b, 0) / 5;
      const previous5Avg = previous5Volumes.reduce((a, b) => a + b, 0) / 5;

      // If volume data is missing/zero, use price volatility as proxy
      let volumeTrend;
      if (previous5Avg > 0) {
        volumeTrend = ((recent5Avg - previous5Avg) / previous5Avg) * 100;
      } else {
        // Fallback: use price volatility as volume proxy
        const recent5Prices = last20Periods.slice(-5).map(p => p.price);
        const previous5Prices = last20Periods.slice(-10, -5).map(p => p.price);
        const recentVolatility = Math.abs(recent5Prices[recent5Prices.length - 1] - recent5Prices[0]) / recent5Prices[0];
        const previousVolatility = Math.abs(previous5Prices[previous5Prices.length - 1] - previous5Prices[0]) / previous5Prices[0];
        volumeTrend = previousVolatility > 0 ? ((recentVolatility - previousVolatility) / previousVolatility) * 100 : 10; // Default 10% if no data
      }

      // VWAP Strategy Logic
      const bnbValueInUsdt = bnbBalance * currentPrice;

      // BUY: Price < VWAP by 0.15-2%, volume +20% above average, confidence 0.7-0.9
      if (priceDeviation < -0.15 && priceDeviation >= -2.0 && volumeTrend > 20) {
        const confidence = Math.min(0.9, 0.7 + Math.abs(priceDeviation) * 0.1);
        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `VWAP Buy signal but insufficient USDT balance (VWAP: ${vwap.toFixed(6)}, Deviation: ${priceDeviation.toFixed(2)}%, Volume Trend: ${volumeTrend.toFixed(1)}%)`,
            position_size: 0,
            parameters: { vwap, priceDeviation, volumeTrend, recent5Avg, previous5Avg }
          };
        }

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `VWAP Buy: Price ${priceDeviation.toFixed(2)}% below VWAP (${vwap.toFixed(6)}), Volume +${volumeTrend.toFixed(1)}% above average`,
          position_size: positionSize,
          parameters: { vwap, priceDeviation, volumeTrend, recent5Avg, previous5Avg, currentPrice }
        };
      }

      // SELL: Price > VWAP by 0.15-1.5%, volume above average, confidence 0.7-0.9
      else if (priceDeviation > 0.15 && priceDeviation <= 1.5 && volumeTrend > 0) {
        const confidence = Math.min(0.9, 0.7 + Math.abs(priceDeviation) * 0.1);
        const positionSize = this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);

        if (bnbValueInUsdt < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `VWAP Sell signal but insufficient BNB balance (VWAP: ${vwap.toFixed(6)}, Deviation: ${priceDeviation.toFixed(2)}%, Volume Trend: ${volumeTrend.toFixed(1)}%)`,
            position_size: 0,
            parameters: { vwap, priceDeviation, volumeTrend, recent5Avg, previous5Avg }
          };
        }

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `VWAP Sell: Price ${priceDeviation.toFixed(2)}% above VWAP (${vwap.toFixed(6)}), Volume +${volumeTrend.toFixed(1)}% above average`,
          position_size: positionSize,
          parameters: { vwap, priceDeviation, volumeTrend, recent5Avg, previous5Avg, currentPrice }
        };
      }

      // HOLD: Price within ±0.3% of VWAP or low volume, confidence 0.5
      else {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `VWAP Hold: Price ${priceDeviation.toFixed(2)}% from VWAP (${vwap.toFixed(6)}), Volume trend ${volumeTrend.toFixed(1)}% (within ±0.15% or low volume)`,
          position_size: 0,
          parameters: { vwap, priceDeviation, volumeTrend, recent5Avg, previous5Avg, currentPrice }
        };
      }

    } catch (error) {
      logger.error('Error in _executeVWAPStrategy:', error);
      return {
        action: 'hold',
        confidence: 0.3,
        reasoning: `VWAP strategy error: ${error.message}`,
        position_size: 0,
        parameters: {}
      };
    }
  }

  _calculateVWAP(priceHistory) {
    const last50 = priceHistory.slice(-50);
    let totalVolume = 0;
    let totalVolumePrice = 0;

    // Calculate VWAP using typical volume (simulated if not available)
    last50.forEach((point, index) => {
      const volume = point.volume || 1000; // Default volume if not available
      totalVolume += volume;
      totalVolumePrice += point.price * volume;
    });

    const vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : 0;

    // Calculate VWAP bands
    const prices = last50.map(p => p.price);
    const mean = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return {
      vwap: vwap,
      upperBand: vwap + (stdDev * 2),
      lowerBand: vwap - (stdDev * 2),
      stdDev: stdDev,
      totalVolume: totalVolume
    };
  }

  // ============================================================================
  // ICHIMOKU CLOUD STRATEGY - Comprehensive Technical Analysis
  // ============================================================================

  async ichimokuCloudStrategy(analysis, marketData, researchData) {
    try {
      logger.info('Executing Ichimoku Cloud strategy...');

      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = marketData?.priceHistory || (this.priceHistoryManager ? this.priceHistoryManager.getPriceVolumeHistory() : []);

      if (priceHistory.length < 52) {
        return {
          action: 'hold',
          confidence: 0.3,
          reasoning: `Building price history (${priceHistory.length}/52) - need more data for Ichimoku calculation`,
          position_size: 0,
          parameters: {}
        };
      }

      // Execute Ichimoku strategy with enhanced indicators
      return await this._executeIchimokuStrategy(marketData, currentPrice, priceHistory);

    } catch (error) {
      logger.error('Error in Ichimoku Cloud strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Error in Ichimoku Cloud strategy: ${error.message}`,
        parameters: {},
        position_size: 0
      };
    }
  }

  async _executeIchimokuStrategy(marketData, currentPrice, priceHistory) {
    try {
      // Get balances
      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      // Calculate Ichimoku indicators
      const ichimokuData = this._calculateIchimokuIndicators(priceHistory);

      // Analyze signals
      const signal = this._analyzeIchimokuSignals(currentPrice, ichimokuData, priceHistory);

      const bnbValueInUsdt = bnbBalance * currentPrice;

      // BUY: Price > cloud, Tenkan > Kijun, green cloud, Chikou > past price, confidence 0.75-0.95
      if (signal.type === 'strong_bullish') {
        const confidence = Math.min(0.95, 0.75 + signal.strength * 0.2);
        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `Ichimoku Buy signal but insufficient USDT balance (Tenkan: ${ichimokuData.tenkanSen.toFixed(6)}, Kijun: ${ichimokuData.kijunSen.toFixed(6)}, Cloud: ${ichimokuData.cloudColor})`,
            position_size: 0,
            parameters: { ...ichimokuData, currentPrice, signal }
          };
        }

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `Ichimoku Buy: Price ${currentPrice.toFixed(6)} > Cloud, Tenkan ${ichimokuData.tenkanSen.toFixed(6)} > Kijun ${ichimokuData.kijunSen.toFixed(6)}, ${ichimokuData.cloudColor} cloud, Chikou ${ichimokuData.chikouSpan.toFixed(6)} > past price`,
          position_size: positionSize,
          parameters: { ...ichimokuData, currentPrice, signal }
        };
      }

      // SELL: Price < cloud, Tenkan < Kijun, red cloud, confidence 0.75-0.95
      else if (signal.type === 'strong_bearish') {
        const confidence = Math.min(0.95, 0.75 + signal.strength * 0.2);
        const positionSize = this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);

        if (bnbValueInUsdt < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `Ichimoku Sell signal but insufficient BNB balance (Tenkan: ${ichimokuData.tenkanSen.toFixed(6)}, Kijun: ${ichimokuData.kijunSen.toFixed(6)}, Cloud: ${ichimokuData.cloudColor})`,
            position_size: 0,
            parameters: { ...ichimokuData, currentPrice, signal }
          };
        }

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `Ichimoku Sell: Price ${currentPrice.toFixed(6)} < Cloud, Tenkan ${ichimokuData.tenkanSen.toFixed(6)} < Kijun ${ichimokuData.kijunSen.toFixed(6)}, ${ichimokuData.cloudColor} cloud`,
          position_size: positionSize,
          parameters: { ...ichimokuData, currentPrice, signal }
        };
      }

      // HOLD: Price inside cloud or mixed signals, confidence 0.5
      else {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `Ichimoku Hold: Price ${currentPrice.toFixed(6)} inside cloud or mixed signals (Tenkan: ${ichimokuData.tenkanSen.toFixed(6)}, Kijun: ${ichimokuData.kijunSen.toFixed(6)}, Cloud: ${ichimokuData.cloudColor})`,
          position_size: 0,
          parameters: { ...ichimokuData, currentPrice, signal }
        };
      }

    } catch (error) {
      logger.error('Error in _executeIchimokuStrategy:', error);
      return {
        action: 'hold',
        confidence: 0.3,
        reasoning: `Ichimoku strategy error: ${error.message}`,
        position_size: 0,
        parameters: {}
      };
    }
  }

  _calculateIchimokuIndicators(priceHistory) {
    const prices = priceHistory.map(p => p.price);
    const highs = priceHistory.map(p => p.high || p.price);
    const lows = priceHistory.map(p => p.low || p.price);

    // Tenkan-sen: (9-period high + low) / 2
    const tenkanHigh = Math.max(...highs.slice(-9));
    const tenkanLow = Math.min(...lows.slice(-9));
    const tenkanSen = (tenkanHigh + tenkanLow) / 2;

    // Kijun-sen: (26-period high + low) / 2
    const kijunHigh = Math.max(...highs.slice(-26));
    const kijunLow = Math.min(...lows.slice(-26));
    const kijunSen = (kijunHigh + kijunLow) / 2;

    // Senkou Span A: (Tenkan + Kijun) / 2, shifted 26 ahead
    const senkouSpanA = (tenkanSen + kijunSen) / 2;

    // Senkou Span B: (52-period high + low) / 2, shifted 26 ahead
    const senkouSpanBHigh = Math.max(...highs.slice(-52));
    const senkouSpanBLow = Math.min(...lows.slice(-52));
    const senkouSpanB = (senkouSpanBHigh + senkouSpanBLow) / 2;

    // Chikou Span: current price, shifted 26 back
    const chikouSpan = prices[prices.length - 1];

    // Determine cloud color
    const cloudColor = senkouSpanA > senkouSpanB ? 'green' : 'red';

    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan,
      cloudColor,
      cloudTop: Math.max(senkouSpanA, senkouSpanB),
      cloudBottom: Math.min(senkouSpanA, senkouSpanB)
    };
  }

  _analyzeIchimokuSignals(currentPrice, ichimokuData, priceHistory) {
    const { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan, cloudColor } = ichimokuData;

    // Check if price is above or below cloud
    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
    const priceAboveCloud = currentPrice > cloudTop;
    const priceBelowCloud = currentPrice < cloudBottom;
    const priceInCloud = currentPrice >= cloudBottom && currentPrice <= cloudTop;

    // Check Tenkan vs Kijun relationship
    const tenkanAboveKijun = tenkanSen > kijunSen;
    const tenkanBelowKijun = tenkanSen < kijunSen;

    // Check Chikou Span vs past price (26 periods ago)
    const pastPrice = priceHistory.length >= 26 ? priceHistory[priceHistory.length - 26].price : currentPrice;
    const chikouAbovePast = chikouSpan > pastPrice;

    // Determine signal strength
    let signalType = 'neutral';
    let strength = 0;
    let reasoning = '';

    // Strong bullish: Price > cloud, Tenkan > Kijun, green cloud, Chikou > past price
    if (priceAboveCloud && tenkanAboveKijun && cloudColor === 'green' && chikouAbovePast) {
      signalType = 'strong_bullish';
      strength = 0.8;
      reasoning = 'All bullish conditions met';
    }
    // Strong bearish: Price < cloud, Tenkan < Kijun, red cloud
    else if (priceBelowCloud && tenkanBelowKijun && cloudColor === 'red') {
      signalType = 'strong_bearish';
      strength = 0.8;
      reasoning = 'All bearish conditions met';
    }
    // Mixed signals or price in cloud
    else {
      signalType = 'neutral';
      strength = 0.3;
      reasoning = 'Mixed signals or price in cloud';
    }

    return {
      type: signalType,
      strength: strength,
      reasoning: reasoning,
      priceAboveCloud,
      priceBelowCloud,
      priceInCloud,
      tenkanAboveKijun,
      tenkanBelowKijun,
      chikouAbovePast
    };
  }

  _calculateIchimokuCloud(priceHistory) {
    const prices = priceHistory.map(p => p.price);
    const highs = priceHistory.map(p => p.high || p.price);
    const lows = priceHistory.map(p => p.low || p.price);

    // Tenkan-sen (9-period)
    const tenkanHigh = Math.max(...highs.slice(-9));
    const tenkanLow = Math.min(...lows.slice(-9));
    const tenkanSen = (tenkanHigh + tenkanLow) / 2;

    // Kijun-sen (26-period)
    const kijunHigh = Math.max(...highs.slice(-26));
    const kijunLow = Math.min(...lows.slice(-26));
    const kijunSen = (kijunHigh + kijunLow) / 2;

    // Senkou Span A (leading span A)
    const senkouSpanA = (tenkanSen + kijunSen) / 2;

    // Senkou Span B (52-period)
    const senkouHigh = Math.max(...highs.slice(-52));
    const senkouLow = Math.min(...lows.slice(-52));
    const senkouSpanB = (senkouHigh + senkouLow) / 2;

    // Chikou Span (current price plotted 26 periods back)
    const chikouSpan = prices[prices.length - 1];

    // Cloud analysis
    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
    const cloudThickness = cloudTop - cloudBottom;
    const cloudThicknessPercent = (cloudThickness / cloudBottom) * 100;

    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan,
      cloudTop,
      cloudBottom,
      cloudThickness,
      cloudThicknessPercent
    };
  }

  _analyzeIchimokuSignals(currentPrice, ichimokuData) {
    const { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, cloudTop, cloudBottom } = ichimokuData;

    let signals = [];
    let strength = 0;

    // Signal 1: Tenkan/Kijun crossover
    if (tenkanSen > kijunSen) {
      signals.push('Tenkan above Kijun (bullish)');
      strength += 0.3;
    } else {
      signals.push('Tenkan below Kijun (bearish)');
      strength -= 0.3;
    }

    // Signal 2: Price vs Cloud
    if (currentPrice > cloudTop) {
      signals.push('Price above cloud (bullish)');
      strength += 0.4;
    } else if (currentPrice < cloudBottom) {
      signals.push('Price below cloud (bearish)');
      strength -= 0.4;
    } else {
      signals.push('Price in cloud (neutral)');
    }

    // Signal 3: Cloud color (future cloud)
    if (senkouSpanA > senkouSpanB) {
      signals.push('Bullish cloud ahead');
      strength += 0.2;
    } else {
      signals.push('Bearish cloud ahead');
      strength -= 0.2;
    }

    // Signal 4: Price vs Tenkan/Kijun
    if (currentPrice > tenkanSen && currentPrice > kijunSen) {
      signals.push('Price above both lines (strong bullish)');
      strength += 0.3;
    } else if (currentPrice < tenkanSen && currentPrice < kijunSen) {
      signals.push('Price below both lines (strong bearish)');
      strength -= 0.3;
    }

    // Determine signal type
    let type, reasoning;
    if (strength >= 0.7) {
      type = 'strong_bullish';
      reasoning = signals.join(', ');
    } else if (strength <= -0.7) {
      type = 'strong_bearish';
      reasoning = signals.join(', ');
    } else if (strength >= 0.3) {
      type = 'weak_bullish';
      reasoning = signals.join(', ');
    } else if (strength <= -0.3) {
      type = 'weak_bearish';
      reasoning = signals.join(', ');
    } else {
      type = 'neutral';
      reasoning = signals.join(', ');
    }

    return {
      type,
      strength: Math.abs(strength),
      reasoning,
      signals
    };
  }

  // ============================================================================
  // GRID TRADING STRATEGY
  // ============================================================================
  async gridTradingStrategy(analysis, marketData, researchData) {
    try {
      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = this.priceHistoryManager ? this.priceHistoryManager.getHistory() : (marketData?.priceHistory || []);

      if (priceHistory.length < 100) {
        return {
          action: 'hold',
          confidence: 0.3,
          reasoning: `Building price history (${priceHistory.length}/100)`,
          position_size: 0,
          parameters: {}
        };
      }

      if (!this.gridState) {
        this.gridState = await this._initializeGrid(currentPrice, priceHistory);
      }

      if (this._needsRecalibration(currentPrice)) {
        this.gridState = await this._initializeGrid(currentPrice, priceHistory);
      }

      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      const bnbValueInUsdt = bnbBalance * currentPrice;
      const currentLevel = this._findCurrentGridLevel(currentPrice);
      const tradingDecision = await this._evaluateGridTrading(currentPrice, currentLevel, usdtBalance, bnbValueInUsdt);

      // Update grid state
      this.gridState.lastPrice = currentPrice;

      // Save state changes to database
      try {
        await this.updateGridStateInDB(this.gridState);
      } catch (error) {
        logger.error('Failed to update grid state in database:', error);
        // Continue even if database update fails
      }

      return tradingDecision;

    } catch (error) {
      logger.error('Error in grid trading strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Error: ${error.message}`,
        parameters: {},
        position_size: 0
      };
    }
  }

  // Grid State Persistence Methods
  async loadGridFromDB() {
    try {
      const gridState = await GridState.findOne({
        where: {
          token_pair: 'BNB/USDT',
          is_active: true
        },
        order: [['last_updated', 'DESC']]
      });

      if (!gridState) {
        logger.debug('No saved grid state found in database');
        return null;
      }

      logger.info(`Loaded grid state from database: ${gridState.id}`);
      return {
        levels: gridState.grid_levels,
        upperBound: parseFloat(gridState.upper_bound),
        lowerBound: parseFloat(gridState.lower_bound),
        lastPrice: parseFloat(gridState.last_price),
        createdAt: gridState.created_at,
        lastUpdated: gridState.last_updated
      };
    } catch (error) {
      logger.error('Error loading grid state from database:', error);
      return null;
    }
  }

  async saveGridToDB(gridState) {
    try {
      // Deactivate any existing active grid states
      await GridState.update(
        { is_active: false },
        {
          where: {
            token_pair: 'BNB/USDT',
            is_active: true
          }
        }
      );

      // Create new grid state
      const savedGrid = await GridState.create({
        token_pair: 'BNB/USDT',
        upper_bound: gridState.upperBound,
        lower_bound: gridState.lowerBound,
        grid_levels: gridState.levels,
        last_price: gridState.lastPrice,
        is_active: true
      });

      logger.info(`Saved grid state to database: ${savedGrid.id}`);
      return savedGrid;
    } catch (error) {
      logger.error('Error saving grid state to database:', error);
      throw error;
    }
  }

  async updateGridStateInDB(gridState) {
    try {
      const activeGrid = await GridState.findOne({
        where: {
          token_pair: 'BNB/USDT',
          is_active: true
        }
      });

      if (!activeGrid) {
        logger.warn('No active grid state found to update');
        return null;
      }

      await activeGrid.update({
        grid_levels: gridState.levels,
        last_price: gridState.lastPrice,
        last_updated: new Date()
      });

      logger.debug(`Updated grid state in database: ${activeGrid.id}`);
      return activeGrid;
    } catch (error) {
      logger.error('Error updating grid state in database:', error);
      throw error;
    }
  }

  async _initializeGrid(currentPrice, priceHistory) {
    // Try to load from database first
    const savedGrid = await this.loadGridFromDB();
    if (savedGrid && !this._needsRecalibration(currentPrice, savedGrid)) {
      logger.info('Using existing grid state from database');
      return savedGrid;
    }

    // Create new grid
    logger.info('Creating new grid state');
    const last100 = priceHistory.slice(-100).map(p => p.price);
    const high = Math.max(...last100);
    const low = Math.min(...last100);
    const range = high - low;

    const upperBound = high + (range * 0.1);
    const lowerBound = low - (range * 0.1);
    const numLevels = this.config.gridLevels || 10;
    const gridSpacing = (upperBound - lowerBound) / (numLevels - 1);

    const levels = [];
    for (let i = 0; i < numLevels; i++) {
      levels.push({
        price: lowerBound + (gridSpacing * i),
        filled: false,
        lastTradeTime: 0
      });
    }

    const newGrid = {
      upperBound,
      lowerBound,
      levels,
      gridSpacing,
      numLevels,
      lastPrice: currentPrice,
      createdAt: Date.now()
    };

    // Save to database
    try {
      await this.saveGridToDB(newGrid);
    } catch (error) {
      logger.error('Failed to save grid state to database:', error);
      // Continue with in-memory grid even if database save fails
    }

    return newGrid;
  }

  _needsRecalibration(currentPrice, gridState = null) {
    const state = gridState || this.gridState;
    if (!state) return true;

    if (currentPrice > state.upperBound || currentPrice < state.lowerBound) {
      return true;
    }

    const gridAge = Date.now() - state.createdAt;
    if (gridAge > 24 * 60 * 60 * 1000) {
      return true;
    }

    return false;
  }

  _findCurrentGridLevel(currentPrice) {
    let closestLevel = 0;
    let minDistance = Infinity;

    for (let i = 0; i < this.gridState.levels.length; i++) {
      const distance = Math.abs(currentPrice - this.gridState.levels[i].price);
      if (distance < minDistance) {
        minDistance = distance;
        closestLevel = i;
      }
    }

    return closestLevel;
  }

  async _evaluateGridTrading(currentPrice, currentLevel, usdtBalance, bnbValueInUsdt) {
    const lastPrice = this.gridState.lastPrice;
    const levels = this.gridState.levels;
    const currentLevelPrice = levels[currentLevel].price;
    const minTimeBetweenTrades = 5 * 60 * 1000;
    const timeSinceLastTrade = Date.now() - levels[currentLevel].lastTradeTime;

    // Price crossed DOWN = BUY
    if (lastPrice > currentLevelPrice && currentPrice <= currentLevelPrice) {

      if (usdtBalance < this.config.minBalance) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `Grid buy signal but insufficient USDT`,
          position_size: 0,
          parameters: { gridLevel: currentLevel, levelPrice: currentLevelPrice, currentPrice }
        };
      }

      if (timeSinceLastTrade < minTimeBetweenTrades) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `Grid buy cooldown active`,
          position_size: 0,
          parameters: { gridLevel: currentLevel, levelPrice: currentLevelPrice, currentPrice }
        };
      }

      const levelsBelow = currentLevel;
      const baseSize = await this._calculatePositionSizeByConfidence('buy', 0.80, usdtBalance, bnbBalance, currentPrice);
      const positionSize = Math.min(
        baseSize,
        levelsBelow > 0 ? usdtBalance / levelsBelow : baseSize
      );

      levels[currentLevel].filled = true;
      levels[currentLevel].lastTradeTime = Date.now();

      return {
        action: 'buy',
        confidence: 0.80,
        reasoning: `Grid buy at level ${currentLevel + 1}/${levels.length}: ${currentLevelPrice.toFixed(6)}`,
        position_size: positionSize,
        parameters: {
          gridLevel: currentLevel,
          levelPrice: currentLevelPrice,
          currentPrice,
          price: currentPrice
        }
      };
    }

    // Price crossed UP = SELL
    if (lastPrice < currentLevelPrice && currentPrice >= currentLevelPrice) {

      if (bnbValueInUsdt < this.config.minBalance) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `Grid sell signal but insufficient BNB`,
          position_size: 0,
          parameters: { gridLevel: currentLevel, levelPrice: currentLevelPrice, currentPrice }
        };
      }

      if (timeSinceLastTrade < minTimeBetweenTrades) {
        return {
          action: 'hold',
          confidence: 0.5,
          reasoning: `Grid sell cooldown active`,
          position_size: 0,
          parameters: { gridLevel: currentLevel, levelPrice: currentLevelPrice, currentPrice }
        };
      }

      const levelsAbove = levels.length - currentLevel - 1;
      const bnbBalance = bnbValueInUsdt / currentPrice;
      const baseSize = await this._calculatePositionSizeByConfidence('sell', 0.80, usdtBalance, bnbBalance, currentPrice);
      const positionSize = Math.min(
        baseSize,
        levelsAbove > 0 ? bnbBalance / levelsAbove : baseSize
      );

      levels[currentLevel].filled = false;
      levels[currentLevel].lastTradeTime = Date.now();

      return {
        action: 'sell',
        confidence: 0.80,
        reasoning: `Grid sell at level ${currentLevel + 1}/${levels.length}: ${currentLevelPrice.toFixed(6)}`,
        position_size: positionSize,
        parameters: {
          gridLevel: currentLevel,
          levelPrice: currentLevelPrice,
          currentPrice,
          price: currentPrice
        }
      };
    }

    // No crossing - HOLD
    return {
      action: 'hold',
      confidence: 0.5,
      reasoning: `No grid crossing at level ${currentLevel + 1}/${levels.length}`,
      position_size: 0,
      parameters: {
        gridLevel: currentLevel,
        levelPrice: currentLevelPrice,
        currentPrice
      }
    };
  }

  async meanReversionStrategy(analysis, marketData, researchData) {
    try {
      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = this.priceHistoryManager ? this.priceHistoryManager.getHistory() : (marketData?.priceHistory || []);

      if (priceHistory.length < 50) {
        return {
          action: 'hold',
          confidence: 0.3,
          reasoning: `Building price history (${priceHistory.length}/50) for mean reversion`,
          position_size: 0,
          parameters: {}
        };
      }

      // Calculate mean and standard deviation
      const recentPrices = priceHistory.slice(-50).map(p => p.price);
      const mean = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
      const variance = recentPrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentPrices.length;
      const stdDev = Math.sqrt(variance);

      // Calculate z-score (how many standard deviations from mean)
      const zScore = (currentPrice - mean) / stdDev;

      // Calculate RSI for confirmation
      const { RSI } = require('technicalindicators');
      const closePrices = recentPrices;
      const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
      const currentRSI = rsiValues[rsiValues.length - 1];

      // Calculate Bollinger Bands
      const upperBand = mean + (stdDev * 2);
      const lowerBand = mean - (stdDev * 2);

      // Calculate mean reversion strength (how fast price returns to mean)
      const reversionStrength = this._calculateReversionStrength(recentPrices, mean);

      // Get balances
      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      const bnbValueInUsdt = bnbBalance * currentPrice;

      // Tiered BUY signals based on z-score strength - OPTIMIZED FOR $60K
      if (zScore < -0.7 && currentRSI < 40 && reversionStrength > 0.15) { // Strong signal
        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Mean reversion strong buy signal but insufficient USDT',
            position_size: 0,
            parameters: { currentPrice, mean, zScore, currentRSI, reversionStrength }
          };
        }

        const confidence = Math.min(0.85, 0.65 + (Math.abs(zScore) / 10) + (reversionStrength * 0.2));
        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `Mean reversion strong buy: z-score ${zScore.toFixed(2)}, RSI ${currentRSI.toFixed(1)}, reversion strength ${(reversionStrength * 100).toFixed(0)}%`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            mean,
            zScore,
            stdDev,
            currentRSI,
            upperBand,
            lowerBand,
            reversionStrength,
            price: currentPrice
          }
        };
      }

      // MODERATE BUY: Below lower band
      if (currentPrice < lowerBand && currentRSI < 40) {
        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Mean reversion buy signal but insufficient USDT',
            position_size: 0,
            parameters: { currentPrice, mean, zScore, currentRSI }
          };
        }

        const confidence = 0.70;
        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `Mean reversion buy: Price ${currentPrice.toFixed(6)} below lower band ${lowerBand.toFixed(6)}, RSI ${currentRSI.toFixed(1)}`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            mean,
            zScore,
            stdDev,
            currentRSI,
            upperBand,
            lowerBand,
            reversionStrength,
            price: currentPrice
          }
        };
      }

      // WEAK BUY: Very mild oversold condition
      if (zScore < -0.3 && currentRSI < 45 && reversionStrength > 0.05) { // Weak signal
        if (usdtBalance < this.config.minBalance) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Mean reversion weak buy signal but insufficient USDT',
            position_size: 0,
            parameters: { currentPrice, mean, zScore, currentRSI, reversionStrength }
          };
        }

        const confidence = 0.60;
        const positionSize = await this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

        return {
          action: 'buy',
          confidence: confidence,
          reasoning: `🟠 WEAK BUY: Price ${currentPrice.toFixed(6)} slightly below mean ${mean.toFixed(6)} (z-score: ${zScore.toFixed(2)}, RSI: ${currentRSI.toFixed(1)})`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            mean,
            zScore,
            stdDev,
            currentRSI,
            upperBand,
            lowerBand,
            reversionStrength,
            price: currentPrice
          }
        };
      }

      // STRONG SELL: Overbought + above upper band + good reversion strength - OPTIMIZED FOR $60K
      if (zScore > 0.3 && currentRSI > 60 && reversionStrength > 0.15) { // Optimized thresholds (50→60)
        if (bnbBalance < 1.0) { // Check actual BNB balance, not USD value
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Mean reversion strong sell signal but insufficient BNB',
            position_size: 0,
            parameters: { currentPrice, mean, zScore, currentRSI, reversionStrength }
          };
        }

        const confidence = Math.min(0.85, 0.65 + (Math.abs(zScore) / 10) + (reversionStrength * 0.2));
        const sellAmount = await this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);
        const positionSize = sellAmount; // Already in BNB

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `Mean reversion strong sell: z-score ${zScore.toFixed(2)}, RSI ${currentRSI.toFixed(1)}, reversion strength ${(reversionStrength * 100).toFixed(0)}%`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            mean,
            zScore,
            stdDev,
            currentRSI,
            upperBand,
            lowerBand,
            reversionStrength,
            price: currentPrice
          }
        };
      }

      // MODERATE SELL: Above upper band
      if (currentPrice > upperBand && currentRSI > 60) {
        if (bnbBalance < 1.0) { // Check actual BNB balance, not USD value
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Mean reversion sell signal but insufficient BNB',
            position_size: 0,
            parameters: { currentPrice, mean, zScore, currentRSI }
          };
        }

        const confidence = 0.70;
        const sellAmount = await this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);
        const positionSize = sellAmount; // Already in BNB

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `Mean reversion sell: Price ${currentPrice.toFixed(6)} above upper band ${upperBand.toFixed(6)}, RSI ${currentRSI.toFixed(1)}`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            mean,
            zScore,
            stdDev,
            currentRSI,
            upperBand,
            lowerBand,
            reversionStrength,
            price: currentPrice
          }
        };
      }

      // WEAK SELL: Very mild overbought condition
      if (zScore > 0.3 && currentRSI > 65 && reversionStrength > 0.05) { // Weak signal (55→65)
        if (bnbBalance < 1.0) { // Check actual BNB balance, not USD value
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: 'Mean reversion weak sell signal but insufficient BNB',
            position_size: 0,
            parameters: { currentPrice, mean, zScore, currentRSI, reversionStrength }
          };
        }

        const confidence = 0.60;
        const sellAmount = await this._calculatePositionSizeByConfidence('sell', confidence, usdtBalance, bnbBalance, currentPrice);
        const positionSize = sellAmount; // Already in BNB

        return {
          action: 'sell',
          confidence: confidence,
          reasoning: `🟠 WEAK SELL: Price ${currentPrice.toFixed(6)} slightly above mean ${mean.toFixed(6)} (z-score: ${zScore.toFixed(2)}, RSI: ${currentRSI.toFixed(1)})`,
          position_size: positionSize,
          parameters: {
            currentPrice,
            mean,
            zScore,
            stdDev,
            currentRSI,
            upperBand,
            lowerBand,
            reversionStrength,
            price: currentPrice
          }
        };
      }

      // Near mean - HOLD
      return {
        action: 'hold',
        confidence: 0.5,
        reasoning: `Price ${currentPrice.toFixed(6)} near mean ${mean.toFixed(6)}, z-score ${zScore.toFixed(2)} (need < -0.7 for buy, > 0.3 for sell), RSI ${currentRSI.toFixed(1)} (need < 40 for buy, > 60 for sell), reversion strength ${reversionStrength.toFixed(2)} (need > 0.15)`,
        position_size: 0,
        parameters: {
          currentPrice,
          mean,
          zScore,
          stdDev,
          currentRSI,
          upperBand,
          lowerBand,
          reversionStrength,
          thresholds: {
            zScoreBuy: -1.0,
            zScoreSell: 0.5,
            rsiBuy: 35,
            rsiSell: 55,
            reversionStrength: 0.2
          }
        }
      };

    } catch (error) {
      logger.error('Error in mean reversion strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Error in mean reversion: ${error.message}`,
        parameters: {},
        position_size: 0
      };
    }
  }

  // Helper method for mean reversion strength calculation
  _calculateReversionStrength(prices, mean) {
    // Measure how quickly price returns to mean
    let reversionCount = 0;
    let totalDeviation = 0;

    for (let i = 1; i < prices.length; i++) {
      const prevDeviation = Math.abs(prices[i - 1] - mean);
      const currDeviation = Math.abs(prices[i] - mean);

      // Price moving toward mean
      if (currDeviation < prevDeviation) {
        reversionCount++;
      }

      totalDeviation += currDeviation;
    }

    // Strength = how often price reverts + how close it stays to mean
    const reversionRate = reversionCount / (prices.length - 1);
    const avgDeviation = totalDeviation / prices.length;
    const deviationScore = 1 - Math.min(avgDeviation / mean, 1);

    return (reversionRate * 0.7 + deviationScore * 0.3);
  }

  async arbitrageStrategy(analysis, marketData, researchData) {
    // This would typically compare prices across multiple DEXs
    // For now, return a conservative hold decision
    return {
      action: 'hold',
      confidence: 0.3,
      reasoning: 'No arbitrage opportunities detected',
      parameters: {},
      position_size: 0
    };
  }

  async analyzePriceAction(marketData) {
    try {
      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = marketData?.priceHistory || await this.getPriceHistory(24); // 24 hours

      if (priceHistory.length < 2) {
        return { trend: 'unknown', volatility: 0 };
      }

      const prices = priceHistory.map(p => p.price);
      const trend = this.calculateTrend(prices);
      const volatility = this.calculateVolatility(prices);
      const support = Math.min(...prices);
      const resistance = Math.max(...prices);

      return {
        current: currentPrice,
        trend,
        volatility,
        support,
        resistance,
        range: resistance - support
      };
    } catch (error) {
      logger.error('Error analyzing price action:', error);
      return { trend: 'unknown', volatility: 0 };
    }
  }

  async analyzeVolume(marketData) {
    try {
      // Note: PancakeSwap V2 doesn't provide reliable volume data on-chain
      // Volume confirmation is disabled to avoid using misleading mock data
      logger.debug('Volume analysis disabled - PancakeSwap V2 doesn\'t provide reliable volume data');
      return {
        current: null,
        trend: 'unknown',
        average_24h: null,
        volume_price_trend: 'unknown',
        available: false
      };
    } catch (error) {
      logger.error('Error analyzing volume:', error);
      return {
        trend: 'unknown',
        available: false
      };
    }
  }

  analyzeSentiment(researchData) {
    if (!researchData) {
      return { sentiment: 'neutral', confidence: 0 };
    }

    return {
      sentiment: researchData.sentiment?.sentiment || 'neutral',
      confidence: researchData.sentiment?.confidence || 0,
      news_sentiment: researchData.sentiment?.score || 0,
      fundamental_score: researchData.fundamentals?.score || 0
    };
  }

  async calculateTechnicalIndicators(marketData) {
    try {
      const priceHistory = marketData?.priceHistory || await this.getPriceHistory(100);

      if (priceHistory.length < 20) {
        return { rsi: 50, macd: { signal: 0, histogram: 0 } };
      }

      const prices = priceHistory.map(p => p.price);

      return {
        rsi: this.calculateRSI(prices, 14),
        macd: this.calculateMACD(prices),
        bollinger_bands: this.calculateBollingerBands(prices, 20),
        volatility: this.calculateVolatility(prices)
      };
    } catch (error) {
      logger.error('Error calculating technical indicators:', error);
      return { rsi: 50, macd: { signal: 0, histogram: 0 } };
    }
  }

  async analyzeMarketStructure(marketData) {
    try {
      const priceHistory = marketData?.priceHistory || await this.getPriceHistory(50);

      if (priceHistory.length < 10) {
        return { structure: 'unknown', trend_strength: 0 };
      }

      const prices = priceHistory.map(p => p.price);
      const highs = this.findPeaks(prices);
      const lows = this.findTroughs(prices);

      let structure = 'sideways';
      if (highs.length >= 2 && highs[highs.length - 1] > highs[highs.length - 2]) {
        structure = 'uptrend';
      } else if (lows.length >= 2 && lows[lows.length - 1] < lows[lows.length - 2]) {
        structure = 'downtrend';
      }

      return {
        structure,
        trend_strength: this.calculateTrendStrength(prices),
        support_levels: lows.slice(-3),
        resistance_levels: highs.slice(-3)
      };
    } catch (error) {
      logger.error('Error analyzing market structure:', error);
      return { structure: 'unknown', trend_strength: 0 };
    }
  }

  async assessRisk(marketData, researchData) {
    try {
      const volatility = await this.analyzePriceAction(marketData);
      const sentiment = this.analyzeSentiment(researchData);

      let riskScore = 0.5; // Base risk

      // High volatility increases risk
      if (volatility.volatility > 0.05) riskScore += 0.2;
      else if (volatility.volatility < 0.02) riskScore -= 0.1;

      // Negative sentiment increases risk
      if (sentiment.sentiment === 'negative') riskScore += 0.2;
      else if (sentiment.sentiment === 'positive') riskScore -= 0.1;

      return {
        score: Math.min(Math.max(riskScore, 0), 1),
        level: riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low',
        factors: {
          volatility: volatility.volatility,
          sentiment: sentiment.sentiment
        }
      };
    } catch (error) {
      logger.error('Error assessing risk:', error);
      return { score: 0.5, level: 'medium' };
    }
  }

  selectOptimalStrategy(analysis) {
    const { price_analysis, volume_analysis, sentiment_analysis, risk_assessment } = analysis;

    // High volatility + ranging price action = ranging strategy
    if (price_analysis.volatility > 0.03 && price_analysis.trend === 'sideways') {
      return 'ranging';
    }

    // Strong trend + high volume = momentum strategy
    if (price_analysis.trend !== 'sideways' && volume_analysis.trend === 'increasing') {
      return 'momentum';
    }

    // Mean reversion conditions
    if (price_analysis.volatility < 0.02 && sentiment_analysis.sentiment !== 'neutral') {
      return 'mean_reversion';
    }

    return 'ranging'; // Default strategy
  }

  calculateConfidence(analysis) {
    let confidence = 0.5; // Base confidence

    // High volume increases confidence
    if (analysis.volume_analysis?.trend === 'increasing') confidence += 0.1;

    // Strong sentiment increases confidence
    if (analysis.sentiment_analysis?.confidence > 0.7) confidence += 0.1;

    // Clear market structure increases confidence
    if (analysis.market_structure?.structure !== 'sideways') confidence += 0.1;

    // Low risk increases confidence
    if (analysis.risk_assessment?.level === 'low') confidence += 0.1;

    return Math.min(confidence, 1);
  }

  shouldRebalance(usdtBalance, bnbBalance, currentPrice) {
    const totalValue = usdtBalance + (bnbBalance * currentPrice);
    const usdtRatio = usdtBalance / totalValue;
    const targetRatio = 0.5; // 50/50 split
    const threshold = 0.1; // 10% deviation threshold

    return Math.abs(usdtRatio - targetRatio) > threshold;
  }

  async calculatePositionSize(action, confidence, usdtBalance = 0, bnbBalance = 0, currentPrice = 0) {
    return await this._calculatePositionSizeByConfidence(action, confidence, usdtBalance, bnbBalance, currentPrice);
  }

  // Technical Analysis Helper Methods
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return { signal: 0, histogram: 0 };

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;

    return {
      macd: macdLine,
      signal: macdLine, // Simplified
      histogram: macdLine
    };
  }

  calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };

    const recentPrices = prices.slice(-period);
    const middle = recentPrices.reduce((a, b) => a + b) / period;

    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev)
    };
  }

  calculateVolatility(prices) {
    if (prices.length < 2) return 0;

    let sum = 0;
    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i] - prices[i - 1]) / prices[i - 1];
      sum += change * change;
    }

    return Math.sqrt(sum / (prices.length - 1));
  }

  calculateTrend(prices) {
    if (prices.length < 10) return 'unknown';

    const recent = prices.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const change = (last - first) / first;

    if (change > 0.02) return 'uptrend';
    if (change < -0.02) return 'downtrend';
    return 'sideways';
  }

  findPeaks(prices) {
    const peaks = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
        peaks.push(prices[i]);
      }
    }
    return peaks;
  }

  findTroughs(prices) {
    const troughs = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
        troughs.push(prices[i]);
      }
    }
    return troughs;
  }

  calculateTrendStrength(prices) {
    const trend = this.calculateTrend(prices);
    if (trend === 'sideways') return 0;

    const recent = prices.slice(-20);
    let consistentDirection = 0;

    for (let i = 1; i < recent.length; i++) {
      if ((trend === 'uptrend' && recent[i] > recent[i - 1]) ||
        (trend === 'downtrend' && recent[i] < recent[i - 1])) {
        consistentDirection++;
      }
    }

    return consistentDirection / (recent.length - 1);
  }

  async getPriceHistory(hours = 24) {
    // This would typically fetch from a price API
    // For now, return mock data
    const prices = [];
    const now = Date.now();
    const interval = (hours * 60 * 60 * 1000) / 100; // 100 data points

    for (let i = 0; i < 100; i++) {
      prices.push({
        timestamp: new Date(now - (100 - i) * interval),
        price: Math.random() * 0.01 + 0.25 // Mock BNB price around 0.25
      });
    }

    return prices;
  }

  async backtestStrategy(strategy, period = 30) {
    // Implementation would backtest the strategy over historical data
    return {
      strategy,
      period,
      total_return: Math.random() * 0.2 - 0.1, // -10% to +10%
      sharpe_ratio: Math.random() * 2,
      max_drawdown: Math.random() * 0.2,
      win_rate: Math.random() * 0.8 + 0.2 // 20% to 100%
    };
  }

  async optimizeStrategy(strategy, parameters) {
    // Implementation would optimize strategy parameters
    return {
      strategy,
      optimized_parameters: parameters,
      improvement: Math.random() * 0.1 // 0-10% improvement
    };
  }
}

module.exports = TradingStrategyAgent;


═══════════════════════════════════════════════════════════════════════
FICHIER 2: AdvancedTradingBot.js (2,024 lignes)
═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CRITICAL: Prevent EPIPE crashes from broken stdout pipe
// ═══════════════════════════════════════════════════════════════
process.on('uncaughtException', (error) => {
  // EPIPE = broken pipe (stdout closed while writing)
  if (error.code === 'EPIPE' || error.errno === -32) {
    console.error('[EPIPE CAUGHT] Broken pipe error prevented crash - continuing...');
    console.error('[EPIPE DETAILS]', error.message);
    return; // Don't crash the bot
  }

  // All other uncaught exceptions should crash
  console.error('═══════════════════════════════════════');
  console.error('UNCAUGHT EXCEPTION - BOT STOPPING');
  console.error('═══════════════════════════════════════');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // EPIPE in promise rejection
  if (reason && (reason.code === 'EPIPE' || reason.errno === -32)) {
    console.error('[EPIPE CAUGHT] Broken pipe in promise - continuing...');
    return; // Don't crash the bot
  }

  // All other unhandled rejections should crash
  console.error('═══════════════════════════════════════');
  console.error('UNHANDLED PROMISE REJECTION - BOT STOPPING');
  console.error('═══════════════════════════════════════');
  console.error('Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

const { ethers } = require('ethers'); // ✅ FIX #1: Add missing ethers import
const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
let RateLimiterMemory;
try {
  RateLimiterMemory = require('rate-limiter-flexible').RateLimiterMemory;
} catch (error) {
  console.log('Rate limiter not available, using simple fallback');
  RateLimiterMemory = null;
}

// Import existing modules
const config = require('./config');
const logger = require('./logger');
const WalletManager = require('./walletManager');
const RateLimiter = require('./security/rateLimiter');
const PriceHistoryManager = require('./utils/priceHistoryManager');
const MultiDexManager = require('./dex/multiDexManager');
const PortfolioManager = require('./managers/PortfolioManager');

// Import new $60K portfolio strategies
const LeverageStrategy = require('./strategies/LeverageStrategy');
const MarketMakingStrategy = require('./strategies/MarketMakingStrategy');
const VenusYieldStrategy = require('./strategies/VenusYieldStrategy');
const MarketMonitorAgent = require('./agents/MarketMonitorAgent');
const MultiPairManager = require('./trading/multiPairManager');
const AvantisIntegration = require('./leverage/avantisIntegration');
const TechnicalAnalysis = require('./analysis/technicalAnalysis');
const RangingStrategy = require('./rangingStrategy');

// Import new AI modules
const MarketResearchAgent = require('./agents/MarketResearchAgent');
const TradingStrategyAgent = require('./agents/TradingStrategyAgent');
const RAGSystem = require('./rag/RAGSystem');
const { sequelize, Trade, MarketData, BotLog, Alert, AgentActivity, StrategyPerformance } = require('./database/models');

// Import critical security and optimization modules
const SecureKeyManager = require('./security/keyManager');
const CircuitBreaker = require('./risk/circuitBreaker'); // ✅ EXPERT: Loss protection circuit breaker
const ProductionRiskManager = require('./risk/productionRiskManager'); // ✅ FIX #4: Add risk manager
const SmartRebalancer = require('./risk/smartRebalancer'); // ✅ EXPERT FIX: Smart portfolio rebalancer
const TransactionVerifier = require('./security/transactionVerifier'); // ✅ SECURITY: Transaction verification
const GasOptimizer = require('./optimization/gasOptimizer');
const MetricsCollector = require('./monitoring/metricsCollector');
const EventManager = require('./events/eventManager');
const CacheManager = require('./optimization/cacheManager');
const MEVProtection = require('./security/mevProtection');
const SmartContractVerifier = require('./security/contractVerifier');

// 👻 Import Shadow Mode for safe testing
const ShadowMode = require('./testing/shadowMode');

// 🐛 Import BugBot Integration for automated bug detection
const BugBotIntegration = require('./monitoring/bugbot-integration');

class AdvancedTradingBot {
  constructor() {
    this.walletManager = new WalletManager();
    this.multiDexManager = null;
    this.multiPairManager = null;
    this.avantisIntegration = null;
    this.technicalAnalysis = null;
    this.strategy = null;
    this.isRunning = false;

    // AI Agents
    this.marketResearchAgent = new MarketResearchAgent();
    this.tradingStrategyAgent = null; // Will be initialized after PancakeSwap
    this.ragSystem = new RAGSystem();

    // $60K Portfolio Strategies
    this.leverageStrategy = null; // Will be initialized after wallet setup
    this.marketMaker = null; // Will be initialized after DEX setup
    this.marketMonitor = null; // Will be initialized after price history setup

    // Critical security and optimization components
    this.keyManager = new SecureKeyManager();
    this.circuitBreaker = new CircuitBreaker();
    // ✅ FIX #4: Initialize risk manager with conservative limits
    // Shadow mode: Relaxed limits for small portfolios
    const isShadowMode = process.env.SHADOW_MODE_ENABLED === 'true';
    // Let ProductionRiskManager use its own shadow mode detection and limits
    this.riskManager = new ProductionRiskManager();

    // Reset if in emergency shutdown on startup
    if (this.riskManager.emergencyState.isShutdown) {
      logger.warn('⚠️ Bot was in emergency shutdown, resetting for new session...');
      this.riskManager.reset();
    }

    // 🔧 CRITICAL FIX: Set portfolio value IMMEDIATELY for shadow mode
    if (this.shadowMode && this.shadowMode.isActive) {
      logger.info('🔄 Setting initial portfolio value for shadow mode...');
      const virtualBalances = this.shadowMode.getVirtualBalances();
      this.riskManager.updatePortfolioValue(virtualBalances.usdt + (virtualBalances.bnb * 0.00078)); // Use approximate price
      logger.info(`✅ Risk manager portfolio value set: $${this.riskManager.state.portfolioValue.toFixed(2)}`);
    }
    // ✅ SECURITY: Initialize transaction verifier and rate limiter
    this.txVerifier = new TransactionVerifier();
    this.rateLimiter = new RateLimiter({
      maxTradesPerHour: parseInt(process.env.RATE_LIMIT_HOURLY) || 20,   // Higher for shadow mode
      maxTradesPerDay: parseInt(process.env.RATE_LIMIT_DAILY) || 100     // Higher for shadow mode
    });
    this.gasOptimizer = null; // Will be initialized with provider
    this.metricsCollector = new MetricsCollector();
    this.eventManager = new EventManager();
    this.priceHistoryManager = new PriceHistoryManager();
    this.cacheManager = new CacheManager();
    this.mevProtection = null; // Will be initialized with provider and wallet
    this.contractVerifier = null; // Will be initialized with provider

    // 🐛 BugBot Integration - Automated bug detection
    this.bugBot = new BugBotIntegration();

    // 👻 Shadow Mode - Safe testing without real trades
    this.shadowMode = new ShadowMode(this, {
      enabled: process.env.SHADOW_MODE_ENABLED === 'true',
      recordToFile: process.env.SHADOW_MODE_RECORD === 'true',
      recordPath: process.env.SHADOW_MODE_RECORD_PATH || './.shadow-trades.json',
      maxRecords: parseInt(process.env.SHADOW_MODE_MAX_RECORDS) || 10000,
      compareWithLive: process.env.SHADOW_MODE_COMPARE_WITH_LIVE === 'true'
    });

    // 🔧 FIX: Initialize centralized portfolio manager
    this.portfolioManager = null; // Will be initialized after multiDexManager
    logger.info('✅ Portfolio Manager will be initialized after DEX setup');

    // ⚖️ Smart Rebalancer - Maintains 50/50 USDT/BNB split
    this.rebalancer = new SmartRebalancer(this);

    // 🔥 FIX #7: Register shadow mode globally so strategy can access virtual balances
    global.shadowMode = this.shadowMode;
    // 🚨 EXPERT: Register bot globally for circuit breaker access
    global.bot = this;

    // API Server
    this.app = null;
    this.server = null;

    // Note: Rate limiter already initialized above with RateLimiter class (line 75)
    // Don't overwrite it here

    this.stats = {
      startTime: null,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      lastPrice: null,
      agents: {
        marketResearch: { executions: 0, success: 0, lastActivity: null },
        tradingStrategy: { executions: 0, success: 0, lastActivity: null }
      }
    };
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Advanced BSC Trading Bot...');

      // Initialize database
      await sequelize.authenticate();
      logger.info('✅ Database connected');

      // Initialize database tables
      try {
        await sequelize.sync({ force: false, alter: true });
        logger.info('✅ Database tables initialized');

        // Verify tables exist
        const tables = await sequelize.getQueryInterface().showAllTables();
        logger.info(`📊 Database tables: ${tables.join(', ')}`);
      } catch (error) {
        logger.error('❌ Database initialization error:', error.message);
        throw new Error('Database initialization failed');
      }

      // Initialize RAG system (optional)
      try {
        await this.ragSystem.initialize();
        logger.info('✅ RAG system initialized');
      } catch (ragError) {
        logger.warn('⚠️ RAG system initialization failed (continuing without it):', ragError.message);
      }

      // Initialize price history manager
      await this.priceHistoryManager.initialize();
      logger.info('✅ Price history manager initialized');

      // ✅ FIX: Connect wallet FIRST before using getProvider()
      // Wallet connection is handled by start-with-password.js via walletManager.connect()
      // Just verify it's connected
      if (!this.walletManager.isConnected) {
        // In shadow mode, we need provider and wallet for contract calls, but no real trading
        if (this.shadowMode.options.enabled) {
          logger.info('👻 Shadow mode - initializing provider and wallet for contract calls (no real trading)');
          // Initialize provider without wallet connection
          this.walletManager.provider = new (require('./providers/multiRPCProvider'))();
          // Add getProvider method for shadow mode
          this.walletManager.getProvider = () => this.walletManager.provider;
          // Create a mock wallet for contract calls (read-only)
          const { Wallet } = require('ethers');
          this.walletManager.wallet = Wallet.createRandom().connect(this.walletManager.provider);
          this.walletManager.getWallet = () => this.walletManager.wallet;
          this.walletManager.isConnected = true;
        } else {
          logger.info('🔗 Connecting wallet...');
          await this.walletManager.connect(); // Will use encrypted wallet
        }
      }

      if (!this.shadowMode.options.enabled) {
        logger.info('✅ Wallet connected');
      }

      // 👻 Initialize Shadow Mode if enabled
      if (this.shadowMode.options.enabled) {
        await this.shadowMode.start();
        logger.warn('⚠️  SHADOW MODE ACTIVE - NO REAL TRADES WILL BE EXECUTED');
        logger.warn('⚠️  All trades will be simulated and recorded for analysis');
      } else {
        logger.info('💰 LIVE TRADING MODE - Real trades will be executed');
      }

      // Initialize security components with provider (AFTER wallet connection)
      if (this.shadowMode.options.enabled) {
        logger.info('👻 Shadow mode - initializing mock security components');
        // Mock providers for shadow mode
        this.gasOptimizer = { estimateGas: () => Promise.resolve({ gasPrice: '5000000000' }) };
        this.mevProtection = { checkMEV: () => Promise.resolve({ safe: true }) };
        this.contractVerifier = { verifyContract: () => Promise.resolve({ verified: true }) };
      } else {
        this.gasOptimizer = new GasOptimizer(this.walletManager.getProvider());
        this.mevProtection = new MEVProtection(this.walletManager.getProvider(), this.walletManager.getWallet());
        this.contractVerifier = new SmartContractVerifier(this.walletManager.getProvider());
      }

      // Initialize Multi-DEX Manager
      // ✅ SECURITY FIX #3: Pass transaction verifier to MultiDexManager
      if (this.shadowMode.options.enabled) {
        logger.info('👻 Shadow mode - initializing MultiDexManager with real price data but mock trading');
        // In shadow mode, use real MultiDexManager for price data but mock trading functions
        // Need a wallet for contract calls, but we'll mock the trading functions
        this.multiDexManager = new MultiDexManager(
          this.walletManager.getProvider(),
          this.walletManager.getWallet(), // Use wallet for contract calls
          this.txVerifier
        );

        // Override trading functions to be mock while keeping price data real
        const originalPancakeSwap = this.multiDexManager.dexs.pancakeSwap;

        // Debug: Log available methods
        logger.info(`Original PancakeSwap methods: ${Object.getOwnPropertyNames(originalPancakeSwap)}`);
        logger.info(`Has getCurrentPrice: ${typeof originalPancakeSwap.getCurrentPrice}`);

        // Preserve all original methods and add mock trading methods
        Object.setPrototypeOf(originalPancakeSwap, originalPancakeSwap.__proto__);
        originalPancakeSwap.getUSDTBalance = () => Promise.resolve(60000.0);
        originalPancakeSwap.getBNBBalance = () => Promise.resolve(73.2);
        originalPancakeSwap.buy = () => Promise.resolve({ success: true, reason: 'shadow_mode' });
        originalPancakeSwap.sell = () => Promise.resolve({ success: true, reason: 'shadow_mode' });
        originalPancakeSwap.getGasPrice = () => Promise.resolve('5000000000');
        originalPancakeSwap.estimateGas = () => Promise.resolve(21000);

        // Keep the original object with added mock methods
        this.multiDexManager.dexs.pancakeSwap = originalPancakeSwap;
      } else {
        this.multiDexManager = new MultiDexManager(
          this.walletManager.getProvider(),
          this.walletManager.getWallet(),
          this.txVerifier  // Pass transaction verifier for pre-send validation
        );
      }

      // Initialize Multi-Pair Manager
      this.multiPairManager = new MultiPairManager();

      // Initialize Leverage Integration
      if (this.shadowMode.options.enabled) {
        logger.info('👻 Shadow mode - initializing mock AvantisIntegration');
        this.avantisIntegration = {
          getPositions: () => Promise.resolve([]),
          openPosition: () => Promise.resolve({ success: false, reason: 'shadow_mode' })
        };
      } else {
        this.avantisIntegration = new AvantisIntegration(
          this.walletManager.getProvider(),
          this.walletManager.getWallet()
        );
      }

      // Initialize Technical Analysis
      this.technicalAnalysis = new TechnicalAnalysis();

      // Initialize trading strategy agent (using first DEX for compatibility)
      this.tradingStrategyAgent = new TradingStrategyAgent(this.multiDexManager.dexs.pancakeSwap, this.priceHistoryManager);

      // 🔥 FIX #2: Register trading strategy agent globally for cooldown updates
      global.tradingStrategyAgent = this.tradingStrategyAgent;

      // Initialize $60K Portfolio Strategies
      this.leverageStrategy = new LeverageStrategy(
        this.walletManager.getProvider(),
        this.walletManager.getWallet()
      );
      this.marketMaker = new MarketMakingStrategy(
        this.multiDexManager.dexs.pancakeSwap,
        config.trading?.marketMaking?.allocation || 8000
      );
      this.venusStrategy = new VenusYieldStrategy(
        this.walletManager.getProvider(),
        this.walletManager.getWallet(),
        config.trading?.yield || { enabled: false }
      );
      this.marketMonitor = new MarketMonitorAgent(this.priceHistoryManager);

      // Initialize strategy (using first DEX for compatibility)
      this.strategy = new RangingStrategy(this.multiDexManager.dexs.pancakeSwap);
      await this.strategy.initialize();

      // Initialize Venus yield strategy
      if (config.trading?.yield?.enabled) {
        await this.venusStrategy.initialize();
        logger.info(`✅ Venus yield strategy initialized with $${config.trading.yield.allocation}`);
      }

      // 🔧 FIX: Initialize portfolio manager with dependencies
      if (!this.portfolioManager) {
        this.portfolioManager = new PortfolioManager(this.shadowMode, this.multiDexManager);
        logger.info('✅ Portfolio Manager initialized');
      }

      // Initial portfolio value refresh
      await this.portfolioManager.refresh();
      logger.info(`💼 Initial portfolio value: $${this.portfolioManager.cachedValue.toFixed(2)}`);

      // Subscribe risk manager to portfolio updates
      this.portfolioManager.subscribe((newValue) => {
        this.riskManager.updatePortfolioValue(newValue);
        logger.debug(`💼 Risk manager notified of portfolio change: $${newValue.toFixed(2)}`);
      });

      // 🔧 URGENT FIX: Clear any old positions with NaN bugs
      if (this.tradingStrategyAgent && this.tradingStrategyAgent.activePositions) {
        const oldPositionsCount = this.tradingStrategyAgent.activePositions.size;
        this.tradingStrategyAgent.activePositions.clear();
        logger.info(`🧹 Cleared ${oldPositionsCount} old positions on startup (removing NaN bugs)`);
      }

      // Check initial balances
      let usdtBalance, bnbBalance;
      if (this.shadowMode.options.enabled) {
        logger.info('👻 Shadow mode - using mock balances');
        // Get balances from shadow mode's virtual portfolio
        const shadowBalances = this.shadowMode.getVirtualBalances();
        usdtBalance = shadowBalances.usdt;
        bnbBalance = shadowBalances.bnb;

        logger.info(`Initial Balances (SHADOW MODE):`);
        logger.info(`USDT: ${usdtBalance.toFixed(2)}`);
        logger.info(`BNB: ${bnbBalance.toFixed(6)}`);
      } else {
        usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();

        logger.info(`Initial Balances:`);
        logger.info(`USDT: ${usdtBalance.toFixed(2)}`);
        logger.info(`BNB: ${bnbBalance.toFixed(6)}`);
      }

      // Get current BNB price for portfolio calculation
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();

      // Store initial market data
      await this.storeMarketData({
        symbol: 'USDT/BNB',
        price: currentPrice,
        volume: 0,
        timestamp: new Date()
      });

      // Check if we have enough balance to start
      if (usdtBalance < config.trading.minTradeAmount && bnbBalance < 0.001) {
        throw new Error('Insufficient balance to start trading');
      }

      // ✅ FIX: Calculate and update portfolio value for risk manager
      // Get balances from shadow mode if active
      let actualUsdtBalance, actualBnbBalance;
      if (this.shadowMode && this.shadowMode.isActive) {
        const virtualBalances = this.shadowMode.getVirtualBalances();
        actualUsdtBalance = virtualBalances.usdt;
        actualBnbBalance = virtualBalances.bnb;
        logger.info('💼 Using shadow mode balances for initial portfolio value');
      } else {
        actualUsdtBalance = usdtBalance;
        actualBnbBalance = bnbBalance;
      }

      // Price is BNB per USDT, so 1 BNB = 1/price USDT
      const bnbValueInUsd = actualBnbBalance / currentPrice;
      const totalPortfolioValue = actualUsdtBalance + bnbValueInUsd;
      this.riskManager.updatePortfolioValue(totalPortfolioValue);
      logger.info(`💼 Portfolio value updated: $${totalPortfolioValue.toFixed(2)} (USDT: $${actualUsdtBalance.toFixed(2)} + BNB: $${bnbValueInUsd.toFixed(2)})`);

      this.stats.startTime = new Date();

      // Initialize API server
      await this.initializeAPI();

      // 🔧 FIX: Full reset APRÈS l'initialisation
      if (this.shadowMode && this.shadowMode.isActive) {
        logger.info('🔄 Performing full shadow mode reset...');

        // Full reset of shadow mode
        this.shadowMode.fullReset();
        logger.info('✅ Shadow mode reset completed');

        // Clear activePositions
        if (this.tradingStrategyAgent && this.tradingStrategyAgent.activePositions) {
          this.tradingStrategyAgent.activePositions.clear();
          logger.info('🧹 Active positions cleared');
        }

        // Update risk manager avec balances corrects
        const virtualBalances = this.shadowMode.getVirtualBalances();
        const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
        const totalValue = virtualBalances.usdt + (virtualBalances.bnb / currentPrice); // FIX: DIVIDE by price (price = BNB per USDT)
        this.riskManager.updatePortfolioValue(totalValue);

        logger.info(`✅ Risk manager portfolio value: $${totalValue.toFixed(2)}`);
        logger.info('🔄 Shadow mode reset complete - fresh start ready');

        // Start risk manager monitoring AFTER reset is complete
        this.riskManager.startMonitoring();
        logger.info('✅ Risk manager monitoring started');
      }

      logger.info('✅ Advanced Trading Bot initialized successfully!');
      return true;
    } catch (error) {
      logger.error('❌ Error initializing bot:', error);
      await this.logError('initialization', error);
      throw error;
    }
  }

  async initializeAPI() {
    this.app = express();

    // Middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    // Rate limiting
    if (this.rateLimiter) {
      this.app.use(async (req, res, next) => {
        try {
          await this.rateLimiter.consume(req.ip);
          next();
        } catch (rejRes) {
          res.status(429).json({ error: 'Too many requests' });
        }
      });
    }

    // API Routes
    this.setupAPIRoutes();

    // Start server
    const PORT = process.env.API_PORT || 3001;
    this.server = this.app.listen(PORT, () => {
      logger.info(`🌐 API server running on port ${PORT}`);
    });
  }

  setupAPIRoutes() {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date(),
          uptime: this.getUptime(),
          bot: {
            running: this.isRunning,
            startTime: this.stats.startTime
          },
          shadowMode: {
            enabled: this.shadowMode.options.enabled,
            active: this.shadowMode.isActive,
            stats: this.shadowMode.getStats()
          },
          agents: {
            marketResearch: await this.marketResearchAgent.healthCheck(),
            tradingStrategy: await this.tradingStrategyAgent.healthCheck()
          },
          rag: await this.ragSystem.healthCheck()
        };
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bot status
    this.app.get('/api/status', async (req, res) => {
      try {
        const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
        const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
        const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();

        const totalValue = usdtBalance + (bnbBalance * currentPrice);
        const profit = totalValue - config.trading.initialBudget;

        const status = {
          status: 'healthy',
          running: this.isRunning,
          balances: {
            usdt: usdtBalance,
            bnb: bnbBalance,
            totalValue: totalValue
          },
          performance: {
            profit: profit,
            profitPercent: (profit / config.trading.initialBudget) * 100,
            totalTrades: this.stats.totalTrades,
            successRate: this.stats.totalTrades > 0 ? (this.stats.successfulTrades / this.stats.totalTrades) * 100 : 0
          },
          currentPrice: currentPrice,
          strategy: this.strategy.getStatus(),
          uptime: this.getUptime()
        };

        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // RAG query endpoint
    this.app.post('/api/rag/query', async (req, res) => {
      try {
        const { query, contextTypes } = req.body;

        if (!query) {
          return res.status(400).json({ error: 'Query is required' });
        }

        const result = await this.ragSystem.query(query, contextTypes);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Market analysis
    this.app.get('/api/market/analysis', async (req, res) => {
      try {
        const analysis = await this.marketResearchAgent.execute({
          action: 'research',
          query: 'BSC BNB USDT market analysis',
          timeframe: '24h'
        });

        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // BugBot status - Critical bugs and anomalies
    this.app.get('/api/bugbot/status', async (req, res) => {
      try {
        const criticalBugs = this.bugBot.getCriticalBugs();

        res.json({
          status: criticalBugs.length === 0 ? 'healthy' : 'issues_detected',
          criticalBugsCount: criticalBugs.length,
          criticalBugs: criticalBugs.slice(-10), // Last 10 critical bugs
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Trading logs
    this.app.get('/api/trades', async (req, res) => {
      try {
        const { limit = 50, offset = 0 } = req.query;

        const trades = await Trade.findAndCountAll({
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['created_at', 'DESC']]
        });

        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bot logs
    this.app.get('/api/logs', async (req, res) => {
      try {
        const { level, limit = 100 } = req.query;

        const where = {};
        if (level) where.level = level;

        const logs = await BotLog.findAll({
          where,
          limit: parseInt(limit),
          order: [['created_at', 'DESC']]
        });

        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Agent activity
    this.app.get('/api/agents/activity', async (req, res) => {
      try {
        const { agent_name, limit = 50 } = req.query;

        const where = {};
        if (agent_name) where.agent_name = agent_name;

        const activity = await AgentActivity.findAll({
          where,
          limit: parseInt(limit),
          order: [['created_at', 'DESC']]
        });

        res.json(activity);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Control endpoints
    this.app.post('/api/control/start', async (req, res) => {
      try {
        if (this.isRunning) {
          return res.json({ message: 'Bot is already running' });
        }

        await this.start();
        res.json({ message: 'Bot started successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/control/stop', async (req, res) => {
      try {
        if (!this.isRunning) {
          return res.json({ message: 'Bot is not running' });
        }

        await this.stop();
        res.json({ message: 'Bot stopped successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/control/emergency-stop', async (req, res) => {
      try {
        await this.emergencyStop();
        res.json({ message: 'Emergency stop executed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Bot is already running');
        return;
      }

      await this.initialize();
      this.isRunning = true;

      logger.info('🚀 Starting Advanced BSC Trading Bot...');
      logger.info(`Trading Pair: ${config.trading.pair}`);
      logger.info(`Initial Budget: ${config.trading.initialBudget} USDT`);

      // Enhanced strategy execution with AI agents
      cron.schedule('*/30 * * * * *', async () => {
        if (this.isRunning) {
          await this.runAdvancedStrategy();
        }
      });

      // Market research every 5 minutes
      cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning) {
          await this.performMarketResearch();
        }
      });

      // Log status every 10 minutes
      cron.schedule('*/10 * * * *', async () => {
        if (this.isRunning) {
          await this.logStatus();
        }
      });

      // Data cleanup every hour
      cron.schedule('0 * * * *', async () => {
        if (this.isRunning) {
          await this.performDataCleanup();
        }
      });

      // $60K Portfolio - Market regime detection (hourly)
      cron.schedule('0 * * * *', async () => {
        if (this.isRunning && this.marketMonitor) {
          await this.marketMonitor.detectMarketRegime();
        }
      });

      // $60K Portfolio - Leverage position monitoring (every minute)
      cron.schedule('* * * * *', async () => {
        if (this.isRunning && this.leverageStrategy && this.leverageStrategy.positions.size > 0) {
          try {
            const price = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
            await this.leverageStrategy.monitorPositions(price);
          } catch (error) {
            logger.error('Error monitoring leverage positions:', error);
          }
        }
      });

      // $60K Portfolio - Market making (every 5 minutes)
      cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning && this.marketMaker && config.trading?.marketMaking?.enabled) {
          try {
            await this.marketMaker.execute();
          } catch (error) {
            logger.error('Error in market making:', error);
          }
        }
      });

      // $60K Portfolio - Yield position check (hourly)
      cron.schedule('0 * * * *', async () => {
        if (this.isRunning && this.venusStrategy && config.trading?.yield?.enabled) {
          try {
            const performance = await this.venusStrategy.checkYieldPerformance();
            if (performance) {
              logger.info(`💰 Venus Performance: $${performance.currentBalance.toFixed(2)} balance, $${performance.yieldEarned.toFixed(2)} earned, ${performance.annualizedAPY.toFixed(2)}% APY`);
            }
          } catch (error) {
            logger.error('Error checking yield performance:', error);
          }
        }
      });

      // $60K Portfolio - Market regime detection (hourly)
      cron.schedule('0 * * * *', async () => {
        if (this.isRunning && this.marketMonitor) {
          try {
            const regimeData = await this.marketMonitor.detectMarketRegime();
            if (regimeData) {
              logger.warn(`📊 REGIME: ${regimeData.regime} | Strategies: ${regimeData.strategies.join(', ')} | Volatility: ${(regimeData.volatility * 100).toFixed(2)}%`);
            }
          } catch (error) {
            logger.error('Error in market regime detection:', error);
          }
        }
      });

      // 🚨 CRITICAL FIX: Position monitoring (every 30 seconds)
      cron.schedule('*/30 * * * * *', async () => {
        if (this.isRunning && this.tradingStrategyAgent) {
          try {
            logger.info('🔄 Running position monitoring cron job...');
            await this.tradingStrategyAgent.monitorPositions();
          } catch (error) {
            logger.error('Error monitoring positions:', error);
          }
        }
      });

      // 🚨 CRITICAL FIX: Emergency kill switch (every 10 seconds)
      cron.schedule('*/10 * * * * *', async () => {
        if (this.isRunning) {
          try {
            await this.checkEmergencyStop();
          } catch (error) {
            logger.error('Error checking emergency stop:', error);
          }
        }
      });

      // Schedule every 5 minutes: BugBot metrics monitoring
      cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning) {
          try {
            // Get current trading metrics
            const trades = await Trade.findAll({
              attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalTrades'],
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'closed' THEN 1 ELSE 0 END")), 'exits'],
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN pnl > 0 THEN 1 ELSE 0 END")), 'wins'],
                [sequelize.fn('SUM', sequelize.literal("CASE WHEN pnl < 0 THEN 1 ELSE 0 END")), 'losses'],
                [sequelize.fn('SUM', sequelize.col('pnl')), 'totalPnL']
              ],
              raw: true
            });

            const metrics = {
              totalTrades: parseInt(trades[0].totalTrades) || 0,
              exits: parseInt(trades[0].exits) || 0,
              wins: parseInt(trades[0].wins) || 0,
              losses: parseInt(trades[0].losses) || 0,
              totalPnL: parseFloat(trades[0].totalPnL) || 0
            };

            // Monitor for anomalies
            await this.bugBot.monitorTradingMetrics(metrics);
          } catch (error) {
            logger.error('Error in BugBot metrics monitoring:', error);
          }
        }
      });

      // ⚖️ Smart Portfolio Rebalancing (every 6 hours)
      cron.schedule('0 */6 * * *', async () => {
        if (this.isRunning) {
          try {
            logger.info('🔄 Running scheduled portfolio rebalance check...');
            if (await this.rebalancer.shouldRebalance()) {
              await this.rebalancer.rebalance();
            } else {
              logger.debug('✅ Portfolio balanced, no action needed');
            }
          } catch (error) {
            logger.error(`Portfolio rebalance error: ${error.message}`);
          }
        }
      });
      logger.info('✅ Smart portfolio rebalancing scheduled (every 6 hours)');

      // Initial strategy run
      await this.runAdvancedStrategy();

      logger.info('✅ Advanced Trading Bot started successfully!');
    } catch (error) {
      logger.error('❌ Error starting bot:', error);
      this.isRunning = false;
      await this.logError('startup', error);
      throw error;
    }
  }

  async getBalance() {
    // Use global shadow mode to ensure consistency with trading strategy
    if (global.shadowMode && global.shadowMode.getVirtualBalances) {
      const virtualBalances = global.shadowMode.getVirtualBalances();
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      return {
        usdt: virtualBalances.usdt,
        bnb: virtualBalances.bnb,
        currentPrice: currentPrice
      };
    } else if (this.shadowMode && this.shadowMode.isActive) {
      const virtualBalances = this.shadowMode.getVirtualBalances();
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      return {
        usdt: virtualBalances.usdt,
        bnb: virtualBalances.bnb,
        currentPrice: currentPrice
      };
    } else {
      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      return {
        usdt: usdtBalance,
        bnb: bnbBalance,
        currentPrice: currentPrice
      };
    }
  }

  async rebalancePortfolio() {
    try {
      const balance = await this.getBalance();

      // Target: 50% USDT, 50% BNB for optimal trading
      const totalValueUSD = balance.usdt + (balance.bnb * balance.currentPrice);
      const targetUSDT = totalValueUSD * 0.50;
      const targetBNB = (totalValueUSD * 0.50) / balance.currentPrice;

      // Safety check: if price is too low, use reasonable BNB amount
      const maxReasonableBNB = 1000; // Max 1000 BNB for testing
      const finalTargetBNB = Math.min(targetBNB, maxReasonableBNB);

      const usdtDiff = targetUSDT - balance.usdt;
      const bnbDiff = finalTargetBNB - balance.bnb;

      logger.info(`💰 Portfolio Rebalance Check:`);
      logger.info(`   Current: ${balance.usdt.toFixed(2)} USDT, ${balance.bnb.toFixed(2)} BNB`);
      logger.info(`   Target: ${targetUSDT.toFixed(2)} USDT, ${finalTargetBNB.toFixed(2)} BNB`);
      logger.info(`   Diff: ${usdtDiff.toFixed(2)} USDT, ${bnbDiff.toFixed(2)} BNB`);

      // Rebalance if imbalance > 20%
      const imbalancePercent = Math.abs(usdtDiff / targetUSDT);

      if (imbalancePercent > 0.20) {
        logger.warn(`⚠️ Portfolio imbalance detected: ${(imbalancePercent * 100).toFixed(1)}%`);

        if (usdtDiff > 0) {
          // Need more USDT - sell some BNB
          const bnbToSell = Math.abs(usdtDiff) / balance.currentPrice;
          logger.info(`📉 Rebalancing: Selling ${bnbToSell.toFixed(4)} BNB for USDT`);

          if (global.shadowMode && global.shadowMode.virtualPortfolio) {
            // Update virtual balances directly
            global.shadowMode.virtualPortfolio.bnb -= bnbToSell;
            global.shadowMode.virtualPortfolio.usdt += Math.abs(usdtDiff);
            logger.info(`✅ Virtual portfolio rebalanced: ${global.shadowMode.virtualPortfolio.usdt.toFixed(2)} USDT, ${global.shadowMode.virtualPortfolio.bnb.toFixed(4)} BNB`);
          } else {
            await this.multiDexManager.dexs.pancakeSwap.executeTrade('sell', bnbToSell);
          }
        } else {
          // Need more BNB - buy with USDT
          const usdtToSpend = Math.abs(usdtDiff);
          logger.info(`📈 Rebalancing: Buying BNB with ${usdtToSpend.toFixed(2)} USDT`);

          if (global.shadowMode && global.shadowMode.virtualPortfolio) {
            // Update virtual balances directly
            const bnbToBuy = usdtToSpend / balance.currentPrice;
            global.shadowMode.virtualPortfolio.usdt -= usdtToSpend;
            global.shadowMode.virtualPortfolio.bnb += bnbToBuy;
            logger.info(`✅ Virtual portfolio rebalanced: ${global.shadowMode.virtualPortfolio.usdt.toFixed(2)} USDT, ${global.shadowMode.virtualPortfolio.bnb.toFixed(4)} BNB`);
          } else {
            await this.multiDexManager.dexs.pancakeSwap.executeTrade('buy', usdtToSpend);
          }
        }

        return true;
      } else {
        logger.debug(`✅ Portfolio balanced: ${(imbalancePercent * 100).toFixed(1)}% imbalance`);
        return false;
      }
    } catch (error) {
      logger.error(`Portfolio rebalance error: ${error.message}`);
      return false;
    }
  }

  async runAdvancedStrategy() {
    try {
      // 🚨 EXPERT: Check circuit breaker first
      if (!this.circuitBreaker.canTrade()) {
        logger.warn('⏸️  Trading paused by circuit breaker');
        return;
      }

      // Check and rebalance portfolio first (disabled for now due to calculation issues)
      // const rebalanced = // await this.rebalancePortfolio();
      // if (rebalanced) {
      //   logger.info('Portfolio rebalanced, skipping this trading cycle');
      //   return;
      // }

      // Get current market data
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();

      // Add price to persistent history
      if (this.priceHistoryManager) {
        await this.priceHistoryManager.addPrice(currentPrice);
      }

      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();

      // Circuit Breaker: Check daily loss limit BEFORE executing strategy
      const todayLoss = await this.calculateTodayLoss();
      const maxDailyLoss = 0.05; // 5% max daily loss
      if (todayLoss >= maxDailyLoss) {
        logger.error(`🚨 Circuit breaker triggered: ${(todayLoss * 100).toFixed(1)}% loss today (limit: ${(maxDailyLoss * 100).toFixed(1)}%)`);
        return {
          action: 'hold',
          confidence: 0,
          reasoning: `Daily loss limit reached: ${(todayLoss * 100).toFixed(1)}%`,
          position_size: 0,
          parameters: {
            todayLoss: todayLoss * 100,
            maxDailyLoss: maxDailyLoss * 100,
            circuitBreaker: true
          }
        };
      }

      // Store market data
      await this.storeMarketData({
        symbol: 'USDT/BNB',
        price: currentPrice,
        volume: 0, // Would be fetched from DEX API
        timestamp: new Date()
      });

      // Select optimal strategy based on market conditions
      const selectedStrategy = this.selectBestStrategy(currentPrice, this.priceHistoryManager.getHistory());

      // Add comprehensive market diagnostics
      try {
        const diagnostics = this.getMarketDiagnostics(currentPrice, this.priceHistoryManager.getHistory());
        logger.info('=== MARKET DIAGNOSTICS ===');
        logger.info('Selected Strategy: ' + selectedStrategy);
        logger.info('Current Price: ' + diagnostics.currentPrice);
        logger.info('Price Change: ' + diagnostics.priceChange);
        logger.info('Volatility: ' + diagnostics.volatility);
        logger.info('Range: ' + diagnostics.range);
        logger.info('Z-Score: ' + diagnostics.zScore);
        logger.info('Ranging Met: ' + diagnostics.rangingThreshold.met);
        logger.info('Momentum Met: ' + diagnostics.momentumThreshold.met);
        logger.info('Mean Reversion Met: ' + diagnostics.meanReversionThreshold.met);
        logger.info('========================');
      } catch (error) {
        logger.error('Diagnostic error:', error.message);
      }

      // Create immutable price snapshot for consistent analysis and strategy execution
      const priceSnapshot = [...this.priceHistoryManager.getHistory()];
      const marketDataSnapshot = {
        currentPrice,
        priceHistory: priceSnapshot,
        timestamp: Date.now()
      };

      // Get AI-powered market analysis with immutable snapshot
      const marketAnalysis = await this.tradingStrategyAgent.execute({
        action: 'analyze',
        marketData: marketDataSnapshot,
        researchData: this.latestResearchData
      });

      // Make AI-powered trading decision with immutable snapshot
      const tradingDecision = await this.tradingStrategyAgent.execute({
        action: 'decide',
        strategy: selectedStrategy,
        marketData: marketDataSnapshot,
        researchData: this.latestResearchData
      });

      // Execute decision based on mode
      // Shadow mode: Execute all decisions (no risk)
      // Live mode: Only execute high-confidence decisions (> 70%)
      const minConfidence = (this.shadowMode && this.shadowMode.isActive) ? 0.5 : 0.7;

      if (tradingDecision.confidence >= minConfidence) {
        await this.executeTradingDecision(tradingDecision, selectedStrategy);
      } else {
        logger.debug(`⏭️ Skipping trade - confidence ${(tradingDecision.confidence * 100).toFixed(0)}% below minimum ${(minConfidence * 100).toFixed(0)}%`);
      }

      // Store trading log in RAG system
      await this.ragSystem.storeTradingLog({
        action: tradingDecision.action,
        pair: 'USDT/BNB',
        amount: tradingDecision.position_size || 0,
        price: currentPrice,
        timestamp: new Date(),
        reasoning: tradingDecision.reasoning,
        success: tradingDecision.action !== 'hold'
      });

      this.stats.lastPrice = currentPrice;

      logger.info(`🧠 AI Strategy executed - Action: ${tradingDecision.action}, Confidence: ${(tradingDecision.confidence * 100).toFixed(1)}%, Reasoning: ${tradingDecision.reasoning}`);

    } catch (error) {
      logger.error('❌ Error running advanced strategy:', error);
      this.stats.failedTrades++;
      await this.logError('strategy_execution', error);
    }
  }

  async executeTradingDecision(decision, strategy = 'unknown') {
    try {
      const { action, position_size, parameters } = decision;

      if (action === 'hold') {
        return;
      }

      // ✅ SECURITY: Check rate limit FIRST (if available)
      if (this.rateLimiter) {
        try {
          await this.rateLimiter.checkLimit();
        } catch (rateLimitError) {
          logger.warn('🚦 Trade blocked by rate limiter:', rateLimitError.message);
          throw rateLimitError;
        }
      } else {
        logger.debug('⚠️ Rate limiter not available, skipping check');
      }

      // 🚀 OPTIMIZATION #3: Add balance validation for shadow mode
      if (position_size && parameters && parameters.currentPrice && action !== 'hold') {
        // Get current balances
        let usdtBalance, bnbBalance;
        if (global.shadowMode && global.shadowMode.getVirtualBalances) {
          const virtualBalances = global.shadowMode.getVirtualBalances();
          usdtBalance = virtualBalances.usdt;
          bnbBalance = virtualBalances.bnb;
        } else {
          usdtBalance = await this.pancakeSwap.getUSDTBalance();
          bnbBalance = await this.pancakeSwap.getBNBBalance();
        }

        // 🔍 DEBUG: Log all values before calculation
        logger.info(`🔍 DEBUG BNB CALC:
  position_size (USD): ${position_size}
  currentPrice from params: ${parameters.currentPrice}
  Expected unit: BNB/USD (should be ~0.0007)
  BNB balance: ${bnbBalance}
`);

        // 🔧 FIX: Ensure currentPrice is valid and in correct unit (BNB/USD)
        let currentPrice = parameters.currentPrice;

        // If currentPrice is invalid, fetch real price
        if (!currentPrice || currentPrice === 1.0 || currentPrice > 0.01) {
          logger.warn(`⚠️ Invalid currentPrice: ${currentPrice}, fetching real price`);

          // Get real market price
          currentPrice = await this.getCurrentPrice();

          logger.info(`✅ Using market price: ${currentPrice}`);
        }

        // Verify it's in BNB/USD (should be ~0.0007)
        if (currentPrice > 0.01) {
          // It's probably USD/BNB, invert it
          currentPrice = 1 / currentPrice;
          logger.warn(`⚠️ Price was inverted, corrected to: ${currentPrice}`);
        }

        logger.info(`📊 Final currentPrice for BNB calc: ${currentPrice}`);

        // Validate balance for sell orders
        // 🔧 FIX: Convert position_size (USD) to BNB for comparison
        const bnbRequired = position_size * currentPrice; // USD * (BNB/USD) = BNB

        logger.info(`🔍 BNB Required calculation: ${position_size} USD × ${currentPrice} BNB/USD = ${bnbRequired.toFixed(6)} BNB`);

        if (action === 'sell' && bnbBalance < bnbRequired) {
          logger.warn(`🚫 Insufficient BNB: need ${bnbRequired.toFixed(6)} but have ${bnbBalance.toFixed(6)}`);
          return { success: false, reason: 'insufficient_bnb', required: bnbRequired, available: bnbBalance };
        }

        // Validate balance for buy orders
        if (action === 'buy' && usdtBalance < position_size) {
          logger.warn(`🚫 Insufficient USDT: need ${Number(position_size).toFixed(2)} but have ${usdtBalance.toFixed(2)}`);
          return { success: false, reason: 'insufficient_usdt', required: position_size, available: usdtBalance };
        }

        logger.debug(`✅ Balance validation passed: ${action} $${Number(position_size).toFixed(2)}`);
      }

      // ✅ FIX #6: Validate trade against risk limits BEFORE execution
      // Only validate if we have required parameters for actual trades
      if (position_size && parameters && parameters.currentPrice) {
        try {
          // 🔧 FIX: Use centralized portfolio manager
          const portfolioValue = await this.portfolioManager.getValue(true); // Force refresh for trade validation
          logger.debug(`💼 Portfolio value for validation: $${portfolioValue.toFixed(2)}`);

          await this.riskManager.validateTrade({
            action,
            amount: position_size,
            price: parameters.currentPrice,
            pair: 'USDT/BNB'
          });
          logger.debug('✅ Trade passed risk validation', {
            action,
            amount: position_size,
            price: parameters.currentPrice
          });
        } catch (riskError) {
          logger.warn('⚠️ Trade rejected by risk manager:', {
            reason: riskError.message,
            action,
            amount: position_size,
            price: parameters.currentPrice
          });
          throw new Error(`Risk validation failed: ${riskError.message}`);
        }
      } else {
        logger.debug('⚠️ Skipping risk validation - missing required parameters', {
          action,
          hasPositionSize: !!position_size,
          hasParameters: !!parameters,
          hasPrice: !!(parameters && parameters.currentPrice)
        });
      }

      // 👻 Shadow Mode Check - Simulate instead of execute
      if (this.shadowMode && this.shadowMode.isActive) {
        logger.info('👻 Shadow Mode: Simulating trade instead of executing');

        const shadowTrade = await this.shadowMode.executeShadowTrade({
          action,
          pair: 'USDT/BNB',
          amount: position_size,
          targetPrice: parameters.currentPrice,
          confidence: decision.confidence,
          reasoning: decision.reasoning
        });

        logger.info(`👻 Shadow Trade: ${action} ${position_size} at ${parameters.currentPrice}`);
        logger.info(`👻 Estimated Profit: ${shadowTrade?.estimatedProfit || 0} USDT`);
        logger.info(`👻 Would Execute: ${shadowTrade?.wouldExecute ? 'YES' : 'NO'}`);

        // 🔥 FIX #4: Create position for monitoring if trade would execute
        if (shadowTrade?.wouldExecute && action !== 'hold') {
          const positionId = `pos_${Date.now()}`;
          this.tradingStrategyAgent.activePositions.set(positionId, {
            id: positionId,
            action,
            entryPrice: parameters.currentPrice,
            size: position_size,
            entryTime: Date.now(),
            stopLoss: action === 'buy' ? parameters.currentPrice * 0.97 : parameters.currentPrice * 1.03,
            entryZScore: parameters.zScore || 0,
            strategy,
            confidence: decision.confidence
          });
          logger.info(`📊 Position ${positionId} created: ${action} $${position_size} @ ${parameters.currentPrice}`);
        }

        // Track strategy performance for shadow trades
        await this.recordStrategyPerformance(strategy, decision, {
          success: true,
          tradeId: `shadow_${Date.now()}`,
          profit: shadowTrade?.estimatedProfit || 0,
          executionTime: Date.now(),
          isShadow: true
        });

        // ✅ FIX: Update portfolio value after shadow trade (for risk manager)
        await this.updatePortfolioValue();

        return shadowTrade;
      }

      // 💰 Live Trading Mode - Execute real trades
      let receipt = null;

      // $60K Portfolio - Try leverage trading first
      if (this.leverageStrategy && action !== 'hold') {
        try {
          const marketData = {
            currentPrice: parameters.currentPrice,
            parameters: {
              zScore: parameters.zScore || 0,
              rsi: parameters.rsi || 50
            }
          };

          const leveragePosition = await this.leverageStrategy.openLeveragedPosition(decision, marketData);
          if (leveragePosition) {
            logger.info(`✅ Leveraged position opened: ${leveragePosition.id}`);
            return leveragePosition;
          }
        } catch (leverageError) {
          logger.error('❌ Leverage trading failed:', leverageError);
          // Continue to spot trading as fallback
        }
      }

      // ✅ FIX #5: Add proper error handling around trade execution
      if (action === 'buy' && position_size > 0) {
        try {
          const minBnbAmount = ethers.parseEther((position_size / parameters.currentPrice * 0.995).toString());
          receipt = await this.multiDexManager.dexs.pancakeSwap.swapUSDTForBNB(position_size, minBnbAmount);
          logger.info(`✅ Buy trade executed: ${position_size} USDT for BNB`);
        } catch (tradeError) {
          logger.error('❌ Buy trade execution failed:', {
            error: tradeError.message,
            stack: tradeError.stack,
            positionSize: position_size,
            price: parameters.currentPrice
          });
          throw new Error(`Failed to execute buy trade: ${tradeError.message}`);
        }
      } else if (action === 'sell' && position_size > 0) {
        try {
          const minUsdtAmount = ethers.parseEther((position_size * parameters.currentPrice * 0.995).toString());
          receipt = await this.multiDexManager.dexs.pancakeSwap.swapBNBForUSDT(position_size, minUsdtAmount);
          logger.info(`✅ Sell trade executed: ${position_size} BNB for USDT`);
        } catch (tradeError) {
          logger.error('❌ Sell trade execution failed:', {
            error: tradeError.message,
            stack: tradeError.stack,
            positionSize: position_size,
            price: parameters.currentPrice
          });
          throw new Error(`Failed to execute sell trade: ${tradeError.message}`);
        }
      }

      if (receipt && receipt.transactionHash) {
        // Store trade in database
        const trade = await Trade.create({
          type: action,
          token_pair: 'USDT/BNB',
          amount_in: position_size,
          amount_out: action === 'buy' ? position_size / parameters.currentPrice : position_size * parameters.currentPrice,
          price: parameters.currentPrice,
          transaction_hash: receipt.transactionHash,
          status: 'completed',
          strategy: decision.reasoning,
          profit_loss: 0 // Would calculate based on previous trades
        });

        // Track strategy performance
        await this.recordStrategyPerformance(strategy, decision, {
          success: true,
          tradeId: trade.id,
          profit: 0, // Will be calculated later
          executionTime: Date.now()
        });

        this.stats.totalTrades++;
        this.stats.successfulTrades++;

        // Create success alert
        await Alert.create({
          type: 'trade',
          severity: 'medium',
          title: `Trade Executed: ${action.toUpperCase()}`,
          message: `Successfully executed ${action} order for ${position_size} USDT/BNB at ${parameters.currentPrice}`,
          triggered_by: 'AI Strategy Agent',
          acknowledged: false
        });

        logger.info(`✅ Trade executed successfully: ${receipt.transactionHash}`);
      }

    } catch (error) {
      logger.error('❌ Error executing trading decision:', error);
      this.stats.failedTrades++;

      // Create error alert
      await Alert.create({
        type: 'trade',
        severity: 'high',
        title: `Trade Execution Failed: ${decision.action.toUpperCase()}`,
        message: `Failed to execute ${decision.action} order: ${error.message}`,
        triggered_by: 'AI Strategy Agent',
        acknowledged: false
      });

      throw error;
    }
  }

  async performMarketResearch() {
    try {
      logger.info('🔍 Performing market research...');

      const research = await this.marketResearchAgent.execute({
        action: 'research',
        query: 'BSC BNB USDT',
        timeframe: '24h'
      });

      this.latestResearchData = research;
      this.stats.agents.marketResearch.executions++;
      this.stats.agents.marketResearch.success++;
      this.stats.agents.marketResearch.lastActivity = new Date();

      // Store news articles in RAG system
      if (research.news && research.news.length > 0) {
        for (const article of research.news.slice(0, 5)) {
          await this.ragSystem.storeNewsArticle(article);
        }
      }

      logger.info(`✅ Market research completed - Found ${research.news?.length || 0} articles, Sentiment: ${research.sentiment?.sentiment || 'neutral'}`);

    } catch (error) {
      logger.error('❌ Error performing market research:', error);
      this.stats.agents.marketResearch.executions++;
      await this.logError('market_research', error);
    }
  }

  async storeMarketData(data) {
    try {
      await MarketData.create({
        token_pair: data.symbol,
        price: data.price,
        volume_24h: data.volume,
        source: 'pancakeswap',
        price_change_24h: 0 // Would calculate from historical data
      });

      await this.ragSystem.storeMarketData(data);
    } catch (error) {
      logger.error('Error storing market data:', error);
    }
  }

  async getPriceHistory(limit = 100) {
    try {
      const marketData = await MarketData.findAll({
        limit,
        order: [['created_at', 'DESC']]
      });

      return marketData.map(data => ({
        timestamp: data.created_at,
        price: parseFloat(data.price)
      }));
    } catch (error) {
      logger.error('Error getting price history:', error);
      return [];
    }
  }

  async logStatus() {
    try {
      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();

      const totalValue = usdtBalance + (bnbBalance * currentPrice);
      const profit = totalValue - config.trading.initialBudget;

      this.stats.totalProfit = profit;

      const status = {
        uptime: this.getUptime(),
        currentPrice: currentPrice.toFixed(6),
        usdtBalance: usdtBalance.toFixed(2),
        bnbBalance: bnbBalance.toFixed(6),
        totalValue: totalValue.toFixed(2),
        profit: profit.toFixed(2),
        profitPercent: ((profit / config.trading.initialBudget) * 100).toFixed(2),
        totalTrades: this.stats.totalTrades,
        successfulTrades: this.stats.successfulTrades,
        failedTrades: this.stats.failedTrades,
        agents: this.stats.agents
      };

      logger.info('=== ADVANCED BOT STATUS ===');
      logger.info(`Uptime: ${status.uptime}`);
      logger.info(`Current Price: ${status.currentPrice} BNB per USDT`);
      logger.info(`USDT Balance: ${status.usdtBalance}`);
      logger.info(`BNB Balance: ${status.bnbBalance}`);
      logger.info(`Total Value: ${status.totalValue} USDT`);
      logger.info(`Profit/Loss: ${status.profit} USDT (${status.profitPercent}%)`);
      logger.info(`Total Trades: ${status.totalTrades}`);
      logger.info(`Success Rate: ${this.stats.totalTrades > 0 ? ((this.stats.successfulTrades / this.stats.totalTrades) * 100).toFixed(1) : 0}%`);
      logger.info('==========================');

      // Store status in database
      await BotLog.create({
        level: 'info',
        message: 'Bot status logged',
        component: 'status_logger',
        action: 'log_status',
        metadata: status
      });

    } catch (error) {
      logger.error('❌ Error logging status:', error);
    }
  }

  async performDataCleanup() {
    try {
      logger.info('🧹 Performing data cleanup...');

      // Clean old logs (keep last 10000)
      const oldLogs = await BotLog.findAll({
        order: [['created_at', 'DESC']],
        offset: 10000
      });

      if (oldLogs.length > 0) {
        await BotLog.destroy({
          where: {
            id: oldLogs.map(log => log.id)
          }
        });
        logger.info(`Cleaned up ${oldLogs.length} old log entries`);
      }

      // Clean old market data (keep last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await MarketData.destroy({
        where: {
          created_at: {
            [sequelize.Sequelize.Op.lt]: sevenDaysAgo
          }
        }
      });

      logger.info('✅ Data cleanup completed');

    } catch (error) {
      logger.error('❌ Error during data cleanup:', error);
    }
  }

  async logError(component, error) {
    try {
      await BotLog.create({
        level: 'error',
        message: error.message,
        component: component,
        action: 'error_handling',
        metadata: {
          stack: error.stack,
          timestamp: new Date()
        },
        error_stack: error.stack
      });

      await Alert.create({
        type: 'system',
        severity: 'high',
        title: `Error in ${component}`,
        message: error.message,
        triggered_by: component,
        acknowledged: false
      });
    } catch (logError) {
      logger.error('Failed to log error:', logError);
    }
  }

  getUptime() {
    if (!this.stats.startTime) return '0s';

    const uptime = Date.now() - this.stats.startTime.getTime();
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  // 🚨 CRITICAL FIX: Emergency kill switch
  async checkEmergencyStop() {
    try {
      const fs = require('fs');
      if (fs.existsSync('./EMERGENCY_STOP')) {
        logger.error('🚨 EMERGENCY STOP ACTIVATED - Shutting down immediately!');
        await this.emergencyShutdown();
        process.exit(0);
      }
    } catch (error) {
      // Ignore file system errors
    }
  }

  async emergencyShutdown() {
    logger.error('🚨 EMERGENCY SHUTDOWN INITIATED');
    this.isRunning = false;

    // Close all active positions immediately
    if (this.tradingStrategyAgent && this.tradingStrategyAgent.activePositions) {
      for (const [id, position] of this.tradingStrategyAgent.activePositions) {
        try {
          await this.tradingStrategyAgent.executeStopLoss(id, 'emergency_shutdown');
        } catch (error) {
          logger.error(`Error closing position ${id} during emergency:`, error);
        }
      }
    }

    // Stop all tasks
    if (this.task) {
      this.task.stop();
    }

    logger.error('🚨 EMERGENCY SHUTDOWN COMPLETE');
  }

  async stop() {
    try {
      this.isRunning = false;
      logger.info('🛑 Stopping Advanced Trading Bot...');

      // Log final status
      await this.logStatus();

      // Close API server
      if (this.server) {
        this.server.close();
        logger.info('🌐 API server stopped');
      }

      // Close RAG system
      await this.ragSystem.close();

      // Disconnect wallet
      this.walletManager.disconnect();

      logger.info('✅ Advanced Trading Bot stopped successfully!');
    } catch (error) {
      logger.error('❌ Error stopping bot:', error);
    }
  }

  async emergencyStop() {
    try {
      logger.warn('🚨 EMERGENCY STOP INITIATED!');
      this.isRunning = false;

      // Log emergency status
      await this.logStatus();

      // Create emergency alert
      await Alert.create({
        type: 'system',
        severity: 'critical',
        title: 'Emergency Stop Executed',
        message: 'Trading bot has been emergency stopped',
        triggered_by: 'emergency_stop',
        acknowledged: false
      });

      logger.warn('🚨 Emergency stop completed!');
    } catch (error) {
      logger.error('❌ Error in emergency stop:', error);
    }
  }

  // ✅ FIX: Helper method to update portfolio value
  // ✅ FIX: Use centralized portfolio manager
  async updatePortfolioValue() {
    try {
      const totalPortfolioValue = await this.portfolioManager.getValue(true);
      logger.debug(`💼 Portfolio updated via manager: $${totalPortfolioValue.toFixed(2)}`);
      return totalPortfolioValue;
    } catch (error) {
      logger.error('❌ Error updating portfolio value:', error.message);
      return this.portfolioManager.cachedValue; // Return cached value on error
    }
  }

  /**
   * Count direction changes in price data to detect choppy markets
   * @param {Array} prices - Array of price values
   * @returns {number} - Number of direction changes
   */
  _countDirectionChanges(prices) {
    let changes = 0;
    for (let i = 2; i < prices.length; i++) {
      const prevDirection = prices[i - 1] > prices[i - 2];
      const currDirection = prices[i] > prices[i - 1];
      if (prevDirection !== currDirection) {
        changes++;
      }
    }
    return changes;
  }

  getMarketDiagnostics(currentPrice, priceHistory) {
    if (priceHistory.length < 50) return { error: 'Insufficient data' };

    const recentPrices = priceHistory.slice(-20).map(p => p.price);
    const last50 = priceHistory.slice(-50).map(p => p.price);

    const priceChange = ((currentPrice - recentPrices[0]) / recentPrices[0]) * 100;
    const mean = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
    const variance = recentPrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentPrices.length;
    const volatility = (Math.sqrt(variance) / mean) * 100;

    const high = Math.max(...recentPrices);
    const low = Math.min(...recentPrices);
    const range = ((high - low) / low) * 100;

    // Calculate z-score for mean reversion
    const mean50 = last50.reduce((a, b) => a + b) / last50.length;
    const variance50 = last50.reduce((a, b) => a + Math.pow(b - mean50, 2), 0) / last50.length;
    const stdDev = Math.sqrt(variance50);
    const zScore = (currentPrice - mean50) / stdDev;

    return {
      currentPrice: currentPrice.toFixed(8),
      priceChange: priceChange.toFixed(2) + '%',
      volatility: volatility.toFixed(2) + '%',
      range: range.toFixed(2) + '%',
      zScore: zScore.toFixed(2),
      dataPoints: priceHistory.length,

      // Strategy thresholds check
      rangingThreshold: { need: '2-6%', have: range.toFixed(2) + '%', met: range > 2 && range < 6 },
      momentumThreshold: { need: '>3% change + >2% vol', change: priceChange.toFixed(2) + '%', vol: volatility.toFixed(2) + '%', met: Math.abs(priceChange) > 3 && volatility > 2 },
      breakoutNearLevel: this._checkNearLevel(currentPrice, recentPrices),
      meanReversionThreshold: { need: 'z-score < -1.5 or > 1.5', have: zScore.toFixed(2), met: Math.abs(zScore) > 1.5 }
    };
  }

  _checkNearLevel(currentPrice, prices) {
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const distToHigh = Math.abs((high - currentPrice) / currentPrice);
    const distToLow = Math.abs((currentPrice - low) / currentPrice);
    const nearLevel = Math.min(distToHigh, distToLow) < 0.01;
    return {
      need: '< 1% from high/low',
      distToHigh: (distToHigh * 100).toFixed(2) + '%',
      distToLow: (distToLow * 100).toFixed(2) + '%',
      met: nearLevel
    };
  }

  /**
   * Select the best trading strategy based on current market conditions
   * @param {number} currentPrice - Current market price
   * @param {Array} priceHistory - Array of price history data
   * @returns {string} - Strategy name ('ranging', 'momentum', 'mean_reversion', 'breakout', 'gridTrading', 'vwap', 'ichimoku')
   */
  selectBestStrategy(currentPrice, priceHistory) {
    // 🚨 CRITICAL FIX: Use market monitor recommendations if available
    if (this.marketMonitor?.currentRegime?.strategies) {
      const strategies = this.marketMonitor.currentRegime.strategies;
      // Rotate hourly through recommended strategies
      const hour = new Date().getHours();
      const index = hour % strategies.length;
      logger.info(`📊 Regime: ${this.marketMonitor.currentRegime.regime} → Using ${strategies[index]}`);
      return strategies[index];
    }

    // Fallback: calculate manually with strategy rotation
    if (priceHistory.length < 50) {
      console.log('Insufficient data, using ranging strategy');
      return 'ranging';
    }

    // 🚀 OPTIMIZATION: Force strategy rotation every hour (VWAP removed - too tight thresholds)
    const hour = new Date().getHours();
    const strategies = ['ranging', 'mean_reversion', 'momentum']; // VWAP removed - causing holds
    const strategyIndex = hour % strategies.length;
    const selectedStrategy = strategies[strategyIndex];

    logger.info(`🔄 Strategy rotation: Hour ${hour} → Using ${selectedStrategy}`);

    const last20 = priceHistory.slice(-20).map(p => p.price);
    const volatility = this.calculateVolatility(last20);
    const trend = this.calculateTrend(last20);

    logger.debug(`Market: vol=${(volatility * 100).toFixed(2)}%, trend=${(trend * 100).toFixed(2)}%`);

    // Use rotated strategy unless market conditions strongly favor another
    if (volatility > 0.025 && Math.abs(trend) > 0.02) {
      return Math.random() > 0.3 ? selectedStrategy : 'momentum'; // 70% use rotation, 30% momentum
    }
    if (volatility < 0.015 && Math.abs(trend) < 0.01) {
      return Math.random() > 0.3 ? selectedStrategy : 'ranging'; // 70% use rotation, 30% ranging
    }
    return selectedStrategy; // Always use rotation for default case
  }

  // 🚨 CRITICAL FIX: Add calculation methods for strategy selection
  calculateVolatility(prices) {
    const mean = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    return Math.sqrt(variance) / mean;
  }

  calculateTrend(prices) {
    return (prices[prices.length - 1] - prices[0]) / prices[0];
  }

  async calculateTodayLoss() {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Get trades from today
      const todayTrades = await Trade.findAll({
        where: {
          created_at: {
            [require('sequelize').Op.gte]: startOfDay
          }
        },
        order: [['created_at', 'ASC']]
      });

      if (todayTrades.length === 0) {
        return 0; // No trades today, no loss
      }

      // Calculate starting balance (from first trade or current balance)
      let startBalance;
      if (todayTrades.length > 0) {
        // For simplicity, use current balance as starting point
        // In a real implementation, you'd track daily starting balance
        const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
        const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
        const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
        startBalance = usdtBalance + (bnbBalance * currentPrice);
      } else {
        return 0;
      }

      // Calculate current balance
      const currentPrice = await this.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      const usdtBalance = await this.multiDexManager.dexs.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.multiDexManager.dexs.pancakeSwap.getBNBBalance();
      const currentBalance = usdtBalance + (bnbBalance * currentPrice);

      // Calculate loss percentage
      const loss = (startBalance - currentBalance) / startBalance;

      logger.debug(`Daily loss calculation: Start: $${startBalance.toFixed(2)}, Current: $${currentBalance.toFixed(2)}, Loss: ${(loss * 100).toFixed(2)}%`);

      return Math.max(0, loss); // Return 0 if profit (no loss)
    } catch (error) {
      logger.error('Error calculating today loss:', error);
      return 0; // Return 0 on error to avoid blocking trading
    }
  }

  async recordStrategyPerformance(strategy, decision, executionResult) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find or create today's performance record
      let performance = await StrategyPerformance.findOne({
        where: {
          strategy_name: strategy,
          period_start: today,
          period_end: tomorrow
        }
      });

      if (!performance) {
        performance = await StrategyPerformance.create({
          strategy_name: strategy,
          period_start: today,
          period_end: tomorrow,
          total_trades: 0,
          successful_trades: 0,
          failed_trades: 0,
          total_profit: 0,
          total_volume: 0,
          win_rate: 0
        });
      }

      // Update performance metrics
      const updates = {
        total_trades: performance.total_trades + 1,
        total_volume: performance.total_volume + (executionResult.profit || 0)
      };

      if (executionResult.success) {
        updates.successful_trades = performance.successful_trades + 1;
        updates.total_profit = performance.total_profit + (executionResult.profit || 0);
      } else {
        updates.failed_trades = performance.failed_trades + 1;
      }

      // Calculate win rate
      updates.win_rate = updates.successful_trades / updates.total_trades;

      await performance.update(updates);

      // Log performance stats
      const stats = await this.getStrategyStats(strategy);
      logger.info(`${strategy} performance: ${stats.winRate}% win rate, ${stats.avgProfit} avg profit, ${stats.totalTrades} total trades`);

    } catch (error) {
      logger.error('Error recording strategy performance:', error);
      // Don't throw - performance tracking shouldn't block trading
    }
  }

  async getStrategyStats(strategy) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const performance = await StrategyPerformance.findOne({
        where: {
          strategy_name: strategy,
          period_start: today,
          period_end: tomorrow
        }
      });

      if (!performance) {
        return {
          winRate: 0,
          avgProfit: 0,
          totalTrades: 0
        };
      }

      return {
        winRate: (performance.win_rate * 100).toFixed(1),
        avgProfit: performance.total_trades > 0 ? (performance.total_profit / performance.total_trades).toFixed(2) : 0,
        totalTrades: performance.total_trades
      };
    } catch (error) {
      logger.error('Error getting strategy stats:', error);
      return {
        winRate: 0,
        avgProfit: 0,
        totalTrades: 0
      };
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (global.bot) {
    await global.bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (global.bot) {
    await global.bot.stop();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  if (global.bot) {
    await global.bot.emergencyStop();
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (global.bot) {
    await global.bot.emergencyStop();
  }
  process.exit(1);
});

// Start the bot
async function main() {
  try {
    global.bot = new AdvancedTradingBot();
    await global.bot.start();
  } catch (error) {
    logger.error('Failed to start advanced bot:', error);
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  main();
}

module.exports = AdvancedTradingBot;


═══════════════════════════════════════════════════════════════════════
FICHIER 3: testing/shadowMode.js (752 lignes)
═══════════════════════════════════════════════════════════════════════

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
    this.virtualPortfolio = {
      usdt: 60000,  // ✅ FIXED: $60k USDT (actual balance, not 50%)
      bnb: 22.68    // Start with 22.68 BNB (~$29k at current price ~0.00078)
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
      // 🔧 FIX: Convert USD amount to BNB for validation
      const bnbNeeded = amount * targetPrice; // USD * (BNB/USD) = BNB
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
      // Price is BNB per USDT, so multiply to get BNB received
      this.virtualPortfolio.bnb += amount * targetPrice;
    } else if (action === 'sell') {
      // 🔧 FIX: amount is in USD, convert to BNB to subtract
      const bnbToSell = amount * targetPrice; // USD * (BNB/USD) = BNB
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
    // Reset balances to initial state
    this.virtualPortfolio = {
      usdt: 60000,  // ✅ FIXED: $60k USDT actual balance
      bnb: 22.68
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
      usdt: 60000,  // ✅ FIXED: Reset to $60k USDT (actual balance)
      bnb: 22.68    // Reset to 22.68 BNB (~$29k at current price ~0.00078)
    };
    logger.info(`✅ Virtual balances reset: ${this.virtualPortfolio.usdt} USDT, ${this.virtualPortfolio.bnb} BNB`);
  }

  // Record trade to database for analytics
  async recordTradeToDatabase(trade) {
    try {
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
      const tradesFile = path.join(__dirname, '../data/shadow_trades.json');
      let trades = [];

      // Ensure data directory exists
      const dataDir = path.dirname(tradesFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Read existing trades if file exists
      try {
        const data = await fs.readFile(tradesFile, 'utf8');
        trades = JSON.parse(data);
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


═══════════════════════════════════════════════════════════════════════
FICHIER 4: risk/productionRiskManager.js (777 lignes)
═══════════════════════════════════════════════════════════════════════

const logger = require('../logger');

class ProductionRiskManager {
  constructor(options = {}) {
    this.limits = {
      // Trade size limits - SAME for shadow and live
      minTradeSize: 0.001,     // Allow very small test trades (was 0.1)
      maxTradeSize: 3000,      // 🔧 PROFESSIONAL RISK: 5% of $60k portfolio (was 20%)

      // Portfolio limits
      minPortfolioValue: 10,
      maxPortfolioValue: 1000000,

      // Position size (as % of portfolio)
      maxPositionSize: 0.051,  // 🔧 PROFESSIONAL RISK: 5.1% max (allows 5.0% with rounding tolerance)

      // Loss limits
      maxDailyLoss: 3000,      // 5% of $60k portfolio
      maxDrawdown: 0.15,       // 15% max drawdown from peak
      maxLeverageExposure: 75000, // $25K × 3x average leverage

      // Price action limits
      maxSlippage: 0.05,       // 5% max slippage
      maxPriceImpact: 0.03,    // 3% max price impact

      // Rate limits
      maxTradesPerHour: 20,    // Reasonable for both modes
      maxTradesPerDay: 100,    // Reasonable for both modes
      maxConsecutiveErrors: 10,
      maxErrorsPerHour: 20,

      // Gas limits
      maxGasPrice: 50,         // 50 gwei max

      // Time limits
      maxTradeDuration: 3600000,  // 1 hour max trade duration

      ...options
    };

    this.state = {
      dailyLoss: 0,
      dailyTrades: 0,
      hourlyTrades: 0,
      consecutiveErrors: 0,
      lastResetTime: Date.now(),
      lastHourReset: Date.now(),
      portfolioValue: 0,
      openPositions: new Map(),
      tradeHistory: [],
      errorHistory: []
    };

    // Emergency shutdown state
    this.emergencyState = {
      isShutdown: false,
      shutdownReason: null,
      shutdownTime: null,
      lastHealthCheck: Date.now()
    };

    // Monitoring and alerting
    this.alertSystem = null;
    this.monitoringInterval = null;

    // Don't start monitoring automatically - let bot control when to start
    // this.startMonitoring();

    logger.info('🚀 Production Risk Manager initialized');
  }

  // Set alert system
  setAlertSystem(alertSystem) {
    this.alertSystem = alertSystem;
    logger.info('✅ Alert system connected to risk manager');
  }

  // Start continuous monitoring
  startMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    logger.info('✅ Risk monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('✅ Risk monitoring stopped');
  }

  // Validate trade before execution
  async validateTrade(trade) {
    try {
      // Check if system is in emergency shutdown
      if (this.emergencyState.isShutdown) {
        throw new Error(`System is in emergency shutdown: ${this.emergencyState.shutdownReason}`);
      }

      // Reset daily counters if needed
      this.resetDailyCountersIfNeeded();
      this.resetHourlyCountersIfNeeded();

      const validations = [
        this.checkTradeSize(trade),
        this.checkDailyLoss(trade),
        this.checkPositionSize(trade),
        this.checkTradeFrequency(),
        this.checkSlippage(trade),
        this.checkGasPrice(trade),
        this.checkPriceImpact(trade),
        this.checkPortfolioValue(),
        this.checkConsecutiveErrors(),
        this.checkMarketConditions(trade)
      ];

      const results = await Promise.all(validations);

      // Debug: Log all validation results
      logger.debug('Risk validation results:', results);

      const failures = results.filter(r => r && r.passed === false);

      if (failures.length > 0) {
        const errorMsg = `Trade validation failed: ${failures.map(f => f.reason || 'Unknown reason').filter(Boolean).join(', ')}`;
        logger.warn(`⚠️ Trade validation failed:`, failures);

        // Record validation failure
        this.recordError('VALIDATION_FAILED', errorMsg);

        throw new Error(errorMsg);
      }

      // Record successful validation
      this.recordTradeValidation(trade);

      return true;

    } catch (error) {
      logger.error('❌ Trade validation error:', error);
      throw error;
    }
  }

  // Check trade size limits
  checkTradeSize(trade) {
    const amount = parseFloat(trade.amount);

    if (amount < this.limits.minTradeSize) {
      return { passed: false, reason: `Trade size too small: $${amount} < $${this.limits.minTradeSize}` };
    }

    if (amount > this.limits.maxTradeSize) {
      return { passed: false, reason: `Trade size exceeds limit: $${amount} > $${this.limits.maxTradeSize}` };
    }

    return { passed: true };
  }

  // Check daily loss limits
  checkDailyLoss(trade) {
    const potentialLoss = parseFloat(trade.amount) * 0.1; // Assume 10% loss

    if (this.state.dailyLoss + potentialLoss > this.limits.maxDailyLoss) {
      return {
        passed: false,
        reason: `Daily loss limit reached: $${this.state.dailyLoss} + $${potentialLoss} > $${this.limits.maxDailyLoss}`
      };
    }

    return { passed: true };
  }

  // Check position size limits
  checkPositionSize(trade) {
    // Validate portfolio value is set
    if (!this.state.portfolioValue || this.state.portfolioValue <= 0) {
      logger.error(`🚨 checkPositionSize: Invalid portfolio value: ${this.state.portfolioValue}`);
      return {
        passed: false,
        reason: `Invalid portfolio value: $${this.state.portfolioValue}`
      };
    }

    const positionSize = parseFloat(trade.amount) / this.state.portfolioValue;

    // 🔧 FIX: Add comprehensive debug logging
    logger.info(`🔍 Position Size Check:
  Portfolio Value: $${this.state.portfolioValue.toFixed(2)}
  Position Value: $${trade.amount.toFixed(2)}
  Calculated %: ${(positionSize * 100).toFixed(2)}%
  Max Allowed: ${(this.limits.maxPositionSize * 100).toFixed(2)}%`);

    if (positionSize > this.limits.maxPositionSize) {
      return {
        passed: false,
        reason: `Position size too large: ${(positionSize * 100).toFixed(2)}% > ${(this.limits.maxPositionSize * 100)}%`
      };
    }

    logger.info(`  ✅ PASSED`);
    return { passed: true };
  }

  // Check trade frequency limits
  checkTradeFrequency() {
    if (this.state.hourlyTrades >= this.limits.maxTradesPerHour) {
      return {
        passed: false,
        reason: `Hourly trade limit reached: ${this.state.hourlyTrades} >= ${this.limits.maxTradesPerHour}`
      };
    }

    if (this.state.dailyTrades >= this.limits.maxTradesPerDay) {
      return {
        passed: false,
        reason: `Daily trade limit reached: ${this.state.dailyTrades} >= ${this.limits.maxTradesPerDay}`
      };
    }

    return { passed: true };
  }

  // Check slippage limits
  checkSlippage(trade) {
    const slippage = parseFloat(trade.slippage) || 0;

    if (slippage > this.limits.maxSlippage) {
      return {
        passed: false,
        reason: `Slippage too high: ${(slippage * 100).toFixed(2)}% > ${(this.limits.maxSlippage * 100)}%`
      };
    }

    return { passed: true };
  }

  // Check gas price limits
  checkGasPrice(trade) {
    const gasPrice = parseFloat(trade.gasPrice) || 0;

    if (gasPrice > this.limits.maxGasPrice) {
      return {
        passed: false,
        reason: `Gas price too high: ${gasPrice} Gwei > ${this.limits.maxGasPrice} Gwei`
      };
    }

    return { passed: true };
  }

  // Check price impact limits
  checkPriceImpact(trade) {
    const priceImpact = parseFloat(trade.priceImpact) || 0;

    if (priceImpact > this.limits.maxPriceImpact) {
      return {
        passed: false,
        reason: `Price impact too high: ${(priceImpact * 100).toFixed(2)}% > ${(this.limits.maxPriceImpact * 100)}%`
      };
    }

    return { passed: true };
  }

  // Check portfolio value limits
  checkPortfolioValue() {
    if (this.state.portfolioValue < this.limits.minPortfolioValue) {
      return {
        passed: false,
        reason: `Portfolio value too low: $${this.state.portfolioValue} < $${this.limits.minPortfolioValue}`
      };
    }

    if (this.state.portfolioValue > this.limits.maxPortfolioValue) {
      return {
        passed: false,
        reason: `Portfolio value too high: $${this.state.portfolioValue} > $${this.limits.maxPortfolioValue}`
      };
    }

    return { passed: true };
  }

  // Check consecutive error limits
  checkConsecutiveErrors() {
    if (this.state.consecutiveErrors >= this.limits.maxConsecutiveErrors) {
      return {
        passed: false,
        reason: `Too many consecutive errors: ${this.state.consecutiveErrors} >= ${this.limits.maxConsecutiveErrors}`
      };
    }

    return { passed: true };
  }

  // Check market conditions
  async checkMarketConditions(trade) {
    // This would check market volatility, liquidity, etc.
    // For now, return passed
    return { passed: true };
  }

  // Record trade execution
  recordTrade(trade, result) {
    const tradeRecord = {
      ...trade,
      result: result,
      timestamp: Date.now(),
      dailyTradeNumber: this.state.dailyTrades + 1,
      hourlyTradeNumber: this.state.hourlyTrades + 1
    };

    this.state.tradeHistory.push(tradeRecord);
    this.state.dailyTrades++;
    this.state.hourlyTrades++;

    // Keep only recent trades
    if (this.state.tradeHistory.length > 1000) {
      this.state.tradeHistory = this.state.tradeHistory.slice(-1000);
    }

    // Update portfolio value
    if (result.profitLoss) {
      this.state.portfolioValue += parseFloat(result.profitLoss);
    }

    // Update daily loss
    if (result.profitLoss && parseFloat(result.profitLoss) < 0) {
      this.state.dailyLoss += Math.abs(parseFloat(result.profitLoss));
    }

    // Reset consecutive errors on successful trade
    if (result.status === 'success') {
      this.state.consecutiveErrors = 0;
    }

    logger.info(`✅ Trade recorded: ${trade.pair} ${trade.amount} (${result.status})`);
  }

  // Record error
  recordError(type, message) {
    const errorRecord = {
      type: type,
      message: message,
      timestamp: Date.now(),
      consecutiveCount: this.state.consecutiveErrors + 1
    };

    this.state.errorHistory.push(errorRecord);
    this.state.consecutiveErrors++;

    // Keep only recent errors
    if (this.state.errorHistory.length > 100) {
      this.state.errorHistory = this.state.errorHistory.slice(-100);
    }

    logger.error(`❌ Error recorded: ${type} - ${message}`);
  }

  // Record trade validation
  recordTradeValidation(trade) {
    // This would log validation success for monitoring
    logger.debug(`✅ Trade validation passed: ${trade.pair} ${trade.amount}`);
  }

  // Reset daily counters if needed
  resetDailyCountersIfNeeded() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (now - this.state.lastResetTime > dayInMs) {
      this.state.dailyLoss = 0;
      this.state.dailyTrades = 0;
      this.state.lastResetTime = now;

      logger.info('✅ Daily counters reset');
    }
  }

  // Reset hourly counters if needed
  resetHourlyCountersIfNeeded() {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;

    if (now - this.state.lastHourReset > hourInMs) {
      this.state.hourlyTrades = 0;
      this.state.lastHourReset = now;

      logger.info('✅ Hourly counters reset');
    }
  }

  // Update portfolio value
  updatePortfolioValue(value) {
    const oldValue = this.state.portfolioValue;
    this.state.portfolioValue = parseFloat(value);
    logger.info(`💰 Portfolio value updated: $${oldValue} → $${this.state.portfolioValue}`);
  }

  // Add open position
  addOpenPosition(position) {
    this.state.openPositions.set(position.id, position);
    logger.debug(`✅ Open position added: ${position.id}`);
  }

  // Remove open position
  removeOpenPosition(positionId) {
    this.state.openPositions.delete(positionId);
    logger.debug(`✅ Open position removed: ${positionId}`);
  }

  // Perform health check
  async performHealthCheck() {
    try {
      const now = Date.now();
      this.emergencyState.lastHealthCheck = now;

      // Check for emergency conditions
      const emergencyConditions = [
        this.checkDailyLossLimit(),
        this.checkConsecutiveErrorLimit(),
        this.checkPortfolioValueLimit(),
        this.checkMarketConditions()
      ];

      const emergencies = emergencyConditions.filter(condition => condition.isEmergency);

      if (emergencies.length > 0) {
        await this.emergencyShutdown(emergencies[0].reason);
      }

      // Check for warning conditions
      const warningConditions = [
        this.checkDailyLossWarning(),
        this.checkErrorRateWarning(),
        this.checkTradeFrequencyWarning()
      ];

      const warnings = warningConditions.filter(condition => condition.isWarning);

      if (warnings.length > 0) {
        await this.sendWarning(warnings[0].reason);
      }

    } catch (error) {
      logger.error('❌ Health check failed:', error);
    }
  }

  // Check daily loss limit
  checkDailyLossLimit() {
    const lossRatio = this.state.dailyLoss / this.state.portfolioValue;

    if (lossRatio > this.limits.maxDrawdown) {
      return {
        isEmergency: true,
        reason: `Daily loss limit exceeded: $${this.state.dailyLoss} (${(lossRatio * 100).toFixed(2)}% of portfolio)`
      };
    }

    return { isEmergency: false };
  }

  // Check consecutive error limit
  checkConsecutiveErrorLimit() {
    if (this.state.consecutiveErrors >= this.limits.maxConsecutiveErrors) {
      return {
        isEmergency: true,
        reason: `Too many consecutive errors: ${this.state.consecutiveErrors}`
      };
    }

    return { isEmergency: false };
  }

  // Check portfolio value limit
  checkPortfolioValueLimit() {
    logger.debug(`🔍 Checking portfolio value limit: current=${this.state.portfolioValue}, min=${this.limits.minPortfolioValue}`);

    if (this.state.portfolioValue < this.limits.minPortfolioValue) {
      logger.error(`🚨 Portfolio value too low: $${this.state.portfolioValue} < $${this.limits.minPortfolioValue}`);
      return {
        isEmergency: true,
        reason: `Portfolio value too low: $${this.state.portfolioValue}`
      };
    }

    logger.debug(`✅ Portfolio value OK: $${this.state.portfolioValue} >= $${this.limits.minPortfolioValue}`);
    return { isEmergency: false };
  }

  // Check market conditions
  checkMarketConditions() {
    // This would check market volatility, liquidity, etc.
    return { isEmergency: false };
  }

  // Check daily loss warning
  checkDailyLossWarning() {
    const lossRatio = this.state.dailyLoss / this.state.portfolioValue;

    if (lossRatio > this.limits.maxDrawdown * 0.8) {
      return {
        isWarning: true,
        reason: `Daily loss approaching limit: $${this.state.dailyLoss} (${(lossRatio * 100).toFixed(2)}% of portfolio)`
      };
    }

    return { isWarning: false };
  }

  // Check error rate warning
  checkErrorRateWarning() {
    const errorRate = this.state.errorHistory.filter(
      error => Date.now() - error.timestamp < 3600000 // Last hour
    ).length;

    if (errorRate > this.limits.maxErrorsPerHour * 0.8) {
      return {
        isWarning: true,
        reason: `High error rate: ${errorRate} errors in last hour`
      };
    }

    return { isWarning: false };
  }

  // Check trade frequency warning
  checkTradeFrequencyWarning() {
    if (this.state.hourlyTrades > this.limits.maxTradesPerHour * 0.8) {
      return {
        isWarning: true,
        reason: `High trade frequency: ${this.state.hourlyTrades} trades in last hour`
      };
    }

    return { isWarning: false };
  }

  // Send warning
  async sendWarning(reason) {
    if (this.alertSystem) {
      await this.alertSystem.send({
        level: 'WARNING',
        type: 'RISK_WARNING',
        reason: reason,
        timestamp: Date.now(),
        state: this.getSystemState()
      });
    }

    logger.warn(`⚠️ Risk warning: ${reason}`);
  }

  // Emergency shutdown
  async emergencyShutdown(reason) {
    try {
      logger.error('🚨 EMERGENCY SHUTDOWN:', reason);

      // Set emergency state
      this.emergencyState.isShutdown = true;
      this.emergencyState.shutdownReason = reason;
      this.emergencyState.shutdownTime = Date.now();

      // Stop all trading
      this.stopTrading();

      // Cancel pending orders
      await this.cancelAllOrders();

      // Close open positions (if safe)
      await this.closePositionsSafely();

      // Alert administrators
      if (this.alertSystem) {
        await this.alertSystem.send({
          level: 'CRITICAL',
          type: 'EMERGENCY_SHUTDOWN',
          reason: reason,
          timestamp: Date.now(),
          state: this.getSystemState()
        });
      }

      // Create incident report
      await this.createIncidentReport(reason);

      logger.error('🚨 Emergency shutdown completed');

    } catch (error) {
      logger.error('❌ Emergency shutdown failed:', error);
    }
  }

  // Stop trading
  stopTrading() {
    // This would stop the trading bot
    logger.error('🛑 Trading stopped due to emergency shutdown');
  }

  // Cancel all orders
  async cancelAllOrders() {
    // This would cancel all pending orders
    logger.error('🛑 All orders cancelled due to emergency shutdown');
  }

  // Close positions safely
  async closePositionsSafely() {
    // This would close open positions if safe to do so
    logger.error('🛑 Positions closed safely due to emergency shutdown');
  }

  // Create incident report
  async createIncidentReport(reason) {
    const report = {
      incidentId: Date.now(),
      reason: reason,
      timestamp: Date.now(),
      state: this.getSystemState(),
      tradeHistory: this.state.tradeHistory.slice(-100),
      errorHistory: this.state.errorHistory.slice(-50)
    };

    logger.error('📋 Incident report created:', report);

    // In production, save to database
    return report;
  }

  // Get system state
  getSystemState() {
    return {
      limits: this.limits,
      state: this.state,
      emergencyState: this.emergencyState,
      stats: this.getStats()
    };
  }

  // Get risk manager statistics
  getStats() {
    const now = Date.now();
    const last24Hours = this.state.tradeHistory.filter(
      trade => now - trade.timestamp < 24 * 60 * 60 * 1000
    );

    const lastHour = this.state.tradeHistory.filter(
      trade => now - trade.timestamp < 60 * 60 * 1000
    );

    const profitableTrades = last24Hours.filter(trade =>
      trade.result.profitLoss && parseFloat(trade.result.profitLoss) > 0
    );

    const losingTrades = last24Hours.filter(trade =>
      trade.result.profitLoss && parseFloat(trade.result.profitLoss) < 0
    );

    return {
      portfolio: {
        value: this.state.portfolioValue,
        dailyLoss: this.state.dailyLoss,
        openPositions: this.state.openPositions.size
      },
      trading: {
        dailyTrades: this.state.dailyTrades,
        hourlyTrades: this.state.hourlyTrades,
        totalTrades: this.state.tradeHistory.length,
        profitableTrades: profitableTrades.length,
        losingTrades: losingTrades.length,
        winRate: last24Hours.length > 0 ? (profitableTrades.length / last24Hours.length * 100).toFixed(2) + '%' : '0%'
      },
      errors: {
        consecutiveErrors: this.state.consecutiveErrors,
        totalErrors: this.state.errorHistory.length,
        errorRate: this.state.tradeHistory.length > 0 ?
          (this.state.errorHistory.length / this.state.tradeHistory.length * 100).toFixed(2) + '%' : '0%'
      },
      emergency: {
        isShutdown: this.emergencyState.isShutdown,
        shutdownReason: this.emergencyState.shutdownReason,
        shutdownTime: this.emergencyState.shutdownTime,
        lastHealthCheck: this.emergencyState.lastHealthCheck
      }
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthy = !this.emergencyState.isShutdown &&
      this.state.consecutiveErrors < this.limits.maxConsecutiveErrors &&
      this.state.portfolioValue >= this.limits.minPortfolioValue;

    return {
      status: healthy ? 'healthy' : 'warning',
      stats: stats,
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations
  getRecommendations() {
    const recommendations = [];

    if (this.state.dailyLoss > this.limits.maxDailyLoss * 0.8) {
      recommendations.push('Daily loss approaching limit - consider reducing position sizes');
    }

    if (this.state.consecutiveErrors > this.limits.maxConsecutiveErrors * 0.8) {
      recommendations.push('High consecutive error count - review error handling');
    }

    if (this.state.hourlyTrades > this.limits.maxTradesPerHour * 0.8) {
      recommendations.push('High trade frequency - consider rate limiting');
    }

    if (this.state.portfolioValue < this.limits.minPortfolioValue * 1.1) {
      recommendations.push('Portfolio value low - consider adding funds');
    }

    return recommendations;
  }

  // Reset emergency state
  resetEmergencyState() {
    this.emergencyState.isShutdown = false;
    this.emergencyState.shutdownReason = null;
    this.emergencyState.shutdownTime = null;

    logger.info('✅ Emergency state reset');
  }

  // Complete reset method for bot restart
  reset() {
    logger.info('🔄 Starting emergency shutdown reset...');
    logger.info(`Before reset - isShutdown: ${this.emergencyState.isShutdown}, reason: ${this.emergencyState.shutdownReason}`);

    this.state.consecutiveErrors = 0;
    this.state.errorHistory = [];
    this.emergencyState.isShutdown = false;
    this.emergencyState.shutdownReason = null;
    this.emergencyState.shutdownTime = null;
    this.state.dailyLoss = 0;
    this.state.dailyTrades = 0;
    this.state.hourlyTrades = 0;
    this.state.lastResetTime = Date.now();
    this.state.lastHourReset = Date.now();

    logger.info('✅ Emergency shutdown reset - all error counters cleared');
    logger.info(`After reset - isShutdown: ${this.emergencyState.isShutdown}, reason: ${this.emergencyState.shutdownReason}`);
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('🔄 Shutting down risk manager...');

      this.stopMonitoring();

      logger.info('✅ Risk manager shutdown completed');

    } catch (error) {
      logger.error('❌ Error during risk manager shutdown:', error);
    }
  }
}

module.exports = ProductionRiskManager;


═══════════════════════════════════════════════════════════════════════
FICHIER 5: rangingStrategy.js (223 lignes)
═══════════════════════════════════════════════════════════════════════

const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');

class RangingStrategy {
  constructor(pancakeSwap) {
    this.pancakeSwap = pancakeSwap;
    this.basePrice = null;
    this.lowerBound = null;
    this.upperBound = null;
    this.position = 'neutral'; // 'long', 'short', 'neutral'
    this.lastRebalancePrice = null;
  }

  async initialize() {
    try {
      // Get initial price to set bounds
      this.basePrice = await this.pancakeSwap.getCurrentPrice();
      this.lowerBound = this.basePrice * config.strategy.lowerBoundPercent;
      this.upperBound = this.basePrice * config.strategy.upperBoundPercent;
      this.lastRebalancePrice = this.basePrice;

      logger.info(`Strategy initialized:`);
      logger.info(`Base Price: ${this.basePrice.toFixed(6)} BNB per USDT`);
      logger.info(`Lower Bound: ${this.lowerBound.toFixed(6)} BNB per USDT`);
      logger.info(`Upper Bound: ${this.upperBound.toFixed(6)} BNB per USDT`);

      return true;
    } catch (error) {
      logger.error('Error initializing strategy:', error);
      throw error;
    }
  }

  async checkAndExecute() {
    try {
      const currentPrice = await this.pancakeSwap.getCurrentPrice();
      const usdtBalance = await this.pancakeSwap.getUSDTBalance();
      const bnbBalance = await this.pancakeSwap.getBNBBalance();

      logger.info(`Current Price: ${currentPrice.toFixed(6)} BNB per USDT`);
      logger.info(`USDT Balance: ${usdtBalance.toFixed(2)}`);
      logger.info(`BNB Balance: ${bnbBalance.toFixed(6)}`);

      // Check if price is below lower bound (buy signal)
      if (currentPrice <= this.lowerBound && this.position !== 'long') {
        await this.executeBuy(currentPrice, usdtBalance);
      }
      // Check if price is above upper bound (sell signal)
      else if (currentPrice >= this.upperBound && this.position !== 'short') {
        await this.executeSell(currentPrice, bnbBalance);
      }
      // Check for rebalancing opportunity
      else if (this.shouldRebalance(currentPrice)) {
        await this.rebalance(currentPrice, usdtBalance, bnbBalance);
      }

      return {
        currentPrice,
        lowerBound: this.lowerBound,
        upperBound: this.upperBound,
        position: this.position,
        usdtBalance,
        bnbBalance
      };
    } catch (error) {
      logger.error('Error in checkAndExecute:', error);
      throw error;
    }
  }

  async executeBuy(currentPrice, usdtBalance) {
    try {
      if (usdtBalance < config.trading.minTradeAmount) {
        logger.warn('Insufficient USDT balance for buy order');
        return;
      }

      const tradeAmount = Math.min(usdtBalance * 0.5, config.trading.maxTradeAmount);
      const minBnbAmount = ethers.parseEther((tradeAmount / currentPrice * 0.995).toFixed(18)); // 0.5% slippage

      logger.info(`Executing BUY: ${tradeAmount.toFixed(2)} USDT for BNB at ${currentPrice.toFixed(6)}`);

      const receipt = await this.pancakeSwap.swapUSDTForBNB(tradeAmount, minBnbAmount);

      this.position = 'long';
      this.lastRebalancePrice = currentPrice;

      logger.info(`Buy order executed successfully: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error executing buy order:', error);
      // Don't throw error, just log it to prevent bot from stopping
      return null;
    }
  }

  async executeSell(currentPrice, bnbBalance) {
    try {
      if (bnbBalance < 0.001) { // Minimum BNB balance
        logger.warn('Insufficient BNB balance for sell order');
        return;
      }

      const tradeAmount = Math.min(bnbBalance * 0.5, config.trading.maxTradeAmount / currentPrice);
      const minUsdtAmount = ethers.parseEther((tradeAmount * currentPrice * 0.995).toFixed(18)); // 0.5% slippage

      logger.info(`Executing SELL: ${tradeAmount.toFixed(6)} BNB for USDT at ${currentPrice.toFixed(6)}`);

      const receipt = await this.pancakeSwap.swapBNBForUSDT(tradeAmount, minUsdtAmount);

      this.position = 'short';
      this.lastRebalancePrice = currentPrice;

      logger.info(`Sell order executed successfully: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error executing sell order:', error);
      // Don't throw error, just log it to prevent bot from stopping
      return null;
    }
  }

  shouldRebalance(currentPrice) {
    if (!this.lastRebalancePrice) return false;

    const priceChange = Math.abs(currentPrice - this.lastRebalancePrice) / this.lastRebalancePrice;
    return priceChange >= config.strategy.rebalanceThreshold;
  }

  async rebalance(currentPrice, usdtBalance, bnbBalance) {
    try {
      const totalValue = usdtBalance + (bnbBalance * currentPrice);
      const targetUsdtValue = totalValue * 0.5; // 50/50 split
      const currentUsdtValue = usdtBalance;

      const usdtDifference = currentUsdtValue - targetUsdtValue;

      if (Math.abs(usdtDifference) > config.trading.minTradeAmount) {
        if (usdtDifference > 0) {
          // Too much USDT, buy BNB
          const tradeAmount = Math.min(usdtDifference, config.trading.maxTradeAmount);
          const minBnbAmount = ethers.parseEther((tradeAmount / currentPrice * 0.995).toFixed(18));

          logger.info(`Rebalancing: Buying ${tradeAmount.toFixed(2)} USDT worth of BNB`);
          const receipt = await this.pancakeSwap.swapUSDTForBNB(tradeAmount, minBnbAmount);
          if (receipt) {
            this.lastRebalancePrice = currentPrice;
            this.position = 'neutral';
          }
        } else {
          // Too little USDT, sell BNB
          const bnbToSell = Math.min(Math.abs(usdtDifference) / currentPrice, bnbBalance * 0.5);
          const minUsdtAmount = ethers.parseEther((bnbToSell * currentPrice * 0.995).toFixed(18));

          logger.info(`Rebalancing: Selling ${bnbToSell.toFixed(6)} BNB for USDT`);
          const receipt = await this.pancakeSwap.swapBNBForUSDT(bnbToSell, minUsdtAmount);
          if (receipt) {
            this.lastRebalancePrice = currentPrice;
            this.position = 'neutral';
          }
        }
      }
    } catch (error) {
      logger.error('Error rebalancing:', error);
      // Don't throw error, just log it to prevent bot from stopping
    }
  }

  updateBounds(newBasePrice) {
    this.basePrice = newBasePrice;
    this.lowerBound = this.basePrice * config.strategy.lowerBoundPercent;
    this.upperBound = this.basePrice * config.strategy.upperBoundPercent;

    logger.info(`Bounds updated:`);
    logger.info(`New Base Price: ${this.basePrice.toFixed(6)} BNB per USDT`);
    logger.info(`New Lower Bound: ${this.lowerBound.toFixed(6)} BNB per USDT`);
    logger.info(`New Upper Bound: ${this.upperBound.toFixed(6)} BNB per USDT`);
  }

  getStatus() {
    return {
      basePrice: this.basePrice,
      lowerBound: this.lowerBound,
      upperBound: this.upperBound,
      position: this.position,
      lastRebalancePrice: this.lastRebalancePrice
    };
  }

  /**
   * Detect breakout from ranging zone to protect positions
   * @param {number} currentPrice - Current market price
   * @param {Array} priceHistory - Recent price history
   * @returns {string|boolean} - 'upward', 'downward', or false
   */
  detectBreakout(currentPrice, priceHistory) {
    if (!priceHistory || priceHistory.length < 50) return false;

    const prices = priceHistory.slice(-50).map(p => p.price);
    const upperBound = Math.max(...prices);
    const lowerBound = Math.min(...prices);
    const range = upperBound - lowerBound;

    // Breakout threshold: 5% beyond the recent range
    const breakoutThreshold = range * 0.05;

    if (currentPrice > upperBound + breakoutThreshold) {
      logger.warn(`🚀 UPWARD BREAKOUT: ${currentPrice.toFixed(6)} > ${upperBound.toFixed(6)}`);
      return 'upward';
    }

    if (currentPrice < lowerBound - breakoutThreshold) {
      logger.warn(`📉 DOWNWARD BREAKOUT: ${currentPrice.toFixed(6)} < ${lowerBound.toFixed(6)}`);
      return 'downward';
    }

    return false;
  }
}

module.exports = RangingStrategy;
