const { SMA, EMA, RSI, MACD, BollingerBands, Stochastic } = require('technicalindicators');
const logger = require('../logger');

class TechnicalAnalysis {
  constructor() {
    this.indicators = {};
    this.timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  }

  async analyzePair(priceHistory, pair) {
    try {
      const prices = priceHistory.map(p => p.price);
      const volumes = priceHistory.map(p => p.volume || 1000000); // Default volume if not available
      
      const analysis = {
        pair: pair,
        timestamp: Date.now(),
        timeframe: '1h',
        signals: {},
        indicators: {},
        recommendations: []
      };

      // Calculate technical indicators
      analysis.indicators = this.calculateIndicators(prices, volumes);
      
      // Generate trading signals
      analysis.signals = this.generateSignals(analysis.indicators, prices);
      
      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis.signals, analysis.indicators);
      
      return analysis;
    } catch (error) {
      logger.error(`Error analyzing ${pair}:`, error);
      return null;
    }
  }

  calculateIndicators(prices, volumes) {
    const indicators = {};
    
    try {
      // Simple Moving Averages
      indicators.sma20 = SMA.calculate({ period: 20, values: prices });
      indicators.sma50 = SMA.calculate({ period: 50, values: prices });
      indicators.sma200 = SMA.calculate({ period: 200, values: prices });
      
      // Exponential Moving Averages
      indicators.ema12 = EMA.calculate({ period: 12, values: prices });
      indicators.ema26 = EMA.calculate({ period: 26, values: prices });
      
      // RSI (Relative Strength Index)
      indicators.rsi = RSI.calculate({ period: 14, values: prices });
      
      // MACD (Moving Average Convergence Divergence)
      indicators.macd = MACD.calculate({
        values: prices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
      });
      
      // Bollinger Bands
      indicators.bollinger = BollingerBands.calculate({
        period: 20,
        values: prices,
        stdDev: 2
      });
      
      // Stochastic Oscillator
      indicators.stochastic = Stochastic.calculate({
        high: prices.map(p => p * 1.01), // Mock high prices
        low: prices.map(p => p * 0.99),  // Mock low prices
        close: prices,
        period: 14,
        signalPeriod: 3
      });
      
      // Volume indicators
      indicators.volumeSMA = SMA.calculate({ period: 20, values: volumes });
      
      return indicators;
    } catch (error) {
      logger.error('Error calculating indicators:', error);
      return {};
    }
  }

  generateSignals(indicators, prices) {
    const signals = {
      trend: 'neutral',
      momentum: 'neutral',
      volatility: 'medium',
      volume: 'normal',
      strength: 0
    };

    try {
      const currentPrice = prices[prices.length - 1];
      const lastIndex = prices.length - 1;
      
      // Trend Analysis
      if (indicators.sma20 && indicators.sma20.length > 0) {
        const sma20 = indicators.sma20[indicators.sma20.length - 1];
        const sma50 = indicators.sma50 ? indicators.sma50[indicators.sma50.length - 1] : sma20;
        
        if (currentPrice > sma20 && sma20 > sma50) {
          signals.trend = 'bullish';
          signals.strength += 0.3;
        } else if (currentPrice < sma20 && sma20 < sma50) {
          signals.trend = 'bearish';
          signals.strength += 0.3;
        }
      }
      
      // Momentum Analysis (RSI)
      if (indicators.rsi && indicators.rsi.length > 0) {
        const rsi = indicators.rsi[indicators.rsi.length - 1];
        if (rsi > 70) {
          signals.momentum = 'overbought';
          signals.strength -= 0.2;
        } else if (rsi < 30) {
          signals.momentum = 'oversold';
          signals.strength += 0.2;
        } else if (rsi > 50) {
          signals.momentum = 'bullish';
          signals.strength += 0.1;
        } else {
          signals.momentum = 'bearish';
          signals.strength -= 0.1;
        }
      }
      
      // MACD Analysis
      if (indicators.macd && indicators.macd.length > 0) {
        const macd = indicators.macd[indicators.macd.length - 1];
        if (macd.MACD > macd.signal && macd.histogram > 0) {
          signals.strength += 0.2;
        } else if (macd.MACD < macd.signal && macd.histogram < 0) {
          signals.strength -= 0.2;
        }
      }
      
      // Volatility Analysis (Bollinger Bands)
      if (indicators.bollinger && indicators.bollinger.length > 0) {
        const bb = indicators.bollinger[indicators.bollinger.length - 1];
        const bandWidth = (bb.upper - bb.lower) / bb.middle;
        
        if (bandWidth > 0.1) {
          signals.volatility = 'high';
        } else if (bandWidth < 0.05) {
          signals.volatility = 'low';
        }
        
        // Bollinger Band position
        if (currentPrice > bb.upper) {
          signals.strength -= 0.1; // Overbought
        } else if (currentPrice < bb.lower) {
          signals.strength += 0.1; // Oversold
        }
      }
      
      // Volume Analysis
      if (indicators.volumeSMA && indicators.volumeSMA.length > 0) {
        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = indicators.volumeSMA[indicators.volumeSMA.length - 1];
        
        if (currentVolume > avgVolume * 1.5) {
          signals.volume = 'high';
          signals.strength += 0.1;
        } else if (currentVolume < avgVolume * 0.5) {
          signals.volume = 'low';
          signals.strength -= 0.1;
        }
      }
      
      signals.strength = Math.max(-1, Math.min(1, signals.strength));
      
    } catch (error) {
      logger.error('Error generating signals:', error);
    }
    
    return signals;
  }

  generateRecommendations(signals, indicators) {
    const recommendations = [];
    
    try {
      // Strong buy signal
      if (signals.strength > 0.6 && signals.trend === 'bullish' && signals.momentum !== 'overbought') {
        recommendations.push({
          action: 'strong_buy',
          confidence: signals.strength,
          reasoning: `Strong bullish trend with positive momentum. RSI: ${indicators.rsi ? indicators.rsi[indicators.rsi.length - 1]?.toFixed(2) : 'N/A'}`
        });
      }
      
      // Buy signal
      else if (signals.strength > 0.3 && (signals.trend === 'bullish' || signals.momentum === 'oversold')) {
        recommendations.push({
          action: 'buy',
          confidence: signals.strength,
          reasoning: `Bullish signals detected. Trend: ${signals.trend}, Momentum: ${signals.momentum}`
        });
      }
      
      // Strong sell signal
      else if (signals.strength < -0.6 && signals.trend === 'bearish' && signals.momentum !== 'oversold') {
        recommendations.push({
          action: 'strong_sell',
          confidence: Math.abs(signals.strength),
          reasoning: `Strong bearish trend with negative momentum. RSI: ${indicators.rsi ? indicators.rsi[indicators.rsi.length - 1]?.toFixed(2) : 'N/A'}`
        });
      }
      
      // Sell signal
      else if (signals.strength < -0.3 && (signals.trend === 'bearish' || signals.momentum === 'overbought')) {
        recommendations.push({
          action: 'sell',
          confidence: Math.abs(signals.strength),
          reasoning: `Bearish signals detected. Trend: ${signals.trend}, Momentum: ${signals.momentum}`
        });
      }
      
      // Hold signal
      else {
        recommendations.push({
          action: 'hold',
          confidence: 1 - Math.abs(signals.strength),
          reasoning: `Mixed signals or neutral market conditions. Volatility: ${signals.volatility}`
        });
      }
      
      // Leverage recommendations
      if (signals.volatility === 'high' && Math.abs(signals.strength) > 0.5) {
        recommendations.push({
          action: 'consider_leverage',
          confidence: Math.abs(signals.strength),
          reasoning: `High volatility with strong directional signal - consider leveraged trading`
        });
      }
      
    } catch (error) {
      logger.error('Error generating recommendations:', error);
    }
    
    return recommendations;
  }

  async getMultiTimeframeAnalysis(priceHistory, pair) {
    try {
      const timeframes = ['1h', '4h', '1d'];
      const analysis = {};
      
      for (const timeframe of timeframes) {
        // Simulate different timeframe data by sampling
        const sampleSize = timeframe === '1h' ? priceHistory.length : 
                          timeframe === '4h' ? Math.floor(priceHistory.length / 4) :
                          Math.floor(priceHistory.length / 24);
        
        const sampledData = priceHistory.slice(-sampleSize);
        analysis[timeframe] = await this.analyzePair(sampledData, pair);
      }
      
      return analysis;
    } catch (error) {
      logger.error('Error getting multi-timeframe analysis:', error);
      return {};
    }
  }

  calculateSupportResistance(prices) {
    try {
      const highs = [];
      const lows = [];
      
      // Simple pivot point calculation
      for (let i = 2; i < prices.length - 2; i++) {
        if (prices[i] > prices[i-1] && prices[i] > prices[i-2] && 
            prices[i] > prices[i+1] && prices[i] > prices[i+2]) {
          highs.push({ price: prices[i], index: i });
        }
        
        if (prices[i] < prices[i-1] && prices[i] < prices[i-2] && 
            prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
          lows.push({ price: prices[i], index: i });
        }
      }
      
      // Calculate support and resistance levels
      const resistance = highs.length > 0 ? Math.max(...highs.map(h => h.price)) : null;
      const support = lows.length > 0 ? Math.min(...lows.map(l => l.price)) : null;
      
      return { support, resistance, highs, lows };
    } catch (error) {
      logger.error('Error calculating support/resistance:', error);
      return { support: null, resistance: null, highs: [], lows: [] };
    }
  }
}

module.exports = TechnicalAnalysis;
