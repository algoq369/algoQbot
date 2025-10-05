const { ethers } = require('ethers');
const logger = require('../logger');
const config = require('../config');

// SushiSwap Router ABI (BSC compatible)
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function WETH() external pure returns (address)'
];

class SushiSwap {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.router = new ethers.Contract(
      '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap Router (BSC)
      ROUTER_ABI,
      wallet
    );
  }

  async getPrice(tokenIn, tokenOut, amountIn) {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.router.getAmountsOut(amountIn, path);
      return amounts[1];
    } catch (error) {
      logger.error('Error getting SushiSwap price:', error);
      throw error;
    }
  }

  async swapTokens(tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const path = [tokenIn, tokenOut];
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      const priceImpact = await this.getPriceImpact(amountIn, path);
      if (priceImpact > 3) {
        throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}%`);
      }

      logger.info(`SushiSwap price impact: ${priceImpact.toFixed(2)}%`);

      const tx = await this.router.swapExactTokensForTokens(
        amountIn,
        Math.floor(Number(minAmountOut) * 0.98), // 2% slippage
        path,
        this.wallet.address,
        deadline
      );

      logger.info(`SushiSwap swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`SushiSwap swap completed: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error swapping tokens on SushiSwap:', error);
      throw error;
    }
  }

  async getPriceImpact(amountIn, path) {
    try {
      const amounts = await this.router.getAmountsOut(amountIn, path);
      const amountOut = amounts[1];
      
      const smallAmountIn = amountIn / 1000;
      const smallAmounts = await this.router.getAmountsOut(smallAmountIn, path);
      const oneUnitOut = smallAmounts[1];
      
      const expectedOut = Number(oneUnitOut) * Number(amountIn) / Number(smallAmountIn);
      const priceImpact = ((expectedOut - Number(amountOut)) / expectedOut) * 100;
      
      return Math.abs(priceImpact);
    } catch (error) {
      logger.error('Error calculating SushiSwap price impact:', error);
      return 0;
    }
  }

  async getLiquidity(tokenIn, tokenOut) {
    try {
      const largeAmount = ethers.parseEther('1000');
      const amounts = await this.router.getAmountsOut(largeAmount, [tokenIn, tokenOut]);
      return amounts[1];
    } catch (error) {
      logger.error('Error getting SushiSwap liquidity:', error);
      return 0;
    }
  }
}

module.exports = SushiSwap;
