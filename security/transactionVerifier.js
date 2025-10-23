const { ethers } = require('ethers');
const logger = require('../logger');

class TransactionVerifier {
  constructor() {
    // Known safe contract addresses (whitelisted)
    this.whitelist = new Set([
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Router
      '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', // PancakeSwap V3 Router
    ].map(addr => addr.toLowerCase()));
    
    // Known scam/malicious addresses (blacklisted)
    this.blacklist = new Set([
      // Add known scam addresses here as discovered
    ].map(addr => addr.toLowerCase()));
    
    // BSC-specific limits
    this.limits = {
      maxGasPrice: ethers.parseUnits('50', 'gwei'),    // Max gas for BSC
      normalGasPrice: ethers.parseUnits('5', 'gwei'),   // Normal BSC gas
      maxValue: ethers.parseEther('1.0'),               // Max 1 BNB per transaction
      warningValue: ethers.parseEther('0.5'),           // Warn if > 0.5 BNB
    };
  }

  /**
   * Verify transaction before sending
   * @param {Object} tx - Transaction object
   * @throws {Error} if transaction fails verification
   * @returns {boolean} true if verified
   */
  async verifyTransaction(tx) {
    const checks = [];
    
    // 1. Check if destination address is blacklisted
    if (tx.to && this.blacklist.has(tx.to.toLowerCase())) {
      throw new Error('🚨 Transaction blocked: Destination address is blacklisted (known scam)');
    }
    checks.push('✅ Address not blacklisted');
    
    // 2. Verify gas price is reasonable for BSC
    if (tx.maxFeePerGas) {
      if (tx.maxFeePerGas > this.limits.maxGasPrice) {
        throw new Error(
          `🚨 Transaction blocked: Gas price too high (${ethers.formatUnits(tx.maxFeePerGas, 'gwei')} gwei > 50 gwei max for BSC)`
        );
      }
      
      // Warn if gas is unusually high
      if (tx.maxFeePerGas > this.limits.normalGasPrice * 5n) {
        logger.warn(`⚠️  High gas price: ${ethers.formatUnits(tx.maxFeePerGas, 'gwei')} gwei (normal: ${ethers.formatUnits(this.limits.normalGasPrice, 'gwei')} gwei)`);
      }
      checks.push(`✅ Gas price reasonable (${ethers.formatUnits(tx.maxFeePerGas, 'gwei')} gwei)`);
    }
    
    // 3. Check transaction value is reasonable
    if (tx.value) {
      if (tx.value > this.limits.maxValue) {
        throw new Error(
          `🚨 Transaction blocked: Value too high (${ethers.formatEther(tx.value)} BNB > 1 BNB max)`
        );
      }
      
      // Warn if value is high
      if (tx.value > this.limits.warningValue) {
        logger.warn(`⚠️  High transaction value: ${ethers.formatEther(tx.value)} BNB`);
      }
      checks.push(`✅ Value reasonable (${ethers.formatEther(tx.value)} BNB)`);
    }
    
    // 4. Verify contract address is whitelisted (optional warning)
    if (tx.to && !this.whitelist.has(tx.to.toLowerCase())) {
      logger.warn(`⚠️  Transaction to non-whitelisted address: ${tx.to}`);
      logger.warn(`⚠️  Known safe contracts: ${Array.from(this.whitelist).join(', ')}`);
      // Don't throw, just warn - might be legitimate new contract
    } else if (tx.to) {
      checks.push(`✅ Contract address whitelisted`);
    }
    
    // 5. Verify transaction has reasonable gas limit
    if (tx.gasLimit) {
      const maxGasLimit = 5000000n; // 5M gas max
      if (tx.gasLimit > maxGasLimit) {
        throw new Error(
          `🚨 Transaction blocked: Gas limit too high (${tx.gasLimit.toString()} > 5M max)`
        );
      }
      checks.push(`✅ Gas limit reasonable (${tx.gasLimit.toString()})`);
    }
    
    // Log verification success
    logger.debug('🔐 Transaction verified:', {
      to: tx.to,
      value: tx.value ? ethers.formatEther(tx.value) : '0',
      gasPrice: tx.maxFeePerGas ? ethers.formatUnits(tx.maxFeePerGas, 'gwei') : 'N/A',
      checks: checks.length
    });
    
    return true;
  }

  /**
   * Add address to whitelist
   * @param {string} address - Contract address to whitelist
   */
  addToWhitelist(address) {
    this.whitelist.add(address.toLowerCase());
    logger.info(`✅ Address added to whitelist: ${address}`);
  }

  /**
   * Add address to blacklist
   * @param {string} address - Scam address to blacklist
   */
  addToBlacklist(address) {
    this.blacklist.add(address.toLowerCase());
    logger.warn(`⚠️  Address added to blacklist: ${address}`);
  }

  /**
   * Check if address is blacklisted
   * @param {string} address
   * @returns {boolean}
   */
  isBlacklisted(address) {
    return this.blacklist.has(address.toLowerCase());
  }

  /**
   * Check if address is whitelisted
   * @param {string} address
   * @returns {boolean}
   */
  isWhitelisted(address) {
    return this.whitelist.has(address.toLowerCase());
  }
}

module.exports = TransactionVerifier;

