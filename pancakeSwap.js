const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');

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

  async getCurrentPrice() {
    try {
      // ✅ FIX: Return price in BNB per USDT format for consistent calculations
      // Instead of getting "1 BNB = X USDT", we return "1 USDT = Y BNB"
      const amountIn = ethers.parseUnits('1', 18); // 1 USDT
      const price = await this.getPrice(config.tokens.USDT, config.tokens.WBNB, amountIn);
      const bnbPerUsdt = parseFloat(ethers.formatUnits(price, 18));

      // Result: ~0.000929 (BNB per USDT) instead of ~1076 (USDT per BNB)
      // This format works directly for calculations: usdAmount × bnbPerUsdt = bnbAmount
      return bnbPerUsdt;
    } catch (error) {
      logger.error('Error getting current price:', error);
      throw error;
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
}

module.exports = PancakeSwap;
