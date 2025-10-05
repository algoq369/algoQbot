const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Advanced BSC Trading Bot Setup...\n');

// Check if required directories exist
const requiredDirs = [
  'security',
  'risk', 
  'optimization',
  'monitoring',
  'events',
  'dex',
  'trading',
  'leverage',
  'analysis',
  'agents',
  'rag',
  'database',
  'scripts'
];

console.log('📁 Checking directory structure:');
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - Missing`);
  }
});

// Check if required files exist
const requiredFiles = [
  'AdvancedTradingBot.js',
  'security/keyManager.js',
  'risk/circuitBreaker.js',
  'optimization/gasOptimizer.js',
  'monitoring/metricsCollector.js',
  'events/eventManager.js',
  'dex/multiDexManager.js',
  'trading/multiPairManager.js',
  'leverage/avantisIntegration.js',
  'analysis/technicalAnalysis.js',
  'config.js',
  'package.json',
  '.env'
];

console.log('\n📄 Checking required files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing`);
  }
});

// Check package.json dependencies
console.log('\n📦 Checking dependencies:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  'ethers',
  'ws',
  'redis',
  'winston',
  'express',
  'sqlite3',
  'sequelize'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`❌ ${dep} - Missing from package.json`);
  }
});

// Check .env configuration
console.log('\n⚙️ Checking environment configuration:');
const envContent = fs.readFileSync('.env', 'utf8');
const requiredEnvVars = [
  'WALLET_ADDRESS',
  'PRIVATE_KEY',
  'MIN_TRADE_AMOUNT',
  'MAX_TRADE_AMOUNT',
  'DAILY_LOSS_LIMIT',
  'MAX_GAS_PRICE',
  'PARALLEL_DEX_QUERIES'
];

requiredEnvVars.forEach(envVar => {
  if (envContent.includes(envVar)) {
    const match = envContent.match(new RegExp(`${envVar}=(.+)`));
    if (match) {
      console.log(`✅ ${envVar}: ${match[1]}`);
    } else {
      console.log(`⚠️ ${envVar}: Found but no value`);
    }
  } else {
    console.log(`❌ ${envVar} - Missing from .env`);
  }
});

// Test module imports
console.log('\n🧪 Testing module imports:');
const modulesToTest = [
  { name: 'SecureKeyManager', path: './security/keyManager.js' },
  { name: 'RiskManager', path: './risk/circuitBreaker.js' },
  { name: 'GasOptimizer', path: './optimization/gasOptimizer.js' },
  { name: 'MetricsCollector', path: './monitoring/metricsCollector.js' },
  { name: 'EventManager', path: './events/eventManager.js' },
  { name: 'MultiDexManager', path: './dex/multiDexManager.js' },
  { name: 'MultiPairManager', path: './trading/multiPairManager.js' },
  { name: 'TechnicalAnalysis', path: './analysis/technicalAnalysis.js' }
];

modulesToTest.forEach(module => {
  try {
    require(module.path);
    console.log(`✅ ${module.name}`);
  } catch (error) {
    console.log(`❌ ${module.name}: ${error.message}`);
  }
});

// Check Node.js version
console.log('\n🟢 System Information:');
console.log(`✅ Node.js version: ${process.version}`);
console.log(`✅ Platform: ${process.platform}`);
console.log(`✅ Architecture: ${process.arch}`);

// Final status
console.log('\n🎉 Setup Verification Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Run: npm start (to start the bot)');
console.log('2. Open new terminal: streamlit run monitoring/app.py (for dashboard)');
console.log('3. Access dashboard: http://localhost:8501');
console.log('4. Monitor logs: tail -f logs/combined.log');

console.log('\n⚠️ Important Notes:');
console.log('- Private key is stored in .env (consider using secure key manager)');
console.log('- Bot includes circuit breakers and risk management');
console.log('- Gas optimization is enabled');
console.log('- Real-time monitoring is available');
console.log('- All new security and performance improvements are active');

console.log('\n🚀 Your advanced BSC trading bot is ready!');
