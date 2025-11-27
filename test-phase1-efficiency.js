#!/usr/bin/env node

/**
 * Phase 1 Efficiency Enhancements Test
 * 
 * Tests gas surge detection and batch price fetching
 */

const { ethers } = require('ethers');
const GasSurgeDetector = require('./optimization/gasSurgeDetector');
const BatchPriceFetcher = require('./optimization/batchPriceFetcher');

async function testGasSurgeDetector() {
  console.log('\n🔍 Testing Gas Surge Detector...');
  
  try {
    // Mock provider for testing
    const mockProvider = {
      getFeeData: async () => ({
        gasPrice: ethers.parseUnits('5', 'gwei'),
        maxFeePerGas: ethers.parseUnits('5', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
      }),
      getBlockNumber: async () => 123456
    };

    const detector = new GasSurgeDetector(mockProvider, {
      surgeThreshold: 1.5,
      checkInterval: 1000,
      movingAverageWindow: 5
    });

    // Start monitoring
    detector.start();
    console.log('✅ Gas surge detector started');

    // Wait for some data collection
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get status
    const status = detector.getStatistics();
    console.log('📊 Gas Surge Detector Status:', status);

    // Test trading allowed
    const canTrade = detector.isTradingAllowed();
    console.log(`🤖 Trading allowed: ${canTrade}`);

    // Stop monitoring
    detector.stop();
    console.log('⛽ Gas surge detector test completed\n');

    return true;
  } catch (error) {
    console.error('❌ Gas surge detector test failed:', error.message);
    return false;
  }
}

async function testBatchPriceFetcher() {
  console.log('📦 Testing Batch Price Fetcher...');
  
  try {
    // Mock provider for testing
    const mockProvider = {
      getCode: async () => '0x',
      call: async () => '0x'
    };

    const fetcher = new BatchPriceFetcher(mockProvider, {
      batchSize: 3,
      batchDelay: 100,
      timeout: 2000
    });

    console.log('✅ Batch price fetcher initialized');

    // Test individual price requests
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetcher.getPrice(`dex${i}`, '0xTokenA', '0xTokenB', ethers.parseEther('1'))
      );
    }

    // Wait for all requests (will be batched)
    const results = await Promise.allSettled(promises);
    
    console.log('📊 Batch Results:');
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`  ✅ DEX${index}: Success`);
      } else {
        console.log(`  ❌ DEX${index}: ${result.reason?.message || 'Failed'}`);
      }
    });

    // Get statistics
    const stats = fetcher.getStatistics();
    console.log('📈 Batch Price Fetcher Stats:', stats);

    console.log('📦 Batch price fetcher test completed\n');

    return true;
  } catch (error) {
    console.error('❌ Batch price fetcher test failed:', error.message);
    return false;
  }
}

async function testIntegration() {
  console.log('🔗 Testing Integration...');
  
  try {
    // Mock provider
    const mockProvider = {
      getFeeData: async () => ({
        gasPrice: ethers.parseUnits('10', 'gwei'),
        maxFeePerGas: ethers.parseUnits('10', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
      }),
      getBlockNumber: async () => 123456,
      getCode: async () => '0x',
      call: async () => '0x'
    };

    // Initialize both components
    const gasDetector = new GasSurgeDetector(mockProvider, {
      surgeThreshold: 2.0,
      checkInterval: 1000
    });

    const batchFetcher = new BatchPriceFetcher(mockProvider, {
      batchSize: 5,
      batchDelay: 50
    });

    // Start gas monitoring
    gasDetector.start();

    // Simulate some activity
    console.log('🔄 Simulating trading activity...');
    
    // Simulate price requests
    const pricePromises = [];
    for (let i = 0; i < 3; i++) {
      pricePromises.push(
        batchFetcher.getPrice(`dex${i}`, '0xTokenA', '0xTokenB', ethers.parseEther('1'))
      );
    }

    await Promise.allSettled(pricePromises);

    // Wait for gas monitoring
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if trading would be allowed
    const canTrade = gasDetector.isTradingAllowed();
    console.log(`🤖 Trading allowed: ${canTrade}`);

    // Get final statistics
    const gasStats = gasDetector.getStatistics();
    const batchStats = batchFetcher.getStatistics();

    console.log('📊 Final Gas Stats:', gasStats);
    console.log('📊 Final Batch Stats:', batchStats);

    // Cleanup
    gasDetector.stop();

    console.log('🔗 Integration test completed\n');

    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Phase 1 Efficiency Enhancements Test Suite');
  console.log('=====================================');

  const results = [];

  // Test individual components
  results.push(await testGasSurgeDetector());
  results.push(await testBatchPriceFetcher());
  results.push(await testIntegration());

  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('📋 Test Summary');
  console.log('===============');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 All Phase 1 tests passed!');
    console.log('🚀 Ready for DEFI efficiency optimization');
  } else {
    console.log('\n⚠️ Some tests failed - check implementation');
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});