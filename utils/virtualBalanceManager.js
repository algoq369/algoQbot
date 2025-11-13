const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// Shared state file location
const BALANCE_FILE = path.join(__dirname, '..', 'data', 'virtual_balances.json');

// Default starting balances
const DEFAULT_BALANCES = {
  usdt: 36000,
  bnb: 22.0,
  lastUpdated: new Date().toISOString()
};

// In-memory cache of current balances
let sharedBalances = null;

/**
 * Initialize or load virtual balances from persistent storage
 * @returns {Object} Current virtual balances
 */
function initializeSharedBalances() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(BALANCE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Try to load existing balances
    if (fs.existsSync(BALANCE_FILE)) {
      const data = fs.readFileSync(BALANCE_FILE, 'utf8');
      sharedBalances = JSON.parse(data);
      logger.info(`✅ Loaded shared virtual balances: ${sharedBalances.usdt.toFixed(2)} USDT, ${sharedBalances.bnb.toFixed(6)} BNB`);
    } else {
      // Create new balance file with defaults
      sharedBalances = { ...DEFAULT_BALANCES };
      fs.writeFileSync(BALANCE_FILE, JSON.stringify(sharedBalances, null, 2));
      logger.info(`✅ Initialized new virtual balances: ${sharedBalances.usdt.toFixed(2)} USDT, ${sharedBalances.bnb.toFixed(6)} BNB`);
    }

    return sharedBalances;
  } catch (error) {
    logger.error(`❌ Error initializing virtual balances: ${error.message}`);
    // Fallback to defaults
    sharedBalances = { ...DEFAULT_BALANCES };
    return sharedBalances;
  }
}

/**
 * Get current shared virtual balances (from cache or load)
 * @returns {Object} Current virtual balances
 */
function getSharedVirtualBalances() {
  if (!sharedBalances) {
    return initializeSharedBalances();
  }
  return { ...sharedBalances }; // Return copy to prevent direct mutation
}

/**
 * Update shared virtual balances and persist to disk
 * @param {Object} newBalances - New balance values {usdt, bnb}
 * @returns {boolean} Success status
 */
function updateSharedVirtualBalances(newBalances) {
  try {
    // Validation
    if (typeof newBalances.usdt !== 'number' || typeof newBalances.bnb !== 'number') {
      logger.error('❌ Invalid balance values:', newBalances);
      return false;
    }

    if (newBalances.usdt < 0 || newBalances.bnb < 0) {
      logger.error('❌ Negative balances not allowed:', newBalances);
      return false;
    }

    // Update in-memory cache
    sharedBalances = {
      usdt: newBalances.usdt,
      bnb: newBalances.bnb,
      lastUpdated: new Date().toISOString()
    };

    // Persist to disk
    fs.writeFileSync(BALANCE_FILE, JSON.stringify(sharedBalances, null, 2));

    logger.debug(`💾 Virtual balances updated: ${sharedBalances.usdt.toFixed(2)} USDT, ${sharedBalances.bnb.toFixed(6)} BNB`);
    return true;
  } catch (error) {
    logger.error(`❌ Error updating virtual balances: ${error.message}`);
    return false;
  }
}

/**
 * Reset virtual balances to defaults
 * @returns {Object} Reset balances
 */
function resetVirtualBalances() {
  sharedBalances = { ...DEFAULT_BALANCES, lastUpdated: new Date().toISOString() };

  try {
    fs.writeFileSync(BALANCE_FILE, JSON.stringify(sharedBalances, null, 2));
    logger.info(`🔄 Virtual balances reset to defaults: ${sharedBalances.usdt.toFixed(2)} USDT, ${sharedBalances.bnb.toFixed(6)} BNB`);
  } catch (error) {
    logger.error(`❌ Error resetting virtual balances: ${error.message}`);
  }

  return { ...sharedBalances };
}

/**
 * Execute a virtual trade (atomic update of both balances)
 * @param {Object} trade - Trade details {usdtChange, bnbChange}
 * @returns {boolean} Success status
 */
function executeTrade(trade) {
  const current = getSharedVirtualBalances();

  const newBalances = {
    usdt: current.usdt + trade.usdtChange,
    bnb: current.bnb + trade.bnbChange
  };

  // Validate sufficient funds
  if (newBalances.usdt < 0) {
    logger.error(`❌ Insufficient USDT: need ${Math.abs(trade.usdtChange).toFixed(2)}, have ${current.usdt.toFixed(2)}`);
    return false;
  }

  if (newBalances.bnb < 0) {
    logger.error(`❌ Insufficient BNB: need ${Math.abs(trade.bnbChange).toFixed(6)}, have ${current.bnb.toFixed(6)}`);
    return false;
  }

  // 🔥 CRITICAL: Detect balance explosions (sanity check)
  // BNB balance should never exceed 1000 (would be worth >$1M at $1,000/BNB)
  // USDT should stay above 1000 (we start with 36,000)
  if (newBalances.bnb > 1000) {
    logger.error(`❌ BALANCE EXPLOSION DETECTED: BNB would be ${newBalances.bnb.toFixed(6)} (max: 1000)`);
    logger.error(`   Trade: USDT change ${trade.usdtChange.toFixed(2)}, BNB change ${trade.bnbChange.toFixed(6)}`);
    logger.error(`   This indicates inverted price math - CHECK shadowMode.js line 161!`);
    return false;
  }

  if (newBalances.usdt < 1000 && current.usdt > 10000) {
    logger.warn(`⚠️ USDT depleted too quickly: ${newBalances.usdt.toFixed(2)} (was ${current.usdt.toFixed(2)})`);
  }

  return updateSharedVirtualBalances(newBalances);
}

/**
 * Get total portfolio value in USDT
 * @param {number} currentPrice - Current BNB price (BNB per USDT)
 * @returns {number} Total portfolio value in USDT
 */
function getPortfolioValueUSDT(currentPrice) {
  const balances = getSharedVirtualBalances();
  // BNB value = BNB amount / (BNB/USDT price) = USDT
  const bnbValueInUsdt = balances.bnb / currentPrice;
  return balances.usdt + bnbValueInUsdt;
}

module.exports = {
  initializeSharedBalances,
  getSharedVirtualBalances,
  updateSharedVirtualBalances,
  resetVirtualBalances,
  resetSharedVirtualBalances: resetVirtualBalances, // Alias for compatibility
  executeTrade,
  getPortfolioValueUSDT
};
