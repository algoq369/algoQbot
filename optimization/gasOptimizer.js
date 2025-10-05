const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

class GasOptimizer {
  constructor(provider) {
    this.provider = provider;
    this.gasPriceHistory = [];
    this.gasPricePredictions = {};
    this.maxGasPrice = ethers.parseUnits('20', 'gwei'); // 20 gwei max
    this.minGasPrice = ethers.parseUnits('1', 'gwei');  // 1 gwei min
    
    // Gas optimization settings
    this.settings = {
      fastConfirmationTime: 30000,  // 30 seconds
      standardConfirmationTime: 60000, // 1 minute
      slowConfirmationTime: 300000, // 5 minutes
      gasPriceMultiplier: 1.1, // 10% above network gas price
      maxGasLimit: 500000, // Maximum gas limit
      retryAttempts: 3
    };

    logger.info('⛽ Gas Optimizer initialized');
  }

  // Get current network gas price
  async getCurrentGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      return {
        gasPrice: feeData.gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };
    } catch (error) {
      logger.error('Error getting gas price:', error);
      throw error;
    }
  }

  // Predict optimal gas price based on history
  async predictOptimalGasPrice(urgency = 'standard') {
    try {
      const currentGas = await this.getCurrentGasPrice();
      const gasPrice = currentGas.gasPrice || currentGas.maxFeePerGas;
      
      // Store in history
      this.gasPriceHistory.push({
        timestamp: Date.now(),
        gasPrice: Number(ethers.formatUnits(gasPrice, 'gwei')),
        blockNumber: await this.provider.getBlockNumber()
      });

      // Keep only last 100 entries
      if (this.gasPriceHistory.length > 100) {
        this.gasPriceHistory = this.gasPriceHistory.slice(-100);
      }

      // Calculate optimal gas price based on urgency
      const baseGasPrice = Number(ethers.formatUnits(gasPrice, 'gwei'));
      let optimalGasPrice;

      switch (urgency) {
        case 'fast':
          optimalGasPrice = baseGasPrice * 1.2; // 20% above network
          break;
        case 'standard':
          optimalGasPrice = baseGasPrice * 1.1; // 10% above network
          break;
        case 'slow':
          optimalGasPrice = baseGasPrice * 0.9; // 10% below network
          break;
        default:
          optimalGasPrice = baseGasPrice * this.settings.gasPriceMultiplier;
      }

      // Apply bounds
      optimalGasPrice = Math.max(optimalGasPrice, Number(ethers.formatUnits(this.minGasPrice, 'gwei')));
      optimalGasPrice = Math.min(optimalGasPrice, Number(ethers.formatUnits(this.maxGasPrice, 'gwei')));

      const optimalGasPriceWei = ethers.parseUnits(optimalGasPrice.toFixed(2), 'gwei');

      logger.info(`Gas price prediction - Current: ${baseGasPrice.toFixed(2)} gwei, Optimal: ${optimalGasPrice.toFixed(2)} gwei (${urgency})`);

      return {
        gasPrice: optimalGasPriceWei,
        urgency,
        confidence: this.calculateConfidence()
      };
    } catch (error) {
      logger.error('Error predicting gas price:', error);
      throw error;
    }
  }

  // Calculate confidence in gas price prediction
  calculateConfidence() {
    if (this.gasPriceHistory.length < 10) return 0.5;
    
    const recent = this.gasPriceHistory.slice(-10);
    const volatility = this.calculateVolatility(recent.map(h => h.gasPrice));
    
    // Lower volatility = higher confidence
    return Math.max(0.1, 1 - (volatility * 10));
  }

  // Calculate volatility of gas prices
  calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  // Estimate gas limit for transaction
  async estimateGasLimit(transaction) {
    try {
      const estimatedGas = await this.provider.estimateGas(transaction);
      
      // Add 20% buffer to estimated gas
      const gasLimit = estimatedGas * 120n / 100n;
      
      // Apply maximum gas limit
      const finalGasLimit = gasLimit > this.settings.maxGasLimit ? 
        BigInt(this.settings.maxGasLimit) : gasLimit;

      logger.info(`Gas limit estimation - Estimated: ${estimatedGas}, Final: ${finalGasLimit}`);
      
      return finalGasLimit;
    } catch (error) {
      logger.error('Error estimating gas limit:', error);
      // Return default gas limit on error
      return BigInt(200000);
    }
  }

  // Optimize transaction with gas settings
  async optimizeTransaction(transaction, urgency = 'standard') {
    try {
      // Get optimal gas price
      const gasPrediction = await this.predictOptimalGasPrice(urgency);
      
      // Estimate gas limit
      const gasLimit = await this.estimateGasLimit(transaction);
      
      // Build optimized transaction
      const optimizedTx = {
        ...transaction,
        gasLimit,
        gasPrice: gasPrediction.gasPrice,
        maxFeePerGas: gasPrediction.gasPrice,
        maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
      };

      logger.info(`Transaction optimized - Gas Limit: ${gasLimit}, Gas Price: ${ethers.formatUnits(gasPrediction.gasPrice, 'gwei')} gwei`);

      return {
        transaction: optimizedTx,
        gasPrediction,
        estimatedCost: gasLimit * gasPrediction.gasPrice
      };
    } catch (error) {
      logger.error('Error optimizing transaction:', error);
      throw error;
    }
  }

  // Execute transaction with retry logic
  async executeWithRetry(transaction, urgency = 'standard') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
      try {
        logger.info(`Transaction attempt ${attempt}/${this.settings.retryAttempts}`);
        
        // Optimize transaction for this attempt
        const optimized = await this.optimizeTransaction(transaction, urgency);
        
        // Send transaction
        const tx = await this.provider.getSigner().sendTransaction(optimized.transaction);
        
        logger.info(`Transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        logger.info(`Transaction confirmed in block: ${receipt.blockNumber}`);
        
        return {
          tx,
          receipt,
          gasUsed: receipt.gasUsed,
          gasPrice: optimized.gasPrediction.gasPrice,
          totalCost: receipt.gasUsed * optimized.gasPrediction.gasPrice
        };
        
      } catch (error) {
        lastError = error;
        logger.warn(`Transaction attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.settings.retryAttempts) {
          // Increase gas price for retry
          urgency = 'fast';
          await this.sleep(2000 * attempt); // Exponential backoff
        }
      }
    }
    
    throw new Error(`Transaction failed after ${this.settings.retryAttempts} attempts: ${lastError.message}`);
  }

  // Gas price monitoring and alerts
  async monitorGasPrices() {
    try {
      const gasData = await this.getCurrentGasPrice();
      const gasPrice = Number(ethers.formatUnits(gasData.gasPrice, 'gwei'));
      
      // Check for high gas prices
      if (gasPrice > 50) { // 50 gwei threshold
        logger.warn(`⚠️ High gas prices detected: ${gasPrice.toFixed(2)} gwei`);
        this.sendGasAlert(gasPrice);
      }
      
      // Check for gas price spikes
      if (this.gasPriceHistory.length > 1) {
        const previous = this.gasPriceHistory[this.gasPriceHistory.length - 2];
        const change = (gasPrice - previous.gasPrice) / previous.gasPrice;
        
        if (Math.abs(change) > 0.5) { // 50% change
          logger.warn(`⚠️ Gas price spike detected: ${(change * 100).toFixed(1)}% change`);
        }
      }
      
    } catch (error) {
      logger.error('Error monitoring gas prices:', error);
    }
  }

  // Send gas price alert
  sendGasAlert(gasPrice) {
    // Implement notification system
    logger.error(`🚨 Gas Alert: Network gas price is ${gasPrice.toFixed(2)} gwei - Consider reducing trading frequency`);
  }

  // Get gas statistics
  getGasStatistics() {
    if (this.gasPriceHistory.length === 0) {
      return { message: 'No gas price history available' };
    }

    const prices = this.gasPriceHistory.map(h => h.gasPrice);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const volatility = this.calculateVolatility(prices);

    return {
      average: avg.toFixed(2),
      minimum: min.toFixed(2),
      maximum: max.toFixed(2),
      volatility: (volatility * 100).toFixed(2),
      dataPoints: prices.length,
      lastUpdate: new Date(this.gasPriceHistory[this.gasPriceHistory.length - 1].timestamp)
    };
  }

  // Utility function for sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GasOptimizer;
