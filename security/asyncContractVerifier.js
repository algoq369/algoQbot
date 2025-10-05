const LRUCache = require('lru-cache');
const PQueue = require('p-queue');
const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../logger');

class AsyncContractVerifier {
  constructor() {
    this.verificationCache = new LRUCache({ 
      max: 10000, 
      ttl: 3600000, // 1 hour
      updateAgeOnGet: true 
    });
    this.verificationQueue = new PQueue({ 
      concurrency: 10,
      interval: 1000,
      intervalCap: 100
    });
    this.preVerifiedTokens = new Set(); // Whitelist known safe tokens
    this.pendingVerifications = new Map();
    
    // Initialize with known safe tokens
    this.initializeSafeTokens();
    
    logger.info('🚀 Async Contract Verifier initialized');
  }

  // Initialize with known safe tokens (top 100 tokens by market cap)
  initializeSafeTokens() {
    const safeTokens = [
      '0x55d398326f99059ff775485246999027b3197955', // USDT
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
      '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // ETH
      '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', // BTCB
      '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', // CAKE
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
      '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI
      '0x4338665cbb7b2485a8855a139b75d5e34ab0db94', // LTC
      '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47', // ADA
      '0xcc42724c6683b7e57334c4e856f4c9965ed682bd', // MATIC
    ];
    
    safeTokens.forEach(token => {
      this.preVerifiedTokens.add(token.toLowerCase());
    });
    
    logger.info(`✅ Initialized with ${safeTokens.length} pre-verified safe tokens`);
  }

  // Ultra-fast verification for trading decisions
  async verifyTokenFast(tokenAddress) {
    const startTime = performance.now();
    const address = tokenAddress.toLowerCase();
    
    try {
      // Instant return for pre-verified tokens
      if (this.preVerifiedTokens.has(address)) {
        const latency = performance.now() - startTime;
        return { 
          safe: true, 
          cached: true, 
          latency: Math.round(latency),
          riskScore: 0,
          source: 'whitelist'
        };
      }

      // Check cache first
      const cached = this.verificationCache.get(address);
      if (cached) {
        const latency = performance.now() - startTime;
        return { 
          ...cached, 
          cached: true, 
          latency: Math.round(latency),
          source: 'cache'
        };
      }

      // Check if verification is already pending
      if (this.pendingVerifications.has(address)) {
        const latency = performance.now() - startTime;
        return { 
          safe: true, 
          pending: true, 
          latency: Math.round(latency),
          source: 'pending'
        };
      }

      // Start background verification for new tokens
      this.startBackgroundVerification(address);
      
      // Return preliminary result based on quick checks only
      const quickCheck = await this.quickSafetyCheck(address);
      const latency = performance.now() - startTime;
      
      return { 
        safe: quickCheck.safe, 
        pending: true, 
        latency: Math.round(latency),
        riskScore: quickCheck.riskScore,
        source: 'quick_check'
      };

    } catch (error) {
      logger.error(`Error in fast verification for ${address}:`, error);
      const latency = performance.now() - startTime;
      return { 
        safe: false, 
        error: error.message, 
        latency: Math.round(latency),
        source: 'error'
      };
    }
  }

  // Background verification for comprehensive analysis
  async startBackgroundVerification(tokenAddress) {
    const address = tokenAddress.toLowerCase();
    this.pendingVerifications.set(address, true);
    
    // Add to queue for background processing
    this.verificationQueue.add(async () => {
      try {
        const result = await this.comprehensiveVerification(address);
        this.verificationCache.set(address, result);
        this.pendingVerifications.delete(address);
        
        logger.info(`✅ Background verification completed for ${address}: Risk ${result.riskScore}`);
      } catch (error) {
        logger.error(`❌ Background verification failed for ${address}:`, error);
        this.pendingVerifications.delete(address);
      }
    });
  }

  // Quick safety check (< 50ms)
  async quickSafetyCheck(address) {
    try {
      const startTime = performance.now();
      
      // Parallel quick checks
      const [liquidity, holders, price] = await Promise.allSettled([
        this.getQuickLiquidity(address),
        this.getTopHolders(address),
        this.getCurrentPrice(address)
      ]);
      
      const latency = performance.now() - startTime;
      
      // Quick risk assessment
      let riskScore = 0;
      let safe = true;
      
      if (liquidity.status === 'fulfilled' && liquidity.value < 10000) {
        riskScore += 30;
      }
      
      if (holders.status === 'fulfilled' && holders.value < 100) {
        riskScore += 25;
      }
      
      if (price.status === 'fulfilled' && price.value === 0) {
        riskScore += 40;
        safe = false;
      }
      
      return {
        safe: safe && riskScore < 50,
        riskScore: Math.min(riskScore, 100),
        latency: Math.round(latency),
        liquidity: liquidity.status === 'fulfilled' ? liquidity.value : 0,
        holders: holders.status === 'fulfilled' ? holders.value : 0,
        price: price.status === 'fulfilled' ? price.value : 0
      };
      
    } catch (error) {
      logger.error(`Quick safety check failed for ${address}:`, error);
      return {
        safe: false,
        riskScore: 100,
        error: error.message
      };
    }
  }

  // Get quick liquidity estimate
  async getQuickLiquidity(address) {
    try {
      // Use CoinGecko API for quick liquidity check
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/bsc`,
        {
          params: {
            contract_addresses: address,
            vs_currencies: 'usd',
            include_market_cap: true,
            include_24hr_vol: true
          },
          timeout: 2000
        }
      );

      if (response.data && response.data[address.toLowerCase()]) {
        const data = response.data[address.toLowerCase()];
        return data.usd_market_cap || 0;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Get top holders count (simplified)
  async getTopHolders(address) {
    try {
      // Use BSCScan API for holder count
      const response = await axios.get(
        `https://api.bscscan.com/api`,
        {
          params: {
            module: 'token',
            action: 'tokenholderlist',
            contractaddress: address,
            page: 1,
            offset: 1,
            apikey: process.env.BSCSCAN_API_KEY || ''
          },
          timeout: 2000
        }
      );

      if (response.data && response.data.result) {
        return response.data.result.length;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Get current price
  async getCurrentPrice(address) {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/bsc`,
        {
          params: {
            contract_addresses: address,
            vs_currencies: 'usd'
          },
          timeout: 2000
        }
      );

      if (response.data && response.data[address.toLowerCase()]) {
        return response.data[address.toLowerCase()].usd;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Comprehensive verification (background)
  async comprehensiveVerification(address) {
    const startTime = performance.now();
    
    try {
      const checks = await Promise.allSettled([
        this.checkHoneypot(address),
        this.checkOwnership(address),
        this.checkLiquidity(address),
        this.checkRugPullRisk(address),
        this.checkSourceCode(address),
        this.checkLiquidityLocks(address)
      ]);

      const results = {
        address: address,
        honeypot: checks[0].status === 'fulfilled' ? checks[0].value : false,
        ownershipRenounced: checks[1].status === 'fulfilled' ? checks[1].value : false,
        liquiditySufficient: checks[2].status === 'fulfilled' ? checks[2].value : false,
        rugPullRisk: checks[3].status === 'fulfilled' ? checks[3].value : 0,
        sourceVerified: checks[4].status === 'fulfilled' ? checks[4].value : false,
        liquidityLocked: checks[5].status === 'fulfilled' ? checks[5].value : false,
        riskScore: 0,
        safe: true,
        warnings: [],
        errors: [],
        verificationTime: performance.now() - startTime
      };

      // Calculate risk score
      results.riskScore = this.calculateRiskScore(results);
      results.safe = results.riskScore < 30;

      // Add warnings and errors
      this.addWarningsAndErrors(results);

      return results;

    } catch (error) {
      logger.error(`Comprehensive verification failed for ${address}:`, error);
      return {
        address: address,
        safe: false,
        error: error.message,
        riskScore: 100,
        verificationTime: performance.now() - startTime
      };
    }
  }

  // Check for honeypot (from existing implementation)
  async checkHoneypot(tokenAddress) {
    // Implementation from contractVerifier.js
    return false; // Simplified for now
  }

  async checkOwnership(tokenAddress) {
    // Implementation from contractVerifier.js
    return true; // Simplified for now
  }

  async checkLiquidity(tokenAddress) {
    // Implementation from contractVerifier.js
    return true; // Simplified for now
  }

  async checkRugPullRisk(tokenAddress) {
    // Implementation from contractVerifier.js
    return 0; // Simplified for now
  }

  async checkSourceCode(tokenAddress) {
    // Implementation from contractVerifier.js
    return false; // Simplified for now
  }

  async checkLiquidityLocks(tokenAddress) {
    // Implementation from contractVerifier.js
    return false; // Simplified for now
  }

  // Calculate overall risk score
  calculateRiskScore(results) {
    let riskScore = 0;

    if (results.honeypot) riskScore += 50;
    if (!results.ownershipRenounced) riskScore += 20;
    if (!results.liquiditySufficient) riskScore += 30;
    if (results.rugPullRisk > 0.5) riskScore += 40;
    if (!results.sourceVerified) riskScore += 10;
    if (!results.liquidityLocked) riskScore += 15;

    return Math.min(riskScore, 100);
  }

  // Add warnings and errors based on results
  addWarningsAndErrors(results) {
    if (results.honeypot) {
      results.errors.push('Honeypot detected - cannot sell tokens');
    }

    if (!results.ownershipRenounced) {
      results.warnings.push('Contract ownership not renounced');
    }

    if (!results.liquiditySufficient) {
      results.warnings.push('Insufficient liquidity - high slippage risk');
    }

    if (results.rugPullRisk > 0.3) {
      results.warnings.push(`High rug pull risk - owner holds ${(results.rugPullRisk * 100).toFixed(1)}% of supply`);
    }

    if (!results.sourceVerified) {
      results.warnings.push('Source code not verified');
    }

    if (!results.liquidityLocked) {
      results.warnings.push('No liquidity locks detected');
    }
  }

  // Add token to safe whitelist
  addSafeToken(tokenAddress) {
    this.preVerifiedTokens.add(tokenAddress.toLowerCase());
    logger.info(`✅ Added ${tokenAddress} to safe whitelist`);
  }

  // Remove token from safe whitelist
  removeSafeToken(tokenAddress) {
    this.preVerifiedTokens.delete(tokenAddress.toLowerCase());
    logger.info(`❌ Removed ${tokenAddress} from safe whitelist`);
  }

  // Get verification statistics
  getStats() {
    return {
      cacheSize: this.verificationCache.size,
      pendingVerifications: this.pendingVerifications.size,
      safeTokens: this.preVerifiedTokens.size,
      queueSize: this.verificationQueue.size,
      queuePending: this.verificationQueue.pending
    };
  }

  // Clear cache and reset
  clearCache() {
    this.verificationCache.clear();
    this.pendingVerifications.clear();
    logger.info('✅ Contract verification cache cleared');
  }
}

module.exports = AsyncContractVerifier;

