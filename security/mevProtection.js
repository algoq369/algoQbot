const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

class MEVProtection {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.privateMempoolProviders = [
      'https://bsc-private-mempool.48.club',
      'https://bsc-private-mempool.flashbots.net'
    ];
    this.currentPrivateProvider = null;
    this.commitRevealNonces = new Map();
    
    logger.info('🛡️ MEV Protection initialized');
  }

  // Execute trade with MEV protection
  async executeProtectedTrade(tradeData) {
    try {
      // Choose protection method based on trade size and urgency
      if (tradeData.amount > 1000) { // Large trades use commit-reveal
        return await this.executeCommitRevealTrade(tradeData);
      } else if (tradeData.amount > 100) { // Medium trades use private mempool
        return await this.executePrivateMempoolTrade(tradeData);
      } else { // Small trades use timing protection
        return await this.executeTimingProtectedTrade(tradeData);
      }
    } catch (error) {
      logger.error('MEV protection failed, falling back to standard execution:', error);
      return await this.executeStandardTrade(tradeData);
    }
  }

  // Commit-Reveal pattern for large trades
  async executeCommitRevealTrade(tradeData) {
    const nonce = Date.now();
    const commitment = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'uint256', 'uint256'],
        [tradeData.token, tradeData.amount, tradeData.minAmount, nonce]
      )
    );

    logger.info(`🔐 Starting commit-reveal trade for ${tradeData.amount} tokens`);

    // Step 1: Commit
    const commitTx = await this.wallet.sendTransaction({
      to: this.wallet.address, // Self-send with commitment in data
      data: commitment,
      gasLimit: 21000,
      gasPrice: await this.getOptimalGasPrice('slow')
    });

    logger.info(`Commitment transaction sent: ${commitTx.hash}`);
    await commitTx.wait();

    // Step 2: Wait for commitment confirmation (2 blocks)
    const currentBlock = await this.provider.getBlockNumber();
    const targetBlock = currentBlock + 2;
    
    logger.info(`Waiting for block ${targetBlock} to reveal trade...`);
    await this.waitForBlock(targetBlock);

    // Step 3: Reveal and execute
    const revealTx = await this.executeTradeWithNonce(tradeData, nonce);
    
    logger.info(`✅ Commit-reveal trade completed: ${revealTx.hash}`);
    return revealTx;

  } catch (error) {
    logger.error('Commit-reveal trade failed:', error);
    throw error;
  }

  // Private mempool execution for medium trades
  async executePrivateMempoolTrade(tradeData) {
    try {
      // Use private mempool provider
      const privateProvider = await this.getPrivateProvider();
      
      logger.info(`🔒 Executing private mempool trade for ${tradeData.amount} tokens`);

      const tx = await privateProvider.sendTransaction({
        to: tradeData.contractAddress,
        data: tradeData.calldata,
        gasLimit: tradeData.gasLimit,
        gasPrice: await this.getOptimalGasPrice('standard'),
        value: tradeData.value || 0
      });

      logger.info(`Private mempool transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`✅ Private mempool trade completed: ${receipt.transactionHash}`);
      return receipt;

    } catch (error) {
      logger.error('Private mempool trade failed:', error);
      throw error;
    }
  }

  // Timing protection for small trades
  async executeTimingProtectedTrade(tradeData) {
    try {
      // Random delay to avoid predictable timing
      const delay = Math.random() * 5000 + 1000; // 1-6 seconds
      logger.info(`⏰ Timing protection delay: ${delay}ms`);
      
      await this.sleep(delay);

      // Execute at random gas price to avoid front-running
      const gasPrice = await this.getRandomizedGasPrice();
      
      logger.info(`🎲 Executing timing-protected trade with randomized gas`);

      const tx = await this.wallet.sendTransaction({
        to: tradeData.contractAddress,
        data: tradeData.calldata,
        gasLimit: tradeData.gasLimit,
        gasPrice: gasPrice,
        value: tradeData.value || 0
      });

      logger.info(`Timing-protected transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`✅ Timing-protected trade completed: ${receipt.transactionHash}`);
      return receipt;

    } catch (error) {
      logger.error('Timing-protected trade failed:', error);
      throw error;
    }
  }

  // Standard execution (fallback)
  async executeStandardTrade(tradeData) {
    logger.warn('⚠️ Using standard execution (no MEV protection)');
    
    const tx = await this.wallet.sendTransaction({
      to: tradeData.contractAddress,
      data: tradeData.calldata,
      gasLimit: tradeData.gasLimit,
      gasPrice: await this.getOptimalGasPrice('fast'),
      value: tradeData.value || 0
    });

    logger.info(`Standard transaction sent: ${tx.hash}`);
    return await tx.wait();
  }

  // Get private mempool provider
  async getPrivateProvider() {
    if (this.currentPrivateProvider) {
      return this.currentPrivateProvider;
    }

    for (const providerUrl of this.privateMempoolProviders) {
      try {
        const provider = new ethers.JsonRpcProvider(providerUrl);
        await provider.getBlockNumber(); // Test connection
        
        this.currentPrivateProvider = provider;
        logger.info(`✅ Connected to private mempool: ${providerUrl}`);
        return provider;
      } catch (error) {
        logger.warn(`Failed to connect to private mempool ${providerUrl}:`, error.message);
      }
    }

    throw new Error('No private mempool providers available');
  }

  // Get optimal gas price based on urgency
  async getOptimalGasPrice(urgency = 'standard') {
    const feeData = await this.provider.getFeeData();
    const baseGasPrice = feeData.gasPrice || feeData.maxFeePerGas;
    
    const multipliers = {
      slow: 0.9,      // 10% below network
      standard: 1.1,  // 10% above network
      fast: 1.2       // 20% above network
    };

    return baseGasPrice * BigInt(Math.floor(multipliers[urgency] * 100)) / 100n;
  }

  // Get randomized gas price to avoid front-running
  async getRandomizedGasPrice() {
    const baseGasPrice = await this.getOptimalGasPrice('standard');
    const randomFactor = 0.95 + Math.random() * 0.1; // 95-105% of base
    
    return baseGasPrice * BigInt(Math.floor(randomFactor * 100)) / 100n;
  }

  // Wait for specific block number
  async waitForBlock(blockNumber) {
    return new Promise((resolve) => {
      const checkBlock = async () => {
        const currentBlock = await this.provider.getBlockNumber();
        if (currentBlock >= blockNumber) {
          resolve();
        } else {
          setTimeout(checkBlock, 1000);
        }
      };
      checkBlock();
    });
  }

  // Execute trade with specific nonce for commit-reveal
  async executeTradeWithNonce(tradeData, nonce) {
    const tx = await this.wallet.sendTransaction({
      to: tradeData.contractAddress,
      data: tradeData.calldata,
      gasLimit: tradeData.gasLimit,
      gasPrice: await this.getOptimalGasPrice('fast'),
      value: tradeData.value || 0,
      nonce: await this.wallet.getNonce() // Use current nonce
    });

    return await tx.wait();
  }

  // Detect potential MEV attacks
  async detectMEVAttack(tradeData, expectedPrice, actualPrice) {
    const priceImpact = Math.abs(actualPrice - expectedPrice) / expectedPrice;
    
    // High price impact might indicate sandwich attack
    if (priceImpact > 0.05) { // 5% impact
      logger.warn(`⚠️ Potential MEV attack detected - Price impact: ${(priceImpact * 100).toFixed(2)}%`);
      
      // Check if price moved unfavorably
      if (actualPrice < expectedPrice * 0.98) { // 2% worse than expected
        logger.error(`🚨 MEV attack confirmed - Price manipulation detected`);
        return true;
      }
    }

    return false;
  }

  // Analyze transaction for MEV patterns
  async analyzeTransactionForMEV(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      const analysis = {
        gasPrice: tx.gasPrice,
        gasUsed: receipt.gasUsed,
        gasLimit: tx.gasLimit,
        gasEfficiency: Number(receipt.gasUsed) / Number(tx.gasLimit),
        blockNumber: receipt.blockNumber,
        transactionIndex: receipt.index
      };

      // Check for front-running patterns
      if (receipt.index === 0) { // First transaction in block
        logger.info('Transaction was first in block - potential front-running protection');
      }

      // Check gas efficiency
      if (analysis.gasEfficiency < 0.5) {
        logger.warn('Low gas efficiency - potential MEV protection overhead');
      }

      return analysis;
    } catch (error) {
      logger.error('Error analyzing transaction for MEV:', error);
      return null;
    }
  }

  // Utility function for sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get MEV protection statistics
  getMEVStats() {
    return {
      privateProviders: this.privateMempoolProviders.length,
      currentProvider: this.currentPrivateProvider ? 'connected' : 'disconnected',
      commitRevealNonces: this.commitRevealNonces.size,
      protectionMethods: ['commit-reveal', 'private-mempool', 'timing-protection']
    };
  }
}

module.exports = MEVProtection;

