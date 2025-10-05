const { ethers } = require('ethers');
const logger = require('../logger');

/**
 * Efficient Transaction Scanner
 * 
 * Uses event logs instead of sequential block scanning for significant performance improvement.
 * - ERC20 tokens: 1 RPC call (event logs) vs 1000+ calls (block scanning)
 * - Native currency: Limited to recent 100 blocks only
 */
class EfficientTransactionScanner {
  constructor(wallet, provider) {
    this.wallet = wallet;
    this.provider = provider;
    this.metrics = {
      erc20ScansCompleted: 0,
      nativeScansCompleted: 0,
      transactionsFound: 0,
      averageScanTime: 0,
      rpcCallsSaved: 0 // Compared to sequential scanning
    };
  }

  /**
   * Find missing transactions efficiently
   * ✅ EXPERT FIX: Added RPC fallback for event logs
   * @param {string} token - Token symbol (e.g., 'USDT', 'BNB')
   * @param {string} tokenAddress - Token contract address (null for native currency)
   * @param {number} startBlock - Starting block number
   * @param {number} endBlock - Ending block number
   * @returns {Promise<Array>} Array of missing transaction hashes
   */
  async findMissingTransactions(token, tokenAddress, startBlock, endBlock) {
    const scanStartTime = Date.now();
    
    try {
      let missingTxs;
      
      if (tokenAddress) {
        // ERC20 token - use event logs (fast) with fallback
        try {
          missingTxs = await this.scanERC20Events(tokenAddress, startBlock, endBlock);
          this.metrics.erc20ScansCompleted++;
          
          // Calculate RPC calls saved
          const blockRange = endBlock - startBlock;
          this.metrics.rpcCallsSaved += blockRange - 2; // 2 calls for event logs vs N calls for blocks
          
        } catch (eventLogError) {
          // ✅ EXPERT FIX: Fallback to sequential scanning if event logs fail
          if (this.isRPCError(eventLogError)) {
            logger.warn('Event logs failed, falling back to block scanning', {
              error: eventLogError.message,
              token,
              tokenAddress
            });
            
            // Limit fallback to 100 blocks to avoid timeout
            const fallbackBlocks = Math.min(endBlock - startBlock, 100);
            const fallbackStartBlock = endBlock - fallbackBlocks;
            
            missingTxs = await this.fallbackBlockScan(tokenAddress, fallbackStartBlock, endBlock);
            this.metrics.fallbackScansUsed = (this.metrics.fallbackScansUsed || 0) + 1;
          } else {
            throw eventLogError; // Not an RPC error, rethrow
          }
        }
        
      } else {
        // Native currency - scan only recent blocks
        const recentBlocks = Math.min(endBlock - startBlock, 100);
        const recentStartBlock = endBlock - recentBlocks;
        
        logger.info(`Scanning native currency transactions (limited to ${recentBlocks} blocks)`);
        
        missingTxs = await this.scanNativeTransactions(recentStartBlock, endBlock);
        this.metrics.nativeScansCompleted++;
      }
      
      const scanDuration = Date.now() - scanStartTime;
      this.metrics.averageScanTime = (this.metrics.averageScanTime + scanDuration) / 2;
      this.metrics.transactionsFound += missingTxs.length;
      
      logger.info(`Transaction scan completed in ${scanDuration}ms`, {
        token,
        tokenAddress: tokenAddress || 'NATIVE',
        blockRange: `${startBlock}-${endBlock}`,
        transactionsFound: missingTxs.length
      });
      
      return missingTxs;
      
    } catch (error) {
      logger.error('Transaction scan failed:', error);
      throw error;
    }
  }

  /**
   * ✅ EXPERT FIX: Check if error is RPC-related
   */
  isRPCError(error) {
    const rpcErrors = [
      'logs',
      'SERVER_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR',
      'CALL_EXCEPTION',
      'eth_getLogs'
    ];
    
    const errorMessage = error.message || error.toString();
    return rpcErrors.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * ✅ EXPERT FIX: Fallback block scanning method
   */
  async fallbackBlockScan(tokenAddress, startBlock, endBlock) {
    logger.info(`Fallback: Scanning ${endBlock - startBlock} blocks sequentially`);
    
    const txHashes = new Set();
    const batchSize = 10; // Process 10 blocks at a time
    
    for (let block = startBlock; block <= endBlock; block += batchSize) {
      const batchEnd = Math.min(block + batchSize - 1, endBlock);
      
      try {
        const blockPromises = [];
        for (let b = block; b <= batchEnd; b++) {
          blockPromises.push(this.provider.getBlock(b, true));
        }
        
        const blocks = await Promise.all(blockPromises);
        
        for (const blockData of blocks) {
          if (!blockData || !blockData.transactions) continue;
          
          for (const txHash of blockData.transactions) {
            const tx = await this.provider.getTransaction(txHash);
            
            if (tx && tx.to && tx.to.toLowerCase() === tokenAddress.toLowerCase()) {
              // Transaction interacts with our token
              if (tx.from?.toLowerCase() === this.wallet.address.toLowerCase() ||
                  tx.to?.toLowerCase() === this.wallet.address.toLowerCase()) {
                txHashes.add(txHash);
              }
            }
          }
        }
      } catch (batchError) {
        logger.error(`Fallback scan failed for blocks ${block}-${batchEnd}:`, batchError);
      }
    }
    
    return Array.from(txHashes);
  }

  /**
   * Scan ERC20 token transfers using event logs (FAST - 1-2 RPC calls)
   * ✅ EXPERT FIX: Added Approval event tracking
   * @param {string} tokenAddress - Token contract address
   * @param {number} startBlock - Starting block
   * @param {number} endBlock - Ending block
   * @returns {Promise<Array>} Array of transaction hashes
   */
  async scanERC20Events(tokenAddress, startBlock, endBlock) {
    try {
      // Pad wallet address to 32 bytes for topic filtering
      const paddedWalletAddress = ethers.zeroPadValue(this.wallet.address, 32);
      
      // Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      
      // ✅ EXPERT FIX: Approval event signature: Approval(address indexed owner, address indexed spender, uint256 value)
      const approvalTopic = ethers.id('Approval(address,address,uint256)');
      
      // Query 1: Transfers FROM our wallet
      const outboundFilter = {
        address: tokenAddress,
        topics: [
          transferTopic,
          paddedWalletAddress, // from = our wallet
          null // to = any address
        ],
        fromBlock: startBlock,
        toBlock: endBlock
      };
      
      // Query 2: Transfers TO our wallet
      const inboundFilter = {
        address: tokenAddress,
        topics: [
          transferTopic,
          null, // from = any address
          paddedWalletAddress // to = our wallet
        ],
        fromBlock: startBlock,
        toBlock: endBlock
      };
      
      // ✅ EXPERT FIX: Query 3: Approvals from our wallet (tracks allowance changes)
      const approvalFilter = {
        address: tokenAddress,
        topics: [
          approvalTopic,
          paddedWalletAddress, // owner = our wallet
          null // spender = any address
        ],
        fromBlock: startBlock,
        toBlock: endBlock
      };
      
      logger.debug('Fetching Transfer and Approval events...', {
        tokenAddress,
        blockRange: `${startBlock}-${endBlock}`
      });
      
      // ✅ EXPERT FIX: Fetch all three in parallel
      const [outboundLogs, inboundLogs, approvalLogs] = await Promise.all([
        this.provider.getLogs(outboundFilter),
        this.provider.getLogs(inboundFilter),
        this.provider.getLogs(approvalFilter)
      ]);
      
      // Combine and deduplicate transaction hashes
      const allLogs = [...outboundLogs, ...inboundLogs, ...approvalLogs];
      const uniqueTxHashes = [...new Set(allLogs.map(log => log.transactionHash))];
      
      logger.debug(`Found ${uniqueTxHashes.length} unique transactions in event logs`, {
        outboundEvents: outboundLogs.length,
        inboundEvents: inboundLogs.length,
        approvalEvents: approvalLogs.length,
        uniqueTransactions: uniqueTxHashes.length
      });
      
      return uniqueTxHashes;
      
    } catch (error) {
      logger.error('ERC20 event scanning failed:', error);
      
      // Fallback: scan recent blocks only if event log query fails
      logger.warn('Falling back to limited block scanning');
      const recentBlocks = Math.min(endBlock - startBlock, 100);
      return await this.scanNativeTransactions(endBlock - recentBlocks, endBlock);
    }
  }

  /**
   * Scan native currency transactions (SLOW - only use for recent blocks)
   * @param {number} startBlock - Starting block
   * @param {number} endBlock - Ending block
   * @returns {Promise<Array>} Array of transaction hashes
   */
  async scanNativeTransactions(startBlock, endBlock) {
    const transactions = [];
    const blockRange = endBlock - startBlock;
    
    if (blockRange > 100) {
      logger.warn(`Native transaction scan range limited to 100 blocks (requested: ${blockRange})`);
    }
    
    try {
      // Process blocks in batches for efficiency
      const batchSize = 10;
      const batches = [];
      
      for (let block = startBlock; block <= endBlock; block += batchSize) {
        const batchEnd = Math.min(block + batchSize - 1, endBlock);
        batches.push({ start: block, end: batchEnd });
      }
      
      logger.debug(`Scanning ${batches.length} batches of blocks...`);
      
      // Process batches in parallel (limited concurrency)
      for (let i = 0; i < batches.length; i += 3) {
        const batchGroup = batches.slice(i, i + 3);
        
        const results = await Promise.all(
          batchGroup.map(batch => this.scanBlockBatch(batch.start, batch.end))
        );
        
        results.forEach(batchTxs => transactions.push(...batchTxs));
      }
      
      logger.debug(`Native scan found ${transactions.length} transactions in ${blockRange} blocks`);
      
      return transactions;
      
    } catch (error) {
      logger.error('Native transaction scanning failed:', error);
      throw error;
    }
  }

  /**
   * Scan a batch of blocks for transactions involving our wallet
   * @param {number} startBlock - Starting block
   * @param {number} endBlock - Ending block
   * @returns {Promise<Array>} Array of transaction hashes
   */
  async scanBlockBatch(startBlock, endBlock) {
    const transactions = [];
    
    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      try {
        const block = await this.provider.getBlock(blockNum, true);
        
        if (!block || !block.transactions) {
          continue;
        }
        
        // Check each transaction
        for (const tx of block.transactions) {
          if (tx.from === this.wallet.address || tx.to === this.wallet.address) {
            transactions.push(tx.hash);
          }
        }
        
      } catch (error) {
        logger.warn(`Failed to fetch block ${blockNum}:`, error.message);
      }
    }
    
    return transactions;
  }

  /**
   * Decode Transfer event log
   * @param {Object} log - Event log
   * @returns {Object} Decoded transfer data
   */
  decodeTransferLog(log) {
    try {
      const iface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)'
      ]);
      
      const decoded = iface.parseLog(log);
      
      return {
        from: decoded.args.from,
        to: decoded.args.to,
        value: decoded.args.value.toString(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash
      };
      
    } catch (error) {
      logger.error('Failed to decode Transfer log:', error);
      return null;
    }
  }

  /**
   * Get metrics
   * @returns {Object} Scanner metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      efficiency: this.metrics.rpcCallsSaved > 0 
        ? `${Math.round((this.metrics.rpcCallsSaved / (this.metrics.rpcCallsSaved + this.metrics.erc20ScansCompleted * 2)) * 100)}% fewer RPC calls`
        : 'N/A'
    };
  }
}

module.exports = EfficientTransactionScanner;

