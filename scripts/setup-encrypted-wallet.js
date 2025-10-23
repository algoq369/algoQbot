const EncryptedKeyManager = require('../security/encryptedKeyManager');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         🔐 ENCRYPTED WALLET SETUP                          ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('⚠️  This will encrypt your private key and store it securely.');
  console.log('⚠️  After setup, you can delete PRIVATE_KEY from .env\n');

  try {
    // Check if wallet already exists
    const keyManager = new EncryptedKeyManager();
    const hasWallet = await keyManager.hasEncryptedWallet();
    
    if (hasWallet) {
      const overwrite = await question('⚠️  Encrypted wallet already exists. Overwrite? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes') {
        console.log('\n✅ Keeping existing wallet. Exiting...\n');
        rl.close();
        return;
      }
    }

    // Get private key
    const privateKey = await question('\n🔑 Enter your private key (66 chars with 0x): ');
    
    if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
      console.error('\n❌ Invalid private key format. Must be 66 characters starting with 0x');
      console.error('   Example: 0x1234567890abcdef...\n');
      rl.close();
      process.exit(1);
    }

    // Get password
    const password = await question('\n🔒 Enter encryption password (min 12 chars): ');
    
    if (password.length < 12) {
      console.error('\n❌ Password must be at least 12 characters for security\n');
      rl.close();
      process.exit(1);
    }

    const confirmPassword = await question('🔒 Confirm password: ');
    
    if (password !== confirmPassword) {
      console.error('\n❌ Passwords do not match\n');
      rl.close();
      process.exit(1);
    }

    // Create encrypted wallet
    console.log('\n⏳ Encrypting wallet (this may take 10-15 seconds)...\n');
    
    const address = await keyManager.createEncryptedWallet(privateKey, password);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║                    ✅ SUCCESS!                              ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📍 Wallet address: ${address}`);
    console.log(`📁 Encrypted file: ${keyManager.getWalletPath()}\n`);
    
    console.log('⚠️  IMPORTANT NEXT STEPS:\n');
    console.log('1. Open your .env file');
    console.log('2. REMOVE this line: PRIVATE_KEY=...');
    console.log('3. ADD this line:    WALLET_PASSWORD=your_password_here');
    console.log('4. Save your password somewhere SAFE (password manager)');
    console.log('5. Backup wallet.json file to external storage');
    console.log('6. NEVER commit wallet.json to git');
    console.log('7. NEVER share wallet.json + password together\n');
    
    console.log('✅ You can now start the bot - it will use encrypted wallet\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message, '\n');
    rl.close();
    process.exit(1);
  }

  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

