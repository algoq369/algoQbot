const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../logger');

class SmartContractVerifier {
  constructor(provider) {
    this.provider = provider;
    this.verifiedContracts = new Map();
    this.dangerousContracts = new Set();
    
    // Honeypot detection APIs
    this.honeypotAPIs = [
      'https://api.honeypot.is/v2/IsHoneypot',
      'https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot'
    ];
    
    logger.info('🔍 Smart Contract Verifier initialized');
  }

  // Main verification method
  async verifyToken(tokenAddress) {
    try {
      logger.info(`🔍 Verifying token contract: ${tokenAddress}`);

      const checks = await Promise.allSettled([
        this.checkHoneypot(tokenAddress),
        this.checkOwnership(tokenAddress),
        this.checkLiquidity(tokenAddress),
        this.checkRugPullRisk(tokenAddress),
        this.checkSourceCode(tokenAddress),
        this.checkLiquidityLocks(tokenAddress)
      ]);

      const results = {
        address: tokenAddress,
        honeypot: checks[0].status === 'fulfilled' ? checks[0].value : false,
        ownershipRenounced: checks[1].status === 'fulfilled' ? checks[1].value : false,
        liquiditySufficient: checks[2].status === 'fulfilled' ? checks[2].value : false,
        rugPullRisk: checks[3].status === 'fulfilled' ? checks[3].value : 0,
        sourceVerified: checks[4].status === 'fulfilled' ? checks[4].value : false,
        liquidityLocked: checks[5].status === 'fulfilled' ? checks[5].value : false,
        riskScore: 0,
        safe: true,
        warnings: [],
        errors: []
      };

      // Calculate risk score (0-100, higher = more risky)
      results.riskScore = this.calculateRiskScore(results);
      results.safe = results.riskScore < 30; // Safe if risk score < 30

      // Add warnings and errors
      this.addWarningsAndErrors(results);

      // Cache result
      this.verifiedContracts.set(tokenAddress, results);

      if (!results.safe) {
        this.dangerousContracts.add(tokenAddress);
        logger.warn(`⚠️ Dangerous token detected: ${tokenAddress} (Risk: ${results.riskScore})`);
      } else {
        logger.info(`✅ Token verified as safe: ${tokenAddress} (Risk: ${results.riskScore})`);
      }

      return results;

    } catch (error) {
      logger.error(`Error verifying token ${tokenAddress}:`, error);
      return {
        address: tokenAddress,
        safe: false,
        error: error.message,
        riskScore: 100
      };
    }
  }

  // Check for honeypot
  async checkHoneypot(tokenAddress) {
    for (const api of this.honeypotAPIs) {
      try {
        const response = await axios.get(`${api}?address=${tokenAddress}`, {
          timeout: 5000
        });

        if (response.data && typeof response.data.IsHoneypot === 'boolean') {
          return response.data.IsHoneypot;
        }
      } catch (error) {
        logger.debug(`Honeypot API ${api} failed:`, error.message);
      }
    }

    // Fallback: Check for common honeypot patterns
    return await this.checkHoneypotPatterns(tokenAddress);
  }

  // Check for honeypot patterns in contract
  async checkHoneypotPatterns(tokenAddress) {
    try {
      const contract = new ethers.Contract(
        tokenAddress,
        [
          'function transfer(address to, uint256 amount) external returns (bool)',
          'function balanceOf(address account) external view returns (uint256)',
          'function owner() external view returns (address)'
        ],
        this.provider
      );

      // Test transfer with a small amount to a random address
      const testAddress = '0x0000000000000000000000000000000000000001';
      
      try {
        await contract.transfer.staticCall(testAddress, 1);
        return false; // If static call succeeds, not a honeypot
      } catch (error) {
        // If static call fails, might be a honeypot
        if (error.message.includes('Honeypot') || error.message.includes('Cannot sell')) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.debug(`Error checking honeypot patterns:`, error.message);
      return false;
    }
  }

  // Check if ownership is renounced
  async checkOwnership(tokenAddress) {
    try {
      const contract = new ethers.Contract(
        tokenAddress,
        ['function owner() external view returns (address)'],
        this.provider
      );

      const owner = await contract.owner();
      return owner === '0x0000000000000000000000000000000000000000';
    } catch (error) {
      // If no owner function, assume ownership is renounced
      return true;
    }
  }

  // Check liquidity sufficiency
  async checkLiquidity(tokenAddress) {
    try {
      // Get token info from CoinGecko or similar
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/bsc`,
        {
          params: {
            contract_addresses: tokenAddress,
            vs_currencies: 'usd'
          },
          timeout: 5000
        }
      );

      if (response.data && response.data[tokenAddress.toLowerCase()]) {
        const priceData = response.data[tokenAddress.toLowerCase()];
        // Consider liquid if price is available and > $0
        return priceData.usd > 0;
      }

      return false;
    } catch (error) {
      logger.debug(`Error checking liquidity:`, error.message);
      return false;
    }
  }

  // Check rug pull risk
  async checkRugPullRisk(tokenAddress) {
    try {
      const contract = new ethers.Contract(
        tokenAddress,
        [
          'function balanceOf(address account) external view returns (uint256)',
          'function totalSupply() external view returns (uint256)',
          'function owner() external view returns (address)'
        ],
        this.provider
      );

      const totalSupply = await contract.totalSupply();
      
      // Check if owner holds too much supply
      try {
        const owner = await contract.owner();
        if (owner !== '0x0000000000000000000000000000000000000000') {
          const ownerBalance = await contract.balanceOf(owner);
          const ownerPercentage = Number(ownerBalance) / Number(totalSupply);
          
          if (ownerPercentage > 0.5) { // Owner holds > 50%
            return ownerPercentage;
          }
        }
      } catch (error) {
        // No owner function or error checking balance
      }

      return 0; // Low risk
    } catch (error) {
      logger.debug(`Error checking rug pull risk:`, error.message);
      return 0.5; // Medium risk if can't check
    }
  }

  // Check if source code is verified
  async checkSourceCode(tokenAddress) {
    try {
      const response = await axios.get(
        `https://api.bscscan.com/api`,
        {
          params: {
            module: 'contract',
            action: 'getsourcecode',
            address: tokenAddress,
            apikey: process.env.BSCSCAN_API_KEY || ''
          },
          timeout: 5000
        }
      );

      if (response.data && response.data.result && response.data.result[0]) {
        const contractInfo = response.data.result[0];
        return contractInfo.SourceCode !== '';
      }

      return false;
    } catch (error) {
      logger.debug(`Error checking source code:`, error.message);
      return false;
    }
  }

  // Check for liquidity locks
  async checkLiquidityLocks(tokenAddress) {
    try {
      // Check common liquidity lock contracts
      const lockContracts = [
        '0x407993575c91ce7643a4d4ccac9a96c430676fda', // Team Finance
        '0x663a5c229c09b049e36ccfc1042e55d00d759c4e'  // Unicrypt
      ];

      for (const lockContract of lockContracts) {
        try {
          const contract = new ethers.Contract(
            lockContract,
            ['function getLockedToken(address token) external view returns (uint256)'],
            this.provider
          );

          const lockedAmount = await contract.getLockedToken(tokenAddress);
          if (lockedAmount > 0) {
            return true;
          }
        } catch (error) {
          // Contract might not support this token
        }
      }

      return false;
    } catch (error) {
      logger.debug(`Error checking liquidity locks:`, error.message);
      return false;
    }
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
      results.warnings.push('Contract ownership not renounced - owner can modify contract');
    }

    if (!results.liquiditySufficient) {
      results.warnings.push('Insufficient liquidity - high slippage risk');
    }

    if (results.rugPullRisk > 0.3) {
      results.warnings.push(`High rug pull risk - owner holds ${(results.rugPullRisk * 100).toFixed(1)}% of supply`);
    }

    if (!results.sourceVerified) {
      results.warnings.push('Source code not verified - cannot audit contract');
    }

    if (!results.liquidityLocked) {
      results.warnings.push('No liquidity locks detected - LP can be removed');
    }
  }

  // Check if token is safe for trading
  async isTokenSafe(tokenAddress) {
    const result = await this.verifyToken(tokenAddress);
    return result.safe;
  }

  // Get verification history
  getVerificationHistory() {
    return {
      verified: Array.from(this.verifiedContracts.keys()),
      dangerous: Array.from(this.dangerousContracts),
      totalVerified: this.verifiedContracts.size,
      totalDangerous: this.dangerousContracts.size
    };
  }

  // Get cached verification result
  getCachedVerification(tokenAddress) {
    return this.verifiedContracts.get(tokenAddress);
  }

  // Clear verification cache
  clearCache() {
    this.verifiedContracts.clear();
    this.dangerousContracts.clear();
    logger.info('✅ Contract verification cache cleared');
  }

  // Batch verify multiple tokens
  async batchVerify(tokenAddresses) {
    const results = await Promise.allSettled(
      tokenAddresses.map(address => this.verifyToken(address))
    );

    return results.map((result, index) => ({
      address: tokenAddresses[index],
      result: result.status === 'fulfilled' ? result.value : { safe: false, error: result.reason }
    }));
  }

  // Get verification statistics
  getStats() {
    const total = this.verifiedContracts.size;
    const dangerous = this.dangerousContracts.size;
    const safe = total - dangerous;

    return {
      totalVerified: total,
      safeTokens: safe,
      dangerousTokens: dangerous,
      safetyRate: total > 0 ? (safe / total * 100).toFixed(2) : 0
    };
  }
}

module.exports = SmartContractVerifier;

