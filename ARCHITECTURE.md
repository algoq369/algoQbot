# AlgoQBot Architecture Documentation

**Last Updated:** December 3, 2025  
**Version:** 2.0

---

## Overview

AlgoQBot is an advanced automated trading bot for Binance Smart Chain (BSC) that implements multiple trading strategies with AI-powered decision making, comprehensive risk management, and shadow mode testing.

---

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AdvancedTradingBot                      │
│                  (Main Orchestrator)                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Trading      │   │ Risk         │   │ Portfolio    │
│ Strategy     │   │ Management   │   │ Management   │
│ Agent        │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Multi-DEX    │   │ Circuit      │   │ Shadow Mode │
│ Manager      │   │ Breaker      │   │ (Testing)    │
└──────────────┘   └──────────────┘   └──────────────┘
```

---

## Key Modules

### 1. AdvancedTradingBot.js
**Purpose:** Main bot orchestrator  
**Key Responsibilities:**
- Coordinates all trading activities
- Manages bot lifecycle (start/stop)
- Executes trading decisions
- Handles emergency stops
- Provides API endpoints

**Key Methods:**
- `getCurrentPrice()` - Get current BNB price with fallbacks
- `getBalance()` - Get portfolio balances
- `executeTradingDecision()` - Execute buy/sell/hold decisions
- `runAdvancedStrategy()` - Main trading loop
- `checkEmergencyStop()` - Emergency safety checks

---

### 2. TradingStrategyAgent.js
**Purpose:** AI-powered trading strategy decisions  
**Location:** `agents/TradingStrategyAgent.js`

**Key Features:**
- 8-indicator analysis system
- Regime detection (VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH)
- Dynamic confidence thresholds
- Multiple strategy support (grid, ranging, momentum)

---

### 3. Risk Management

#### ProductionRiskManager.js
**Purpose:** Comprehensive risk management  
**Location:** `risk/productionRiskManager.js`

**Features:**
- Drawdown tracking (5% max)
- Daily loss limits ($600)
- Position size limits
- Trade rate limiting
- Emergency stop triggers

**Key Methods:**
- `updatePortfolioValue()` - Track portfolio and drawdown
- `checkTradeAllowed()` - Validate trades before execution
- `validateTrade()` - Pre-execution validation
- `triggerEmergencyStop()` - Halt trading on critical issues

#### CircuitBreaker.js
**Purpose:** Loss protection circuit breaker  
**Location:** `risk/circuitBreaker.js`

**Features:**
- 5 consecutive losses threshold (increased from 3)
- $10 minimum loss amount (small losses don't count)
- 30-minute cooldown after trip
- Hourly/daily loss limits

**Key Methods:**
- `recordTrade()` - Record trade profit/loss
- `checkCircuit()` - Check if circuit should trip
- `canTrade()` - Check if trading is allowed
- `reset()` - Reset circuit breaker

#### SmartRebalancer.js
**Purpose:** Portfolio rebalancing  
**Location:** `risk/smartRebalancer.js`

**Features:**
- Maintains 50/50 USDT/BNB target
- Triggers at 70/30 imbalance
- 6-hour cooldown between rebalances
- $1K minimum rebalance amount

**Key Methods:**
- `shouldRebalance()` - Check if rebalance needed
- `rebalance()` - Execute rebalancing
- `getCurrentPrice()` - Get price with fallbacks
- `getPortfolioStats()` - Get current portfolio stats

---

### 4. Data Management

#### PriceHistoryManager.js
**Purpose:** Price history storage and retrieval  
**Location:** `utils/priceHistoryManager.js`

**Features:**
- Atomic file writes (prevents corruption)
- Retry logic (3 attempts with exponential backoff)
- Rolling window (1000 points max)
- Automatic directory creation

**Key Methods:**
- `addPrice()` - Add new price point
- `saveHistory()` - Save to file (with retry)
- `getHistory()` - Get price history array
- `getLatestPrice()` - Get most recent price

#### MonitoringUpdater.js
**Purpose:** Real-time monitoring data updates  
**Location:** `utils/monitoringUpdater.js`

**Features:**
- Updates monitoring-summary.json every minute
- Gathers bot state, positions, risk metrics
- Provides health check data
- Atomic file writes

**Key Methods:**
- `start()` - Start automatic updates
- `stop()` - Stop updates
- `update()` - Force immediate update
- `gatherMonitoringData()` - Collect current state

---

### 5. Shadow Mode

**Purpose:** Risk-free testing environment  
**Location:** `testing/shadowMode.js`

**Features:**
- Simulates trades without executing
- Tracks virtual balances
- Records all decisions
- Full trade history

**Benefits:**
- Test strategies safely
- Validate logic before live trading
- Track P&L without risk
- Debug issues without financial impact

---

## Data Flow

### Trading Decision Flow

```
1. Market Data Collection
   └─> PriceHistoryManager
   └─> TradingStrategyAgent

2. Strategy Analysis
   └─> 8-Indicator System
   └─> Regime Detection
   └─> Confidence Calculation

3. Risk Validation
   └─> ProductionRiskManager
   └─> CircuitBreaker
   └─> Portfolio Checks

4. Emergency Checks
   └─> Rebalance Check (BNB > 99%?)
   └─> Drawdown Check
   └─> Emergency Stop Check

5. Execution
   └─> Shadow Mode (if enabled)
   └─> Live Trading (if enabled)
   └─> Trade Recording
```

---

## Configuration

### Key Configuration Files

**config.js** - Main configuration
- Trading parameters
- Strategy allocations
- Risk limits
- Network settings

**.env** - Environment variables
- Private keys (encrypted)
- API endpoints
- Feature flags

---

## Error Handling

### Error Categories

1. **Critical Errors** - Stop trading immediately
   - Drawdown exceeded
   - Emergency stop triggered
   - Circuit breaker tripped

2. **High Priority Errors** - Log and continue
   - Price fetch failures (uses fallback)
   - File operation errors (retries)
   - API rate limits

3. **Warning Errors** - Log only
   - Minor validation failures
   - Non-critical operation errors

### Error Recovery

- **Price Fetching:** Multiple fallback mechanisms
- **File Operations:** Retry with exponential backoff
- **API Calls:** Rate limiting and backoff strategies
- **Trade Execution:** Validation before execution

---

## Monitoring

### Real-time Monitoring

**monitoring-summary.json** - Updated every minute
- Bot status (running/stopped)
- Market status (price, regime, volatility)
- Portfolio (balances, value, allocation)
- Positions (active positions, P&L)
- Risk metrics (drawdown, circuit breaker status)

### Logging

**Structured Logging:**
- `logger.trade()` - Trade events
- `logger.position()` - Position events
- `logger.performance()` - Performance metrics
- `logger.risk()` - Risk events
- `logger.errorWithContext()` - Errors with context
- `logger.metric()` - Performance metrics
- `logger.health()` - Health checks

**Log Files:**
- `logs/combined-YYYY-MM-DD.log` - All logs
- `logs/error-YYYY-MM-DD.log` - Errors only
- `logs/trades-YYYY-MM-DD.log` - Trade events

---

## Performance Optimizations

### Implemented

1. **Price Caching** - 30-second cache for price data
2. **Portfolio Caching** - 5-second cache for portfolio value
3. **Incremental Price Fetching** - Only fetch latest candle
4. **Parallel Strategy Execution** - Run strategies concurrently
5. **Database Indexing** - Optimized queries

### Future Optimizations

- Connection pooling for database
- Query result caching
- Memory leak detection
- API request queuing

---

## Security

### Implemented

1. **Encrypted Wallet Storage** - Private keys encrypted
2. **Transaction Verification** - Pre-send validation
3. **Rate Limiting** - API call protection
4. **Input Validation** - All inputs validated
5. **Error Sanitization** - No sensitive data in logs

---

## Testing

### Shadow Mode

- Full strategy testing without risk
- Virtual balance tracking
- Complete trade history
- P&L calculation

### Test Coverage

- Unit tests for critical functions (planned)
- Integration tests for rebalancing (planned)
- Error scenario tests (planned)

---

## Deployment

### Requirements

- Node.js 18+
- BSC RPC endpoint
- Encrypted wallet file
- Environment variables configured

### Startup

```bash
node AdvancedTradingBot.js
# or
npm start
```

### Monitoring

- Check `data/monitoring-summary.json` for current status
- Review `logs/error-*.log` for errors
- Monitor `logs/trades-*.log` for trade activity

---

## Troubleshooting

### Common Issues

1. **Price History Errors**
   - Fixed: Retry logic with exponential backoff
   - Check: `data/` directory permissions

2. **getCurrentPrice Errors**
   - Fixed: Multiple fallback mechanisms
   - Check: RPC endpoint connectivity

3. **Emergency Rebalance**
   - Fixed: Critical threshold (99%) triggers immediate action
   - Check: Portfolio allocation in monitoring-summary.json

4. **Drawdown False Positives**
   - Fixed: Tolerance buffer and improved peak tracking
   - Check: Risk manager state

5. **Circuit Breaker**
   - Fixed: Increased threshold and minimum loss amount
   - Check: Circuit breaker status in logs

---

## API Endpoints

### Health Check
`GET /api/health` - Bot health status

### Status
`GET /api/status` - Current bot status and balances

### Metrics
`GET /api/metrics` - Performance metrics

---

## Future Enhancements

1. **Enhanced Logging**
   - Structured JSON logging
   - Log aggregation
   - Performance dashboards

2. **Monitoring**
   - Real-time dashboards
   - Alerting system
   - Performance tracking

3. **Testing**
   - Unit test suite
   - Integration tests
   - Backtesting framework

4. **Performance**
   - Database optimization
   - Memory management
   - API optimization

---

**Documentation Version:** 1.0  
**Last Updated:** December 3, 2025

