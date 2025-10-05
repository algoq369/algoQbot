const logger = require('../logger');

/**
 * Nonce Manager for High-Frequency Trading
 * 
 * Prevents nonce collision when sending multiple transactions simultaneously.
 * Uses atomic operations to ensure thread-safe nonce allocation.
 */
class NonceManager {
  constructor(wallet, provider) {
    this.wallet = wallet;
    this.provider = provider;
    
    // Atomic nonce counter
    this.nonceBuffer = new SharedArrayBuffer(8);
    this.nonceView = new BigInt64Array(this.nonceBuffer);
    
    // Initialize flag
    this.initialized = false;
    
    // Track pending transactions
    this.pendingNonces = new Set();
    
    // Metrics
    this.metrics = {
      noncesAllocated: 0,
      noncesReset: 0,
      collisionsAvoided: 0,
      syncedWithChain: 0
    };
    
    logger.info('✅ Nonce Manager created');
  }

  /**
   * Initialize from on-chain nonce
   */
  async initialize() {
    try {
      const onChainNonce = await this.wallet.getNonce('pending');
      Atomics.store(this.nonceView, 0, BigInt(onChainNonce));
      this.initialized = true;
      
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
      throw new Error('Nonce manager not initialized. Call initialize() first.');
    }
    
    // Atomic increment and get previous value
    const nonce = Atomics.add(this.nonceView, 0, 1n);
    const nonceNumber = Number(nonce);
    
    this.pendingNonces.add(nonceNumber);
    this.metrics.noncesAllocated++;
    
    logger.debug(`Allocated nonce: ${nonceNumber}`);
    return nonceNumber;
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
   * Reset nonce if transaction failed
   * 
   * CAUTION: Only use if you're certain the transaction with this nonce
   * will NOT be included in any block.
   */
  resetNonce(nonce) {
    if (!this.initialized) {
      throw new Error('Nonce manager not initialized');
    }
    
    const currentNonce = BigInt(nonce + 1);
    const previousNonce = BigInt(nonce);
    
    // Atomic compare-and-swap to reset
    const exchanged = Atomics.compareExchange(
      this.nonceView, 0,
      currentNonce,
      previousNonce
    );
    
    if (exchanged === currentNonce) {
      logger.info(`✅ Nonce reset: ${nonce + 1} → ${nonce}`);
      this.pendingNonces.delete(nonce);
      this.metrics.noncesReset++;
      return true;
    } else {
      logger.warn(`Failed to reset nonce ${nonce}, current is ${Number(exchanged)}`);
      return false;
    }
  }

  /**
   * Mark nonce as confirmed
   */
  confirmNonce(nonce) {
    this.pendingNonces.delete(nonce);
    logger.debug(`Confirmed nonce: ${nonce}`);
  }

  /**
   * Sync with blockchain (if nonces got out of sync)
   * 
   * This should be called periodically or after errors to ensure
   * the local nonce matches the blockchain.
   */
  async syncWithChain() {
    try {
      const onChainNonce = await this.wallet.getNonce('pending');
      const localNonce = this.getCurrentNonce();
      
      if (onChainNonce !== localNonce) {
        logger.warn(`Nonce mismatch detected: local=${localNonce}, chain=${onChainNonce}`);
        
        // Reset to chain nonce
        Atomics.store(this.nonceView, 0, BigInt(onChainNonce));
        
        // Clear pending nonces that are now invalid
        this.pendingNonces.clear();
        
        this.metrics.syncedWithChain++;
        logger.info(`✅ Synced nonce with chain: ${onChainNonce}`);
        
        return { synced: true, oldNonce: localNonce, newNonce: onChainNonce };
      }
      
      return { synced: false, nonce: localNonce };
      
    } catch (error) {
      logger.error('Failed to sync nonce with chain:', error);
      throw error;
    }
  }

  /**
   * Get all pending nonces
   */
  getPendingNonces() {
    return Array.from(this.pendingNonces).sort((a, b) => a - b);
  }

  /**
   * Check if nonce is pending
   */
  isPending(nonce) {
    return this.pendingNonces.has(nonce);
  }

  /**
   * Get nonce gap (if any transactions failed)
   */
  async checkForGaps() {
    const onChainNonce = await this.wallet.getNonce('pending');
    const localNonce = this.getCurrentNonce();
    
    if (localNonce > onChainNonce) {
      // We have nonces ahead of the chain, check for gaps
      const gaps = [];
      for (let n = onChainNonce; n < localNonce; n++) {
        if (!this.pendingNonces.has(n)) {
          gaps.push(n);
        }
      }
      
      if (gaps.length > 0) {
        logger.warn(`Nonce gaps detected: ${gaps.join(', ')}`);
        return { hasGaps: true, gaps };
      }
    }
    
    return { hasGaps: false, gaps: [] };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      currentNonce: this.getCurrentNonce(),
      pendingCount: this.pendingNonces.size,
      pendingNonces: this.getPendingNonces(),
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
      const gapResult = await this.checkForGaps();
      
      if (syncResult.synced || gapResult.hasGaps) {
        return {
          status: 'warning',
          synced: syncResult.synced,
          gaps: gapResult.gaps,
          currentNonce: this.getCurrentNonce(),
          pendingCount: this.pendingNonces.size
        };
      }
      
      return {
        status: 'healthy',
        currentNonce: this.getCurrentNonce(),
        pendingCount: this.pendingNonces.size
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Reset everything
   */
  async reset() {
    await this.initialize();
    this.pendingNonces.clear();
    this.metrics = {
      noncesAllocated: 0,
      noncesReset: 0,
      collisionsAvoided: 0,
      syncedWithChain: 0
    };
    logger.info('✅ Nonce Manager reset');
  }
}

module.exports = NonceManager;

