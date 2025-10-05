const { ethers } = require('ethers');
const logger = require('../logger');

/**
 * Production Nonce Manager - Fixes Critical Nonce Gap Issue
 * 
 * EXPERT REVIEW FIX:
 * Previous issue: Failed transactions create nonce gaps that block
 * all future transactions.
 * 
 * Solution: Automatic gap detection, filling, and stuck transaction replacement.
 */
class ProductionNonceManager {
  constructor(wallet, provider, config = {}) {
    this.wallet = wallet;
    this.provider = provider;
    
    // ✅ EXPERT FIX: Chain-specific configuration
    this.chainConfig = {
      // BSC Mainnet
      56: {
        maxGasCap: ethers.parseUnits('20', 'gwei'), // BSC rarely exceeds 20 gwei
        normalGas: ethers.parseUnits('5', 'gwei'),
        name: 'BSC'
      },
      // Ethereum Mainnet
      1: {
        maxGasCap: ethers.parseUnits('500', 'gwei'),
        normalGas: ethers.parseUnits('50', 'gwei'),
        name: 'Ethereum'
      },
      // Polygon
      137: {
        maxGasCap: ethers.parseUnits('500', 'gwei'),
        normalGas: ethers.parseUnits('100', 'gwei'),
        name: 'Polygon'
      }
    };
    
    this.currentChainId = config.chainId || 56; // Default to BSC
    
    // Atomic nonce counter
    this.nonceBuffer = new SharedArrayBuffer(8);
    this.nonceView = new BigInt64Array(this.nonceBuffer);
    
    // Track pending transactions with metadata
    this.pendingTransactions = new Map(); // nonce → { txHash, timestamp, attempts, replacedTx }
    this.confirmedNonces = new Set();
    
    this.initialized = false;
    this.monitoringInterval = null;
    this.cleanupInterval = null;
    
    // Configuration
    this.config = {
      monitorInterval: 30000, // Check for gaps every 30 seconds
      stuckTransactionTimeout: 300000, // 5 minutes
      maxReplacementAttempts: 3,
      gasIncreaseMultiplier: 1.5, // 50% increase for replacement
      maxConfirmedNonces: 10000, // ✅ EXPERT FIX: Limit memory usage
      cleanupInterval: 300000, // ✅ EXPERT FIX: Cleanup every 5 minutes
      staleTransactionTimeout: 3600000 // 1 hour
    };
    
    // Metrics
    this.metrics = {
      noncesAllocated: 0,
      transactionsTracked: 0,
      transactionsConfirmed: 0,
      gapsDetected: 0,
      gapsFilled: 0,
      stuckTransactionsReplaced: 0,
      replacementFailures: 0,
      memoryCleanups: 0,
      noncesCleanedUp: 0
    };
    
    logger.info('✅ Production Nonce Manager initialized (gap filling enabled)');
  }

  /**
   * Initialize from on-chain nonce
   */
  async initialize() {
    try {
      const onChainNonce = await this.wallet.getNonce('pending');
      Atomics.store(this.nonceView, 0, BigInt(onChainNonce));
      this.initialized = true;
      
      // Start background monitoring
      this.startNonceMonitoring();
      
      // ✅ EXPERT FIX: Start memory cleanup
      this.startMemoryCleanup();
      
      logger.info(`✅ Nonce Manager initialized: starting nonce = ${onChainNonce}`);
      return onChainNonce;
      
    } catch (error) {
      logger.error('Failed to initialize nonce manager:', error);
      throw error;
    }
  }

  /**
   * Get next nonce atomically
   */
  getNextNonce() {
    if (!this.initialized) {
      throw new Error('NonceManager not initialized. Call initialize() first.');
    }
    
    // Atomic increment and get previous value
    const nonce = Atomics.add(this.nonceView, 0, 1n);
    const nonceNumber = Number(nonce);
    
    this.metrics.noncesAllocated++;
    
    logger.debug(`Allocated nonce: ${nonceNumber}`);
    return nonceNumber;
  }

  /**
   * ✅ NEW: Get specific nonce for replacement transaction
   */
  getNonceForReplacement(originalTxHash) {
    // Find original nonce
    for (const [nonce, data] of this.pendingTransactions) {
      if (data.txHash === originalTxHash || data.replacedTx === originalTxHash) {
        logger.info(`Found nonce ${nonce} for replacement of tx ${originalTxHash}`);
        return nonce; // Return SAME nonce for replacement
      }
    }
    
    throw new Error(`Original transaction ${originalTxHash} not found in pending transactions`);
  }

  /**
   * Track transaction with metadata
   */
  trackTransaction(nonce, txHash) {
    this.pendingTransactions.set(nonce, {
      txHash,
      timestamp: Date.now(),
      attempts: 1,
      replacedTx: null
    });
    
    this.metrics.transactionsTracked++;
    logger.debug(`Tracking transaction ${txHash} with nonce ${nonce}`);
  }

  /**
   * Confirm transaction
   * ✅ EXPERT FIX: Added memory limit enforcement
   */
  confirmTransaction(nonce) {
    const data = this.pendingTransactions.get(nonce);
    
    if (data) {
      logger.info(`Transaction confirmed: ${data.txHash} (nonce ${nonce})`);
      this.pendingTransactions.delete(nonce);
      this.confirmedNonces.add(nonce);
      this.metrics.transactionsConfirmed++;
      
      // ✅ EXPERT FIX: Trim if Set gets too large
      if (this.confirmedNonces.size > this.config.maxConfirmedNonces) {
        const sorted = Array.from(this.confirmedNonces).sort((a, b) => a - b);
        const toRemove = sorted.slice(0, sorted.length - this.config.maxConfirmedNonces);
        
        toRemove.forEach(n => this.confirmedNonces.delete(n));
        
        logger.debug(`Trimmed confirmedNonces: removed ${toRemove.length} old entries`);
      }
    }
  }

  /**
   * ✅ CRITICAL: Start background monitoring for gaps and stuck transactions
   */
  startNonceMonitoring() {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }
    
    logger.info(`Starting nonce monitoring (every ${this.config.monitorInterval / 1000}s)`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.detectAndFillGaps();
        await this.checkStuckTransactions();
      } catch (error) {
        logger.error('Error in nonce monitoring:', error);
      }
    }, this.config.monitorInterval);
  }

  /**
   * Stop monitoring
   */
  stopNonceMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Nonce monitoring stopped');
    }
  }

  /**
   * ✅ CRITICAL: Detect and fill nonce gaps
   */
  async detectAndFillGaps() {
    try {
      const onChainNonce = await this.wallet.getNonce('pending');
      const localNonce = this.getCurrentNonce();
      
      if (onChainNonce < localNonce) {
        // We have allocated nonces ahead of the chain = possible gap
        logger.warn(`Potential nonce gap: chain=${onChainNonce}, local=${localNonce}`);
        this.metrics.gapsDetected++;
        
        // Find all missing nonces
        const gaps = [];
        for (let n = onChainNonce; n < localNonce; n++) {
          if (!this.pendingTransactions.has(n) && !this.confirmedNonces.has(n)) {
            gaps.push(n);
          }
        }
        
        if (gaps.length > 0) {
          logger.warn(`Found ${gaps.length} nonce gap(s):`, gaps);
          
          // Fill gaps
          for (const gapNonce of gaps) {
            await this.fillNonceGap(gapNonce);
          }
        } else {
          logger.info('No actual gaps found - all nonces are tracked');
        }
      }
    } catch (error) {
      logger.error('Error detecting nonce gaps:', error);
    }
  }

  /**
   * ✅ CRITICAL: Fill a specific nonce gap with 0-value transaction
   */
  async fillNonceGap(gapNonce) {
    logger.warn(`🔧 Filling nonce gap at ${gapNonce}`);
    
    try {
      // Get current fee data
      const feeData = await this.provider.getFeeData();
      
      // Send 0-value transaction to self with the missing nonce
      const tx = await this.wallet.sendTransaction({
        to: this.wallet.address,
        value: 0,
        nonce: gapNonce,
        gasLimit: 21000,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      });
      
      logger.info(`✅ Gap-fill transaction sent: ${tx.hash} for nonce ${gapNonce}`);
      
      // Track this transaction
      this.trackTransaction(gapNonce, tx.hash);
      
      // Wait for confirmation (don't block)
      tx.wait(1).then(() => {
        logger.info(`✅ Nonce gap ${gapNonce} filled successfully`);
        this.confirmedNonces.add(gapNonce);
        this.metrics.gapsFilled++;
      }).catch(error => {
        logger.error(`Failed to confirm gap-fill transaction for nonce ${gapNonce}:`, error);
      });
      
    } catch (error) {
      logger.error(`Failed to fill nonce gap ${gapNonce}:`, error);
      throw error;
    }
  }

  /**
   * ✅ CRITICAL: Check for stuck transactions and replace them
   */
  async checkStuckTransactions() {
    const now = Date.now();
    
    for (const [nonce, data] of this.pendingTransactions) {
      const age = now - data.timestamp;
      
      if (age > this.config.stuckTransactionTimeout) {
        logger.warn(`Transaction stuck for ${Math.floor(age / 1000)}s:`, {
          nonce,
          txHash: data.txHash,
          attempts: data.attempts
        });
        
        // Check if we've exceeded max replacement attempts
        if (data.attempts >= this.config.maxReplacementAttempts) {
          logger.error(`Max replacement attempts (${this.config.maxReplacementAttempts}) exceeded for nonce ${nonce}`);
          this.metrics.replacementFailures++;
          continue;
        }
        
        // Try to replace with higher gas
        await this.replaceStuckTransaction(nonce, data.txHash);
      }
    }
  }

  /**
   * ✅ CRITICAL: Replace stuck transaction with higher gas
   * ✅ EXPERT FIX: Added dynamic gas calculation
   */
  async replaceStuckTransaction(nonce, originalTxHash) {
    try {
      logger.info(`🔧 Replacing stuck transaction ${originalTxHash} (nonce ${nonce})`);
      
      // Get original transaction's gas
      const originalTx = await this.provider.getTransaction(originalTxHash);
      const currentGas = await this.provider.getGasPrice();
      const feeData = await this.provider.getFeeData();
      
      // ✅ EXPERT FIX: Dynamic gas calculation
      // Strategy: Use higher of 1.5x original OR 1.2x current market
      const originalGas = originalTx.maxFeePerGas || originalTx.gasPrice || feeData.maxFeePerGas;
      
      let newMaxFee;
      if (originalGas > currentGas) {
        // Original was high, increase by 50%
        newMaxFee = (originalGas * 150n) / 100n;
        logger.debug(`Using 1.5x original gas: ${ethers.formatUnits(originalGas, 'gwei')} → ${ethers.formatUnits(newMaxFee, 'gwei')} gwei`);
      } else {
        // Market increased, use 1.2x current market
        newMaxFee = (currentGas * 120n) / 100n;
        logger.debug(`Using 1.2x current market gas: ${ethers.formatUnits(currentGas, 'gwei')} → ${ethers.formatUnits(newMaxFee, 'gwei')} gwei`);
      }
      
      // ✅ EXPERT FIX: Chain-specific gas cap
      const chainConfig = this.chainConfig[this.currentChainId] || this.chainConfig[56];
      const maxCap = chainConfig.maxGasCap;
      
      if (newMaxFee > maxCap) {
        logger.warn(`Capping gas at ${ethers.formatUnits(maxCap, 'gwei')} gwei for ${chainConfig.name} (calculated: ${ethers.formatUnits(newMaxFee, 'gwei')} gwei)`);
        newMaxFee = maxCap;
      }
      
      // ✅ EXPERT FIX: Sanity check - reject if 10x normal gas
      if (newMaxFee > chainConfig.normalGas * 10n) {
        logger.error(`🚨 Gas price is 10x normal for ${chainConfig.name} - possible network issue or attack`, {
          newGas: ethers.formatUnits(newMaxFee, 'gwei'),
          normalGas: ethers.formatUnits(chainConfig.normalGas, 'gwei'),
          chain: chainConfig.name
        });
        throw new Error(`Gas price too high (${ethers.formatUnits(newMaxFee, 'gwei')} gwei) - aborting replacement`);
      }
      
      // Calculate priority fee (10% of max fee)
      const newPriorityFee = newMaxFee / 10n;
      
      logger.info(`Replacement gas: ${ethers.formatUnits(newMaxFee, 'gwei')} gwei`, {
        originalGas: ethers.formatUnits(originalGas, 'gwei'),
        currentMarket: ethers.formatUnits(currentGas, 'gwei'),
        newGas: ethers.formatUnits(newMaxFee, 'gwei')
      });
      
      // Send replacement transaction (0-value to self)
      const tx = await this.wallet.sendTransaction({
        to: this.wallet.address,
        value: 0,
        nonce: nonce,
        gasLimit: 21000,
        maxFeePerGas: newMaxFee,
        maxPriorityFeePerGas: newPriorityFee
      });
      
      logger.info(`✅ Replacement transaction sent: ${tx.hash} (replacing ${originalTxHash})`);
      
      // Update tracking
      const oldData = this.pendingTransactions.get(nonce);
      this.pendingTransactions.set(nonce, {
        txHash: tx.hash,
        timestamp: Date.now(),
        attempts: (oldData?.attempts || 0) + 1,
        replacedTx: originalTxHash,
        gasUsed: newMaxFee
      });
      
      this.metrics.stuckTransactionsReplaced++;
      
      // ✅ EXPERT FIX: Improved error logging
      // Wait for confirmation (don't block)
      tx.wait(1).then(() => {
        logger.info(`✅ Replacement transaction confirmed: ${tx.hash}`);
        this.confirmTransaction(nonce);
      }).catch(error => {
        logger.error(`Replacement transaction failed (non-critical):`, {
          operation: 'replacement-confirmation',
          error: error.message,
          txHash: tx.hash,
          nonce
        });
        this.metrics.replacementFailures++;
      });
      
    } catch (error) {
      logger.error(`Failed to replace stuck transaction:`, {
        operation: 'transaction-replacement',
        error: error.message,
        stack: error.stack,
        nonce,
        originalTxHash
      });
      this.metrics.replacementFailures++;
    }
  }

  /**
   * Sync with blockchain (if nonces got out of sync)
   */
  async syncWithChain() {
    try {
      const onChainNonce = await this.wallet.getNonce('pending');
      const localNonce = this.getCurrentNonce();
      
      if (onChainNonce !== localNonce) {
        logger.warn(`Nonce mismatch detected: local=${localNonce}, chain=${onChainNonce}`);
        
        if (onChainNonce > localNonce) {
          // Chain is ahead - some transactions confirmed that we didn't track
          logger.warn(`Chain is ahead by ${onChainNonce - localNonce} nonces - updating local`);
          Atomics.store(this.nonceView, 0, BigInt(onChainNonce));
        } else {
          // We're ahead - check for gaps
          logger.warn(`Local is ahead by ${localNonce - onChainNonce} nonces - checking for gaps`);
          await this.detectAndFillGaps();
        }
        
        return { synced: true, oldNonce: localNonce, newNonce: onChainNonce };
      }
      
      return { synced: false, nonce: localNonce };
      
    } catch (error) {
      logger.error('Failed to sync nonce with chain:', error);
      throw error;
    }
  }

  /**
   * Get current nonce (without incrementing)
   */
  getCurrentNonce() {
    if (!this.initialized) {
      return null;
    }
    
    return Number(Atomics.load(this.nonceView, 0));
  }

  /**
   * Get all pending nonces
   */
  getPendingNonces() {
    return Array.from(this.pendingTransactions.keys()).sort((a, b) => a - b);
  }

  /**
   * Check if nonce is pending
   */
  isPending(nonce) {
    return this.pendingTransactions.has(nonce);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      currentNonce: this.getCurrentNonce(),
      pendingCount: this.pendingTransactions.size,
      pendingNonces: this.getPendingNonces(),
      confirmedCount: this.confirmedNonces.size,
      monitoring: !!this.monitoringInterval,
      metrics: this.metrics
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        reason: 'Not initialized'
      };
    }
    
    try {
      const syncResult = await this.syncWithChain();
      const pendingCount = this.pendingTransactions.size;
      
      // Check for excessive pending transactions
      if (pendingCount > 50) {
        return {
          status: 'degraded',
          reason: `Too many pending transactions: ${pendingCount}`,
          currentNonce: this.getCurrentNonce(),
          pendingCount
        };
      }
      
      // Check if synced
      if (syncResult.synced) {
        return {
          status: 'warning',
          reason: 'Nonce was out of sync (now synced)',
          syncResult,
          currentNonce: this.getCurrentNonce(),
          pendingCount
        };
      }
      
      return {
        status: 'healthy',
        currentNonce: this.getCurrentNonce(),
        pendingCount,
        gapsFilled: this.metrics.gapsFilled,
        stuckTransactionsReplaced: this.metrics.stuckTransactionsReplaced
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * ✅ EXPERT FIX: Start memory cleanup
   */
  startMemoryCleanup() {
    if (this.cleanupInterval) {
      return; // Already running
    }
    
    logger.info(`Starting memory cleanup (every ${this.config.cleanupInterval / 1000}s)`);
    
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        logger.error('Error in memory cleanup:', {
          operation: 'memory-cleanup',
          error: error.message
        });
      }
    }, this.config.cleanupInterval);
  }

  /**
   * ✅ EXPERT FIX: Memory cleanup implementation
   */
  cleanup() {
    const startSize = {
      confirmed: this.confirmedNonces.size,
      pending: this.pendingTransactions.size
    };
    
    const currentNonce = this.getCurrentNonce();
    
    // Remove old confirmed nonces (>1000 behind current)
    let removedConfirmed = 0;
    for (const nonce of this.confirmedNonces) {
      if (nonce < currentNonce - 1000) {
        this.confirmedNonces.delete(nonce);
        removedConfirmed++;
      }
    }
    
    // Clean up stale pending transactions (>1 hour old)
    const now = Date.now();
    let removedPending = 0;
    
    for (const [nonce, data] of this.pendingTransactions) {
      const age = now - data.timestamp;
      
      if (age > this.config.staleTransactionTimeout) {
        logger.warn(`Removing stale pending transaction:`, {
          nonce,
          txHash: data.txHash,
          age: Math.floor(age / 60000) + ' minutes',
          attempts: data.attempts
        });
        
        this.pendingTransactions.delete(nonce);
        removedPending++;
      }
    }
    
    this.metrics.memoryCleanups++;
    this.metrics.noncesCleanedUp += removedConfirmed + removedPending;
    
    if (removedConfirmed > 0 || removedPending > 0) {
      logger.info('Memory cleanup complete:', {
        confirmedNonces: {
          before: startSize.confirmed,
          after: this.confirmedNonces.size,
          removed: removedConfirmed
        },
        pendingTransactions: {
          before: startSize.pending,
          after: this.pendingTransactions.size,
          removed: removedPending
        },
        totalCleanups: this.metrics.memoryCleanups
      });
    } else {
      logger.debug('Memory cleanup: no items to remove');
    }
  }

  /**
   * Stop memory cleanup
   */
  stopMemoryCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Memory cleanup stopped');
    }
  }

  /**
   * Shutdown
   */
  async shutdown() {
    logger.info('Shutting down Nonce Manager...');
    
    this.stopNonceMonitoring();
    this.stopMemoryCleanup();
    
    // Log final stats
    logger.info('Nonce Manager final stats:', this.getStats());
    
    logger.info('✅ Nonce Manager shut down');
  }
}

module.exports = ProductionNonceManager;

