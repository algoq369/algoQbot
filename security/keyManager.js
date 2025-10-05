const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class SecureKeyManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyPath = path.join(__dirname, '../.keys');
    this.ensureKeyDirectory();
  }

  ensureKeyDirectory() {
    if (!fs.existsSync(this.keyPath)) {
      fs.mkdirSync(this.keyPath, { mode: 0o700 }); // Secure directory permissions
    }
  }

  generateMasterKey() {
    return crypto.randomBytes(32); // 256-bit key
  }

  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
  }

  encryptPrivateKey(privateKey, password) {
    try {
      const salt = crypto.randomBytes(16);
      const key = this.deriveKey(password, salt);
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(salt); // Additional authenticated data

      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error('Error encrypting private key:', error);
      throw error;
    }
  }

  decryptPrivateKey(encryptedData, password) {
    try {
      const key = this.deriveKey(password, Buffer.from(encryptedData.salt, 'hex'));
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from(encryptedData.salt, 'hex'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting private key:', error);
      throw error;
    }
  }

  storeEncryptedKey(encryptedData, keyName = 'wallet') {
    const filePath = path.join(this.keyPath, `${keyName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(encryptedData, null, 2), { mode: 0o600 });
    logger.info(`Encrypted key stored securely: ${filePath}`);
  }

  loadEncryptedKey(keyName = 'wallet') {
    const filePath = path.join(this.keyPath, `${keyName}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Encrypted key file not found: ${filePath}`);
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }

  // Secure key initialization
  async initializeSecureWallet(privateKey, password) {
    try {
      logger.info('🔐 Initializing secure wallet storage...');
      
      // Encrypt the private key
      const encryptedData = this.encryptPrivateKey(privateKey, password);
      
      // Store encrypted key
      this.storeEncryptedKey(encryptedData);
      
      logger.info('✅ Wallet securely encrypted and stored');
      return true;
    } catch (error) {
      logger.error('❌ Error initializing secure wallet:', error);
      throw error;
    }
  }

  // Load and decrypt private key
  async loadSecureWallet(password) {
    try {
      logger.info('🔓 Loading secure wallet...');
      
      // Load encrypted data
      const encryptedData = this.loadEncryptedKey();
      
      // Decrypt private key
      const privateKey = this.decryptPrivateKey(encryptedData, password);
      
      logger.info('✅ Wallet securely loaded');
      return privateKey;
    } catch (error) {
      logger.error('❌ Error loading secure wallet:', error);
      throw error;
    }
  }

  // Validate key strength
  validatePrivateKey(privateKey) {
    // Check if it's a valid hex string
    if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error('Invalid private key format');
    }
    
    // Additional validation can be added here
    return true;
  }
}

module.exports = SecureKeyManager;
