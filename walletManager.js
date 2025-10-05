const { ethers } = require('ethers');
const config = require('./config');
const logger = require('./logger');

class WalletManager {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.isConnected = false;
  }

  async connect(privateKey = null) {
    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
      
      // Check if we have a private key
      const key = privateKey || config.wallet.privateKey;
      
      if (!key || key === 'your_private_key_here') {
        throw new Error('Private key not provided. Please set PRIVATE_KEY in .env file or pass it as parameter.');
      }

      // Create wallet
      this.wallet = new ethers.Wallet(key, this.provider);
      
      // Verify wallet address matches
      if (this.wallet.address.toLowerCase() !== config.wallet.address.toLowerCase()) {
        logger.warn(`Wallet address mismatch. Expected: ${config.wallet.address}, Got: ${this.wallet.address}`);
      }

      // Test connection
      const balance = await this.provider.getBalance(this.wallet.address);
      const network = await this.provider.getNetwork();
      
      if (network.chainId !== BigInt(config.network.chainId)) {
        throw new Error(`Wrong network. Expected chain ID: ${config.network.chainId}, Got: ${network.chainId}`);
      }

      this.isConnected = true;
      
      logger.info(`Wallet connected successfully:`);
      logger.info(`Address: ${this.wallet.address}`);
      logger.info(`Balance: ${ethers.formatEther(balance)} BNB`);
      logger.info(`Network: BSC (Chain ID: ${network.chainId})`);

      return {
        address: this.wallet.address,
        balance: ethers.formatEther(balance),
        network: network.name,
        chainId: network.chainId.toString()
      };
    } catch (error) {
      logger.error('Error connecting wallet:', error);
      throw error;
    }
  }

  async getBalance() {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting balance:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

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

  async sendTransaction(transaction) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.wallet.sendTransaction(transaction);
      logger.info(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`Transaction confirmed: ${receipt.transactionHash}`);
      
      return receipt;
    } catch (error) {
      logger.error('Error sending transaction:', error);
      throw error;
    }
  }

  async estimateGas(transaction) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      return gasEstimate;
    } catch (error) {
      logger.error('Error estimating gas:', error);
      throw error;
    }
  }

  async getGasPrice() {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const gasPrice = await this.provider.getFeeData();
      return gasPrice;
    } catch (error) {
      logger.error('Error getting gas price:', error);
      throw error;
    }
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

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

  async checkAllowance(tokenAddress, spenderAddress) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        this.provider
      );

      const allowance = await tokenContract.allowance(this.wallet.address, spenderAddress);
      return allowance;
    } catch (error) {
      logger.error('Error checking allowance:', error);
      throw error;
    }
  }

  disconnect() {
    this.provider = null;
    this.wallet = null;
    this.isConnected = false;
    logger.info('Wallet disconnected');
  }

  getWallet() {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this.wallet;
  }

  getProvider() {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this.provider;
  }
}

module.exports = WalletManager;
