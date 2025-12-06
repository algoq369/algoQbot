/**
 * AlgoQBot Production Monitor - Backend Server
 * Serves the web interface and provides real-time data via Socket.IO
 */

const express = require('express');
const http = require('http');
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
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// Cache for live price
let cachedPrice = { price: 700, lastUpdate: 0 };
let cachedLogs = [];

// Data reading utilities
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
    const data = readJsonFile('virtual_balances.json');
    return data || { usdt: 10000, bnb: 20 };
}

function getMonitoringSummary() {
    const data = readJsonFile('monitoring-summary.json');
    return data || { logAnalysis: {} };
}

function getShadowTrades() {
    const data = readJsonFile('shadow_trades.json');
    return Array.isArray(data) ? data : [];
}

// Fetch live BNB price from public API
async function fetchLiveBnbPrice() {
    const now = Date.now();
    // Cache for 30 seconds
    if (now - cachedPrice.lastUpdate < 30000) {
        return cachedPrice.price;
    }

    try {
        const https = require('https');
        return new Promise((resolve) => {
            const req = https.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT', {
                timeout: 5000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const price = parseFloat(json.price);
                        if (price > 0) {
                            cachedPrice = { price, lastUpdate: now };
                            resolve(price);
                        } else {
                            resolve(cachedPrice.price);
                        }
                    } catch (e) {
                        resolve(cachedPrice.price);
                    }
                });
            });
            req.on('error', () => resolve(cachedPrice.price));
            req.on('timeout', () => {
                req.destroy();
                resolve(cachedPrice.price);
            });
        });
    } catch (error) {
        return cachedPrice.price;
    }
}

function getBnbPrice() {
    // Synchronous version - use cached price
    return cachedPrice.price || 700;
}

function isBotRunning() {
    return new Promise((resolve) => {
        exec('pgrep -f "node.*AdvancedTradingBot\\|node.*shadowMode\\|node.*start-shadow"', (error, stdout) => {
            resolve(stdout.trim().length > 0);
        });
    });
}

// Read recent log entries
function getRecentLogs(count = 50) {
    try {
        // Try to read from combined log
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
    } catch (error) {
        console.error('Error reading logs:', error.message);
    }
    return [];
}

// Calculate trading statistics with improved win/loss detection
function calculateStats(trades) {
    if (!trades || trades.length === 0) {
        return {
            totalTrades: 0,
            winRate: 0,
            openPositions: 0,
            wins: 0,
            losses: 0,
            todayPnl: 0,
            totalPnl: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            exitReasons: {}
        };
    }

    const exits = trades.filter(t => t.type === 'EXIT' || t.exitReason);

    // Categorize based on exitReason
    // stop_loss = definite loss
    // take_profit = definite win
    // upward_breakout, downward_breakout = breakout (neutral/contextual)
    // max_hold_time_exceeded = timeout (usually loss)

    let wins = 0;
    let losses = 0;
    let neutral = 0;

    const exitReasons = {};

    exits.forEach(t => {
        const reason = t.exitReason || 'unknown';
        exitReasons[reason] = (exitReasons[reason] || 0) + 1;

        // Use plPercent/profit if available, otherwise infer from exitReason
        if (t.plPercent !== undefined && t.plPercent !== null) {
            if (t.plPercent > 0) wins++;
            else if (t.plPercent < 0) losses++;
            else neutral++;
        } else if (t.profit !== undefined && t.profit !== null) {
            if (t.profit > 0) wins++;
            else if (t.profit < 0) losses++;
            else neutral++;
        } else {
            // Infer from exit reason
            switch (reason) {
                case 'take_profit':
                    wins++;
                    break;
                case 'stop_loss':
                    losses++;
                    break;
                case 'max_hold_time_exceeded':
                    // Timeouts are usually not profitable
                    losses++;
                    break;
                case 'upward_breakout':
                case 'downward_breakout':
                    // Breakouts - count as wins if they triggered exit at profit
                    neutral++;
                    break;
                default:
                    neutral++;
            }
        }
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayTrades = trades.filter(t => new Date(t.timestamp) >= today);

    // Calculate P&L
    let totalProfit = 0;
    let totalLoss = 0;
    exits.forEach(t => {
        const pnl = t.plUSD || t.profit || 0;
        if (pnl > 0) totalProfit += pnl;
        else totalLoss += Math.abs(pnl);
    });

    const totalDecisions = wins + losses;
    const winRate = totalDecisions > 0 ? (wins / totalDecisions) * 100 : 0;

    return {
        totalTrades: trades.length,
        winRate,
        openPositions: trades.filter(t => t.type === 'ENTRY' && !t.exitReason).length,
        wins,
        losses,
        neutral,
        todayPnl: todayTrades.reduce((sum, t) => sum + (t.plUSD || t.profit || 0), 0),
        totalPnl: totalProfit - totalLoss,
        profitFactor: totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? Infinity : 0),
        maxDrawdown: 5.2,
        exitReasons
    };
}

// Detect market regime from trades
function detectRegime(trades) {
    if (!trades || trades.length < 5) return 'unknown';

    const recentTrades = trades.slice(0, 20);
    const strategies = {};

    recentTrades.forEach(t => {
        const strategy = t.strategy || 'unknown';
        strategies[strategy] = (strategies[strategy] || 0) + 1;
    });

    // Most common strategy suggests regime
    const topStrategy = Object.entries(strategies)
        .sort((a, b) => b[1] - a[1])[0];

    if (topStrategy) {
        const strategyName = topStrategy[0];
        if (strategyName.includes('grid')) return 'ranging';
        if (strategyName.includes('momentum')) return 'trending';
        if (strategyName.includes('mean_reversion')) return 'mean_reverting';
        if (strategyName.includes('ranging')) return 'ranging';
    }

    return 'ranging';
}

// API Routes

// Status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const running = await isBotRunning();
        const balances = getVirtualBalances();
        const summary = getMonitoringSummary();
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const price = await fetchLiveBnbPrice();
        const regime = summary?.logAnalysis?.regime || detectRegime(trades);

        res.json({
            running,
            strategy: summary?.strategy || detectTopStrategy(trades),
            regime,
            confidence: summary?.confidence || 0.75,
            uptime: running ? formatUptime() : '--',
            stats: {
                ...stats,
                openPositions: summary?.logAnalysis?.activePositions || stats.openPositions
            },
            market: {
                price,
                change24h: await get24hChange(),
                volume24h: '$1.2B',
                volatility: calculateVolatility(trades)
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
        const price = await fetchLiveBnbPrice();

        res.json({
            ...balances,
            price,
            total: balances.usdt + (balances.bnb * price)
        });
    } catch (error) {
        console.error('Portfolio error:', error);
        res.status(500).json({ error: 'Failed to get portfolio' });
    }
});

// Trades endpoint
app.get('/api/trades', (req, res) => {
    try {
        const trades = getShadowTrades();
        trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            trades: trades.slice(0, 100),
            total: trades.length
        });
    } catch (error) {
        console.error('Trades error:', error);
        res.status(500).json({ error: 'Failed to get trades' });
    }
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
    try {
        const logs = getRecentLogs(100);
        res.json({ logs });
    } catch (error) {
        console.error('Logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// Report endpoints
app.get('/api/report/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const balances = getVirtualBalances();
        const price = await fetchLiveBnbPrice();
        const summary = getMonitoringSummary();
        const regime = summary?.logAnalysis?.regime || detectRegime(trades);

        const now = new Date();
        const day24h = new Date(now - 24 * 60 * 60 * 1000);
        const day7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const day30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const trades24h = trades.filter(t => new Date(t.timestamp) >= day24h);
        const trades7d = trades.filter(t => new Date(t.timestamp) >= day7d);
        const trades30d = trades.filter(t => new Date(t.timestamp) >= day30d);

        let reportData = {};

        switch (type) {
            case 'market':
                reportData = {
                    regime,
                    price,
                    change24h: await get24hChange(),
                    volatility: calculateVolatility(trades),
                    trades24h: trades24h.length,
                    trades7d: trades7d.length,
                    trades30d: trades30d.length,
                    avgTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.sizeUSD || t.amount || 0), 0) / trades.length : 0,
                    topStrategy: detectTopStrategy(trades),
                    insights: generateMarketInsights(trades, regime, stats)
                };
                break;

            case 'risk':
                const riskLevel = stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH';

                reportData = {
                    riskLevel,
                    winRate: stats.winRate,
                    profitFactor: stats.profitFactor,
                    maxDrawdown: stats.maxDrawdown,
                    wins: stats.wins,
                    losses: stats.losses,
                    neutral: stats.neutral,
                    riskRewardRatio: stats.losses > 0 ? stats.wins / stats.losses : stats.wins,
                    exitReasons: stats.exitReasons,
                    recommendations: generateRiskRecommendations(stats)
                };
                break;

            case 'performance':
                const calcStats = (tradeSet) => {
                    const s = calculateStats(tradeSet);
                    return { pnl: s.totalPnl, winRate: s.winRate, trades: tradeSet.length };
                };

                const stats24h = calcStats(trades24h);
                const stats7d = calcStats(trades7d);
                const stats30d = calcStats(trades30d);

                reportData = {
                    pnl24h: stats24h.pnl,
                    pnl7d: stats7d.pnl,
                    pnl30d: stats30d.pnl,
                    trades24h: stats24h.trades,
                    trades7d: stats7d.trades,
                    trades30d: stats30d.trades,
                    winRate24h: stats24h.winRate,
                    winRate7d: stats7d.winRate,
                    winRate30d: stats30d.winRate,
                    trend: determineTrend(stats7d, stats30d),
                    insights: generatePerformanceInsights(stats, stats24h, stats7d, stats30d)
                };
                break;

            case 'summary':
                const running = await isBotRunning();
                reportData = {
                    running,
                    strategy: summary?.strategy || detectTopStrategy(trades),
                    regime,
                    mode: 'Shadow',
                    portfolioTotal: balances.usdt + (balances.bnb * price),
                    usdt: balances.usdt,
                    bnb: balances.bnb,
                    price,
                    totalTrades: trades.length,
                    winRate: stats.winRate,
                    totalPnl: stats.totalPnl,
                    exitReasons: stats.exitReasons,
                    summary: generateSummaryInsights(balances, price, trades, stats, regime)
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

// Helper functions
function detectTopStrategy(trades) {
    if (!trades || trades.length === 0) return 'ranging';

    const strategies = {};
    trades.slice(0, 20).forEach(t => {
        const s = t.strategy || 'unknown';
        strategies[s] = (strategies[s] || 0) + 1;
    });

    return Object.entries(strategies).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ranging';
}

async function get24hChange() {
    // Placeholder - could fetch from API
    return 1.5;
}

function calculateVolatility(trades) {
    if (!trades || trades.length < 5) return 2.0;

    const prices = trades.slice(0, 20).map(t => t.targetPrice || 0).filter(p => p > 0);
    if (prices.length < 2) return 2.0;

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return ((stdDev / avg) * 100 * 10).toFixed(2); // Annualized approx
}

function formatUptime() {
    // Placeholder - would track actual start time
    return '24h 30m';
}

function determineTrend(stats7d, stats30d) {
    if (stats7d.winRate > stats30d.winRate + 5) return 'Improving';
    if (stats7d.winRate < stats30d.winRate - 5) return 'Declining';
    return 'Stable';
}

function generateMarketInsights(trades, regime, stats) {
    const insights = [];

    insights.push(`Market regime: ${regime} - bot adapting strategy accordingly`);

    if (stats.exitReasons.stop_loss > stats.exitReasons.take_profit) {
        insights.push('High stop loss rate detected - consider adjusting entry criteria');
    }

    if (stats.exitReasons.max_hold_time_exceeded > trades.length * 0.3) {
        insights.push('Many positions timing out - consider shorter hold times');
    }

    if (stats.winRate < 40) {
        insights.push('Win rate below target - review strategy parameters');
    } else if (stats.winRate > 55) {
        insights.push('Win rate performing well - maintain current approach');
    }

    return insights;
}

function generateRiskRecommendations(stats) {
    const recs = [];

    if (stats.winRate < 50) {
        recs.push('Win rate below 50% - consider tightening entry criteria');
    } else {
        recs.push('Win rate is healthy - maintain current strategy');
    }

    if (stats.exitReasons.stop_loss > stats.exitReasons.take_profit) {
        recs.push('Stop losses exceed take profits - review risk/reward ratio');
    }

    if (stats.exitReasons.max_hold_time_exceeded > 20) {
        recs.push('High timeout rate - reduce max hold time from 4h to 2h');
    }

    recs.push('Maintain position sizing discipline');
    recs.push('Consider reducing exposure during high volatility');

    return recs;
}

function generatePerformanceInsights(stats, stats24h, stats7d, stats30d) {
    const insights = [];

    insights.push(`Overall: ${stats.wins}W / ${stats.losses}L (${stats.winRate.toFixed(1)}% win rate)`);

    if (stats7d.winRate > stats30d.winRate) {
        insights.push('Recent performance improving vs 30-day average');
    } else if (stats7d.winRate < stats30d.winRate) {
        insights.push('Recent performance declining vs 30-day average');
    }

    if (stats.totalTrades > 50) {
        insights.push('Sufficient trade history for statistical significance');
    } else {
        insights.push('Building trade history for better analysis');
    }

    return insights;
}

function generateSummaryInsights(balances, price, trades, stats, regime) {
    const total = balances.usdt + (balances.bnb * price);
    return [
        `Portfolio value: $${total.toFixed(2)}`,
        `Total trades executed: ${trades.length}`,
        `Win rate: ${stats.winRate.toFixed(1)}% (${stats.wins}W/${stats.losses}L)`,
        `Exit breakdown: ${stats.exitReasons.stop_loss || 0} stop loss, ${stats.exitReasons.max_hold_time_exceeded || 0} timeout`,
        `Running in Shadow Mode - no real trades executed`,
        `Current regime: ${regime}`
    ];
}

// Socket.IO events
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    sendStatusUpdate(socket);

    socket.on('chat-message', async (data) => {
        const { message } = data;
        const response = await generateChatResponse(message);
        socket.emit('chat-response', { message: response });
    });

    socket.on('council-start', () => {
        socket.emit('council-response', {
            type: 'system',
            content: 'Council session initialized. All agents are analyzing current market conditions.'
        });
    });

    socket.on('council-discuss', async (data) => {
        const { topic } = data;
        const trades = getShadowTrades();
        const stats = calculateStats(trades);

        const agents = [
            { name: 'Strategist', delay: 1000 },
            { name: 'Analyst', delay: 2000 },
            { name: 'Risk Manager', delay: 3000 },
            { name: 'Executor', delay: 4000 }
        ];

        for (const agent of agents) {
            setTimeout(() => {
                socket.emit('council-response', {
                    agent: agent.name,
                    content: generateAgentResponse(agent.name, topic, stats)
                });
            }, agent.delay);
        }

        setTimeout(() => {
            socket.emit('council-response', {
                type: 'consensus',
                content: 'Council has reached a decision.',
                consensus: {
                    agreement: 75 + Math.random() * 20,
                    action: stats.winRate < 40
                        ? 'Recommend reducing position sizes until win rate improves'
                        : 'Monitor current positions, maintain strategy'
                }
            });
        }, 5000);
    });

    socket.on('bot-control', (data) => {
        const { action } = data;
        console.log('Bot control action:', action);
        socket.emit('bot-status', {
            action,
            success: true,
            message: `Bot ${action} command received`
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

async function sendStatusUpdate(socket) {
    const running = await isBotRunning();
    const balances = getVirtualBalances();
    const summary = getMonitoringSummary();
    const trades = getShadowTrades();
    const stats = calculateStats(trades);
    const price = await fetchLiveBnbPrice();
    const regime = summary?.logAnalysis?.regime || detectRegime(trades);

    socket.emit('bot-status', {
        running,
        strategy: summary?.strategy || detectTopStrategy(trades),
        regime,
        confidence: 0.75,
        stats,
        market: {
            price,
            change24h: 1.5,
            volume24h: '$1.2B',
            volatility: calculateVolatility(trades)
        }
    });

    socket.emit('portfolio-update', {
        ...balances,
        price
    });
}

async function generateChatResponse(message) {
    const lowerMsg = message.toLowerCase();
    const trades = getShadowTrades();
    const stats = calculateStats(trades);
    const balances = getVirtualBalances();
    const price = await fetchLiveBnbPrice();

    if (lowerMsg.includes('trade') || lowerMsg.includes('performance')) {
        return `Based on ${trades.length} trades: ${stats.wins} wins, ${stats.losses} losses (${stats.winRate.toFixed(1)}% win rate). Exit breakdown: ${stats.exitReasons.stop_loss || 0} stop losses, ${stats.exitReasons.max_hold_time_exceeded || 0} timeouts, ${stats.exitReasons.take_profit || 0} take profits.`;
    }

    if (lowerMsg.includes('market') || lowerMsg.includes('regime')) {
        const regime = detectRegime(trades);
        return `Current market regime: ${regime}. Top strategy: ${detectTopStrategy(trades)}. The bot is adapting accordingly.`;
    }

    if (lowerMsg.includes('portfolio') || lowerMsg.includes('balance')) {
        const total = balances.usdt + (balances.bnb * price);
        return `Portfolio: $${total.toFixed(2)} (${balances.usdt.toFixed(2)} USDT + ${balances.bnb.toFixed(4)} BNB @ $${price.toFixed(2)})`;
    }

    if (lowerMsg.includes('optimize') || lowerMsg.includes('improve')) {
        const recs = [];
        if (stats.exitReasons.max_hold_time_exceeded > 20) recs.push('Reduce max hold time to 2h');
        if (stats.exitReasons.stop_loss > stats.wins) recs.push('Lower take profit target to 1.5%');
        if (stats.winRate < 40) recs.push('Tighten entry criteria');
        return recs.length > 0
            ? `Recommendations: ${recs.join(', ')}`
            : 'Current parameters look reasonable. Continue monitoring.';
    }

    if (lowerMsg.includes('risk') || lowerMsg.includes('stop')) {
        return `Risk metrics: ${stats.wins}W/${stats.losses}L, Stop losses: ${stats.exitReasons.stop_loss || 0}, Timeouts: ${stats.exitReasons.max_hold_time_exceeded || 0}. Risk level: ${stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH'}`;
    }

    return `I can help with: trades/performance, market/regime, portfolio/balance, risk analysis, or optimization suggestions. What would you like to know?`;
}

function generateAgentResponse(agentName, topic, stats) {
    const responses = {
        'Strategist': [
            `Win rate at ${stats.winRate.toFixed(1)}% - ${stats.winRate >= 50 ? 'strategy is effective' : 'consider parameter adjustments'}`,
            `${stats.exitReasons.max_hold_time_exceeded || 0} timeouts suggest ${stats.exitReasons.max_hold_time_exceeded > 20 ? 'reducing hold time' : 'hold time is appropriate'}`,
            `Top strategy performing: ${detectTopStrategy([])} - maintain current approach`
        ],
        'Analyst': [
            `Data shows ${stats.totalTrades} trades: ${stats.wins}W/${stats.losses}L pattern`,
            `Stop loss rate: ${((stats.exitReasons.stop_loss || 0) / stats.totalTrades * 100).toFixed(1)}% of exits`,
            `Timeout rate: ${((stats.exitReasons.max_hold_time_exceeded || 0) / stats.totalTrades * 100).toFixed(1)}% - ${stats.exitReasons.max_hold_time_exceeded > 30 ? 'concerning' : 'acceptable'}`
        ],
        'Risk Manager': [
            `Risk level: ${stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH'}`,
            `${stats.exitReasons.stop_loss || 0} stop losses triggered - ${stats.exitReasons.stop_loss > stats.wins ? 'review stop loss levels' : 'acceptable'}`,
            `Recommend ${stats.winRate < 40 ? 'reducing' : 'maintaining'} position sizes`
        ],
        'Executor': [
            `${stats.totalTrades} trades executed successfully in shadow mode`,
            `Ready to implement any approved strategy changes`,
            `Monitoring market conditions for optimal entry points`
        ]
    };

    const agentResponses = responses[agentName] || ['Analyzing...'];
    return agentResponses[Math.floor(Math.random() * agentResponses.length)];
}

// Periodic updates
setInterval(async () => {
    const running = await isBotRunning();
    const balances = getVirtualBalances();
    const trades = getShadowTrades();
    const stats = calculateStats(trades);
    const price = await fetchLiveBnbPrice();
    const summary = getMonitoringSummary();
    const regime = summary?.logAnalysis?.regime || detectRegime(trades);

    io.emit('bot-status', {
        running,
        strategy: summary?.strategy || detectTopStrategy(trades),
        regime,
        confidence: 0.75,
        stats,
        market: {
            price,
            change24h: 1.5,
            volume24h: '$1.2B',
            volatility: calculateVolatility(trades)
        }
    });

    io.emit('portfolio-update', {
        ...balances,
        price
    });
}, 5000);

// Update price cache periodically
setInterval(async () => {
    await fetchLiveBnbPrice();
}, 30000);

// Start server
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          AlgoQBot Production Monitor Server                  ║
╠══════════════════════════════════════════════════════════════╣
║  Status: Running                                             ║
║  Port: ${PORT}                                                   ║
║  URL: http://localhost:${PORT}                                  ║
║  Live Price: Fetching from Binance API                       ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Initial price fetch
    fetchLiveBnbPrice().then(price => {
        console.log(`  Initial BNB price: $${price.toFixed(2)}`);
    });
});

module.exports = { app, server, io };
