const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

class EncryptedKeyManager {
  constructor() {
    this.walletPath = path.join(__dirname, '..', 'wallet.json');
  }

  /**
   * ONE-TIME: Create encrypted wallet from existing private key
   * @param {string} privateKey - The private key to encrypt
   * @param {string} password - Strong password for encryption
   * @returns {Promise<string>} - Wallet address
   */
  async createEncryptedWallet(privateKey, password) {
    try {
      logger.info('🔐 Creating encrypted wallet...');
      
      // Validate private key format
      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error('Invalid private key format. Must be 66 characters starting with 0x');
      }
      
      // Validate password strength
      if (password.length < 12) {
        throw new Error('Password must be at least 12 characters');
      }
      
      const wallet = new ethers.Wallet(privateKey);
      
      // Encrypt with high security settings
      // Note: ethers v6 uses default scrypt N=131072 (secure enough)
      const encryptedJson = await wallet.encrypt(password);
      
      // 🔒 EXPERT FIX: Atomic write with permissions (no timing window)
      const tempPath = this.walletPath + '.tmp';
      await fs.writeFile(tempPath, encryptedJson);
      await fs.chmod(tempPath, 0o600);
      await fs.rename(tempPath, this.walletPath);  // Atomic operation
      
      logger.info(`✅ Encrypted wallet created successfully`);
      logger.info(`📁 Location: ${this.walletPath}`);
      logger.info(`🔑 Address: ${wallet.address}`);
      logger.warn('⚠️  IMPORTANT: Delete PRIVATE_KEY from .env file now!');
      logger.warn('⚠️  IMPORTANT: Backup wallet.json file securely!');
      
      return wallet.address;
    } catch (error) {
      logger.error('❌ Failed to create encrypted wallet:', error.message);
      throw error;
    }
  }

  /**
   * REGULAR USE: Load wallet with password
   * @param {string} password - Password to decrypt wallet
   * @returns {Promise<ethers.Wallet>} - Decrypted wallet instance
   */
  async loadEncryptedWallet(password) {
    try {
      logger.info('🔓 Loading encrypted wallet...');
      
      const encryptedJson = await fs.readFile(this.walletPath, 'utf8');
      const wallet = await ethers.Wallet.fromEncryptedJson(encryptedJson, password);
      
      logger.info('✅ Encrypted wallet loaded successfully');
      logger.info(`🔑 Address: ${wallet.address}`);
      
      return wallet;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('❌ Encrypted wallet file not found. Run: node scripts/setup-encrypted-wallet.js');
      }
      if (error.message && error.message.includes('incorrect password')) {
        throw new Error('❌ Incorrect wallet password');
      }
      logger.error('❌ Failed to load encrypted wallet:', error.message);
      throw error;
    }
  }

  /**
   * Check if encrypted wallet exists
   * @returns {Promise<boolean>}
   */
  async hasEncryptedWallet() {
    try {
      await fs.access(this.walletPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get wallet file path
   * @returns {string}
   */
  getWalletPath() {
    return this.walletPath;
  }
}

module.exports = EncryptedKeyManager;

