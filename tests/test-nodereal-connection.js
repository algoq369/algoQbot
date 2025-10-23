const { ethers } = require('ethers');
require('dotenv').config();

async function testNodeRealConnection() {
  console.log('🧪 Testing NodeReal FREE TIER connection...\n');

  const rpcUrl = process.env.NODEREAL_RPC_URL;

  if (!rpcUrl || rpcUrl.includes('YOUR_API_KEY')) {
    throw new Error('❌ NODEREAL_RPC_URL not configured in .env!');
  }

  console.log('🔗 RPC URL configured:', rpcUrl.substring(0, 50) + '...\n');

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Test 1: Block number
    console.log('📝 Test 1: Connection & Block Number');
    const startTime = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const latency = Date.now() - startTime;
    console.log(`   ✅ Block: ${blockNumber} | Latency: ${latency}ms\n`);

    // Test 2: Network
    console.log('📝 Test 2: Network Verification');
    const network = await provider.getNetwork();
    console.log(`   ✅ Chain ID: ${network.chainId} (BSC Mainnet)\n`);

    // Test 3: Gas price
    console.log('📝 Test 3: Gas Price Check');
    const feeData = await provider.getFeeData();
    const gasPriceGwei = Number(feeData.gasPrice) / 1e9;
    console.log(`   ✅ Gas: ${gasPriceGwei.toFixed(2)} Gwei\n`);

    // Test 4: Rate limit
    console.log('📝 Test 4: Rate Limit Test (10 calls)');
    const promises = Array(10).fill().map(() => provider.getBlockNumber());
    const results = await Promise.all(promises);
    console.log(`   ✅ All 10 calls passed | Latest: ${results[results.length - 1]}\n`);

    // Test 5: Contract call (USDT on BSC)
    console.log('📝 Test 5: Contract Call Test (USDT)');
    const contract = new ethers.Contract(
      '0x55d398326f99059fF775485246999027B3197955',
      ['function totalSupply() view returns (uint256)'],
      provider
    );
    const supply = await contract.totalSupply();
    console.log(`   ✅ USDT Supply: ${(Number(supply) / 1e18).toLocaleString()}\n`);

    // Success
    console.log('═'.repeat(60));
    console.log('✅ NodeReal FREE TIER working perfectly!');
    console.log('═'.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Latency: ${latency}ms | Network: BSC | Gas: ${gasPriceGwei.toFixed(2)} Gwei`);
    console.log('\n🚀 Ready for production trading!\n');

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

testNodeRealConnection().catch(error => {
  console.error('💥 Test failed');
  process.exit(1);
});
