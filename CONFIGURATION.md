# Configuration Guide

Complete guide to configuring algoQbot for optimal performance.

## Configuration File Structure

All configuration is done through the `.env` file in the root directory.

```bash
cp .env.example .env
nano .env  # Edit with your settings
```

## Required Configuration

### Wallet Configuration

```bash
# Your BSC wallet address (public address)
WALLET_ADDRESS=0xYourWalletAddressHere

# Your wallet private key (KEEP SECRET!)
PRIVATE_KEY=YourPrivateKeyWithout0xPrefix
```

**Security Notes:**
- Never share your private key
- Never commit `.env` to Git
- Use a dedicated trading wallet
- Start with small amounts

### API Keys

```bash
# Anthropic Claude API (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your API key at: https://console.anthropic.com/

### Network Configuration

```bash
# BSC RPC URL
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# BSC Chain ID (56 for mainnet)
BSC_CHAIN_ID=56
```

**Alternative RPC Providers:**
- `https://bsc-dataseed2.binance.org/`
- `https://bsc-dataseed3.binance.org/`
- QuickNode, Ankr, or your own BSC node

## Trading Parameters

### Capital Management

```bash
# Starting capital (USD)
INITIAL_BUDGET=60000

# Minimum trade size (USD)
MIN_TRADE_AMOUNT=100

# Maximum trade size (USD)
MAX_TRADE_AMOUNT=10500
```

**Recommendations:**
- Start small in shadow mode ($100-1000)
- Increase gradually as you gain confidence
- Never risk more than you can afford to lose

### Risk Management

```bash
# Maximum daily loss (USD)
DAILY_LOSS_LIMIT=3000

# Maximum position size (15% of portfolio)
MAX_POSITION_SIZE=0.15

# Maximum drawdown tolerance (15%)
MAX_DRAWDOWN=0.15

# Circuit breaker trigger (5 consecutive losses)
MAX_CONSECUTIVE_LOSSES=5
```

**Risk Parameters Explained:**
- `DAILY_LOSS_LIMIT`: Bot stops trading if this loss is reached in a day
- `MAX_POSITION_SIZE`: No single position can exceed 15% of total portfolio
- `MAX_DRAWDOWN`: Bot pauses if total loss exceeds 15% from peak
- `MAX_CONSECUTIVE_LOSSES`: Circuit breaker activates after 5 losses in a row

### Portfolio Balancing

```bash
# Target BNB allocation (35-45%)
TARGET_BNB_PERCENT_MIN=35
TARGET_BNB_PERCENT_MAX=45
```

Bot automatically rebalances to maintain 35-45% BNB allocation for:
- Gas fee coverage
- Diversification
- Optimal trading flexibility

## Strategy Configuration

### Enable/Disable Strategies

```bash
# Default strategy
DEFAULT_STRATEGY=ranging

# Enable individual strategies
ENABLE_RANGING=true
ENABLE_MOMENTUM=true
ENABLE_GRID=true
ENABLE_MEAN_REVERSION=true
ENABLE_BREAKOUT=true
ENABLE_VWAP=true
ENABLE_ARBITRAGE=false
```

### Volatility Regime Thresholds

```bash
# VERY_LOW regime: < 0.3% volatility
REGIME_VERY_LOW_THRESHOLD=0.3

# LOW regime: 0.3% - 0.8% volatility
REGIME_LOW_THRESHOLD=0.8

# MEDIUM regime: 0.8% - 2% volatility
REGIME_MEDIUM_THRESHOLD=2.0

# HIGH regime: > 2% volatility
```

### Confidence Thresholds (by Regime)

```bash
# Minimum confidence to trade in each regime
CONFIDENCE_VERY_LOW_REGIME=45  # 45% minimum
CONFIDENCE_LOW_REGIME=55        # 55% minimum
CONFIDENCE_MEDIUM_REGIME=65     # 65% minimum
CONFIDENCE_HIGH_REGIME=70       # 70% minimum
```

Higher volatility requires higher confidence to trade.

## Performance Optimization

### Price Caching

```bash
# Price cache TTL (seconds)
PRICE_CACHE_TTL=30

# Enable performance tracking
ENABLE_PERFORMANCE_TRACKING=true

# Performance log interval (ms)
PERFORMANCE_LOG_INTERVAL=60000
```

**Cache Settings:**
- `PRICE_CACHE_TTL=30`: Caches prices for 30 seconds
- Reduces RPC calls by ~77%
- Trade-off: Slightly delayed price updates

### Gas Configuration

```bash
# Gas limit multiplier (safety buffer)
GAS_LIMIT_MULTIPLIER=1.2

# Gas price multiplier (faster transactions)
GAS_PRICE_MULTIPLIER=1.1

# Maximum slippage tolerance (%)
MAX_SLIPPAGE=1.0

# Transaction deadline (seconds)
TX_DEADLINE=300
```

## Shadow Mode Configuration

```bash
# Enable shadow mode (virtual trading)
SHADOW_MODE_ENABLED=true

# Record shadow trades
SHADOW_MODE_RECORD=true
SHADOW_MODE_RECORD_PATH=./data/shadow_trades.json
```

**Shadow Mode:**
- Trades are simulated, not executed on-chain
- Virtual balance tracking in `data/virtual_balances.json`
- All logic identical to live trading
- Perfect for testing and validation

## Token & DEX Configuration

### Token Addresses (BSC Mainnet)

```bash
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
BNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### DEX Router Addresses

```bash
# PancakeSwap V2
PANCAKESWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
PANCAKESWAP_FACTORY=0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73

# Uniswap V2 (on BSC)
UNISWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
```

## Logging Configuration

```bash
# Log level (error, warn, info, debug, verbose)
LOG_LEVEL=info

# Log file path
LOG_FILE=logs/bot.log

# Log rotation
LOG_MAX_FILES=14    # Keep 14 days of logs
LOG_MAX_SIZE=20m    # 20MB per file
```

**Log Levels:**
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (recommended for production)
- `debug`: Detailed debugging info (recommended for development)
- `verbose`: Very detailed logs (for troubleshooting)

## Database Configuration

```bash
# SQLite database path
DATABASE_PATH=./data/trading_bot.db

# Enable database logging
ENABLE_DATABASE=true
```

## Recommended Configurations

### For Testing/Development

```bash
SHADOW_MODE_ENABLED=true
INITIAL_BUDGET=1000
MIN_TRADE_AMOUNT=10
MAX_TRADE_AMOUNT=100
DAILY_LOSS_LIMIT=50
LOG_LEVEL=debug
ENABLE_PERFORMANCE_TRACKING=true
```

### For Production (Conservative)

```bash
SHADOW_MODE_ENABLED=false
INITIAL_BUDGET=10000
MIN_TRADE_AMOUNT=100
MAX_TRADE_AMOUNT=1500
DAILY_LOSS_LIMIT=500
MAX_POSITION_SIZE=0.10
LOG_LEVEL=info
CONFIDENCE_VERY_LOW_REGIME=55
CONFIDENCE_LOW_REGIME=65
CONFIDENCE_MEDIUM_REGIME=70
CONFIDENCE_HIGH_REGIME=75
```

### For Production (Aggressive)

```bash
SHADOW_MODE_ENABLED=false
INITIAL_BUDGET=50000
MIN_TRADE_AMOUNT=500
MAX_TRADE_AMOUNT=7500
DAILY_LOSS_LIMIT=2500
MAX_POSITION_SIZE=0.15
LOG_LEVEL=info
CONFIDENCE_VERY_LOW_REGIME=45
CONFIDENCE_LOW_REGIME=55
CONFIDENCE_MEDIUM_REGIME=65
CONFIDENCE_HIGH_REGIME=70
```

## Configuration Validation

After editing `.env`, validate your configuration:

```bash
# Check syntax (no output = valid)
node -e "require('dotenv').config(); console.log('✅ Configuration valid')"

# Verify required variables are set
node -e "require('dotenv').config(); if (!process.env.WALLET_ADDRESS || !process.env.PRIVATE_KEY || !process.env.ANTHROPIC_API_KEY) { console.error('❌ Missing required variables'); process.exit(1); } console.log('✅ All required variables set')"
```

## Environment-Specific Configurations

### Development (.env.development)

```bash
cp .env .env.development
# Edit for development settings
```

### Production (.env.production)

```bash
cp .env .env.production
# Edit for production settings
```

Load specific environment:
```bash
NODE_ENV=production npm start
```

## Advanced Configuration

### Custom Strategy Parameters

Edit `strategies/*.js` files to adjust strategy-specific parameters like:
- Support/resistance levels
- Technical indicator periods
- Entry/exit thresholds
- Position sizing algorithms

### Custom Indicator Weights

Edit `agents/TradingStrategyAgent.js` to adjust indicator weights:

```javascript
const INDICATOR_WEIGHTS = {
  orderFlow: 0.20,      // 20%
  volumeProfile: 0.18,  // 18%
  liquidity: 0.18,      // 18%
  vwap: 0.15,           // 15%
  atr: 0.12,            // 12%
  regime: 0.09          // 9%
};
```

## Troubleshooting Configuration

### Configuration not loading
```bash
# Check .env file exists
ls -la .env

# Verify file format (no BOM, LF line endings)
file .env
```

### Values not being used
```bash
# Check for typos in variable names
cat .env | grep -i wallet

# Verify no trailing spaces
cat .env | sed 's/$/⏎/' | less
```

### RPC connection issues
```bash
# Test RPC connection
curl -X POST $BSC_RPC_URL \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Configuration Best Practices

1. **Start Conservative**: Use higher confidence thresholds and lower position sizes initially
2. **Test in Shadow Mode**: Run for 24-48 hours before going live
3. **Gradual Increases**: Increase capital and position sizes gradually
4. **Monitor Closely**: Watch logs and dashboard, especially first few days
5. **Document Changes**: Keep notes on configuration changes and their effects
6. **Backup .env**: Keep a backup of working configurations
7. **Version Control**: Use .env.example for team collaboration (never commit actual .env)

## Support

For configuration help:
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Review [SECURITY.md](SECURITY.md) for security settings
- Open a GitHub Issue

---

**Remember**: Configuration directly impacts profitability and risk. Start conservative, test thoroughly, and adjust based on results.
