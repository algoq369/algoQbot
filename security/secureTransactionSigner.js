const { ethers } = require('ethers');
const logger = require('../logger');

class SecureTransactionSigner {
  constructor(options = {}) {
    this.method = options.method || 'kms';
    this.region = options.region || 'us-east-1';
    this.keyId = options.keyId || process.env.AWS_KMS_KEY_ID;
    this.address = null;
    this.isInitialized = false;
    
    // Initialize AWS KMS if using KMS method
    if (this.method === 'kms') {
      try {
        const AWS = require('aws-sdk');
        this.kms = new AWS.KMS({ region: this.region });
        logger.info('🔐 AWS KMS initialized for secure signing');
      } catch (error) {
        logger.error('❌ Failed to initialize AWS KMS:', error);
        throw error;
      }
    }
    
    // Metrics for monitoring
    this.metrics = {
      kmsSigningErrors: 0,
      kmsSigningSuccess: 0,
      ledgerSigningErrors: 0,
      ledgerSigningSuccess: 0,
      totalSigningTime: 0,
      averageSigningTime: 0
    };
    
    logger.info(`🚀 Secure Transaction Signer initialized with method: ${this.method}`);
  }

  // Initialize the secure signing method
  async initialize(method = this.method) {
    try {
      switch (method) {
        case 'kms':
          return await this.initializeKMS();
        case 'ledger':
          return await this.initializeLedger();
        case 'enclave':
          return await this.initializeEnclave();
        default:
          throw new Error(`Invalid signing method: ${method}`);
      }
    } catch (error) {
      logger.error(`❌ Failed to initialize ${method}:`, error);
      throw error;
    }
  }

  // Initialize AWS KMS
  async initializeKMS() {
    if (!this.keyId) {
      throw new Error('AWS_KMS_KEY_ID not configured');
    }
    
    try {
      // Get public key from KMS
      const { PublicKey } = await this.kms.getPublicKey({ KeyId: this.keyId }).promise();
      
      // Derive Ethereum address from public key
      this.address = this.deriveAddressFromPublicKey(PublicKey);
      this.isInitialized = true;
      
      logger.info(`✅ KMS initialized, address: ${this.address}`);
      
    } catch (error) {
      logger.error('❌ KMS initialization failed:', error);
      throw error;
    }
  }

  // Initialize Ledger hardware wallet
  async initializeLedger() {
    try {
      const TransportWebUSB = await import('@ledgerhq/hw-transport-webusb');
      const Eth = await import('@ledgerhq/hw-app-eth');
      
      this.transport = await TransportWebUSB.create();
      this.ledger = new Eth(this.transport);
      
      // Get address from Ledger
      const result = await this.ledger.getAddress("44'/60'/0'/0/0");
      this.address = result.address;
      this.isInitialized = true;
      
      logger.info(`✅ Ledger initialized, address: ${this.address}`);
      
    } catch (error) {
      logger.error('❌ Ledger initialization failed:', error);
      throw error;
    }
  }

  // Initialize secure enclave (placeholder for future implementation)
  async initializeEnclave() {
    // This would integrate with hardware secure enclaves
    // For now, throw an error indicating it's not implemented
    throw new Error('Secure enclave signing not yet implemented');
  }

  // Sign transaction with the selected method
  async signTransaction(transaction) {
    if (!this.isInitialized) {
      throw new Error('Secure signer not initialized');
    }
    
    const startTime = performance.now();
    
    try {
      let signedTx;
      
      switch (this.method) {
        case 'kms':
          signedTx = await this.signWithKMS(transaction);
          break;
        case 'ledger':
          signedTx = await this.signWithLedger(transaction);
          break;
        default:
          throw new Error(`Unsupported signing method: ${this.method}`);
      }
      
      const signingTime = performance.now() - startTime;
      this.metrics.totalSigningTime += signingTime;
      this.metrics.averageSigningTime = this.metrics.totalSigningTime / (this.metrics.kmsSigningSuccess + this.metrics.ledgerSigningSuccess);
      
      logger.info(`✅ Transaction signed in ${signingTime.toFixed(2)}ms`);
      return signedTx;
      
    } catch (error) {
      const signingTime = performance.now() - startTime;
      logger.error(`❌ Transaction signing failed after ${signingTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  // Sign transaction with AWS KMS
  async signWithKMS(transaction) {
    try {
      // Serialize transaction for signing
      const txData = ethers.utils.serializeTransaction(transaction);
      const txHash = ethers.utils.keccak256(txData);
      
      // Sign with KMS (private key never leaves AWS)
      const { Signature } = await this.kms.sign({
        KeyId: this.keyId,
        Message: Buffer.from(txHash.slice(2), 'hex'),
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256'
      }).promise();
      
      // Parse KMS signature
      const { r, s, v } = this.parseKMSSignature(Signature);
      
      // Add signature to transaction
      transaction.r = r;
      transaction.s = s;
      transaction.v = v;
      
      // Serialize signed transaction
      const signedTx = ethers.utils.serializeTransaction(transaction);
      
      this.metrics.kmsSigningSuccess++;
      return signedTx;
      
    } catch (error) {
      this.metrics.kmsSigningErrors++;
      logger.error('❌ KMS signing failed:', error);
      throw error;
    }
  }

  // Sign transaction with Ledger
  async signWithLedger(transaction) {
    try {
      const txData = ethers.utils.serializeTransaction(transaction);
      
      // Sign with Ledger
      const signature = await this.ledger.signTransaction(
        "44'/60'/0'/0/0",
        txData
      );
      
      // Add signature to transaction
      transaction.r = '0x' + signature.r;
      transaction.s = '0x' + signature.s;
      transaction.v = parseInt(signature.v, 16);
      
      // Serialize signed transaction
      const signedTx = ethers.utils.serializeTransaction(transaction);
      
      this.metrics.ledgerSigningSuccess++;
      return signedTx;
      
    } catch (error) {
      this.metrics.ledgerSigningErrors++;
      logger.error('❌ Ledger signing failed:', error);
      throw error;
    }
  }

  // Parse KMS signature to Ethereum format
  parseKMSSignature(signature) {
    // KMS returns DER-encoded signature, convert to Ethereum format
    const decoded = this.derDecode(signature);
    
    return {
      r: '0x' + decoded.r.toString('hex'),
      s: '0x' + decoded.s.toString('hex'),
      v: 27 // Ethereum uses 27/28
    };
  }

  // DER decode signature (simplified implementation)
  derDecode(signature) {
    // This is a simplified DER decoder
    // In production, use a proper ASN.1 library
    const buffer = Buffer.from(signature);
    
    // Skip DER header and extract r, s values
    let offset = 4; // Skip DER header
    
    // Extract r
    const rLength = buffer[offset + 1];
    const r = buffer.slice(offset + 2, offset + 2 + rLength);
    offset += 2 + rLength;
    
    // Extract s
    const sLength = buffer[offset + 1];
    const s = buffer.slice(offset + 2, offset + 2 + sLength);
    
    return { r, s };
  }

  // Derive Ethereum address from public key
  deriveAddressFromPublicKey(publicKey) {
    // Remove DER header and extract public key
    const keyBuffer = Buffer.from(publicKey);
    const publicKeyBytes = keyBuffer.slice(1); // Skip DER header
    
    // Hash public key with Keccak-256
    const hash = ethers.utils.keccak256(publicKeyBytes);
    
    // Take last 20 bytes as address
    return '0x' + hash.slice(-40);
  }

  // Get signer statistics
  getStats() {
    return {
      method: this.method,
      isInitialized: this.isInitialized,
      address: this.address,
      metrics: {
        ...this.metrics,
        averageSigningTime: this.metrics.averageSigningTime.toFixed(2) + 'ms'
      }
    };
  }

  // Health check
  healthCheck() {
    const totalSignings = this.metrics.kmsSigningSuccess + this.metrics.ledgerSigningSuccess;
    const totalErrors = this.metrics.kmsSigningErrors + this.metrics.ledgerSigningErrors;
    const errorRate = totalSignings > 0 ? (totalErrors / totalSignings * 100) : 0;
    
    const healthy = this.isInitialized && errorRate < 10;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      isInitialized: this.isInitialized,
      method: this.method,
      address: this.address,
      errorRate: errorRate.toFixed(2) + '%',
      totalSignings: totalSignings,
      totalErrors: totalErrors,
      averageSigningTime: this.metrics.averageSigningTime.toFixed(2) + 'ms'
    };
  }

  // Cleanup resources
  async cleanup() {
    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      
      this.isInitialized = false;
      logger.info('✅ Secure signer cleaned up');
      
    } catch (error) {
      logger.error('❌ Error during signer cleanup:', error);
    }
  }

  // Test signing capability
  async testSigning() {
    if (!this.isInitialized) {
      throw new Error('Signer not initialized');
    }
    
    try {
      // Create a test transaction
      const testTx = {
        to: '0x0000000000000000000000000000000000000000',
        value: ethers.utils.parseEther('0'),
        gasLimit: 21000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei'),
        nonce: 0
      };
      
      // Sign test transaction
      const signedTx = await this.signTransaction(testTx);
      
      logger.info('✅ Signing test successful');
      return true;
      
    } catch (error) {
      logger.error('❌ Signing test failed:', error);
      return false;
    }
  }
}

module.exports = SecureTransactionSigner;

