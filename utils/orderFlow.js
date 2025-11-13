const logger = require('../logger');

class ProductionOrderFlow {
  constructor(config = {}) {
    this.config = {
      maxHistory: config.maxHistory || 300,
      minSwapsForSignal: config.minSwapsForSignal || 10,
      confidenceThresholds: config.confidenceThresholds || {
        strongBuy: 0.15,
        moderateBuy: 0.05,
        moderateSell: -0.05,
        strongSell: -0.15
      },
      ...config
    };

    this.defaults = {
      delta: 0,
      deltaPercent: 0,
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0,
      confidence: 0.5,
      validSwaps: 0,
      timestamp: Date.now(),
      status: 'NO_DATA'
    };
  }

  calculateDelta(swapEvents) {
    const startTime = Date.now();

    try {
      if (!swapEvents || !Array.isArray(swapEvents)) {
        logger.warn('OrderFlow: Invalid swap events - not an array');
        return { ...this.defaults, status: 'INVALID_INPUT' };
      }

      if (swapEvents.length === 0) {
        logger.debug('OrderFlow: Empty swap events array');
        return { ...this.defaults, status: 'EMPTY_DATA' };
      }

      let buyVolume = 0;
      let sellVolume = 0;
      let validSwaps = 0;
      let malformedSwaps = 0;

      swapEvents.forEach((swap, index) => {
        try {
          const amount0Out = this.safeParseFloat(swap?.amount0Out);
          const amount0In = this.safeParseFloat(swap?.amount0In);

          if (!this.isValidSwap(amount0Out, amount0In)) {
            malformedSwaps++;
            return;
          }

          if (amount0Out > 0) {
            buyVolume += amount0Out;
            validSwaps++;
          }
          if (amount0In > 0) {
            sellVolume += amount0In;
            validSwaps++;
          }

        } catch (error) {
          malformedSwaps++;
          logger.debug(`OrderFlow: Error in swap ${index}:`, error.message);
        }
      });

      const dataQuality = this.assessDataQuality(validSwaps, swapEvents.length, malformedSwaps);

      if (dataQuality.status !== 'GOOD') {
        logger.warn(`OrderFlow: Poor data quality - ${dataQuality.reason}`);
        return {
          ...this.defaults,
          status: dataQuality.status,
          dataQuality
        };
      }

      const delta = buyVolume - sellVolume;
      const totalVolume = buyVolume + sellVolume;
      const deltaPercent = totalVolume > 0 ? delta / totalVolume : 0;

      const result = {
        delta,
        deltaPercent,
        buyVolume,
        sellVolume,
        totalVolume,
        validSwaps,
        malformedSwaps,
        dataQuality,
        processingTime: Date.now() - startTime,
        timestamp: Date.now(),
        status: 'SUCCESS'
      };

      logger.debug(`OrderFlow: Processed ${validSwaps} valid swaps, delta: ${(deltaPercent * 100).toFixed(2)}%`);

      return result;

    } catch (error) {
      logger.error('OrderFlow: Unexpected error in calculateDelta:', error);
      return {
        ...this.defaults,
        status: 'ERROR',
        error: error.message
      };
    }
  }

  safeParseFloat(value) {
    if (value === undefined || value === null) return 0;
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }

  isValidSwap(amount0Out, amount0In) {
    if (amount0Out > 0 && amount0In > 0) return false;
    if (amount0Out <= 0 && amount0In <= 0) return false;
    if (amount0Out > 1e12 || amount0In > 1e12) return false;
    return true;
  }

  assessDataQuality(validSwaps, totalSwaps, malformedSwaps) {
    const validRatio = validSwaps / totalSwaps;
    const malformedRatio = malformedSwaps / totalSwaps;

    if (validSwaps < this.config.minSwapsForSignal) {
      return {
        status: 'INSUFFICIENT_DATA',
        reason: `Only ${validSwaps} valid swaps (min: ${this.config.minSwapsForSignal})`
      };
    }

    if (malformedRatio > 0.5) {
      return {
        status: 'POOR_QUALITY',
        reason: `High malformed swaps: ${malformedRatio.toFixed(2)}`
      };
    }

    if (validRatio < 0.3) {
      return {
        status: 'LOW_QUALITY',
        reason: `Low valid ratio: ${validRatio.toFixed(2)}`
      };
    }

    return {
      status: 'GOOD',
      reason: `Good data: ${validSwaps}/${totalSwaps} valid swaps`
    };
  }

  getConfidence(deltaPercent, dataStatus = 'SUCCESS') {
    if (dataStatus !== 'SUCCESS') {
      return {
        confidence: 0.5,
        reasoning: `Low confidence due to data issue: ${dataStatus}`,
        status: 'DEGRADED'
      };
    }

    if (!isFinite(deltaPercent)) {
      return {
        confidence: 0.5,
        reasoning: 'Invalid delta percent',
        status: 'ERROR'
      };
    }

    const { strongBuy, moderateBuy, moderateSell, strongSell } = this.config.confidenceThresholds;

    let confidence, reasoning;

    if (deltaPercent > strongBuy) {
      confidence = 0.9;
      reasoning = `Strong buying pressure (δ: +${(deltaPercent * 100).toFixed(1)}%)`;
    } else if (deltaPercent > moderateBuy) {
      confidence = 0.7;
      reasoning = `Moderate buying pressure (δ: +${(deltaPercent * 100).toFixed(1)}%)`;
    } else if (deltaPercent < strongSell) {
      confidence = 0.1;
      reasoning = `Strong selling pressure (δ: ${(deltaPercent * 100).toFixed(1)}%)`;
    } else if (deltaPercent < moderateSell) {
      confidence = 0.3;
      reasoning = `Moderate selling pressure (δ: ${(deltaPercent * 100).toFixed(1)}%)`;
    } else {
      confidence = 0.5;
      reasoning = `Neutral order flow (δ: ${(deltaPercent * 100).toFixed(1)}%)`;
    }

    return { confidence, reasoning, status: 'SUCCESS' };
  }

  async getOrderFlowSignal(currentSwaps) {
    const startTime = Date.now();

    try {
      const flowData = this.calculateDelta(currentSwaps);
      const confidenceResult = this.getConfidence(flowData.deltaPercent, flowData.status);

      const result = {
        confidence: confidenceResult.confidence,
        data: flowData,
        weight: 0.20,
        reasoning: confidenceResult.reasoning,
        status: confidenceResult.status,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      if (result.processingTime > 100) {
        logger.warn(`OrderFlow: Slow processing - ${result.processingTime}ms`);
      }

      return result;

    } catch (error) {
      logger.error('OrderFlow: Fatal error in getOrderFlowSignal:', error);

      return {
        confidence: 0.5,
        data: { ...this.defaults },
        weight: 0.20,
        reasoning: 'Order flow system error',
        status: 'SYSTEM_ERROR',
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }
}

module.exports = ProductionOrderFlow;
