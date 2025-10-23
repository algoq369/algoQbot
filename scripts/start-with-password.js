#!/usr/bin/env node

/**
 * 🔐 SECURE BOT STARTUP - PASSWORD PROMPT
 * 
 * This script starts the bot and prompts for wallet password at runtime.
 * The password is NEVER saved to disk - only in memory during execution.
 * 
 * Usage:
 *   node scripts/start-with-password.js
 * 
 * Security:
 *   ✅ Password in memory only (cleared on exit)
 *   ✅ Not saved in .env or any file
 *   ✅ Process env cleared on shutdown
 */

const readline = require('readline');
const path = require('path');

// Load environment variables FIRST (before importing bot)
require('dotenv').config();

const logger = require('../logger');

/**
 * Prompt user for password securely
 */
async function promptPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    // Hide password input (not fully hidden, but best we can do without external libs)
    rl.question('🔐 Enter wallet password: ', (password) => {
      rl.close();
      resolve(password);
    });
  });
}

/**
 * Main startup function
 */
async function startBot() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                    ║');
    console.log('║          🚀 BSC TRADING BOT - SECURE STARTUP                       ║');
    console.log('║                                                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // 1. Check if encrypted wallet exists
    const fs = require('fs');
    const walletPath = path.join(__dirname, '..', 'wallet.json');
    
    if (!fs.existsSync(walletPath)) {
      console.error('❌ No encrypted wallet found!');
      console.error('');
      console.error('Please run: node scripts/setup-encrypted-wallet.js');
      console.error('');
      process.exit(1);
    }

    // 2. Check if password is in .env (FORBIDDEN - EXPERT FIX)
    if (process.env.WALLET_PASSWORD) {
      console.error('');
      console.error('╔════════════════════════════════════════════════════════════════╗');
      console.error('║                                                                ║');
      console.error('║  ❌ SECURITY ERROR: WALLET_PASSWORD FOUND IN .ENV FILE         ║');
      console.error('║                                                                ║');
      console.error('╚════════════════════════════════════════════════════════════════╝');
      console.error('');
      console.error('🔒 Storing passwords in .env is FORBIDDEN for security.');
      console.error('');
      console.error('What to do:');
      console.error('  1. Edit your .env file');
      console.error('  2. Delete the WALLET_PASSWORD line');
      console.error('  3. Save the file');
      console.error('  4. Restart the bot');
      console.error('');
      console.error('The bot will prompt for your password securely at startup.');
      console.error('');
      process.exit(1);  // 🔒 EXPERT FIX: No fallback allowed
    } else {
      // 3. Prompt for password securely
      const password = await promptPassword();
      
      if (!password || password.length < 8) {
        console.error('❌ Invalid password (minimum 8 characters required)');
        process.exit(1);
      }
      
      // Set password in process environment (memory only)
      process.env.WALLET_PASSWORD = password;
      console.log('✅ Password accepted');
      console.log('');
    }

    // 4. Verify shadow mode is enabled
    if (process.env.SHADOW_MODE_ENABLED !== 'true') {
      console.warn('⚠️  WARNING: Shadow mode is DISABLED!');
      console.warn('⚠️  This will execute REAL TRADES with REAL MONEY.');
      console.warn('');
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Are you sure you want to continue? (yes/no): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('Startup cancelled. Enable shadow mode in .env:');
        console.log('  SHADOW_MODE_ENABLED=true');
        process.exit(0);
      }
    } else {
      console.log('👻 Shadow Mode: ENABLED (safe - no real trades)');
      console.log('');
    }

    // 5. Import and start the bot
    console.log('🔄 Loading bot modules...');
    const AdvancedTradingBot = require('../AdvancedTradingBot');
    
    console.log('🚀 Starting trading bot...');
    console.log('');
    
    const bot = new AdvancedTradingBot();
    await bot.start();

    // 6. Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('');
      console.log('🛑 Shutdown signal received...');
      
      // Clear password from memory
      delete process.env.WALLET_PASSWORD;
      
      if (bot && bot.shutdown) {
        await bot.shutdown();
      }
      
      console.log('✅ Bot stopped gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('');
      console.log('🛑 Termination signal received...');
      
      // Clear password from memory
      delete process.env.WALLET_PASSWORD;
      
      if (bot && bot.shutdown) {
        await bot.shutdown();
      }
      
      console.log('✅ Bot stopped gracefully');
      process.exit(0);
    });

  } catch (error) {
    console.error('');
    console.error('❌ Failed to start bot:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    
    // Clear password from memory on error
    delete process.env.WALLET_PASSWORD;
    
    process.exit(1);
  }
}

// Start the bot
startBot().catch(error => {
  console.error('Fatal error:', error);
  delete process.env.WALLET_PASSWORD;
  process.exit(1);
});

