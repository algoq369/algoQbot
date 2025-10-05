const { ethers } = require('ethers');
const logger = require('../logger');

/**
 * Approval Manager for DEX Trading
 * 
 * Manages token approvals to prevent race conditions and unnecessary
 * on-chain transactions. Caches approval status and coordinates
 * approval requests across multiple threads.
 */
class ApprovalManager {
  constructor(wallet, provider) {
    this.wallet = wallet;
    this.provider = provider;
    
    // Cache: "token:spender" -> approved
    this.approvals = new Map();
    
    // Pending approvals: "token:spender" -> Promise
    this.pendingApprovals = new Map();
    
    // Metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      approvalsExecuted: 0,
      approvalsFailed: 0,
      racesAvoided: 0
    };
    
    // Standard ERC20 ABI for approve and allowance
    this.erc20Abi = [
      'function approve(address spender, uint256 amount) public returns (bool)',
      'function allowance(address owner, address spender) public view returns (uint256)'
    ];
    
    logger.info('✅ Approval Manager created');
  }

  /**
   * Generate cache key
   */
  getCacheKey(token, spender) {
    return `${token.toLowerCase()}:${spender.toLowerCase()}`;
  }

  /**
   * Ensure token is approved for spender
   * 
   * This method is thread-safe and prevents duplicate approval transactions.
   */
  async ensureApproval(tokenAddress, spenderAddress, requiredAmount) {
    const key = this.getCacheKey(tokenAddress, spenderAddress);
    
    // Check cache first
    if (this.approvals.get(key) === true) {
      logger.debug(`Approval cache hit: ${key}`);
      this.metrics.cacheHits++;
      return { approved: true, fromCache: true };
    }
    
    this.metrics.cacheMisses++;
    
    // Check if approval already pending from another thread
    if (this.pendingApprovals.has(key)) {
      logger.info(`Approval already pending for ${key}, waiting...`);
      this.metrics.racesAvoided++;
      
      try {
        await this.pendingApprovals.get(key);
        return { approved: true, fromPending: true };
      } catch (error) {
        logger.error(`Pending approval failed for ${key}:`, error);
        throw error;
      }
    }
    
    // We need to check/request approval
    const approvalPromise = this._executeApproval(tokenAddress, spenderAddress, requiredAmount);
    this.pendingApprovals.set(key, approvalPromise);
    
    try {
      const result = await approvalPromise;
      
      // Cache successful approval
      if (result.approved) {
        this.approvals.set(key, true);
      }
      
      return result;
      
    } finally {
      // Remove from pending
      this.pendingApprovals.delete(key);
    }
  }

  /**
   * Execute approval (internal)
   */
  async _executeApproval(tokenAddress, spenderAddress, requiredAmount) {
    try {
      // Get token contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        this.erc20Abi,
        this.wallet
      );
      
      // Check current allowance
      logger.debug(`Checking allowance: ${tokenAddress} for ${spenderAddress}`);
      const currentAllowance = await tokenContract.allowance(
        this.wallet.address,
        spenderAddress
      );
      
      logger.info(`Current allowance: ${ethers.formatUnits(currentAllowance, 18)} tokens`);
      
      // Check if already approved
      if (currentAllowance >= requiredAmount) {
        logger.info(`✅ Already approved: ${tokenAddress} for ${spenderAddress}`);
        return { approved: true, txHash: null, alreadyApproved: true };
      }
      
      // Need to approve
      logger.info(`Approving ${tokenAddress} for ${spenderAddress}...`);
      
      // Approve max uint256 to avoid future approvals
      const maxApproval = ethers.MaxUint256;
      
      const tx = await tokenContract.approve(spenderAddress, maxApproval);
      logger.info(`Approval transaction sent: ${tx.hash}`);
      
      // Wait for 2 confirmations
      const receipt = await tx.wait(2);
      
      if (receipt.status === 1) {
        logger.info(`✅ Approval confirmed: ${tx.hash}`);
        this.metrics.approvalsExecuted++;
        return { approved: true, txHash: tx.hash, receipt };
      } else {
        logger.error(`❌ Approval transaction failed: ${tx.hash}`);
        this.metrics.approvalsFailed++;
        throw new Error(`Approval transaction failed: ${tx.hash}`);
      }
      
    } catch (error) {
      logger.error(`Error executing approval for ${tokenAddress}:`, error);
      this.metrics.approvalsFailed++;
      throw error;
    }
  }

  /**
   * Check if token is approved (doesn't modify state)
   */
  async checkApproval(tokenAddress, spenderAddress, requiredAmount) {
    const key = this.getCacheKey(tokenAddress, spenderAddress);
    
    // Check cache
    if (this.approvals.get(key) === true) {
      return true;
    }
    
    try {
      // Check on-chain
      const tokenContract = new ethers.Contract(
        tokenAddress,
        this.erc20Abi,
        this.provider
      );
      
      const allowance = await tokenContract.allowance(
        this.wallet.address,
        spenderAddress
      );
      
      const isApproved = allowance >= requiredAmount;
      
      // Update cache
      if (isApproved) {
        this.approvals.set(key, true);
      }
      
      return isApproved;
      
    } catch (error) {
      logger.error(`Error checking approval for ${tokenAddress}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(tokenAddress, spenderAddress) {
    const key = this.getCacheKey(tokenAddress, spenderAddress);
    this.approvals.delete(key);
    logger.debug(`Cache invalidated: ${key}`);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.approvals.clear();
    logger.info('✅ Approval cache cleared');
  }

  /**
   * Revoke approval (set to 0)
   */
  async revokeApproval(tokenAddress, spenderAddress) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        this.erc20Abi,
        this.wallet
      );
      
      logger.info(`Revoking approval: ${tokenAddress} for ${spenderAddress}`);
      
      const tx = await tokenContract.approve(spenderAddress, 0);
      const receipt = await tx.wait(2);
      
      if (receipt.status === 1) {
        logger.info(`✅ Approval revoked: ${tx.hash}`);
        
        // Update cache
        const key = this.getCacheKey(tokenAddress, spenderAddress);
        this.approvals.set(key, false);
        
        return { success: true, txHash: tx.hash };
      } else {
        throw new Error(`Revoke transaction failed: ${tx.hash}`);
      }
      
    } catch (error) {
      logger.error(`Error revoking approval for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get all cached approvals
   */
  getCachedApprovals() {
    const approvals = [];
    this.approvals.forEach((approved, key) => {
      const [token, spender] = key.split(':');
      approvals.push({ token, spender, approved });
    });
    return approvals;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      cachedApprovals: this.approvals.size,
      pendingApprovals: this.pendingApprovals.size,
      metrics: {
        ...this.metrics,
        cacheHitRate: this.metrics.cacheHits > 0
          ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      cachedApprovals: this.approvals.size,
      pendingApprovals: this.pendingApprovals.size,
      metrics: this.metrics
    };
  }

  /**
   * Batch approve multiple tokens for a spender
   */
  async batchApprove(approvals) {
    // approvals: Array<{ token, spender, amount }>
    const results = [];
    
    for (const { token, spender, amount } of approvals) {
      try {
        const result = await this.ensureApproval(token, spender, amount);
        results.push({ token, spender, success: true, result });
      } catch (error) {
        results.push({ token, spender, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = ApprovalManager;

