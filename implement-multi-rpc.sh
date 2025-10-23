#!/bin/bash

echo "🚀 Implementing Multi-RPC Provider System..."
echo ""

# Navigate to correct directory
cd ~/bsc-ranging-bot || { echo "❌ Error: bsc-ranging-bot not found"; exit 1; }
echo "✅ In directory: $(pwd)"
echo ""

# Create providers directory
mkdir -p providers
echo "✅ Created providers directory"
echo ""

# Create Multi-RPC Provider
cat > providers/multiRPCProvider.js << 'EOF'
const { ethers } = require('ethers');
const logger = require('../logger');

/**
 * Multi-RPC Provider with Automatic Failover
 * Manages multiple RPC endpoints with health monitoring and automatic failover
 */
class MultiRPCProvider {
  constructor() {
    // Priority order: fastest and most reliable first
    this.providers = [
      {
        name: 'NodeReal',
        url: process.env.NODEREAL_RPC_URL,
        priority: 1,
        maxRetries: 3,
        timeout: 30000
      },
      {
        name: 'Binance Public',
        url: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
        priority: 2,
        maxRetries: 2,
        timeout: 30000
      },
      {
        name: 'Binance Backup 1',
        url: 'https://bsc-dataseed2.binance.org',
        priority: 3,
        maxRetries: 2,
        timeout: 30000
      },
      {
        name: 'Binance Backup 2',
        url: 'https://bsc-dataseed3.binance.org',
        priority: 4,
        maxRetries: 1,
        timeout: 30000
      }
    ];

    this.currentProvider = null;
    this.currentProviderIndex = 0;
    this.failureCount = 0;
    this.lastFailoverTime = Date.now();
    this.healthStats = new Map();

    // Initialize health stats
    this.providers.forEach(p => {
      this.healthStats.set(p.name, {
        successCount: 0,
        failureCount: 0,
        lastSuccess: null,
        lastFailure: null,
        avgLatency: 0,
        isHealthy: true
      });
    });
  }

  async initialize() {
    logger.info('🔌 Initializing Multi-RPC Provider System...');

    // Filter out providers without URLs
    this.providers = this.providers.filter(p => p.url && !p.url.includes('undefined'));

    if (this.providers.length === 0) {
      throw new Error('❌ No RPC providers configured!');
    }

    logger.info(`📊 Found ${this.providers.length} RPC providers`);

    // Try each provider in priority order
    for (let i = 0; i < this.providers.length; i++) {
      try {
        const providerConfig = this.providers[i];
        logger.info(`🔄 Testing ${providerConfig.name}...`);

        const provider = new ethers.JsonRpcProvider(providerConfig.url);

        // Test connection with timeout
        const blockNumber = await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);

        const network = await provider.getNetwork();

        if (blockNumber > 0 && network.chainId === 56n) {
          this.currentProvider = provider;
          this.currentProviderIndex = i;

          // Update health stats
          const stats = this.healthStats.get(providerConfig.name);
          stats.successCount++;
          stats.lastSuccess = Date.now();
          stats.isHealthy = true;

          logger.info(`✅ Connected to ${providerConfig.name}`);
          logger.info(`📊 Block: ${blockNumber} | Chain: ${network.chainId}`);

          return provider;
        }
      } catch (error) {
        const providerConfig = this.providers[i];
        logger.warn(`⚠️  ${providerConfig.name} failed: ${error.message}`);

        // Update health stats
        const stats = this.healthStats.get(providerConfig.name);
        stats.failureCount++;
        stats.lastFailure = Date.now();

        continue;
      }
    }

    throw new Error('❌ All RPC providers failed to connect!');
  }

  async failover() {
    const now = Date.now();
    const timeSinceLastFailover = now - this.lastFailoverTime;

    // Prevent rapid failover spam (min 10 seconds between failovers)
    if (timeSinceLastFailover < 10000) {
      logger.warn('⏸️  Failover cooldown active (10s), waiting...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    this.lastFailoverTime = now;

    // Try next provider
    let attempts = 0;
    const maxAttempts = this.providers.length;

    while (attempts < maxAttempts) {
      this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
      const nextConfig = this.providers[this.currentProviderIndex];

      logger.warn(`🔄 Failing over to ${nextConfig.name}...`);

      try {
        const provider = new ethers.JsonRpcProvider(nextConfig.url);

        // Quick health check with timeout
        const blockNumber = await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);

        if (blockNumber > 0) {
          this.currentProvider = provider;
          this.failureCount = 0;

          // Update health stats
          const stats = this.healthStats.get(nextConfig.name);
          stats.successCount++;
          stats.lastSuccess = Date.now();
          stats.isHealthy = true;

          logger.info(`✅ Failover successful: ${nextConfig.name} (block ${blockNumber})`);
          return provider;
        }
      } catch (error) {
        logger.warn(`❌ Failover to ${nextConfig.name} failed: ${error.message}`);

        // Update health stats
        const stats = this.healthStats.get(nextConfig.name);
        stats.failureCount++;
        stats.lastFailure = Date.now();
        stats.isHealthy = false;

        attempts++;
      }
    }

    throw new Error('❌ All RPC providers exhausted during failover!');
  }

  async getProvider() {
    if (!this.currentProvider) {
      return await this.initialize();
    }
    return this.currentProvider;
  }

  async executeWithRetry(operation, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = await this.getProvider();
        const startTime = Date.now();

        const result = await operation(provider);

        const latency = Date.now() - startTime;

        // Update health stats
        const currentConfig = this.providers[this.currentProviderIndex];
        const stats = this.healthStats.get(currentConfig.name);
        stats.successCount++;
        stats.lastSuccess = Date.now();
        stats.avgLatency = stats.avgLatency
          ? (stats.avgLatency * 0.9 + latency * 0.1)
          : latency;

        // Reset failure count on success
        this.failureCount = 0;

        return result;

      } catch (error) {
        lastError = error;
        this.failureCount++;

        logger.warn(`⚠️  Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);

        // Update health stats
        const currentConfig = this.providers[this.currentProviderIndex];
        const stats = this.healthStats.get(currentConfig.name);
        stats.failureCount++;
        stats.lastFailure = Date.now();

        // If provider seems dead, failover immediately
        if (this.isConnectionError(error)) {
          logger.warn('🔄 Connection error detected, triggering failover...');
          await this.failover();
        } else if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          logger.debug(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Operation failed after ${maxRetries} retries: ${lastError.message}`);
  }

  isConnectionError(error) {
    const connectionErrors = [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'network error',
      'timeout',
      'could not detect network',
      'missing response',
      'bad response'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return connectionErrors.some(e => errorMessage.includes(e.toLowerCase()));
  }

  getStatus() {
    const currentConfig = this.providers[this.currentProviderIndex];
    const stats = this.healthStats.get(currentConfig.name);

    return {
      currentProvider: currentConfig.name,
      currentProviderUrl: currentConfig.url.substring(0, 50) + '...',
      failureCount: this.failureCount,
      lastFailover: new Date(this.lastFailoverTime).toISOString(),
      availableProviders: this.providers.map(p => p.name),
      healthStats: Object.fromEntries(
        Array.from(this.healthStats.entries()).map(([name, stats]) => [
          name,
          {
            successRate: stats.successCount / (stats.successCount + stats.failureCount) || 0,
            totalCalls: stats.successCount + stats.failureCount,
            avgLatency: Math.round(stats.avgLatency),
            isHealthy: stats.isHealthy,
            lastSuccess: stats.lastSuccess ? new Date(stats.lastSuccess).toISOString() : null
          }
        ])
      )
    };
  }

  getHealthReport() {
    const status = this.getStatus();
    const report = {
      current: status.currentProvider,
      healthy: [],
      unhealthy: [],
      stats: status.healthStats
    };

    this.providers.forEach(p => {
      const stats = status.healthStats[p.name];
      if (stats.isHealthy && stats.successRate > 0.8) {
        report.healthy.push(p.name);
      } else {
        report.unhealthy.push(p.name);
      }
    });

    return report;
  }
}

module.exports = MultiRPCProvider;
EOF

echo "✅ Created providers/multiRPCProvider.js"
echo ""

# Create test for Multi-RPC Provider
cat > tests/test-multi-rpc-failover.js << 'EOF'
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
EOF

echo "✅ Created tests/test-multi-rpc-failover.js"
echo ""

# Run the test
echo "▶️  Testing Multi-RPC Provider System..."
echo "═══════════════════════════════════════════════════════════"
echo ""
node tests/test-multi-rpc-failover.js

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Multi-RPC Provider Implementation Complete!"
echo ""
echo "📋 What was created:"
echo "   ✅ providers/multiRPCProvider.js (smart failover system)"
echo "   ✅ tests/test-multi-rpc-failover.js (comprehensive tests)"
echo ""
echo "📊 Next step:"
echo "   Update AdvancedTradingBot.js to use Multi-RPC Provider"
echo ""
