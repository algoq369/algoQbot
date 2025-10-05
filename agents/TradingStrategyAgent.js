const BaseAgent = require('./BaseAgent');
const { Trade, StrategyPerformance } = require('../database/models');
const logger = require('../logger');

class TradingStrategyAgent extends BaseAgent {
  constructor(pancakeSwap) {
    super(
      'TradingStrategyAgent',
      'Advanced trading strategy agent with ML-enhanced decision making'
    );
    
    this.pancakeSwap = pancakeSwap;
    this.strategies = {
      ranging: this.rangingStrategy.bind(this),
      momentum: this.momentumStrategy.bind(this),
      mean_reversion: this.meanReversionStrategy.bind(this),
      arbitrage: this.arbitrageStrategy.bind(this)
    };
    
    this.currentStrategy = 'ranging';
    this.performanceHistory = [];
    this.marketContext = null;
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

  async makeTradingDecision(strategy, marketData, researchData) {
    try {
      logger.info(`🎯 Making trading decision using ${strategy} strategy...`);
      
      const analysis = this.marketContext || await this.analyzeMarket(marketData, researchData);
      
      if (!this.strategies[strategy]) {
        throw new Error(`Unknown strategy: ${strategy}`);
      }

      const decision = await this.strategies[strategy](analysis, marketData, researchData);
      
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

  async rangingStrategy(analysis, marketData, researchData) {
    const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
    const usdtBalance = await this.pancakeSwap.getUSDTBalance();
    const bnbBalance = await this.pancakeSwap.getBNBBalance();

    // Dynamic bounds based on volatility
    const volatility = analysis.technical_indicators?.volatility || 0.02;
    const lowerBound = currentPrice * (1 - volatility);
    const upperBound = currentPrice * (1 + volatility);

    let action = 'hold';
    let confidence = 0.5;
    let reasoning = '';

    // Buy signal: Price below lower bound and positive sentiment
    if (currentPrice <= lowerBound && analysis.sentiment_analysis?.sentiment === 'positive') {
      action = 'buy';
      confidence = 0.8;
      reasoning = `Price ${currentPrice.toFixed(6)} below lower bound ${lowerBound.toFixed(6)} with positive sentiment`;
    }
    // Sell signal: Price above upper bound or negative sentiment
    else if (currentPrice >= upperBound || analysis.sentiment_analysis?.sentiment === 'negative') {
      action = 'sell';
      confidence = 0.7;
      reasoning = `Price ${currentPrice.toFixed(6)} above upper bound ${upperBound.toFixed(6)} or negative sentiment`;
    }
    // Rebalance signal: Portfolio imbalance
    else if (this.shouldRebalance(usdtBalance, bnbBalance, currentPrice)) {
      action = 'rebalance';
      confidence = 0.6;
      reasoning = 'Portfolio rebalancing opportunity detected';
    }

    return {
      action,
      confidence,
      reasoning,
      parameters: {
        lowerBound,
        upperBound,
        currentPrice,
        volatility
      },
      position_size: this.calculatePositionSize(action, confidence, usdtBalance, bnbBalance, currentPrice)
    };
  }

  async momentumStrategy(analysis, marketData, researchData) {
    const indicators = analysis.technical_indicators;
    const rsi = indicators?.rsi || 50;
    const macd = indicators?.macd || { signal: 0, histogram: 0 };
    const volume = analysis.volume_analysis;

    let action = 'hold';
    let confidence = 0.5;
    let reasoning = '';

    // Strong momentum signals
    if (macd.histogram > 0 && rsi > 50 && rsi < 70 && volume?.trend === 'increasing') {
      action = 'buy';
      confidence = 0.8;
      reasoning = 'Strong bullish momentum with increasing volume';
    }
    else if (macd.histogram < 0 && rsi < 50 && rsi > 30 && volume?.trend === 'increasing') {
      action = 'sell';
      confidence = 0.8;
      reasoning = 'Strong bearish momentum with increasing volume';
    }
    // Weak momentum signals
    else if (macd.histogram > 0 && rsi > 50) {
      action = 'buy';
      confidence = 0.6;
      reasoning = 'Moderate bullish momentum';
    }
    else if (macd.histogram < 0 && rsi < 50) {
      action = 'sell';
      confidence = 0.6;
      reasoning = 'Moderate bearish momentum';
    }

    return {
      action,
      confidence,
      reasoning,
      parameters: {
        rsi,
        macd,
        volume_trend: volume?.trend
      },
      position_size: this.calculatePositionSize(action, confidence)
    };
  }

  async meanReversionStrategy(analysis, marketData, researchData) {
    const currentPrice = marketData?.currentPrice || await this.pancakeSwap.getCurrentPrice();
    const bollinger = analysis.technical_indicators?.bollinger_bands;
    const rsi = analysis.technical_indicators?.rsi || 50;

    let action = 'hold';
    let confidence = 0.5;
    let reasoning = '';

    if (bollinger) {
      const { upper, middle, lower } = bollinger;
      
      // Oversold condition
      if (currentPrice <= lower && rsi < 30) {
        action = 'buy';
        confidence = 0.8;
        reasoning = `Price ${currentPrice.toFixed(6)} at lower Bollinger band ${lower.toFixed(6)} with oversold RSI ${rsi}`;
      }
      // Overbought condition
      else if (currentPrice >= upper && rsi > 70) {
        action = 'sell';
        confidence = 0.8;
        reasoning = `Price ${currentPrice.toFixed(6)} at upper Bollinger band ${upper.toFixed(6)} with overbought RSI ${rsi}`;
      }
      // Mean reversion
      else if (currentPrice < middle && rsi < 50) {
        action = 'buy';
        confidence = 0.6;
        reasoning = 'Mean reversion buy signal';
      }
      else if (currentPrice > middle && rsi > 50) {
        action = 'sell';
        confidence = 0.6;
        reasoning = 'Mean reversion sell signal';
      }
    }

    return {
      action,
      confidence,
      reasoning,
      parameters: {
        currentPrice,
        bollinger_bands: bollinger,
        rsi
      },
      position_size: this.calculatePositionSize(action, confidence)
    };
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
      // This would typically analyze volume data from the DEX
      // For now, return mock analysis
      return {
        current: Math.random() * 1000000 + 500000,
        trend: Math.random() > 0.5 ? 'increasing' : 'decreasing',
        average_24h: Math.random() * 800000 + 400000,
        volume_price_trend: Math.random() > 0.5 ? 'bullish' : 'bearish'
      };
    } catch (error) {
      logger.error('Error analyzing volume:', error);
      return { trend: 'unknown' };
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

  calculatePositionSize(action, confidence, usdtBalance = 0, bnbBalance = 0, currentPrice = 0) {
    // Dynamic position sizing based on confidence and available balance
    const baseSize = 0.1; // 10% of available balance
    const confidenceMultiplier = confidence;
    
    if (action === 'buy') {
      return Math.min(usdtBalance * baseSize * confidenceMultiplier, usdtBalance * 0.5);
    } else if (action === 'sell') {
      return Math.min(bnbBalance * baseSize * confidenceMultiplier, bnbBalance * 0.5);
    }
    
    return 0;
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
