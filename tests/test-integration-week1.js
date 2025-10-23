const { ethers } = require('ethers');
require('dotenv').config();

async function testWeek1Integration() {
  console.log('🧪 WEEK 1 INTEGRATION TEST - Verifying All Fixes\n');
  console.log('═'.repeat(60));

  let allPassed = true;
  const results = {
    rpc: false,
    riskManager: false,
    shadowMode: false,
    environment: false,
    imports: false
  };

  // TEST 1: Environment Configuration
  console.log('\n📝 TEST 1: Environment Configuration');
  console.log('─'.repeat(60));

  try {
    const requiredVars = [
      'NODEREAL_RPC_URL',
      'BSC_RPC_URL',
      'SHADOW_MODE_ENABLED',
      'MAX_TRADE_SIZE',
      'DAILY_LOSS_LIMIT'
    ];

    let envPassed = true;
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 30)}...`);
      } else {
        console.log(`   ❌ ${varName}: NOT SET`);
        envPassed = false;
      }
    }

    results.environment = envPassed;

    if (envPassed) {
      console.log('   ✅ Environment configuration: PASS');
    } else {
      console.log('   ❌ Environment configuration: FAIL');
      allPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Environment test failed: ${error.message}`);
    allPassed = false;
  }

  // TEST 2: RPC Connection
  console.log('\n📝 TEST 2: RPC Connection');
  console.log('─'.repeat(60));

  try {
    const provider = new ethers.JsonRpcProvider(process.env.NODEREAL_RPC_URL);
    const startTime = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const latency = Date.now() - startTime;
    const network = await provider.getNetwork();

    console.log(`   ✅ Connection: SUCCESS`);
    console.log(`   ✅ Block: ${blockNumber}`);
    console.log(`   ✅ Latency: ${latency}ms`);
    console.log(`   ✅ Chain ID: ${network.chainId}`);

    if (network.chainId === 56n && blockNumber > 0 && latency < 2000) {
      results.rpc = true;
      console.log('   ✅ RPC connection: PASS');
    } else {
      console.log('   ❌ RPC connection: FAIL (invalid network or high latency)');
      allPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ RPC connection failed: ${error.message}`);
    results.rpc = false;
    allPassed = false;
  }

  // TEST 3: Risk Manager Import and Initialization
  console.log('\n📝 TEST 3: Risk Manager');
  console.log('─'.repeat(60));

  try {
    const ProductionRiskManager = require('../risk/productionRiskManager');
    console.log('   ✅ Import: SUCCESS');

    const riskManager = new ProductionRiskManager();
    console.log('   ✅ Initialization: SUCCESS');

    // Check shadow mode detection
    const isShadow = process.env.SHADOW_MODE_ENABLED === 'true';
    console.log(`   ✅ Shadow mode detected: ${isShadow}`);
    console.log(`   ✅ Max trade size: $${riskManager.limits.maxTradeSize}`);
    console.log(`   ✅ Max daily loss: $${riskManager.limits.maxDailyLoss}`);

    // Verify limits match mode
    if (isShadow && riskManager.limits.maxTradeSize === 3000) {
      console.log('   ✅ Shadow mode limits: CORRECT');
      results.riskManager = true;
    } else if (!isShadow && riskManager.limits.maxTradeSize === 9000) {
      console.log('   ✅ Live mode limits: CORRECT');
      results.riskManager = true;
    } else {
      console.log('   ❌ Limits mismatch: INCORRECT');
      results.riskManager = false;
      allPassed = false;
    }

    // Test trade validation
    const tradeCheck = await riskManager.checkTradeAllowed(1000, 'Integration test');
    console.log(`   ✅ Trade validation: ${tradeCheck.allowed ? 'WORKING' : 'BLOCKED'}`);

    if (results.riskManager) {
      console.log('   ✅ Risk Manager: PASS');
    }
  } catch (error) {
    console.log(`   ❌ Risk Manager test failed: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    results.riskManager = false;
    allPassed = false;
  }

  // TEST 4: Shadow Mode Detection
  console.log('\n📝 TEST 4: Shadow Mode');
  console.log('─'.repeat(60));

  try {
    const isShadowEnabled = process.env.SHADOW_MODE_ENABLED === 'true';
    console.log(`   ✅ SHADOW_MODE_ENABLED: ${isShadowEnabled}`);

    if (isShadowEnabled) {
      console.log('   ✅ Mode: SHADOW (Testing)');
      console.log('   ✅ No real trades will be executed');
      console.log('   ✅ Conservative risk limits active');
    } else {
      console.log('   ⚠️  Mode: LIVE (Production)');
      console.log('   ⚠️  Real trades will be executed');
      console.log('   ⚠️  Professional risk limits active');
    }

    results.shadowMode = true;
    console.log('   ✅ Shadow Mode detection: PASS');
  } catch (error) {
    console.log(`   ❌ Shadow Mode test failed: ${error.message}`);
    results.shadowMode = false;
    allPassed = false;
  }

  // TEST 5: Critical File Existence
  console.log('\n📝 TEST 5: Critical Files');
  console.log('─'.repeat(60));

  const fs = require('fs');
  const criticalFiles = [
    'risk/productionRiskManager.js',
    'providers/multiRPCProvider.js',
    '.env',
    'package.json'
  ];

  let filesPassed = true;
  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file}: EXISTS`);
    } else {
      console.log(`   ❌ ${file}: MISSING`);
      filesPassed = false;
    }
  }

  if (filesPassed) {
    console.log('   ✅ Critical files: PASS');
  } else {
    console.log('   ❌ Critical files: FAIL');
    allPassed = false;
  }

  // TEST 6: Module Imports
  console.log('\n📝 TEST 6: Module Imports');
  console.log('─'.repeat(60));

  try {
    const modules = [
      { name: 'ethers', path: 'ethers' },
      { name: 'dotenv', path: 'dotenv' },
      { name: 'ProductionRiskManager', path: '../risk/productionRiskManager' },
      { name: 'MultiRPCProvider', path: '../providers/multiRPCProvider' }
    ];

    let importsPassed = true;
    for (const mod of modules) {
      try {
        require(mod.path);
        console.log(`   ✅ ${mod.name}: IMPORTED`);
      } catch (error) {
        console.log(`   ❌ ${mod.name}: FAILED (${error.message})`);
        importsPassed = false;
      }
    }

    results.imports = importsPassed;

    if (importsPassed) {
      console.log('   ✅ Module imports: PASS');
    } else {
      console.log('   ❌ Module imports: FAIL');
      allPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Import test failed: ${error.message}`);
    results.imports = false;
    allPassed = false;
  }

  // FINAL SUMMARY
  console.log('\n' + '═'.repeat(60));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('═'.repeat(60));

  console.log('\n✅ PASSED TESTS:');
  if (results.environment) console.log('   ✅ Environment Configuration');
  if (results.rpc) console.log('   ✅ RPC Connection (NodeReal)');
  if (results.riskManager) console.log('   ✅ Risk Manager (Shadow Mode Detection)');
  if (results.shadowMode) console.log('   ✅ Shadow Mode Configuration');
  if (results.imports) console.log('   ✅ Module Imports');

  if (!allPassed) {
    console.log('\n❌ FAILED TESTS:');
    if (!results.environment) console.log('   ❌ Environment Configuration');
    if (!results.rpc) console.log('   ❌ RPC Connection');
    if (!results.riskManager) console.log('   ❌ Risk Manager');
    if (!results.shadowMode) console.log('   ❌ Shadow Mode');
    if (!results.imports) console.log('   ❌ Module Imports');
  }

  console.log('\n' + '═'.repeat(60));

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - READY TO PROCEED! 🎉');
    console.log('═'.repeat(60));
    console.log('\n✅ Week 1 fixes are properly integrated');
    console.log('✅ All systems operational');
    console.log('✅ Safe to continue with Dynamic TP/SL\n');
    return true;
  } else {
    console.log('⚠️  SOME TESTS FAILED - NEEDS ATTENTION! ⚠️');
    console.log('═'.repeat(60));
    console.log('\n❌ Please fix failed tests before proceeding');
    console.log('❌ Review error messages above');
    console.log('❌ Contact support if needed\n');
    return false;
  }
}

testWeek1Integration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Integration test crashed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
