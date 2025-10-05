const { parentPort, workerData } = require('worker_threads');
const technicalIndicators = require('technicalindicators');

class TechnicalAnalysisWorker {
  constructor() {
    this.workerId = workerData.workerId;
    this.setupMessageHandler();
  }

  setupMessageHandler() {
    parentPort.on('message', async (task) => {
      try {
        const result = await this.processTask(task);
        parentPort.postMessage({
          taskId: task.taskId,
          workerId: this.workerId,
          result: result,
          success: true
        });
      } catch (error) {
        parentPort.postMessage({
          taskId: task.taskId,
          workerId: this.workerId,
          error: error.message,
          success: false
        });
      }
    });
  }

  async processTask(task) {
    const { data, indicators } = task;
    const result = {};

    try {
      // Prepare price data
      const prices = this.preparePriceData(data);
      
      if (prices.length < 2) {
        throw new Error('Insufficient price data');
      }

      // Calculate requested indicators in parallel
      const indicatorPromises = indicators.map(indicator => {
        switch (indicator.toLowerCase()) {
          case 'rsi':
            return this.calculateRSI(prices);
          case 'macd':
            return this.calculateMACD(prices);
          case 'bb':
          case 'bollinger':
            return this.calculateBollingerBands(prices);
          case 'ema':
            return this.calculateEMA(prices);
          case 'sma':
            return this.calculateSMA(prices);
          case 'stoch':
          case 'stochastic':
            return this.calculateStochastic(prices);
          case 'williams':
          case 'wr':
            return this.calculateWilliamsR(prices);
          case 'atr':
            return this.calculateATR(prices);
          case 'adx':
            return this.calculateADX(prices);
          case 'cci':
            return this.calculateCCI(prices);
          case 'roc':
            return this.calculateROC(prices);
          case 'mfi':
            return this.calculateMFI(prices);
          case 'obv':
            return this.calculateOBV(prices);
          case 'vwap':
            return this.calculateVWAP(prices);
          default:
            return Promise.resolve({ error: `Unknown indicator: ${indicator}` });
        }
      });

      const indicatorResults = await Promise.allSettled(indicatorPromises);
      
      // Process results
      indicators.forEach((indicator, index) => {
        const indicatorResult = indicatorResults[index];
        if (indicatorResult.status === 'fulfilled') {
          result[indicator.toLowerCase()] = indicatorResult.value;
        } else {
          result[indicator.toLowerCase()] = { 
            error: indicatorResult.reason.message || 'Calculation failed' 
          };
        }
      });

      // Add metadata
      result.metadata = {
        dataPoints: prices.length,
        timeRange: {
          start: prices[0]?.timestamp || 0,
          end: prices[prices.length - 1]?.timestamp || 0
        },
        processedAt: Date.now(),
        workerId: this.workerId
      };

      return result;

    } catch (error) {
      throw new Error(`Technical analysis error: ${error.message}`);
    }
  }

  // Prepare price data for indicators
  preparePriceData(data) {
    if (Array.isArray(data)) {
      return data.map(item => ({
        timestamp: item.timestamp || item.time || Date.now(),
        open: parseFloat(item.open || item.price || 0),
        high: parseFloat(item.high || item.price || 0),
        low: parseFloat(item.low || item.price || 0),
        close: parseFloat(item.close || item.price || 0),
        volume: parseFloat(item.volume || 0)
      }));
    }
    
    // If data is just prices array
    return data.map((price, index) => ({
      timestamp: Date.now() - (data.length - index) * 60000, // 1 minute intervals
      open: parseFloat(price),
      high: parseFloat(price),
      low: parseFloat(price),
      close: parseFloat(price),
      volume: 0
    }));
  }

  // Calculate RSI
  async calculateRSI(prices) {
    try {
      const values = prices.map(p => p.close);
      const rsi = technicalIndicators.RSI.calculate({
        values: values,
        period: 14
      });
      
      const current = rsi[rsi.length - 1];
      const previous = rsi[rsi.length - 2];
      
      return {
        current: current || 0,
        previous: previous || 0,
        values: rsi,
        signal: this.getRSISignal(current),
        period: 14
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate MACD
  async calculateMACD(prices) {
    try {
      const values = prices.map(p => p.close);
      const macd = technicalIndicators.MACD.calculate({
        values: values,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
      });
      
      const current = macd[macd.length - 1];
      const previous = macd[macd.length - 2];
      
      return {
        current: current || { MACD: 0, signal: 0, histogram: 0 },
        previous: previous || { MACD: 0, signal: 0, histogram: 0 },
        values: macd,
        signal: this.getMACDSignal(current, previous),
        periods: { fast: 12, slow: 26, signal: 9 }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate Bollinger Bands
  async calculateBollingerBands(prices) {
    try {
      const values = prices.map(p => p.close);
      const bb = technicalIndicators.BollingerBands.calculate({
        values: values,
        period: 20,
        stdDev: 2
      });
      
      const current = bb[bb.length - 1];
      const previous = bb[bb.length - 2];
      
      return {
        current: current || { upper: 0, middle: 0, lower: 0 },
        previous: previous || { upper: 0, middle: 0, lower: 0 },
        values: bb,
        signal: this.getBBSignal(current, values[values.length - 1]),
        period: 20,
        stdDev: 2
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate EMA
  async calculateEMA(prices) {
    try {
      const values = prices.map(p => p.close);
      const ema12 = technicalIndicators.EMA.calculate({ values: values, period: 12 });
      const ema26 = technicalIndicators.EMA.calculate({ values: values, period: 26 });
      
      return {
        ema12: {
          current: ema12[ema12.length - 1] || 0,
          values: ema12
        },
        ema26: {
          current: ema26[ema26.length - 1] || 0,
          values: ema26
        },
        signal: this.getEMASignal(ema12[ema12.length - 1], ema26[ema26.length - 1])
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate SMA
  async calculateSMA(prices) {
    try {
      const values = prices.map(p => p.close);
      const sma20 = technicalIndicators.SMA.calculate({ values: values, period: 20 });
      const sma50 = technicalIndicators.SMA.calculate({ values: values, period: 50 });
      
      return {
        sma20: {
          current: sma20[sma20.length - 1] || 0,
          values: sma20
        },
        sma50: {
          current: sma50[sma50.length - 1] || 0,
          values: sma50
        },
        signal: this.getSMASignal(sma20[sma20.length - 1], sma50[sma50.length - 1])
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate Stochastic
  async calculateStochastic(prices) {
    try {
      const stoch = technicalIndicators.Stochastic.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        period: 14
      });
      
      const current = stoch[stoch.length - 1];
      
      return {
        current: current || { k: 0, d: 0 },
        values: stoch,
        signal: this.getStochasticSignal(current),
        period: 14
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate Williams %R
  async calculateWilliamsR(prices) {
    try {
      const williams = technicalIndicators.WilliamsR.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        period: 14
      });
      
      const current = williams[williams.length - 1];
      
      return {
        current: current || 0,
        values: williams,
        signal: this.getWilliamsSignal(current),
        period: 14
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate ATR
  async calculateATR(prices) {
    try {
      const atr = technicalIndicators.ATR.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        period: 14
      });
      
      const current = atr[atr.length - 1];
      
      return {
        current: current || 0,
        values: atr,
        period: 14
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate ADX
  async calculateADX(prices) {
    try {
      const adx = technicalIndicators.ADX.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        period: 14
      });
      
      const current = adx[adx.length - 1];
      
      return {
        current: current || 0,
        values: adx,
        signal: this.getADXSignal(current),
        period: 14
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate CCI
  async calculateCCI(prices) {
    try {
      const cci = technicalIndicators.CCI.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        period: 20
      });
      
      const current = cci[cci.length - 1];
      
      return {
        current: current || 0,
        values: cci,
        signal: this.getCCISignal(current),
        period: 20
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate ROC
  async calculateROC(prices) {
    try {
      const values = prices.map(p => p.close);
      const roc = technicalIndicators.ROC.calculate({
        values: values,
        period: 10
      });
      
      const current = roc[roc.length - 1];
      
      return {
        current: current || 0,
        values: roc,
        signal: this.getROCSignal(current),
        period: 10
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate MFI
  async calculateMFI(prices) {
    try {
      const mfi = technicalIndicators.MFI.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        volume: prices.map(p => p.volume),
        period: 14
      });
      
      const current = mfi[mfi.length - 1];
      
      return {
        current: current || 0,
        values: mfi,
        signal: this.getMFISignal(current),
        period: 14
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate OBV
  async calculateOBV(prices) {
    try {
      const obv = technicalIndicators.OBV.calculate({
        close: prices.map(p => p.close),
        volume: prices.map(p => p.volume)
      });
      
      const current = obv[obv.length - 1];
      const previous = obv[obv.length - 2];
      
      return {
        current: current || 0,
        previous: previous || 0,
        values: obv,
        signal: this.getOBVSignal(current, previous)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Calculate VWAP
  async calculateVWAP(prices) {
    try {
      const vwap = technicalIndicators.VWAP.calculate({
        high: prices.map(p => p.high),
        low: prices.map(p => p.low),
        close: prices.map(p => p.close),
        volume: prices.map(p => p.volume)
      });
      
      const current = vwap[vwap.length - 1];
      
      return {
        current: current || 0,
        values: vwap
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Signal interpretation methods
  getRSISignal(rsi) {
    if (rsi > 70) return 'overbought';
    if (rsi < 30) return 'oversold';
    return 'neutral';
  }

  getMACDSignal(current, previous) {
    if (!current || !previous) return 'neutral';
    
    if (current.histogram > 0 && previous.histogram <= 0) return 'bullish';
    if (current.histogram < 0 && previous.histogram >= 0) return 'bearish';
    return 'neutral';
  }

  getBBSignal(current, price) {
    if (!current || !price) return 'neutral';
    
    if (price > current.upper) return 'overbought';
    if (price < current.lower) return 'oversold';
    return 'neutral';
  }

  getEMASignal(ema12, ema26) {
    if (ema12 > ema26) return 'bullish';
    if (ema12 < ema26) return 'bearish';
    return 'neutral';
  }

  getSMASignal(sma20, sma50) {
    if (sma20 > sma50) return 'bullish';
    if (sma20 < sma50) return 'bearish';
    return 'neutral';
  }

  getStochasticSignal(current) {
    if (!current) return 'neutral';
    
    if (current.k > 80 && current.d > 80) return 'overbought';
    if (current.k < 20 && current.d < 20) return 'oversold';
    return 'neutral';
  }

  getWilliamsSignal(williams) {
    if (williams > -20) return 'overbought';
    if (williams < -80) return 'oversold';
    return 'neutral';
  }

  getADXSignal(adx) {
    if (adx > 25) return 'strong_trend';
    if (adx < 20) return 'weak_trend';
    return 'neutral';
  }

  getCCISignal(cci) {
    if (cci > 100) return 'overbought';
    if (cci < -100) return 'oversold';
    return 'neutral';
  }

  getROCSignal(roc) {
    if (roc > 0) return 'bullish';
    if (roc < 0) return 'bearish';
    return 'neutral';
  }

  getMFISignal(mfi) {
    if (mfi > 80) return 'overbought';
    if (mfi < 20) return 'oversold';
    return 'neutral';
  }

  getOBVSignal(current, previous) {
    if (current > previous) return 'bullish';
    if (current < previous) return 'bearish';
    return 'neutral';
  }
}

// Initialize worker
new TechnicalAnalysisWorker();

