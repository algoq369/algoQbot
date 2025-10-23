#!/usr/bin/env node

/**
 * 👻 SAFE START SCRIPT - Shadow Mode Verification
 * 
 * This script verifies that shadow mode is properly configured
 * before starting the trading bot. It prevents accidental live trading.
 */

require('dotenv').config();
const logger = require('./logger');

console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║              👻 SHADOW MODE VERIFICATION & START                    ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
`);

// Check shadow mode configuration
function verifyShadowMode() {
  const shadowModeEnabled = process.env.SHADOW_MODE_ENABLED === 'true';
  const shadowModeRecord = process.env.SHADOW_MODE_RECORD === 'true';
  
  console.log('\n🔍 CONFIGURATION CHECK\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Network:           ${process.env.BSC_CHAIN_ID === '56' ? '⚠️  BSC Mainnet (REAL)' : '✅ Testnet'}`);
  console.log(`RPC URL:           ${process.env.BSC_RPC_URL}`);
  console.log(`Trading Pair:      ${process.env.TRADING_PAIR || 'USDT/BNB'}`);
  console.log(`Initial Budget:    ${process.env.INITIAL_BUDGET || 100} USDT`);
  console.log(`Shadow Mode:       ${shadowModeEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`Record Trades:     ${shadowModeRecord ? '✅ YES' : '❌ NO'}`);
  console.log(`Record Path:       ${process.env.SHADOW_MODE_RECORD_PATH || './.shadow-trades.json'}`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return shadowModeEnabled;
}

// Display mode information
function displayModeInfo(isShadowMode) {
  if (isShadowMode) {
    console.log(`
✅ SHADOW MODE ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Your bot will:
  ✅ Connect to BSC Mainnet (read prices)
  ✅ Monitor markets 24/7
  ✅ Identify trading opportunities
  ✅ Calculate expected profits
  ✅ Simulate all trades
  ✅ Record data to ${process.env.SHADOW_MODE_RECORD_PATH || './.shadow-trades.json'}
  ✅ Generate performance reports
  
  Your bot will NOT:
  ❌ Execute real trades
  ❌ Send blockchain transactions
  ❌ Spend your money
  ❌ Pay gas fees

  This is SAFE MODE - Perfect for validation! 🛡️

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } else {
    console.log(`
⚠️  LIVE TRADING MODE DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🚨 WARNING: Your bot is configured for LIVE TRADING!
  
  Starting the bot now will:
  💰 Execute REAL trades
  💰 Spend REAL money (${process.env.INITIAL_BUDGET || 100} USDT budget)
  💰 Use your REAL wallet
  💰 Pay REAL gas fees
  
  ⚠️  This is NOT recommended until after shadow mode validation!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  }
}

// Confirmation prompt
function askConfirmation(isShadowMode) {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const message = isShadowMode 
      ? '\n👻 Start bot in SHADOW MODE? (yes/no): '
      : '\n⚠️  Start bot in LIVE TRADING mode? Type "CONFIRM LIVE TRADING" to proceed: ';
    
    rl.question(message, (answer) => {
      rl.close();
      
      if (isShadowMode) {
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      } else {
        resolve(answer === 'CONFIRM LIVE TRADING');
      }
    });
  });
}

// Start the bot
async function startBot() {
  try {
    const AdvancedTradingBot = require('./AdvancedTradingBot');
    const bot = new AdvancedTradingBot();
    
    console.log('\n🚀 Starting bot...\n');
    
    await bot.start();
    
    // Keep process running
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('\n❌ Error starting bot:', error.message);
    logger.error('Error starting bot:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const isShadowMode = verifyShadowMode();
  displayModeInfo(isShadowMode);
  
  const confirmed = await askConfirmation(isShadowMode);
  
  if (confirmed) {
    await startBot();
  } else {
    console.log('\n❌ Start cancelled by user.\n');
    console.log('To enable shadow mode, add this to your .env file:');
    console.log('  SHADOW_MODE_ENABLED=true');
    console.log('\nThen run this script again.\n');
    process.exit(0);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

