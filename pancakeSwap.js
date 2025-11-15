const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');
const PriceCache = require('./utils/priceCache'); // ⚡ Price caching
const perf = require('./utils/performanceTracker'); // ⚡ Performance tracking

class PancakeSwap {
  constructor(provider, wallet, txVerifier = null) {
    this.provider = provider;
    this.wallet = wallet;
    this.txVerifier = txVerifier; // ✅ SECURITY FIX #3: Add transaction verifier
    this.router = new ethers.Contract(
      config.dex.router,
      [
        'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function WETH() external pure returns (address)'
      ],
      wallet
    );

    // ⚡ OPTIMIZATION: Initialize 30-second price cache
    this.priceCache = new PriceCache(30000); // 30 second TTL
    logger.info('⚡ Price cache initialized (30s TTL)');

    // Setup periodic cache cleanup (every 5 minutes)
    this.cacheCleanupInterval = setInterval(() => {
      const cleaned = this.priceCache.cleanup();
      if (cleaned > 0) {
        logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`);
      }
    }, 300000);
  }

  async getPrice(tokenIn, tokenOut, amountIn) {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.router.getAmountsOut(amountIn, path);
      return amounts[1];
    } catch (error) {
      logger.error('Error getting price:', error);
      throw error;
    }
  }

  async getCurrentPrice(retries = 3) {
    const cacheKey = 'BNB/USDT';

    // ⚡ OPTIMIZATION: Check cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached !== null) {
      logger.debug(`💨 Price cache HIT: ${cached.toFixed(8)} (saved RPC call)`);
      return cached;
    }

    // Cache miss - fetch from blockchain with retry logic
    logger.debug(`🔍 Price cache MISS: Fetching from RPC...`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // ✅ FIX: Return price in BNB per USDT format for consistent calculations
        // Instead of getting "1 BNB = X USDT", we return "1 USDT = Y BNB"
        const amountIn = ethers.parseUnits('1', 18); // 1 USDT
        const price = await this.getPrice(config.tokens.USDT, config.tokens.WBNB, amountIn);
        const bnbPerUsdt = parseFloat(ethers.formatUnits(price, 18));

        // ⚡ OPTIMIZATION: Store in cache for 30 seconds
        this.priceCache.set(cacheKey, bnbPerUsdt);

        // Result: ~0.000929 (BNB per USDT) instead of ~1076 (USDT per BNB)
        // This format works directly for calculations: usdAmount × bnbPerUsdt = bnbAmount
        return bnbPerUsdt;
      } catch (error) {
        if (attempt === retries) {
          logger.error(`❌ getCurrentPrice failed after ${retries} attempts:`, error.message);
          throw error;
        }
        logger.warn(`⚠️  getCurrentPrice attempt ${attempt} failed, retrying in ${attempt}s...`);
        await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s, 3s backoff
      }
    }
  }

  async getPriceImpact(amountIn, path) {
    try {
      const amounts = await this.router.getAmountsOut(amountIn, path);
      const amountOut = amounts[amounts.length - 1];

      // Get price for 1 unit to calculate impact
      const oneUnit = ethers.parseUnits('1', 18);
      const oneUnitAmounts = await this.router.getAmountsOut(oneUnit, path);
      const oneUnitOut = oneUnitAmounts[oneUnitAmounts.length - 1];

      const expectedOut = Number(oneUnitOut) * Number(amountIn) / Number(oneUnit);
      const priceImpact = ((expectedOut - Number(amountOut)) / expectedOut) * 100;

      return priceImpact;
    } catch (error) {
      logger.error('Error calculating price impact:', error);
      return 0;
    }
  }

  async swapTokens(tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const path = [tokenIn, tokenOut];
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

      // Check price impact before swapping
      const priceImpact = await this.getPriceImpact(amountIn, path);
      if (priceImpact > 3) { // Conventional 3% price impact limit
        throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}%`);
      }

      logger.info(`Price impact: ${priceImpact.toFixed(2)}%`);

      // ✅ SECURITY FIX #3: Build transaction first (populateTransaction)
      const unsignedTx = await this.router.swapExactTokensForTokens.populateTransaction(
        amountIn,
        Math.floor(Number(minAmountOut) * 0.98), // Allow 2% slippage (conventional) for small trades
        path,
        this.wallet.address,
        deadline
      );

      // 🔒 EXPERT FIX: Sign FIRST, then verify what will ACTUALLY be sent
      const signedTx = await this.wallet.signTransaction(unsignedTx);

      // Parse the signed transaction to get ACTUAL parameters
      const parsedTx = ethers.Transaction.from(signedTx);

      // ✅ SECURITY FIX #3: Verify SIGNED transaction (not unsigned)
      if (this.txVerifier) {
        logger.debug('Verifying SIGNED swap transaction...');
        await this.txVerifier.verifyBeforeSign(parsedTx);
        logger.debug('✅ Signed transaction verified, broadcasting');
      } else {
        logger.warn('⚠️  No transaction verifier configured - skipping verification');
      }

      // Broadcast the signed transaction
      const tx = await this.provider.sendTransaction(signedTx);

      logger.info(`Swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`Swap completed: ${receipt.transactionHash}`);

      return receipt;
    } catch (error) {
      logger.error('Error swapping tokens:', error);
      throw error;
    }
  }

  async swapUSDTForBNB(usdtAmount, minBnbAmount) {
    const amountIn = ethers.parseUnits(usdtAmount.toString(), 18); // USDT has 18 decimals

    // Approve USDT spending
    await this.approveToken(config.tokens.USDT, config.dex.router, amountIn);

    return await this.swapTokens(config.tokens.USDT, config.tokens.WBNB, amountIn, minBnbAmount);
  }

  async swapBNBForUSDT(bnbAmount, minUsdtAmount) {
    const amountIn = ethers.parseEther(bnbAmount.toString());
    return await this.swapTokens(config.tokens.WBNB, config.tokens.USDT, amountIn, minUsdtAmount);
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        this.wallet
      );

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(this.wallet.address, spenderAddress);

      if (currentAllowance >= amount) {
        logger.info('Token already approved');
        return { hash: 'already_approved' };
      }

      // Approve token
      const tx = await tokenContract.approve(spenderAddress, amount);
      logger.info(`Approval transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Token approved successfully: ${receipt.transactionHash}`);

      return receipt;
    } catch (error) {
      logger.error('Error approving token:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address owner) view returns (uint256)'],
        this.provider
      );

      const balance = await tokenContract.balanceOf(this.wallet.address);
      return balance;
    } catch (error) {
      logger.error('Error getting token balance:', error);
      throw error;
    }
  }

  async getUSDTBalance() {
    const balance = await this.getTokenBalance(config.tokens.USDT);
    return parseFloat(ethers.formatUnits(balance, 18)); // USDT on BSC has 18 decimals
  }

  async getBNBBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return parseFloat(ethers.formatEther(balance));
  }

  // ⚡ OPTIMIZATION: Get both balances in parallel (2x faster)
  async getBalances() {
    return await perf.measure('Balance Fetch (Parallel)', async () => {
      const [usdtBalance, bnbBalance] = await Promise.all([
        this.getUSDTBalance(),
        this.getBNBBalance()
      ]);
      return { usdtBalance, bnbBalance };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 VOLUME DATA METHODS - Professional On-Chain + Fallback Solutions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PHASE 1: DexScreener API - Fast fallback for volume data
   * Free API, no key required, pre-aggregated data
   */
  async getVolumeFromDexScreener() {
    try {
      const pairAddress = await this.getPairAddress(config.tokens.USDT, config.tokens.WBNB);
      const url = `https://api.dexscreener.com/latest/dex/pairs/bsc/${pairAddress}`;

      logger.debug(`[DexScreener] Fetching volume data from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`DexScreener API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.pair) {
        const volumeData = {
          source: 'dexscreener',
          price: parseFloat(data.pair.priceUsd),
          volume24h: parseFloat(data.pair.volume.h24) || 0,
          volume6h: parseFloat(data.pair.volume.h6) || 0,
          volume1h: parseFloat(data.pair.volume.h1) || 0,
          priceChange24h: parseFloat(data.pair.priceChange.h24) || 0,
          liquidity: parseFloat(data.pair.liquidity.usd) || 0,
          txCount24h: parseInt(data.pair.txns?.h24?.buys || 0) + parseInt(data.pair.txns?.h24?.sells || 0),
          timestamp: Date.now()
        };

        logger.info(`✅ [DexScreener] Volume 24h: $${volumeData.volume24h.toFixed(2)}, Liquidity: $${volumeData.liquidity.toFixed(2)}`);
        return volumeData;
      }

      throw new Error('No pair data from DexScreener');
    } catch (error) {
      logger.warn(`⚠️ [DexScreener] Failed to fetch volume: ${error.message}`);
      return null;
    }
  }

  /**
   * PHASE 1: Binance API - Additional fallback for BNB/USDT
   * Free API for BNB/USDT spot market data
   */
  async getVolumeFromBinance() {
    try {
      const url = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT';

      logger.debug(`[Binance] Fetching volume data from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance API returned ${response.status}`);
      }

      const data = await response.json();

      const volumeData = {
        source: 'binance',
        price: parseFloat(data.lastPrice),
        volume24h: parseFloat(data.quoteVolume), // USDT volume
        volumeBase24h: parseFloat(data.volume), // BNB volume
        priceChange24h: parseFloat(data.priceChangePercent),
        txCount24h: parseInt(data.count),
        timestamp: Date.now()
      };

      logger.info(`✅ [Binance] Volume 24h: $${volumeData.volume24h.toFixed(2)}, Trades: ${volumeData.txCount24h}`);
      return volumeData;
    } catch (error) {
      logger.warn(`⚠️ [Binance] Failed to fetch volume: ${error.message}`);
      return null;
    }
  }

  /**
   * PHASE 2: Get PancakeSwap Pair contract address from Factory
   * Required for querying Swap events from the liquidity pool
   */
  async getPairAddress(tokenA, tokenB) {
    try {
      const factory = new ethers.Contract(
        config.dex.factory,
        ['function getPair(address tokenA, address tokenB) external view returns (address pair)'],
        this.provider
      );

      const pairAddress = await factory.getPair(tokenA, tokenB);

      if (pairAddress === ethers.ZeroAddress) {
        throw new Error(`No pair found for ${tokenA}/${tokenB}`);
      }

      logger.debug(`[Pair] Address for ${tokenA}/${tokenB}: ${pairAddress}`);
      return pairAddress;
    } catch (error) {
      logger.error(`Error getting pair address: ${error.message}`);
      throw error;
    }
  }

  /**
   * PHASE 2: Query Swap events from Pair contract
   * Gets actual on-chain trading volume from PancakeSwap V2
   */
  async getRecentSwaps(pairAddress, fromBlock = null, toBlock = 'latest') {
    try {
      // PancakeSwap V2 Pair Swap event
      const pairContract = new ethers.Contract(
        pairAddress,
        [
          'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
        ],
        this.provider
      );

      // Get last 1000 blocks if fromBlock not specified
      // BSC: ~3 second block time, 1000 blocks = ~50 minutes
      if (!fromBlock) {
        const currentBlock = await this.provider.getBlockNumber();
        fromBlock = currentBlock - 1000;
      }

      logger.debug(`[Swap Events] Querying blocks ${fromBlock} to ${toBlock}`);

      const filter = pairContract.filters.Swap();
      const events = await pairContract.queryFilter(filter, fromBlock, toBlock);

      logger.debug(`[Swap Events] Found ${events.length} swaps from block ${fromBlock}`);
      return events;
    } catch (error) {
      logger.warn(`⚠️ [Swap Events] Failed to query: ${error.message}`);
      return [];
    }
  }

  /**
   * PHASE 2: Calculate volume from Swap events (PRIMARY SOURCE)
   * Aggregates on-chain swap data into volume metrics
   */
  async calculateVolumeFromSwaps(pairAddress, hours = 24) {
    try {
      const currentBlock = await this.provider.getBlockNumber();

      // BSC: ~3 second block time
      // 1 hour = 1200 blocks, 24 hours = 28800 blocks
      const blocksPerHour = 1200;
      const fromBlock = currentBlock - (hours * blocksPerHour);

      logger.debug(`[Volume Calc] Fetching ${hours}h of swaps (${fromBlock} to ${currentBlock})`);

      const events = await this.getRecentSwaps(pairAddress, fromBlock);

      if (events.length === 0) {
        logger.warn(`⚠️ [Volume Calc] No swap events found in last ${hours} hours`);
        return null;
      }

      // Calculate total volume from swap events
      let totalVolumeToken0 = 0;
      let totalVolumeToken1 = 0;

      for (const event of events) {
        // amount0Out and amount1Out represent the swap amounts
        const amount0Out = parseFloat(ethers.formatUnits(event.args.amount0Out, 18));
        const amount1Out = parseFloat(ethers.formatUnits(event.args.amount1Out, 18));
        const amount0In = parseFloat(ethers.formatUnits(event.args.amount0In, 18));
        const amount1In = parseFloat(ethers.formatUnits(event.args.amount1In, 18));

        // Sum volumes for both tokens (both directions of swaps)
        totalVolumeToken0 += amount0Out + amount0In;
        totalVolumeToken1 += amount1Out + amount1In;
      }

      // For BNB/USDT pair, token1 is typically USDT (quote currency)
      const volumeUSDT = totalVolumeToken1;
      const volumeBNB = totalVolumeToken0;

      const volumeData = {
        source: 'on-chain',
        volumeUSDT,
        volumeBNB,
        swapCount: events.length,
        avgVolumePerSwap: volumeUSDT / events.length,
        fromBlock,
        toBlock: currentBlock,
        hoursAnalyzed: hours,
        timestamp: Date.now()
      };

      logger.info(`✅ [On-Chain Volume] ${hours}h: $${volumeUSDT.toFixed(2)} (${events.length} swaps)`);
      return volumeData;
    } catch (error) {
      logger.warn(`⚠️ [Volume Calc] Failed to calculate: ${error.message}`);
      return null;
    }
  }

  /**
   * Get current volume data with intelligent fallback
   * Priority: On-chain > DexScreener > Binance
   */
  async getCurrentVolume(hours = 1) {
    try {
      // Try on-chain first (most accurate)
      const pairAddress = await this.getPairAddress(config.tokens.USDT, config.tokens.WBNB);
      const onChainVolume = await this.calculateVolumeFromSwaps(pairAddress, hours);

      if (onChainVolume && onChainVolume.volumeUSDT > 0) {
        return {
          volume: onChainVolume.volumeUSDT,
          volumeBNB: onChainVolume.volumeBNB,
          swapCount: onChainVolume.swapCount,
          source: 'on-chain',
          hours: hours
        };
      }

      logger.warn('⚠️ [Volume] On-chain query returned no data, trying DexScreener...');

      // Fallback to DexScreener
      const dexScreenerData = await this.getVolumeFromDexScreener();
      if (dexScreenerData && dexScreenerData.volume24h > 0) {
        // Scale 24h volume to requested hours
        const scaledVolume = (dexScreenerData.volume24h / 24) * hours;
        return {
          volume: scaledVolume,
          volume24h: dexScreenerData.volume24h,
          source: 'dexscreener',
          hours: hours
        };
      }

      logger.warn('⚠️ [Volume] DexScreener failed, trying Binance...');

      // Fallback to Binance
      const binanceData = await this.getVolumeFromBinance();
      if (binanceData && binanceData.volume24h > 0) {
        // Scale 24h volume to requested hours
        const scaledVolume = (binanceData.volume24h / 24) * hours;
        return {
          volume: scaledVolume,
          volume24h: binanceData.volume24h,
          source: 'binance',
          hours: hours
        };
      }

      logger.error('❌ [Volume] All volume sources failed');
      return {
        volume: 0,
        source: 'none',
        hours: hours
      };
    } catch (error) {
      logger.error(`❌ [Volume] Error fetching volume: ${error.message}`);
      return {
        volume: 0,
        source: 'error',
        hours: hours,
        error: error.message
      };
    }
  }
  // ⚡ OPTIMIZATION: Cache management methods
  getCacheStats() {
    return this.priceCache.getStats();
  }

  cleanup() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.priceCache.clear();
    logger.info('⚡ Price cache cleaned up');
  }
}

module.exports = PancakeSwap;
