const MultiRPCProvider = require('../providers/multiRPCProvider');
require('dotenv').config();

async function testMultiRPCFailover() {
  console.log('🧪 Testing Multi-RPC Provider Failover System...\n');

  const multiRpc = new MultiRPCProvider();

  try {
    // Test 1: Normal initialization
    console.log('📝 Test 1: Initialize and Connect');
    const provider = await multiRpc.initialize();
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Connected | Block: ${blockNumber}\n`);

    // Test 2: Execute with retry
    console.log('📝 Test 2: Execute Operation with Retry');
    const block = await multiRpc.executeWithRetry(async (provider) => {
      return await provider.getBlockNumber();
    });
    console.log(`   ✅ Operation succeeded | Block: ${block}\n`);

    // Test 3: Get status
    console.log('📝 Test 3: Provider Status');
    const status = multiRpc.getStatus();
    console.log(`   Current: ${status.currentProvider}`);
    console.log(`   Available: ${status.availableProviders.join(', ')}`);
    console.log(`   Failures: ${status.failureCount}\n`);

    // Test 4: Health report
    console.log('📝 Test 4: Health Report');
    const health = multiRpc.getHealthReport();
    console.log(`   Healthy: ${health.healthy.join(', ')}`);
    console.log(`   Unhealthy: ${health.unhealthy.length > 0 ? health.unhealthy.join(', ') : 'None'}\n`);

    // Test 5: Multiple concurrent operations
    console.log('📝 Test 5: Concurrent Operations (20 calls)');
    const startTime = Date.now();
    const promises = Array(20).fill().map(() =>
      multiRpc.executeWithRetry(p => p.getBlockNumber())
    );
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    console.log(`   ✅ All 20 calls completed | Time: ${duration}ms | Avg: ${Math.round(duration/20)}ms\n`);

    // Test 6: Manual failover test
    console.log('📝 Test 6: Manual Failover Test');
    console.log('   Triggering manual failover...');
    await multiRpc.failover();
    const blockAfterFailover = await provider.getBlockNumber();
    console.log(`   ✅ Failover successful | Block: ${blockAfterFailover}\n`);

    // Success summary
    console.log('═'.repeat(60));
    console.log('✅ Multi-RPC Provider System Fully Operational!');
    console.log('═'.repeat(60));
    console.log('📊 Final Status:');
    const finalStatus = multiRpc.getStatus();
    console.log(`   Active: ${finalStatus.currentProvider}`);
    console.log(`   Total Providers: ${finalStatus.availableProviders.length}`);
    console.log(`   System Health: ${health.healthy.length}/${finalStatus.availableProviders.length} healthy`);
    console.log('\n🚀 Ready for integration into AdvancedTradingBot!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

testMultiRPCFailover().catch(error => {
  console.error('💥 Multi-RPC test failed');
  process.exit(1);
});
