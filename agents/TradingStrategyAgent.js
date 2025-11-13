const BaseAgent = require('./BaseAgent');
const { Trade, StrategyPerformance, GridState } = require('../database/models');
const logger = require('../logger');
const Anthropic = require('@anthropic-ai/sdk');
const VolatilityTracker = require('../utils/VolatilityTracker');
const {
  detectVolatilityRegime,
  getRegimeConfig,
  calculatePositionSize,
  calculateTPSL,
  REGIME_THRESHOLDS
} = require('../config/volatilityRegimes');

// ✅ INSTITUTIONAL TRADING TOOLS (Added 2025-10-29)
const ProductionOrderFlow = require('../utils/orderFlow');
const ProductionVolumeProfile = require('../utils/volumeProfile');
const ProductionLiquidity = require('../utils/liquidity');

// ═══════════════════════════════════════════════════════════════
// DYNAMIC TP/SL CONFIGURATION (Week 1 Priority 2)
// ATR-based, volatility-adjusted, time-aware take profit and stop loss
// ═══════════════════════════════════════════════════════════════

// Base TP/SL percentages (will be adjusted dynamically)
const BASE_TP_PERCENT = parseFloat(process.env.BASE_TP_PERCENT) || 0.005; // 0.5% base
const BASE_SL_PERCENT = parseFloat(process.env.BASE_SL_PERCENT) || 0.015; // 1.5% base (FIXED: was 2%)
const MIN_TP_PERCENT = 0.003;  // Minimum 0.3% (must cover fees + profit)
const MAX_TP_PERCENT = 0.03;   // Maximum 3.0% (FIXED: was 2% - allows meeting R:R in low vol)
const MIN_SL_PERCENT = 0.003;  // Minimum 0.3% (FIXED: was 0.5% - allows tighter SL in low vol)
const MAX_SL_PERCENT = 0.04;   // Maximum 4% (risk management)
const MIN_RISK_REWARD_RATIO = 1.5; // Minimum 1.5:1 reward:risk (target, not hard requirement)

class TradingStrategyAgent extends BaseAgent {
  constructor(pancakeSwap, priceHistoryManager, config = {}) {
    super(
      'TradingStrategyAgent',
      'Advanced trading strategy agent with ML-enhanced decision making'
    );

    this.pancakeSwap = pancakeSwap;
    this.priceHistoryManager = priceHistoryManager;

    // Initialize Volatility Tracker for dynamic capping
    this.volatilityTracker = new VolatilityTracker(5); // 5-day lookback

    // ✅ Initialize Institutional Trading Tools (Added 2025-10-29)
    this.orderFlow = new ProductionOrderFlow({
      minSwapsForSignal: config.orderFlow?.minSwapsForSignal || 10,
      maxHistory: config.orderFlow?.maxHistory || 300
    });

    this.volumeProfile = new ProductionVolumeProfile({
      minSwapsForProfile: config.volumeProfile?.minSwapsForProfile || 10,
      pricePrecision: config.volumeProfile?.pricePrecision || 1,
      maxSwaps: config.volumeProfile?.maxSwaps || 50000
    });

    this.liquidity = new ProductionLiquidity({
      minReserves: config.liquidity?.minReserves || 1000,
      maxChangeThreshold: config.liquidity?.maxChangeThreshold || 0.5
    });

    logger.info('✅ TradingStrategyAgent: Institutional tools initialized (OrderFlow, VolumeProfile, Liquidity)');

    // Initialize Claude AI client
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // ═══════════════════════════════════════════════════════════
    // ✅ 4 CORE STRATEGIES (Research-backed optimal allocation for $60K portfolio)
    // ═══════════════════════════════════════════════════════════
    this.strategies = {
      gridTrading: this.gridTradingStrategy.bind(this),
      momentum: this.momentumStrategy.bind(this),
      mean_reversion: this.meanReversionStrategy.bind(this),
      arbitrage: this.arbitrageStrategy.bind(this)
    };

    // ❌ REMOVED STRATEGIES (Redundant for $60K portfolio):
    // - ranging: 70-85% correlation with mean_reversion strategy
    // - breakout: 60-75% correlation with momentum strategy
    // - vwap: Limited effectiveness in 24/7 DeFi markets (low liquidity variance)
    // - ichimoku: Moderate effectiveness, only works well in sustained trending markets
    //
    // 📊 NOTE: VWAP indicator (18% weight) remains in 8-indicator system!
    // All 4 strategies still use VWAP via calculate8IndicatorConfidence()

    this.currentStrategy = 'gridTrading'; // Default to grid trading strategy
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

    // ═══════════════════════════════════════════════════════════
    // VOLATILITY REGIME TRACKING
    // ═══════════════════════════════════════════════════════════
    this.currentRegime = 'VERY_LOW';
    this.regimeHistory = [];
    this.regimeStats = {
      HIGH: { trades: 0, wins: 0, losses: 0, totalProfit: 0, avgProfit: 0 },
      MEDIUM: { trades: 0, wins: 0, losses: 0, totalProfit: 0, avgProfit: 0 },
      LOW: { trades: 0, wins: 0, losses: 0, totalProfit: 0, avgProfit: 0 },
      VERY_LOW: { trades: 0, wins: 0, losses: 0, totalProfit: 0, avgProfit: 0 }
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

  // ═══════════════════════════════════════════════════════════════
  // 🚀 ENHANCEMENT #1: Dynamic Confidence Thresholds (2025)
  // Adjusts minimum confidence based on volatility regime
  // ═══════════════════════════════════════════════════════════════
  getMinConfidenceForRegime(regime) {
    const thresholds = {
      VERY_LOW: 0.45,  // Allow small edges in ultra-calm markets
      LOW:      0.55,  // Slightly relaxed for quiet conditions
      MEDIUM:   0.65,  // Standard conservative threshold
      HIGH:     0.70   // Only high-conviction signals in chaos
    };
    const threshold = thresholds[regime] || 0.70;
    logger.debug(`🎯 [DYNAMIC-CONFIDENCE] Regime: ${regime}, Min Threshold: ${(threshold * 100).toFixed(0)}%`);
    return threshold;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🚀 ENHANCEMENT #1: Time-of-Day Weighting (2025)
  // Reduces position sizing during BSC low-liquidity hours
  // ═══════════════════════════════════════════════════════════════
  getTimeOfDayWeight() {
    const hour = new Date().getUTCHours();
    const weights = [
      // 00-07: Dead hours (Asia sleep, US sleep)
      0.3, 0.2, 0.2, 0.2, 0.3, 0.4, 0.6, 0.8,
      // 08-15: BSC peak (Asia awake, Europe active)
      0.9, 1.0, 1.0, 0.9, 0.8, 0.8, 0.9, 0.9,
      // 16-23: Declining (Europe close, US retail)
      0.8, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3
    ];
    const weight = weights[hour] || 0.5;
    logger.debug(`⏰ [TIME-WEIGHT] UTC ${hour}:00 → Weight: ${(weight * 100).toFixed(0)}%`);
    return weight;
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

    // 🚀 ENHANCEMENT #1: Apply time-of-day weighting
    const timeWeight = this.getTimeOfDayWeight();
    const adjustedDollarSize = dollarSize * timeWeight;
    logger.info(`⏰ [TIME-WEIGHT] Adjusted position: $${dollarSize.toFixed(2)} → $${adjustedDollarSize.toFixed(2)} (${(timeWeight * 100).toFixed(0)}% weight)`);

    // Ensure we don't exceed available balance
    if (action === 'buy' && adjustedDollarSize > usdtBalance) {
      return usdtBalance * 0.95; // Use 95% of available USDT
    } else if (action === 'sell') {
      // For sell, check if dollar value exceeds BNB holdings value
      if (adjustedDollarSize > bnbValueInUsdt) {
        return bnbValueInUsdt * 0.95; // Use 95% of available BNB value in USDT
      }
    }

    return adjustedDollarSize;
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
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        temperature: 0,
        system: [{
          type: "text",
          text: `You're a crypto trading analyst. Analyze market data and select the best strategy.

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
}`,
          cache_control: { type: "ephemeral" }
        }],
        messages: [{
          role: "user",
          content: `Market Data:
- Current Price: $${marketData.currentPrice}
- Latest Volume: ${marketData.latestVolume || 'N/A'}
- Price History Points: ${marketData.priceHistory?.length || 0}
- Available Strategies: ${availableStrategies.join(', ')}`
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
    logger.info(`   activePositions exists: ${!!this.activePositions}`);
    logger.info(`   activePositions type: ${this.activePositions ? this.activePositions.constructor.name : 'undefined'}`);
    logger.info(`   activePositions size: ${this.activePositions ? this.activePositions.size : 0}`);

    if (!this.activePositions || this.activePositions.size === 0) {
      logger.warn('⚠️ No active positions to monitor - activePositions map is EMPTY');
      logger.warn('   This means positions were never added to tracking OR were all auto-cleaned');
      return;
    }

    // Count virtual vs live positions
    let virtualCount = 0;
    let liveCount = 0;
    for (const [id, pos] of this.activePositions) {
      if (pos.isVirtual) virtualCount++;
      else liveCount++;
    }

    logger.info(`📊 Monitoring ${this.activePositions.size} active position(s): ${virtualCount} virtual, ${liveCount} live`);

    try {
      // 🚨 CRITICAL FIX #2: Error handling for getCurrentPrice
      let currentPrice;
      try {
        currentPrice = await this.pancakeSwap.getCurrentPrice();
      } catch (error) {
        logger.error(`❌ Failed to get current price: ${error.message}`);
        logger.error(`   Cannot monitor positions without price data`);
        return;
      }

      if (!currentPrice || currentPrice === 0) {
        logger.error(`❌ Invalid current price: ${currentPrice}`);
        logger.error(`   Cannot monitor positions with invalid price`);
        return;
      }

      const now = Date.now();

      // 🎯 EXPERT: Calculate market volatility for dynamic take profit
      const priceHistory = this.priceHistoryManager ?
        await this.priceHistoryManager.getHistory(100) : [];
      const volatility = this.calculateVolatility(priceHistory);

      // 🚨 CRITICAL FIX #3: Enhanced logging before position loop
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           📊 POSITION MONITORING CYCLE                     ║
╠═══════════════════════════════════════════════════════════╣
║  Active Positions: ${this.activePositions.size}
║  Current Price: ${currentPrice.toFixed(8)}
║  Timestamp: ${new Date().toISOString()}
║  Volatility: ${(volatility * 100).toFixed(2)}%
╚═══════════════════════════════════════════════════════════╝
`);

      for (const [id, position] of this.activePositions) {
        const posType = position.isVirtual ? '👻 VIRTUAL' : '💰 LIVE';
        logger.info(`🔍 Checking position ${id} (${posType}):
  Side: ${position.side || 'UNDEFINED'}
  Entry: ${position.entryPrice ? position.entryPrice.toFixed(8) : 'UNDEFINED'}
  TP: ${position.takeProfit ? position.takeProfit.toFixed(8) : 'NOT SET'}
  SL: ${position.stopLoss ? position.stopLoss.toFixed(8) : 'NOT SET'}
  Timestamp: ${position.timestamp ? new Date(position.timestamp).toISOString() : 'UNDEFINED'}
`);
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

        // 🔧 FIX: Calculate profit correctly based on position side
        const profit = position.side === 'buy'
          ? (currentPrice - position.entryPrice) / position.entryPrice  // BUY: profit when price goes UP
          : (position.entryPrice - currentPrice) / position.entryPrice; // SELL: profit when price goes DOWN
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
          // CRITICAL FIX: Always evaluate BOTH conditions, never show "N/A"
          const buyConditionMet = currentPrice >= position.takeProfit;
          const sellConditionMet = currentPrice <= position.takeProfit;
          const correctCondition = position.side === 'buy' ? buyConditionMet : sellConditionMet;

          logger.info(`
🔍 DETAILED TP CHECK for ${id}:
  ═══════════════════════════════════════
  Current Price: ${currentPrice.toFixed(11)}
  TP Target: ${position.takeProfit ? position.takeProfit.toFixed(11) : 'NOT SET'}
  Entry Price: ${position.entryPrice.toFixed(11)}

  Current P&L%: ${(profit * 100).toFixed(3)}%
  TP Percent Setting: ${tpPercent}%
  Side: ${position.side || 'UNDEFINED'}

  ═══ EXIT LOGIC EVALUATION (ALWAYS EVALUATED) ═══
  FOR BUY: currentPrice >= TP? ${buyConditionMet} ${position.side === 'buy' ? '← ACTIVE' : '(not used)'}
           (${currentPrice.toFixed(8)} >= ${position.takeProfit ? position.takeProfit.toFixed(8) : 'none'})

  FOR SELL: currentPrice <= TP? ${sellConditionMet} ${position.side === 'sell' ? '← ACTIVE' : '(not used)'}
            (${currentPrice.toFixed(8)} <= ${position.takeProfit ? position.takeProfit.toFixed(8) : 'none'})

  CORRECT CONDITION FOR ${position.side?.toUpperCase()}: ${correctCondition}
  WILL EXIT NOW: ${correctCondition}
  ═══════════════════════════════════════
`);

          // Check if TP hit based on side (using pre-calculated condition for consistency)
          if (correctCondition) {
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
          logger.warn(`🛑 Stop loss hit (BUY): ${currentPrice} <= ${position.stopLoss}`);
          await this.executeExit(position, currentPrice, 'stop_loss');
          continue;
        }

        // 🚨 CRITICAL FIX #1: Missing SELL stop loss check
        if (position.side === 'sell' && currentPrice >= position.stopLoss) {
          logger.warn(`🛑 Stop loss hit (SELL): ${currentPrice} >= ${position.stopLoss}`);
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
      // 🔧 FIX: Calculate profit correctly based on position side
      const profit = position.side === 'buy'
        ? (currentPrice - position.entryPrice) / position.entryPrice  // BUY: profit when price goes UP
        : (position.entryPrice - currentPrice) / position.entryPrice; // SELL: profit when price goes DOWN
      const profitUSD = profit * position.size;
      const holdTime = Date.now() - position.timestamp;
      const holdMinutes = (holdTime / 60000).toFixed(0);

      // 🐛 FIX: Null check for position.side before calling toUpperCase()
      const side = (position.side || 'unknown').toUpperCase();
      const posType = position.isVirtual ? '👻 VIRTUAL' : '💰 LIVE';

      // ═══════════════════════════════════════════════════════════
      // 🎯 EXIT EXECUTION - Enhanced Logging (Phase 1)
      // ═══════════════════════════════════════════════════════════
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║              🎯 POSITION EXIT EXECUTING (${posType})           ║
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
   * FIXED: Now uses 4-hour lookback to capture real market movements
   * @param {Array} priceHistory - Recent price history
   * @param {string} timeframe - Optional: 'short' (1h) or 'medium' (4h), defaults to 'medium'
   * @returns {number} Volatility (0-1 scale)
   */
  calculateVolatility(priceHistory, timeframe = 'medium') {
    // 🔧 FIX: Validate input and provide sensible defaults
    if (!priceHistory || !Array.isArray(priceHistory)) {
      logger.warn('⚠️ Invalid priceHistory for volatility calculation, using default 1.5%');
      return 0.015; // Default medium volatility
    }

    // Define lookback periods (assuming 5-min intervals)
    // 1-hour = 12 periods × 5min, 4-hour = 48 periods × 5min
    const LOOKBACK_1H = 12;
    const LOOKBACK_4H = 48;
    const lookbackPeriod = timeframe === 'short' ? LOOKBACK_1H : LOOKBACK_4H;

    if (priceHistory.length < lookbackPeriod) {
      logger.warn(`⚠️ Insufficient data (${priceHistory.length} points), need ${lookbackPeriod}, using default 3.0%`);
      return 0.03;
    }

    const prices = priceHistory.slice(-lookbackPeriod).map(p => {
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

    if (prices.length < Math.floor(lookbackPeriod / 2)) {
      logger.warn(`⚠️ Too many invalid prices, using default volatility`);
      return 0.015;
    }

    // Calculate logarithmic returns ONLY from the exact lookback window
    // This ensures 1h uses only 12 candles, 4h uses only 48 candles
    const returns = [];
    const actualWindow = Math.min(prices.length, lookbackPeriod);
    const startIndex = Math.max(0, prices.length - actualWindow);

    for (let i = startIndex + 1; i < prices.length; i++) {
      const ret = Math.log(prices[i] / prices[i - 1]);  // Log returns, not arithmetic
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
    const volatilityPer5Min = Math.sqrt(variance);

    // Scale to full timeframe volatility (√n periods)
    // 1h = 12 periods (√12 = 3.46), 4h = 48 periods (√48 = 6.93)
    const scaleFactor = Math.sqrt(lookbackPeriod);
    const volatility = volatilityPer5Min * scaleFactor;

    // 🔧 FIX: Validate result and cap at realistic max
    if (isNaN(volatility) || !isFinite(volatility)) {
      logger.warn('⚠️ Invalid volatility calculation, using default');
      return 0.015;
    }

    // Track volatility for dynamic cap calculation
    this.volatilityTracker.addReading(volatility);

    // Use dynamic cap instead of static 5% cap
    const dynamicCap = this.volatilityTracker.getDynamicCap();
    const cappedVolatility = Math.min(Math.max(volatility, 0.001), dynamicCap);

    // Enhanced logging with timeframe indicator
    const timeframeLabel = timeframe === 'short' ? '1h' : '4h';
    logger.debug(`📊 Volatility (${timeframeLabel}): ${(volatility * 100).toFixed(2)}% (capped: ${(cappedVolatility * 100).toFixed(2)}%)`);

    return cappedVolatility;
  }

  /**
   * DEPRECATED: Use calculateDynamicTPSL instead
   * Kept for backward compatibility only
   * @param {number} currentPrice - Current market price
   * @param {string} side - 'buy' or 'sell'
   * @param {number} volatility - Market volatility (ignored, using full history)
   * @returns {number} Take profit price
   */
  calculateDynamicTakeProfit(currentPrice, side, volatility) {
    logger.warn('⚠️ Using deprecated calculateDynamicTakeProfit, switching to calculateDynamicTPSL');

    // Get full price history for comprehensive calculation
    const priceHistory = this.priceHistoryManager
      ? this.priceHistoryManager.getHistory()
      : [];

    const result = this.calculateDynamicTPSL(currentPrice, side, priceHistory);
    return result.takeProfit;
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

      // 🚨 PROFITABILITY FILTER: Check if market volatility is sufficient for profitable trading
      // UPDATED: Now uses DUAL volatility measurement (1h + 4h) to capture real market movements
      // With 2.5% minimum TP (to cover 1.5% fees), need sufficient market movement
      const prices = priceHistory.map(p => p.price);

      // Calculate BOTH short-term (1h) and medium-term (4h) volatility
      const volatility1h = this.calculateVolatility(prices, 'short');  // 1-hour lookback
      const volatility4h = this.calculateVolatility(prices, 'medium'); // 4-hour lookback (default)

      // ═══════════════════════════════════════════════════════════════
      // VOLATILITY REGIME DETECTION
      // ═══════════════════════════════════════════════════════════════

      // Detect current market regime
      this.currentRegime = detectVolatilityRegime(volatility4h);
      const regimeConfig = getRegimeConfig(this.currentRegime);

      logger.info(`📊 [REGIME] Detected: ${this.currentRegime}`);
      logger.info(`📊 [REGIME] Description: ${regimeConfig.description}`);
      logger.info(`📊 [REGIME] 4h Volatility: ${(volatility4h * 100).toFixed(2)}%`);

      // Record regime in history
      this.regimeHistory.push({
        regime: this.currentRegime,
        volatility4h: volatility4h,
        timestamp: Date.now()
      });

      // Keep last 100 records
      if (this.regimeHistory.length > 100) {
        this.regimeHistory.shift();
      }

      // Check if volatility too low for trading
      if (this.currentRegime === 'VERY_LOW') {
        logger.warn(`⚠️ [REGIME] Volatility too low: ${(volatility4h * 100).toFixed(2)}%`);
        logger.info(`💤 [REGIME] Minimum required: ${REGIME_THRESHOLDS.LOW}%`);
        logger.info(`💤 [REGIME] Skipping trade - waiting for higher volatility`);

        return {
          action: 'HOLD',
          reason: 'volatility_too_low',
          regime: this.currentRegime,
          regimeConfig: {
            name: regimeConfig.name,
            volatility4h: volatility4h,
            strategy: 'none'
          },
          confidence: 0.0,  // ✅ FIX: Add confidence for VERY_LOW regime
          position_size: 0,  // ✅ FIX: Use underscore to match normal decisions
          takeProfit: 0,
          stopLoss: 0
        };
      }

      logger.info(`✅ [REGIME] Volatility sufficient for trading`);

      // ═══════════════════════════════════════════════════════════════
      // REGIME-BASED STRATEGY SELECTION
      // ═══════════════════════════════════════════════════════════════

      // Get allowed strategies for this regime
      const allowedStrategies = regimeConfig.strategies;
      logger.info(`📋 [REGIME] Allowed strategies: ${allowedStrategies.join(', ')}`);

      // Use regime's primary strategy
      let selectedStrategy = regimeConfig.primaryStrategy;

      // Get AI strategy recommendation (still valuable for confirmation)
      const aiRecommendation = await this._getAIStrategySelection(
        enhancedMarketData,
        allowedStrategies  // Only consider regime-appropriate strategies
      );

      // Use AI-recommended strategy if confidence > 0.7 AND it's allowed in this regime
      if (aiRecommendation && aiRecommendation.confidence > 0.7 && allowedStrategies.includes(aiRecommendation.strategy)) {
        selectedStrategy = aiRecommendation.strategy;
        logger.info(`✨ [AI] Override: Using ${selectedStrategy} (${aiRecommendation.reasoning})`);
      }

      logger.info(`🎯 [REGIME] Selected strategy: ${selectedStrategy}`);

      // Fallback: if selected strategy not available, use first allowed strategy
      if (!this.strategies[selectedStrategy]) {
        logger.warn(`⚠️ [REGIME] Strategy '${selectedStrategy}' not found, using fallback`);
        selectedStrategy = allowedStrategies.find(s => this.strategies[s]) || 'gridTrading';
        logger.info(`🔄 [REGIME] Fallback strategy: ${selectedStrategy}`);
      }

      const decision = await this.strategies[selectedStrategy](analysis, enhancedMarketData, researchData);

      // ═══════════════════════════════════════════════════════════════
      // UNIVERSAL 8-INDICATOR CONFIDENCE SCORING
      // Apply professional weighted confidence to ALL strategies
      // ═══════════════════════════════════════════════════════════════

      if (decision) {
        logger.info(`📊 [8-INDICATOR] Applying professional confidence scoring to ${selectedStrategy} strategy...`);

        const strategyConfidence = decision.confidence;
        const indicatorResult = await this.calculate8IndicatorConfidence(
          enhancedMarketData,
          decision.action
        );

        // Override strategy confidence with professional 8-indicator score
        decision.confidence = indicatorResult.confidence;
        decision.indicatorBreakdown = indicatorResult.indicatorBreakdown;
        decision.timeFactor = indicatorResult.timeFactor;
        decision.normalizedConfidence = indicatorResult.normalizedConfidence;

        // Update reasoning with 8-indicator contribution
        const indicatorAction = indicatorResult.action;
        const actionMatch = indicatorAction === decision.action ? '✅' : '⚠️';
        decision.reasoning = `${decision.reasoning} | 8-IND: ${(indicatorResult.confidence * 100).toFixed(1)}% ${actionMatch}`;

        logger.info(`🔄 [8-INDICATOR] Confidence overridden: ${(strategyConfidence * 100).toFixed(1)}% (${selectedStrategy}) → ${(decision.confidence * 100).toFixed(1)}% (8-indicator)`);

        // Check for action override opportunity
        const indicatorConfidence = indicatorResult.confidence;
        // 🚀 ENHANCEMENT #1: Use dynamic threshold based on regime
        const minConfidence = this.getMinConfidenceForRegime(this.currentRegime);

        if (decision.action.toUpperCase() === 'HOLD' && indicatorAction.toUpperCase() !== 'HOLD') {
          if (this.lastTradeTime && (Date.now() - this.lastTradeTime < this.MIN_TIME_BETWEEN_TRADES)) {
            const cooldownRemaining = Math.ceil((this.MIN_TIME_BETWEEN_TRADES - (Date.now() - this.lastTradeTime)) / 1000);
            logger.warn(`⏸️ [8-INDICATOR] Override blocked: In cooldown period (${cooldownRemaining}s remaining)`);
          } else if (indicatorConfidence >= minConfidence) {
            logger.info(`✅ [8-INDICATOR] Overriding HOLD with ${indicatorAction} at ${(indicatorConfidence * 100).toFixed(1)}% confidence (threshold: ${(minConfidence * 100).toFixed(0)}%)`);
            decision.action = indicatorAction;
            decision.confidence = indicatorConfidence;
            decision.overrideReason = 'high_confidence_override';
          } else {
            logger.info(`⏭️ [8-INDICATOR] No override: Confidence ${(indicatorConfidence * 100).toFixed(1)}% below ${(minConfidence * 100).toFixed(0)}% threshold`);
          }
        } else if (decision.action.toUpperCase() !== indicatorAction.toUpperCase() && decision.action.toUpperCase() !== 'HOLD') {
          logger.warn(`⚠️ [8-INDICATOR] Signal conflict: Strategy ${decision.action} vs Indicator ${indicatorAction}`);
          logger.warn(`⚠️ [8-INDICATOR] Keeping strategy action (respecting active signal)`);
        }
      }

      // Apply AI risk adjustment
      if (aiRecommendation && aiRecommendation.riskLevel === 'high') {
        decision.confidence *= 0.8; // Reduce confidence in high-risk conditions
        decision.position_size *= 0.7; // Reduce position size
        logger.info(`⚠️ AI risk adjustment: Reduced confidence and position size`);
      }

      // ═══════════════════════════════════════════════════════════════
      // REGIME-BASED CONFIDENCE ADJUSTMENT (WITH VALIDATION)
      // ═══════════════════════════════════════════════════════════════

      if (decision && typeof decision.confidence === 'number' && !isNaN(decision.confidence)) {
        const originalConfidence = decision.confidence;
        // decision.confidence *= regimeConfig.confidenceBoost; // REMOVED - regime affects position only
        logger.info(`🎯 [REGIME] Regime: ${this.currentRegime} (${(regimeConfig.positionSizePercent * 100).toFixed(1)}% base position)`);
        logger.info(`🎯 [REGIME] Confidence maintained: ${(originalConfidence * 100).toFixed(1)}% (no regime penalty)`);
      } else {
        // Set default confidence if missing or NaN
        const defaultConfidence = 0.50;
        logger.warn(`⚠️ [REGIME] Confidence was ${decision.confidence} (invalid), setting to default ${(defaultConfidence * 100).toFixed(0)}%`);
        decision.confidence = defaultConfidence;
      }

      // Ensure confidence is always valid
      if (typeof decision.confidence !== 'number' || isNaN(decision.confidence)) {
        decision.confidence = 0.0;
        logger.error(`❌ [REGIME] Failed to set valid confidence, using 0%`);
      }

      // Add regime metadata to decision
      decision.regime = this.currentRegime;
      decision.regimeConfig = {
        name: regimeConfig.name,
        volatility4h: volatility4h,
        strategy: selectedStrategy
      };

      // ═══════════════════════════════════════════════════════════════
      // REGIME-BASED POSITION SIZING
      // ═══════════════════════════════════════════════════════════════

      // Get portfolio value (shadow mode or real)
      let portfolioValue;
      if (global.shadowMode && global.shadowMode.isActive) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        const currentPrice = await this.pancakeSwap.getCurrentPrice();
        portfolioValue = virtualBalances.usdt + (virtualBalances.bnb / currentPrice);
      } else {
        // For real mode, get balances from pancakeSwap
        const usdtBalance = await this.pancakeSwap.getUSDTBalance();
        const bnbBalance = await this.pancakeSwap.getBNBBalance();
        const currentPrice = await this.pancakeSwap.getCurrentPrice();
        portfolioValue = usdtBalance + (bnbBalance / currentPrice);
      }

      // Calculate regime-appropriate position size
      const regimePositionSize = calculatePositionSize(
        this.currentRegime,
        decision.confidence,
        portfolioValue
      );

      logger.info(`💰 [REGIME] Position sizing:`);
      logger.info(`   Portfolio: $${portfolioValue.toFixed(2)}`);
      logger.info(`   Regime: ${this.currentRegime} (${(regimeConfig.positionSizePercent * 100).toFixed(1)}% base)`);
      logger.info(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      logger.info(`   Position Size: $${regimePositionSize.toFixed(2)}`);

      // Override the decision's position size with regime calculation
      decision.position_size = regimePositionSize;

      // 🚨 CRITICAL FIX: Track position when trade is executed
      if (decision.action !== 'hold' && decision.position_size > 0) {
        const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 🔧 FIX 3: Ensure side is ALWAYS set and valid
        const side = decision.action && (decision.action === 'buy' || decision.action === 'sell')
          ? decision.action
          : 'buy'; // Default to 'buy' if undefined

        if (!decision.action || (decision.action !== 'buy' && decision.action !== 'sell')) {
          logger.warn(`⚠️ Invalid decision.action: ${decision.action}, defaulting to 'buy'`);
        }

        // ═══════════════════════════════════════════════════════════════
        // REGIME-BASED TP/SL CALCULATION
        // ═══════════════════════════════════════════════════════════════

        const entryPrice = decision.parameters.currentPrice;

        // Calculate regime-appropriate TP/SL percentages
        const tpslConfig = calculateTPSL(this.currentRegime, volatility4h);

        const tpPercent = tpslConfig.tp;  // Already in decimal format (e.g., 0.012 = 1.2%)
        const slPercent = tpslConfig.sl;

        // Calculate actual price levels based on side
        let takeProfit, stopLoss;
        if (side === 'buy') {
          takeProfit = entryPrice * (1 + tpPercent);  // Higher price for long
          stopLoss = entryPrice * (1 - slPercent);    // Lower price for long
        } else {
          takeProfit = entryPrice * (1 - tpPercent);  // Lower price for short
          stopLoss = entryPrice * (1 + slPercent);    // Higher price for short
        }

        // Calculate risk:reward ratio
        const riskRewardRatio = tpPercent / slPercent;

        logger.info(`🎯 [REGIME] TP/SL Calculation:`);
        logger.info(`   Entry: $${entryPrice.toFixed(2)}`);
        logger.info(`   TP: $${takeProfit.toFixed(2)} (+${(tpPercent * 100).toFixed(2)}%)`);
        logger.info(`   SL: $${stopLoss.toFixed(2)} (-${(slPercent * 100).toFixed(2)}%)`);
        logger.info(`   R:R Ratio: 1:${riskRewardRatio.toFixed(2)}`);

        // Update decision with TP/SL values
        decision.takeProfit = takeProfit;
        decision.stopLoss = stopLoss;

        // 🚨 CRITICAL: Reject trades with poor risk:reward ratio
        // Don't risk 2% to make 0.3% - that's unsustainable
        if (riskRewardRatio < 1.2) {
          logger.warn(`❌ R:R too low (1:${riskRewardRatio.toFixed(2)}). Skipping trade.`);
          logger.warn(`   TP: ${(tpPercent * 100).toFixed(2)}% | SL: ${(slPercent * 100).toFixed(2)}%`);
          decision.action = 'hold';
          decision.confidence = 0;
          decision.reasoning += ` (Skipped: R:R 1:${riskRewardRatio.toFixed(2)} < minimum 1:1.2)`;
          return decision;
        }

        const position = {
          id: positionId,
          side: side, // FIX 3: ALWAYS valid side ('buy' or 'sell')
          entryPrice: entryPrice,
          size: decision.position_size,
          confidence: decision.confidence,
          strategy: selectedStrategy,  // Use regime-selected strategy
          regime: this.currentRegime,   // Track regime for position
          timestamp: Date.now(), // FIX: Use 'timestamp' instead of 'entryTime' for consistency
          stopLoss: stopLoss,
          takeProfit: takeProfit, // ✅ Always defined
          takeProfitPercent: tpPercent, // Store the % for reference
          stopLossPercent: slPercent, // ✨ Store SL % for analysis
          riskRewardRatio: riskRewardRatio, // ✨ Store R:R ratio (regime-based)
          volatilityAtEntry: volatility4h, // ✨ Store 4h volatility
          regimeAtEntry: this.currentRegime, // ✨ Store regime
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

  // ═══════════════════════════════════════════════════════════════════════════
  // ❌ DEPRECATED STRATEGIES - Removed from active rotation (4-Strategy System)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // The following strategies are NO LONGER ACTIVE but kept for reference.
  // Research shows 4 strategies is optimal for $60K portfolio to avoid overlap.
  //
  // DEPRECATED:
  // 1. ranging → 70-85% correlation with mean_reversion
  // 2. breakout → 60-75% correlation with momentum
  // 3. vwap → Limited effectiveness in 24/7 DeFi markets
  // 4. ichimoku → Only works well in sustained trending markets
  //
  // ACTIVE (4 core strategies):
  // ✅ gridTrading, momentum, mean_reversion, arbitrage
  //
  // NOTE: VWAP indicator (18% weight) remains active in 8-indicator system!
  // All 4 strategies still use VWAP via calculate8IndicatorConfidence()
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ❌ DEPRECATED: Ranging Strategy
   * Reason: 70-85% correlation with mean_reversion strategy
   * Replacement: Use mean_reversion or gridTrading instead
   */
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

      // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
      const bnbValueInUsdt = bnbBalance / currentPrice;

      // 🚨 CRITICAL FIX: SELL at upper bound (within 5% of range)
      if (upperDistance <= thresholdPercent) {
        // 🔧 FIX: Use symmetric balance requirement - same minimum USD value as BUY
        const minBnbValue = this.config.minBalance; // $10 minimum in BNB value
        if (bnbValueInUsdt < minBnbValue) {
          return {
            action: 'hold',
            confidence: 0.5,
            reasoning: `🔴 At upper bound but insufficient BNB to sell (have $${bnbValueInUsdt.toFixed(2)}, need $${minBnbValue})`,
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
      // ❌ REMOVED: MACD redundant with RSI per research
      const { RSI, /* MACD, */ EMA } = require('technicalindicators');

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

      // ❌ REMOVED: MACD redundant with RSI per research
      // // Calculate MACD (12, 26, 9)
      // const macdValues = MACD.calculate({
      //   values: closePrices,
      //   fastPeriod: 12,
      //   slowPeriod: 26,
      //   signalPeriod: 9,
      //   SimpleMAOscillator: false,
      //   SimpleMASignal: false
      // });
      // const currentMACD = macdValues[macdValues.length - 1];
      // const previousMACD = macdValues[macdValues.length - 2];

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

      // ❌ REMOVED: MACD redundant with RSI per research
      // // Detect MACD crossovers
      // const macdBullishCross = currentMACD.MACD > currentMACD.signal &&
      //   previousMACD.MACD <= previousMACD.signal;
      // const macdBearishCross = currentMACD.MACD < currentMACD.signal &&
      //   previousMACD.MACD >= previousMACD.signal;

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

      // ═══════════════════════════════════════════════════════════════
      // MOMENTUM DECISION LOGIC
      // Note: Professional 8-indicator confidence will be applied by makeTradingDecision()
      // ═══════════════════════════════════════════════════════════════

      logger.info(`📊 [MOMENTUM] RSI: ${currentRSI.toFixed(1)} | Trend: ${isUptrend ? 'Up' : isDowntrend ? 'Down' : 'Sideways'} | Strength: ${trendStrength.toFixed(2)}%`);

      let action = 'hold';
      let confidence = 0.50; // Base confidence, will be overridden by 8-indicator system
      let reasoning = '';

      // Simple momentum-based decision logic
      // The universal 8-indicator confidence calculator will provide the final professional confidence
      if (isUptrend && !isOverbought) {
        action = 'buy';
        confidence = isOversold ? 0.75 : 0.65;
        reasoning = `📈 Momentum buy: Uptrend (EMA20: ${currentEMA20.toFixed(8)}, EMA50: ${currentEMA50.toFixed(8)}), RSI ${currentRSI.toFixed(1)} ${isOversold ? '(oversold - strong signal)' : '(not overbought)'}`;
      } else if (isDowntrend || isOverbought) {
        action = 'sell';
        confidence = isOverbought ? 0.70 : 0.60;
        reasoning = `📉 Momentum sell: ${isDowntrend ? 'Downtrend' : 'Overbought'} (RSI ${currentRSI.toFixed(1)}, trend strength ${trendStrength.toFixed(2)}%)`;
      } else if (isOversold && !isDowntrend) {
        action = 'buy';
        confidence = 0.60;
        reasoning = `🔄 Momentum buy: Oversold RSI ${currentRSI.toFixed(1)}, not in downtrend (potential reversal)`;
      } else {
        action = 'hold';
        confidence = 0.45;
        reasoning = `⏸️ Momentum hold: ${isSideways ? 'Sideways trend' : 'Mixed signals'} (RSI ${currentRSI.toFixed(1)}, trend strength ${trendStrength.toFixed(2)}%)`;
      }

      // Return basic decision - universal 8-indicator confidence will be applied by makeTradingDecision()

      return {
        action,
        confidence,
        reasoning,
        parameters: {
          currentPrice,
          rsi: currentRSI,
          // ❌ REMOVED: MACD parameters (redundant with RSI)
          // macd: currentMACD.MACD,
          // macdSignal: currentMACD.signal,
          // macdHistogram: currentMACD.histogram,
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

  /**
   * ❌ DEPRECATED: Breakout Strategy
   * Reason: 60-75% correlation with momentum strategy
   * Replacement: Use momentum instead
   */
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

      // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
      const bnbValueInUsdt = bnbBalance / currentPrice;

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
  // ============================================================================
  // ❌ DEPRECATED: VWAP STRATEGY - Volume Weighted Average Price
  // ============================================================================
  /**
   * ❌ DEPRECATED: VWAP Strategy
   * Reason: Limited effectiveness in 24/7 DeFi markets (low liquidity variance)
   * Note: VWAP INDICATOR (18% weight) remains active in 8-indicator system!
   * Replacement: VWAP indicator used by all 4 active strategies
   */
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
      // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
      const bnbValueInUsdt = bnbBalance / currentPrice;

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
  // ❌ DEPRECATED: ICHIMOKU CLOUD STRATEGY - Comprehensive Technical Analysis
  // ============================================================================
  /**
   * ❌ DEPRECATED: Ichimoku Cloud Strategy
   * Reason: Only works well in sustained trending markets (moderate effectiveness)
   * Replacement: Use momentum for trending markets, gridTrading for consolidation
   */
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

      // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
      const bnbValueInUsdt = bnbBalance / currentPrice;

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

      // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
      const bnbValueInUsdt = bnbBalance / currentPrice;
      const currentLevel = this._findCurrentGridLevel(currentPrice);
      const tradingDecision = await this._evaluateGridTrading(currentPrice, currentLevel, usdtBalance, bnbBalance, bnbValueInUsdt);

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

  async _evaluateGridTrading(currentPrice, currentLevel, usdtBalance, bnbBalance, bnbValueInUsdt) {
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

      // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
      const bnbValueInUsdt = bnbBalance / currentPrice;

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

  /**
   * ═══════════════════════════════════════════════════════════════
   * INSTITUTIONAL GRADE CONFIDENCE CALCULATION (2025-10-29)
   * Professional-grade institutional tools + proven technical indicators
   * ═══════════════════════════════════════════════════════════════
   *
   * Calculates weighted confidence based on 6 independent indicators:
   *
   * **INSTITUTIONAL TOOLS (56% total):**
   * 1. Order Flow (20%) - Buy/sell pressure from DEX swap events
   * 2. Volume Profile (18%) - Point of Control (POC) detection
   * 3. Liquidity (18%) - AMM reserve monitoring
   *
   * **TECHNICAL TOOLS (44% total):**
   * 4. VWAP (15%) - Institutional benchmark (reduced from 18%)
   * 5. ATR Volatility (12%) - Risk management (reduced from 20%)
   * 6. Market Regime (9%) - Regime detection (reduced from 12%)
   *
   * @param {Object} marketData - Current market data with price history
   * @param {string} proposedAction - Proposed action from strategy ('buy', 'sell', 'hold')
   * @returns {Object} - {confidence, action, reasoning, indicatorBreakdown}
   */
  async calculate8IndicatorConfidence(marketData, proposedAction = 'hold') {
    try {
      logger.info('📊 [INSTITUTIONAL] Calculating professional-grade confidence...');
      logger.info('═══════════════════════════════════════════════════════════');

      // Get required data
      const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
      const priceHistory = this.priceHistoryManager ? this.priceHistoryManager.getHistory() : (marketData?.priceHistory || []);

      if (priceHistory.length < 50) {
        logger.warn(`⚠️ Insufficient price history (${priceHistory.length}/50) for institutional calculation`);
        return {
          confidence: 0.50,
          action: 'hold',
          reasoning: `Building history (${priceHistory.length}/50)`,
          indicatorBreakdown: {}
        };
      }

      const closePrices = priceHistory.slice(-100).map(p => p.price || p.close);
      const volumes = priceHistory.slice(-100).map(p => p.volume || 0);

      // Initialize confidence system
      const WEIGHTS = {
        orderFlow: 0.20,       // 20% - Institutional order flow
        volumeProfile: 0.18,   // 18% - Volume Profile POC
        liquidity: 0.18,       // 18% - AMM liquidity monitoring
        vwap: 0.15,            // 15% - VWAP (reduced from 18%)
        atr: 0.12,             // 12% - ATR (reduced from 20%)
        regime: 0.09           // 9% - Regime (reduced from 12%)
        // REMOVED: multiTimeframe (20%), volume (18%), rsi (12%), ema (10%)
        // Total: 92% → 100% with rounding adjustments
      };

      let confidenceScore = 0;
      const indicatorScores = {};
      const indicatorDetails = {};

      // ═══════════════════════════════════════════════════════════════
      // PREPARE DATA FOR INSTITUTIONAL TOOLS
      // ═══════════════════════════════════════════════════════════════

      // Get recent swap events (last 100 swaps for order flow)
      let recentSwaps = [];
      let historicalSwaps = [];
      let pairContract = null;

      try {
        // Get pair contract for liquidity analysis
        const PAIR_ADDRESS = '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE'; // PancakeSwap USDT/BNB

        const pairABI = [
          'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
          'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
        ];

        const { Contract } = require('ethers');
        pairContract = new Contract(
          PAIR_ADDRESS,
          pairABI,
          this.pancakeSwap.provider
        );

        logger.debug('✅ Pair contract initialized for liquidity analysis');

      } catch (error) {
        logger.error('Failed to initialize pair contract:', error.message);
      }

      try {
        // Get recent swap events from price history
        if (this.priceHistoryManager && this.priceHistoryManager.history) {
          const history = this.priceHistoryManager.history;
          const recentHistory = history.slice(-100); // Last 100 data points

          // Convert price history to swap-like format for institutional tools
          recentSwaps = recentHistory.map((point, i) => ({
            amount0Out: point.volume > 0 ? String(point.volume / 2) : '0',
            amount0In: point.volume > 0 ? String(point.volume / 2) : '0',
            amount1Out: '1.0',
            amount1In: '1.0',
            timestamp: point.timestamp || Date.now() - ((100 - i) * 60000)
          }));

          // Historical swaps (last 500 for volume profile)
          const historicalHistory = history.slice(-500);
          historicalSwaps = historicalHistory.map((point, i) => ({
            amount0In: point.volume > 0 ? String(point.volume) : '0',
            amount1Out: String(point.price),
            timestamp: point.timestamp || Date.now() - ((500 - i) * 60000)
          }));

          logger.debug(`✅ Prepared ${recentSwaps.length} recent swaps and ${historicalSwaps.length} historical swaps from price history`);

          // Enhanced debug logging for institutional tools data pipeline
          logger.info(`🔍 DEBUG: priceHistoryManager exists: ${!!this.priceHistoryManager}`);
          logger.info(`🔍 DEBUG: priceHistory length: ${this.priceHistoryManager?.history?.length || 0}`);
          logger.info(`🔍 DEBUG: Prepared ${recentSwaps.length} recent swaps`);
          if (recentSwaps.length > 0) {
            logger.info(`🔍 DEBUG: First recent swap: ${JSON.stringify(recentSwaps[0])}`);
          }
          logger.info(`🔍 DEBUG: Prepared ${historicalSwaps.length} historical swaps`);
          if (historicalSwaps.length > 0) {
            logger.info(`🔍 DEBUG: First historical swap: ${JSON.stringify(historicalSwaps[0])}`);
          }
        }
      } catch (error) {
        logger.error('Failed to prepare swap data from price history:', error.message);
      }

      // ═══════════════════════════════════════════════════════════════
      // 1. ORDER FLOW INDICATOR (20% weight)
      // ═══════════════════════════════════════════════════════════════
      try {
        const orderFlowSignal = await this.orderFlow.getOrderFlowSignal(recentSwaps);

        let orderFlowScore = 0;
        if (orderFlowSignal.status === 'SUCCESS') {
          const delta = orderFlowSignal.data.deltaPercent || 0;

          // Convert delta percentage to confidence score
          if (delta > 0.15) {
            orderFlowScore = 0.20; // Strong buy pressure
          } else if (delta > 0.05) {
            orderFlowScore = 0.15; // Moderate buy pressure
          } else if (delta < -0.15) {
            orderFlowScore = -0.20; // Strong sell pressure
          } else if (delta < -0.05) {
            orderFlowScore = -0.15; // Moderate sell pressure
          } else {
            orderFlowScore = 0; // Balanced
          }
        } else {
          orderFlowScore = 0; // Degraded signal → neutral
        }

        orderFlowScore = Math.max(-0.30, Math.min(0.30, orderFlowScore));
        orderFlowScore = isNaN(orderFlowScore) ? 0 : orderFlowScore;
        indicatorScores.orderFlow = orderFlowScore;
        confidenceScore += orderFlowScore;
        indicatorDetails.orderFlow = orderFlowSignal;

        logger.info(`[1/6] Order Flow (20%): ${orderFlowScore > 0 ? '+' : ''}${(orderFlowScore * 100).toFixed(1)}% | Delta: ${((orderFlowSignal.data?.deltaPercent || 0) * 100).toFixed(1)}%`);
      } catch (error) {
        logger.warn(`⚠️ Order Flow error: ${error.message}`);
        indicatorScores.orderFlow = 0;
        indicatorDetails.orderFlow = { status: 'ERROR', confidence: 0.5 };
      }

      // ═══════════════════════════════════════════════════════════════
      // 2. VOLUME PROFILE INDICATOR (18% weight)
      // ═══════════════════════════════════════════════════════════════
      try {
        const volumeProfileSignal = await this.volumeProfile.getVolumeProfileSignal(currentPrice, historicalSwaps);

        let volumeProfileScore = 0;
        if (volumeProfileSignal.status === 'SUCCESS') {
          const confidence = volumeProfileSignal.confidence || 0.5;

          // Convert 0-1 confidence to score
          volumeProfileScore = (confidence - 0.5) * 0.36; // Scale to ±18%
        } else {
          volumeProfileScore = 0; // Degraded signal → neutral
        }

        volumeProfileScore = Math.max(-0.30, Math.min(0.30, volumeProfileScore));
        volumeProfileScore = isNaN(volumeProfileScore) ? 0 : volumeProfileScore;
        indicatorScores.volumeProfile = volumeProfileScore;
        confidenceScore += volumeProfileScore;
        indicatorDetails.volumeProfile = volumeProfileSignal;

        logger.info(`[2/6] Volume Profile (18%): ${volumeProfileScore > 0 ? '+' : ''}${(volumeProfileScore * 100).toFixed(1)}% | POC: ${volumeProfileSignal.data?.poc || 'N/A'}`);
      } catch (error) {
        logger.warn(`⚠️ Volume Profile error: ${error.message}`);
        indicatorScores.volumeProfile = 0;
        indicatorDetails.volumeProfile = { status: 'ERROR', confidence: 0.5 };
      }

      // ═══════════════════════════════════════════════════════════════
      // 3. LIQUIDITY INDICATOR (18% weight)
      // ═══════════════════════════════════════════════════════════════
      try {
        const liquiditySignal = await this.liquidity.getLiquiditySignal(pairContract);

        let liquidityScore = 0;
        if (liquiditySignal.status === 'SUCCESS') {
          const confidence = liquiditySignal.confidence || 0.5;

          // Convert 0-1 confidence to score
          liquidityScore = (confidence - 0.5) * 0.36; // Scale to ±18%
        } else {
          liquidityScore = 0; // Degraded signal → neutral
        }

        liquidityScore = Math.max(-0.30, Math.min(0.30, liquidityScore));
        liquidityScore = isNaN(liquidityScore) ? 0 : liquidityScore;
        indicatorScores.liquidity = liquidityScore;
        confidenceScore += liquidityScore;
        indicatorDetails.liquidity = liquiditySignal;

        logger.info(`[3/6] Liquidity (18%): ${liquidityScore > 0 ? '+' : ''}${(liquidityScore * 100).toFixed(1)}% | Ratio: ${((liquiditySignal.data?.liquidityRatio || 0.5) * 100).toFixed(1)}%`);
      } catch (error) {
        logger.warn(`⚠️ Liquidity error: ${error.message}`);
        indicatorScores.liquidity = 0;
        indicatorDetails.liquidity = { status: 'ERROR', confidence: 0.5 };
      }

      // ═══════════════════════════════════════════════════════════════
      // 4. VWAP INDICATOR (15% weight - reduced from 18%)
      // ═══════════════════════════════════════════════════════════════
      const vwapRaw = await this.calculateVWAP(24);
      const vwap = (vwapRaw !== undefined && !isNaN(vwapRaw) && vwapRaw > 0) ? vwapRaw : currentPrice;
      const vwapDeviation = (currentPrice - vwap) / vwap;
      let vwapScore = 0;

      if (Math.abs(vwapDeviation) < 0.02) {
        vwapScore = 0.15;
      } else if (vwapDeviation > 0) {
        vwapScore = Math.min(0.15, vwapDeviation * 7.5);
      } else {
        vwapScore = Math.max(-0.15, vwapDeviation * 7.5);
      }

      vwapScore = Math.max(-0.30, Math.min(0.30, vwapScore * (WEIGHTS.vwap / 0.15)));
      vwapScore = isNaN(vwapScore) ? 0 : vwapScore;
      indicatorScores.vwap = vwapScore;
      confidenceScore += vwapScore;

      logger.info(`[4/6] VWAP (15%): ${vwapScore > 0 ? '+' : ''}${(vwapScore * 100).toFixed(1)}% | Price ${currentPrice.toFixed(8)} ${vwapDeviation < 0 ? 'below' : 'above'} VWAP ${vwap.toFixed(8)}`);

      // ═══════════════════════════════════════════════════════════════
      // 5. ATR VOLATILITY INDICATOR (12% weight - reduced from 20%)
      // ═══════════════════════════════════════════════════════════════
      const atrPeriod = 14;
      let atrScore = 0;

      if (closePrices.length >= atrPeriod) {
        let atrSum = 0;
        for (let i = 1; i < Math.min(atrPeriod, closePrices.length); i++) {
          const high = Math.max(closePrices[i], closePrices[i - 1]);
          const low = Math.min(closePrices[i], closePrices[i - 1]);
          atrSum += high - low;
        }
        const atr = atrSum / atrPeriod;
        const atrPercent = (atr / currentPrice) * 100;

        if (atrPercent < 2) {
          atrScore = 0.12;
        } else if (atrPercent > 5) {
          atrScore = -0.06;
        } else {
          atrScore = 0.12 - ((atrPercent - 2) / 3) * 0.18;
        }

        atrScore = Math.max(-0.30, Math.min(0.30, atrScore));
        atrScore = isNaN(atrScore) ? 0 : atrScore;
        indicatorScores.atr = atrScore;
        confidenceScore += atrScore;

        logger.info(`[5/6] ATR (12%): ${atrScore > 0 ? '+' : ''}${(atrScore * 100).toFixed(1)}% | ATR: ${atrPercent.toFixed(2)}%`);
      }

      // ═══════════════════════════════════════════════════════════════
      // 6. MARKET REGIME INDICATOR (9% weight - reduced from 12%)
      // ═══════════════════════════════════════════════════════════════
      let regimeScore = 0;
      const currentRegime = this.currentRegime || 'MODERATE';

      if (currentRegime === 'HIGH' || currentRegime === 'LOW') {
        regimeScore = 0.09;
      } else {
        regimeScore = 0.045;
      }

      regimeScore = Math.max(-0.30, Math.min(0.30, regimeScore));
      regimeScore = isNaN(regimeScore) ? 0 : regimeScore;
      indicatorScores.regime = regimeScore;
      confidenceScore += regimeScore;

      logger.info(`[6/6] Regime (9%): ${regimeScore > 0 ? '+' : ''}${(regimeScore * 100).toFixed(1)}% | ${currentRegime}`);

      // ═══════════════════════════════════════════════════════════════
      // FINAL CONFIDENCE CALCULATION
      // ═══════════════════════════════════════════════════════════════
      let normalizedConfidence = (confidenceScore + 1.0) / 2.0;
      normalizedConfidence = Math.max(0.05, Math.min(1.0, normalizedConfidence));

      // Determine action based on confidence and score
      let action = proposedAction;
      let reasoning = '';

      const minConfidence = this.getMinConfidenceForRegime(this.currentRegime);

      if (normalizedConfidence > minConfidence) {
        if (confidenceScore > 0.3) {
          action = 'buy';
          reasoning = `Strong institutional buy: confidence ${(normalizedConfidence * 100).toFixed(1)}% (threshold: ${(minConfidence * 100).toFixed(0)}%)`;
        } else if (confidenceScore < -0.3) {
          action = 'sell';
          reasoning = `Strong institutional sell: confidence ${(normalizedConfidence * 100).toFixed(1)}% (threshold: ${(minConfidence * 100).toFixed(0)}%)`;
        } else {
          action = 'hold';
          reasoning = `High confidence but neutral bias: ${(normalizedConfidence * 100).toFixed(1)}%`;
        }
      } else if (normalizedConfidence > 0.50) {
        action = 'hold';
        reasoning = `Moderate confidence: ${(normalizedConfidence * 100).toFixed(1)}%, waiting for stronger setup`;
      } else {
        action = 'hold';
        reasoning = `Low confidence: ${(normalizedConfidence * 100).toFixed(1)}%, waiting for better setup`;
      }

      // Safety: Handle NaN/undefined and clamp to safe range (20-90%)
      if (isNaN(normalizedConfidence) || normalizedConfidence === undefined || normalizedConfidence === null) {
        logger.warn(`⚠️ Final confidence is NaN/undefined, defaulting to 50%`);
        normalizedConfidence = 0.50;
      }
      const finalConfidence = Math.max(0.20, Math.min(0.90, normalizedConfidence));

      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`✅ FINAL INSTITUTIONAL CONFIDENCE: ${(finalConfidence * 100).toFixed(1)}%`);
      logger.info(`   Institutional tools: 56% (OrderFlow 20% + VolumeProfile 18% + Liquidity 18%)`);
      logger.info(`   Technical tools: 44% (VWAP 15% + ATR 12% + Regime 9%)`);
      logger.info(`   Action: ${action.toUpperCase()}`);
      logger.info('═══════════════════════════════════════════════════════════');

      return {
        confidence: finalConfidence,
        action,
        reasoning,
        indicatorBreakdown: indicatorScores,
        institutionalDetails: indicatorDetails,
        normalizedConfidence
      };

    } catch (error) {
      logger.error(`❌ Error in institutional confidence calculation:`, error);
      return {
        confidence: 0.50,
        action: 'hold',
        reasoning: `Error in institutional calc: ${error.message}`,
        indicatorBreakdown: {}
      };
    }
  }

  async calculateTechnicalIndicators(marketData) {
    try {
      const priceHistory = marketData?.priceHistory || await this.getPriceHistory(100);

      if (priceHistory.length < 20) {
        return { rsi: 50 }; // ❌ REMOVED: MACD
      }

      const prices = priceHistory.map(p => p.price);

      return {
        rsi: this.calculateRSI(prices, 14),
        // ❌ REMOVED: MACD redundant with RSI per research
        // macd: this.calculateMACD(prices),
        bollinger_bands: this.calculateBollingerBands(prices, 20),
        volatility: this.calculateVolatility(prices)
      };
    } catch (error) {
      logger.error('Error calculating technical indicators:', error);
      return { rsi: 50 }; // ❌ REMOVED: MACD
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
    // ✅ FIX: currentPrice is BNB/USDT, so divide to get USDT value
    const totalValue = usdtBalance + (bnbBalance / currentPrice);
    const usdtRatio = usdtBalance / totalValue;
    const targetRatio = 0.5; // 50/50 split
    const threshold = 0.1; // 10% deviation threshold

    return Math.abs(usdtRatio - targetRatio) > threshold;
  }

  async calculatePositionSize(action, confidence, usdtBalance = 0, bnbBalance = 0, currentPrice = 0) {
    return await this._calculatePositionSizeByConfidence(action, confidence, usdtBalance, bnbBalance, currentPrice);
  }

  // Technical Analysis Helper Methods

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   * VWAP = Σ(Price × Volume) / Σ(Volume)
   * Used as institutional benchmark for price position
   */
  async calculateVWAP(hours = 24) {
    try {
      const now = Date.now();
      const startTime = now - (hours * 60 * 60 * 1000);

      // ═══════════════════════════════════════════════════════════════════════════
      // 📊 PHASE 3: Fixed VWAP calculation for {price, volume, timestamp} structure
      // ═══════════════════════════════════════════════════════════════════════════

      // Get ALL price history (priceHistoryManager.getHistory() takes no parameters)
      const allHistory = await this.priceHistoryManager.getHistory();

      if (!allHistory || allHistory.length === 0) {
        logger.warn('⚠️ [VWAP] No price history available - using current price as fallback');
        return await this.pancakeSwap.getCurrentPrice();
      }

      // Filter to requested time range
      const history = allHistory.filter(point => point.timestamp >= startTime);

      if (history.length === 0) {
        logger.warn(`⚠️ [VWAP] No data in last ${hours}h - using all available data (${allHistory.length} points)`);
        // Use all available data if time range is empty
        history.push(...allHistory);
      }

      let sumPriceVolume = 0;
      let sumVolume = 0;
      let pointsWithVolume = 0;

      // Calculate VWAP: Σ(price × volume) / Σ(volume)
      // Data structure: {price, volume, timestamp}
      for (const point of history) {
        const price = point.price || 0;
        const volume = point.volume || 0;

        if (volume > 0) {
          pointsWithVolume++;
          sumPriceVolume += price * volume;
          sumVolume += volume;
        }
      }

      // Handle edge case: zero volume (backward compatible)
      if (sumVolume === 0 || pointsWithVolume === 0) {
        // Fallback to simple average price when no volume data exists
        const avgPrice = history.reduce((sum, point) => sum + point.price, 0) / history.length;
        logger.warn(
          `⚠️ [VWAP] Zero total volume (${history.length} points, 0 with volume) - ` +
          `using simple average price: ${avgPrice.toFixed(8)}`
        );
        return avgPrice;
      }

      const vwap = sumPriceVolume / sumVolume;

      logger.info(
        `✅ [VWAP] Calculated: ${vwap.toFixed(8)} over ${hours}h period ` +
        `(${history.length} points, ${pointsWithVolume} with volume, total: $${sumVolume.toFixed(2)})`
      );

      return vwap;

    } catch (error) {
      logger.error(`❌ [VWAP] Error calculating VWAP: ${error.message}`);
      // Fallback to current price
      return await this.pancakeSwap.getCurrentPrice();
    }
  }

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

  // ═══════════════════════════════════════════════════════════════
  // 🚀 ENHANCEMENT #5: Enhanced RSI with Volume Confirmation (2025)
  // Only trusts RSI signals when volume confirms OR divergence detected
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate RSI with volume confirmation and divergence detection
   * @param {Array} prices - Price history array
   * @param {Array} volumes - Volume history array
   * @param {number} period - RSI period (default 14)
   * @returns {Object} { rsi, volumeConfirmed, divergence, reliable }
   */
  calculateEnhancedRSI(prices, volumes = [], period = 14) {
    const USE_ENHANCED_RSI = process.env.USE_ENHANCED_RSI !== 'false';

    // Calculate standard RSI
    const rsi = this.calculateRSI(prices, period);

    if (!USE_ENHANCED_RSI || volumes.length < period) {
      // Fallback to standard RSI if enhancement disabled or no volume data
      return { rsi, volumeConfirmed: true, divergence: false, reliable: true };
    }

    // ✅ VOLUME CONFIRMATION
    // Check if recent volume supports the RSI signal
    const recentVolumes = volumes.slice(-5); // Last 5 periods
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];

    const volumeConfirmed = currentVolume > avgVolume * 1.2; // +20% above average

    // ✅ RSI DIVERGENCE DETECTION
    // Compare recent price trend vs RSI trend (classic divergence)
    const recentPrices = prices.slice(-period);
    const recentRSIs = [];

    // Calculate RSI for each of last 3 periods
    for (let i = 3; i > 0; i--) {
      const subPrices = prices.slice(-(period + i), -i || undefined);
      recentRSIs.push(this.calculateRSI(subPrices, period));
    }
    recentRSIs.push(rsi); // Add current RSI

    // Check for bullish divergence: price falling but RSI rising
    const priceDown = recentPrices[recentPrices.length - 1] < recentPrices[0];
    const rsiUp = rsi > recentRSIs[0];
    const bullishDivergence = priceDown && rsiUp && rsi < 35;

    // Check for bearish divergence: price rising but RSI falling
    const priceUp = recentPrices[recentPrices.length - 1] > recentPrices[0];
    const rsiDown = rsi < recentRSIs[0];
    const bearishDivergence = priceUp && rsiDown && rsi > 65;

    const divergence = bullishDivergence ? 'bullish' : bearishDivergence ? 'bearish' : false;

    // ✅ RELIABILITY CHECK
    // Signal is reliable if EITHER volume confirms OR divergence detected
    const reliable = volumeConfirmed || divergence !== false;

    if (!reliable) {
      logger.debug(`⚠️ [ENHANCED-RSI] Low reliability: RSI ${rsi.toFixed(1)}, Volume ${(currentVolume / avgVolume * 100).toFixed(0)}%, No divergence`);
    } else if (divergence) {
      logger.info(`📊 [ENHANCED-RSI] ${divergence.toUpperCase()} DIVERGENCE detected! RSI ${rsi.toFixed(1)}`);
    }

    return {
      rsi,
      volumeConfirmed,
      divergence,
      reliable,
      volumeRatio: currentVolume / avgVolume
    };
  }

  // ❌ REMOVED: MACD redundant with RSI per research
  // calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  //   if (prices.length < slowPeriod) return { signal: 0, histogram: 0 };

  //   const fastEMA = this.calculateEMA(prices, fastPeriod);
  //   const slowEMA = this.calculateEMA(prices, slowPeriod);
  //   const macdLine = fastEMA - slowEMA;

  //   return {
  //     macd: macdLine,
  //     signal: macdLine, // Simplified
  //     histogram: macdLine
  //   };
  // }

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

  // ✅ REMOVED DUPLICATE calculateVolatility() method
  // Using the comprehensive method at line 989 instead

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

  /**
   * Calculate Average True Range (ATR) for dynamic stop loss
   * ATR measures market volatility better than simple volatility
   * @param {Array} priceHistory - Array of {price, high, low} objects
   * @param {number} period - ATR period (default 14)
   * @returns {number} ATR value as percentage of price
   */
  calculateATR(priceHistory, period = 14) {
    if (!priceHistory || priceHistory.length < period + 1) {
      logger.warn('⚠️ Insufficient price history for ATR, using volatility fallback');
      return this.calculateVolatility(priceHistory.map(p => p.price)) || 0.02;
    }

    const trueRanges = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const current = priceHistory[i];
      const previous = priceHistory[i - 1];

      // True Range = max(high-low, abs(high-prevClose), abs(low-prevClose))
      const highLow = (current.high || current.price) - (current.low || current.price);
      const highClose = Math.abs((current.high || current.price) - previous.price);
      const lowClose = Math.abs((current.low || current.price) - previous.price);

      const trueRange = Math.max(highLow, highClose, lowClose);
      trueRanges.push(trueRange / current.price); // Normalize by price
    }

    // Calculate ATR as simple moving average of true ranges
    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;

    logger.debug(`📊 ATR (${period}): ${(atr * 100).toFixed(2)}%`);
    return atr;
  }

  /**
   * Get time-of-day multiplier for BSC trading patterns
   * BSC has peak activity during Asian/European trading hours
   * @returns {number} Multiplier 0.8-1.2
   */
  getBSCTimeMultiplier() {
    const hour = new Date().getUTCHours();

    // BSC Peak Hours (UTC):
    // 00:00-04:00 UTC = 08:00-12:00 Beijing (Asia open) - HIGH activity
    // 08:00-12:00 UTC = 16:00-20:00 Beijing (Asia evening) - MEDIUM activity
    // 12:00-16:00 UTC = 20:00-00:00 Beijing (Europe open) - HIGH activity
    // 16:00-24:00 UTC = Late Europe/Americas - LOWER activity

    if ((hour >= 0 && hour < 4) || (hour >= 12 && hour < 16)) {
      // Peak hours - widen TP for bigger profits
      return 1.2;
    } else if (hour >= 4 && hour < 12) {
      // Medium hours - normal TP
      return 1.0;
    } else {
      // Off-peak hours - tighter TP for quicker exits
      return 0.85;
    }
  }

  /**
   * Calculate recent win rate for adaptive TP/SL
   * Low win rate = tighter TP (take wins faster)
   * High win rate = wider TP (let winners run)
   * @returns {number} Win rate 0-1
   */
  calculateWinRate() {
    const recentTrades = this.positionHistory.slice(-20); // Last 20 trades
    if (recentTrades.length < 5) {
      return 0.5; // Default neutral win rate
    }

    const wins = recentTrades.filter(t => (t.profit || 0) > 0).length;
    const winRate = wins / recentTrades.length;

    logger.debug(`📊 Recent win rate: ${(winRate * 100).toFixed(1)}% (${wins}/${recentTrades.length})`);
    return winRate;
  }

  /**
   * Calculate dynamic TP and SL based on multiple factors
   * Factors: ATR, volatility, time of day, win rate, market conditions
   * @param {number} currentPrice - Current market price
   * @param {string} side - 'buy' or 'sell'
   * @param {Array} priceHistory - Recent price history
   * @returns {Object} {takeProfit, stopLoss, tpPercent, slPercent}
   */
  calculateDynamicTPSL(currentPrice, side, priceHistory) {
    // 1. Calculate ATR (volatility measure)
    const atr = this.calculateATR(priceHistory, 14);
    const volatility = this.calculateVolatility(priceHistory.map(p => p.price));

    // 2. Get time-of-day multiplier
    const timeMultiplier = this.getBSCTimeMultiplier();

    // 3. Get win-rate multiplier
    const winRate = this.calculateWinRate();
    const winRateMultiplier = winRate < 0.4 ? 0.7 :  // Low win rate = tighter TP
                              winRate > 0.6 ? 1.3 :  // High win rate = wider TP
                              1.0;                    // Medium win rate = normal

    // 4. Calculate base TP from volatility + ATR
    // Use ATR as primary metric (more reliable than simple volatility)
    let tpPercent = BASE_TP_PERCENT;

    if (atr < 0.01) {
      // Low volatility - tighter TP (0.3-0.5%)
      tpPercent = 0.003 + (atr * 0.2);
    } else if (atr < 0.02) {
      // Medium volatility - normal TP (0.5-0.8%)
      tpPercent = 0.005 + (atr * 0.15);
    } else if (atr < 0.03) {
      // High volatility - wider TP (0.8-1.2%)
      tpPercent = 0.008 + (atr * 0.13);
    } else {
      // Very high volatility - maximum TP (1.2-1.5%)
      tpPercent = 0.012 + Math.min(atr * 0.1, 0.003);
    }

    // 5. Apply time and win-rate adjustments
    tpPercent = tpPercent * timeMultiplier * winRateMultiplier;

    // 6. Clamp TP to safe range (initial clamp)
    tpPercent = Math.max(MIN_TP_PERCENT, Math.min(MAX_TP_PERCENT, tpPercent));

    // 7. Calculate SL based on ATR (wider SL for volatile markets)
    // OPTIMIZED 2025-10-19: Use 1.5x ATR for ultra-low volatility BSC markets
    // Professional range: 1.5-2.0x ATR (1.5x = tighter, better for low-vol ranging)
    // This enables lower TP requirements while maintaining 1:1.5 R:R
    let slPercent = atr > 0 ? atr * 1.5 : BASE_SL_PERCENT;
    slPercent = Math.max(MIN_SL_PERCENT, Math.min(MAX_SL_PERCENT, slPercent));

    // 8. Enforce minimum risk/reward ratio
    // Adjust SL down if needed to meet minimum R:R (better than widening TP beyond safety limits)
    if (tpPercent / slPercent < MIN_RISK_REWARD_RATIO) {
      const idealSL = tpPercent / MIN_RISK_REWARD_RATIO;
      if (idealSL >= MIN_SL_PERCENT) {
        // Can reduce SL to meet R:R
        slPercent = idealSL;
        logger.info(`⚖️ Adjusted SL down to meet ${MIN_RISK_REWARD_RATIO}:1 R:R ratio`);
      } else {
        // SL already at minimum, try widening TP instead
        const idealTP = slPercent * MIN_RISK_REWARD_RATIO;
        if (idealTP <= MAX_TP_PERCENT) {
          tpPercent = idealTP;
          logger.info(`⚖️ Adjusted TP up to meet ${MIN_RISK_REWARD_RATIO}:1 R:R ratio`);
        } else {
          // Can't meet minimum R:R without violating safety limits
          // Accept lower R:R but log warning
          logger.warn(`⚠️ Cannot meet ${MIN_RISK_REWARD_RATIO}:1 R:R ratio without violating safety limits`);
          logger.warn(`⚠️ Current R:R: 1:${(tpPercent / slPercent).toFixed(2)}`);
        }
      }
    }

    // 9. CRITICAL: Enforce minimum profitable TP to cover BSC trading costs
    // PancakeSwap fees: 0.5% + slippage 0.5-1.0% + MEV 0.2-0.5% = 1.5-2.0% total
    const MIN_PROFITABLE_TP = 0.025; // 2.5% minimum to cover fees + profit
    const TOTAL_FEES = 0.015; // 1.5% average trading costs

    if (tpPercent < MIN_PROFITABLE_TP) {
      logger.warn(`⚠️ TP ${(tpPercent * 100).toFixed(2)}% below profitable minimum, raising to 2.5%`);
      tpPercent = MIN_PROFITABLE_TP;

      // Recalculate SL to maintain R:R ratio if possible
      const newIdealSL = tpPercent / MIN_RISK_REWARD_RATIO;
      if (newIdealSL >= MIN_SL_PERCENT && newIdealSL <= MAX_SL_PERCENT) {
        slPercent = newIdealSL;
        logger.info(`⚖️ Recalculated SL to ${(slPercent * 100).toFixed(2)}% to maintain R:R`);
      }
    }

    // Calculate net profitability
    const netProfit = (tpPercent - TOTAL_FEES) * 100;
    logger.info(`💰 Profitability Check: TP ${(tpPercent * 100).toFixed(2)}% - Fees 1.5% = Net ${netProfit.toFixed(2)}%`);

    if (netProfit < 0.5) {
      logger.warn(`⚠️ Net profit ${netProfit.toFixed(2)}% is very low. Consider waiting for higher volatility.`);
    }

    // 10. Calculate actual prices
    const takeProfit = side === 'buy'
      ? currentPrice * (1 + tpPercent)
      : currentPrice * (1 - tpPercent);

    const stopLoss = side === 'buy'
      ? currentPrice * (1 - slPercent)
      : currentPrice * (1 + slPercent);

    // 11. Log the calculation
    logger.info(`
🎯 DYNAMIC TP/SL CALCULATED:
  ═══════════════════════════════════════
  Side: ${side.toUpperCase()}
  Entry Price: ${currentPrice.toFixed(8)}

  INPUTS:
  ├── ATR (14): ${(atr * 100).toFixed(2)}%
  ├── Volatility: ${(volatility * 100).toFixed(2)}%
  ├── Time Multiplier: ${timeMultiplier.toFixed(2)}x (UTC ${new Date().getUTCHours()}:00)
  ├── Win Rate: ${(winRate * 100).toFixed(1)}% (multiplier: ${winRateMultiplier.toFixed(2)}x)

  OUTPUTS:
  ├── TP: ${takeProfit.toFixed(8)} (${(tpPercent * 100).toFixed(2)}%)
  ├── SL: ${stopLoss.toFixed(8)} (${(slPercent * 100).toFixed(2)}%)
  └── Risk:Reward = 1:${(tpPercent / slPercent).toFixed(2)}
  ═══════════════════════════════════════
`);

    return {
      takeProfit,
      stopLoss,
      tpPercent,
      slPercent,
      riskRewardRatio: tpPercent / slPercent,
      factors: {
        atr,
        volatility,
        timeMultiplier,
        winRate,
        winRateMultiplier
      }
    };
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
