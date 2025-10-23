#!/usr/bin/env node

/**
 * Emergency Shutdown Recovery Script
 * Clears emergency shutdown state from database
 */

const logger = require('./logger');
const fs = require('fs');
const path = require('path');

async function clearEmergencyShutdown() {
  try {
    logger.info('🔄 Starting emergency shutdown recovery...');

    // Import database models
    let models;
    try {
      models = require('./database/models');
    } catch (error) {
      logger.warn('⚠️ Could not load database models, will try alternative method');
    }

    // Method 1: Clear from database if models available
    if (models && models.RiskState) {
      try {
        await models.RiskState.destroy({ where: {} });
        logger.info('✅ Cleared risk state from database');
      } catch (error) {
        logger.warn(`⚠️ Could not clear RiskState: ${error.message}`);
      }
    }

    // Method 2: Clear database file entirely (nuclear option but safe for fresh start)
    const dbPath = path.join(__dirname, 'data', 'trading_bot.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      logger.info('✅ Removed database file - will be recreated on next start');
    }

    logger.info('✅ Emergency shutdown cleared successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Restart the bot: npm start');
    logger.info('2. Monitor logs: tail -f logs/combined.log | grep -E "Position Size|Emergency|TP CHECK"');
    logger.info('3. Watch for exits: tail -f logs/combined.log | grep -E "EXIT|🎯|⏰"');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error clearing emergency shutdown:', error);
    process.exit(1);
  }
}

clearEmergencyShutdown();
