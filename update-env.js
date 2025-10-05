const fs = require('fs');
const path = require('path');

// Read current .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// New configuration to add
const newConfig = `
# Risk Management Configuration
DAILY_LOSS_LIMIT=50
MAX_POSITION_SIZE=0.1
MAX_CONSECUTIVE_LOSSES=5
EMERGENCY_STOP_THRESHOLD=100
VOLATILITY_THRESHOLD=0.05
MAX_DRAWDOWN=0.2

# Gas Optimization Configuration
MAX_GAS_PRICE=20
MIN_GAS_PRICE=1
GAS_PRICE_MULTIPLIER=1.1
MAX_GAS_LIMIT=500000
GAS_RETRY_ATTEMPTS=3

# Performance Configuration
PARALLEL_DEX_QUERIES=true
MAX_LATENCY=5000
CACHE_TIMEOUT=5
WS_RECONNECT_ATTEMPTS=10`;

// Update trading configuration
let updatedContent = envContent
  .replace('MIN_TRADE_AMOUNT=1', 'MIN_TRADE_AMOUNT=5')
  .replace('MAX_TRADE_AMOUNT=10', 'MAX_TRADE_AMOUNT=20');

// Add new configuration after DEX Configuration
const dexConfigIndex = updatedContent.indexOf('# DEX Configuration');
if (dexConfigIndex !== -1) {
  const insertIndex = updatedContent.indexOf('\n', dexConfigIndex);
  updatedContent = updatedContent.slice(0, insertIndex) + newConfig + updatedContent.slice(insertIndex);
} else {
  // If DEX Configuration not found, add at the end
  updatedContent += newConfig;
}

// Write updated .env file
fs.writeFileSync(envPath, updatedContent);
console.log('✅ .env file updated with new configuration options');
console.log('📋 Added configurations:');
console.log('   - Risk Management settings');
console.log('   - Gas Optimization settings');
console.log('   - Performance settings');
console.log('   - Updated trading amounts');
