const logger = require('../logger');

class ProductionVolumeProfile {
  constructor(config = {}) {
    this.config = {
      historyHours: config.historyHours || 24,
      precision: config.precision || 1000,
      minSwapsForProfile: config.minSwapsForProfile || 100,
      maxSwapsToProcess: config.maxSwapsToProcess || 50000,
      batchSize: config.batchSize || 1000,
      ...config
    };

    this.priceLevels = new Map();
    this.defaults = {
      poc: 0,
      highVolumeNodes: [],
      totalLevels: 0,
      maxVolume: 0,
      processedSwaps: 0,
      status: 'NO_DATA',
      timestamp: Date.now()
    };
  }

  buildProfile(swaps) {
    const startTime = Date.now();
    this.priceLevels.clear();

    try {
      if (!swaps || !Array.isArray(swaps)) {
        logger.warn('VolumeProfile: Invalid swaps input');
        return { ...this.defaults, status: 'INVALID_INPUT' };
      }

      if (swaps.length < this.config.minSwapsForProfile) {
        logger.debug(`VolumeProfile: Insufficient swaps: ${swaps.length} < ${this.config.minSwapsForProfile}`);
        return { ...this.defaults, status: 'INSUFFICIENT_DATA' };
      }

      const swapsToProcess = swaps.slice(0, this.config.maxSwapsToProcess);
      let processedCount = 0;

      for (let i = 0; i < swapsToProcess.length; i += this.config.batchSize) {
        const batch = swapsToProcess.slice(i, i + this.config.batchSize);
        processedCount += this.processBatch(batch);
      }

      if (processedCount === 0) {
        logger.warn('VolumeProfile: No valid swaps processed');
        return { ...this.defaults, status: 'NO_VALID_DATA' };
      }

      const qualityRatio = processedCount / swapsToProcess.length;
      if (qualityRatio < 0.3) {
        logger.warn(`VolumeProfile: Low data quality: ${qualityRatio.toFixed(2)}`);
      }

      const profileData = this.calculateKeyLevels();
      profileData.processedSwaps = processedCount;
      profileData.processingTime = Date.now() - startTime;
      profileData.status = 'SUCCESS';

      logger.debug(`VolumeProfile: Built profile from ${processedCount} swaps in ${profileData.processingTime}ms`);

      return profileData;

    } catch (error) {
      logger.error('VolumeProfile: Error building profile:', error);
      return {
        ...this.defaults,
        status: 'ERROR',
        error: error.message
      };
    }
  }

  processBatch(batch) {
    let processed = 0;

    for (const swap of batch) {
      try {
        const price = this.calculateSwapPrice(swap);
        if (!price || price <= 0) continue;

        const priceKey = Math.floor(price * this.config.precision) / this.config.precision;
        const volume = this.safeParseFloat(swap?.amount0In);

        if (volume > 0) {
          this.priceLevels.set(priceKey, (this.priceLevels.get(priceKey) || 0) + volume);
          processed++;
        }
      } catch (error) {
        // Skip malformed swap
      }
    }

    return processed;
  }

  calculateSwapPrice(swap) {
    try {
      const amount0In = this.safeParseFloat(swap?.amount0In);
      const amount1Out = this.safeParseFloat(swap?.amount1Out);

      if (amount0In <= 0 || amount1Out <= 0) return null;

      const price = amount0In / amount1Out;

      if (!isFinite(price) || price <= 0 || price > 1e6) return null;

      return price;
    } catch (error) {
      return null;
    }
  }

  safeParseFloat(value) {
    if (value === undefined || value === null) return 0;
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }

  calculateKeyLevels() {
    if (this.priceLevels.size === 0) {
      return { ...this.defaults };
    }

    let maxVolume = 0;
    let poc = 0;
    const levels = Array.from(this.priceLevels.entries());

    for (const [price, volume] of levels) {
      if (volume > maxVolume) {
        maxVolume = volume;
        poc = price;
      }
    }

    const sorted = levels.sort((a, b) => b[1] - a[1]);
    const topCount = Math.max(5, Math.floor(sorted.length * 0.05));
    const highVolumeNodes = sorted.slice(0, topCount).map(([price, volume]) => ({
      price,
      volume,
      volumePercent: (volume / maxVolume) * 100
    }));

    return {
      poc,
      highVolumeNodes,
      totalLevels: levels.length,
      maxVolume,
      status: 'SUCCESS'
    };
  }

  getConfidence(currentPrice, profileData) {
    if (profileData.status !== 'SUCCESS' || profileData.poc === 0) {
      return {
        confidence: 0.5,
        reasoning: 'Volume profile data unavailable',
        status: 'DEGRADED'
      };
    }

    const distancePercent = Math.abs((currentPrice - profileData.poc) / profileData.poc);

    let confidence, reasoning;

    if (distancePercent < 0.01) {
      confidence = 0.8;
      reasoning = `At value area (within 1% of POC)`;
    } else if (distancePercent < 0.02) {
      confidence = 0.7;
      reasoning = `Near value area (within 2% of POC)`;
    } else if (distancePercent < 0.03) {
      confidence = 0.6;
      reasoning = `Close to value area (within 3% of POC)`;
    } else if (distancePercent > 0.05) {
      confidence = 0.3;
      reasoning = `Far from value area (>5% from POC)`;
    } else {
      confidence = 0.5;
      reasoning = `Moderate distance from value area`;
    }

    return {
      confidence,
      reasoning: `${reasoning} | POC: ${profileData.poc.toFixed(6)}`,
      status: 'SUCCESS'
    };
  }

  async getVolumeProfileSignal(currentPrice, historicalSwaps) {
    const startTime = Date.now();

    try {
      const profileData = this.buildProfile(historicalSwaps);
      const confidenceResult = this.getConfidence(currentPrice, profileData);

      const result = {
        confidence: confidenceResult.confidence,
        data: profileData,
        weight: 0.18,
        reasoning: confidenceResult.reasoning,
        status: confidenceResult.status,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      return result;

    } catch (error) {
      logger.error('VolumeProfile: Error in getVolumeProfileSignal:', error);

      return {
        confidence: 0.5,
        data: { ...this.defaults },
        weight: 0.18,
        reasoning: 'Volume profile system error',
        status: 'SYSTEM_ERROR',
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }
}

module.exports = ProductionVolumeProfile;
