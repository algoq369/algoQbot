# algoQbot - Complete Code Index

This document provides a comprehensive index of all code files in the algoQbot project.

## Project Statistics
- **Total Lines of Code**: ~900,000+ lines
- **Main Core Files**: ~23,000 lines
- **Language**: JavaScript (Node.js)
- **Framework**: Custom trading bot framework

## File Structure

### Core Entry Points
- `AdvancedTradingBot.js` - Main bot orchestrator (~3,000+ lines)
- `start-shadow-mode.js` - Shadow mode entry point (159 lines)
- `index.js` - Legacy entry point
- `start-with-web-interface.js` - Web interface entry point
- `start-bot-auto.js` - Auto-start script

### Configuration
- `config.js` - Main configuration file (245 lines)
- `logger.js` - Winston logger setup (304 lines)
- `.env` - Environment variables (not tracked)

### Agents (AI Trading Agents)
- `agents/TradingStrategyAgent.js` - Main trading strategy agent (~4,800+ lines)
- `agents/MarketResearchAgent.js` - Market research agent
- `agents/MarketMonitorAgent.js` - Market monitoring agent
- `agents/BaseAgent.js` - Base agent class
- `agent/AlgoQBotAgent.js` - AlgoQBot autonomous agent

### Strategies (Trading Strategies)
- `strategies/gridTrading.js` - Grid trading strategy
- `strategies/momentumStrategy.js` - Momentum trading
- `strategies/meanReversionStrategy.js` - Mean reversion
- `strategies/breakoutStrategy.js` - Breakout trading
- `strategies/vwapStrategy.js` - VWAP-based trading
- `strategies/arbitrageStrategy.js` - Cross-DEX arbitrage
- `strategies/LeverageStrategy.js` - Leveraged trading
- `strategies/MarketMakingStrategy.js` - Market making
- `strategies/VenusYieldStrategy.js` - Yield farming
- `strategies/mevStrategy.js` - MEV protection strategy
- `strategies/fixedMEVStrategy.js` - Fixed MEV strategy
- `strategies/crossChainArbitrage.js` - Cross-chain arbitrage
- `rangingStrategy.js` - Range-bound trading

### Utils (Utility Functions)
- `utils/pnlCalculator.js` - P&L calculation (225 lines)
- `utils/priceCache.js` - Price caching system
- `utils/priceHistoryManager.js` - Price history management
- `utils/performanceTracker.js` - Performance tracking
- `utils/performanceMonitor.js` - Performance monitoring
- `utils/healthCheck.js` - Health check system
- `utils/monitoringUpdater.js` - Monitoring updates
- `utils/configValidator.js` - Configuration validation
- `utils/tradeValidator.js` - Trade validation
- `utils/virtualBalanceManager.js` - Virtual balance management
- `utils/cacheManager.js` - Cache management
- `utils/regimeDashboard.js` - Regime dashboard display
- `utils/writeQueue.js` - Write queue management
- `utils/resetEmergency.js` - Emergency reset
- `utils/orderFlow.js` - Order flow analysis
- `utils/volumeProfile.js` - Volume profile analysis
- `utils/liquidity.js` - Liquidity analysis
- `utils/VolatilityTracker.js` - Volatility tracking
- `utils/errorClassifier.js` - Error classification

### DEX (Decentralized Exchange Integration)
- `dex/pancakeSwapService.js` - PancakeSwap integration
- `dex/uniswapService.js` - Uniswap integration
- `dex/multiDexManager.js` - Multi-DEX manager
- `dex/aggregatorService.js` - DEX aggregator

### Risk Management
- `risk/productionRiskManager.js` - Production risk manager
- `risk/circuitBreaker.js` - Circuit breaker system
- `risk/smartRebalancer.js` - Smart portfolio rebalancer

### Security
- `security/rateLimiter.js` - Rate limiting
- `security/keyManager.js` - Key management
- `security/encryptedKeyManager.js` - Encrypted key management
- `security/transactionVerifier.js` - Transaction verification
- `security/transactionMonitor.js` - Transaction monitoring
- `security/contractVerifier.js` - Contract verification
- `security/asyncContractVerifier.js` - Async contract verification
- `security/secureTransactionSigner.js` - Secure transaction signing
- `security/mevProtection.js` - MEV protection

### Database
- `database/models.js` - Sequelize models
- `database/safeDatabaseManager.js` - Safe database manager
- `database/optimizedDatabaseManager.js` - Optimized database manager
- `database/safeConnectionPool.js` - Safe connection pool
- `database/resilientConnectionPool.js` - Resilient connection pool
- `database/properlyFixedConnectionPool.js` - Fixed connection pool

### Analysis
- `analysis/technicalAnalysis.js` - Technical analysis
- `analysis/parallelTechnicalAnalysis.js` - Parallel technical analysis
- `analysis/taWorker.js` - Technical analysis worker

### Optimization
- `optimization/cacheManager.js` - Cache optimization
- `optimization/gasOptimizer.js` - Gas optimization
- `optimization/cpuOptimizer.js` - CPU optimization
- `optimization/wasmOptimizer.js` - WASM optimization
- `optimization/resilientWasmOptimizer.js` - Resilient WASM optimizer
- `optimization/priceHistoryManager.js` - Price history optimization
- `optimization/atomicPriceManager.js` - Atomic price management
- `optimization/fixedAtomicPriceManager.js` - Fixed atomic price manager
- `optimization/properlyFixedAtomicPriceManager.js` - Properly fixed atomic price manager
- `optimization/zeroCopyPriceManager.js` - Zero-copy price manager
- `optimization/lockFreeDataStructures.js` - Lock-free data structures
- `optimization/lockFreeOrderBook.js` - Lock-free order book
- `optimization/fixedLockFreeOrderBook.js` - Fixed lock-free order book
- `optimization/properlyFixedLockFreeOrderBook.js` - Properly fixed lock-free order book
- `optimization/correctLockFreeOrderBook.js` - Correct lock-free order book
- `optimization/multiLevelCache.js` - Multi-level cache
- `optimization/binaryProtocol.js` - Binary protocol

### Blockchain
- `blockchain/approvalManager.js` - Token approval management
- `blockchain/efficientTransactionScanner.js` - Transaction scanning
- `blockchain/nonceManager.js` - Nonce management
- `blockchain/productionNonceManager.js` - Production nonce manager
- `blockchain/positionReconciliation.js` - Position reconciliation

### Providers
- `providers/multiRPCProvider.js` - Multi-RPC provider
- `providers/rateLimitedProvider.js` - Rate-limited provider

### Managers
- `managers/PortfolioManager.js` - Portfolio management
- `walletManager.js` - Wallet management

### Trading
- `trading/multiPairManager.js` - Multi-pair trading manager

### Leverage
- `leverage/avantisIntegration.js` - Avantis protocol integration

### RAG (Retrieval Augmented Generation)
- `rag/RAGSystem.js` - RAG system
- `rag/VectorDatabase.js` - Vector database

### Bridges
- `bridges/bridgeHealthMonitor.js` - Bridge health monitoring

### Chat
- `chat/AlgoQBotChat.js` - Chat interface
- `chat/ConversationMemory.js` - Conversation memory
- `chat/BotPersonality.js` - Bot personality

### Monitoring
- `monitoring/metricsCollector.js` - Metrics collection
- `monitoring/telegramAlerts.js` - Telegram alerts
- `monitoring/discordWebhook.js` - Discord webhooks
- `monitoring/bugbot-integration.js` - BugBot integration

### Events
- `events/eventManager.js` - Event management
- `events/optimizedEventManager.js` - Optimized event manager

### Testing
- `testing/shadowMode.js` - Shadow mode testing
- `tests/*.test.js` - Test files

### Scripts
- `scripts/chat-with-algoqbot.js` - Chat interface script
- `scripts/shadow-report.js` - Shadow mode reporting
- `scripts/cleanup-shadow-trades.js` - Shadow trades cleanup
- `scripts/audit-tonight.js` - Nightly audit
- `scripts/setup-database.js` - Database setup

### Configuration Files
- `config/volatilityRegimes.js` - Volatility regime configuration

## How to Access All Code

To view all code files, you can:

1. **Browse the repository directly** - All files are in `/Users/sheirraza/algoQbot/`

2. **Use grep to search**:
   ```bash
   cd /Users/sheirraza/algoQbot
   grep -r "pattern" --include="*.js"
   ```

3. **Generate a code dump**:
   ```bash
   cd /Users/sheirraza/algoQbot
   find . -name "*.js" ! -path "./node_modules/*" -exec cat {} \; > all_code.txt
   ```

4. **View specific files**:
   ```bash
   cat /Users/sheirraza/algoQbot/AdvancedTradingBot.js
   cat /Users/sheirraza/algoQbot/agents/TradingStrategyAgent.js
   ```

## Key Code Sections

### Main Bot Logic
- **File**: `AdvancedTradingBot.js`
- **Purpose**: Main orchestrator that coordinates all components
- **Key Methods**: `start()`, `stop()`, `executeTrade()`, `analyzeMarket()`

### Trading Strategy Agent
- **File**: `agents/TradingStrategyAgent.js`
- **Purpose**: Core trading logic with 8-indicator confidence system
- **Key Methods**: `analyzeMarket()`, `makeTradingDecision()`, `calculate8IndicatorConfidence()`

### P&L Calculator
- **File**: `utils/pnlCalculator.js`
- **Purpose**: Calculate profit/loss for trades
- **Key Methods**: `calculatePLPercent()`, `matchEntryExitPairs()`

### Shadow Mode
- **File**: `testing/shadowMode.js`
- **Purpose**: Safe testing without real trades
- **Key Methods**: `start()`, `recordTrade()`, `getVirtualBalances()`

## Notes

- The codebase is actively maintained and under continuous development
- Shadow mode is recommended for testing before live trading
- All sensitive keys should be stored in `.env` file (not tracked in git)
- Database models use Sequelize ORM
- Logging uses Winston with daily rotation

## Quick Access Commands

```bash
# View main bot file
cat /Users/sheirraza/algoQbot/AdvancedTradingBot.js | less

# View trading agent
cat /Users/sheirraza/algoQbot/agents/TradingStrategyAgent.js | less

# Search for specific function
grep -r "functionName" /Users/sheirraza/algoQbot --include="*.js"

# Count lines in specific file
wc -l /Users/sheirraza/algoQbot/AdvancedTradingBot.js

# List all JS files
find /Users/sheirraza/algoQbot -name "*.js" ! -path "./node_modules/*"
```
