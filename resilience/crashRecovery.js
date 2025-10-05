const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Crash Recovery System
 * 
 * Handles recovery from unexpected crashes by:
 * 1. Persisting state every N seconds
 * 2. Detecting previous crashes on startup
 * 3. Reconciling on-chain state with saved state
 * 4. Resuming from last known good state
 */
class CrashRecovery {
  constructor(config = {}) {
    this.stateDir = config.stateDir || path.join(__dirname, '../.recovery');
    this.stateFile = path.join(this.stateDir, 'state.json');
    this.backupFile = path.join(this.stateDir, 'state.backup.json');
    
    this.persistInterval = config.persistInterval || 10000; // 10 seconds
    this.maxStateHistory = config.maxStateHistory || 10;
    
    this.currentState = null;
    this.persistTimer = null;
    this.isShuttingDown = false;
    
    // Components to track
    this.trackedComponents = new Map();
    
    // Metrics
    this.metrics = {
      statesSaved: 0,
      recoveries: 0,
      reconciliations: 0,
      errors: 0
    };
    
    logger.info(`✅ Crash Recovery System initialized: ${this.stateDir}`);
  }

  /**
   * Initialize crash recovery
   */
  async initialize() {
    try {
      // Ensure state directory exists
      await fs.mkdir(this.stateDir, { recursive: true });
      
      // Check for previous crash
      const previousCrash = await this.detectPreviousCrash();
      
      if (previousCrash) {
        logger.warn('🔄 Detected previous crash, initiating recovery...');
        return await this.recover();
      }
      
      logger.info('✅ No previous crash detected, starting fresh');
      return null;
      
    } catch (error) {
      logger.error('Error initializing crash recovery:', error);
      throw error;
    }
  }

  /**
   * Detect if there was a previous crash
   */
  async detectPreviousCrash() {
    try {
      // Check if state file exists
      await fs.access(this.stateFile);
      
      // State file exists, check if it was a clean shutdown
      const state = await this.loadState();
      
      if (!state) {
        return false;
      }
      
      if (state.cleanShutdown) {
        logger.info('Previous shutdown was clean');
        return false;
      }
      
      // State file exists without clean shutdown flag = crash
      logger.warn('Previous shutdown was NOT clean - crash detected');
      return true;
      
    } catch (error) {
      // No state file = first run or clean shutdown removed it
      return false;
    }
  }

  /**
   * Load saved state
   */
  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Try backup
      try {
        logger.warn('Primary state file failed, trying backup...');
        const data = await fs.readFile(this.backupFile, 'utf8');
        return JSON.parse(data);
      } catch (backupError) {
        logger.error('Both state files failed to load');
        return null;
      }
    }
  }

  /**
   * Recover from crash
   */
  async recover() {
    try {
      const savedState = await this.loadState();
      
      if (!savedState) {
        logger.error('No saved state to recover from');
        return null;
      }
      
      logger.info('📋 Loaded saved state:', {
        timestamp: savedState.timestamp,
        uptime: savedState.uptime,
        componentCount: Object.keys(savedState.components || {}).length
      });
      
      this.metrics.recoveries++;
      
      return {
        savedState,
        timestamp: savedState.timestamp,
        components: savedState.components || {},
        positions: savedState.positions || [],
        pendingTxs: savedState.pendingTxs || [],
        lastTxHash: savedState.lastTxHash
      };
      
    } catch (error) {
      logger.error('Error during recovery:', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Register component for state tracking
   */
  registerComponent(name, component, getStateFn) {
    this.trackedComponents.set(name, { component, getStateFn });
    logger.debug(`Component registered for crash recovery: ${name}`);
  }

  /**
   * Start persistent state saving
   */
  startPersisting() {
    if (this.persistTimer) {
      return; // Already running
    }
    
    logger.info(`Starting state persistence every ${this.persistInterval}ms`);
    
    this.persistTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.persistState();
      }
    }, this.persistInterval);
    
    // Also persist on process signals
    this.setupSignalHandlers();
  }

  /**
   * Stop persistent state saving
   */
  stopPersisting() {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
      logger.info('✅ Stopped state persistence');
    }
  }

  /**
   * Persist current state to disk
   */
  async persistState() {
    try {
      // Collect state from all tracked components
      const componentStates = {};
      
      for (const [name, { component, getStateFn }] of this.trackedComponents) {
        try {
          componentStates[name] = await getStateFn(component);
        } catch (error) {
          logger.error(`Error getting state from ${name}:`, error);
          componentStates[name] = { error: error.message };
        }
      }
      
      // Build complete state snapshot
      const state = {
        timestamp: Date.now(),
        uptime: process.uptime(),
        pid: process.pid,
        cleanShutdown: false, // Will be set to true on clean shutdown
        components: componentStates,
        positions: this.currentState?.positions || [],
        pendingTxs: this.currentState?.pendingTxs || [],
        lastTxHash: this.currentState?.lastTxHash,
        nodeVersion: process.version,
        platform: process.platform
      };
      
      // Save to disk
      await this.writeStateToDisk(state);
      
      this.currentState = state;
      this.metrics.statesSaved++;
      
      logger.debug('State persisted successfully');
      
    } catch (error) {
      logger.error('Error persisting state:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Write state to disk with atomic write and backup
   */
  async writeStateToDisk(state) {
    const tempFile = this.stateFile + '.tmp';
    
    try {
      // Write to temp file first
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
      
      // Backup previous state
      try {
        await fs.copyFile(this.stateFile, this.backupFile);
      } catch (error) {
        // Ignore if state file doesn't exist yet
      }
      
      // Atomic rename
      await fs.rename(tempFile, this.stateFile);
      
    } catch (error) {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch {}
      
      throw error;
    }
  }

  /**
   * Mark clean shutdown
   */
  async markCleanShutdown() {
    this.isShuttingDown = true;
    
    try {
      // Final state save
      await this.persistState();
      
      // Mark as clean
      if (this.currentState) {
        this.currentState.cleanShutdown = true;
        await this.writeStateToDisk(this.currentState);
      }
      
      logger.info('✅ Marked clean shutdown');
      
    } catch (error) {
      logger.error('Error marking clean shutdown:', error);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.warn(`Received ${signal}, initiating graceful shutdown...`);
        await this.markCleanShutdown();
        process.exit(0);
      });
    });
    
    // Uncaught exception handler
    process.on('uncaughtException', async (error) => {
      logger.error('🚨 UNCAUGHT EXCEPTION:', error);
      await this.persistState(); // Try to save state before crash
      process.exit(1);
    });
    
    // Unhandled rejection handler
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('🚨 UNHANDLED REJECTION:', reason);
      await this.persistState(); // Try to save state
    });
  }

  /**
   * Find orphaned transactions (pending in saved state but might be confirmed now)
   */
  async findOrphanedTransactions(savedState, provider) {
    if (!savedState || !savedState.pendingTxs) {
      return [];
    }
    
    logger.info(`Checking ${savedState.pendingTxs.length} potentially orphaned transactions...`);
    
    const orphaned = [];
    
    for (const txHash of savedState.pendingTxs) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (receipt) {
          // Transaction was confirmed
          logger.info(`Transaction ${txHash} was confirmed (block ${receipt.blockNumber})`);
        } else {
          // Still pending or dropped
          const tx = await provider.getTransaction(txHash);
          
          if (!tx) {
            logger.warn(`Transaction ${txHash} not found (likely dropped)`);
            orphaned.push({ txHash, status: 'dropped' });
          } else {
            logger.info(`Transaction ${txHash} still pending`);
            orphaned.push({ txHash, status: 'pending' });
          }
        }
      } catch (error) {
        logger.error(`Error checking transaction ${txHash}:`, error);
        orphaned.push({ txHash, status: 'error', error: error.message });
      }
    }
    
    return orphaned;
  }

  /**
   * Reconcile positions with on-chain state
   */
  async reconcilePositions(savedPositions, getCurrentPositionsFn) {
    if (!savedPositions || savedPositions.length === 0) {
      logger.info('No saved positions to reconcile');
      return { matched: [], discrepancies: [] };
    }
    
    logger.info(`Reconciling ${savedPositions.length} saved positions...`);
    
    try {
      // Get current on-chain positions
      const currentPositions = await getCurrentPositionsFn();
      
      const matched = [];
      const discrepancies = [];
      
      for (const savedPos of savedPositions) {
        const currentPos = currentPositions.find(p => 
          p.pair === savedPos.pair && p.type === savedPos.type
        );
        
        if (!currentPos) {
          logger.warn(`Position not found on-chain: ${savedPos.pair} ${savedPos.type}`);
          discrepancies.push({
            saved: savedPos,
            current: null,
            issue: 'missing_on_chain'
          });
          continue;
        }
        
        // Compare amounts
        const amountDiff = Math.abs(currentPos.amount - savedPos.amount);
        const tolerance = savedPos.amount * 0.01; // 1% tolerance
        
        if (amountDiff > tolerance) {
          logger.warn(`Position amount mismatch: ${savedPos.pair}`);
          discrepancies.push({
            saved: savedPos,
            current: currentPos,
            issue: 'amount_mismatch',
            difference: amountDiff
          });
        } else {
          matched.push({ saved: savedPos, current: currentPos });
        }
      }
      
      logger.info(`Reconciliation complete: ${matched.length} matched, ${discrepancies.length} discrepancies`);
      this.metrics.reconciliations++;
      
      return { matched, discrepancies };
      
    } catch (error) {
      logger.error('Error reconciling positions:', error);
      throw error;
    }
  }

  /**
   * Create incident report for crash
   */
  async createIncidentReport(type, details = {}) {
    const report = {
      type,
      timestamp: Date.now(),
      details,
      state: this.currentState,
      metrics: this.metrics
    };
    
    const reportFile = path.join(
      this.stateDir,
      `incident_${Date.now()}.json`
    );
    
    try {
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');
      logger.info(`📝 Incident report created: ${reportFile}`);
    } catch (error) {
      logger.error('Error creating incident report:', error);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      stateDir: this.stateDir,
      persistInterval: this.persistInterval,
      trackedComponents: Array.from(this.trackedComponents.keys()),
      metrics: this.metrics,
      isPersisting: !!this.persistTimer,
      lastState: this.currentState ? {
        timestamp: this.currentState.timestamp,
        uptime: this.currentState.uptime
      } : null
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: this.persistTimer ? 'healthy' : 'not_running',
      isPersisting: !!this.persistTimer,
      statesSaved: this.metrics.statesSaved,
      lastStateSaved: this.currentState?.timestamp,
      errors: this.metrics.errors
    };
  }
}

module.exports = CrashRecovery;

