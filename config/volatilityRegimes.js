// ═══════════════════════════════════════════════════════════════
// VOLATILITY REGIME DETECTION & CONFIGURATION
// Professional-grade adaptive trading system
// ═══════════════════════════════════════════════════════════════

/**
 * Volatility Regime Definitions
 *
 * VERY_LOW: Very quiet markets (<0.3%), no trading recommended
 * LOW: Consolidation phase (0.3-0.8%), standard professional minimums
 * MEDIUM: Normal volatility (0.8-1.5%), dynamic scaling
 * HIGH: Strong trending markets (1.5-2.5%), higher targets
 * VERY_HIGH: Extreme volatility (>2.5%), aggressive targets
 */

const REGIME_THRESHOLDS = {
  VERY_HIGH: 2.5,   // >2.5% volatility
  HIGH: 1.5,        // 1.5-2.5% volatility
  MEDIUM: 0.8,      // 0.8-1.5% volatility
  LOW: 0.3,         // 0.3-0.8% volatility
  VERY_LOW: 0.0     // <0.3% volatility (no trading)
};

const REGIME_CONFIGS = {
  VERY_LOW: {
    name: 'VERY_LOW_VOLATILITY',
    description: 'Very quiet market - no trading recommended',
    minVolatility: 0.0,

    // Strategy selection
    strategies: [],
    primaryStrategy: null,

    // Position sizing (disabled)
    positionSizePercent: 0.0,
    maxPositionSize: 0.0,

    // Take profit / Stop loss (PROFESSIONAL BSC STANDARDS)
    tpMultiplier: 10,            // TP = volatility × 10
    slMultiplier: 4,             // SL = volatility × 4
    minTP: 0.035,                // Minimum 3.5% TP (covers 2.5% BSC costs + 1% profit)
    minSL: 0.015,                // Minimum 1.5% SL (ATR-based protection)

    // Risk management
    maxDailyTrades: 0,
    cooldownMs: 300000,          // 5 minutes between checks

    // Confidence adjustments
    confidenceBoost: 0.0         // No trading in very low vol
  },

  LOW: {
    name: 'LOW_VOLATILITY',
    description: 'Low volatility - consolidation phase',
    minVolatility: 0.3,

    // Strategy selection (4-strategy system)
    strategies: ['gridTrading', 'arbitrage'],
    primaryStrategy: 'gridTrading',

    // Position sizing
    positionSizePercent: 0.03,  // 3% of portfolio
    maxPositionSize: 0.06,      // Cap at 6%

    // Take profit / Stop loss (PROFESSIONAL BSC STANDARDS)
    tpMultiplier: 10,            // TP = volatility × 10
    slMultiplier: 4,             // SL = volatility × 4
    minTP: 0.035,                // Minimum 3.5% TP (covers 2.5% BSC costs + 1% profit)
    minSL: 0.015,                // Minimum 1.5% SL (ATR-based protection)

    // Risk management
    maxDailyTrades: 12,
    cooldownMs: 60000,           // 1 minute between trades

    // Confidence adjustments
    confidenceBoost: 0.95        // -5% confidence in low vol
  },

  MEDIUM: {
    name: 'MEDIUM_VOLATILITY',
    description: 'Normal volatility - range-bound market',
    minVolatility: 0.8,

    // Strategy selection (4-strategy system)
    strategies: ['mean_reversion', 'gridTrading'],
    primaryStrategy: 'mean_reversion',

    // Position sizing
    positionSizePercent: 0.06,  // 6% of portfolio
    maxPositionSize: 0.09,      // Cap at 9%

    // Take profit / Stop loss (DYNAMIC SCALING)
    tpMultiplier: 4.5,           // TP = volatility × 4.5
    slMultiplier: 2.0,           // SL = volatility × 2.0
    minTP: 0.040,                // Minimum 4.0% TP
    minSL: 0.018,                // Minimum 1.8% SL

    // Risk management
    maxDailyTrades: 8,
    cooldownMs: 120000,          // 2 minutes between trades

    // Confidence adjustments
    confidenceBoost: 1.0         // No adjustment
  },

  HIGH: {
    name: 'HIGH_VOLATILITY',
    description: 'High volatility - trending market',
    minVolatility: 1.5,

    // Strategy selection (4-strategy system)
    strategies: ['momentum', 'gridTrading'],
    primaryStrategy: 'momentum',

    // Position sizing
    positionSizePercent: 0.09,  // 9% of portfolio
    maxPositionSize: 0.12,      // Cap at 12%

    // Take profit / Stop loss (DYNAMIC SCALING)
    tpMultiplier: 3.5,           // TP = volatility × 3.5
    slMultiplier: 1.5,           // SL = volatility × 1.5
    minTP: 0.050,                // Minimum 5.0% TP
    minSL: 0.020,                // Minimum 2.0% SL (ATR-based protection for high vol)

    // Risk management
    maxDailyTrades: 5,
    cooldownMs: 180000,          // 3 minutes between trades

    // Confidence adjustments
    confidenceBoost: 1.1         // +10% confidence in high vol
  },

  VERY_HIGH: {
    name: 'VERY_HIGH_VOLATILITY',
    description: 'Very high volatility - extreme moves',
    minVolatility: 2.5,

    // Strategy selection
    strategies: ['momentum'],
    primaryStrategy: 'momentum',

    // Position sizing (conservative in extreme vol)
    positionSizePercent: 0.07,  // 7% of portfolio
    maxPositionSize: 0.10,      // Cap at 10%

    // Take profit / Stop loss (DYNAMIC SCALING)
    tpMultiplier: 3.0,           // TP = volatility × 3.0
    slMultiplier: 1.2,           // SL = volatility × 1.2
    minTP: 0.060,                // Minimum 6.0% TP
    minSL: 0.025,                // Minimum 2.5% SL

    // Risk management
    maxDailyTrades: 3,
    cooldownMs: 300000,          // 5 minutes between trades

    // Confidence adjustments
    confidenceBoost: 1.05        // +5% confidence but cautious
  }
};

/**
 * Detect current volatility regime based on 4h volatility
 * @param {number} volatility4h - Current 4-hour volatility (decimal, e.g., 0.0014 = 0.14%)
 * @returns {string} - Regime name: 'VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'
 */
function detectVolatilityRegime(volatility4h) {
  // Normalize input (handle both percentage and decimal formats)
  const vol = volatility4h > 1 ? volatility4h / 100 : volatility4h;
  const volPercent = vol * 100;

  // VERY_LOW: <0.3% (no trading recommended)
  if (volPercent < REGIME_THRESHOLDS.LOW) {
    return 'VERY_LOW';
  }

  // LOW: 0.3-0.8%
  if (volPercent < REGIME_THRESHOLDS.MEDIUM) {
    return 'LOW';
  }

  // MEDIUM: 0.8-1.5%
  if (volPercent < REGIME_THRESHOLDS.HIGH) {
    return 'MEDIUM';
  }

  // HIGH: 1.5-2.5%
  if (volPercent < REGIME_THRESHOLDS.VERY_HIGH) {
    return 'HIGH';
  }

  // VERY_HIGH: >2.5%
  return 'VERY_HIGH';
}

/**
 * Get configuration for a specific regime
 * @param {string} regime - Regime name
 * @returns {object} - Regime configuration
 */
function getRegimeConfig(regime) {
  return REGIME_CONFIGS[regime] || REGIME_CONFIGS.LOW;
}

/**
 * Calculate dynamic position size based on regime and confidence
 * Professional conservative approach with confidence scaling
 * @param {string} regime - Current regime
 * @param {number} confidence - Trading confidence (0-1)
 * @param {number} portfolioValue - Total portfolio value in USD
 * @returns {number} - Position size in USD
 */
function calculatePositionSize(regime, confidence, portfolioValue) {
  const config = getRegimeConfig(regime);

  // Base position size from regime
  let positionPercent = config.positionSizePercent;

  // Apply confidence multiplier (0.7-1.0 range)
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
 *
 * BSC TRADING COSTS:
 * - Round-trip fees: 2.5-3.5% (entry swap + exit swap + slippage)
 * - Minimum profitable TP: 3.5% (covers fees + profit margin)
 *
 * REGIME-SPECIFIC TP/SL:
 * - VERY_LOW (<0.3%): No trading recommended
 * - LOW (0.3-0.8%): TP 3.5% / SL 1.5% (professional standard)
 * - MEDIUM (0.8-1.5%): TP 4.0%+ / SL 1.8%+ (dynamic scaling)
 * - HIGH (1.5-2.5%): TP 5.0%+ / SL 2.0%+ (trending markets)
 * - VERY_HIGH (>2.5%): TP 6.0%+ / SL 2.5%+ (extreme volatility)
 *
 * @param {string} regime - Current regime
 * @param {number} volatility4h - Current 4h volatility (decimal, e.g., 0.0014 = 0.14%)
 * @returns {object} - { tp, sl } in decimal format
 */
function calculateTPSL(regime, volatility4h) {
  // Normalize volatility input
  const vol = volatility4h > 1 ? volatility4h / 100 : volatility4h;

  const config = getRegimeConfig(regime);

  // Calculate TP/SL based on volatility and regime multipliers
  let tp = vol * config.tpMultiplier;
  let sl = vol * config.slMultiplier;

  // Apply regime-specific minimums (CRITICAL for profitability)
  tp = Math.max(tp, config.minTP);
  sl = Math.max(sl, config.minSL);

  // 🔧 ABSOLUTE SAFETY FLOOR: Never go below professional BSC standards
  // This ensures we NEVER create a guaranteed losing position
  tp = Math.max(tp, 0.035);  // Minimum 3.5% TP (covers BSC costs + profit)
  sl = Math.max(sl, 0.015);  // Minimum 1.5% SL (ATR-based protection)

  return {
    tp: parseFloat(tp.toFixed(4)),
    sl: parseFloat(sl.toFixed(4))
  };
}

/**
 * Get human-readable regime information
 * @param {string} regime - Regime name
 * @returns {object} - Regime information with TP/SL details and rationale
 */
function getRegimeInfo(regime) {
  const config = REGIME_CONFIGS[regime] || REGIME_CONFIGS.LOW;

  // Calculate typical TP/SL for this regime (using minimum volatility for regime)
  const sampleVol = config.minVolatility / 100;
  const tpsl = calculateTPSL(regime, sampleVol);

  const regimes = {
    VERY_LOW: {
      volatility: '<0.3%',
      description: 'Very quiet market',
      tp: 'N/A',
      sl: 'N/A',
      rationale: 'No trading - volatility too low for profitable BSC trades',
      status: '⚠️ Trading disabled in VERY_LOW regime'
    },
    LOW: {
      volatility: '0.3-0.8%',
      description: 'Low volatility',
      tp: `${(tpsl.tp * 100).toFixed(1)}%`,
      sl: `${(tpsl.sl * 100).toFixed(1)}%`,
      rationale: 'Professional standard minimums',
      status: '✅ Trading with standard targets'
    },
    MEDIUM: {
      volatility: '0.8-1.5%',
      description: 'Normal volatility',
      tp: `${(tpsl.tp * 100).toFixed(1)}%+`,
      sl: `${(tpsl.sl * 100).toFixed(1)}%+`,
      rationale: 'Dynamic scaling with volatility',
      status: '✅ Trading with dynamic targets'
    },
    HIGH: {
      volatility: '1.5-2.5%',
      description: 'High volatility',
      tp: `${(tpsl.tp * 100).toFixed(1)}%+`,
      sl: `${(tpsl.sl * 100).toFixed(1)}%+`,
      rationale: 'Higher targets in trending markets',
      status: '✅ Trading with high targets'
    },
    VERY_HIGH: {
      volatility: '>2.5%',
      description: 'Very high volatility',
      tp: `${(tpsl.tp * 100).toFixed(1)}%+`,
      sl: `${(tpsl.sl * 100).toFixed(1)}%+`,
      rationale: 'Aggressive targets for strong moves',
      status: '✅ Trading with aggressive targets'
    }
  };

  return regimes[regime] || regimes.LOW;
}

module.exports = {
  REGIME_THRESHOLDS,
  REGIME_CONFIGS,
  detectVolatilityRegime,
  getRegimeConfig,
  calculatePositionSize,
  calculateTPSL,
  getRegimeInfo
};
