# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Advanced BSC trading bot with AI agents, RAG system, and multi-strategy trading on Binance Smart Chain. The bot trades BNB/USDT with multiple strategies (grid trading, momentum, mean reversion, arbitrage) and uses AI-powered decision making.

**Key Technologies**: Node.js, ethers.js, Sequelize (SQLite/PostgreSQL), Python (Streamlit dashboard), OpenAI, Milvus vector DB

## Common Commands

### Development & Testing
```bash
# Start main bot (AdvancedTradingBot.js - production mode)
npm start

# Start shadow mode (safe testing without real trades)
npm run start-shadow
# OR
npm run start-safe

# Start original simple bot (index.js)
npm run start-original

# Development with auto-reload
npm run dev

# Run tests
npm test                    # Run all tests
npm run test:atomic         # Atomic operations tests only
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# Database setup
npm run setup-db
```

### Monitoring & Health Checks
```bash
# Start Streamlit monitoring dashboard (Python)
npm run monitor
# Opens at http://localhost:8501

# Health check
npm run health-check

# Emergency controls
npm run reset-emergency
npm run reset-emergency-force

# Shadow mode report
npm run report
```

### Shell Scripts
```bash
# Setup environment
./setup.sh

# Start bot safely
./start-bot-fixed.sh

# Monitor dashboard variants
./start-dashboard.sh
./monitor-dashboard.sh

# Position monitoring
node scripts/monitor-positions.js

# Diagnostics
./full-diagnostic.sh
./generate-full-report.sh
```

## High-Level Architecture

### Core Bot Structure

**Two Bot Implementations:**
1. **AdvancedTradingBot.js** - Full-featured production bot with AI agents, multi-strategy support, shadow mode
2. **index.js** - Simple ranging strategy bot (original implementation)

### AI Agent System

The bot uses a multi-agent architecture with specialized agents:

**Base Architecture:**
- `agents/BaseAgent.js` - Abstract base class for all agents
  - Performance tracking (success/fail rates, execution time)
  - Database logging via `AgentActivity` model
  - Standardized execute() wrapper with error handling

**Agent Implementations:**
- `agents/TradingStrategyAgent.js` - Main trading decision agent (~190KB, most complex)
  - Position monitoring with TP/SL exit conditions
  - 8-indicator confidence calculation (RSI, EMA, VWAP, ATR, volume, multi-timeframe, regime)
  - Dynamic position sizing based on portfolio balance
  - Handles entry/exit logic with slippage protection
- `agents/MarketResearchAgent.js` - Market intelligence gathering
  - News scraping from CoinDesk, CoinTelegraph, DeFiPulse
  - Sentiment analysis
- `agents/MarketMonitorAgent.js` - System monitoring and alerts

### RAG System

**Context-aware trading intelligence:**
- `rag/RAGSystem.js` - Retrieval Augmented Generation system
- `rag/VectorDatabase.js` - Milvus integration for semantic search
- Stores embeddings of market data, news, trading logs
- Falls back to mock mode if Milvus unavailable

### Trading Strategy System

**Multi-Strategy Portfolio ($60K total allocation):**
- Grid Trading: $18K (BNB 70%, ETH 30%)
- Momentum: $15K
- Mean Reversion: $15K
- Arbitrage: $12K
- Leverage/Market Making/Yield: DISABLED (set to 0)

**Strategy Files:**
- `rangingStrategy.js` - Buy low/sell high within bounds (original strategy)
- `strategies/LeverageStrategy.js` - Leverage positions (disabled)
- `strategies/MarketMakingStrategy.js` - Liquidity provision (disabled)
- `strategies/VenusYieldStrategy.js` - DeFi yield farming (disabled)
- `strategies/mevStrategy.js` - MEV protection/exploitation
- `strategies/crossChainArbitrage.js` - Cross-chain opportunities

### Risk Management Layers

**Critical Safety Systems:**
1. **ProductionRiskManager** (`risk/productionRiskManager.js`)
   - Daily loss limit: $3K (5% of $60K)
   - Max drawdown: $9K (15%)
   - Emergency shutdown on threshold breach
   - Position size limits (35% max)

2. **CircuitBreaker** (`risk/circuitBreaker.js`)
   - Automatic trip on consecutive losses
   - Gradual recovery after cooling period

3. **SmartRebalancer** (`risk/smartRebalancer.js`)
   - Maintains target portfolio balance
   - Hybrid system with gradual scaling (see config.hybrid)

4. **RateLimiter** (`security/rateLimiter.js`)
   - Hourly/daily trade limits
   - API protection

### Shadow Mode (Testing System)

**Safe Production Testing:**
- `testing/shadowMode.js` - Parallel execution without real trades
- Tracks virtual portfolio (starts: $36K USDT, 22 BNB)
- Simulates slippage (0.3% default via SLIPPAGE_BUFFER)
- Records all would-be trades to `.shadow-trades.json`
- Generate reports with `npm run report`

**Usage Pattern:**
```javascript
// Shadow mode automatically intercepts real trades
if (this.shadowMode.isActive) {
  return await this.shadowMode.executeShadowTrade(params);
}
```

### Database Layer

**Models** (`database/models.js`):
- Trade - All executed trades
- MarketData - Price history, technical indicators
- BotLog - System events
- Alert - Critical notifications
- AgentActivity - AI agent execution logs
- StrategyPerformance - Per-strategy metrics

**Connection Pools:**
- `database/safeConnectionPool.js` - Resilient SQLite connection
- `database/resilientConnectionPool.js` - PostgreSQL support
- Auto-migration: `scripts/migrate-to-postgresql.js`

### Security Components

**Key Protection:**
- `security/keyManager.js` - Encrypted private key storage
- `security/transactionVerifier.js` - Pre-execution validation
- `security/mevProtection.js` - MEV attack mitigation
- `security/contractVerifier.js` - Smart contract validation

### Optimization Systems

**Performance Enhancements:**
- `optimization/gasOptimizer.js` - Gas price optimization (1-20 gwei)
- `optimization/cacheManager.js` - LRU caching
- `optimization/atomicPriceManager.js` - Atomic price updates
- `analysis/parallelTechnicalAnalysis.js` - Worker-based TA calculations
- `utils/priceHistoryManager.js` - Efficient price data storage

### External Integrations

**DEX Support:**
- `pancakeSwap.js` - PancakeSwap router integration (primary)
- `dex/multiDexManager.js` - Multi-DEX routing
- `dex/uniswapV2.js`, `dex/sushiSwap.js`, `dex/oneInch.js` - Additional DEXs

**Monitoring:**
- `monitoring/metricsCollector.js` - System metrics
- `monitoring/telegramAlerts.js` - Telegram notifications
- `monitoring/discordWebhook.js` - Discord alerts
- `monitoring/bugbot-integration.js` - Automated bug detection
- `monitoring/app.py` - Streamlit dashboard (Python)

**Event Management:**
- `events/eventManager.js` - Centralized event system
- `events/cleanWebSocketManager.js` - Real-time price feeds

## Configuration System

### Environment Variables (.env)

**Critical Configuration:**
```env
# Network
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
BSC_CHAIN_ID=56

# Wallet (REQUIRED)
WALLET_ADDRESS=0x...
PRIVATE_KEY=...

# Shadow Mode (Testing)
SHADOW_MODE_ENABLED=true
SHADOW_MODE_RECORD=true

# Risk Limits (for $60K portfolio)
DAILY_LOSS_LIMIT=3000
MAX_DRAWDOWN=9000
MAX_POSITION_SIZE=0.35

# AI Features (Optional)
OPENAI_API_KEY=sk-...
MILVUS_HOST=localhost:19530
```

### config.js Structure

**Key Configuration Sections:**
1. `trading.*` - Strategy allocations and parameters
2. `risk.*` - Loss limits, drawdown thresholds, position sizing
3. `hybrid.*` - Dynamic position sizing (BNB percentage-based scaling)
4. `indicators.*` - 8-indicator weighting system
   - Max/min weights per indicator
   - Time-of-day multipliers (peak vs off-hours)
   - VWAP, ATR, volume configuration

**Hybrid Rebalancing System:**
- Gradual position scaling based on BNB percentage
- Blocks: BUY if BNB ≥ 55%, SELL if BNB ≤ 35%
- Scaling: 25%/50%/75% position sizes in middle ranges
- Prevents binary all-or-nothing behavior

## Important Development Patterns

### Position Monitoring Pattern

The TradingStrategyAgent monitors positions on a cron schedule:
```javascript
// 30-second position monitoring
cron.schedule('*/30 * * * * *', () => {
  this.checkExitConditions();
});
```

**Exit Conditions:**
- Take Profit (TP): Default 0.8% gain
- Stop Loss (SL): Default 2% loss
- Max Hold Time: 4 hours (14400000ms)
- Side tracking: position.side must be 'long' or 'short'

### Error Handling Pattern

**EPIPE Protection** (AdvancedTradingBot.js lines 1-60):
```javascript
// Critical: Prevent crashes from broken stdout/stderr pipes
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') return; // Ignore broken pipe
});
```

### Balance Validation Pattern

Always validate balances BEFORE trade execution:
```javascript
// Shadow mode example (shadowMode.js:139-150)
if (action === 'buy' && this.virtualPortfolio.usdt < amount) {
  return { success: false, reason: 'insufficient_usdt' };
}
```

### Database Logging Pattern

All agents log activity via BaseAgent:
```javascript
await this.logActivity({
  agent_name: this.name,
  action: 'execute',
  success: true,
  execution_time_ms: executionTime
});
```

## Known Issues & Watchpoints

**From .cursorrules (Critical Bug Priorities):**
1. Exit condition failures (TP/SL not triggering) - Monitor `agents/TradingStrategyAgent.js`
2. Position monitoring failures - Check cron job execution
3. `position.side` undefined errors - Verify position creation logic
4. Zero exits in long periods - Monitor `executeExit()` calls
5. Price history persistence failures - Check `utils/priceHistoryManager.js`

**Technical Debt:**
- Multiple backup files indicate frequent fixes (`*.backup-*` patterns)
- config.js has deprecated positionSizing section (lines 93-99)
- Extensive documentation files suggest evolving architecture

## Testing Strategy

**Test Files:**
- `tests/critical-fixes.test.js` - Critical path testing
- `tests/atomic-operations.test.js` - Atomic trade operations
- `test-exit-system.js`, `test-improved-exits.js` - Exit logic validation
- `test_virtual_balance_fix.js` - Shadow mode balance tracking

**Shadow Mode Testing:**
1. Enable in .env: `SHADOW_MODE_ENABLED=true`
2. Run: `npm run start-shadow`
3. Monitor: `tail -f .shadow-trades.json`
4. Report: `npm run report`

## API Structure

**REST API** (Express server in AdvancedTradingBot.js):
- Port: 3001 (configurable via API_PORT)
- Base: `/api`

**Key Endpoints:**
- GET `/api/health` - System status
- GET `/api/status` - Bot performance
- POST `/api/control/start|stop|emergency-stop` - Bot controls
- GET `/api/trades` - Trade history
- GET `/api/agents/activity` - Agent logs
- POST `/api/rag/query` - Natural language queries

## Cursor Integration

This codebase has `.cursorrules` with BugBot configuration. Key monitoring priorities:
1. Trading logic bugs (exit conditions, position monitoring)
2. Runtime errors (async/await, null references)
3. Performance issues (memory leaks, rate limiters)
4. Security vulnerabilities (private key exposure, unsigned transactions)

## When Fixing Bugs

**Priority Files to Check:**
1. `agents/TradingStrategyAgent.js` - Position exit logic
2. `AdvancedTradingBot.js` - Main bot orchestration
3. `rangingStrategy.js` - Entry/exit triggers
4. `utils/priceHistoryManager.js` - Price data integrity
5. `risk/productionRiskManager.js` - Risk threshold enforcement

**Debugging Commands:**
```bash
# Real-time logs
tail -f logs/combined.log
tail -f logs/error.log
tail -f logs/agent_activity.log

# Position monitoring
node scripts/monitor-positions.js

# Health check
npm run health-check

# Full diagnostic
./full-diagnostic.sh > diagnostic.txt
```
