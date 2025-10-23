const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

class PriceHistoryManager {
  constructor(filePath = './data/price-history.json', maxPoints = 1000) {
    this.filePath = filePath;
    this.maxPoints = maxPoints;
    this.priceHistory = [];
    this.isLoaded = false;
  }

  async initialize() {
    await this.loadHistory();
    logger.info(`📊 Price history manager initialized with ${this.priceHistory.length} data points`);
  }

  async loadHistory() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.filePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Load existing history
      const data = await fs.readFile(this.filePath, 'utf8');
      this.priceHistory = JSON.parse(data);

      // Sort by timestamp and limit to maxPoints
      this.priceHistory.sort((a, b) => a.timestamp - b.timestamp);
      if (this.priceHistory.length > this.maxPoints) {
        this.priceHistory = this.priceHistory.slice(-this.maxPoints);
      }

      this.isLoaded = true;
      logger.info(`✅ Loaded ${this.priceHistory.length} price history points`);

    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('📊 No existing price history found, starting fresh');
        this.priceHistory = [];
      } else {
        logger.error('❌ Error loading price history:', error);
        this.priceHistory = [];
      }
      this.isLoaded = true;
    }
  }

  async addPrice(price, timestamp = Date.now(), volume = 0) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    const pricePoint = {
      price: parseFloat(price),
      volume: parseFloat(volume) || 0, // Handle missing volume gracefully
      timestamp: timestamp
    };

    this.priceHistory.push(pricePoint);

    // Maintain rolling window
    if (this.priceHistory.length > this.maxPoints) {
      this.priceHistory = this.priceHistory.slice(-this.maxPoints);
    }

    // Save to disk (async, don't block)
    this.saveHistory().catch(err =>
      logger.debug('Error saving price history:', err.message)
    );

    logger.debug(`📊 Added price ${price}, volume ${volume} to history (${this.priceHistory.length} total)`);
  }

  async addPriceVolumeData(priceVolumeData) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    if (!Array.isArray(priceVolumeData)) {
      throw new Error('Price volume data must be an array');
    }

    // Validate data format and add to history
    for (const dataPoint of priceVolumeData) {
      if (typeof dataPoint.price !== 'number' || dataPoint.price <= 0) {
        logger.warn(`Invalid price data point: ${JSON.stringify(dataPoint)}`);
        continue;
      }

      const pricePoint = {
        price: parseFloat(dataPoint.price),
        volume: parseFloat(dataPoint.volume) || 0, // Handle missing volume gracefully
        timestamp: dataPoint.timestamp || Date.now()
      };

      this.priceHistory.push(pricePoint);
    }

    // Sort by timestamp and maintain rolling window
    this.priceHistory.sort((a, b) => a.timestamp - b.timestamp);
    if (this.priceHistory.length > this.maxPoints) {
      this.priceHistory = this.priceHistory.slice(-this.maxPoints);
    }

    // Save to disk (async, don't block)
    this.saveHistory().catch(err =>
      logger.debug('Error saving price history:', err.message)
    );

    logger.info(`📊 Added ${priceVolumeData.length} price/volume data points to history (${this.priceHistory.length} total)`);
  }

  async saveHistory() {
    try {
      // Ensure directory exists
      const dataDir = path.dirname(this.filePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Atomic write
      const tempPath = this.filePath + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(this.priceHistory, null, 2));
      await fs.rename(tempPath, this.filePath);

    } catch (error) {
      logger.error('❌ Error saving price history:', error);
      throw error;
    }
  }

  getHistory() {
    return [...this.priceHistory]; // Return copy
  }

  getHistoryCount() {
    return this.priceHistory.length;
  }

  getLatestPrice() {
    return this.priceHistory.length > 0 ? this.priceHistory[this.priceHistory.length - 1].price : null;
  }

  getLatestVolume() {
    return this.priceHistory.length > 0 ? this.priceHistory[this.priceHistory.length - 1].volume : null;
  }

  getPriceVolumeHistory() {
    return [...this.priceHistory]; // Return copy with volume data
  }

  getVolumeArray() {
    return this.priceHistory.map(point => point.volume || 0);
  }

  validateVolumeData() {
    const volumes = this.getVolumeArray();
    const prices = this.priceHistory.map(point => point.price);

    // Ensure volume array length matches price array length
    if (volumes.length !== prices.length) {
      logger.error(`❌ Volume array length (${volumes.length}) doesn't match price array length (${prices.length})`);
      return false;
    }

    // Volume should be positive numbers or 0
    const invalidVolumes = volumes.filter(vol => typeof vol !== 'number' || vol < 0);
    if (invalidVolumes.length > 0) {
      logger.error(`❌ Found ${invalidVolumes.length} invalid volume values:`, invalidVolumes);
      return false;
    }

    logger.debug(`✅ Volume data validation passed: ${volumes.length} valid volume points`);
    return true;
  }
}

module.exports = PriceHistoryManager;
