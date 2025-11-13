const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  network: {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    chainId: parseInt(process.env.BSC_CHAIN_ID) || 56,
    name: 'BSC Mainnet'
  },

  wallet: {
    address: process.env.WALLET_ADDRESS || '0xADE6c794FB40dD136cbCcABfb64494D6CEC8333E',
    privateKey: process.env.PRIVATE_KEY,
  },

  trading: {
    totalPortfolio: 60000,

    // Grid Trading: $18k - Automated grid trading across support/resistance levels
    gridTrading: {
      enabled: true,
      allocation: 18000,
      pairs: [
        { symbol: 'BNB/USDT', allocation: 12600, gridLevels: 15, gridSpacing: 0.018 },  // 70% to BNB
        { symbol: 'ETH/USDT', allocation: 5400, gridLevels: 18, gridSpacing: 0.020 }    // 30% to ETH
      ]
    },

    // Momentum Trading: $15k - Trend-following strategy with RSI/EMA signals
    momentum: {
      enabled: true,
      allocation: 15000,
      pairs: [
        { symbol: 'BNB/USDT', allocation: 10500 },  // 70% to BNB
        { symbol: 'ETH/USDT', allocation: 4500 }    // 30% to ETH
      ]
    },

    // Mean Reversion: $15k - Buy oversold, sell overbought conditions
    meanReversion: {
      enabled: true,
      allocation: 15000,
      pairs: [
        { symbol: 'BNB/USDT', allocation: 10500 },  // 70% to BNB
        { symbol: 'ETH/USDT', allocation: 4500 }    // 30% to ETH
      ]
    },

    // Arbitrage: $12k - Cross-DEX price differences
    arbitrage: {
      enabled: true,
      allocation: 12000,
      minSpread: 0.015  // Minimum 1.5% spread to execute
    },

    // DISABLED STRATEGIES (set to false, allocation: 0)
    leverageTrading: {
      enabled: false,
      allocation: 0,
      tiers: [
        { minConfidence: 0.88, leverage: 5, zScore: -2.0, rsi: 25, allocation: 0 },
        { minConfidence: 0.83, leverage: 3, zScore: -1.6, rsi: 30, allocation: 0 },
        { minConfidence: 0.78, leverage: 2, zScore: -1.3, rsi: 35, allocation: 0 }
      ],
      maxDailyTrades: 5,
      stopLossPercent: 0.06,
      minHoldTime: 14400000  // 4 hours
    },

    marketMaking: {
      enabled: false,
      allocation: 0,
      spread: 0.002,  // 0.2% spread
      orderSize: 0,
      pairs: ['BNB/USDT', 'ETH/USDT'],
      refreshInterval: 300000  // 5 minutes
    },

    yield: {
      enabled: false,
      allocation: 0,
      protocols: [
        {
          name: 'venus',
          asset: 'USDT',
          allocation: 0,
          expectedAPY: 0.10
        }
      ]
    }
  },

  // DEPRECATED: positionSizing: {
  // DEPRECATED:   extreme: 0.30,    // 30% = $18,000 - extreme conviction
  // DEPRECATED:   veryHigh: 0.25,   // 25% = $15,000 - very high conviction (+5% vs old 20%)
  // DEPRECATED:   high: 0.15,       // 15% = $9,000 - high conviction (+5% vs old 10%)
  // DEPRECATED:   medium: 0.08,     // 8% = $4,800 - medium conviction (+3% vs old 5%)
  // DEPRECATED:   low: 0.05         // 5% = $3,000 - low conviction
  // DEPRECATED: },

  // Risk Management Configuration - OPTIMIZED FOR $60K PORTFOLIO
  risk: {
    dailyLossLimit: parseFloat(process.env.DAILY_LOSS_LIMIT) || 3000, // $3,000 (5% of $60k)
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 0.35, // 35% of portfolio ($21k max)
    maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES) || 5,
    emergencyStopThreshold: parseFloat(process.env.EMERGENCY_STOP_THRESHOLD) || 9000, // $9,000 (15% drawdown)
    volatilityThreshold: parseFloat(process.env.VOLATILITY_THRESHOLD) || 0.05, // 5%
    maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN) || 0.15, // 15% max drawdown
    maxTradeSize: parseFloat(process.env.MAX_TRADE_SIZE) || 10500, // $10.5k max per trade
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 3000, // $3k daily loss limit
    maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN) || 9000 // $9k total drawdown
  },

  // Hybrid Portfolio Balancing Configuration
  // Expert-recommended dynamic position sizing based on portfolio allocation
  // Enables gradual scaling in middle ranges while maintaining hard blocks at extremes
  hybrid: {
    bnb: {
      // BNB percentage thresholds for position sizing decisions
      blockHigh: parseFloat(process.env.BNB_BLOCK_HIGH) || 55,    // Block BUY if BNB >= 55%
      scale25: parseFloat(process.env.BNB_SCALE_25) || 50,        // 25% size if BNB >= 50%
      scale50: parseFloat(process.env.BNB_SCALE_50) || 45,        // 50% size if BNB >= 45%
      scale75: parseFloat(process.env.BNB_SCALE_75) || 40,        // 75% size if BNB >= 40%
      blockLow: parseFloat(process.env.BNB_BLOCK_LOW) || 35,      // Block SELL if BNB <= 35%
    },
    multipliers: {
      // Position size multipliers for gradual scaling
      high: parseFloat(process.env.MULTIPLIER_HIGH) || 0.25,     // 25% of base position
      medium: parseFloat(process.env.MULTIPLIER_MED) || 0.5,     // 50% of base position
      low: parseFloat(process.env.MULTIPLIER_LOW) || 0.75,       // 75% of base position
    }
  },

  // Professional Indicator Weighting System (8-Indicator Confidence Calculation)
  indicators: {
    // Hard caps for individual indicators
    maxWeight: parseFloat(process.env.INDICATOR_MAX_WEIGHT) || 0.30,  // Max 30% per indicator
    minWeight: parseFloat(process.env.INDICATOR_MIN_WEIGHT) || 0.05,  // Min 5% per indicator (or exclude)

    // Current weight allocation (must sum to 100%)
    weights: {
      vwap: parseFloat(process.env.WEIGHT_VWAP) || 0.164,                    // 18% - VWAP (Institutional benchmark)
      atr: parseFloat(process.env.WEIGHT_ATR) || 0.182,                      // 20% - ATR (Risk management)
      multiTimeframe: parseFloat(process.env.WEIGHT_MULTI_TF) || 0.182,      // 20% - Multi-TF (Signal confirmation)
      volume: parseFloat(process.env.WEIGHT_VOLUME) || 0.164,                // 18% - Volume (Trade confirmation)
      rsi: parseFloat(process.env.WEIGHT_RSI) || 0.109,                      // 12% - RSI (Momentum) - REDUCED from 45%
      regime: parseFloat(process.env.WEIGHT_REGIME) || 0.109,                // 12% - Market regime detection
      ema: parseFloat(process.env.WEIGHT_EMA) || 0.090                       // 9% - EMA (Trend direction)
    },

    // Time-of-day position sizing multipliers
    timeFactors: {
      peakHours: parseFloat(process.env.TIME_FACTOR_PEAK) || 1.0,    // 1.0x during 8am-4pm GMT (peak trading hours)
      offHours: parseFloat(process.env.TIME_FACTOR_OFF) || 0.6       // 0.6x during off-peak hours
    },

    // VWAP configuration
    vwap: {
      lookbackHours: parseInt(process.env.VWAP_LOOKBACK_HOURS) || 24,          // 24-hour VWAP calculation
      deviationThreshold: parseFloat(process.env.VWAP_DEVIATION_THRESHOLD) || 0.02  // 2% deviation threshold for signals
    },

    // ATR configuration
    atr: {
      period: parseInt(process.env.ATR_PERIOD) || 14,                          // 14-period ATR
      lowVolatilityThreshold: parseFloat(process.env.ATR_LOW_THRESHOLD) || 2,  // <2% ATR = low volatility
      highVolatilityThreshold: parseFloat(process.env.ATR_HIGH_THRESHOLD) || 5 // >5% ATR = high volatility
    },

    // Volume configuration
    volume: {
      lookbackPeriod: parseInt(process.env.VOLUME_LOOKBACK_PERIOD) || 20,      // 20-period volume average
      highVolumeRatio: parseFloat(process.env.VOLUME_HIGH_RATIO) || 1.5,       // >1.5x average = high volume
      lowVolumeRatio: parseFloat(process.env.VOLUME_LOW_RATIO) || 0.7          // <0.7x average = low volume
    }
  },

  monitoring: {
    enabled: true,
    strategyReviewInterval: 900000,
    disableThreshold: 0.48,
    minTradesBeforeDisable: 15,
    reenableThreshold: 0.55
  },

  cooldowns: {
    spotTrading: 60000, // 1 minute
    leverageTrading: 300000 // 5 minutes
  },

  // Gas Optimization Configuration
  gas: {
    maxGasPrice: parseFloat(process.env.MAX_GAS_PRICE) || 20, // 20 gwei
    minGasPrice: parseFloat(process.env.MIN_GAS_PRICE) || 1, // 1 gwei
    gasLimit: parseInt(process.env.GAS_LIMIT) || 300000
  },

  // Trading Configuration - OPTIMIZED FOR $60K PORTFOLIO
  tradingExecution: {
    pair: process.env.TRADING_PAIR || 'USDT/BNB',
    initialBudget: parseFloat(process.env.INITIAL_BUDGET) || 60000, // $60k portfolio
    minTradeAmount: parseFloat(process.env.MIN_TRADE_AMOUNT) || 100, // $100 minimum
    maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT) || 10500, // $10.5k maximum (35%)
  },

  // Ranging Strategy
  strategy: {
    lowerBoundPercent: parseFloat(process.env.LOWER_BOUND_PERCENT) || 0.98,
    upperBoundPercent: parseFloat(process.env.UPPER_BOUND_PERCENT) || 1.02,
    rangeMin: parseFloat(process.env.RANGE_MIN) || 0.04, // 4% - filters noise
    rangeMax: parseFloat(process.env.RANGE_MAX) || 0.12, // 12% - catches real ranges
    trendThreshold: parseFloat(process.env.TREND_THRESHOLD) || 0.01,
    boundsThreshold: parseFloat(process.env.BOUNDS_THRESHOLD) || 0.10, // 10% - more aggressive entries
    minProfit: parseFloat(process.env.MIN_PROFIT) || 5.00, // $5.00 - OPTIMIZED FOR $60K
    cooldownMs: parseFloat(process.env.COOLDOWN_MS) || 60000, // 1 minute - OPTIMIZED FOR $60K
  },

  dex: {
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2 Factory (checksummed)
  },

  tokens: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },

  // AI Configuration
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.AI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.2
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/bot.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  }
};
