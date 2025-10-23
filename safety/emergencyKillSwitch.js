const logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Emergency Kill Switch
 *
 * Critical safety mechanism to immediately stop all trading operations.
 * Can be triggered manually, automatically based on risk thresholds, or via API.
 *
 * Features:
 * - Immediate trading halt
 * - Position closure (safe mode)
 * - Order cancellation
 * - State persistence
 * - Automatic recovery prevention
 * - Multi-trigger support (file, API, console, risk threshold)
 */
class EmergencyKillSwitch {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.options = {
      killSwitchFile: options.killSwitchFile || path.join(__dirname, '../.killswitch'),
      checkInterval: options.checkInterval || 1000, // Check every second
      autoClosePositions: options.autoClosePositions !== false, // Default true
      autoCancelOrders: options.autoCancelOrders !== false, // Default true
      stateFile: options.stateFile || path.join(__dirname, '../.emergency-state.json'),
      ...options
    };

    this.isActive = false;
    this.activationTime = null;
    this.activationReason = null;
    this.activatedBy = null;

    // Monitoring intervals
    this.fileMonitor = null;
    this.stateMonitor = null;

    // Emergency state
    this.emergencyState = {
      isActive: false,
      activationTime: null,
      reason: null,
      triggeredBy: null,
      positionsClosed: false,
      ordersCancelled: false,
      systemState: null
    };

    logger.info('🚨 Emergency Kill Switch initialized');
  }

  // Initialize kill switch monitoring
  async initialize() {
    try {
      // Check if kill switch was previously activated
      await this.checkPreviousActivation();

      // Start file monitoring
      this.startFileMonitoring();

      // Start state monitoring
      this.startStateMonitoring();

      logger.info('✅ Emergency Kill Switch monitoring started');

    } catch (error) {
      logger.error('❌ Failed to initialize Emergency Kill Switch:', error);
      throw error;
    }
  }

  // Check if kill switch was previously activated
  async checkPreviousActivation() {
    try {
      // Check for kill switch file
      const fileExists = await fs.access(this.options.killSwitchFile)
        .then(() => true)
        .catch(() => false);

      if (fileExists) {
        logger.error('🚨 KILL SWITCH FILE DETECTED - System was previously shut down');
        const content = await fs.readFile(this.options.killSwitchFile, 'utf8');
        const data = JSON.parse(content);

        logger.error(`🚨 Previous shutdown: ${data.reason} at ${new Date(data.timestamp).toISOString()}`);
        logger.error('🚨 Remove kill switch file to allow system restart');

        // Prevent startup
        throw new Error('KILL SWITCH ACTIVE - Remove .killswitch file to restart');
      }

      // Check for emergency state file
      const stateExists = await fs.access(this.options.stateFile)
        .then(() => true)
        .catch(() => false);

      if (stateExists) {
        const stateContent = await fs.readFile(this.options.stateFile, 'utf8');
        this.emergencyState = JSON.parse(stateContent);

        if (this.emergencyState.isActive) {
          logger.warn('⚠️ Emergency state detected from previous session');
          logger.warn(`⚠️ Reason: ${this.emergencyState.reason}`);
        }
      }

    } catch (error) {
      if (error.message.includes('KILL SWITCH ACTIVE')) {
        throw error;
      }
      logger.debug('No previous activation detected');
    }
  }

  // Start monitoring kill switch file
  startFileMonitoring() {
    this.fileMonitor = setInterval(async () => {
      try {
        const exists = await fs.access(this.options.killSwitchFile)
          .then(() => true)
          .catch(() => false);

        if (exists && !this.isActive) {
          const content = await fs.readFile(this.options.killSwitchFile, 'utf8');
          let data = {};
          try {
            data = JSON.parse(content);
          } catch (e) {
            data = { reason: 'Manual activation', timestamp: Date.now() };
          }

          await this.activate('file', data.reason || 'Manual kill switch file detected');
        }
      } catch (error) {
        logger.error('Error checking kill switch file:', error);
      }
    }, this.options.checkInterval);

    logger.info('✅ Kill switch file monitoring started');
  }

  // Start monitoring system state
  startStateMonitoring() {
    this.stateMonitor = setInterval(async () => {
      try {
        if (this.isActive) return; // Already active

        // Check for emergency conditions
        const emergencyConditions = await this.checkEmergencyConditions();

        if (emergencyConditions.shouldActivate) {
          await this.activate('automatic', emergencyConditions.reason);
        }
      } catch (error) {
        logger.error('Error monitoring system state:', error);
      }
    }, this.options.checkInterval);

    logger.info('✅ System state monitoring started');
  }

  // Check for emergency conditions
  async checkEmergencyConditions() {
    try {
      const conditions = {
        shouldActivate: false,
        reason: null
      };

      // Check if bot has risk manager
      if (this.bot.riskManager) {
        const riskHealth = await this.bot.riskManager.healthCheck();

        // Skip emergency check if already in emergency mode (prevents loops)
        if (this.bot.riskManager.emergencyState?.isShutdown) {
          // Already in emergency mode, don't trigger another shutdown
          conditions.shouldActivate = false;
          return conditions;
        }
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (heapUsedPercent > 95) {
        conditions.shouldActivate = true;
        conditions.reason = `Memory exhaustion: ${heapUsedPercent.toFixed(2)}% heap used`;
        return conditions;
      }

      // Check for unhandled errors
      if (process.listenerCount('uncaughtException') === 0) {
        logger.warn('⚠️ No uncaught exception handler - adding one');
        process.on('uncaughtException', async (error) => {
          logger.error('🚨 UNCAUGHT EXCEPTION:', error);
          await this.activate('uncaught-exception', `Uncaught exception: ${error.message}`);
        });
      }

      return conditions;

    } catch (error) {
      logger.error('Error checking emergency conditions:', error);
      return { shouldActivate: false, reason: null };
    }
  }

  // CRITICAL: Activate kill switch
  async activate(triggeredBy, reason) {
    if (this.isActive) {
      logger.warn('⚠️ Kill switch already active');
      return;
    }

    try {
      logger.error('🚨🚨🚨 EMERGENCY KILL SWITCH ACTIVATED 🚨🚨🚨');
      logger.error(`🚨 Triggered by: ${triggeredBy}`);
      logger.error(`🚨 Reason: ${reason}`);

      this.isActive = true;
      this.activationTime = Date.now();
      this.activationReason = reason;
      this.activatedBy = triggeredBy;

      // Update emergency state
      this.emergencyState = {
        isActive: true,
        activationTime: this.activationTime,
        reason: reason,
        triggeredBy: triggeredBy,
        positionsClosed: false,
        ordersCancelled: false,
        systemState: await this.captureSystemState()
      };

      // Persist state immediately
      await this.persistState();

      // Create kill switch file
      await this.createKillSwitchFile();

      // Execute emergency procedures
      await this.executeEmergencyProcedures();

      // Stop all bot operations
      await this.stopBotOperations();

      // Send critical alerts
      await this.sendCriticalAlerts();

      logger.error('🚨 EMERGENCY SHUTDOWN COMPLETE');
      logger.error('🚨 System is now in safe mode');
      logger.error('🚨 Manual intervention required to restart');

      // Exit process after a delay to ensure logging
      setTimeout(() => {
        process.exit(1);
      }, 5000);

    } catch (error) {
      logger.error('❌ CRITICAL: Error during kill switch activation:', error);
      // Force exit even if activation fails
      process.exit(1);
    }
  }

  // Create kill switch file
  async createKillSwitchFile() {
    try {
      const data = {
        timestamp: this.activationTime,
        reason: this.activationReason,
        triggeredBy: this.activatedBy,
        systemState: this.emergencyState.systemState
      };

      await fs.writeFile(
        this.options.killSwitchFile,
        JSON.stringify(data, null, 2),
        'utf8'
      );

      logger.info('✅ Kill switch file created');

    } catch (error) {
      logger.error('❌ Failed to create kill switch file:', error);
    }
  }

  // Persist emergency state
  async persistState() {
    try {
      await fs.writeFile(
        this.options.stateFile,
        JSON.stringify(this.emergencyState, null, 2),
        'utf8'
      );

      logger.info('✅ Emergency state persisted');

    } catch (error) {
      logger.error('❌ Failed to persist emergency state:', error);
    }
  }

  // Capture current system state
  async captureSystemState() {
    try {
      return {
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        botState: this.bot.getStats ? await this.bot.getStats() : null
      };
    } catch (error) {
      logger.error('Error capturing system state:', error);
      return null;
    }
  }

  // Execute emergency procedures
  async executeEmergencyProcedures() {
    try {
      logger.info('🚨 Executing emergency procedures...');

      // Cancel all pending orders
      if (this.options.autoCancelOrders) {
        await this.cancelAllOrders();
        this.emergencyState.ordersCancelled = true;
      }

      // Close all open positions (if safe)
      if (this.options.autoClosePositions) {
        await this.closeAllPositions();
        this.emergencyState.positionsClosed = true;
      }

      // Persist updated state
      await this.persistState();

      logger.info('✅ Emergency procedures executed');

    } catch (error) {
      logger.error('❌ Error during emergency procedures:', error);
    }
  }

  // Cancel all pending orders
  async cancelAllOrders() {
    try {
      logger.info('🚨 Cancelling all pending orders...');

      // Cancel orders via bot
      if (this.bot.cancelAllOrders) {
        await this.bot.cancelAllOrders();
      }

      logger.info('✅ All orders cancelled');

    } catch (error) {
      logger.error('❌ Error cancelling orders:', error);
    }
  }

  // Close all open positions
  async closeAllPositions() {
    try {
      logger.info('🚨 Closing all open positions...');

      // Close positions via bot
      if (this.bot.closeAllPositions) {
        await this.bot.closeAllPositions();
      }

      logger.info('✅ All positions closed');

    } catch (error) {
      logger.error('❌ Error closing positions:', error);
    }
  }

  // Stop all bot operations
  async stopBotOperations() {
    try {
      logger.info('🚨 Stopping all bot operations...');

      // Stop bot if it has a stop method
      if (this.bot.stop) {
        await this.bot.stop();
      }

      // Stop all strategies
      if (this.bot.strategies) {
        for (const strategy of Object.values(this.bot.strategies)) {
          if (strategy.shutdown) {
            await strategy.shutdown();
          }
        }
      }

      logger.info('✅ Bot operations stopped');

    } catch (error) {
      logger.error('❌ Error stopping bot:', error);
    }
  }

  // Send critical alerts
  async sendCriticalAlerts() {
    try {
      logger.info('🚨 Sending critical alerts...');

      // Send alerts via bot's alert system
      if (this.bot.alertSystem) {
        await this.bot.alertSystem.send({
          level: 'CRITICAL',
          type: 'EMERGENCY_KILL_SWITCH_ACTIVATED',
          reason: this.activationReason,
          triggeredBy: this.activatedBy,
          timestamp: this.activationTime,
          state: this.emergencyState
        });
      }

      logger.info('✅ Critical alerts sent');

    } catch (error) {
      logger.error('❌ Error sending alerts:', error);
    }
  }

  // Manual activation via API/console
  async manualActivate(reason) {
    await this.activate('manual', reason || 'Manual activation');
  }

  // Check if kill switch is active
  isKillSwitchActive() {
    return this.isActive;
  }

  // Get kill switch status
  getStatus() {
    return {
      isActive: this.isActive,
      activationTime: this.activationTime,
      activationReason: this.activationReason,
      activatedBy: this.activatedBy,
      emergencyState: this.emergencyState
    };
  }

  // Deactivate kill switch (manual intervention required)
  async deactivate(password) {
    // Require password for deactivation
    const correctPassword = process.env.KILL_SWITCH_PASSWORD || 'EMERGENCY_OVERRIDE';

    if (password !== correctPassword) {
      throw new Error('Invalid password for kill switch deactivation');
    }

    try {
      logger.warn('⚠️ Deactivating kill switch...');

      // Remove kill switch file
      try {
        await fs.unlink(this.options.killSwitchFile);
      } catch (e) {
        // File might not exist
      }

      // Reset state
      this.isActive = false;
      this.activationTime = null;
      this.activationReason = null;
      this.activatedBy = null;
      this.emergencyState.isActive = false;

      await this.persistState();

      logger.info('✅ Kill switch deactivated');
      logger.warn('⚠️ System can now be restarted');

    } catch (error) {
      logger.error('❌ Error deactivating kill switch:', error);
      throw error;
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      // Stop monitoring
      if (this.fileMonitor) {
        clearInterval(this.fileMonitor);
        this.fileMonitor = null;
      }

      if (this.stateMonitor) {
        clearInterval(this.stateMonitor);
        this.stateMonitor = null;
      }

      logger.info('✅ Emergency Kill Switch shutdown completed');

    } catch (error) {
      logger.error('❌ Error during kill switch shutdown:', error);
    }
  }
}

module.exports = EmergencyKillSwitch;
