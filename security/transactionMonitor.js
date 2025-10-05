const { ethers } = require('ethers');
const logger = require('../logger');

class TransactionMonitor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      windowSize: options.windowSize || 100,
      maxAmountStdDev: options.maxAmountStdDev || 3,
      maxFrequency: options.maxFrequency || 10,
      maxGasPrice: options.maxGasPrice || ethers.utils.parseUnits('50', 'gwei'),
      minGasPrice: options.minGasPrice || ethers.utils.parseUnits('1', 'gwei'),
      ...options
    };
    
    this.recentTransactions = [];
    this.suspiciousAddresses = new Set();
    this.contractCache = new Map();
    this.scamDatabase = new Set();
    
    // Anomaly detection thresholds
    this.thresholds = {
      unusualAmount: this.options.maxAmountStdDev,
      highFrequency: this.options.maxFrequency,
      unusualGasPrice: 0.5, // 50% above normal
      highRiskContract: 0.7,
      suspiciousAddress: 1.0
    };
    
    // Statistics for analysis
    this.stats = {
      totalTransactions: 0,
      blockedTransactions: 0,
      flaggedTransactions: 0,
      averageAmount: 0,
      averageGasPrice: 0,
      lastResetTime: Date.now()
    };
    
    // Load known scam addresses
    this.loadScamDatabase();
    
    logger.info('🚀 Transaction Monitor initialized');
  }

  // Load known scam addresses from database
  async loadScamDatabase() {
    try {
      // In production, load from a real database
      const knownScams = [
        '0x0000000000000000000000000000000000000000', // Example scam address
        // Add more known scam addresses
      ];
      
      knownScams.forEach(address => this.scamDatabase.add(address.toLowerCase()));
      
      logger.info(`✅ Loaded ${this.scamDatabase.size} known scam addresses`);
      
    } catch (error) {
      logger.error('❌ Failed to load scam database:', error);
    }
  }

  // Analyze transaction for fraud
  async analyzeTransaction(transaction) {
    const startTime = performance.now();
    const anomalies = [];
    
    try {
      // Check 1: Unusual amount
      if (this.isUnusualAmount(transaction.amount)) {
        anomalies.push({
          type: 'UNUSUAL_AMOUNT',
          severity: 'HIGH',
          value: transaction.amount,
          threshold: this.thresholds.unusualAmount
        });
      }
      
      // Check 2: Suspicious counterparty
      if (this.suspiciousAddresses.has(transaction.to?.toLowerCase())) {
        anomalies.push({
          type: 'SUSPICIOUS_ADDRESS',
          severity: 'CRITICAL',
          address: transaction.to
        });
      }
      
      // Check 3: High frequency
      if (this.isHighFrequency()) {
        anomalies.push({
          type: 'HIGH_FREQUENCY',
          severity: 'MEDIUM',
          rate: this.getTransactionRate()
        });
      }
      
      // Check 4: Unusual gas price
      if (this.isUnusualGasPrice(transaction.gasPrice)) {
        anomalies.push({
          type: 'UNUSUAL_GAS',
          severity: 'MEDIUM',
          gasPrice: transaction.gasPrice,
          threshold: this.thresholds.unusualGasPrice
        });
      }
      
      // Check 5: Contract interaction analysis
      if (transaction.to && await this.isContract(transaction.to)) {
        const risk = await this.analyzeContract(transaction.to);
        if (risk > this.thresholds.highRiskContract) {
          anomalies.push({
            type: 'HIGH_RISK_CONTRACT',
            severity: 'HIGH',
            risk: risk,
            threshold: this.thresholds.highRiskContract
          });
        }
      }
      
      // Check 6: Known scam address
      if (transaction.to && this.scamDatabase.has(transaction.to.toLowerCase())) {
        anomalies.push({
          type: 'KNOWN_SCAM_ADDRESS',
          severity: 'CRITICAL',
          address: transaction.to
        });
      }
      
      // Check 7: Unusual transaction pattern
      if (this.isUnusualPattern(transaction)) {
        anomalies.push({
          type: 'UNUSUAL_PATTERN',
          severity: 'MEDIUM',
          pattern: 'unusual_transaction_pattern'
        });
      }
      
      // Record transaction for statistical analysis
      this.recordTransaction(transaction);
      
      const analysisTime = performance.now() - startTime;
      
      if (anomalies.length > 0) {
        // Log anomalies
        logger.warn(`🚨 Transaction anomalies detected (${analysisTime.toFixed(2)}ms):`, anomalies);
        
        // Calculate overall risk score
        const riskScore = this.calculateRiskScore(anomalies);
        
        // Block if critical
        if (riskScore >= 0.9) {
          this.stats.blockedTransactions++;
          throw new Error(`Transaction blocked - risk score: ${riskScore.toFixed(2)}`);
        }
        
        // Require manual approval if high risk
        if (riskScore >= 0.7) {
          this.stats.flaggedTransactions++;
          await this.requestManualApproval(transaction, anomalies);
        }
        
        return { 
          approved: true, 
          riskScore: riskScore.toFixed(2), 
          anomalies: anomalies,
          analysisTime: analysisTime.toFixed(2) + 'ms'
        };
      }
      
      return { 
        approved: true, 
        riskScore: 0, 
        anomalies: [],
        analysisTime: analysisTime.toFixed(2) + 'ms'
      };
      
    } catch (error) {
      logger.error('❌ Transaction analysis failed:', error);
      throw error;
    }
  }

  // Check for unusual transaction amounts
  isUnusualAmount(amount) {
    if (this.recentTransactions.length < 10) return false;
    
    const amounts = this.recentTransactions.map(tx => parseFloat(tx.amount));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.abs(amount - mean) > this.thresholds.unusualAmount * stdDev;
  }

  // Check for high frequency transactions
  isHighFrequency() {
    const now = Date.now();
    const recentCount = this.recentTransactions.filter(
      tx => now - tx.timestamp < 1000
    ).length;
    
    return recentCount > this.thresholds.highFrequency;
  }

  // Check for unusual gas prices
  isUnusualGasPrice(gasPrice) {
    if (this.recentTransactions.length < 10) return false;
    
    const gasPrices = this.recentTransactions.map(tx => parseFloat(tx.gasPrice));
    const mean = gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length;
    
    return Math.abs(gasPrice - mean) > this.thresholds.unusualGasPrice * mean;
  }

  // Check for unusual transaction patterns
  isUnusualPattern(transaction) {
    // Check for patterns like:
    // - Same amount repeated
    // - Round numbers
    // - Very small amounts
    // - Very large amounts
    
    const amount = parseFloat(transaction.amount);
    
    // Round numbers
    if (amount % 1000 === 0 && amount > 1000) {
      return true;
    }
    
    // Very small amounts
    if (amount < 0.001) {
      return true;
    }
    
    // Very large amounts
    if (amount > 1000000) {
      return true;
    }
    
    return false;
  }

  // Analyze contract for risk
  async analyzeContract(address) {
    try {
      // Check cache first
      if (this.contractCache.has(address)) {
        return this.contractCache.get(address);
      }
      
      // Check against known scam database
      if (this.scamDatabase.has(address.toLowerCase())) {
        this.contractCache.set(address, 1.0);
        return 1.0;
      }
      
      // Analyze contract code
      const code = await this.provider.getCode(address);
      
      const risks = {
        selfDestruct: /selfdestruct|suicide/.test(code),
        delegateCall: /delegatecall/.test(code),
        noSourceCode: code === '0x',
        recentDeployment: await this.isRecentlyDeployed(address),
        lowLiquidity: await this.hasLowLiquidity(address)
      };
      
      // Calculate risk score
      const weights = {
        selfDestruct: 0.3,
        delegateCall: 0.2,
        noSourceCode: 0.2,
        recentDeployment: 0.15,
        lowLiquidity: 0.15
      };
      
      const riskScore = Object.entries(risks).reduce((score, [risk, present]) => 
        score + (present ? weights[risk] : 0), 0
      );
      
      // Cache result
      this.contractCache.set(address, riskScore);
      
      return riskScore;
      
    } catch (error) {
      logger.error(`❌ Contract analysis failed for ${address}:`, error);
      return 0.5; // Default to medium risk on error
    }
  }

  // Check if address is a contract
  async isContract(address) {
    try {
      const code = await this.provider.getCode(address);
      return code !== '0x';
    } catch (error) {
      logger.error(`❌ Failed to check contract status for ${address}:`, error);
      return false;
    }
  }

  // Check if contract was recently deployed
  async isRecentlyDeployed(address) {
    try {
      // This would check deployment time
      // For now, return false as placeholder
      return false;
    } catch (error) {
      return false;
    }
  }

  // Check if contract has low liquidity
  async hasLowLiquidity(address) {
    try {
      // This would check liquidity on DEXes
      // For now, return false as placeholder
      return false;
    } catch (error) {
      return false;
    }
  }

  // Calculate overall risk score
  calculateRiskScore(anomalies) {
    const severityWeights = {
      'CRITICAL': 1.0,
      'HIGH': 0.7,
      'MEDIUM': 0.4,
      'LOW': 0.2
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    anomalies.forEach(anomaly => {
      const weight = severityWeights[anomaly.severity] || 0.2;
      totalScore += weight;
      totalWeight += 1;
    });
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // Record transaction for statistical analysis
  recordTransaction(transaction) {
    this.recentTransactions.push({
      ...transaction,
      timestamp: Date.now()
    });
    
    // Keep only recent transactions
    if (this.recentTransactions.length > this.options.windowSize) {
      this.recentTransactions = this.recentTransactions.slice(-this.options.windowSize);
    }
    
    // Update statistics
    this.stats.totalTransactions++;
    this.updateStatistics();
  }

  // Update statistics
  updateStatistics() {
    if (this.recentTransactions.length === 0) return;
    
    const amounts = this.recentTransactions.map(tx => parseFloat(tx.amount));
    const gasPrices = this.recentTransactions.map(tx => parseFloat(tx.gasPrice));
    
    this.stats.averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    this.stats.averageGasPrice = gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length;
  }

  // Get transaction rate
  getTransactionRate() {
    const now = Date.now();
    const recentCount = this.recentTransactions.filter(
      tx => now - tx.timestamp < 60000 // Last minute
    ).length;
    
    return recentCount;
  }

  // Request manual approval for high-risk transactions
  async requestManualApproval(transaction, anomalies) {
    try {
      // Send alert to monitoring system
      await this.sendAlert({
        level: 'HIGH',
        type: 'MANUAL_APPROVAL_REQUIRED',
        transaction: transaction,
        anomalies: anomalies,
        timestamp: Date.now()
      });
      
      // In production, this would wait for approval
      // For now, just log the request
      logger.warn('🚨 Manual approval required for transaction:', {
        transaction: transaction,
        anomalies: anomalies
      });
      
      // Simulate approval after 30 seconds
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      return true;
      
    } catch (error) {
      logger.error('❌ Manual approval request failed:', error);
      throw error;
    }
  }

  // Send alert to monitoring system
  async sendAlert(alert) {
    // In production, this would send to monitoring system
    logger.warn('🚨 Security Alert:', alert);
  }

  // Add suspicious address
  addSuspiciousAddress(address) {
    this.suspiciousAddresses.add(address.toLowerCase());
    logger.info(`✅ Added suspicious address: ${address}`);
  }

  // Remove suspicious address
  removeSuspiciousAddress(address) {
    this.suspiciousAddresses.delete(address.toLowerCase());
    logger.info(`✅ Removed suspicious address: ${address}`);
  }

  // Get monitor statistics
  getStats() {
    return {
      ...this.stats,
      recentTransactions: this.recentTransactions.length,
      suspiciousAddresses: this.suspiciousAddresses.size,
      scamDatabase: this.scamDatabase.size,
      contractCache: this.contractCache.size,
      blockedRate: this.stats.totalTransactions > 0 ? 
        (this.stats.blockedTransactions / this.stats.totalTransactions * 100).toFixed(2) + '%' : '0%',
      flaggedRate: this.stats.totalTransactions > 0 ? 
        (this.stats.flaggedTransactions / this.stats.totalTransactions * 100).toFixed(2) + '%' : '0%'
    };
  }

  // Health check
  healthCheck() {
    const blockedRate = this.stats.totalTransactions > 0 ? 
      this.stats.blockedTransactions / this.stats.totalTransactions : 0;
    
    const healthy = blockedRate < 0.1; // Less than 10% blocked
    
    return {
      status: healthy ? 'healthy' : 'warning',
      stats: this.getStats(),
      blockedRate: (blockedRate * 100).toFixed(2) + '%',
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations
  getRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    
    if (stats.blockedRate > 5) {
      recommendations.push('High block rate detected - review thresholds');
    }
    
    if (stats.flaggedRate > 20) {
      recommendations.push('High flag rate detected - review anomaly detection');
    }
    
    if (stats.suspiciousAddresses > 1000) {
      recommendations.push('Large suspicious address list - consider cleanup');
    }
    
    return recommendations;
  }

  // Reset statistics
  resetStats() {
    this.stats = {
      totalTransactions: 0,
      blockedTransactions: 0,
      flaggedTransactions: 0,
      averageAmount: 0,
      averageGasPrice: 0,
      lastResetTime: Date.now()
    };
    
    this.recentTransactions = [];
    logger.info('✅ Transaction monitor statistics reset');
  }

  // Clear contract cache
  clearContractCache() {
    this.contractCache.clear();
    logger.info('✅ Contract cache cleared');
  }
}

module.exports = TransactionMonitor;

