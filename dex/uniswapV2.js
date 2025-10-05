const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

// Uniswap V2 Router ABI (BSC compatible)
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function WETH() external pure returns (address)'
];

class UniswapV2 {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.router = new ethers.Contract(
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router (BSC)
      ROUTER_ABI,
      wallet
    );
  }

  async getPrice(tokenIn, tokenOut, amountIn) {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.router.getAmountsOut(amountIn, path);
      return amounts[1]; // Output amount
    } catch (error) {
      logger.error('Error getting Uniswap V2 price:', error);
      throw error;
    }
  }

  async swapTokens(tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const path = [tokenIn, tokenOut];
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

      // Check price impact
      const priceImpact = await this.getPriceImpact(amountIn, path);
      if (priceImpact > 3) {
        throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}%`);
      }

      logger.info(`Uniswap V2 price impact: ${priceImpact.toFixed(2)}%`);

      const tx = await this.router.swapExactTokensForTokens(
        amountIn,
        Math.floor(Number(minAmountOut) * 0.98), // 2% slippage
        path,
        this.wallet.address,
        deadline
      );

      logger.info(`Uniswap V2 swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`Uniswap V2 swap completed: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error swapping tokens on Uniswap V2:', error);
      throw error;
    }
  }

  async getPriceImpact(amountIn, path) {
    try {
      const amounts = await this.router.getAmountsOut(amountIn, path);
      const amountOut = amounts[1];
      
      // Calculate price impact using a smaller amount
      const smallAmountIn = amountIn / 1000;
      const smallAmounts = await this.router.getAmountsOut(smallAmountIn, path);
      const oneUnitOut = smallAmounts[1];
      
      const expectedOut = Number(oneUnitOut) * Number(amountIn) / Number(smallAmountIn);
      const priceImpact = ((expectedOut - Number(amountOut)) / expectedOut) * 100;
      
      return Math.abs(priceImpact);
    } catch (error) {
      logger.error('Error calculating price impact:', error);
      return 0;
    }
  }

  async getLiquidity(tokenIn, tokenOut) {
    try {
      // Simplified liquidity calculation
      const largeAmount = ethers.parseEther('1000'); // 1000 tokens
      const amounts = await this.router.getAmountsOut(largeAmount, [tokenIn, tokenOut]);
      return amounts[1];
    } catch (error) {
      logger.error('Error getting liquidity:', error);
      return 0;
    }
  }
}

module.exports = UniswapV2;
