const { ethers } = require('ethers');
const logger = require('../logger');

class VenusYieldStrategy {
  constructor(provider, wallet, config) {
    this.provider = provider;
    this.wallet = wallet;
    this.config = config;

    // Venus vUSDT contract on BSC
    this.vUSDT = new ethers.Contract(
      '0xfD5840Cd36d94D7229439859C0112a4185BC0255', // Venus vUSDT
      [
        'function mint(uint256 mintAmount) external returns (uint256)',
        'function balanceOf(address) view returns (uint256)',
        'function exchangeRateCurrent() returns (uint256)',
        'function redeem(uint256 redeemTokens) external returns (uint256)'
      ],
      wallet
    );

    this.usdtContract = new ethers.Contract(
      '0x55d398326f99059fF775485246999027B3197955', // BSC USDT
      [
        'function approve(address, uint256) returns (bool)',
        'function balanceOf(address) view returns (uint256)'
      ],
      wallet
    );

    this.isDeposited = false;
    this.depositedAmount = 0;
    this.lastYieldCheck = Date.now();
  }

  async depositToVenus(amount) {
    try {
      if (this.isDeposited) {
        logger.info(`💰 Venus already has $${this.depositedAmount} deposited`);
        return { success: true, alreadyDeposited: true };
      }

      logger.info(`💰 Depositing ${amount} USDT to Venus...`);

      // Check USDT balance
      const usdtBalance = await this.usdtContract.balanceOf(this.wallet.address);
      const usdtBalanceFormatted = parseFloat(ethers.formatUnits(usdtBalance, 18));

      if (usdtBalanceFormatted < amount) {
        logger.warn(`❌ Insufficient USDT balance: ${usdtBalanceFormatted} < ${amount}`);
        return { success: false, error: 'Insufficient USDT balance' };
      }

      // Approve USDT
      const approveTx = await this.usdtContract.approve(
        this.vUSDT.address,
        ethers.parseUnits(amount.toString(), 18)
      );
      await approveTx.wait();
      logger.info(`✅ USDT approved for Venus`);

      // Mint vUSDT
      const mintTx = await this.vUSDT.mint(ethers.parseUnits(amount.toString(), 18));
      await mintTx.wait();

      this.isDeposited = true;
      this.depositedAmount = amount;

      logger.info(`✅ Deposited $${amount} to Venus successfully`);
      return { success: true, amount: amount };
    } catch (error) {
      logger.error(`❌ Venus deposit failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getYieldBalance() {
    try {
      if (!this.isDeposited) {
        return 0;
      }

      const vUSDTBalance = await this.vUSDT.balanceOf(this.wallet.address);
      const exchangeRate = await this.vUSDT.exchangeRateCurrent();

      // Calculate USDT value: vUSDT balance * exchange rate
      const usdtValue = (vUSDTBalance * exchangeRate) / ethers.parseUnits('1', 18);
      const usdtValueFormatted = parseFloat(ethers.formatUnits(usdtValue, 18));

      return usdtValueFormatted;
    } catch (error) {
      logger.error(`❌ Error getting Venus balance: ${error.message}`);
      return this.depositedAmount; // Fallback to deposited amount
    }
  }

  async getYieldEarned() {
    try {
      const currentBalance = await this.getYieldBalance();
      const yieldEarned = currentBalance - this.depositedAmount;
      return Math.max(0, yieldEarned);
    } catch (error) {
      logger.error(`❌ Error calculating yield earned: ${error.message}`);
      return 0;
    }
  }

  async withdrawFromVenus(amount) {
    try {
      if (!this.isDeposited) {
        logger.warn(`❌ No funds deposited to Venus`);
        return { success: false, error: 'No funds deposited' };
      }

      logger.info(`💰 Withdrawing ${amount} USDT from Venus...`);

      // Calculate vUSDT tokens to redeem
      const exchangeRate = await this.vUSDT.exchangeRateCurrent();
      const vUSDTToRedeem = (ethers.parseUnits(amount.toString(), 18) * ethers.parseUnits('1', 18)) / exchangeRate;

      // Redeem vUSDT
      const redeemTx = await this.vUSDT.redeem(vUSDTToRedeem);
      await redeemTx.wait();

      this.depositedAmount -= amount;
      if (this.depositedAmount <= 0) {
        this.isDeposited = false;
        this.depositedAmount = 0;
      }

      logger.info(`✅ Withdrew $${amount} from Venus successfully`);
      return { success: true, amount: amount };
    } catch (error) {
      logger.error(`❌ Venus withdrawal failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async checkYieldPerformance() {
    try {
      const currentBalance = await this.getYieldBalance();
      const yieldEarned = await this.getYieldEarned();
      const timeElapsed = (Date.now() - this.lastYieldCheck) / (1000 * 60 * 60 * 24); // days

      if (timeElapsed > 0 && this.depositedAmount > 0) {
        const dailyYield = yieldEarned / timeElapsed;
        const annualizedAPY = (dailyYield / this.depositedAmount) * 365 * 100;

        logger.info(`💰 Venus Performance: $${currentBalance.toFixed(2)} balance, $${yieldEarned.toFixed(2)} earned, ${annualizedAPY.toFixed(2)}% APY`);

        return {
          currentBalance,
          yieldEarned,
          dailyYield,
          annualizedAPY,
          timeElapsed
        };
      }

      return {
        currentBalance,
        yieldEarned: 0,
        dailyYield: 0,
        annualizedAPY: 0,
        timeElapsed: 0
      };
    } catch (error) {
      logger.error(`❌ Error checking yield performance: ${error.message}`);
      return null;
    }
  }

  async initialize() {
    try {
      if (this.config.enabled && this.config.allocation > 0) {
        logger.info(`🚀 Initializing Venus yield strategy with $${this.config.allocation}`);

        // Check if we should deposit
        const currentBalance = await this.getYieldBalance();
        if (currentBalance < this.config.allocation * 0.9) { // 90% threshold
          const result = await this.depositToVenus(this.config.allocation);
          if (result.success) {
            this.lastYieldCheck = Date.now();
            logger.info(`✅ Venus yield strategy initialized with $${this.config.allocation}`);
          }
        } else {
          logger.info(`💰 Venus already has sufficient balance: $${currentBalance.toFixed(2)}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Error initializing Venus strategy: ${error.message}`);
    }
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      allocation: this.config.allocation,
      isDeposited: this.isDeposited,
      depositedAmount: this.depositedAmount,
      expectedAPY: this.config.protocols[0]?.expectedAPY || 0.10
    };
  }
}

module.exports = VenusYieldStrategy;

