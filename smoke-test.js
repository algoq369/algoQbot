const fs = require('fs');

console.log('🔥 SMOKE TEST: Institutional Trading Tools\n');
console.log('Testing basic functionality before comprehensive unit tests...\n');

let passed = 0;
let failed = 0;

// ═══════════════════════════════════════════════════════════════
// TEST 1: ORDER FLOW
// ═══════════════════════════════════════════════════════════════
try {
  console.log('📊 Testing Order Flow...');
  const OrderFlow = require('./utils/orderFlow');
  const orderFlow = new OrderFlow({ minSwapsForSignal: 2 });

  const testSwaps = [
    { amount0Out: '1000', amount0In: '0' },
    { amount0Out: '0', amount0In: '500' }
  ];

  const result = orderFlow.calculateDelta(testSwaps);

  if (result.delta === 500 &&
      result.buyVolume === 1000 &&
      result.sellVolume === 500 &&
      result.status === 'SUCCESS') {
    console.log('  ✅ Calculation: PASS (delta=500, buy=1000, sell=500)');
    passed++;
  } else {
    throw new Error(`Unexpected result: delta=${result.delta}, status=${result.status}`);
  }

  const errorResult = orderFlow.calculateDelta(null);
  if (errorResult.status === 'INVALID_INPUT') {
    console.log('  ✅ Error handling: PASS');
    passed++;
  } else {
    throw new Error('Error handling failed');
  }

} catch (error) {
  console.log(`  ❌ Order Flow: FAIL - ${error.message}`);
  failed += 2;
}

// ═══════════════════════════════════════════════════════════════
// TEST 2: VOLUME PROFILE
// ═══════════════════════════════════════════════════════════════
try {
  console.log('\n📈 Testing Volume Profile...');
  const VolumeProfile = require('./utils/volumeProfile');
  const volumeProfile = new VolumeProfile({ minSwapsForProfile: 2 });

  const testSwaps = [
    { amount0In: '100', amount1Out: '0.5' },  // price = 200
    { amount0In: '200', amount1Out: '1.0' }   // price = 200
  ];

  const profile = volumeProfile.buildProfile(testSwaps);

  if (profile.status === 'SUCCESS' && profile.poc === 200) {
    console.log(`  ✅ POC calculation: PASS (POC=${profile.poc}, processed=${profile.processedSwaps} swaps)`);
    passed++;
  } else {
    throw new Error(`POC calculation failed: poc=${profile.poc}, status=${profile.status}`);
  }

  const errorProfile = volumeProfile.buildProfile([]);
  if (errorProfile.status === 'INSUFFICIENT_DATA') {
    console.log('  ✅ Error handling: PASS');
    passed++;
  } else {
    throw new Error('Error handling failed');
  }

} catch (error) {
  console.log(`  ❌ Volume Profile: FAIL - ${error.message}`);
  failed += 2;
}

// ═══════════════════════════════════════════════════════════════
// TEST 3: LIQUIDITY ANALYSIS
// ═══════════════════════════════════════════════════════════════
try {
  console.log('\n💧 Testing Liquidity Analysis...');
  const Liquidity = require('./utils/liquidity');
  const liquidity = new Liquidity({ minReserves: 1000 });

  const validReserves = liquidity.validateReserves(10000, 5000);
  if (validReserves.isValid && validReserves.status === 'VALID') {
    console.log('  ✅ Reserve validation: PASS (valid reserves detected)');
    passed++;
  } else {
    throw new Error('Reserve validation failed for valid inputs');
  }

  const invalidReserves = liquidity.validateReserves(0, 5000);
  if (!invalidReserves.isValid && invalidReserves.status === 'ZERO_RESERVES') {
    console.log('  ✅ Error detection: PASS (rejected zero reserves)');
    passed++;
  } else {
    throw new Error('Should reject zero reserves');
  }

} catch (error) {
  console.log(`  ❌ Liquidity: FAIL - ${error.message}`);
  failed += 2;
}

// ═══════════════════════════════════════════════════════════════
// TEST 4: FILE STRUCTURE
// ═══════════════════════════════════════════════════════════════
console.log('\n📁 Checking file structure...');

const requiredFiles = [
  'utils/orderFlow.js',
  'utils/volumeProfile.js',
  'utils/liquidity.js',
  'tests/orderFlow.test.js',
  'tests/volumeProfile.test.js',
  'tests/liquidity.test.js',
  'tests/integration.test.js'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
    passed++;
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    failed++;
  }
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('🎯 SMOKE TEST RESULTS');
console.log('═'.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('═'.repeat(60));

if (failed === 0) {
  console.log('\n🎉 SUCCESS! All smoke tests passed.');
  console.log('\n📝 Next steps:');
  console.log('   1. Install Jest: npm install --save-dev jest');
  console.log('   2. Run comprehensive tests: npm test');
  console.log('   3. If all pass → Ready for Part 2 (integration)\n');
  process.exit(0);
} else {
  console.log('\n❌ FAILED! Fix the errors above before proceeding.');
  console.log('\n🔧 Troubleshooting:');
  console.log('   - Check that all files were created correctly');
  console.log('   - Verify no syntax errors in the code');
  console.log('   - Ensure utils/logger.js exists and works\n');
  process.exit(1);
}
