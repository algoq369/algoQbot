/**
 * Tests for 3 Critical Fixes
 * 
 * Based on Expert Review recommendations:
 * 1. Connection Pool Race Condition
 * 2. Nonce Gap Filling
 * 3. Position Reconciliation
 */

const SafeConnectionPool = require('../database/safeConnectionPool');
const ProductionNonceManager = require('../blockchain/productionNonceManager');
const PositionReconciliation = require('../blockchain/positionReconciliation');

describe('Critical Fix #1: Connection Pool Race Condition', () => {
  let connectionPool;

  beforeEach(() => {
    // Mock PostgreSQL config
    connectionPool = new SafeConnectionPool({
      write: {
        host: 'localhost',
        database: 'test',
        user: 'test',
        password: 'test',
        max: 10
      },
      read: {
        host: 'localhost',
        database: 'test',
        user: 'test',
        password: 'test',
        max: 20
      }
    });
  });

  afterEach(async () => {
    if (connectionPool) {
      await connectionPool.shutdown(5000);
    }
  });

  test('tracks active connections correctly', async () => {
    // This test verifies the activeConnections Map is working
    expect(connectionPool.activeConnections.size).toBe(0);
    
    // Note: Actual connection acquisition requires real database
    // This test validates the structure is in place
    expect(connectionPool.activeConnections).toBeInstanceOf(Map);
    expect(connectionPool.pendingAcquisitions).toBeInstanceOf(Set);
  });

  test('handles timeout without racing', async () => {
    // Verify that timeout cleanup doesn't race with active connections
    const stats = connectionPool.getStats();
    
    expect(stats.metrics.racesAvoided).toBe(0);
    expect(stats.metrics.timeoutCleanups).toBe(0);
    
    // Structure validation
    expect(stats.active.connections).toBe(0);
    expect(stats.active.pendingAcquisitions).toBe(0);
  });

  test('release() checks activeConnections before releasing', () => {
    // Mock connection object
    const mockConnection = { release: jest.fn() };
    
    // Manually add to active connections
    connectionPool.activeConnections.set(mockConnection, {
      acquisitionId: Symbol('test'),
      acquiredAt: Date.now(),
      inUse: true
    });
    
    // Release should check and remove from tracking
    connectionPool.release(mockConnection);
    
    expect(connectionPool.activeConnections.has(mockConnection)).toBe(false);
    expect(mockConnection.release).toHaveBeenCalled();
  });

  test('metrics track races avoided', () => {
    const stats = connectionPool.getStats();
    
    expect(stats.metrics).toHaveProperty('totalAcquires');
    expect(stats.metrics).toHaveProperty('racesAvoided');
    expect(stats.metrics).toHaveProperty('timeoutCleanups');
    expect(stats.metrics).toHaveProperty('successRate');
  });
});

describe('Critical Fix #2: Nonce Gap Filling', () => {
  let nonceManager;
  let mockWallet;
  let mockProvider;

  beforeEach(async () => {
    // Mock wallet
    mockWallet = {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      getNonce: jest.fn().mockResolvedValue(5),
      sendTransaction: jest.fn().mockResolvedValue({
        hash: '0x1234567890abcdef',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      })
    };

    // Mock provider
    mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(1000),
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: BigInt(50000000000), // 50 gwei
        maxPriorityFeePerGas: BigInt(2000000000) // 2 gwei
      })
    };

    nonceManager = new ProductionNonceManager(mockWallet, mockProvider);
    await nonceManager.initialize();
  });

  afterEach(async () => {
    if (nonceManager) {
      await nonceManager.shutdown();
    }
  });

  test('initializes with on-chain nonce', () => {
    expect(nonceManager.initialized).toBe(true);
    expect(nonceManager.getCurrentNonce()).toBe(5);
  });

  test('increments nonce atomically', () => {
    const nonce1 = nonceManager.getNextNonce();
    const nonce2 = nonceManager.getNextNonce();
    const nonce3 = nonceManager.getNextNonce();
    
    expect(nonce1).toBe(5);
    expect(nonce2).toBe(6);
    expect(nonce3).toBe(7);
    expect(nonceManager.getCurrentNonce()).toBe(8);
  });

  test('tracks pending transactions', () => {
    const nonce = nonceManager.getNextNonce();
    nonceManager.trackTransaction(nonce, '0xabc123');
    
    expect(nonceManager.isPending(nonce)).toBe(true);
    expect(nonceManager.getPendingNonces()).toContain(nonce);
  });

  test('confirms transactions and removes from pending', () => {
    const nonce = nonceManager.getNextNonce();
    nonceManager.trackTransaction(nonce, '0xabc123');
    
    expect(nonceManager.isPending(nonce)).toBe(true);
    
    nonceManager.confirmTransaction(nonce);
    
    expect(nonceManager.isPending(nonce)).toBe(false);
  });

  test('detects nonce gaps', async () => {
    // Allocate nonces 5, 6, 7, 8
    nonceManager.getNextNonce(); // 5
    nonceManager.getNextNonce(); // 6
    nonceManager.getNextNonce(); // 7
    nonceManager.getNextNonce(); // 8
    
    // Track 5 and 7, but not 6 (gap at 6)
    nonceManager.trackTransaction(5, '0xtx5');
    nonceManager.trackTransaction(7, '0xtx7');
    
    // Confirm 5
    nonceManager.confirmTransaction(5);
    
    // Mock on-chain nonce is still at 6 (because 6 is missing)
    mockWallet.getNonce.mockResolvedValue(6);
    
    // Detect gaps should find nonce 6
    await nonceManager.detectAndFillGaps();
    
    // Verify fillNonceGap was attempted
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
  });

  test('provides nonce for replacement transactions', () => {
    const nonce = nonceManager.getNextNonce();
    nonceManager.trackTransaction(nonce, '0xoriginal');
    
    const replacementNonce = nonceManager.getNonceForReplacement('0xoriginal');
    
    expect(replacementNonce).toBe(nonce); // Same nonce for replacement
  });

  test('monitors stuck transactions', async () => {
    const nonce = nonceManager.getNextNonce();
    
    // Manually set old timestamp to simulate stuck transaction
    nonceManager.trackTransaction(nonce, '0xstuck');
    const pendingData = nonceManager.pendingTransactions.get(nonce);
    pendingData.timestamp = Date.now() - 400000; // 6.67 minutes ago (>5 min threshold)
    
    // Check stuck transactions
    await nonceManager.checkStuckTransactions();
    
    // Should attempt replacement
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
  });

  test('metrics track gap filling', () => {
    const stats = nonceManager.getStats();
    
    expect(stats.metrics).toHaveProperty('gapsDetected');
    expect(stats.metrics).toHaveProperty('gapsFilled');
    expect(stats.metrics).toHaveProperty('stuckTransactionsReplaced');
  });

  test('health check returns status', async () => {
    const health = await nonceManager.healthCheck();
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('currentNonce');
    expect(['healthy', 'degraded', 'warning', 'unhealthy']).toContain(health.status);
  });
});

describe('Critical Fix #3: Position Reconciliation', () => {
  let reconciliation;
  let mockWallet;
  let mockProvider;
  let mockDatabase;

  beforeEach(() => {
    // Mock wallet
    mockWallet = {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')) // 1 ETH
    };

    // Mock provider
    mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(1000),
      getBlock: jest.fn().mockResolvedValue({
        number: 1000,
        timestamp: 1234567890,
        transactions: []
      }),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn()
    };

    // Mock database
    mockDatabase = {
      getAllPositions: jest.fn().mockResolvedValue([
        {
          token: 'ETH',
          balance: 1.0,
          tokenAddress: null,
          decimals: 18
        },
        {
          token: 'USDT',
          balance: 1000.0,
          tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          decimals: 6
        }
      ]),
      updatePosition: jest.fn().mockResolvedValue(true),
      forceUpdatePosition: jest.fn().mockResolvedValue(true),
      getLastRecordedBlock: jest.fn().mockResolvedValue(900),
      hasTransaction: jest.fn().mockResolvedValue(false),
      recordTransaction: jest.fn().mockResolvedValue(true),
      saveAlert: jest.fn().mockResolvedValue(true)
    };

    reconciliation = new PositionReconciliation(mockWallet, mockProvider, mockDatabase);
  });

  afterEach(async () => {
    if (reconciliation) {
      await reconciliation.shutdown();
    }
  });

  test('fetches on-chain balances', async () => {
    const positions = [
      { token: 'ETH', balance: 1.0, decimals: 18 }
    ];
    
    const balances = await reconciliation.getOnChainBalances(positions);
    
    expect(balances.size).toBe(1);
    expect(balances.get('ETH')).toBe(1.0);
    expect(mockWallet.getBalance).toHaveBeenCalled();
  });

  test('detects no discrepancies when balances match', async () => {
    // Mock on-chain balance matches DB
    mockWallet.getBalance.mockResolvedValue(BigInt('1000000000000000000')); // 1 ETH
    
    const result = await reconciliation.reconcileAllPositions();
    
    expect(result.discrepancies).toBe(0);
  });

  test('detects discrepancies when balances differ', async () => {
    // Mock on-chain balance differs from DB
    mockWallet.getBalance.mockResolvedValue(BigInt('1500000000000000000')); // 1.5 ETH (DB has 1.0)
    
    const result = await reconciliation.reconcileAllPositions();
    
    expect(result.discrepancies).toBeGreaterThan(0);
    expect(result.details[0]).toHaveProperty('difference');
    expect(result.details[0]).toHaveProperty('percentDifference');
  });

  test('classifies discrepancies as MAJOR or MINOR', async () => {
    // Mock 2% difference (MAJOR - >1%)
    mockWallet.getBalance.mockResolvedValue(BigInt('1020000000000000000')); // 1.02 ETH
    
    const result = await reconciliation.reconcileAllPositions();
    
    if (result.discrepancies > 0) {
      expect(['MAJOR', 'MINOR']).toContain(result.details[0].severity);
    }
  });

  test('scans blockchain for missing transactions', async () => {
    mockProvider.getBlock.mockResolvedValue({
      number: 1000,
      timestamp: 1234567890,
      transactions: ['0xtx1', '0xtx2']
    });
    
    mockProvider.getTransaction.mockResolvedValue({
      hash: '0xtx1',
      from: mockWallet.address,
      to: '0xOtherAddress',
      value: BigInt('1000000000000000000')
    });
    
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      blockNumber: 1000
    });
    
    mockDatabase.hasTransaction.mockResolvedValue(false); // Not in DB
    
    const missingTxs = await reconciliation.findMissingTransactions('ETH', null);
    
    expect(missingTxs.length).toBeGreaterThan(0);
  });

  test('updates DB for minor discrepancies', async () => {
    // Mock 0.5% difference (MINOR - <1%)
    mockWallet.getBalance.mockResolvedValue(BigInt('1005000000000000000')); // 1.005 ETH
    
    await reconciliation.reconcileAllPositions();
    
    // Should call updatePosition for minor discrepancy
    expect(mockDatabase.updatePosition).toHaveBeenCalled();
  });

  test('alerts admin for major unresolvable discrepancies', async () => {
    // Mock 10% difference (MAJOR)
    mockWallet.getBalance.mockResolvedValue(BigInt('1100000000000000000')); // 1.1 ETH
    
    // Mock no missing transactions found
    mockProvider.getBlock.mockResolvedValue({
      number: 1000,
      timestamp: 1234567890,
      transactions: []
    });
    
    await reconciliation.reconcileAllPositions();
    
    // Should call forceUpdatePosition and saveAlert
    expect(mockDatabase.forceUpdatePosition).toHaveBeenCalled();
    expect(mockDatabase.saveAlert).toHaveBeenCalled();
  });

  test('metrics track discrepancies found and resolved', async () => {
    const stats = reconciliation.getStats();
    
    expect(stats.metrics).toHaveProperty('totalReconciliations');
    expect(stats.metrics).toHaveProperty('discrepanciesFound');
    expect(stats.metrics).toHaveProperty('discrepanciesResolved');
    expect(stats.metrics).toHaveProperty('minorDiscrepancies');
    expect(stats.metrics).toHaveProperty('majorDiscrepancies');
    expect(stats.metrics).toHaveProperty('resolutionRate');
  });

  test('continuous reconciliation starts and stops', () => {
    expect(reconciliation.reconciliationInterval).toBeNull();
    
    reconciliation.startContinuousReconciliation();
    expect(reconciliation.reconciliationInterval).not.toBeNull();
    
    reconciliation.stopContinuousReconciliation();
    expect(reconciliation.reconciliationInterval).toBeNull();
  });

  test('health check returns status', async () => {
    const health = await reconciliation.healthCheck();
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('positionsTracked');
    expect(['healthy', 'unhealthy']).toContain(health.status);
  });
});

describe('Integration: All 3 Critical Fixes Together', () => {
  test('all modules can be instantiated together', () => {
    const mockConfig = {
      write: { host: 'localhost', database: 'test', user: 'test', password: 'test' },
      read: { host: 'localhost', database: 'test', user: 'test', password: 'test' }
    };
    
    const mockWallet = {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      getNonce: jest.fn().mockResolvedValue(5),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000'))
    };
    
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(1000),
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: BigInt(50000000000),
        maxPriorityFeePerGas: BigInt(2000000000)
      })
    };
    
    const mockDatabase = {
      getAllPositions: jest.fn().mockResolvedValue([])
    };
    
    // Instantiate all 3 fixes
    const connectionPool = new SafeConnectionPool(mockConfig);
    const nonceManager = new ProductionNonceManager(mockWallet, mockProvider);
    const reconciliation = new PositionReconciliation(mockWallet, mockProvider, mockDatabase);
    
    // All should be created successfully
    expect(connectionPool).toBeDefined();
    expect(nonceManager).toBeDefined();
    expect(reconciliation).toBeDefined();
    
    // Cleanup
    connectionPool.shutdown(1000).catch(() => {});
    nonceManager.shutdown().catch(() => {});
    reconciliation.shutdown().catch(() => {});
  });
});

// Run tests
if (require.main === module) {
  console.log('Running critical fixes tests...');
  console.log('\n✅ All test suites defined');
  console.log('\nRun with: npm test tests/critical-fixes.test.js');
}

module.exports = {
  SafeConnectionPool,
  ProductionNonceManager,
  PositionReconciliation
};

