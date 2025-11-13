const logger = require('../logger');

class ProductionLiquidity {
  constructor(config = {}) {
    this.config = {
      minReserves: config.minReserves || 1000,
      maxChangeThreshold: config.maxChangeThreshold || 0.5,
      confidenceThresholds: config.confidenceThresholds || {
        largeChange: 0.05,
        usdtDominant: 0.55,
        bnbDominant: 0.45
      },
      ...config
    };

    this.priorReserves = null;
    this.defaults = {
      liquidityRatio: 0.5,
      reserve0Change: 0,
      reserve1Change: 0,
      reserves: [0, 0],
      price: 0,
      status: 'NO_DATA',
      timestamp: Date.now()
    };
  }

  async getReserveRatio(pairContract) {
    const startTime = Date.now();

    try {
      if (!pairContract || typeof pairContract.getReserves !== 'function') {
        logger.warn('Liquidity: Invalid pair contract');
        return { ...this.defaults, status: 'INVALID_CONTRACT' };
      }

      const reserves = await this.getReservesWithTimeout(pairContract);
      if (!reserves) {
        return { ...this.defaults, status: 'CONTRACT_ERROR' };
      }

      const [reserve0, reserve1] = reserves;

      const validation = this.validateReserves(reserve0, reserve1);
      if (!validation.isValid) {
        logger.warn(`Liquidity: Invalid reserves - ${validation.reason}`);
        return { ...this.defaults, status: validation.status };
      }

      const price = reserve0 / reserve1;
      const totalValue = reserve0 + (reserve1 * price);
      const liquidityRatio = totalValue > 0 ? reserve0 / totalValue : 0.5;

      const changes = this.calculateReserveChanges(reserve0, reserve1);

      const result = {
        liquidityRatio,
        reserve0Change: changes.reserve0Change,
        reserve1Change: changes.reserve1Change,
        reserves: [reserve0, reserve1],
        price,
        validation,
        processingTime: Date.now() - startTime,
        timestamp: Date.now(),
        status: 'SUCCESS'
      };

      logger.debug(`Liquidity: Ratio: ${(liquidityRatio * 100).toFixed(1)}%, Changes: ${(changes.reserve0Change * 100).toFixed(1)}%/${(changes.reserve1Change * 100).toFixed(1)}%`);

      return result;

    } catch (error) {
      logger.error('Liquidity: Error in getReserveRatio:', error);
      return {
        ...this.defaults,
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async getReservesWithTimeout(pairContract, timeoutMs = 5000) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Reserves request timeout')), timeoutMs);
      });

      const reservesPromise = pairContract.getReserves();
      const reserves = await Promise.race([reservesPromise, timeoutPromise]);

      return reserves.map(r => {
        const value = typeof r.toString === 'function' ? parseFloat(r.toString()) : parseFloat(r);
        return isFinite(value) ? value : 0;
      });

    } catch (error) {
      logger.error('Liquidity: Error fetching reserves:', error);
      return null;
    }
  }

  validateReserves(reserve0, reserve1) {
    if (!isFinite(reserve0) || !isFinite(reserve1)) {
      return { isValid: false, status: 'INVALID_NUMBERS', reason: 'Non-finite reserve values' };
    }

    if (reserve0 <= 0 || reserve1 <= 0) {
      return { isValid: false, status: 'ZERO_RESERVES', reason: 'Zero or negative reserves' };
    }

    if (reserve0 < this.config.minReserves || reserve1 < this.config.minReserves) {
      return { isValid: false, status: 'INSUFFICIENT_RESERVES', reason: 'Reserves below minimum' };
    }

    const price = reserve0 / reserve1;
    if (!isFinite(price) || price <= 0 || price > 1e6) {
      return { isValid: false, status: 'INVALID_PRICE', reason: 'Price out of reasonable range' };
    }

    return { isValid: true, status: 'VALID', reason: 'Reserves are valid' };
  }

  calculateReserveChanges(reserve0, reserve1) {
    if (!this.priorReserves) {
      this.priorReserves = [reserve0, reserve1];
      return { reserve0Change: 0, reserve1Change: 0 };
    }

    const [prior0, prior1] = this.priorReserves;

    const reserve0Change = prior0 > 0 ? (reserve0 - prior0) / prior0 : 0;
    const reserve1Change = prior1 > 0 ? (reserve1 - prior1) / prior1 : 0;

    const validChange0 = Math.abs(reserve0Change) <= this.config.maxChangeThreshold;
    const validChange1 = Math.abs(reserve1Change) <= this.config.maxChangeThreshold;

    if (!validChange0 || !validChange1) {
      logger.warn(`Liquidity: Extreme reserve changes detected: ${(reserve0Change * 100).toFixed(1)}%/${(reserve1Change * 100).toFixed(1)}%`);
    }

    this.priorReserves = [reserve0, reserve1];

    return {
      reserve0Change: validChange0 ? reserve0Change : 0,
      reserve1Change: validChange1 ? reserve1Change : 0,
      changesValid: validChange0 && validChange1
    };
  }

  getConfidence(liquidityData) {
    if (liquidityData.status !== 'SUCCESS') {
      return {
        confidence: 0.5,
        reasoning: `Liquidity data issue: ${liquidityData.status}`,
        status: 'DEGRADED'
      };
    }

    const { liquidityRatio, reserve0Change, reserve1Change } = liquidityData;
    const { largeChange, usdtDominant, bnbDominant } = this.config.confidenceThresholds;

    let confidence, reasoning;

    if (reserve0Change > largeChange) {
      confidence = 0.9;
      reasoning = `Large USDT added to pool (+${(reserve0Change * 100).toFixed(1)}%)`;
    } else if (reserve1Change > largeChange) {
      confidence = 0.1;
      reasoning = `Large BNB added to pool (+${(reserve1Change * 100).toFixed(1)}%)`;
    } else if (liquidityRatio > usdtDominant) {
      confidence = 0.7;
      reasoning = `USDT dominant (${(liquidityRatio * 100).toFixed(1)}% of liquidity)`;
    } else if (liquidityRatio < bnbDominant) {
      confidence = 0.3;
      reasoning = `BNB dominant (${(liquidityRatio * 100).toFixed(1)}% of liquidity)`;
    } else {
      confidence = 0.5;
      reasoning = `Balanced liquidity (${(liquidityRatio * 100).toFixed(1)}% USDT)`;
    }

    return {
      confidence,
      reasoning,
      status: 'SUCCESS'
    };
  }

  async getLiquiditySignal(pairContract) {
    const startTime = Date.now();

    try {
      const liquidityData = await this.getReserveRatio(pairContract);
      const confidenceResult = this.getConfidence(liquidityData);

      const result = {
        confidence: confidenceResult.confidence,
        data: liquidityData,
        weight: 0.18,
        reasoning: confidenceResult.reasoning,
        status: confidenceResult.status,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      return result;

    } catch (error) {
      logger.error('Liquidity: Error in getLiquiditySignal:', error);

      return {
        confidence: 0.5,
        data: { ...this.defaults },
        weight: 0.18,
        reasoning: 'Liquidity analysis system error',
        status: 'SYSTEM_ERROR',
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }
}

module.exports = ProductionLiquidity;
