const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // Network Configuration
  network: {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    chainId: parseInt(process.env.BSC_CHAIN_ID) || 56,
    name: 'BSC Mainnet'
  },

  // Risk Management Configuration
  risk: {
    dailyLossLimit: parseFloat(process.env.DAILY_LOSS_LIMIT) || 50, // 50 USDT
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 0.1, // 10% of portfolio
    maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES) || 5,
    emergencyStopThreshold: parseFloat(process.env.EMERGENCY_STOP_THRESHOLD) || 100, // 100 USDT
    volatilityThreshold: parseFloat(process.env.VOLATILITY_THRESHOLD) || 0.05, // 5%
    maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN) || 0.2 // 20%
  },

  // Gas Optimization Configuration
  gas: {
    maxGasPrice: parseFloat(process.env.MAX_GAS_PRICE) || 20, // 20 gwei
    minGasPrice: parseFloat(process.env.MIN_GAS_PRICE) || 1, // 1 gwei
    gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER) || 1.1,
    maxGasLimit: parseInt(process.env.MAX_GAS_LIMIT) || 500000,
    retryAttempts: parseInt(process.env.GAS_RETRY_ATTEMPTS) || 3
  },

  // Performance Configuration
  performance: {
    parallelDexQueries: process.env.PARALLEL_DEX_QUERIES === 'true',
    maxLatency: parseInt(process.env.MAX_LATENCY) || 5000, // 5 seconds
    cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 5, // 5 seconds
    websocketReconnectAttempts: parseInt(process.env.WS_RECONNECT_ATTEMPTS) || 10
  },

  // Wallet Configuration
  wallet: {
    address: process.env.WALLET_ADDRESS || '0xA358571F3b4CFe228B97983C2C7De2d788DB8FF0',
    privateKey: process.env.PRIVATE_KEY,
  },

  // Trading Configuration
  trading: {
    pair: process.env.TRADING_PAIR || 'USDT/BNB',
    initialBudget: parseFloat(process.env.INITIAL_BUDGET) || 99,
    minTradeAmount: parseFloat(process.env.MIN_TRADE_AMOUNT) || 5,
    maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT) || 20,
  },

  // Ranging Strategy
  strategy: {
    lowerBoundPercent: parseFloat(process.env.LOWER_BOUND_PERCENT) || 0.98,
    upperBoundPercent: parseFloat(process.env.UPPER_BOUND_PERCENT) || 1.02,
    rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD) || 0.005,
  },

  // DEX Configuration
  dex: {
    router: process.env.PANCAKESWAP_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factory: '0xcA143Ce0Fe65960E6Aa4D42C8d3cE161c2B6604f',
  },

  // Token Addresses (BSC Mainnet)
  tokens: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
