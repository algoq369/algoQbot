const BaseAgent = require('./BaseAgent');
const logger = require('../logger');
const { Alert } = require('../database/models');

class MarketMonitorAgent extends BaseAgent {
  constructor(priceHistoryManager) {
    super('MarketMonitorAgent', 'Market regime detection and strategy optimization');
    this.priceHistoryManager = priceHistoryManager;
    this.currentRegime = 'ranging';
    this.recommendedStrategies = ['ranging', 'mean_reversion'];
    this.lastRegimeChange = Date.now();
  }

  async detectMarketRegime() {
    try {
      const history = this.priceHistoryManager.getHistory();
      if (history.length < 100) {
        logger.debug('Insufficient price history for regime detection');
        return null;
      }

      const last100 = history.slice(-100).map(p => p.price);
      const volatility = this._calculateVolatility(last100);
      const trend = (last100[last100.length - 1] - last100[0]) / last100[0];
      const momentum = this._calculateMomentum(last100);

      let regime, strategies, confidence;

      // Regime detection logic
      if (Math.abs(trend) > 0.03 && volatility > 0.02 && momentum > 0.5) {
        regime = 'trending';
        strategies = ['momentum', 'breakout'];
        confidence = 0.85;
      } else if (volatility > 0.03) {
        regime = 'volatile';
        strategies = ['gridTrading', 'mean_reversion'];
        confidence = 0.80;
      } else if (Math.abs(trend) < 0.01 && volatility < 0.02) {
        regime = 'ranging';
        strategies = ['ranging', 'mean_reversion'];
        confidence = 0.75;
      } else {
        regime = 'mixed';
        strategies = ['mean_reversion', 'momentum'];
        confidence = 0.70;
      }

      // Log regime change
      if (regime !== this.currentRegime) {
        const timeSinceChange = Date.now() - this.lastRegimeChange;
        logger.warn(`📊 REGIME CHANGE: ${this.currentRegime} → ${regime} (${(timeSinceChange / 1000 / 60).toFixed(1)}min)`);
        logger.warn(`📊 Recommended strategies: ${strategies.join(', ')}`);

        this.currentRegime = regime;
        this.recommendedStrategies = strategies;
        this.lastRegimeChange = Date.now();

        // Create alert for regime change
        try {
          await Alert.create({
            type: 'regime_change',
            severity: 'medium',
            title: `Market Regime: ${regime.toUpperCase()}`,
            message: `Strategies: ${strategies.join(', ')} | Volatility: ${(volatility * 100).toFixed(1)}% | Trend: ${(trend * 100).toFixed(1)}%`,
            triggered_by: 'MarketMonitorAgent'
          });
        } catch (error) {
          logger.error('Failed to create regime change alert:', error);
        }
      }

      return {
        regime,
        strategies,
        volatility,
        trend,
        momentum,
        confidence,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error in market regime detection:', error);
      return null;
    }
  }

  _calculateVolatility(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const variance = returns.reduce((sum, r) => sum + r ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  _calculateMomentum(prices) {
    const shortTerm = prices.slice(-10);
    const longTerm = prices.slice(-30, -10);

    const shortAvg = shortTerm.reduce((sum, p) => sum + p, 0) / shortTerm.length;
    const longAvg = longTerm.reduce((sum, p) => sum + p, 0) / longTerm.length;

    return (shortAvg - longAvg) / longAvg;
  }

  getCurrentRegime() {
    return {
      regime: this.currentRegime,
      strategies: this.recommendedStrategies,
      lastChange: this.lastRegimeChange
    };
  }

  async analyzeMarketConditions() {
    const regime = await this.detectMarketRegime();
    if (!regime) return null;

    const conditions = {
      ...regime,
      recommendations: {
        positionSize: this._getPositionSizeRecommendation(regime.volatility),
        cooldown: this._getCooldownRecommendation(regime.regime),
        riskLevel: this._getRiskLevel(regime.volatility, regime.trend)
      }
    };

    logger.info(`📊 Market Analysis: ${regime.regime} | Vol: ${(regime.volatility * 100).toFixed(1)}% | Trend: ${(regime.trend * 100).toFixed(1)}%`);

    return conditions;
  }

  _getPositionSizeRecommendation(volatility) {
    if (volatility > 0.04) return 'reduce'; // High volatility - reduce position sizes
    if (volatility < 0.015) return 'increase'; // Low volatility - can increase sizes
    return 'normal';
  }

  _getCooldownRecommendation(regime) {
    switch (regime) {
      case 'trending': return 'short'; // 1-2 minutes
      case 'volatile': return 'long'; // 5-10 minutes
      case 'ranging': return 'medium'; // 3-5 minutes
      default: return 'medium';
    }
  }

  _getRiskLevel(volatility, trend) {
    if (volatility > 0.05 || Math.abs(trend) > 0.05) return 'high';
    if (volatility > 0.03 || Math.abs(trend) > 0.03) return 'medium';
    return 'low';
  }
}

module.exports = MarketMonitorAgent;






