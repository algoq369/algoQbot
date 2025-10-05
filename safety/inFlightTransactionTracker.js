const logger = require('../logger');
const EventEmitter = require('events');

/**
 * In-Flight Transaction Tracker
 * 
 * Tracks all pending transactions in mempool to ensure
 * emergency kill switch waits for them to complete or cancel.
 * 
 * Critical for preventing orphaned transactions that execute
 * after emergency shutdown.
 */
class InFlightTransactionTracker extends EventEmitter {
  constructor(provider, options = {}) {
    super();
    
    this.provider = provider;
    this.options = {
      maxTrackingTime: options.maxTrackingTime || 300000, // 5 minutes
      checkInterval: options.checkInterval || 5000, // 5 seconds
      maxRetries: options.maxRetries || 60, // 5 minutes worth
      ...options
    };
    
    // Track in-flight transactions
    this.inFlightTxs = new Map(); // txHash -> { tx, startTime, status, attempts }
    this.completedTxs = new Map(); // Recently completed (for history)
    
    // Monitoring
    this.monitoringInterval = null;
    this.isMonitoring = false;
    
    logger.info('📡 In-Flight Transaction Tracker initialized');
  }

  /**
   * Start monitoring in-flight transactions
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this.checkInFlightTransactions();
    }, this.options.checkInterval);
    
    logger.info('✅ In-flight transaction monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    logger.info('✅ In-flight transaction monitoring stopped');
  }

  /**
   * Track a new transaction
   */
  trackTransaction(txHash, txData = {}) {
    const tracking = {
      txHash: txHash,
      tx: txData,
      startTime: Date.now(),
      status: 'pending',
      attempts: 0,
      lastCheck: null,
      error: null
    };
    
    this.inFlightTxs.set(txHash, tracking);
    
    logger.info(`📤 Tracking transaction: ${txHash}`);
    this.emit('transaction_tracked', tracking);
    
    return tracking;
  }

  /**
   * Check status of all in-flight transactions
   */
  async checkInFlightTransactions() {
    if (this.inFlightTxs.size === 0) {
      return;
    }
    
    logger.debug(`🔍 Checking ${this.inFlightTxs.size} in-flight transactions`);
    
    const promises = [];
    
    for (const [txHash, tracking] of this.inFlightTxs) {
      promises.push(this.checkTransaction(txHash, tracking));
    }
    
    await Promise.allSettled(promises);
    
    // Clean up old completed transactions
    this.cleanupCompleted();
  }

  /**
   * Check individual transaction status
   */
  async checkTransaction(txHash, tracking) {
    try {
      tracking.attempts++;
      tracking.lastCheck = Date.now();
      
      // Check if exceeded max tracking time
      const elapsed = Date.now() - tracking.startTime;
      if (elapsed > this.options.maxTrackingTime) {
        logger.warn(`⚠️ Transaction ${txHash} exceeded max tracking time, marking as timeout`);
        this.markTransactionComplete(txHash, 'timeout');
        return;
      }
      
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (receipt) {
        // Transaction mined
        const status = receipt.status === 1 ? 'success' : 'failed';
        logger.info(`✅ Transaction ${txHash} ${status} (block ${receipt.blockNumber})`);
        
        tracking.status = status;
        tracking.receipt = receipt;
        tracking.blockNumber = receipt.blockNumber;
        tracking.gasUsed = receipt.gasUsed;
        
        this.markTransactionComplete(txHash, status);
      } else {
        // Still pending, check if it's in mempool
        const tx = await this.provider.getTransaction(txHash);
        
        if (!tx) {
          // Transaction not found (might have been dropped)
          logger.warn(`⚠️ Transaction ${txHash} not found in mempool, might be dropped`);
          
          if (tracking.attempts > 5) {
            // After multiple attempts, mark as dropped
            this.markTransactionComplete(txHash, 'dropped');
          }
        } else {
          // Still pending
          logger.debug(`⏳ Transaction ${txHash} still pending (attempt ${tracking.attempts})`);
        }
      }
      
    } catch (error) {
      logger.error(`❌ Error checking transaction ${txHash}:`, error);
      tracking.error = error.message;
      
      // If too many errors, mark as failed
      if (tracking.attempts > this.options.maxRetries) {
        this.markTransactionComplete(txHash, 'error');
      }
    }
  }

  /**
   * Mark transaction as complete
   */
  markTransactionComplete(txHash, status) {
    const tracking = this.inFlightTxs.get(txHash);
    
    if (!tracking) {
      return;
    }
    
    tracking.status = status;
    tracking.completedAt = Date.now();
    tracking.duration = tracking.completedAt - tracking.startTime;
    
    // Move to completed
    this.completedTxs.set(txHash, tracking);
    this.inFlightTxs.delete(txHash);
    
    logger.info(`📥 Transaction ${txHash} completed with status: ${status}`);
    this.emit('transaction_completed', tracking);
  }

  /**
   * Wait for all in-flight transactions to complete
   * Critical for emergency shutdown
   */
  async waitForAllTransactions(timeout = 60000) {
    logger.info(`⏳ Waiting for ${this.inFlightTxs.size} in-flight transactions...`);
    
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second
    
    while (this.inFlightTxs.size > 0) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        logger.error(`⚠️ Timeout waiting for transactions. ${this.inFlightTxs.size} still pending.`);
        
        // Log pending transactions
        for (const [txHash, tracking] of this.inFlightTxs) {
          logger.error(`⚠️ Pending: ${txHash} (age: ${Date.now() - tracking.startTime}ms)`);
        }
        
        return false; // Timeout
      }
      
      // Check all transactions
      await this.checkInFlightTransactions();
      
      // Wait before next check
      if (this.inFlightTxs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    logger.info(`✅ All transactions completed (${Date.now() - startTime}ms)`);
    return true; // All complete
  }

  /**
   * Attempt to cancel all pending transactions
   * Used during emergency shutdown
   */
  async cancelAllPendingTransactions(wallet) {
    logger.warn(`🚫 Attempting to cancel ${this.inFlightTxs.size} pending transactions...`);
    
    const cancelPromises = [];
    
    for (const [txHash, tracking] of this.inFlightTxs) {
      if (tracking.status === 'pending') {
        cancelPromises.push(this.cancelTransaction(txHash, tracking, wallet));
      }
    }
    
    const results = await Promise.allSettled(cancelPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    logger.info(`✅ Cancelled ${successful}/${cancelPromises.length} transactions`);
    
    return successful;
  }

  /**
   * Cancel individual transaction by sending 0 ETH to self with same nonce
   */
  async cancelTransaction(txHash, tracking, wallet) {
    try {
      if (!tracking.tx || !tracking.tx.nonce) {
        logger.warn(`⚠️ Cannot cancel ${txHash}: missing nonce`);
        return false;
      }
      
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      
      // Send 0 ETH to self with higher gas price (to replace pending tx)
      const cancelTx = {
        to: wallet.address,
        value: 0,
        nonce: tracking.tx.nonce,
        gasLimit: 21000,
        maxFeePerGas: feeData.maxFeePerGas * 2n, // 2x to ensure replacement
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
      };
      
      const signedTx = await wallet.sendTransaction(cancelTx);
      logger.info(`🚫 Cancel transaction sent for ${txHash}: ${signedTx.hash}`);
      
      // Track the cancellation transaction
      this.trackTransaction(signedTx.hash, { type: 'cancellation', originalTx: txHash });
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to cancel transaction ${txHash}:`, error);
      return false;
    }
  }

  /**
   * Clean up old completed transactions
   */
  cleanupCompleted() {
    const maxAge = 3600000; // 1 hour
    const now = Date.now();
    
    for (const [txHash, tracking] of this.completedTxs) {
      if (now - tracking.completedAt > maxAge) {
        this.completedTxs.delete(txHash);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      inFlight: this.inFlightTxs.size,
      completed: this.completedTxs.size,
      isMonitoring: this.isMonitoring,
      transactions: {
        pending: Array.from(this.inFlightTxs.values()).filter(t => t.status === 'pending').length,
        success: Array.from(this.completedTxs.values()).filter(t => t.status === 'success').length,
        failed: Array.from(this.completedTxs.values()).filter(t => t.status === 'failed').length,
        dropped: Array.from(this.completedTxs.values()).filter(t => t.status === 'dropped').length,
        timeout: Array.from(this.completedTxs.values()).filter(t => t.status === 'timeout').length
      }
    };
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions() {
    return Array.from(this.inFlightTxs.values());
  }

  /**
   * Health check
   */
  healthCheck() {
    const stats = this.getStats();
    const healthy = stats.inFlight < 100; // Warning if too many pending
    
    return {
      status: healthy ? 'healthy' : 'warning',
      pendingCount: stats.inFlight,
      isMonitoring: this.isMonitoring,
      stats: stats
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('📡 Shutting down transaction tracker...');
    
    this.stopMonitoring();
    
    // Wait for pending transactions (with timeout)
    await this.waitForAllTransactions(30000);
    
    logger.info('✅ Transaction tracker shutdown complete');
  }
}

module.exports = InFlightTransactionTracker;

