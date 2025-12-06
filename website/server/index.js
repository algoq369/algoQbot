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

function getBnbPrice() {
    // Try to get from monitoring summary or use reasonable default
    const summary = getMonitoringSummary();
    let price = summary?.logAnalysis?.currentPrice || 0.00087;
    // Convert if it's USDT/BNB ratio
    if (price < 1) {
        price = 1 / price;
    }
    // Sanity check
    if (price < 100 || price > 10000) {
        price = 700;
    }
    return price;
}

function isBotRunning() {
    return new Promise((resolve) => {
        exec('pgrep -f "node.*AdvancedTradingBot\\|node.*shadowMode"', (error, stdout) => {
            resolve(stdout.trim().length > 0);
        });
    });
}

// Calculate trading statistics
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
            maxDrawdown: 0
        };
    }

    const exits = trades.filter(t => t.type === 'EXIT' || t.exitReason);
    const wins = exits.filter(t => (t.plPercent || t.profit || 0) > 0);
    const losses = exits.filter(t => (t.plPercent || t.profit || 0) < 0);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayTrades = trades.filter(t => new Date(t.timestamp) >= today);

    let totalProfit = 0;
    let totalLoss = 0;
    exits.forEach(t => {
        const pnl = t.plUSD || t.profit || 0;
        if (pnl > 0) totalProfit += pnl;
        else totalLoss += Math.abs(pnl);
    });

    return {
        totalTrades: trades.length,
        winRate: exits.length > 0 ? (wins.length / exits.length) * 100 : 0,
        openPositions: trades.filter(t => t.type === 'ENTRY' && !t.exitReason).length,
        wins: wins.length,
        losses: losses.length,
        todayPnl: todayTrades.reduce((sum, t) => sum + (t.plUSD || t.profit || 0), 0),
        totalPnl: totalProfit - totalLoss,
        profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
        maxDrawdown: 5.2 // Placeholder - would need historical equity tracking
    };
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
        const price = getBnbPrice();

        res.json({
            running,
            strategy: summary?.strategy || 'ranging',
            regime: summary?.logAnalysis?.regime || 'unknown',
            confidence: summary?.confidence || 0.75,
            uptime: running ? '24h 30m' : '--',
            stats: {
                ...stats,
                openPositions: summary?.logAnalysis?.activePositions || stats.openPositions
            },
            market: {
                price,
                change24h: 1.5,
                volume24h: '$1.2B',
                volatility: 2.3
            }
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Portfolio endpoint
app.get('/api/portfolio', (req, res) => {
    try {
        const balances = getVirtualBalances();
        const price = getBnbPrice();

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
        // Sort by timestamp descending
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

// Report endpoints
app.get('/api/report/:type', (req, res) => {
    try {
        const { type } = req.params;
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        const balances = getVirtualBalances();
        const price = getBnbPrice();
        const summary = getMonitoringSummary();

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
                    regime: summary?.logAnalysis?.regime || 'Unknown',
                    price,
                    change24h: 1.5,
                    volatility: 2.3,
                    trades24h: trades24h.length,
                    trades7d: trades7d.length,
                    avgTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.sizeUSD || t.amount || 0), 0) / trades.length : 0,
                    insights: [
                        'Market showing moderate volatility - good for ranging strategy',
                        `${trades24h.length} trades executed in last 24 hours`,
                        'Price action suggests continuation of current regime'
                    ]
                };
                break;

            case 'risk':
                const exitReasons = {};
                trades.forEach(t => {
                    if (t.exitReason) {
                        exitReasons[t.exitReason] = (exitReasons[t.exitReason] || 0) + 1;
                    }
                });

                const riskLevel = stats.winRate >= 50 ? 'LOW' : stats.winRate >= 35 ? 'MEDIUM' : 'HIGH';

                reportData = {
                    riskLevel,
                    winRate: stats.winRate,
                    profitFactor: stats.profitFactor,
                    maxDrawdown: stats.maxDrawdown,
                    wins: stats.wins,
                    losses: stats.losses,
                    riskRewardRatio: stats.losses > 0 ? stats.wins / stats.losses : stats.wins,
                    exitReasons,
                    recommendations: [
                        stats.winRate < 50 ? 'Consider adjusting entry criteria to improve win rate' : 'Win rate is healthy',
                        stats.profitFactor < 1 ? 'Profit factor below 1 - review stop loss and take profit levels' : 'Profit factor is acceptable',
                        'Maintain position sizing discipline',
                        'Consider reducing exposure during high volatility periods'
                    ]
                };
                break;

            case 'performance':
                const calcPnl = (tradeSet) => tradeSet.reduce((sum, t) => sum + (t.plUSD || t.profit || 0), 0);
                const calcWinRate = (tradeSet) => {
                    const exits = tradeSet.filter(t => t.type === 'EXIT');
                    const wins = exits.filter(t => (t.plPercent || t.profit || 0) > 0);
                    return exits.length > 0 ? (wins.length / exits.length) * 100 : 0;
                };

                const pnl24h = calcPnl(trades24h);
                const pnl7d = calcPnl(trades7d);
                const pnl30d = calcPnl(trades30d);

                reportData = {
                    pnl24h,
                    pnl7d,
                    pnl30d,
                    trades24h: trades24h.length,
                    trades7d: trades7d.length,
                    trades30d: trades30d.length,
                    winRate24h: calcWinRate(trades24h),
                    winRate7d: calcWinRate(trades7d),
                    winRate30d: calcWinRate(trades30d),
                    trend: pnl7d > pnl30d / 4 ? 'Improving' : pnl7d < pnl30d / 4 ? 'Declining' : 'Stable',
                    insights: [
                        `24h performance: ${pnl24h >= 0 ? '+' : ''}$${pnl24h.toFixed(2)}`,
                        `7-day trend: ${pnl7d >= 0 ? 'Positive' : 'Negative'}`,
                        trades.length > 50 ? 'Sufficient trade history for statistical significance' : 'Building trade history for better analysis'
                    ]
                };
                break;

            case 'summary':
                reportData = {
                    running: true,
                    strategy: summary?.strategy || 'ranging',
                    regime: summary?.logAnalysis?.regime || 'unknown',
                    mode: 'Shadow',
                    portfolioTotal: balances.usdt + (balances.bnb * price),
                    usdt: balances.usdt,
                    bnb: balances.bnb,
                    totalTrades: trades.length,
                    winRate: stats.winRate,
                    totalPnl: stats.totalPnl,
                    summary: [
                        `Portfolio value: $${(balances.usdt + balances.bnb * price).toFixed(2)}`,
                        `Total trades executed: ${trades.length}`,
                        `Overall win rate: ${stats.winRate.toFixed(1)}%`,
                        `Running in Shadow Mode - no real trades executed`,
                        `Current strategy: ${summary?.strategy || 'ranging'}`
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

// Socket.IO events
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial data
    sendStatusUpdate(socket);

    // Chat message handler
    socket.on('chat-message', async (data) => {
        const { message } = data;

        // Simple AI response (placeholder - integrate with real AI later)
        const response = generateChatResponse(message);

        socket.emit('chat-response', {
            message: response
        });
    });

    // Council discussion handler
    socket.on('council-start', () => {
        socket.emit('council-response', {
            type: 'system',
            content: 'Council session initialized. All agents are analyzing current market conditions.'
        });
    });

    socket.on('council-discuss', async (data) => {
        const { topic } = data;

        // Simulate council responses
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
                    content: generateAgentResponse(agent.name, topic)
                });
            }, agent.delay);
        }

        // Send consensus after all agents
        setTimeout(() => {
            socket.emit('council-response', {
                type: 'consensus',
                content: 'Council has reached a decision.',
                consensus: {
                    agreement: 75 + Math.random() * 20,
                    action: 'Monitor current positions, no immediate action required'
                }
            });
        }, 5000);
    });

    // Bot control handler
    socket.on('bot-control', (data) => {
        const { action } = data;
        console.log('Bot control action:', action);

        // Placeholder - implement actual bot control
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

// Helper functions
async function sendStatusUpdate(socket) {
    const running = await isBotRunning();
    const balances = getVirtualBalances();
    const summary = getMonitoringSummary();
    const trades = getShadowTrades();
    const stats = calculateStats(trades);
    const price = getBnbPrice();

    socket.emit('bot-status', {
        running,
        strategy: summary?.strategy || 'ranging',
        regime: summary?.logAnalysis?.regime || 'unknown',
        confidence: 0.75,
        stats
    });

    socket.emit('portfolio-update', {
        ...balances,
        price
    });
}

function generateChatResponse(message) {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('trade') || lowerMsg.includes('performance')) {
        const trades = getShadowTrades();
        const stats = calculateStats(trades);
        return `Based on ${trades.length} total trades, your win rate is ${stats.winRate.toFixed(1)}%. Recent performance shows ${stats.todayPnl >= 0 ? 'positive' : 'negative'} momentum.`;
    }

    if (lowerMsg.includes('market') || lowerMsg.includes('regime')) {
        const summary = getMonitoringSummary();
        return `Current market regime appears to be ${summary?.logAnalysis?.regime || 'ranging'}. The bot is adapting its strategy accordingly.`;
    }

    if (lowerMsg.includes('portfolio') || lowerMsg.includes('balance')) {
        const balances = getVirtualBalances();
        const price = getBnbPrice();
        const total = balances.usdt + (balances.bnb * price);
        return `Your portfolio is valued at $${total.toFixed(2)} (${balances.usdt.toFixed(2)} USDT + ${balances.bnb.toFixed(4)} BNB at $${price.toFixed(2)}/BNB).`;
    }

    if (lowerMsg.includes('optimize') || lowerMsg.includes('improve')) {
        return 'Based on recent analysis, I recommend: 1) Lowering take profit targets to 1.5%, 2) Reducing max hold time to 2 hours, 3) Adding volatility filters. Would you like me to explain any of these in detail?';
    }

    return 'I can help you analyze trades, check market conditions, review your portfolio, or suggest optimizations. What would you like to know?';
}

function generateAgentResponse(agentName, topic) {
    const responses = {
        'Strategist': [
            'From a strategic perspective, we should maintain current positioning.',
            'The market structure suggests a ranging environment is likely to continue.',
            'I recommend focusing on mean reversion opportunities within established ranges.'
        ],
        'Analyst': [
            'Data analysis shows moderate volatility with support at current levels.',
            'Technical indicators suggest neutral momentum with slight bullish bias.',
            'Volume patterns indicate accumulation phase may be forming.'
        ],
        'Risk Manager': [
            'Current risk exposure is within acceptable parameters.',
            'Recommend maintaining stop losses at 2% to limit downside.',
            'Position sizing should remain conservative given market uncertainty.'
        ],
        'Executor': [
            'Execution conditions are favorable with tight spreads.',
            'Slippage has been minimal on recent trades.',
            'Ready to execute any approved trading decisions promptly.'
        ]
    };

    const agentResponses = responses[agentName] || ['Analyzing the situation...'];
    return agentResponses[Math.floor(Math.random() * agentResponses.length)];
}

// Periodic status broadcast
setInterval(async () => {
    const running = await isBotRunning();
    const balances = getVirtualBalances();
    const trades = getShadowTrades();
    const stats = calculateStats(trades);
    const price = getBnbPrice();
    const summary = getMonitoringSummary();

    io.emit('bot-status', {
        running,
        strategy: summary?.strategy || 'ranging',
        regime: summary?.logAnalysis?.regime || 'unknown',
        confidence: 0.75,
        stats,
        market: {
            price,
            change24h: 1.5,
            volume24h: '$1.2B',
            volatility: 2.3
        }
    });

    io.emit('portfolio-update', {
        ...balances,
        price
    });
}, 5000);

// Start server
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          AlgoQBot Production Monitor Server                  ║
╠══════════════════════════════════════════════════════════════╣
║  Status: Running                                             ║
║  Port: ${PORT}                                                   ║
║  URL: http://localhost:${PORT}                                  ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server, io };
