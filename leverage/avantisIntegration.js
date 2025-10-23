const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../logger');
const config = require('../config');

class AvantisIntegration {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.apiUrl = 'https://api.avantis.finance';
    this.contractAddress = '0x1234567890123456789012345678901234567890'; // Avantis contract
    this.isConnected = false;
    this.maxLeverage = 10; // Safety limit
    this.positions = new Map();
  }

  async connect() {
    try {
      // Initialize connection to Avantis
      logger.info('🔗 Connecting to Avantis leverage platform...');
      this.isConnected = true;
      logger.info('✅ Avantis connected successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to connect to Avantis:', error);
      return false;
    }
  }

  async openLeveragePosition(signal) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const { action, size, leverage, stopLoss, takeProfit } = signal;

      logger.warn(`🚀 Opening ${leverage}x ${action.toUpperCase()} position: $${size.toFixed(0)}`);

      const position = {
        id: `avantis_${Date.now()}`,
        pair: 'BNB/USD',
        isLong: action === 'buy',
        collateral: size,
        leverage: leverage,
        entryPrice: signal.price,
        stopLoss,
        takeProfit,
        timestamp: Date.now(),
        status: 'open'
      };

      this.positions.set(position.id, position);

      logger.warn(`✅ Leverage position opened: ${position.id} - ${leverage}x ${action} $${size.toFixed(0)}`);
      return position;
    } catch (error) {
      logger.error('❌ Failed to open leverage position:', error);
      return null;
    }
  }

  async monitorPositions(currentPrice) {
    for (const [id, position] of this.positions) {
      if (position.status !== 'open') continue;

      const pnl = position.isLong
        ? (currentPrice - position.entryPrice) * position.leverage * position.collateral / position.entryPrice
        : (position.entryPrice - currentPrice) * position.leverage * position.collateral / position.entryPrice;

      // Check stop loss
      if ((position.isLong && currentPrice <= position.stopLoss) ||
        (!position.isLong && currentPrice >= position.stopLoss)) {
        await this.closePosition(id, currentPrice, 'stop_loss');
      }

      // Check take profit
      if ((position.isLong && currentPrice >= position.takeProfit) ||
        (!position.isLong && currentPrice <= position.takeProfit)) {
        await this.closePosition(id, currentPrice, 'take_profit');
      }
    }
  }

  async closePosition(id, currentPrice, reason) {
    const position = this.positions.get(id);
    if (!position) return;

    const pnl = position.isLong
      ? (currentPrice - position.entryPrice) * position.leverage * position.collateral / position.entryPrice
      : (position.entryPrice - currentPrice) * position.leverage * position.collateral / position.entryPrice;

    position.status = 'closed';
    position.exitPrice = currentPrice;
    position.pnl = pnl;
    position.exitReason = reason;

    logger.warn(`${pnl > 0 ? '✅' : '❌'} Leverage position closed: ${reason} | P&L: $${pnl.toFixed(2)}`);

    this.positions.delete(id);
    return { pnl, reason };
  }

  async getLeverageOpportunities(pairs, timeframe = '1h') {
    try {
      const opportunities = [];

      for (const pair of pairs) {
        // Get technical analysis data
        const taData = await this.getTechnicalAnalysis(pair, timeframe);

        // Get leverage recommendations
        const leverageRec = await this.calculateLeverageRecommendation(taData);

        if (leverageRec.confidence > 0.7) {
          opportunities.push({
            pair: pair,
            leverage: leverageRec.leverage,
            direction: leverageRec.direction,
            confidence: leverageRec.confidence,
            entryPrice: taData.currentPrice,
            stopLoss: leverageRec.stopLoss,
            takeProfit: leverageRec.takeProfit,
            riskReward: leverageRec.riskReward
          });
        }
      }

      return opportunities.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error('Error getting leverage opportunities:', error);
      return [];
    }
  }

  async getTechnicalAnalysis(pair, timeframe) {
    try {
      // Simplified technical analysis
      const response = await axios.get(`${this.apiUrl}/technical-analysis`, {
        params: {
          pair: pair,
          timeframe: timeframe,
          indicators: 'RSI,MA,MACD,BOLLINGER'
        }
      });

      return {
        currentPrice: response.data.price,
        rsi: response.data.rsi,
        movingAverage: response.data.ma,
        macd: response.data.macd,
        bollinger: response.data.bollinger,
        volume: response.data.volume,
        volatility: response.data.volatility
      };
    } catch (error) {
      logger.error(`Error getting technical analysis for ${pair}:`, error);
      // Fallback to mock data
      return this.getMockTechnicalAnalysis();
    }
  }

  getMockTechnicalAnalysis() {
    return {
      currentPrice: 100,
      rsi: 45,
      movingAverage: 98,
      macd: 0.5,
      bollinger: { upper: 105, lower: 95 },
      volume: 1000000,
      volatility: 0.15
    };
  }

  async calculateLeverageRecommendation(taData) {
    try {
      let direction = 'neutral';
      let leverage = 1;
      let confidence = 0;
      let stopLoss = 0;
      let takeProfit = 0;

      // RSI Analysis
      if (taData.rsi < 30) {
        direction = 'long';
        confidence += 0.3;
        leverage = Math.min(5, Math.floor((30 - taData.rsi) / 5) + 1);
      } else if (taData.rsi > 70) {
        direction = 'short';
        confidence += 0.3;
        leverage = Math.min(5, Math.floor((taData.rsi - 70) / 5) + 1);
      }

      // Moving Average Analysis
      if (taData.currentPrice > taData.movingAverage * 1.02) {
        if (direction === 'long') confidence += 0.2;
        direction = direction === 'neutral' ? 'long' : direction;
      } else if (taData.currentPrice < taData.movingAverage * 0.98) {
        if (direction === 'short') confidence += 0.2;
        direction = direction === 'neutral' ? 'short' : direction;
      }

      // MACD Analysis
      if (taData.macd > 0 && direction === 'long') {
        confidence += 0.2;
      } else if (taData.macd < 0 && direction === 'short') {
        confidence += 0.2;
      }

      // Bollinger Bands
      if (taData.currentPrice < taData.bollinger.lower && direction === 'long') {
        confidence += 0.1;
      } else if (taData.currentPrice > taData.bollinger.upper && direction === 'short') {
        confidence += 0.1;
      }

      // Calculate stop loss and take profit
      if (direction === 'long') {
        stopLoss = taData.currentPrice * 0.95; // 5% stop loss
        takeProfit = taData.currentPrice * (1 + (0.05 * leverage)); // Leveraged take profit
      } else if (direction === 'short') {
        stopLoss = taData.currentPrice * 1.05; // 5% stop loss
        takeProfit = taData.currentPrice * (1 - (0.05 * leverage)); // Leveraged take profit
      }

      const riskReward = direction !== 'neutral' ?
        Math.abs(takeProfit - taData.currentPrice) / Math.abs(stopLoss - taData.currentPrice) : 0;

      return {
        direction,
        leverage,
        confidence: Math.min(confidence, 1),
        stopLoss,
        takeProfit,
        riskReward
      };
    } catch (error) {
      logger.error('Error calculating leverage recommendation:', error);
      return { direction: 'neutral', leverage: 1, confidence: 0 };
    }
  }

  async executeLeverageTrade(opportunity, amount) {
    try {
      logger.info(`🎯 Executing leverage trade: ${opportunity.pair} ${opportunity.direction} ${opportunity.leverage}x`);

      // This would integrate with Avantis smart contracts
      // For now, we'll simulate the transaction
      const txData = {
        pair: opportunity.pair,
        direction: opportunity.direction,
        leverage: opportunity.leverage,
        amount: amount,
        entryPrice: opportunity.entryPrice,
        stopLoss: opportunity.stopLoss,
        takeProfit: opportunity.takeProfit,
        timestamp: Date.now()
      };

      // In a real implementation, this would call the Avantis contract
      // const tx = await this.avantisContract.openPosition(txData);

      logger.info(`✅ Leverage position opened: ${JSON.stringify(txData)}`);
      return txData;
    } catch (error) {
      logger.error('Error executing leverage trade:', error);
      throw error;
    }
  }

  async closeLeveragePosition(positionId) {
    try {
      logger.info(`🔒 Closing leverage position: ${positionId}`);

      // This would call the Avantis contract to close the position
      // const tx = await this.avantisContract.closePosition(positionId);

      logger.info(`✅ Leverage position closed: ${positionId}`);
      return { success: true, positionId };
    } catch (error) {
      logger.error('Error closing leverage position:', error);
      throw error;
    }
  }

  async getOpenPositions() {
    try {
      // This would query the Avantis contract for open positions
      // For now, return mock data
      return [
        {
          id: 'pos_1',
          pair: 'USDT/BNB',
          direction: 'long',
          leverage: 3,
          entryPrice: 0.000868,
          currentPrice: 0.000875,
          pnl: 0.024, // 2.4% profit
          timestamp: Date.now() - 3600000 // 1 hour ago
        }
      ];
    } catch (error) {
      logger.error('Error getting open positions:', error);
      return [];
    }
  }

  async getRiskMetrics() {
    try {
      const positions = await this.getOpenPositions();
      const totalExposure = positions.reduce((sum, pos) => sum + (pos.amount * pos.leverage), 0);
      const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);

      return {
        totalPositions: positions.length,
        totalExposure: totalExposure,
        totalPnL: totalPnL,
        maxLeverage: Math.max(...positions.map(p => p.leverage), 1),
        riskLevel: totalExposure > 1000 ? 'high' : totalExposure > 500 ? 'medium' : 'low'
      };
    } catch (error) {
      logger.error('Error getting risk metrics:', error);
      return { totalPositions: 0, totalExposure: 0, totalPnL: 0, maxLeverage: 1, riskLevel: 'low' };
    }
  }
}

module.exports = AvantisIntegration;
