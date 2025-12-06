# AlgoQBot Dashboard Diagnostic Report
**Generated:** 2025-12-06 13:40 UTC

## Executive Summary

The AlgoQBot Intelligence Dashboard (port 9000) is running but displays **static/stale data** because the **AlgoQBot trading bot is NOT running**. The dashboard reads from JSON data files that were last updated at 12:57:31 UTC on 2025-12-06.

---

## Issue: Dashboard Not Linked to Live AlgoQBot

### Root Cause
The AlgoQBot trading bot process is **NOT running**. The dashboard server (`chat-server.js` on port 9000) reads from static JSON files instead of receiving live data from the trading bot.

### Current State
| Component | Status | Port |
|-----------|--------|------|
| Dashboard Server (chat-server.js) | ✅ Running | 9000 |
| AlgoQBot Trading Bot | ❌ NOT Running | 3001 |

---

## File Locations

### Dashboard Files
```
/home/user/algoQbot/web/
├── chat-server.js          # Dashboard backend (31KB)
├── public/
│   └── index.html          # Dashboard frontend (8 tabs)
├── node_modules/
└── package.json
```

### Data Files (READ BY DASHBOARD)
```
/home/user/algoQbot/data/
├── virtual_balances.json   # Portfolio: $36K USDT, 22 BNB
├── bot_state.json          # Strategy: ranging, Volatility: VERY_LOW
├── shadow_trades.json      # 95 trades (last: Nov 18, 2025)
└── bot.log                 # Logs from 12:57:31 UTC
```

### Trading Bot Entry Points
```
/home/user/algoQbot/
├── AdvancedTradingBot.js   # Main entry (npm start)
├── start-shadow-mode.js    # Shadow mode
├── start-with-web-interface.js
└── index.js                # Original entry
```

---

## API Endpoints (All Working)

| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|
| `/api/status` | GET | ✅ Working | Portfolio $55,492, Strategy: ranging |
| `/api/trades` | GET | ✅ Working | 95 trades loaded |
| `/api/portfolio` | GET | ✅ Working | USDT: $36K, BNB: 22 |
| `/api/logs` | GET | ✅ Working | Bot logs from file |
| `/api/intelligence/report` | GET | ✅ Working | Report generation |
| `/api/agent-research/:action` | POST | ✅ Working | 4 actions available |
| `/api/search` | GET | ✅ Working | Cross-source search |

---

## Data Freshness

**Last Update:** 2025-12-06 12:57:31 UTC (STALE)

```json
// virtual_balances.json
{
  "usdt": 36000,
  "bnb": 22,
  "currentPrice": 886,
  "lastUpdated": "2025-12-06T12:57:31.000Z"
}

// bot_state.json
{
  "running": true,
  "mode": "shadow",
  "strategy": "ranging",
  "volatility": {"regime": "VERY_LOW", "vol4h": 0.11},
  "confidence": 62.1,
  "lastAction": "HOLD"
}
```

**Trade Data:** Last trade was on **November 18, 2025** - data is very old!

---

## Dashboard Features (8 Tabs)

1. **📊 LIVE MONITOR** - Shows bot status, portfolio, logs
2. **💬 CHAT** - Chat with AlgoQBot (Socket.IO)
3. **📈 INTELLIGENCE** - Generate reports (market/risk/performance)
4. **🤖 AGENT RESEARCH** - 4 action buttons, reasoning display
5. **🏛️ AI COUNCIL** - Token usage, consensus (needs AI keys)
6. **💰 PORTFOLIO** - Trade history with filtering
7. **📝 NOTES** - Bot activity snapshots
8. **🔍 SEARCH** - Search trades, logs, notes

---

## To Fix: Start the Trading Bot

### Option 1: Start in Shadow Mode (Safe)
```bash
cd /home/user/algoQbot
npm run start-shadow
```

### Option 2: Start with Web Interface
```bash
cd /home/user/algoQbot
npm run start-web
```

### Option 3: Start Main Bot
```bash
cd /home/user/algoQbot
npm start
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│              http://localhost:9000                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              DASHBOARD SERVER (chat-server.js)               │
│                     Port 9000                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Express.js + Socket.IO                              │    │
│  │  - Serves index.html                                 │    │
│  │  - REST API endpoints (/api/*)                       │    │
│  │  - WebSocket for real-time updates                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ READS FROM FILES (NOT LIVE!)
┌─────────────────────────────────────────────────────────────┐
│                    DATA FILES                                │
│  /home/user/algoQbot/data/                                  │
│  ├── virtual_balances.json  ← Last updated 12:57 UTC        │
│  ├── bot_state.json         ← Last updated 12:57 UTC        │
│  ├── shadow_trades.json     ← Last trade: Nov 18, 2025      │
│  └── bot.log                ← Logs from 12:57 UTC           │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼ SHOULD BE UPDATING THESE FILES!
┌─────────────────────────────────────────────────────────────┐
│              ALGOQBOT TRADING BOT ❌ NOT RUNNING            │
│                     Port 3001                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AdvancedTradingBot.js                               │    │
│  │  - Connects to Binance API                           │    │
│  │  - Runs trading strategies                           │    │
│  │  - Updates data files                                │    │
│  │  - Writes to bot.log                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Known Issues

1. **Trading Bot Not Running** - Main issue, dashboard reads stale files
2. **Trade Data Stale** - Last trade from November 18, 2025
3. **AI Council** - Needs ANTHROPIC_API_KEY, DEEPSEEK_API_KEY for real AI responses
4. **Socket.IO Real-time** - Works but no live data source to stream

---

## Environment

- **Platform:** Linux 4.4.0
- **Node.js:** Available
- **Working Directory:** /home/user/algoQbot
- **Dashboard URL:** http://localhost:9000

---

## Recommended Actions for Cursor

1. **Start the AlgoQBot trading bot** to generate live data
2. **Verify bot writes to data files** (virtual_balances.json, shadow_trades.json)
3. **Check if bot exposes API on port 3001** for direct integration
4. **Consider connecting dashboard directly to Binance API** for live prices
5. **Set up AI API keys** for AI Council functionality

---

## Test Commands

```bash
# Test dashboard APIs
curl http://localhost:9000/api/status
curl http://localhost:9000/api/trades
curl http://localhost:9000/api/portfolio

# Start trading bot
cd /home/user/algoQbot && npm run start-shadow

# View bot logs
tail -f /home/user/algoQbot/logs/bot.log
```
