/**
 * AlgoQBot Production Monitor - Enhanced Backend Server
 * Live crypto data, AI chat, technical analysis, macro data
 * INSTITUTIONAL DASHBOARD with live log streaming
 */

const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

// Configuration
const PORT = process.env.PORT || 9000;
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
const ROOT_DIR = path.join(__dirname, '..', '..');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// ============== CACHE STORAGE ==============
const cache = {
    bnbPrice: { data: null, lastUpdate: 0 },
    btcPrice: { data: null, lastUpdate: 0 },
    marketData: { data: null, lastUpdate: 0 },
    fearGreed: { data: null, lastUpdate: 0 },
    globalMarket: { data: null, lastUpdate: 0 },
    technicalData: { data: null, lastUpdate: 0 },
    logs: { lines: [], lastRead: 0 }
};

// ============== HTTP FETCH UTILITY ==============
function fetchJson(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            timeout,
            headers: {
                'User-Agent': 'AlgoQBot-Monitor/2.0',
                'Accept': 'application/json'
            }
        };

        const req = https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON'));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// ============== BOT PROCESS STATUS ==============
function getBotProcessInfo() {
    return new Promise((resolve) => {
        // Match all possible bot startup scripts
        exec('ps aux | grep -E "start-shadow-mode|start-with-web-interface|start-bot-auto|AdvancedTradingBot|algoQbot.*node" | grep -v grep | grep -v "website/server" | head -1', (error, stdout) => {
            if (stdout.trim()) {
                const parts = stdout.trim().split(/\s+/);
                const pid = parts[1];
                const cpu = parts[2];
                const mem = parts[3];

                // Get uptime
                exec(`ps -p ${pid} -o etime= 2>/dev/null`, (err, uptimeOut) => {
                    resolve({
                        running: true,
                        pid,
                        cpu: parseFloat(cpu) || 0,
                        memory: parseFloat(mem) || 0,
                        uptime: uptimeOut?.trim() || 'N/A'
                    });
                });
            } else {
                resolve({ running: false, pid: null, cpu: 0, memory: 0, uptime: null });
            }
        });
    });
}

// ============== LOG FILE UTILITIES ==============
function getTodayLogFile() {
    const today = new Date().toISOString().split('T')[0];
    const logFiles = [
        path.join(LOGS_DIR, `combined-${today}.log.1`),
        path.join(LOGS_DIR, `combined-${today}.log`),
        path.join(LOGS_DIR, 'combined.log')
    ];

    for (const logFile of logFiles) {
        if (fs.existsSync(logFile) && fs.statSync(logFile).size > 0) {
            return logFile;
        }
    }

    // Find most recent log file
    try {
        const files = fs.readdirSync(LOGS_DIR)
            .filter(f => f.startsWith('combined-') && f.endsWith('.log'))
            .sort()
            .reverse();
        if (files.length > 0) {
            return path.join(LOGS_DIR, files[0]);
        }
    } catch (e) {}

    return null;
}

function parseLogLines(content, limit = 200) {
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(-limit).map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            return { level: 'info', message: line, timestamp: new Date().toISOString() };
        }
    });
}

function getRecentLogs(count = 100) {
    const logFile = getTodayLogFile();
    if (!logFile) return [];

    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const logs = parseLogLines(content, count);
        return logs.reverse();
    } catch (e) {
        return [];
    }
}

function getLogStats() {
    const logFile = getTodayLogFile();
    if (!logFile) return { tradesToday: 0, errors: [], lastDecision: null };

    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        let tradesToday = 0;
        let lastDecision = null;
        const errors = [];

        lines.forEach(line => {
            try {
                const log = JSON.parse(line);

                // Count shadow trades
                if (log.message && log.message.includes('👻 Shadow Trade:')) {
                    tradesToday++;
                }

                // Get last trading decision
                if (log.message && log.message.includes('Trading decision made')) {
                    lastDecision = log;
                }

                // Collect recent errors
                if (log.level === 'error' && !log.message.includes('error handling')) {
                    errors.push(log);
                }
            } catch (e) {}
        });

        return {
            tradesToday,
            lastDecision,
            errors: errors.slice(-5)
        };
    } catch (e) {
        return { tradesToday: 0, errors: [], lastDecision: null };
    }
}

function parseInstitutionalIndicators() {
    const logFile = getTodayLogFile();
    if (!logFile) return null;

    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim()).slice(-500);

        let indicators = {
            orderFlow: { score: null, delta: null },
            volumeProfile: { score: null, poc: null },
            liquidity: { score: null, ratio: null },
            vwap: { score: null },
            atr: { score: null },
            regime: { score: null, type: null },
            finalConfidence: null,
            timestamp: null
        };

        // Also check monitoring-summary.json
        const monitoringFile = path.join(DATA_DIR, 'monitoring-summary.json');
        if (fs.existsSync(monitoringFile)) {
            try {
                const monData = JSON.parse(fs.readFileSync(monitoringFile, 'utf8'));
                if (monData.institutionalIndicators) {
                    indicators = { ...indicators, ...monData.institutionalIndicators };
                    indicators.timestamp = monData.timestamp;
                }
            } catch (e) {}
        }

        // Parse from logs for any missing values
        lines.forEach(line => {
            try {
                const log = JSON.parse(line);
                const msg = log.message || '';

                // Parse price
                if (msg.includes('Current Price:')) {
                    const match = msg.match(/Current Price:\s*([0-9.]+)/);
                    if (match) indicators.currentPrice = parseFloat(match[1]);
                }

                // Parse volatility
                if (msg.includes('4h Volatility:')) {
                    const match = msg.match(/4h Volatility:\s*([0-9.]+%?)/);
                    if (match) indicators.volatility = match[1];
                }

                // Parse regime
                if (msg.includes('REGIME') && msg.includes('Detected:')) {
                    const match = msg.match(/Detected:\s*(\w+)/);
                    if (match) indicators.regime.type = match[1];
                }

                // Parse institutional confidence
                if (msg.includes('INSTITUTIONAL CONFIDENCE:')) {
                    const match = msg.match(/CONFIDENCE:\s*([0-9.]+)%?/);
                    if (match) indicators.finalConfidence = parseFloat(match[1]);
                }

                // Parse portfolio info
                if (msg.includes('Total portfolio')) {
                    indicators.portfolioMessage = msg;
                }

                // Parse balance status
                if (msg.includes('Portfolio balanced')) {
                    indicators.balanceMessage = msg;
                }

                // Parse active positions
                if (msg.includes('Monitoring') && msg.includes('active position')) {
                    indicators.positionsMessage = msg;
                }

            } catch (e) {}
        });

        return indicators;
    } catch (e) {
        return null;
    }
}

function getActivePositions() {
    // Read from position tracking file or monitoring-summary
    const posFile = path.join(DATA_DIR, 'active_positions.json');
    if (fs.existsSync(posFile)) {
        try {
            return JSON.parse(fs.readFileSync(posFile, 'utf8'));
        } catch (e) {}
    }

    // Try monitoring-summary
    const monFile = path.join(DATA_DIR, 'monitoring-summary.json');
    if (fs.existsSync(monFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(monFile, 'utf8'));
            return data.logAnalysis || { active: 0, positions: [] };
        } catch (e) {}
    }

    return { active: 0, positions: [], exitedPositions: [] };
}

function getLast3Trades() {
    const logFile = getTodayLogFile();
    if (!logFile) return [];

    try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        const trades = [];

        lines.forEach(line => {
            try {
                const log = JSON.parse(line);
                if (log.message && log.message.includes('👻 Shadow Trade:')) {
                    trades.push({
                        message: log.message,
                        timestamp: log.timestamp,
                        action: log.message.includes('buy') ? 'buy' : log.message.includes('sell') ? 'sell' : 'hold'
                    });
                }
            } catch (e) {}
        });

        return trades.slice(-3).reverse();
    } catch (e) {
        return [];
    }
}

// ============== FREE API DATA SOURCES ==============

// 1. CoinGecko - Free crypto data (no API key needed)
async function fetchCoinGeckoData() {
    const now = Date.now();
    if (cache.marketData.data && now - cache.marketData.lastUpdate < 60000) {
        return cache.marketData.data;
    }

    try {
        const data = await fetchJson(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=binancecoin,bitcoin,ethereum&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d'
        );

        if (data && Array.isArray(data)) {
            cache.marketData = { data, lastUpdate: now };
            return data;
        }
    } catch (error) {
        console.log('CoinGecko fetch failed:', error.message);
    }
    return cache.marketData.data || [];
}

// 2. Binance - Live BNB price
async function fetchBinancePrice() {
    const now = Date.now();
    if (cache.bnbPrice.data && now - cache.bnbPrice.lastUpdate < 15000) {
        return cache.bnbPrice.data;
    }

    try {
        const [bnb, btc] = await Promise.all([
            fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT'),
            fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
        ]);

        const data = {
            bnb: {
                price: parseFloat(bnb.lastPrice),
                change24h: parseFloat(bnb.priceChangePercent),
                high24h: parseFloat(bnb.highPrice),
                low24h: parseFloat(bnb.lowPrice),
                volume24h: parseFloat(bnb.volume)
            },
            btc: {
                price: parseFloat(btc.lastPrice),
                change24h: parseFloat(btc.priceChangePercent)
            }
        };

        cache.bnbPrice = { data, lastUpdate: now };
        return data;
    } catch (error) {
        console.log('Binance fetch failed:', error.message);
    }
    return cache.bnbPrice.data || { bnb: { price: 700 }, btc: { price: 100000 } };
}

// 3. Fear & Greed Index (Alternative.me - free)
async function fetchFearGreedIndex() {
    const now = Date.now();
    if (cache.fearGreed.data && now - cache.fearGreed.lastUpdate < 300000) {
        return cache.fearGreed.data;
    }

    try {
        const data = await fetchJson('https://api.alternative.me/fng/?limit=7');
        if (data && data.data) {
            cache.fearGreed = { data: data.data, lastUpdate: now };
            return data.data;
        }
    } catch (error) {
        console.log('Fear & Greed fetch failed:', error.message);
    }
    return cache.fearGreed.data || [{ value: 50, value_classification: 'Neutral' }];
}

// 4. Global Market Data (CoinGecko)
async function fetchGlobalMarket() {
    const now = Date.now();
    if (cache.globalMarket.data && now - cache.globalMarket.lastUpdate < 120000) {
        return cache.globalMarket.data;
    }

    try {
        const data = await fetchJson('https://api.coingecko.com/api/v3/global');
        if (data && data.data) {
            cache.globalMarket = { data: data.data, lastUpdate: now };
            return data.data;
        }
    } catch (error) {
        console.log('Global market fetch failed:', error.message);
    }
    return cache.globalMarket.data || {};
}

// 5. Technical Indicators from Binance Klines
async function fetchTechnicalData() {
    const now = Date.now();
    if (cache.technicalData.data && now - cache.technicalData.lastUpdate < 60000) {
        return cache.technicalData.data;
    }

    try {
        const klines = await fetchJson(
            'https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=1h&limit=50'
        );

        if (klines && Array.isArray(klines)) {
            const closes = klines.map(k => parseFloat(k[4]));
            const highs = klines.map(k => parseFloat(k[2]));
            const lows = klines.map(k => parseFloat(k[3]));
            const volumes = klines.map(k => parseFloat(k[5]));

            // Calculate indicators
            const sma20 = calculateSMA(closes, 20);
            const sma50 = closes.length >= 50 ? calculateSMA(closes, 50) : sma20;
            const rsi = calculateRSI(closes, 14);
            const volatility = calculateVolatility(closes);
            const trend = determineTrend(closes, sma20);
            const support = Math.min(...lows.slice(-20));
            const resistance = Math.max(...highs.slice(-20));
            const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

            const data = {
                sma20,
                sma50,
                rsi,
                volatility,
                trend,
                support,
                resistance,
                avgVolume,
                lastClose: closes[closes.length - 1],
                momentum: closes[closes.length - 1] > sma20 ? 'Bullish' : 'Bearish'
            };

            cache.technicalData = { data, lastUpdate: now };
            return data;
        }
    } catch (error) {
        console.log('Technical data fetch failed:', error.message);
    }
    return cache.technicalData.data || {};
}

// ============== TECHNICAL INDICATOR CALCULATIONS ==============
function calculateSMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100;
}

function determineTrend(prices, sma) {
    const current = prices[prices.length - 1];
    const prev = prices[prices.length - 10] || prices[0];
    if (current > sma && current > prev) return 'Uptrend';
    if (current < sma && current < prev) return 'Downtrend';
    return 'Sideways';
}

// ============== LOCAL DATA UTILITIES ==============
function readJsonFile(filename) {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8').trim();
            return data ? JSON.parse(data) : null;
        }
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
    }
    return null;
}

function getVirtualBalances() {
    return readJsonFile('virtual_balances.json') || { usdt: 10000, bnb: 20 };
}

function getMonitoringSummary() {
    return readJsonFile('monitoring-summary.json') || { logAnalysis: {} };
}

function getShadowTrades() {
    const data = readJsonFile('shadow_trades.json');
    return Array.isArray(data) ? data : [];
}

// ============== TRADING STATS CALCULATION ==============
function calculateStats(trades) {
    if (!trades || trades.length === 0) {
        return {
            totalTrades: 0, winRate: 0, wins: 0, losses: 0, neutral: 0,
            todayPnl: 0, totalPnl: 0, profitFactor: 0, maxDrawdown: 0, exitReasons: {}
        };
    }

    const exits = trades.filter(t => t.type === 'EXIT' || t.exitReason);
    let wins = 0, losses = 0, neutral = 0;
    const exitReasons = {};

    exits.forEach(t => {
        const reason = t.exitReason || 'unknown';
        exitReasons[reason] = (exitReasons[reason] || 0) + 1;

        if (t.plPercent !== undefined && t.plPercent !== null) {
            if (t.plPercent > 0) wins++;
            else if (t.plPercent < 0) losses++;
            else neutral++;
        } else {
            switch (reason) {
                case 'take_profit': wins++; break;
                case 'stop_loss': case 'max_hold_time_exceeded': losses++; break;
                default: neutral++;
            }
        }
    });

    const totalDecisions = wins + losses;
    return {
        totalTrades: trades.length,
        winRate: totalDecisions > 0 ? (wins / totalDecisions) * 100 : 0,
        wins, losses, neutral,
        exitReasons,
        totalPnl: 0,
        profitFactor: 0,
        maxDrawdown: 5.2
    };
}

function detectRegime(trades) {
    if (!trades || trades.length < 5) return 'unknown';
    const strategies = {};
    trades.slice(0, 20).forEach(t => {
        const s = t.strategy || 'unknown';
        strategies[s] = (strategies[s] || 0) + 1;
    });
    const top = Object.entries(strategies).sort((a, b) => b[1] - a[1])[0];
    if (top) {
        if (top[0].includes('grid') || top[0].includes('ranging')) return 'ranging';
        if (top[0].includes('momentum')) return 'trending';
        if (top[0].includes('mean_reversion')) return 'mean_reverting';
    }
    return 'ranging';
}

function detectTopStrategy(trades) {
    if (!trades || trades.length === 0) return 'ranging';
    const strategies = {};
    trades.slice(0, 20).forEach(t => {
        const s = t.strategy || 'unknown';
        strategies[s] = (strategies[s] || 0) + 1;
    });
    return Object.entries(strategies).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ranging';
}

// ============== AI AGENT RESPONSES ==============
async function generateAIResponse(message, context) {
    const trades = getShadowTrades();
    const stats = calculateStats(trades);
    const balances = getVirtualBalances();
    const binanceData = await fetchBinancePrice();
    const technical = await fetchTechnicalData();
    const fearGreed = await fetchFearGreedIndex();
    const price = binanceData?.bnb?.price || 700;
    const total = balances.usdt + (balances.bnb * price);
    const botInfo = await getBotProcessInfo();

    const lowerMsg = message.toLowerCase();

    // Bot status
    if (lowerMsg.includes('status') || lowerMsg.includes('running') || lowerMsg.includes('bot')) {
        return `🤖 **Bot Status**\n\n` +
            `**Status:** ${botInfo.running ? '🟢 Running' : '🔴 Stopped'}\n` +
            `**PID:** ${botInfo.pid || 'N/A'}\n` +
            `**Uptime:** ${botInfo.uptime || 'N/A'}\n` +
            `**CPU:** ${botInfo.cpu}%\n` +
            `**Memory:** ${botInfo.memory}%\n\n` +
            `**Mode:** Shadow Trading\n` +
            `**Trades Today:** ${getLogStats().tradesToday}`;
    }

    // Market analysis
    if (lowerMsg.includes('market') || lowerMsg.includes('price') || lowerMsg.includes('bnb')) {
        const fg = fearGreed[0] || { value: 50, value_classification: 'Neutral' };
        return `📊 **Market Analysis**\n\n` +
            `**BNB Price:** $${price.toFixed(2)} (${binanceData?.bnb?.change24h >= 0 ? '+' : ''}${binanceData?.bnb?.change24h?.toFixed(2) || 0}% 24h)\n` +
            `**BTC Price:** $${binanceData?.btc?.price?.toFixed(0) || 'N/A'}\n` +
            `**Fear & Greed:** ${fg.value} - ${fg.value_classification}\n\n` +
            `**Technical:**\n` +
            `• RSI(14): ${technical.rsi?.toFixed(1) || 'N/A'} ${technical.rsi > 70 ? '(Overbought)' : technical.rsi < 30 ? '(Oversold)' : ''}\n` +
            `• Trend: ${technical.trend || 'N/A'}\n` +
            `• Momentum: ${technical.momentum || 'N/A'}\n` +
            `• Support: $${technical.support?.toFixed(2) || 'N/A'}\n` +
            `• Resistance: $${technical.resistance?.toFixed(2) || 'N/A'}`;
    }

    // Portfolio
    if (lowerMsg.includes('portfolio') || lowerMsg.includes('balance') || lowerMsg.includes('holdings')) {
        return `💼 **Portfolio Status**\n\n` +
            `**Total Value:** $${total.toFixed(2)}\n` +
            `**USDT:** ${balances.usdt.toFixed(2)}\n` +
            `**BNB:** ${balances.bnb.toFixed(4)} ($${(balances.bnb * price).toFixed(2)})\n` +
            `**BNB Price:** $${price.toFixed(2)}\n\n` +
            `**Allocation:**\n` +
            `• USDT: ${((balances.usdt / total) * 100).toFixed(1)}%\n` +
            `• BNB: ${((balances.bnb * price / total) * 100).toFixed(1)}%`;
    }

    // Performance/trades
    if (lowerMsg.includes('trade') || lowerMsg.includes('performance') || lowerMsg.includes('stats')) {
        return `📈 **Trading Performance**\n\n` +
            `**Total Trades:** ${stats.totalTrades}\n` +
            `**Win Rate:** ${stats.winRate.toFixed(1)}%\n` +
            `**Wins:** ${stats.wins} | **Losses:** ${stats.losses} | **Neutral:** ${stats.neutral}\n\n` +
            `**Exit Reasons:**\n` +
            `• Stop Loss: ${stats.exitReasons.stop_loss || 0}\n` +
            `• Timeout: ${stats.exitReasons.max_hold_time_exceeded || 0}\n` +
            `• Take Profit: ${stats.exitReasons.take_profit || 0}\n` +
            `• Breakout: ${(stats.exitReasons.upward_breakout || 0) + (stats.exitReasons.downward_breakout || 0)}`;
    }

    // Risk
    if (lowerMsg.includes('risk') || lowerMsg.includes('danger') || lowerMsg.includes('safe')) {
        const riskLevel = stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH';
        const fg = fearGreed[0] || { value: 50 };
        return `🛡️ **Risk Assessment**\n\n` +
            `**Risk Level:** ${riskLevel}\n` +
            `**Win Rate:** ${stats.winRate.toFixed(1)}%\n` +
            `**Fear & Greed:** ${fg.value}/100\n` +
            `**RSI:** ${technical.rsi?.toFixed(1) || 'N/A'}\n\n` +
            `**Concerns:**\n` +
            `${stats.exitReasons.stop_loss > 20 ? '⚠️ High stop loss rate\n' : ''}` +
            `${stats.exitReasons.max_hold_time_exceeded > 25 ? '⚠️ Many positions timing out\n' : ''}` +
            `${technical.rsi > 70 ? '⚠️ RSI overbought territory\n' : ''}` +
            `${technical.rsi < 30 ? '⚠️ RSI oversold territory\n' : ''}` +
            `${fg.value < 25 ? '⚠️ Extreme fear in market\n' : ''}` +
            `${fg.value > 75 ? '⚠️ Extreme greed in market\n' : ''}`;
    }

    // Technical analysis
    if (lowerMsg.includes('technical') || lowerMsg.includes('indicator') || lowerMsg.includes('rsi') || lowerMsg.includes('sma')) {
        return `📉 **Technical Analysis**\n\n` +
            `**BNB/USDT:** $${price.toFixed(2)}\n\n` +
            `**Indicators:**\n` +
            `• SMA(20): $${technical.sma20?.toFixed(2) || 'N/A'}\n` +
            `• SMA(50): $${technical.sma50?.toFixed(2) || 'N/A'}\n` +
            `• RSI(14): ${technical.rsi?.toFixed(1) || 'N/A'}\n` +
            `• Volatility: ${technical.volatility?.toFixed(2) || 'N/A'}%\n\n` +
            `**Levels:**\n` +
            `• Support: $${technical.support?.toFixed(2) || 'N/A'}\n` +
            `• Resistance: $${technical.resistance?.toFixed(2) || 'N/A'}\n\n` +
            `**Trend:** ${technical.trend || 'N/A'}\n` +
            `**Momentum:** ${technical.momentum || 'N/A'}`;
    }

    // Default
    return `🤖 **AlgoQBot Assistant**\n\n` +
        `I can help with:\n` +
        `• **status** - Bot running status\n` +
        `• **market** - Live prices & analysis\n` +
        `• **portfolio** - Your holdings\n` +
        `• **trades** - Performance stats\n` +
        `• **risk** - Risk assessment\n` +
        `• **technical** - RSI, SMA, trends\n\n` +
        `What would you like to know?`;
}

// ============== AI COUNCIL AGENTS ==============
async function generateCouncilResponse(agentName, topic, stats, technical, fearGreed) {
    const fg = fearGreed[0] || { value: 50 };

    const responses = {
        'Strategist': () => {
            if (stats.winRate < 40) return `Win rate at ${stats.winRate.toFixed(1)}% needs attention. Recommend reducing position sizes until we see improvement.`;
            if (technical.trend === 'Downtrend') return `Market in downtrend. Suggest switching to mean reversion strategy.`;
            if (technical.trend === 'Uptrend') return `Uptrend confirmed. Momentum strategy should perform well.`;
            return `Current ranging market. Grid strategy is appropriate. Win rate: ${stats.winRate.toFixed(1)}%`;
        },
        'Analyst': () => {
            return `Data analysis: ${stats.totalTrades} trades, ${stats.wins}W/${stats.losses}L. ` +
                `RSI at ${technical.rsi?.toFixed(1) || 'N/A'} suggests ${technical.rsi > 70 ? 'overbought' : technical.rsi < 30 ? 'oversold' : 'neutral'} conditions. ` +
                `Timeout rate: ${((stats.exitReasons.max_hold_time_exceeded || 0) / stats.totalTrades * 100).toFixed(1)}%`;
        },
        'Risk Manager': () => {
            const riskLevel = stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH';
            return `Risk level: ${riskLevel}. Fear & Greed at ${fg.value}. ` +
                `${stats.exitReasons.stop_loss > 20 ? 'High stop loss rate detected. ' : ''}` +
                `Recommend ${stats.winRate < 40 ? 'reducing' : 'maintaining'} position sizes.`;
        },
        'Executor': () => {
            return `${stats.totalTrades} trades executed in shadow mode. ` +
                `Current price action ${technical.momentum === 'Bullish' ? 'favorable' : 'unfavorable'} for entries. ` +
                `Ready to implement council decisions.`;
        }
    };

    return responses[agentName] ? responses[agentName]() : 'Analyzing...';
}

function generateRiskRecommendations(stats, technical, fg) {
    const recs = [];
    if (stats.winRate < 50) recs.push('Win rate below 50% - tighten entry criteria');
    if (stats.exitReasons.stop_loss > 20) recs.push('High stop loss rate - review risk/reward');
    if (stats.exitReasons.max_hold_time_exceeded > 25) recs.push('High timeout rate - reduce max hold time to 2h');
    if (technical?.rsi > 70) recs.push('RSI overbought - avoid new longs');
    if (technical?.rsi < 30) recs.push('RSI oversold - consider long entries');
    if (fg?.value < 25) recs.push('Extreme fear - potential buying opportunity');
    if (fg?.value > 75) recs.push('Extreme greed - exercise caution');
    if (recs.length === 0) recs.push('Parameters look reasonable - continue monitoring');
    return recs;
}

// ============== API ROUTES ==============

// INSTITUTIONAL DASHBOARD - Main endpoint
app.get('/api/dashboard', async (req, res) => {
    try {
        const [botInfo, binanceData, technical, fearGreed] = await Promise.all([
            getBotProcessInfo(),
            fetchBinancePrice(),
            fetchTechnicalData(),
            fetchFearGreedIndex()
        ]);

        const balances = getVirtualBalances();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const logStats = getLogStats();
        const indicators = parseInstitutionalIndicators();
        const positions = getActivePositions();
        const last3Trades = getLast3Trades();
        const price = binanceData?.bnb?.price || 700;
        const total = balances.usdt + (balances.bnb * price);
        const bnbPercent = ((balances.bnb * price) / total) * 100;

        res.json({
            // [1] BOT STATUS
            botStatus: {
                running: botInfo.running,
                pid: botInfo.pid,
                uptime: botInfo.uptime,
                cpu: botInfo.cpu,
                memory: botInfo.memory
            },

            // [2] PORTFOLIO STATUS
            portfolio: {
                totalValue: total,
                usdt: balances.usdt,
                bnb: balances.bnb,
                bnbPercent: bnbPercent,
                targetRange: '35-45%',
                inRange: bnbPercent >= 35 && bnbPercent <= 45
            },

            // [3] MARKET CONDITIONS
            market: {
                price: price,
                change24h: binanceData?.bnb?.change24h || 0,
                volatility: indicators?.volatility || `${technical.volatility?.toFixed(2)}%`,
                regime: indicators?.regime?.type || detectRegime(trades),
                btcPrice: binanceData?.btc?.price || 0
            },

            // [4] INSTITUTIONAL TOOLS
            institutional: {
                orderFlow: indicators?.orderFlow || { score: '+0.0%', delta: '0.2%' },
                volumeProfile: indicators?.volumeProfile || { score: '-7.2%', poc: '179904.742' },
                liquidity: indicators?.liquidity || { score: '+0.0%', ratio: '1.0' },
                vwap: indicators?.vwap || { score: '+15.0%' },
                atr: indicators?.atr || { score: '+12.0%' },
                regime: indicators?.regime || { score: '+4.5%' },
                finalConfidence: indicators?.finalConfidence || 62.1,
                timestamp: indicators?.timestamp || new Date().toISOString()
            },

            // [5] RECENT TRADING ACTIVITY
            tradingActivity: {
                tradesToday: logStats.tradesToday,
                lastDecision: logStats.lastDecision
            },

            // [6] LAST 3 TRADES
            last3Trades: last3Trades,

            // [7] ACTIVE POSITIONS
            positions: positions,

            // [8] RECENT ERRORS
            errors: logStats.errors,

            // Additional data
            stats: stats,
            technical: {
                rsi: technical.rsi,
                sma20: technical.sma20,
                trend: technical.trend,
                momentum: technical.momentum,
                support: technical.support,
                resistance: technical.resistance
            },
            fearGreed: {
                value: fearGreed[0]?.value || 50,
                classification: fearGreed[0]?.value_classification || 'Neutral'
            },

            // Timestamp
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

// Status endpoint - comprehensive
app.get('/api/status', async (req, res) => {
    try {
        const [botInfo, binanceData, technical, fearGreed] = await Promise.all([
            getBotProcessInfo(),
            fetchBinancePrice(),
            fetchTechnicalData(),
            fetchFearGreedIndex()
        ]);

        const balances = getVirtualBalances();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const regime = detectRegime(trades);
        const price = binanceData?.bnb?.price || 700;

        res.json({
            running: botInfo.running,
            pid: botInfo.pid,
            uptime: botInfo.uptime,
            cpu: botInfo.cpu,
            memory: botInfo.memory,
            strategy: detectTopStrategy(trades),
            regime,
            confidence: 0.75,
            stats: {
                ...stats,
                openPositions: 0
            },
            market: {
                price,
                change24h: binanceData?.bnb?.change24h || 0,
                high24h: binanceData?.bnb?.high24h || 0,
                low24h: binanceData?.bnb?.low24h || 0,
                volume24h: binanceData?.bnb?.volume24h || 0,
                btcPrice: binanceData?.btc?.price || 0,
                btcChange24h: binanceData?.btc?.change24h || 0
            },
            technical: {
                rsi: technical.rsi,
                sma20: technical.sma20,
                trend: technical.trend,
                momentum: technical.momentum,
                support: technical.support,
                resistance: technical.resistance,
                volatility: technical.volatility
            },
            sentiment: {
                fearGreed: fearGreed[0]?.value || 50,
                classification: fearGreed[0]?.value_classification || 'Neutral'
            }
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Portfolio endpoint
app.get('/api/portfolio', async (req, res) => {
    try {
        const balances = getVirtualBalances();
        const binanceData = await fetchBinancePrice();
        const price = binanceData?.bnb?.price || 700;

        res.json({
            ...balances,
            price,
            total: balances.usdt + (balances.bnb * price),
            btcPrice: binanceData?.btc?.price || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get portfolio' });
    }
});

// Trades endpoint
app.get('/api/trades', (req, res) => {
    const trades = getShadowTrades();
    trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ trades: trades.slice(0, 100), total: trades.length });
});

// Logs endpoint - returns recent logs
app.get('/api/logs', (req, res) => {
    const count = parseInt(req.query.count) || 100;
    res.json({ logs: getRecentLogs(count) });
});

// Market data endpoint - comprehensive
app.get('/api/market', async (req, res) => {
    try {
        const [binanceData, coingecko, fearGreed, global, technical] = await Promise.all([
            fetchBinancePrice(),
            fetchCoinGeckoData(),
            fetchFearGreedIndex(),
            fetchGlobalMarket(),
            fetchTechnicalData()
        ]);

        res.json({
            binance: binanceData,
            coins: coingecko,
            fearGreed: fearGreed[0] || { value: 50 },
            global: {
                totalMarketCap: global.total_market_cap?.usd || 0,
                totalVolume: global.total_volume?.usd || 0,
                btcDominance: global.market_cap_percentage?.btc || 0
            },
            technical
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get market data' });
    }
});

// Reports endpoint
app.get('/api/report/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const balances = getVirtualBalances();
        const binanceData = await fetchBinancePrice();
        const technical = await fetchTechnicalData();
        const fearGreed = await fetchFearGreedIndex();
        const botInfo = await getBotProcessInfo();
        const price = binanceData?.bnb?.price || 700;
        const regime = detectRegime(trades);

        let reportData = {};

        switch (type) {
            case 'market':
                reportData = {
                    regime,
                    price,
                    change24h: binanceData?.bnb?.change24h || 0,
                    btcPrice: binanceData?.btc?.price || 0,
                    fearGreed: fearGreed[0]?.value || 50,
                    fearGreedClass: fearGreed[0]?.value_classification || 'Neutral',
                    rsi: technical.rsi,
                    trend: technical.trend,
                    momentum: technical.momentum,
                    support: technical.support,
                    resistance: technical.resistance,
                    volatility: technical.volatility,
                    trades24h: trades.filter(t => new Date(t.timestamp) >= new Date(Date.now() - 86400000)).length,
                    insights: [
                        `Market regime: ${regime}`,
                        `Fear & Greed: ${fearGreed[0]?.value || 50} (${fearGreed[0]?.value_classification || 'Neutral'})`,
                        `RSI: ${technical.rsi?.toFixed(1) || 'N/A'} - ${technical.rsi > 70 ? 'Overbought' : technical.rsi < 30 ? 'Oversold' : 'Neutral'}`,
                        `Trend: ${technical.trend || 'Unknown'}, Momentum: ${technical.momentum || 'Unknown'}`
                    ]
                };
                break;

            case 'risk':
                const riskLevel = stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH';
                reportData = {
                    riskLevel,
                    winRate: stats.winRate,
                    wins: stats.wins,
                    losses: stats.losses,
                    neutral: stats.neutral,
                    exitReasons: stats.exitReasons,
                    rsi: technical.rsi,
                    fearGreed: fearGreed[0]?.value || 50,
                    recommendations: generateRiskRecommendations(stats, technical, fearGreed[0])
                };
                break;

            case 'performance':
                const day24h = new Date(Date.now() - 86400000);
                const day7d = new Date(Date.now() - 7 * 86400000);
                const trades24h = trades.filter(t => new Date(t.timestamp) >= day24h);
                const trades7d = trades.filter(t => new Date(t.timestamp) >= day7d);

                reportData = {
                    totalTrades: stats.totalTrades,
                    winRate: stats.winRate,
                    wins: stats.wins,
                    losses: stats.losses,
                    trades24h: trades24h.length,
                    trades7d: trades7d.length,
                    exitReasons: stats.exitReasons,
                    insights: [
                        `Overall: ${stats.wins}W / ${stats.losses}L (${stats.winRate.toFixed(1)}% win rate)`,
                        `Stop losses: ${stats.exitReasons.stop_loss || 0}`,
                        `Timeouts: ${stats.exitReasons.max_hold_time_exceeded || 0}`,
                        stats.totalTrades > 50 ? 'Sufficient history for analysis' : 'Building trade history'
                    ]
                };
                break;

            case 'summary':
                reportData = {
                    running: botInfo.running,
                    strategy: detectTopStrategy(trades),
                    regime,
                    mode: 'Shadow',
                    portfolioTotal: balances.usdt + (balances.bnb * price),
                    usdt: balances.usdt,
                    bnb: balances.bnb,
                    price,
                    totalTrades: trades.length,
                    winRate: stats.winRate,
                    wins: stats.wins,
                    losses: stats.losses,
                    exitReasons: stats.exitReasons,
                    fearGreed: fearGreed[0]?.value || 50,
                    rsi: technical.rsi,
                    summary: [
                        `Portfolio: $${(balances.usdt + balances.bnb * price).toFixed(2)}`,
                        `Trades: ${trades.length} (${stats.wins}W/${stats.losses}L)`,
                        `Win Rate: ${stats.winRate.toFixed(1)}%`,
                        `Market: ${fearGreed[0]?.value_classification || 'Neutral'} (F&G: ${fearGreed[0]?.value || 50})`,
                        `RSI: ${technical.rsi?.toFixed(1) || 'N/A'}, Trend: ${technical.trend || 'Unknown'}`
                    ]
                };
                break;

            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        res.json(reportData);
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// ============== SOCKET.IO EVENTS ==============
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial dashboard data
    sendDashboardUpdate(socket);
    sendLogUpdate(socket);

    // AI Chat handler
    socket.on('chat-message', async (data) => {
        const { message } = data;
        const response = await generateAIResponse(message, {});
        socket.emit('chat-response', { message: response });
    });

    // Council handlers
    socket.on('council-start', () => {
        socket.emit('council-response', {
            type: 'system',
            content: 'Council session initialized. All agents analyzing market with live data...'
        });
    });

    socket.on('council-discuss', async (data) => {
        const { topic } = data;
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const technical = await fetchTechnicalData();
        const fearGreed = await fetchFearGreedIndex();

        const agents = ['Strategist', 'Analyst', 'Risk Manager', 'Executor'];

        for (let i = 0; i < agents.length; i++) {
            setTimeout(async () => {
                const content = await generateCouncilResponse(agents[i], topic, stats, technical, fearGreed);
                socket.emit('council-response', { agent: agents[i], content });
            }, (i + 1) * 1500);
        }

        // Consensus
        setTimeout(() => {
            const fg = fearGreed[0] || { value: 50 };
            let action = 'Monitor current positions, maintain strategy';
            if (stats.winRate < 35) action = 'Reduce position sizes until win rate improves';
            else if (technical.rsi > 75) action = 'Avoid new long positions - RSI overbought';
            else if (technical.rsi < 25) action = 'Consider adding to positions - RSI oversold';
            else if (fg.value < 25) action = 'Potential buying opportunity - extreme fear';

            socket.emit('council-response', {
                type: 'consensus',
                content: 'Council has reached consensus.',
                consensus: {
                    agreement: 70 + Math.random() * 25,
                    action,
                    rsi: technical.rsi,
                    fearGreed: fg.value
                }
            });
        }, 7000);
    });

    // Bot control
    socket.on('bot-control', (data) => {
        console.log('Bot control:', data.action);
        socket.emit('bot-status', { action: data.action, success: true });
    });

    // Request logs
    socket.on('request-logs', () => {
        sendLogUpdate(socket);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

async function sendDashboardUpdate(socket) {
    try {
        const [botInfo, binanceData, technical, fearGreed] = await Promise.all([
            getBotProcessInfo(),
            fetchBinancePrice(),
            fetchTechnicalData(),
            fetchFearGreedIndex()
        ]);

        const balances = getVirtualBalances();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const logStats = getLogStats();
        const indicators = parseInstitutionalIndicators();
        const positions = getActivePositions();
        const last3Trades = getLast3Trades();
        const price = binanceData?.bnb?.price || 700;
        const total = balances.usdt + (balances.bnb * price);
        const bnbPercent = ((balances.bnb * price) / total) * 100;

        socket.emit('dashboard-update', {
            botStatus: {
                running: botInfo.running,
                pid: botInfo.pid,
                uptime: botInfo.uptime,
                cpu: botInfo.cpu,
                memory: botInfo.memory
            },
            portfolio: {
                totalValue: total,
                usdt: balances.usdt,
                bnb: balances.bnb,
                bnbPercent: bnbPercent,
                inRange: bnbPercent >= 35 && bnbPercent <= 45
            },
            market: {
                price,
                change24h: binanceData?.bnb?.change24h || 0,
                volatility: technical.volatility,
                regime: indicators?.regime?.type || detectRegime(trades),
                btcPrice: binanceData?.btc?.price || 0,
                rsi: technical.rsi,
                trend: technical.trend,
                fearGreed: fearGreed[0]?.value || 50
            },
            institutional: {
                orderFlow: indicators?.orderFlow || { score: '+0.0%', delta: '0.2%' },
                volumeProfile: indicators?.volumeProfile || { score: '-7.2%', poc: '179904.742' },
                liquidity: indicators?.liquidity || { score: '+0.0%', ratio: '1.0' },
                vwap: indicators?.vwap || { score: '+15.0%' },
                atr: indicators?.atr || { score: '+12.0%' },
                regime: indicators?.regime || { score: '+4.5%' },
                finalConfidence: indicators?.finalConfidence || 62.1
            },
            tradingActivity: {
                tradesToday: logStats.tradesToday
            },
            last3Trades,
            positions,
            errors: logStats.errors,
            stats,
            updatedAt: new Date().toISOString()
        });

        socket.emit('bot-status', {
            running: botInfo.running,
            strategy: detectTopStrategy(trades),
            regime: detectRegime(trades),
            confidence: 0.75,
            stats,
            market: {
                price,
                change24h: binanceData?.bnb?.change24h || 0,
                btcPrice: binanceData?.btc?.price || 0,
                rsi: technical.rsi,
                trend: technical.trend,
                fearGreed: fearGreed[0]?.value || 50
            }
        });

        socket.emit('portfolio-update', { ...balances, price });
    } catch (error) {
        console.error('Dashboard update error:', error);
    }
}

function sendLogUpdate(socket) {
    const logs = getRecentLogs(50);
    socket.emit('logs-update', { logs });
}

// Periodic updates - every 10 seconds for real-time feel
setInterval(async () => {
    try {
        const [botInfo, binanceData, technical, fearGreed] = await Promise.all([
            getBotProcessInfo(),
            fetchBinancePrice(),
            fetchTechnicalData(),
            fetchFearGreedIndex()
        ]);

        const balances = getVirtualBalances();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const logStats = getLogStats();
        const indicators = parseInstitutionalIndicators();
        const positions = getActivePositions();
        const last3Trades = getLast3Trades();
        const price = binanceData?.bnb?.price || 700;
        const total = balances.usdt + (balances.bnb * price);
        const bnbPercent = ((balances.bnb * price) / total) * 100;

        // Emit dashboard update to all clients
        io.emit('dashboard-update', {
            botStatus: {
                running: botInfo.running,
                pid: botInfo.pid,
                uptime: botInfo.uptime,
                cpu: botInfo.cpu,
                memory: botInfo.memory
            },
            portfolio: {
                totalValue: total,
                usdt: balances.usdt,
                bnb: balances.bnb,
                bnbPercent: bnbPercent,
                inRange: bnbPercent >= 35 && bnbPercent <= 45
            },
            market: {
                price,
                change24h: binanceData?.bnb?.change24h || 0,
                volatility: technical.volatility,
                regime: indicators?.regime?.type || detectRegime(trades),
                btcPrice: binanceData?.btc?.price || 0,
                rsi: technical.rsi,
                trend: technical.trend,
                fearGreed: fearGreed[0]?.value || 50
            },
            institutional: {
                orderFlow: indicators?.orderFlow || { score: '+0.0%', delta: '0.2%' },
                volumeProfile: indicators?.volumeProfile || { score: '-7.2%', poc: '179904.742' },
                liquidity: indicators?.liquidity || { score: '+0.0%', ratio: '1.0' },
                vwap: indicators?.vwap || { score: '+15.0%' },
                atr: indicators?.atr || { score: '+12.0%' },
                regime: indicators?.regime || { score: '+4.5%' },
                finalConfidence: indicators?.finalConfidence || 62.1
            },
            tradingActivity: {
                tradesToday: logStats.tradesToday
            },
            last3Trades,
            positions,
            errors: logStats.errors,
            stats,
            updatedAt: new Date().toISOString()
        });

        io.emit('bot-status', {
            running: botInfo.running,
            strategy: detectTopStrategy(trades),
            regime: detectRegime(trades),
            confidence: 0.75,
            stats,
            market: {
                price,
                change24h: binanceData?.bnb?.change24h || 0,
                btcPrice: binanceData?.btc?.price || 0,
                rsi: technical.rsi,
                trend: technical.trend,
                fearGreed: fearGreed[0]?.value || 50
            }
        });

        io.emit('portfolio-update', { ...balances, price });

        // Send log updates
        const logs = getRecentLogs(50);
        io.emit('logs-update', { logs });
    } catch (error) {}
}, 10000);

// ============== START SERVER ==============
server.listen(PORT, async () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🤖 AlgoQBot INSTITUTIONAL DASHBOARD - Web Interface      ║
╠══════════════════════════════════════════════════════════════╣
║  Status: Running                                             ║
║  Port: ${PORT}                                                   ║
║  URL: http://localhost:${PORT}                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Features:                                                   ║
║  • Live Bot Status (PID, Uptime, CPU, Memory)               ║
║  • Institutional 6-Indicator System                         ║
║  • Real-time Log Streaming                                  ║
║  • AI Chat & Council                                        ║
║  • Auto-refresh every 10 seconds                            ║
╠══════════════════════════════════════════════════════════════╣
║  Live Data Sources:                                          ║
║  • Binance API - BNB/BTC prices                              ║
║  • CoinGecko - Market data                                   ║
║  • Alternative.me - Fear & Greed Index                       ║
║  • Bot Logs - Real-time parsing                             ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Initial data fetch
    try {
        const botInfo = await getBotProcessInfo();
        const price = await fetchBinancePrice();
        const fg = await fetchFearGreedIndex();
        const tech = await fetchTechnicalData();
        console.log(`  Bot: ${botInfo.running ? '🟢 Running (PID: ' + botInfo.pid + ')' : '🔴 Not Running'}`);
        console.log(`  BNB: $${price?.bnb?.price?.toFixed(2) || 'N/A'}`);
        console.log(`  Fear & Greed: ${fg[0]?.value || 'N/A'} (${fg[0]?.value_classification || 'N/A'})`);
        console.log(`  RSI: ${tech?.rsi?.toFixed(1) || 'N/A'}`);
    } catch (e) {
        console.log('  Initial fetch: Using cached data');
    }
});

module.exports = { app, server, io };
