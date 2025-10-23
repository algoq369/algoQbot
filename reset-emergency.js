#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         🔄 EMERGENCY SHUTDOWN RESET UTILITY               ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Check if bot is running
const { execSync } = require('child_process');
try {
  const botProcess = execSync('ps aux | grep "node AdvancedTradingBot.js" | grep -v grep', { encoding: 'utf8' });
  if (botProcess.trim()) {
    console.log('⚠️  Bot is currently running. Stopping it first...');
    execSync('pkill -f "node AdvancedTradingBot.js"', { stdio: 'inherit' });
    console.log('✅ Bot stopped');
  }
} catch (e) {
  console.log('ℹ️  Bot is not running');
}

// Reset emergency state by clearing the risk manager state
const riskManagerFile = path.join(__dirname, 'data', 'risk-manager-state.json');
const backupDir = path.join(__dirname, 'data', 'backups');

// Create backup directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Create backup if file exists
if (fs.existsSync(riskManagerFile)) {
  const timestamp = Date.now();
  const backupFile = path.join(backupDir, `risk-manager-state-${timestamp}.json`);
  fs.copyFileSync(riskManagerFile, backupFile);
  console.log(`📦 Backup created: ${backupFile}`);

  // Remove the state file
  fs.unlinkSync(riskManagerFile);
  console.log('🗑️  Emergency state file removed');
}

// Reset any other emergency-related files
const emergencyFiles = [
  'data/emergency-shutdown.json',
  'data/consecutive-errors.json',
  'data/risk-state.json'
];

emergencyFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const timestamp = Date.now();
    const backupFile = path.join(backupDir, `${path.basename(file)}-${timestamp}.json`);
    fs.copyFileSync(file, backupFile);
    fs.unlinkSync(file);
    console.log(`🗑️  Removed: ${file}`);
  }
});

console.log('');
console.log('✅ EMERGENCY RESET COMPLETE!');
console.log('');
console.log('📊 RESET SUMMARY:');
console.log('   Emergency Shutdown: ✅ CLEARED');
console.log('   Consecutive Errors: ✅ RESET');
console.log('   Error History: ✅ CLEARED');
console.log('   Daily Loss: ✅ RESET');
console.log('');
console.log('💡 NEXT STEPS:');
console.log('   1. Start the bot: npm start');
console.log('   2. Monitor logs: tail -f logs/combined.log');
console.log('   3. Check health: bot-health');
console.log('');
console.log('🎯 The bot should now start trading normally!');

