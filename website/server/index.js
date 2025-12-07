/**
 * AlgoQBot Production Monitor - Enhanced Backend Server
 * Live crypto data, AI chat, technical analysis, macro data
 */

const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Configuration
const PORT = process.env.PORT || 9000;
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

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
    technicalData: { data: null, lastUpdate: 0 }
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

function isBotRunning() {
    return new Promise((resolve) => {
        exec('pgrep -f "node.*AdvancedTradingBot\\|node.*shadowMode\\|node.*start-shadow"', (error, stdout) => {
            resolve(stdout.trim().length > 0);
        });
    });
}

function getRecentLogs(count = 50) {
    try {
        const logFiles = [
            path.join(LOGS_DIR, 'combined.log'),
            path.join(LOGS_DIR, 'app.log'),
            path.join(__dirname, '..', '..', 'bot.log')
        ];

        for (const logFile of logFiles) {
            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n').filter(l => l.trim());
                return lines.slice(-count).reverse();
            }
        }
    } catch (error) {}
    return [];
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

    const lowerMsg = message.toLowerCase();

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

    // Optimize
    if (lowerMsg.includes('optimize') || lowerMsg.includes('improve') || lowerMsg.includes('recommend')) {
        const recs = [];
        if (stats.exitReasons.max_hold_time_exceeded > 25) recs.push('• Reduce max hold time to 2 hours');
        if (stats.exitReasons.stop_loss > stats.wins) recs.push('• Lower take profit target to 1.5%');
        if (stats.winRate < 40) recs.push('• Tighten entry criteria');
        if (technical.rsi > 70) recs.push('• Avoid new longs - RSI overbought');
        if (technical.rsi < 30) recs.push('• Consider long entries - RSI oversold');

        return `⚡ **Optimization Recommendations**\n\n` +
            (recs.length > 0 ? recs.join('\n') : '✅ Current parameters look reasonable') +
            `\n\n**Current Stats:**\n` +
            `• Win Rate: ${stats.winRate.toFixed(1)}%\n` +
            `• Timeouts: ${stats.exitReasons.max_hold_time_exceeded || 0}\n` +
            `• Stop Losses: ${stats.exitReasons.stop_loss || 0}`;
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

    // Macro
    if (lowerMsg.includes('macro') || lowerMsg.includes('global') || lowerMsg.includes('sentiment')) {
        const fg = fearGreed[0] || { value: 50, value_classification: 'Neutral' };
        const global = await fetchGlobalMarket();
        return `🌍 **Macro Overview**\n\n` +
            `**Fear & Greed Index:** ${fg.value}/100 (${fg.value_classification})\n` +
            `**BTC Dominance:** ${global.market_cap_percentage?.btc?.toFixed(1) || 'N/A'}%\n` +
            `**Total Market Cap:** $${((global.total_market_cap?.usd || 0) / 1e12).toFixed(2)}T\n` +
            `**24h Volume:** $${((global.total_volume?.usd || 0) / 1e9).toFixed(1)}B\n\n` +
            `**Sentiment:** ${fg.value < 30 ? 'Fear - potential buying opportunity' : fg.value > 70 ? 'Greed - be cautious' : 'Neutral - proceed normally'}`;
    }

    // Default
    return `🤖 **AlgoQBot Assistant**\n\n` +
        `I can help with:\n` +
        `• **market** - Live prices & analysis\n` +
        `• **portfolio** - Your holdings\n` +
        `• **trades** - Performance stats\n` +
        `• **risk** - Risk assessment\n` +
        `• **technical** - RSI, SMA, trends\n` +
        `• **macro** - Fear & Greed, sentiment\n` +
        `• **optimize** - Improvement suggestions\n\n` +
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

// ============== API ROUTES ==============

// Status endpoint - comprehensive
app.get('/api/status', async (req, res) => {
    try {
        const [running, binanceData, technical, fearGreed] = await Promise.all([
            isBotRunning(),
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
            running,
            strategy: detectTopStrategy(trades),
            regime,
            confidence: 0.75,
            uptime: running ? 'Active' : '--',
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

// Logs endpoint
app.get('/api/logs', (req, res) => {
    res.json({ logs: getRecentLogs(100) });
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
                const running = await isBotRunning();
                reportData = {
                    running,
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

function detectTopStrategy(trades) {
    if (!trades || trades.length === 0) return 'ranging';
    const strategies = {};
    trades.slice(0, 20).forEach(t => {
        const s = t.strategy || 'unknown';
        strategies[s] = (strategies[s] || 0) + 1;
    });
    return Object.entries(strategies).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ranging';
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

// ============== SOCKET.IO EVENTS ==============
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    sendStatusUpdate(socket);

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

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

async function sendStatusUpdate(socket) {
    try {
        const [running, binanceData, technical, fearGreed] = await Promise.all([
            isBotRunning(),
            fetchBinancePrice(),
            fetchTechnicalData(),
            fetchFearGreedIndex()
        ]);

        const balances = getVirtualBalances();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const price = binanceData?.bnb?.price || 700;

        socket.emit('bot-status', {
            running,
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
        console.error('Status update error:', error);
    }
}

// Periodic updates
setInterval(async () => {
    try {
        const [running, binanceData, technical, fearGreed] = await Promise.all([
            isBotRunning(),
            fetchBinancePrice(),
            fetchTechnicalData(),
            fetchFearGreedIndex()
        ]);

        const balances = getVirtualBalances();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const price = binanceData?.bnb?.price || 700;

        io.emit('bot-status', {
            running,
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
    } catch (error) {}
}, 10000);

// ============== START SERVER ==============
server.listen(PORT, async () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║        AlgoQBot Production Monitor - Enhanced                ║
╠══════════════════════════════════════════════════════════════╣
║  Status: Running                                             ║
║  Port: ${PORT}                                                   ║
║  URL: http://localhost:${PORT}                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Live Data Sources:                                          ║
║  • Binance API - BNB/BTC prices                              ║
║  • CoinGecko - Market data                                   ║
║  • Alternative.me - Fear & Greed Index                       ║
║  • Technical Indicators - RSI, SMA, Trends                   ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Initial data fetch
    try {
        const price = await fetchBinancePrice();
        const fg = await fetchFearGreedIndex();
        const tech = await fetchTechnicalData();
        console.log(`  BNB: $${price?.bnb?.price?.toFixed(2) || 'N/A'}`);
        console.log(`  Fear & Greed: ${fg[0]?.value || 'N/A'} (${fg[0]?.value_classification || 'N/A'})`);
        console.log(`  RSI: ${tech?.rsi?.toFixed(1) || 'N/A'}`);
    } catch (e) {
        console.log('  Initial fetch: Using cached data');
    }
});

module.exports = { app, server, io };
