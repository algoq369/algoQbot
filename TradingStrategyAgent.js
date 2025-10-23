// TradingStrategyAgent.js - Core trading strategy implementation
// This file contains the main trading logic including VWAP and Ichimoku strategies

const BaseAgent = require('./agents/BaseAgent');
const { Trade, StrategyPerformance, GridState } = require('./database/models');
const logger = require('./logger');

class TradingStrategyAgent extends BaseAgent {
  constructor(pancakeSwap, priceHistoryManager, config = {}) {
    super(
      'TradingStrategyAgent',
      'Advanced trading strategy agent with ML-enhanced decision making'
    );

    this.pancakeSwap = pancakeSwap;
    this.priceHistoryManager = priceHistoryManager;
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

    // Configuration parameters
    this.config = {
      rangeMin: config.rangeMin || 0.02,
      rangeMax: config.rangeMax || 0.06,
      trendThreshold: config.trendThreshold || 0.01,
      boundsThreshold: config.boundsThreshold || 0.15,
      minProfit: config.minProfit || 0.50,
      cooldownMs: config.cooldownMs || 3600000,
      lowConfidenceSize: config.lowConfidenceSize || 0.05,
      highConfidenceSize: config.highConfidenceSize || 0.10,
      confidenceThreshold: config.confidenceThreshold || 0.70,
      maxPositionPct: config.maxPositionPct || 0.30,
      minBalance: config.minBalance || 5,
      priceStalenessMs: config.priceStalenessMs || 60000,
      minPriceHistory: config.minPriceHistory || 200,
      gridLevels: config.gridLevels || 10,
      gridMinTradeInterval: config.gridMinTradeInterval || 300000,
    };

    this.lastTradeTime = 0;
    this.MIN_TIME_BETWEEN_TRADES = this.config.cooldownMs;
  }

  async enhanceMarketDataWithVolume(marketData) {
    try {
      const priceVolumeHistory = this.priceHistoryManager.getPriceVolumeHistory();
      const isValidVolume = this.priceHistoryManager.validateVolumeData();

      if (!isValidVolume) {
        logger.warn('⚠️ Volume data validation failed, using fallback');
      }

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
      return {
        ...marketData,
        priceHistory: marketData.priceHistory || [],
        volumeHistory: [],
        latestVolume: 0,
        hasVolumeData: false
      };
    }
  }

  _calculatePositionSizeByConfidence(action, confidence, usdtBalance, bnbBalance, currentPrice) {
    if (action === 'hold' || action === 'rebalance') return 0;

    const positionPct = confidence >= this.config.confidenceThreshold
      ? this.config.highConfidenceSize
      : this.config.lowConfidenceSize;

    logger.debug(`Position sizing: ${(positionPct * 100).toFixed(0)}% (confidence: ${(confidence * 100).toFixed(0)}%)`);

    if (action === 'buy') {
      const positionSizeUSD = usdtBalance * positionPct;
      logger.debug(`Buy position: $${positionSizeUSD.toFixed(2)} (${(positionPct * 100).toFixed(0)}% of $${usdtBalance.toFixed(2)})`);
      return positionSizeUSD;
    } else if (action === 'sell') {
      const bnbValueUSD = bnbBalance * currentPrice;
      const positionSizeUSD = bnbValueUSD * positionPct;
      logger.debug(`Sell position: $${positionSizeUSD.toFixed(2)} (${(positionPct * 100).toFixed(0)}% of $${bnbValueUSD.toFixed(2)})`);
      return positionSizeUSD;
    }

    return 0;
  }

  async makeTradingDecision(strategy, marketData, researchData) {
    try {
      logger.info(`🎯 Making trading decision using ${strategy} strategy...`);

      const analysis = this.marketContext || await this.analyzeMarket(marketData, researchData);

      if (!this.strategies[strategy]) {
        throw new Error(`Unknown strategy: ${strategy}`);
      }

      const enhancedMarketData = await this.enhanceMarketDataWithVolume(marketData);
      const decision = await this.strategies[strategy](analysis, enhancedMarketData, researchData);

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

  // VWAP Strategy Implementation
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
      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      const last20Periods = priceHistory.slice(-20);
      let totalVolume = 0;
      let totalVolumePrice = 0;

      last20Periods.forEach(point => {
        const volume = point.volume || 0;
        totalVolume += volume;
        totalVolumePrice += point.price * volume;
      });

      const vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : currentPrice;
      const priceDeviation = ((currentPrice - vwap) / vwap) * 100;

      const recent5Volumes = last20Periods.slice(-5).map(p => p.volume || 0);
      const previous5Volumes = last20Periods.slice(-10, -5).map(p => p.volume || 0);

      const recent5Avg = recent5Volumes.reduce((a, b) => a + b, 0) / 5;
      const previous5Avg = previous5Volumes.reduce((a, b) => a + b, 0) / 5;

      const volumeTrend = previous5Avg > 0 ? ((recent5Avg - previous5Avg) / previous5Avg) * 100 : 0;

      const bnbValueInUsdt = bnbBalance * currentPrice;

      // BUY: Price < VWAP by 0.5-2%, volume +20% above average, confidence 0.7-0.9
      if (priceDeviation < -0.5 && priceDeviation >= -2.0 && volumeTrend > 20) {
        const confidence = Math.min(0.9, 0.7 + Math.abs(priceDeviation) * 0.1);
        const positionSize = this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

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

      // SELL: Price > VWAP by 0.3-1.5%, volume above average, confidence 0.7-0.9
      else if (priceDeviation > 0.3 && priceDeviation <= 1.5 && volumeTrend > 0) {
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
          reasoning: `VWAP Hold: Price ${priceDeviation.toFixed(2)}% from VWAP (${vwap.toFixed(6)}), Volume trend ${volumeTrend.toFixed(1)}% (within ±0.3% or low volume)`,
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

  // Ichimoku Cloud Strategy Implementation
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
      let usdtBalance, bnbBalance;
      if (global.shadowMode && global.shadowMode.getVirtualBalances) {
        const virtualBalances = global.shadowMode.getVirtualBalances();
        usdtBalance = virtualBalances.usdt;
        bnbBalance = virtualBalances.bnb;
      } else {
        usdtBalance = await this.pancakeSwap.getUSDTBalance();
        bnbBalance = await this.pancakeSwap.getBNBBalance();
      }

      const ichimokuData = this._calculateIchimokuIndicators(priceHistory);
      const signal = this._analyzeIchimokuSignals(currentPrice, ichimokuData, priceHistory);

      const bnbValueInUsdt = bnbBalance * currentPrice;

      // BUY: Price > cloud, Tenkan > Kijun, green cloud, Chikou > past price, confidence 0.75-0.95
      if (signal.type === 'strong_bullish') {
        const confidence = Math.min(0.95, 0.75 + signal.strength * 0.2);
        const positionSize = this._calculatePositionSizeByConfidence('buy', confidence, usdtBalance, bnbBalance, currentPrice);

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

    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
    const priceAboveCloud = currentPrice > cloudTop;
    const priceBelowCloud = currentPrice < cloudBottom;
    const priceInCloud = currentPrice >= cloudBottom && currentPrice <= cloudTop;

    const tenkanAboveKijun = tenkanSen > kijunSen;
    const tenkanBelowKijun = tenkanSen < kijunSen;

    const pastPrice = priceHistory.length >= 26 ? priceHistory[priceHistory.length - 26].price : currentPrice;
    const chikouAbovePast = chikouSpan > pastPrice;

    let signalType = 'neutral';
    let strength = 0;
    let reasoning = '';

    if (priceAboveCloud && tenkanAboveKijun && cloudColor === 'green' && chikouAbovePast) {
      signalType = 'strong_bullish';
      strength = 0.8;
      reasoning = 'All bullish conditions met';
    } else if (priceBelowCloud && tenkanBelowKijun && cloudColor === 'red') {
      signalType = 'strong_bearish';
      strength = 0.8;
      reasoning = 'All bearish conditions met';
    } else {
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

  // Additional strategy methods would be here...
  // (ranging, momentum, mean_reversion, breakout, gridTrading strategies)
}

module.exports = TradingStrategyAgent;






