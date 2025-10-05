const logger = require('../logger');
const EventEmitter = require('events');
const axios = require('axios');

/**
 * Bridge Health Monitor
 * 
 * Monitors cross-chain bridge health, liquidity, and security
 * Prevents trading when bridges are compromised or paused
 * 
 * Tracks:
 * - Bridge operational status
 * - Recent bridge hacks (on-chain monitoring)
 * - Liquidity depth
 * - Fee changes
 * - Processing times
 */
class BridgeHealthMonitor extends EventEmitter {
  constructor(provider, options = {}) {
    super();
    
    this.provider = provider;
    this.options = {
      checkInterval: options.checkInterval || 60000, // 1 minute
      minLiquidity: options.minLiquidity || 100000, // $100k minimum
      maxProcessingTime: options.maxProcessingTime || 1800000, // 30 minutes
      maxFeePercent: options.maxFeePercent || 1.0, // 1% max fee
      alertThreshold: options.alertThreshold || 3, // Alert after 3 failures
      ...options
    };
    
    // Bridge configurations
    this.bridges = new Map([
      ['across', {
        name: 'Across Protocol',
        enabled: true,
        contracts: {
          ethereum: '0x...',  // Hub pool contract
          polygon: '0x...',
          arbitrum: '0x...'
        },
        apiEndpoint: 'https://across.to/api/health',
        minLiquidity: 500000 // $500k
      }],
      ['hop', {
        name: 'Hop Protocol',
        enabled: true,
        contracts: {
          ethereum: '0x...',
          polygon: '0x...',
          optimism: '0x...'
        },
        apiEndpoint: 'https://api.hop.exchange/v1/health',
        minLiquidity: 250000 // $250k
      }],
      ['stargate', {
        name: 'Stargate Finance',
        enabled: true,
        contracts: {
          ethereum: '0x...',
          bsc: '0x...',
          polygon: '0x...',
          arbitrum: '0x...'
        },
        apiEndpoint: 'https://api.stargate.finance/health',
        minLiquidity: 1000000 // $1M
      }],
      ['synapse', {
        name: 'Synapse Protocol',
        enabled: true,
        contracts: {
          ethereum: '0x...',
          bsc: '0x...',
          avalanche: '0x...'
        },
        apiEndpoint: 'https://api.synapseprotocol.com/health',
        minLiquidity: 300000 // $300k
      }],
      ['multichain', {
        name: 'Multichain',
        enabled: false, // Disabled due to past security issues
        contracts: {},
        apiEndpoint: 'https://bridgeapi.anyswap.exchange/v3/health',
        minLiquidity: 0
      }]
    ]);
    
    // Health status for each bridge
    this.bridgeHealth = new Map();
    
    // Recent bridge transactions (for monitoring)
    this.recentTransfers = [];
    
    // Monitoring interval
    this.monitoringInterval = null;
    this.isMonitoring = false;
    
    // Known security incidents (block bridges after incidents)
    this.securityIncidents = new Map();
    
    logger.info('🌉 Bridge Health Monitor initialized');
  }

  /**
   * Start monitoring bridge health
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    
    // Initial health check
    await this.checkAllBridges();
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.checkAllBridges();
    }, this.options.checkInterval);
    
    logger.info('✅ Bridge health monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    logger.info('✅ Bridge health monitoring stopped');
  }

  /**
   * Check health of all bridges
   */
  async checkAllBridges() {
    logger.debug('🔍 Checking health of all bridges...');
    
    const promises = [];
    
    for (const [bridgeName, bridgeConfig] of this.bridges) {
      if (bridgeConfig.enabled) {
        promises.push(this.checkBridgeHealth(bridgeName, bridgeConfig));
      }
    }
    
    await Promise.allSettled(promises);
  }

  /**
   * Check individual bridge health
   */
  async checkBridgeHealth(bridgeName, bridgeConfig) {
    try {
      const health = {
        name: bridgeName,
        timestamp: Date.now(),
        isHealthy: true,
        issues: [],
        metrics: {}
      };
      
      // Check 1: Security incidents
      if (this.hasRecentSecurityIncident(bridgeName)) {
        health.isHealthy = false;
        health.issues.push('Recent security incident detected');
      }
      
      // Check 2: API health (if available)
      if (bridgeConfig.apiEndpoint) {
        const apiHealth = await this.checkBridgeAPI(bridgeConfig.apiEndpoint);
        health.metrics.apiStatus = apiHealth.status;
        
        if (!apiHealth.healthy) {
          health.isHealthy = false;
          health.issues.push('API unhealthy or unreachable');
        }
      }
      
      // Check 3: On-chain liquidity
      const liquidity = await this.checkBridgeLiquidity(bridgeName, bridgeConfig);
      health.metrics.liquidity = liquidity;
      
      if (liquidity < bridgeConfig.minLiquidity) {
        health.isHealthy = false;
        health.issues.push(`Low liquidity: $${liquidity.toLocaleString()} < $${bridgeConfig.minLiquidity.toLocaleString()}`);
      }
      
      // Check 4: Recent transfer success rate
      const successRate = this.calculateRecentSuccessRate(bridgeName);
      health.metrics.successRate = successRate;
      
      if (successRate < 0.95) { // 95% threshold
        health.isHealthy = false;
        health.issues.push(`Low success rate: ${(successRate * 100).toFixed(2)}%`);
      }
      
      // Check 5: Average processing time
      const avgProcessingTime = this.calculateAvgProcessingTime(bridgeName);
      health.metrics.avgProcessingTime = avgProcessingTime;
      
      if (avgProcessingTime > this.options.maxProcessingTime) {
        health.isHealthy = false;
        health.issues.push(`Slow processing: ${(avgProcessingTime / 1000 / 60).toFixed(1)} minutes`);
      }
      
      // Update health status
      this.bridgeHealth.set(bridgeName, health);
      
      // Emit events
      if (!health.isHealthy) {
        logger.warn(`⚠️ Bridge ${bridgeName} unhealthy:`, health.issues);
        this.emit('bridge_unhealthy', { bridge: bridgeName, health: health });
      } else {
        logger.debug(`✅ Bridge ${bridgeName} healthy`);
      }
      
      return health;
      
    } catch (error) {
      logger.error(`❌ Error checking bridge ${bridgeName}:`, error);
      
      // Mark as unhealthy on error
      const health = {
        name: bridgeName,
        timestamp: Date.now(),
        isHealthy: false,
        issues: [`Health check error: ${error.message}`],
        metrics: {}
      };
      
      this.bridgeHealth.set(bridgeName, health);
      return health;
    }
  }

  /**
   * Check bridge API health
   */
  async checkBridgeAPI(apiEndpoint) {
    try {
      const response = await axios.get(apiEndpoint, { timeout: 10000 });
      
      return {
        healthy: response.status === 200,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      logger.debug(`Bridge API check failed: ${error.message}`);
      return {
        healthy: false,
        status: error.response?.status || 0,
        error: error.message
      };
    }
  }

  /**
   * Check bridge liquidity (placeholder - needs actual implementation)
   */
  async checkBridgeLiquidity(bridgeName, bridgeConfig) {
    try {
      // This would query actual bridge contracts for liquidity
      // For now, return mock data
      
      // Example: Query bridge contract for available liquidity
      // const contract = new ethers.Contract(bridgeConfig.contracts.ethereum, ABI, this.provider);
      // const liquidity = await contract.getAvailableLiquidity();
      
      // Mock liquidity data
      const mockLiquidity = {
        'across': 750000,
        'hop': 400000,
        'stargate': 1500000,
        'synapse': 350000,
        'multichain': 0
      };
      
      return mockLiquidity[bridgeName] || 0;
      
    } catch (error) {
      logger.error(`Error checking liquidity for ${bridgeName}:`, error);
      return 0;
    }
  }

  /**
   * Calculate recent success rate for bridge
   */
  calculateRecentSuccessRate(bridgeName) {
    const recentTransfers = this.recentTransfers.filter(
      t => t.bridge === bridgeName && Date.now() - t.timestamp < 3600000 // Last hour
    );
    
    if (recentTransfers.length === 0) {
      return 1.0; // No data = assume healthy
    }
    
    const successful = recentTransfers.filter(t => t.status === 'success').length;
    return successful / recentTransfers.length;
  }

  /**
   * Calculate average processing time
   */
  calculateAvgProcessingTime(bridgeName) {
    const recentTransfers = this.recentTransfers.filter(
      t => t.bridge === bridgeName && 
           t.status === 'success' && 
           Date.now() - t.timestamp < 3600000 // Last hour
    );
    
    if (recentTransfers.length === 0) {
      return 0;
    }
    
    const totalTime = recentTransfers.reduce((sum, t) => sum + (t.processingTime || 0), 0);
    return totalTime / recentTransfers.length;
  }

  /**
   * Check for recent security incidents
   */
  hasRecentSecurityIncident(bridgeName) {
    const incident = this.securityIncidents.get(bridgeName);
    
    if (!incident) {
      return false;
    }
    
    // Block bridge for 30 days after incident
    const incidentAge = Date.now() - incident.timestamp;
    const blockPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    return incidentAge < blockPeriod;
  }

  /**
   * Report security incident
   */
  reportSecurityIncident(bridgeName, details) {
    logger.error(`🚨 SECURITY INCIDENT: ${bridgeName} - ${details}`);
    
    const incident = {
      bridge: bridgeName,
      timestamp: Date.now(),
      details: details,
      severity: 'critical'
    };
    
    this.securityIncidents.set(bridgeName, incident);
    
    // Disable bridge immediately
    const bridgeConfig = this.bridges.get(bridgeName);
    if (bridgeConfig) {
      bridgeConfig.enabled = false;
    }
    
    // Mark as unhealthy
    const health = this.bridgeHealth.get(bridgeName) || {};
    health.isHealthy = false;
    health.issues = health.issues || [];
    health.issues.push('SECURITY INCIDENT: Bridge disabled');
    this.bridgeHealth.set(bridgeName, health);
    
    this.emit('security_incident', incident);
  }

  /**
   * Track bridge transfer
   */
  trackTransfer(transfer) {
    this.recentTransfers.push({
      bridge: transfer.bridge,
      txHash: transfer.txHash,
      status: transfer.status || 'pending',
      timestamp: Date.now(),
      processingTime: transfer.processingTime || null,
      amount: transfer.amount,
      fromChain: transfer.fromChain,
      toChain: transfer.toChain
    });
    
    // Keep only last 1000 transfers
    if (this.recentTransfers.length > 1000) {
      this.recentTransfers = this.recentTransfers.slice(-1000);
    }
  }

  /**
   * Get healthy bridges for a route
   */
  getHealthyBridges(fromChain, toChain) {
    const healthyBridges = [];
    
    for (const [bridgeName, health] of this.bridgeHealth) {
      if (health.isHealthy) {
        const bridgeConfig = this.bridges.get(bridgeName);
        
        // Check if bridge supports this route
        if (bridgeConfig && 
            bridgeConfig.contracts[fromChain] && 
            bridgeConfig.contracts[toChain]) {
          healthyBridges.push({
            name: bridgeName,
            config: bridgeConfig,
            health: health
          });
        }
      }
    }
    
    // Sort by liquidity (highest first)
    healthyBridges.sort((a, b) => 
      (b.health.metrics.liquidity || 0) - (a.health.metrics.liquidity || 0)
    );
    
    return healthyBridges;
  }

  /**
   * Check if any bridge is healthy for a route
   */
  hasHealthyBridge(fromChain, toChain) {
    return this.getHealthyBridges(fromChain, toChain).length > 0;
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.bridges.size;
    const healthy = Array.from(this.bridgeHealth.values()).filter(h => h.isHealthy).length;
    const unhealthy = Array.from(this.bridgeHealth.values()).filter(h => !h.isHealthy).length;
    
    return {
      totalBridges: total,
      healthy: healthy,
      unhealthy: unhealthy,
      healthRate: total > 0 ? (healthy / total * 100).toFixed(2) + '%' : '0%',
      recentTransfers: this.recentTransfers.length,
      securityIncidents: this.securityIncidents.size,
      bridgeHealth: Object.fromEntries(this.bridgeHealth)
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    const stats = this.getStats();
    const healthy = stats.healthy >= 2; // Need at least 2 healthy bridges
    
    return {
      status: healthy ? 'healthy' : 'degraded',
      healthyBridges: stats.healthy,
      unhealthyBridges: stats.unhealthy,
      isMonitoring: this.isMonitoring,
      stats: stats
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    this.stopMonitoring();
    logger.info('✅ Bridge health monitor shutdown complete');
  }
}

module.exports = BridgeHealthMonitor;

