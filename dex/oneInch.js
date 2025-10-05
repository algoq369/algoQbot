const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../logger');
const config = require('../config');

class OneInch {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.apiUrl = 'https://api.1inch.io/v5.0/56'; // BSC chain ID
  }

  async getPrice(tokenIn, tokenOut, amountIn) {
    try {
      const params = {
        fromTokenAddress: tokenIn,
        toTokenAddress: tokenOut,
        amount: amountIn.toString(),
        fromAddress: this.wallet.address,
        slippage: 2, // 2% slippage
        disableEstimate: false
      };

      const response = await axios.get(`${this.apiUrl}/quote`, { params });
      return ethers.parseEther(response.data.toTokenAmount);
    } catch (error) {
      logger.error('Error getting 1inch price:', error);
      throw error;
    }
  }

  async swapTokens(tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const params = {
        fromTokenAddress: tokenIn,
        toTokenAddress: tokenOut,
        amount: amountIn.toString(),
        fromAddress: this.wallet.address,
        slippage: 2,
        disableEstimate: false
      };

      // Get swap transaction data
      const response = await axios.get(`${this.apiUrl}/swap`, { params });
      const txData = response.data.tx;

      // Execute the transaction
      const tx = await this.wallet.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value || 0,
        gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
        gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined
      });

      logger.info(`1inch swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`1inch swap completed: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      logger.error('Error swapping tokens on 1inch:', error);
      throw error;
    }
  }

  async getPriceImpact(amountIn, path) {
    try {
      const price = await this.getPrice(path[0], path[1], amountIn);
      const smallAmount = amountIn / 1000;
      const smallPrice = await this.getPrice(path[0], path[1], smallAmount);
      
      const expectedOut = Number(smallPrice) * Number(amountIn) / Number(smallAmount);
      const priceImpact = ((expectedOut - Number(price)) / expectedOut) * 100;
      
      return Math.abs(priceImpact);
    } catch (error) {
      logger.error('Error calculating 1inch price impact:', error);
      return 0;
    }
  }

  async getLiquidity(tokenIn, tokenOut) {
    try {
      const largeAmount = ethers.parseEther('1000');
      return await this.getPrice(tokenIn, tokenOut, largeAmount);
    } catch (error) {
      logger.error('Error getting 1inch liquidity:', error);
      return 0;
    }
  }
}

module.exports = OneInch;
