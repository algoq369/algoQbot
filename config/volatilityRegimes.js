// ═══════════════════════════════════════════════════════════════
// VOLATILITY REGIME DETECTION & CONFIGURATION
// Professional-grade adaptive trading system
// ═══════════════════════════════════════════════════════════════

/**
 * Volatility Regime Definitions
 *
 * HIGH: Strong trending markets, momentum plays
 * MEDIUM: Range-bound markets, mean reversion
 * LOW: Consolidation, grid trading
 * VERY_LOW: Extremely quiet, skip trading
 */

const REGIME_THRESHOLDS = {
  HIGH: 2.0,      // 2%+ volatility
  MEDIUM: 0.8,    // 0.8-2% volatility
  LOW: 0.3,       // 0.3-0.8% volatility
  VERY_LOW: 0.0   // <0.3% volatility (skip)
};

const REGIME_CONFIGS = {
  HIGH: {
    name: 'HIGH_VOLATILITY',
    description: 'High volatility - trending market',
    minVolatility: 2.0,

    // Strategy selection (4-strategy system)
    strategies: ['momentum', 'gridTrading'],  // Removed: breakout (60-75% correlation with momentum)
    primaryStrategy: 'momentum',

    // Position sizing
    positionSizePercent: 0.09,  // 9% of portfolio
    maxPositionSize: 0.12,      // Cap at 12%

    // Take profit / Stop loss
    tpMultiplier: 1.5,          // TP = volatility × 1.5
    slMultiplier: 0.8,          // SL = volatility × 0.8
    minTP: 0.018,               // Minimum 1.8% TP

    // Risk management
    maxDailyTrades: 5,
    cooldownMs: 180000,         // 3 minutes between trades

    // Confidence adjustments
    confidenceBoost: 1.1        // +10% confidence in high vol
  },

  MEDIUM: {
    name: 'MEDIUM_VOLATILITY',
    description: 'Medium volatility - range-bound market',
    minVolatility: 0.8,

    // Strategy selection (4-strategy system)
    strategies: ['mean_reversion', 'gridTrading'],  // Removed: ranging (70-85% correlation with mean_reversion), vwap (limited DeFi effectiveness)
    primaryStrategy: 'mean_reversion',

    // Position sizing
    positionSizePercent: 0.06,  // 6% of portfolio
    maxPositionSize: 0.09,      // Cap at 9%

    // Take profit / Stop loss
    tpMultiplier: 2.0,          // TP = volatility × 2.0
    slMultiplier: 1.0,          // SL = volatility × 1.0
    minTP: 0.012,               // Minimum 1.2% TP

    // Risk management
    maxDailyTrades: 8,
    cooldownMs: 120000,         // 2 minutes between trades

    // Confidence adjustments
    confidenceBoost: 1.0        // No adjustment
  },

  LOW: {
    name: 'LOW_VOLATILITY',
    description: 'Low volatility - consolidation phase',
    minVolatility: 0.3,

    // Strategy selection (4-strategy system)
    strategies: ['gridTrading', 'arbitrage'],  // Removed: vwap (limited DeFi effectiveness), ichimoku (only works in sustained trends)
    primaryStrategy: 'gridTrading',

    // Position sizing
    positionSizePercent: 0.03,  // 3% of portfolio
    maxPositionSize: 0.06,      // Cap at 6%

    // Take profit / Stop loss
    tpMultiplier: 2.5,          // TP = volatility × 2.5
    slMultiplier: 1.2,          // SL = volatility × 1.2
    minTP: 0.008,               // Minimum 0.8% TP

    // Risk management
    maxDailyTrades: 12,
    cooldownMs: 60000,          // 1 minute between trades

    // Confidence adjustments
    confidenceBoost: 0.9        // -10% confidence in low vol
  },

  VERY_LOW: {
    name: 'VERY_LOW_VOLATILITY',
    description: 'Extremely low volatility - skip trading',
    minVolatility: 0.0,

    // No trading in this regime
    strategies: [],
    primaryStrategy: null,

    positionSizePercent: 0.0,
    maxPositionSize: 0.0,

    tpMultiplier: 0,
    slMultiplier: 0,
    minTP: 0,

    maxDailyTrades: 0,
    cooldownMs: 0,

    confidenceBoost: 0
  }
};

/**
 * Detect current volatility regime based on 4h volatility
 * @param {number} volatility4h - Current 4-hour volatility (decimal, e.g., 0.024 = 2.4%)
 * @returns {string} - Regime name: 'HIGH', 'MEDIUM', 'LOW', or 'VERY_LOW'
 */
function detectVolatilityRegime(volatility4h) {
  // Convert to percentage for comparison
  const volPercent = volatility4h * 100;

  if (volPercent >= REGIME_THRESHOLDS.HIGH) {
    return 'HIGH';
  } else if (volPercent >= REGIME_THRESHOLDS.MEDIUM) {
    return 'MEDIUM';
  } else if (volPercent >= REGIME_THRESHOLDS.LOW) {
    return 'LOW';
  } else {
    return 'VERY_LOW';
  }
}

/**
 * Get configuration for a specific regime
 * @param {string} regime - Regime name
 * @returns {object} - Regime configuration
 */
function getRegimeConfig(regime) {
  return REGIME_CONFIGS[regime] || REGIME_CONFIGS.VERY_LOW;
}

/**
 * Calculate dynamic position size based on regime and confidence
 * Professional conservative 3/6/9% approach with confidence scaling
 * @param {string} regime - Current regime
 * @param {number} confidence - Trading confidence (0-1)
 * @param {number} portfolioValue - Total portfolio value in USD
 * @returns {number} - Position size in USD
 */
function calculatePositionSize(regime, confidence, portfolioValue) {
  const config = getRegimeConfig(regime);

  // Base position size from regime (3/6/9%)
  let positionPercent = config.positionSizePercent;

  // VERY_LOW regime: Skip trading entirely (return 0)
  if (regime === 'VERY_LOW' || positionPercent === 0) {
    return 0;
  }

  // Apply confidence multiplier (0.7-1.0 range)
  // Confidence 70% = 0.7x multiplier
  // Confidence 85% = 0.85x multiplier
  // Confidence 100% = 1.0x multiplier
  const confidenceMultiplier = Math.max(0.7, Math.min(confidence, 1.0));
  positionPercent *= confidenceMultiplier;

  // Professional safety caps: 2-12% absolute limits
  positionPercent = Math.max(0.02, Math.min(positionPercent, 0.12));

  // Calculate USD amount
  const positionSize = portfolioValue * positionPercent;

  return Math.floor(positionSize);
}

/**
 * Calculate dynamic TP/SL based on regime and volatility
 * @param {string} regime - Current regime
 * @param {number} volatility4h - Current 4h volatility (decimal)
 * @returns {object} - { tp, sl } in decimal format
 */
function calculateTPSL(regime, volatility4h) {
  const config = getRegimeConfig(regime);

  // Calculate TP
  let tp = volatility4h * config.tpMultiplier;
  tp = Math.max(tp, config.minTP);  // Ensure minimum TP

  // Calculate SL
  let sl = volatility4h * config.slMultiplier;

  return {
    tp: tp,
    sl: sl
  };
}

module.exports = {
  REGIME_THRESHOLDS,
  REGIME_CONFIGS,
  detectVolatilityRegime,
  getRegimeConfig,
  calculatePositionSize,
  calculateTPSL
};
