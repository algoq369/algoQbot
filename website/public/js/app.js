// AlgoQBot Production Monitor - Frontend JavaScript

// State management
const state = {
    connected: false,
    botStatus: null,
    portfolio: null,
    trades: [],
    chatHistory: [],
    councilSession: null
};

// Socket.IO connection
let socket;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSocket();
    startAutoRefresh();
});

// Navigation
function initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const section = tab.dataset.section;
            showSection(section);
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

// Socket.IO
function initSocket() {
    const serverUrl = window.location.origin;
    socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    socket.on('connect', () => {
        state.connected = true;
        updateConnectionStatus(true);
        addActivityLog('Connected to server', 'success');
        fetchInitialData();
    });

    socket.on('disconnect', () => {
        state.connected = false;
        updateConnectionStatus(false);
        addActivityLog('Disconnected from server', 'error');
    });

    socket.on('bot-status', (data) => {
        state.botStatus = data;
        updateBotStatus(data);
    });

    socket.on('portfolio-update', (data) => {
        state.portfolio = data;
        updatePortfolio(data);
    });

    socket.on('trade-update', (data) => {
        addActivityLog(`Trade: ${data.action} ${data.amount} ${data.pair}`, 'trade');
        updateTrades();
    });

    socket.on('chat-response', (data) => {
        addChatMessage(data.message, 'assistant');
    });

    socket.on('council-response', (data) => {
        addCouncilEntry(data);
    });

    socket.on('report-data', (data) => {
        displayReport(data);
    });

    // Dashboard update handler
    socket.on('dashboard-update', (data) => {
        updateInstitutionalDashboard(data);
    });

    // Logs update handler
    socket.on('logs-update', (data) => {
        updateLiveLogs(data.logs);
    });
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    const dot = statusEl.querySelector('.dot');
    const text = statusEl.querySelector('span:last-child');

    if (connected) {
        dot.className = 'dot connected';
        text.textContent = 'Connected';
    } else {
        dot.className = 'dot disconnected';
        text.textContent = 'Disconnected';
    }
}

// Auto refresh - defined at end of file

// API calls
async function fetchInitialData() {
    await Promise.all([
        fetchStatus(),
        fetchPortfolio(),
        fetchTrades()
    ]);
}

async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        state.botStatus = data;
        updateBotStatus(data);
        updateLastUpdate();
    } catch (error) {
        console.error('Failed to fetch status:', error);
    }
}

async function fetchPortfolio() {
    try {
        const response = await fetch('/api/portfolio');
        const data = await response.json();
        state.portfolio = data;
        updatePortfolio(data);
    } catch (error) {
        console.error('Failed to fetch portfolio:', error);
    }
}

async function fetchTrades() {
    try {
        const response = await fetch('/api/trades');
        const data = await response.json();
        state.trades = data.trades || [];
        updateTradesTable();
    } catch (error) {
        console.error('Failed to fetch trades:', error);
    }
}

// UI Updates
function updateBotStatus(data) {
    const bigStatus = document.getElementById('big-bot-status');
    const statusDot = bigStatus.querySelector('.status-dot');
    const statusText = bigStatus.querySelector('.status-text');

    const headerDot = document.querySelector('#bot-status .dot');
    const headerText = document.querySelector('#bot-status span:last-child');

    if (data.running) {
        statusDot.className = 'status-dot running';
        statusText.textContent = 'Running';
        headerDot.className = 'dot running';
        headerText.textContent = 'Bot: Running';
    } else {
        statusDot.className = 'status-dot stopped';
        statusText.textContent = 'Stopped';
        headerDot.className = 'dot stopped';
        headerText.textContent = 'Bot: Stopped';
    }

    document.getElementById('current-strategy').textContent = data.strategy || '--';
    document.getElementById('current-regime').textContent = data.regime || '--';
    document.getElementById('current-confidence').textContent = data.confidence ? `${(data.confidence * 100).toFixed(1)}%` : '--';
    document.getElementById('bot-uptime').textContent = data.uptime || '--';

    // Update stats
    if (data.stats) {
        document.getElementById('total-trades').textContent = data.stats.totalTrades || 0;
        document.getElementById('win-rate').textContent = `${(data.stats.winRate || 0).toFixed(1)}%`;
        document.getElementById('open-positions').textContent = data.stats.openPositions || 0;
        document.getElementById('today-pnl').textContent = `$${(data.stats.todayPnl || 0).toFixed(2)}`;
    }

    // Update market data
    if (data.market) {
        document.getElementById('bnb-price').textContent = `$${(data.market.price || 0).toFixed(2)}`;
        const changeEl = document.getElementById('price-change');
        const change = data.market.change24h || 0;
        changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        changeEl.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('volume-24h').textContent = data.market.volume24h || '--';
        document.getElementById('volatility').textContent = data.market.volatility ? `${data.market.volatility.toFixed(2)}%` : '--';
    }
}

function updatePortfolio(data) {
    const usdt = data.usdt || 0;
    const bnb = data.bnb || 0;
    const price = data.price || 700;
    const bnbValue = bnb * price;
    const total = usdt + bnbValue;

    document.getElementById('total-value').textContent = total.toFixed(2);
    document.getElementById('usdt-balance').textContent = usdt.toFixed(2);
    document.getElementById('bnb-balance').textContent = bnb.toFixed(4);

    const usdtPct = total > 0 ? (usdt / total) * 100 : 50;
    const bnbPct = total > 0 ? (bnbValue / total) * 100 : 50;

    document.getElementById('usdt-bar').style.width = `${usdtPct}%`;
    document.getElementById('bnb-bar').style.width = `${bnbPct}%`;

    // Portfolio section
    document.getElementById('portfolio-total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('portfolio-available').textContent = `$${usdt.toFixed(2)}`;
    document.getElementById('portfolio-positions').textContent = `$${bnbValue.toFixed(2)}`;
}

function updateTradesTable() {
    const container = document.getElementById('trades-table');

    if (!state.trades || state.trades.length === 0) {
        container.innerHTML = '<div class="empty-state">No trades found</div>';
        return;
    }

    const recentTrades = state.trades.slice(0, 20);
    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Pair</th>
                    <th>Amount</th>
                    <th>Price</th>
                    <th>Strategy</th>
                </tr>
            </thead>
            <tbody>
    `;

    recentTrades.forEach(trade => {
        const time = new Date(trade.timestamp).toLocaleString();
        const type = trade.type || trade.action;
        const badgeClass = type === 'EXIT' || type === 'buy' ? 'sell' : 'buy';

        html += `
            <tr>
                <td>${time}</td>
                <td><span class="trade-badge ${badgeClass}">${type}</span></td>
                <td>${trade.pair}</td>
                <td>${(trade.amount || trade.sizeUSD || 0).toFixed(2)}</td>
                <td>${(trade.targetPrice || 0).toFixed(6)}</td>
                <td>${trade.strategy || '--'}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateLastUpdate() {
    document.getElementById('last-update').textContent = `Last update: ${new Date().toLocaleTimeString()}`;
}

// Activity Log
function addActivityLog(message, type = 'info') {
    const log = document.getElementById('activity-log');
    const time = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
    `;

    log.insertBefore(entry, log.firstChild);

    // Keep only last 50 entries
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
}

function clearActivityLog() {
    document.getElementById('activity-log').innerHTML = `
        <div class="log-entry">
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-message">Log cleared</span>
        </div>
    `;
}

// Chat Functions
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    addChatMessage(message, 'user');
    input.value = '';

    socket.emit('chat-message', { message });
}

function sendQuickMessage(message) {
    document.getElementById('chat-input').value = message;
    sendChatMessage();
}

function addChatMessage(content, role) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.innerHTML = `<div class="message-content"><p>${content}</p></div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Report Functions
async function generateReport(type) {
    const output = document.getElementById('report-output');
    output.innerHTML = '<div class="report-placeholder"><span class="placeholder-icon">⏳</span><p>Generating report...</p></div>';

    try {
        const response = await fetch(`/api/report/${type}`);
        const data = await response.json();
        displayReport(type, data);
    } catch (error) {
        output.innerHTML = '<div class="report-placeholder"><span class="placeholder-icon">❌</span><p>Failed to generate report</p></div>';
    }
}

function displayReport(type, data) {
    const output = document.getElementById('report-output');
    let html = '';

    switch (type) {
        case 'market':
            html = generateMarketReport(data);
            break;
        case 'risk':
            html = generateRiskReport(data);
            break;
        case 'performance':
            html = generatePerformanceReport(data);
            break;
        case 'summary':
            html = generateSummaryReport(data);
            break;
        default:
            html = '<p>Unknown report type</p>';
    }

    output.innerHTML = html;
}

function generateMarketReport(data) {
    return `
        <div class="report-header">
            <h3>📈 Market Analysis Report</h3>
            <span class="report-timestamp">Generated: ${new Date().toLocaleString()}</span>
        </div>

        <div class="metric-grid">
            <div class="metric-card">
                <span class="value">${data.regime || 'Unknown'}</span>
                <span class="label">Market Regime</span>
            </div>
            <div class="metric-card">
                <span class="value">$${(data.price || 0).toFixed(2)}</span>
                <span class="label">BNB Price</span>
            </div>
            <div class="metric-card ${(data.change24h || 0) >= 0 ? 'positive' : 'negative'}">
                <span class="value">${(data.change24h || 0).toFixed(2)}%</span>
                <span class="label">24h Change</span>
            </div>
            <div class="metric-card">
                <span class="value">${(data.volatility || 0).toFixed(2)}%</span>
                <span class="label">Volatility</span>
            </div>
        </div>

        <h4>Trading Activity</h4>
        <div class="metric-grid">
            <div class="metric-card">
                <span class="value">${data.trades24h || 0}</span>
                <span class="label">Trades (24h)</span>
            </div>
            <div class="metric-card">
                <span class="value">${data.trades7d || 0}</span>
                <span class="label">Trades (7d)</span>
            </div>
            <div class="metric-card">
                <span class="value">$${(data.avgTradeSize || 0).toFixed(0)}</span>
                <span class="label">Avg Trade Size</span>
            </div>
        </div>

        <h4>Insights</h4>
        <ul class="insights-list">
            ${(data.insights || ['No insights available']).map(i => `<li>${i}</li>`).join('')}
        </ul>
    `;
}

function generateRiskReport(data) {
    const riskLevel = data.riskLevel || 'UNKNOWN';
    const riskClass = riskLevel === 'HIGH' ? 'negative' : riskLevel === 'MEDIUM' ? 'warning' : 'positive';

    return `
        <div class="report-header">
            <h3>🛡️ Risk Metrics Report</h3>
            <span class="report-timestamp">Generated: ${new Date().toLocaleString()}</span>
        </div>

        <div class="metric-grid">
            <div class="metric-card ${riskClass}">
                <span class="value">${riskLevel}</span>
                <span class="label">Risk Level</span>
            </div>
            <div class="metric-card ${(data.winRate || 0) >= 50 ? 'positive' : 'negative'}">
                <span class="value">${(data.winRate || 0).toFixed(1)}%</span>
                <span class="label">Win Rate</span>
            </div>
            <div class="metric-card ${(data.profitFactor || 0) >= 1 ? 'positive' : 'negative'}">
                <span class="value">${(data.profitFactor || 0).toFixed(2)}</span>
                <span class="label">Profit Factor</span>
            </div>
            <div class="metric-card negative">
                <span class="value">${(data.maxDrawdown || 0).toFixed(2)}%</span>
                <span class="label">Max Drawdown</span>
            </div>
        </div>

        <h4>Win/Loss Analysis</h4>
        <div class="metric-grid">
            <div class="metric-card positive">
                <span class="value">${data.wins || 0}</span>
                <span class="label">Wins</span>
            </div>
            <div class="metric-card negative">
                <span class="value">${data.losses || 0}</span>
                <span class="label">Losses</span>
            </div>
            <div class="metric-card">
                <span class="value">${(data.riskRewardRatio || 0).toFixed(2)}</span>
                <span class="label">Risk/Reward</span>
            </div>
        </div>

        <h4>Risk Recommendations</h4>
        <ul class="insights-list">
            ${(data.recommendations || ['No recommendations available']).map(r => `<li>${r}</li>`).join('')}
        </ul>
    `;
}

function generatePerformanceReport(data) {
    return `
        <div class="report-header">
            <h3>📊 Performance Trends Report</h3>
            <span class="report-timestamp">Generated: ${new Date().toLocaleString()}</span>
        </div>

        <div class="metric-grid">
            <div class="metric-card ${(data.pnl24h || 0) >= 0 ? 'positive' : 'negative'}">
                <span class="value">$${(data.pnl24h || 0).toFixed(2)}</span>
                <span class="label">24h P&L</span>
            </div>
            <div class="metric-card ${(data.pnl7d || 0) >= 0 ? 'positive' : 'negative'}">
                <span class="value">$${(data.pnl7d || 0).toFixed(2)}</span>
                <span class="label">7d P&L</span>
            </div>
            <div class="metric-card ${(data.pnl30d || 0) >= 0 ? 'positive' : 'negative'}">
                <span class="value">$${(data.pnl30d || 0).toFixed(2)}</span>
                <span class="label">30d P&L</span>
            </div>
            <div class="metric-card">
                <span class="value">${data.trend || 'Stable'}</span>
                <span class="label">Trend Direction</span>
            </div>
        </div>

        <h4>Performance by Period</h4>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Period</th>
                    <th>Trades</th>
                    <th>Win Rate</th>
                    <th>P&L</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>24 Hours</td>
                    <td>${data.trades24h || 0}</td>
                    <td>${(data.winRate24h || 0).toFixed(1)}%</td>
                    <td class="${(data.pnl24h || 0) >= 0 ? 'positive' : 'negative'}">$${(data.pnl24h || 0).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>7 Days</td>
                    <td>${data.trades7d || 0}</td>
                    <td>${(data.winRate7d || 0).toFixed(1)}%</td>
                    <td class="${(data.pnl7d || 0) >= 0 ? 'positive' : 'negative'}">$${(data.pnl7d || 0).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>30 Days</td>
                    <td>${data.trades30d || 0}</td>
                    <td>${(data.winRate30d || 0).toFixed(1)}%</td>
                    <td class="${(data.pnl30d || 0) >= 0 ? 'positive' : 'negative'}">$${(data.pnl30d || 0).toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        <h4>Insights</h4>
        <ul class="insights-list">
            ${(data.insights || ['No insights available']).map(i => `<li>${i}</li>`).join('')}
        </ul>
    `;
}

function generateSummaryReport(data) {
    return `
        <div class="report-header">
            <h3>📋 Trading Summary Report</h3>
            <span class="report-timestamp">Generated: ${new Date().toLocaleString()}</span>
        </div>

        <div class="metric-grid">
            <div class="metric-card">
                <span class="value">${data.running ? 'Running' : 'Stopped'}</span>
                <span class="label">Bot Status</span>
            </div>
            <div class="metric-card">
                <span class="value">${data.strategy || '--'}</span>
                <span class="label">Current Strategy</span>
            </div>
            <div class="metric-card">
                <span class="value">${data.regime || '--'}</span>
                <span class="label">Market Regime</span>
            </div>
            <div class="metric-card">
                <span class="value">${data.mode || 'Shadow'}</span>
                <span class="label">Trading Mode</span>
            </div>
        </div>

        <h4>Portfolio Summary</h4>
        <div class="metric-grid">
            <div class="metric-card">
                <span class="value">$${(data.portfolioTotal || 0).toFixed(2)}</span>
                <span class="label">Total Value</span>
            </div>
            <div class="metric-card">
                <span class="value">${(data.usdt || 0).toFixed(2)}</span>
                <span class="label">USDT</span>
            </div>
            <div class="metric-card">
                <span class="value">${(data.bnb || 0).toFixed(4)}</span>
                <span class="label">BNB</span>
            </div>
        </div>

        <h4>Trading Statistics</h4>
        <div class="metric-grid">
            <div class="metric-card">
                <span class="value">${data.totalTrades || 0}</span>
                <span class="label">Total Trades</span>
            </div>
            <div class="metric-card ${(data.winRate || 0) >= 50 ? 'positive' : 'negative'}">
                <span class="value">${(data.winRate || 0).toFixed(1)}%</span>
                <span class="label">Win Rate</span>
            </div>
            <div class="metric-card ${(data.totalPnl || 0) >= 0 ? 'positive' : 'negative'}">
                <span class="value">$${(data.totalPnl || 0).toFixed(2)}</span>
                <span class="label">Total P&L</span>
            </div>
        </div>

        <h4>Summary</h4>
        <ul class="insights-list">
            ${(data.summary || ['No summary available']).map(s => `<li>${s}</li>`).join('')}
        </ul>
    `;
}

// Council Functions
function startCouncilSession() {
    const log = document.getElementById('council-log');
    log.innerHTML = `
        <div class="council-entry system">
            <span class="entry-content">New council session started. All agents ready.</span>
        </div>
    `;
    socket.emit('council-start');
}

function submitToCouncil() {
    const input = document.getElementById('council-input');
    const topic = input.value.trim();

    if (!topic) return;

    addCouncilEntry({
        type: 'user',
        content: topic
    });

    input.value = '';
    socket.emit('council-discuss', { topic });
}

function addCouncilEntry(data) {
    const log = document.getElementById('council-log');
    const entry = document.createElement('div');

    if (data.type === 'user') {
        entry.className = 'council-entry user';
        entry.innerHTML = `<span class="entry-content"><strong>You:</strong> ${data.content}</span>`;
    } else if (data.agent) {
        entry.className = 'council-entry agent';
        entry.innerHTML = `
            <span class="agent-name">${data.agent}:</span>
            <span class="entry-content">${data.content}</span>
        `;
        updateMemberStatus(data.agent, 'thinking');
        setTimeout(() => updateMemberStatus(data.agent, 'ready'), 2000);
    } else {
        entry.className = 'council-entry system';
        entry.innerHTML = `<span class="entry-content">${data.content}</span>`;
    }

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Update consensus if provided
    if (data.consensus) {
        updateConsensus(data.consensus);
    }
}

function updateMemberStatus(agentName, status) {
    const member = document.querySelector(`.member-card[data-agent="${agentName.toLowerCase()}"]`);
    if (member) {
        const statusEl = member.querySelector('.member-status');
        statusEl.className = `member-status ${status}`;
        statusEl.textContent = status === 'thinking' ? 'Thinking...' : 'Ready';
    }
}

function updateConsensus(data) {
    const fill = document.getElementById('consensus-fill');
    const value = document.getElementById('consensus-value');
    const action = document.querySelector('.consensus-action .action-value');

    fill.style.width = `${data.agreement || 0}%`;
    value.textContent = `${(data.agreement || 0).toFixed(0)}% Agreement`;
    action.textContent = data.action || 'Awaiting discussion';
}

function handleCouncilKeypress(event) {
    if (event.key === 'Enter') {
        submitToCouncil();
    }
}

// Portfolio Functions
function refreshPortfolio() {
    fetchPortfolio();
    fetchTrades();
    addActivityLog('Portfolio refreshed', 'info');
}

function exportTrades() {
    const csv = state.trades.map(t => {
        return `${t.timestamp},${t.type || t.action},${t.pair},${t.amount || t.sizeUSD},${t.targetPrice},${t.strategy}`;
    }).join('\n');

    const blob = new Blob([`Time,Type,Pair,Amount,Price,Strategy\n${csv}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Settings Functions
function pauseBot() {
    socket.emit('bot-control', { action: 'pause' });
    addActivityLog('Bot pause requested', 'info');
}

function resumeBot() {
    socket.emit('bot-control', { action: 'resume' });
    addActivityLog('Bot resume requested', 'info');
}

function emergencyStop() {
    if (confirm('Are you sure you want to emergency stop the bot? This will close all positions.')) {
        socket.emit('bot-control', { action: 'emergency-stop' });
        addActivityLog('Emergency stop activated!', 'error');
    }
}

// ============== INSTITUTIONAL DASHBOARD ==============
function updateInstitutionalDashboard(data) {
    if (!data) return;

    // [1] Bot Status
    if (data.botStatus) {
        const bigStatus = document.getElementById('big-bot-status');
        if (bigStatus) {
            const statusDot = bigStatus.querySelector('.status-dot');
            const statusText = bigStatus.querySelector('.status-text');

            if (data.botStatus.running) {
                statusDot.className = 'status-dot running';
                statusText.textContent = 'Running';
            } else {
                statusDot.className = 'status-dot stopped';
                statusText.textContent = 'Stopped';
            }
        }

        // Update header status
        const headerDot = document.querySelector('#bot-status .dot');
        const headerText = document.querySelector('#bot-status span:last-child');
        if (headerDot && headerText) {
            if (data.botStatus.running) {
                headerDot.className = 'dot running';
                headerText.textContent = `Bot: Running (PID: ${data.botStatus.pid})`;
            } else {
                headerDot.className = 'dot stopped';
                headerText.textContent = 'Bot: Stopped';
            }
        }

        // Update uptime
        const uptimeEl = document.getElementById('bot-uptime');
        if (uptimeEl) uptimeEl.textContent = data.botStatus.uptime || '--';
    }

    // [2] Portfolio
    if (data.portfolio) {
        const total = data.portfolio.totalValue || 0;
        document.getElementById('total-value').textContent = total.toFixed(2);
        document.getElementById('usdt-balance').textContent = (data.portfolio.usdt || 0).toFixed(2);
        document.getElementById('bnb-balance').textContent = (data.portfolio.bnb || 0).toFixed(4);

        // Allocation bars
        const usdtPct = total > 0 ? ((data.portfolio.usdt || 0) / total) * 100 : 50;
        const bnbPct = 100 - usdtPct;
        document.getElementById('usdt-bar').style.width = `${usdtPct}%`;
        document.getElementById('bnb-bar').style.width = `${bnbPct}%`;
    }

    // [3] Market
    if (data.market) {
        document.getElementById('bnb-price').textContent = `$${(data.market.price || 0).toFixed(2)}`;
        const changeEl = document.getElementById('price-change');
        const change = data.market.change24h || 0;
        changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        changeEl.className = `change ${change >= 0 ? 'positive' : 'negative'}`;

        // Regime
        const regimeEl = document.getElementById('current-regime');
        if (regimeEl) regimeEl.textContent = data.market.regime || '--';

        // Volatility
        const volEl = document.getElementById('volatility');
        if (volEl) {
            const vol = typeof data.market.volatility === 'number'
                ? `${data.market.volatility.toFixed(2)}%`
                : data.market.volatility || '--';
            volEl.textContent = vol;
        }
    }

    // [4] Stats
    if (data.stats) {
        document.getElementById('total-trades').textContent = data.stats.totalTrades || 0;
        document.getElementById('win-rate').textContent = `${(data.stats.winRate || 0).toFixed(1)}%`;
    }

    // Trading activity
    if (data.tradingActivity) {
        const tradesTodayEl = document.getElementById('open-positions');
        if (tradesTodayEl) tradesTodayEl.textContent = data.tradingActivity.tradesToday || 0;
    }

    // Update last update time
    updateLastUpdate();
}

// ============== LIVE LOGS ==============
function updateLiveLogs(logs) {
    if (!logs || logs.length === 0) return;

    const logContainer = document.getElementById('activity-log');
    if (!logContainer) return;

    // Clear existing logs except first entry
    logContainer.innerHTML = '';

    // Add log entries
    logs.slice(0, 50).forEach(log => {
        const entry = document.createElement('div');

        // Determine log type based on level or content
        let type = 'info';
        if (log.level === 'error') type = 'error';
        else if (log.level === 'warn') type = 'warning';
        else if (log.message && log.message.includes('Shadow Trade')) type = 'trade';
        else if (log.message && log.message.includes('✅')) type = 'success';

        entry.className = `log-entry ${type}`;

        // Format timestamp
        let timeStr = '--:--:--';
        if (log.timestamp) {
            try {
                const date = new Date(log.timestamp);
                timeStr = date.toLocaleTimeString();
            } catch (e) {
                timeStr = log.timestamp;
            }
        }

        // Format message - strip emoji for cleaner display or keep them
        const message = log.message || JSON.stringify(log);

        entry.innerHTML = `
            <span class="log-time">${timeStr}</span>
            <span class="log-level">[${log.level || 'info'}]</span>
            <span class="log-message">${message}</span>
        `;

        logContainer.appendChild(entry);
    });
}

// Request initial logs
function requestLogs() {
    if (socket && state.connected) {
        socket.emit('request-logs');
    }
}

// Fetch dashboard data
async function fetchDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        updateInstitutionalDashboard(data);
    } catch (error) {
        console.error('Failed to fetch dashboard:', error);
    }
}

// Enhanced auto-refresh
function startAutoRefresh() {
    setInterval(() => {
        if (state.connected) {
            fetchDashboard();
        }
    }, 10000); // Every 10 seconds
}
