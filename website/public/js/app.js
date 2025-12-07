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
        // Pass agent info for enhanced display
        addChatMessage(data.message, 'assistant', {
            agent: data.agent,
            mode: data.mode,
            isMultiAgent: data.isMultiAgent
        });
    });

    socket.on('council-response', (data) => {
        addCouncilEntry(data);
    });

    // Council real-time events
    socket.on('council-session-started', (data) => {
        councilState.sessionId = data.sessionId;
        councilState.active = true;
        updateCouncilControls('running');
        addCouncilEntry({ type: 'system', content: `Session started: ${data.topic || 'Market Analysis'}` });
        // Initialize and start progression tracking
        initRoundProgression();
        startSessionTimer();
    });

    socket.on('council-round-started', (data) => {
        councilState.currentRound = data.round;
        const roundInfo = document.getElementById('council-round-info');
        if (roundInfo) roundInfo.textContent = `Round ${data.round}/${data.maxRounds}`;
        addCouncilEntry({ type: 'round', round: data.round, maxRounds: data.maxRounds });
        // Update progression panel
        updateRoundProgression(data.round, data.maxRounds);
    });

    socket.on('council-agent-spoke', (data) => {
        addCouncilEntry({
            agent: data.agent,
            content: data.discussion?.content || data.discussion?.summary || 'Analyzing...'
        });
        // Mark agent as having spoken in progression
        markAgentSpoke(data.agent, councilState.currentRound);
    });

    socket.on('council-voting-started', (data) => {
        addCouncilEntry({ type: 'voting', content: 'Voting round started...' });
    });

    socket.on('council-agent-voted', (data) => {
        updateAgentVote(data.agent, data.vote, data.confidence);
        // Track vote in progression
        markVoteCast();
    });

    socket.on('council-voting-complete', (data) => {
        updateVotingTallies(data.tallies);
        addCouncilEntry({
            type: 'voting',
            content: `Voting complete: ${data.leadingDecision} leads with ${data.consensusStrength}% strength`
        });
    });

    socket.on('council-consensus-reached', (data) => {
        updateCouncilControls('stopped');
        updateConsensus(data.consensus);
        addCouncilEntry({
            type: 'consensus',
            content: `Consensus reached! Decision: ${data.consensus.decision} (${data.consensus.strength?.toFixed(0)}% agreement)`,
            consensus: data.consensus
        });
        // Complete progression
        completeRound(councilState.currentRound);
        stopSessionTimer();
    });

    socket.on('council-consensus-forced', (data) => {
        updateCouncilControls('stopped');
        updateConsensus(data.consensus);
        addCouncilEntry({
            type: 'consensus',
            content: `Max rounds reached. Final decision: ${data.consensus.decision} (${data.consensus.strength?.toFixed(0)}% support)`,
            consensus: data.consensus
        });
        // Complete all rounds and stop
        for (let i = 1; i <= 5; i++) completeRound(i);
        stopSessionTimer();
    });

    socket.on('council-no-consensus', (data) => {
        addCouncilEntry({
            type: 'system',
            content: `No consensus in round ${data.round}. Continuing discussion...`
        });
    });

    socket.on('council-session-paused', (data) => {
        updateCouncilControls('paused');
        addCouncilEntry({ type: 'system', content: 'Session paused by user.' });
    });

    socket.on('council-session-resumed', (data) => {
        updateCouncilControls('running');
        addCouncilEntry({ type: 'system', content: 'Session resumed.' });
    });

    socket.on('council-session-stopped', (data) => {
        updateCouncilControls('stopped');
        addCouncilEntry({ type: 'system', content: 'Session stopped by user.' });
        // Stop progression timer
        stopSessionTimer();
    });

    socket.on('council-user-intervention', (data) => {
        addCouncilEntry({ type: 'system', content: `Guidance noted: "${data.intervention?.message}"` });
    });

    socket.on('council-addressing-intervention', (data) => {
        addCouncilEntry({ type: 'system', content: 'Council addressing your guidance...' });
    });

    socket.on('council-status', (data) => {
        if (data.hasActiveSession) {
            updateCouncilControls('running');
        } else {
            updateCouncilControls('idle');
        }
    });

    socket.on('council-history', (data) => {
        // History data received - handled in showCouncilHistory
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

    // Bot logs update handler
    socket.on('bot-logs-update', (data) => {
        updateBotLogs(data.logs);
    });

    // Request initial bot logs on connect
    socket.on('connect', () => {
        setTimeout(() => {
            socket.emit('request-bot-logs');
        }, 1000);
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

// Chat Functions - Enhanced with agent selection
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    addChatMessage(message, 'user');
    input.value = '';

    // Determine which agents to use based on chat mode
    let agents = [];
    if (chatState.mode === 'single') {
        agents = [chatState.selectedAgent];
    } else if (chatState.mode === 'group') {
        agents = chatState.selectedAgents;
    } else if (chatState.mode === 'all') {
        agents = Object.keys(AGENT_INFO);
    }

    // Send enhanced message with agent selection and discussion mode
    socket.emit('chat-message', {
        message,
        agents: agents,
        discussionMode: chatState.discussionMode,
        chatMode: chatState.mode
    });
}

function sendQuickMessage(message) {
    document.getElementById('chat-input').value = message;
    sendChatMessage();
}

function addChatMessage(content, role, agentInfo = null) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    // Support markdown-style formatting
    const formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/• /g, '&bull; ');

    // Add agent badge for assistant messages
    let agentBadge = '';
    if (role === 'assistant' && agentInfo) {
        const agent = AGENT_INFO[agentInfo.agent] || {};
        agentBadge = `<div class="message-agent-badge">
            <span class="agent-emoji">${agent.emoji || '🤖'}</span>
            <span class="agent-label">${agent.name || agentInfo.agent}</span>
        </div>`;
    }

    msg.innerHTML = `${agentBadge}<div class="message-content">${formatted}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Trading Ideas Function
async function getTradingIdeas() {
    addChatMessage('💡 Generating trading ideas based on current market conditions...', 'user');

    try {
        const response = await fetch('/api/trading-ideas');
        const data = await response.json();

        if (data.ideas && data.ideas.length > 0) {
            let content = `🎯 **AI Trading Ideas** (Generated: ${new Date().toLocaleTimeString()})\n\n`;
            content += `**Market Context:** BNB $${data.market.price.toFixed(2)} | RSI: ${data.market.rsi.toFixed(1)} | ${data.market.trend} | F&G: ${data.market.fearGreed}\n\n`;
            content += `---\n\n`;

            data.ideas.forEach((idea, i) => {
                content += `**${i + 1}. ${idea.strategy}** [${idea.type}]\n`;
                content += `• Confidence: ${idea.confidence}%\n`;
                content += `• ${idea.reasoning}\n`;
                if (idea.entry) content += `• Entry: $${idea.entry.toFixed(2)}\n`;
                if (idea.target) content += `• Target: $${idea.target.toFixed(2)}\n`;
                if (idea.stopLoss) content += `• Stop: $${idea.stopLoss.toFixed(2)}\n`;
                if (idea.riskReward) content += `• Risk/Reward: ${idea.riskReward}\n`;
                if (idea.timeframe) content += `• Timeframe: ${idea.timeframe}\n`;
                if (idea.recommendations) {
                    content += `• Recommendations:\n`;
                    idea.recommendations.forEach(r => content += `  - ${r}\n`);
                }
                content += '\n';
            });

            addChatMessage(content, 'assistant');
        } else {
            addChatMessage('📊 **No Clear Opportunities**\n\nCurrent market conditions don\'t present strong trading signals. This is normal - patience is key to profitable trading. Continue monitoring and wait for better setups.', 'assistant');
        }
    } catch (error) {
        console.error('Failed to get trading ideas:', error);
        addChatMessage('❌ Failed to generate trading ideas. Please try again.', 'assistant');
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

// ============== COUNCIL FUNCTIONS ==============

// Council state
let councilState = {
    active: false,
    paused: false,
    currentRound: 0,
    maxRounds: 5,
    sessionId: null,
    discussionMode: 'analyse',
    lastSpeaker: null,
    discussionHistory: []
};

// Discussion mode descriptions
const DISCUSSION_MODES = {
    analyse: {
        name: 'Analyse',
        description: 'Deep data-driven market analysis',
        prompt: 'Provide detailed quantitative analysis with specific data points, metrics, and evidence-based conclusions.'
    },
    brainstorm: {
        name: 'Brainstorm',
        description: 'Creative strategy exploration',
        prompt: 'Think creatively and propose innovative strategies. Build on others\' ideas and suggest unconventional approaches.'
    },
    debate: {
        name: 'Debate',
        description: 'Challenge and counter-argue',
        prompt: 'Challenge the previous speaker\'s position. Present counter-arguments and alternative viewpoints. Be critical but constructive.'
    }
};

// Set discussion mode
function setDiscussionMode(mode) {
    councilState.discussionMode = mode;

    // Update UI
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });

    // Update mode indicator
    const modeIndicator = document.getElementById('council-mode-indicator');
    if (modeIndicator) {
        const modeInfo = DISCUSSION_MODES[mode];
        modeIndicator.textContent = `Mode: ${modeInfo.name}`;
    }

    // If session is active, notify the server
    if (councilState.active) {
        socket.emit('council-set-mode', { mode });
        addCouncilEntry({
            type: 'system',
            content: `Discussion mode changed to: ${DISCUSSION_MODES[mode].name} - ${DISCUSSION_MODES[mode].description}`
        });
    }
}

// Start council session
function startCouncilSession() {
    const topicInput = document.getElementById('council-topic');
    const topic = topicInput ? topicInput.value.trim() : '';

    const log = document.getElementById('council-log');
    const modeInfo = DISCUSSION_MODES[councilState.discussionMode];

    log.innerHTML = `
        <div class="council-entry system">
            <span class="entry-content">Initializing council session...</span>
        </div>
        <div class="council-entry system">
            <span class="entry-content">Mode: ${modeInfo.name} - ${modeInfo.description}</span>
        </div>
        <div class="council-entry system">
            <span class="entry-content">Agents preparing for discussion. They will exchange ideas and respond to each other.</span>
        </div>
    `;

    // Reset voting display
    resetVotingDisplay();
    councilState.discussionHistory = [];
    councilState.lastSpeaker = null;

    socket.emit('council-start', {
        topic: topic || 'Market Analysis & Trading Strategy',
        mode: councilState.discussionMode
    });

    // Update UI
    updateCouncilControls('running');
}

function startCouncilWithTopic() {
    startCouncilSession();
}

function pauseCouncil() {
    socket.emit('council-pause');
    updateCouncilControls('paused');
}

function resumeCouncil() {
    socket.emit('council-resume');
    updateCouncilControls('running');
}

function stopCouncil() {
    socket.emit('council-stop');
    updateCouncilControls('stopped');
}

function restartCouncil() {
    const topicInput = document.getElementById('council-topic');
    const topic = topicInput ? topicInput.value.trim() : '';

    socket.emit('council-restart', { topic: topic || 'Market Analysis & Trading Strategy' });
    updateCouncilControls('running');

    const log = document.getElementById('council-log');
    log.innerHTML = `
        <div class="council-entry system">
            <span class="entry-content">Council session restarted. Fresh analysis beginning...</span>
        </div>
    `;
    resetVotingDisplay();
}

function sendCouncilGuidance() {
    const input = document.getElementById('council-input');
    const message = input.value.trim();

    if (!message) return;

    addCouncilEntry({
        type: 'user-guidance',
        content: `📣 Your guidance: "${message}"`
    });

    socket.emit('council-intervene', { message });
    input.value = '';
}

function updateCouncilControls(state) {
    const btnStart = document.getElementById('btn-council-start');
    const btnPause = document.getElementById('btn-council-pause');
    const btnResume = document.getElementById('btn-council-resume');
    const btnStop = document.getElementById('btn-council-stop');
    const btnRestart = document.getElementById('btn-council-restart');
    const statusIndicator = document.getElementById('council-status-indicator');
    const statusText = document.getElementById('council-status-text');

    switch (state) {
        case 'running':
            councilState.active = true;
            councilState.paused = false;
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnResume.disabled = true;
            btnStop.disabled = false;
            btnRestart.disabled = false;
            statusIndicator.className = 'status-indicator active';
            statusIndicator.style.color = '#4caf50';
            statusText.textContent = 'In Session';
            break;
        case 'paused':
            councilState.paused = true;
            btnStart.disabled = true;
            btnPause.disabled = true;
            btnResume.disabled = false;
            btnStop.disabled = false;
            btnRestart.disabled = false;
            statusIndicator.style.color = '#ff9800';
            statusText.textContent = 'Paused';
            break;
        case 'stopped':
        case 'idle':
            councilState.active = false;
            councilState.paused = false;
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnResume.disabled = true;
            btnStop.disabled = true;
            btnRestart.disabled = true;
            statusIndicator.style.color = '#888';
            statusText.textContent = 'Idle';
            break;
    }
}

function resetVotingDisplay() {
    ['long', 'short', 'hold', 'reduce'].forEach(vote => {
        const fill = document.getElementById(`tally-fill-${vote}`);
        const score = document.getElementById(`tally-score-${vote}`);
        if (fill) fill.style.width = '0%';
        if (score) score.textContent = '0';
    });

    const consensusFill = document.getElementById('consensus-fill');
    const consensusValue = document.getElementById('consensus-value');
    const consensusDecision = document.getElementById('consensus-decision');
    const actionPlan = document.getElementById('action-plan');

    if (consensusFill) consensusFill.style.width = '0%';
    if (consensusValue) consensusValue.textContent = '--';
    if (consensusDecision) consensusDecision.textContent = 'Awaiting council';
    if (actionPlan) actionPlan.style.display = 'none';

    // Reset all member votes
    ['AlgoQ', 'Strategist', 'Analyst', 'RiskManager', 'Sentiment'].forEach(agent => {
        const voteEl = document.getElementById(`vote-${agent}`);
        if (voteEl) voteEl.textContent = '';
    });
}

function addCouncilEntry(data) {
    const log = document.getElementById('council-log');
    const entry = document.createElement('div');
    const time = new Date().toLocaleTimeString();

    if (data.type === 'user' || data.type === 'user-guidance') {
        entry.className = 'council-entry user';
        entry.innerHTML = `
            <span class="entry-time">${time}</span>
            <span class="entry-content">${data.content}</span>
        `;
    } else if (data.agent) {
        // Check if this is a response to another agent
        const isResponse = data.respondingTo && councilState.lastSpeaker;
        entry.className = `council-entry agent${isResponse ? ' response-to' : ''}`;

        const formatted = (data.content || '')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/• /g, '&bull; ')
            .replace(/→/g, '&rarr;');

        // Build response indicator if responding to someone
        let responseIndicator = '';
        if (data.respondingTo) {
            responseIndicator = `<span class="response-indicator">Responding to ${data.respondingTo}</span>`;
        }

        entry.innerHTML = `
            ${responseIndicator}
            <span class="entry-time">${time}</span>
            <span class="agent-badge">${getAgentEmoji(data.agent)} ${data.agent}</span>
            <span class="entry-content">${formatted}</span>
        `;

        // Track discussion history
        councilState.discussionHistory.push({
            agent: data.agent,
            content: data.content,
            respondingTo: data.respondingTo
        });
        councilState.lastSpeaker = data.agent;

        updateMemberStatus(data.agent, 'speaking');
        setTimeout(() => updateMemberStatus(data.agent, 'ready'), 3000);
    } else if (data.type === 'round') {
        entry.className = 'council-entry round-marker';
        entry.innerHTML = `
            <span class="round-badge">Round ${data.round} of ${data.maxRounds}</span>
        `;
        councilState.currentRound = data.round;
    } else if (data.type === 'voting') {
        entry.className = 'council-entry voting';
        entry.innerHTML = `
            <span class="entry-time">${time}</span>
            <span class="entry-content">🗳️ ${data.content}</span>
        `;
    } else if (data.type === 'consensus') {
        entry.className = 'council-entry consensus';
        entry.innerHTML = `
            <span class="entry-time">${time}</span>
            <span class="entry-content">✅ ${data.content}</span>
        `;
    } else if (data.type === 'exchange') {
        // Agent exchange/debate entry
        entry.className = 'council-entry exchange';
        entry.innerHTML = `
            <span class="entry-time">${time}</span>
            <span class="entry-content">💬 ${data.content}</span>
        `;
    } else {
        entry.className = 'council-entry system';
        entry.innerHTML = `
            <span class="entry-time">${time}</span>
            <span class="entry-content">${data.content}</span>
        `;
    }

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Update consensus if provided
    if (data.consensus) {
        updateConsensus(data.consensus);
    }
}

function getAgentEmoji(agent) {
    const emojis = {
        'AlgoQ': '🤖',
        'Strategist': '🎯',
        'Analyst': '📊',
        'RiskManager': '🛡️',
        'Sentiment': '📡'
    };
    return emojis[agent] || '💬';
}

function updateMemberStatus(agentName, status) {
    const member = document.getElementById(`member-${agentName}`);
    if (member) {
        const statusEl = member.querySelector('.member-status');
        statusEl.className = `member-status ${status}`;

        const statusTexts = {
            'ready': 'Ready',
            'speaking': 'Speaking...',
            'thinking': 'Thinking...',
            'voting': 'Voting...'
        };
        statusEl.textContent = statusTexts[status] || status;
    }
}

function updateVotingTallies(tallies) {
    if (!tallies) return;

    const total = Object.values(tallies).reduce((a, b) => a + b, 0) || 1;

    Object.entries(tallies).forEach(([vote, score]) => {
        const voteKey = vote.toLowerCase();
        const fill = document.getElementById(`tally-fill-${voteKey}`);
        const scoreEl = document.getElementById(`tally-score-${voteKey}`);

        if (fill) {
            const pct = (score / total) * 100;
            fill.style.width = `${pct}%`;
        }
        if (scoreEl) {
            scoreEl.textContent = score.toFixed(1);
        }
    });
}

function updateAgentVote(agent, vote, confidence) {
    const voteEl = document.getElementById(`vote-${agent}`);
    if (voteEl) {
        const colors = {
            'LONG': '#4caf50',
            'SHORT': '#f44336',
            'HOLD': '#ff9800',
            'REDUCE': '#9c27b0'
        };
        voteEl.innerHTML = `<span style="color: ${colors[vote] || '#888'}">${vote} (${(confidence * 100).toFixed(0)}%)</span>`;
    }
    updateMemberStatus(agent, 'voting');
}

function updateConsensus(data) {
    const fill = document.getElementById('consensus-fill');
    const value = document.getElementById('consensus-value');
    const decision = document.getElementById('consensus-decision');
    const actionPlan = document.getElementById('action-plan');
    const actionSteps = document.getElementById('action-plan-steps');

    if (fill) fill.style.width = `${data.strength || data.agreement || 0}%`;
    if (value) value.textContent = `${(data.strength || data.agreement || 0).toFixed(0)}% Agreement`;
    if (decision) decision.textContent = data.decision || data.action || 'Awaiting council';

    // Show action plan if available
    if (data.actionPlan && actionPlan && actionSteps) {
        actionPlan.style.display = 'block';
        actionSteps.innerHTML = data.actionPlan.steps
            ? data.actionPlan.steps.map(s => `<li>${s}</li>`).join('')
            : '';
    }
}

function handleCouncilKeypress(event) {
    if (event.key === 'Enter') {
        sendCouncilGuidance();
    }
}

function handleTopicKeypress(event) {
    if (event.key === 'Enter') {
        startCouncilWithTopic();
    }
}

// Council history functions
async function showCouncilHistory() {
    const modal = document.getElementById('council-history-modal');
    modal.classList.remove('hidden');

    try {
        const response = await fetch('/api/council/history?limit=20');
        const data = await response.json();

        // Update stats
        document.getElementById('history-total').textContent = data.totalSessions || 0;
        document.getElementById('history-consensus').textContent = data.successfulConsensus || 0;
        document.getElementById('history-rate').textContent = `${data.successRate || 0}%`;

        // Populate list
        const list = document.getElementById('history-list');
        if (data.sessions && data.sessions.length > 0) {
            list.innerHTML = data.sessions.map(session => `
                <div class="history-item" onclick="viewSessionDetails('${session.sessionId}')">
                    <div class="history-item-header">
                        <span class="session-topic">${session.topic || 'Market Analysis'}</span>
                        <span class="session-date">${new Date(session.startTime).toLocaleString()}</span>
                    </div>
                    <div class="history-item-body">
                        <span class="session-rounds">Rounds: ${session.currentRound}/${session.maxRounds}</span>
                        <span class="session-decision ${session.consensus ? 'has-consensus' : ''}">
                            ${session.consensus ? `Decision: ${session.consensus.decision}` : 'No consensus'}
                        </span>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="empty">No council sessions yet.</p>';
        }
    } catch (error) {
        console.error('Failed to load history:', error);
        document.getElementById('history-list').innerHTML = '<p class="error">Failed to load history</p>';
    }
}

function hideCouncilHistory() {
    const modal = document.getElementById('council-history-modal');
    modal.classList.add('hidden');
}

async function viewSessionDetails(sessionId) {
    try {
        const response = await fetch(`/api/council/session/${sessionId}`);
        const session = await response.json();

        // Show session details in the history log
        const historyLog = document.getElementById('council-history-log');
        historyLog.innerHTML = '';

        // Add discussions
        if (session.discussions) {
            session.discussions.forEach(round => {
                const roundEntry = document.createElement('div');
                roundEntry.className = 'council-entry round-marker';
                roundEntry.innerHTML = `<span class="round-badge">Round ${round.round}</span>`;
                historyLog.appendChild(roundEntry);

                round.discussions.forEach(d => {
                    const entry = document.createElement('div');
                    entry.className = 'council-entry agent';
                    entry.innerHTML = `
                        <span class="agent-badge">${getAgentEmoji(d.agent)} ${d.agent}</span>
                        <span class="entry-content">${d.summary || d.content}</span>
                    `;
                    historyLog.appendChild(entry);
                });
            });
        }

        // Add consensus
        if (session.consensus) {
            const consensusEntry = document.createElement('div');
            consensusEntry.className = 'council-entry consensus';
            consensusEntry.innerHTML = `
                <span class="entry-content">✅ Consensus: ${session.consensus.decision} (${session.consensus.strength?.toFixed(0)}%)</span>
            `;
            historyLog.appendChild(consensusEntry);
        }

        // Switch to history tab
        showDiscussionTab('history');
    } catch (error) {
        console.error('Failed to load session details:', error);
    }
}

function showDiscussionTab(tab) {
    const liveLog = document.getElementById('council-log');
    const historyLog = document.getElementById('council-history-log');
    const tabs = document.querySelectorAll('.discussion-tabs .tab-btn');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'live') {
        liveLog.classList.remove('hidden');
        historyLog.classList.add('hidden');
        tabs[0].classList.add('active');
    } else {
        liveLog.classList.add('hidden');
        historyLog.classList.remove('hidden');
        tabs[1].classList.add('active');
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
            const statusTextEl = document.getElementById('bot-status-text');

            if (data.botStatus.running) {
                if (statusDot) statusDot.className = 'status-dot running';
                if (statusTextEl) statusTextEl.textContent = 'Running';
            } else {
                if (statusDot) statusDot.className = 'status-dot stopped';
                if (statusTextEl) statusTextEl.textContent = 'Stopped';
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

        // Update PID, uptime, CPU, memory
        const pidEl = document.getElementById('bot-pid');
        const uptimeEl = document.getElementById('bot-uptime');
        const cpuEl = document.getElementById('bot-cpu');
        const memEl = document.getElementById('bot-memory');

        if (pidEl) pidEl.textContent = data.botStatus.pid || '--';
        if (uptimeEl) uptimeEl.textContent = data.botStatus.uptime || '--';
        if (cpuEl) cpuEl.textContent = data.botStatus.cpu || '0';
        if (memEl) memEl.textContent = data.botStatus.memory || '0';
    }

    // [2] Portfolio
    if (data.portfolio) {
        const total = data.portfolio.totalValue || 0;
        const totalEl = document.getElementById('total-value');
        const usdtEl = document.getElementById('usdt-balance');
        const bnbEl = document.getElementById('bnb-balance');
        const bnbPctEl = document.getElementById('bnb-percent');
        const allocStatusEl = document.getElementById('allocation-status');

        if (totalEl) totalEl.textContent = total.toFixed(2);
        if (usdtEl) usdtEl.textContent = (data.portfolio.usdt || 0).toFixed(2);
        if (bnbEl) bnbEl.textContent = (data.portfolio.bnb || 0).toFixed(4);

        // Allocation bars
        const bnbPct = data.portfolio.bnbPercent || 0;
        const usdtPct = 100 - bnbPct;

        const usdtBar = document.getElementById('usdt-bar');
        const bnbBar = document.getElementById('bnb-bar');

        if (usdtBar) usdtBar.style.width = `${usdtPct}%`;
        if (bnbBar) bnbBar.style.width = `${bnbPct}%`;
        if (bnbPctEl) bnbPctEl.textContent = bnbPct.toFixed(1);

        // Allocation status
        if (allocStatusEl) {
            const inRange = data.portfolio.inRange;
            allocStatusEl.textContent = inRange ? 'In target range' : 'Out of target range';
            allocStatusEl.style.color = inRange ? 'var(--accent-green)' : 'var(--accent-orange)';
        }
    }

    // [3] Market
    if (data.market) {
        const priceEl = document.getElementById('bnb-price');
        const changeEl = document.getElementById('price-change');
        const btcEl = document.getElementById('btc-price');
        const volEl = document.getElementById('volatility');
        const regimeEl = document.getElementById('current-regime');

        if (priceEl) priceEl.textContent = `$${(data.market.price || 0).toFixed(2)}`;

        if (changeEl) {
            const change = data.market.change24h || 0;
            changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            changeEl.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        }

        if (btcEl) btcEl.textContent = `$${(data.market.btcPrice || 0).toFixed(0)}`;

        if (volEl) {
            const vol = typeof data.market.volatility === 'number'
                ? `${data.market.volatility.toFixed(2)}%`
                : data.market.volatility || '--';
            volEl.textContent = vol;
        }

        if (regimeEl) {
            const regime = data.market.regime || '--';
            regimeEl.textContent = regime;
            regimeEl.className = 'inst-value regime-badge';
            if (regime.toLowerCase().includes('high')) regimeEl.classList.add('high');
            else if (regime.toLowerCase().includes('medium')) regimeEl.classList.add('medium');
            else if (regime.toLowerCase().includes('low')) regimeEl.classList.add('low');
        }
    }

    // [4] Institutional Indicators
    if (data.institutional) {
        const inst = data.institutional;

        // Order Flow
        updateIndicator('orderflow', inst.orderFlow?.score, inst.orderFlow?.delta, 'orderflow-delta');
        // Volume Profile
        updateIndicator('volumeprofile', inst.volumeProfile?.score, inst.volumeProfile?.poc, 'volumeprofile-poc');
        // Liquidity
        updateIndicator('liquidity', inst.liquidity?.score, inst.liquidity?.ratio, 'liquidity-ratio');
        // VWAP
        updateIndicator('vwap', inst.vwap?.score);
        // ATR
        updateIndicator('atr', inst.atr?.score);
        // Regime
        updateIndicator('regime', inst.regime?.score);

        // Final Confidence
        const confEl = document.getElementById('final-confidence');
        const confFill = document.getElementById('conf-fill');
        const confTimestamp = document.getElementById('conf-timestamp');

        if (confEl) {
            const conf = inst.finalConfidence || 0;
            const confStr = typeof conf === 'string' ? conf : `${conf.toFixed(1)}%`;
            confEl.textContent = confStr;

            const confNum = parseFloat(conf) || 0;
            if (confFill) confFill.style.width = `${Math.min(confNum, 100)}%`;
        }

        if (confTimestamp && inst.timestamp) {
            const date = new Date(inst.timestamp);
            confTimestamp.textContent = `Last updated: ${date.toLocaleTimeString()}`;
        }
    }

    // [5] Trading Activity
    if (data.tradingActivity) {
        const tradesToday = document.getElementById('trades-today');
        const lastDecision = document.getElementById('last-decision');

        if (tradesToday) tradesToday.textContent = data.tradingActivity.tradesToday || 0;

        if (lastDecision && data.tradingActivity.lastDecision) {
            const decision = data.tradingActivity.lastDecision;
            let action = 'HOLD';
            if (decision.message) {
                if (decision.message.includes('"action":"buy"')) action = 'BUY';
                else if (decision.message.includes('"action":"sell"')) action = 'SELL';
            }
            lastDecision.textContent = action;
            lastDecision.className = `inst-value decision-badge ${action.toLowerCase()}`;
        }
    }

    // [6] Last 3 Trades
    if (data.last3Trades) {
        const tradesContainer = document.getElementById('last-3-trades');
        if (tradesContainer) {
            if (data.last3Trades.length > 0) {
                tradesContainer.innerHTML = data.last3Trades.map(trade => {
                    const action = trade.action || 'hold';
                    const msg = trade.message?.replace('Shadow Trade: ', '') || '';
                    return `<div class="trade-item ${action}">${msg}</div>`;
                }).join('');
            } else {
                tradesContainer.innerHTML = '<div class="trade-item placeholder">No trades yet</div>';
            }
        }
    }

    // [7] Active Positions
    if (data.positions) {
        const totalPos = document.getElementById('total-positions');
        const virtualPos = document.getElementById('virtual-positions');
        const livePos = document.getElementById('live-positions');

        const posCount = data.positions.active || data.positions.positions?.length || 0;
        if (totalPos) totalPos.textContent = posCount;
        if (virtualPos) virtualPos.textContent = data.positions.virtual || posCount;
        if (livePos) livePos.textContent = data.positions.live || 0;

        // Positions table
        const posTable = document.getElementById('positions-table');
        if (posTable && data.positions.positions && data.positions.positions.length > 0) {
            posTable.innerHTML = data.positions.positions.slice(0, 5).map(p => `
                <div class="trade-item ${(p.profitPercent || 0) >= 0 ? 'buy' : 'sell'}">
                    <span>${p.id?.slice(-8) || 'Position'}</span>
                    <span style="float: right">${(p.profitPercent || 0).toFixed(2)}%</span>
                </div>
            `).join('');
        }
    }

    // [8] Recent Errors
    if (data.errors) {
        const errorsList = document.getElementById('errors-list');
        if (errorsList) {
            if (data.errors.length > 0) {
                errorsList.innerHTML = data.errors.slice(0, 5).map(err => {
                    const msg = err.message || JSON.stringify(err);
                    return `<div class="error-item">${msg}</div>`;
                }).join('');
            } else {
                errorsList.innerHTML = '<div class="no-errors">No errors</div>';
            }
        }
    }

    // Update last update time
    updateLastUpdate();
}

// Helper to update indicator scores
function updateIndicator(id, score, detail = null, detailId = null) {
    const scoreEl = document.getElementById(`${id}-score`);
    if (scoreEl) {
        scoreEl.textContent = score || '--';
        scoreEl.className = 'ind-score';
        if (score) {
            const scoreStr = String(score);
            if (scoreStr.startsWith('+')) scoreEl.classList.add('positive');
            else if (scoreStr.startsWith('-')) scoreEl.classList.add('negative');
            else scoreEl.classList.add('neutral');
        }
    }
    if (detail && detailId) {
        const detailEl = document.getElementById(detailId);
        if (detailEl) detailEl.textContent = detail;
    }
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

// ============== BOT LOGS VIEWER ==============
const botLogsState = {
    logs: [],
    filter: 'all',
    stats: {
        total: 0,
        trades: 0,
        signals: 0,
        errors: 0
    }
};

// Update bot logs from server
function updateBotLogs(logs) {
    if (!logs || !Array.isArray(logs)) return;

    const container = document.getElementById('bot-logs-container');
    if (!container) return;

    // Store logs and update stats
    botLogsState.logs = logs;
    updateLogStats(logs);

    // Clear and repopulate
    container.innerHTML = '';

    const filteredLogs = filterLogsByType(logs, botLogsState.filter);

    filteredLogs.forEach(log => {
        const entry = createBotLogEntry(log);
        container.appendChild(entry);
    });

    // Auto-scroll if enabled
    const autoScroll = document.getElementById('auto-scroll-logs');
    if (autoScroll && autoScroll.checked) {
        container.scrollTop = container.scrollHeight;
    }
}

// Create a log entry element
function createBotLogEntry(log) {
    const entry = document.createElement('div');
    const type = classifyLogType(log);
    entry.className = `bot-log-entry ${type}`;
    entry.dataset.type = type;

    // Format timestamp
    let timeStr = '--:--:--';
    if (log.timestamp) {
        try {
            const date = new Date(log.timestamp);
            timeStr = date.toLocaleTimeString();
        } catch (e) {
            timeStr = log.timestamp.substring(11, 19) || '--:--:--';
        }
    }

    // Determine level and source
    const level = log.level ? log.level.toUpperCase() : type.toUpperCase();
    const source = log.source || extractSource(log.message) || 'BOT';
    const message = log.message || JSON.stringify(log);

    entry.innerHTML = `
        <span class="log-timestamp">${timeStr}</span>
        <span class="log-level">${level}</span>
        <span class="log-source">${source}</span>
        <span class="log-text">${message}</span>
    `;

    return entry;
}

// Classify log type based on content
function classifyLogType(log) {
    const message = (log.message || '').toLowerCase();
    const level = (log.level || '').toLowerCase();

    if (level === 'error' || message.includes('error') || message.includes('failed')) {
        return 'error';
    }
    if (level === 'warn' || message.includes('warning') || message.includes('warn')) {
        return 'warning';
    }
    if (message.includes('trade') || message.includes('buy') || message.includes('sell') || message.includes('order')) {
        return 'trade';
    }
    if (message.includes('signal') || message.includes('indicator') || message.includes('rsi') || message.includes('macd')) {
        return 'signal';
    }
    if (message.includes('decision') || message.includes('confidence') || message.includes('action')) {
        return 'decision';
    }
    if (message.includes('api') || message.includes('binance') || message.includes('fetch') || message.includes('request')) {
        return 'api';
    }
    return 'info';
}

// Extract source from message
function extractSource(message) {
    if (!message) return 'BOT';
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('binance')) return 'BINANCE';
    if (lowerMsg.includes('indicator') || lowerMsg.includes('rsi') || lowerMsg.includes('macd')) return 'INDICATOR';
    if (lowerMsg.includes('strategy')) return 'STRATEGY';
    if (lowerMsg.includes('portfolio')) return 'PORTFOLIO';
    if (lowerMsg.includes('trade') || lowerMsg.includes('order')) return 'TRADING';
    if (lowerMsg.includes('risk')) return 'RISK';
    if (lowerMsg.includes('decision')) return 'DECISION';
    return 'BOT';
}

// Filter logs by type
function filterLogsByType(logs, filterType) {
    if (filterType === 'all') return logs;
    return logs.filter(log => classifyLogType(log) === filterType);
}

// Update log statistics
function updateLogStats(logs) {
    botLogsState.stats = {
        total: logs.length,
        trades: logs.filter(l => classifyLogType(l) === 'trade').length,
        signals: logs.filter(l => classifyLogType(l) === 'signal').length,
        errors: logs.filter(l => classifyLogType(l) === 'error').length
    };

    document.getElementById('log-count-total').textContent = botLogsState.stats.total;
    document.getElementById('log-count-trades').textContent = botLogsState.stats.trades;
    document.getElementById('log-count-signals').textContent = botLogsState.stats.signals;
    document.getElementById('log-count-errors').textContent = botLogsState.stats.errors;
}

// Filter button handler
function filterLogs(filterType) {
    botLogsState.filter = filterType;

    // Update active button
    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterType);
    });

    // Re-render logs
    updateBotLogs(botLogsState.logs);
}

// Clear bot logs display
function clearBotLogs() {
    const container = document.getElementById('bot-logs-container');
    if (container) {
        container.innerHTML = `
            <div class="bot-log-entry info">
                <span class="log-timestamp">--:--:--</span>
                <span class="log-level">INFO</span>
                <span class="log-source">SYSTEM</span>
                <span class="log-text">Logs cleared</span>
            </div>
        `;
    }
    botLogsState.logs = [];
    updateLogStats([]);
}

// Download logs as file
function downloadLogs() {
    if (botLogsState.logs.length === 0) {
        alert('No logs to download');
        return;
    }

    const logText = botLogsState.logs.map(log => {
        const time = log.timestamp || new Date().toISOString();
        const level = log.level || 'info';
        const msg = log.message || JSON.stringify(log);
        return `[${time}] [${level.toUpperCase()}] ${msg}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `algoqbot-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Request bot logs from server
function requestBotLogs() {
    if (socket && state.connected) {
        socket.emit('request-bot-logs');
    }
}

// ============== ENHANCED AI CHAT - AGENT SELECTION ==============
const chatState = {
    mode: 'single',           // single, group, all
    selectedAgent: 'AlgoQ',
    selectedAgents: [],       // for group mode
    discussionMode: 'analyse', // analyse, brainstorm, debate
    customGroups: JSON.parse(localStorage.getItem('algoq-chat-groups') || '[]')
};

const AGENT_INFO = {
    'AlgoQ': { emoji: '🤖', name: 'AlgoQ', specialty: 'Lead AI & Executor' },
    'Strategist': { emoji: '🎯', name: 'Strategist', specialty: 'Strategy & Direction' },
    'Analyst': { emoji: '📊', name: 'Dr. Sarah Data', specialty: 'Quantitative Analysis' },
    'RiskManager': { emoji: '🛡️', name: 'Victor Shield', specialty: 'Risk Management' },
    'Sentiment': { emoji: '📡', name: 'Echo Pulse', specialty: 'Sentiment Analysis' }
};

// Set chat mode (single, group, all)
function setChatMode(mode) {
    chatState.mode = mode;

    // Update mode buttons
    document.querySelectorAll('.chat-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide group creator
    const groupCreator = document.getElementById('group-creator');
    if (groupCreator) {
        groupCreator.style.display = mode === 'group' ? 'block' : 'none';
    }

    // Reset agent cards based on mode
    if (mode === 'single') {
        document.querySelectorAll('.agent-card').forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.agent === chatState.selectedAgent) {
                card.classList.add('active');
            }
        });
        chatState.selectedAgents = [];
    } else if (mode === 'all') {
        chatState.selectedAgents = Object.keys(AGENT_INFO);
        document.querySelectorAll('.agent-card').forEach(card => {
            card.classList.add('selected');
            card.classList.remove('active');
        });
    }

    updateChatDisplay();
}

// Select agent (for single mode or group building)
function selectAgent(agentId) {
    if (chatState.mode === 'single') {
        // Single mode - select one agent
        chatState.selectedAgent = agentId;
        document.querySelectorAll('.agent-card').forEach(card => {
            card.classList.toggle('active', card.dataset.agent === agentId);
            card.classList.remove('selected');
        });
    } else if (chatState.mode === 'group') {
        // Group mode - toggle selection
        const card = document.querySelector(`.agent-card[data-agent="${agentId}"]`);
        if (chatState.selectedAgents.includes(agentId)) {
            chatState.selectedAgents = chatState.selectedAgents.filter(a => a !== agentId);
            card.classList.remove('selected');
        } else {
            chatState.selectedAgents.push(agentId);
            card.classList.add('selected');
        }
        updateGroupSelectedDisplay();
    }

    updateChatDisplay();
}

// Update chat display header
function updateChatDisplay() {
    const agentDisplay = document.getElementById('chat-agent-display');
    const modeDisplay = document.getElementById('chat-mode-display');

    if (!agentDisplay) return;

    if (chatState.mode === 'single') {
        const agent = AGENT_INFO[chatState.selectedAgent];
        agentDisplay.textContent = `${agent.emoji} ${agent.name}`;
    } else if (chatState.mode === 'group') {
        if (chatState.selectedAgents.length === 0) {
            agentDisplay.textContent = '👥 Select agents...';
        } else {
            const emojis = chatState.selectedAgents.map(a => AGENT_INFO[a].emoji).join('');
            agentDisplay.textContent = `👥 ${emojis} (${chatState.selectedAgents.length} agents)`;
        }
    } else if (chatState.mode === 'all') {
        agentDisplay.textContent = '🌐 All Agents (5)';
    }

    if (modeDisplay) {
        const modeLabels = {
            'analyse': '🔍 Analyse',
            'brainstorm': '💡 Brainstorm',
            'debate': '⚔️ Debate'
        };
        modeDisplay.textContent = `Mode: ${modeLabels[chatState.discussionMode]}`;
    }
}

// Set chat discussion mode
function setChatDiscussionMode(mode) {
    chatState.discussionMode = mode;

    document.querySelectorAll('.chat-disc-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    updateChatDisplay();
}

// Update group selected display
function updateGroupSelectedDisplay() {
    const container = document.getElementById('group-selected');
    if (!container) return;

    if (chatState.selectedAgents.length === 0) {
        container.innerHTML = '<span class="placeholder-text">Select agents above</span>';
    } else {
        container.innerHTML = chatState.selectedAgents.map(agentId => {
            const agent = AGENT_INFO[agentId];
            return `<span class="group-member-tag">${agent.emoji} ${agent.name}</span>`;
        }).join('');
    }
}

// Save custom group
function saveCustomGroup() {
    const nameInput = document.getElementById('group-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a group name');
        return;
    }

    if (chatState.selectedAgents.length < 2) {
        alert('Please select at least 2 agents for a group');
        return;
    }

    const group = {
        id: Date.now(),
        name: name,
        agents: [...chatState.selectedAgents]
    };

    chatState.customGroups.push(group);
    localStorage.setItem('algoq-chat-groups', JSON.stringify(chatState.customGroups));

    nameInput.value = '';
    renderSavedGroups();
    alert(`Group "${name}" saved!`);
}

// Render saved groups
function renderSavedGroups() {
    const container = document.getElementById('groups-list');
    if (!container) return;

    if (chatState.customGroups.length === 0) {
        container.innerHTML = '<div class="no-groups">No saved groups</div>';
        return;
    }

    container.innerHTML = chatState.customGroups.map(group => `
        <div class="saved-group-item" onclick="loadGroup(${group.id})">
            <span class="group-item-name">${group.name}</span>
            <span class="group-item-count">${group.agents.length} agents</span>
        </div>
    `).join('');
}

// Load a saved group
function loadGroup(groupId) {
    const group = chatState.customGroups.find(g => g.id === groupId);
    if (!group) return;

    setChatMode('group');
    chatState.selectedAgents = [...group.agents];

    // Update agent cards
    document.querySelectorAll('.agent-card').forEach(card => {
        card.classList.remove('active', 'selected');
        if (chatState.selectedAgents.includes(card.dataset.agent)) {
            card.classList.add('selected');
        }
    });

    updateGroupSelectedDisplay();
    updateChatDisplay();
}

// Initialize chat on page load
function initEnhancedChat() {
    renderSavedGroups();
    updateChatDisplay();
}

// Call on DOM ready
document.addEventListener('DOMContentLoaded', initEnhancedChat);

// ============== ROUND PROGRESSION TRACKING ==============
const progressionState = {
    currentRound: 0,
    maxRounds: 5,
    agentsSpokeThisRound: [],
    totalAgentsSpoke: 0,
    totalVotesCast: 0,
    sessionStartTime: null,
    timerInterval: null
};

// Initialize round progression display
function initRoundProgression() {
    // Reset all steps to waiting
    for (let i = 1; i <= 5; i++) {
        const step = document.getElementById(`round-step-${i}`);
        if (step) {
            step.classList.remove('active', 'completed');
            step.classList.add('waiting');
        }
        // Initialize agent badges for each step
        const agentsContainer = document.getElementById(`step-agents-${i}`);
        if (agentsContainer) {
            agentsContainer.innerHTML = Object.values(AGENT_INFO).map(agent =>
                `<span class="step-agent-badge" data-agent="${agent.name}">${agent.emoji}</span>`
            ).join('');
        }
    }

    // Reset counters
    progressionState.currentRound = 0;
    progressionState.agentsSpokeThisRound = [];
    progressionState.totalAgentsSpoke = 0;
    progressionState.totalVotesCast = 0;

    updateProgressionSummary();
}

// Start session timer
function startSessionTimer() {
    progressionState.sessionStartTime = Date.now();

    if (progressionState.timerInterval) {
        clearInterval(progressionState.timerInterval);
    }

    progressionState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - progressionState.sessionStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('session-timer');
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds}`;
        }
    }, 1000);
}

// Stop session timer
function stopSessionTimer() {
    if (progressionState.timerInterval) {
        clearInterval(progressionState.timerInterval);
        progressionState.timerInterval = null;
    }
}

// Update round progression when a new round starts
function updateRoundProgression(round, maxRounds) {
    progressionState.currentRound = round;
    progressionState.maxRounds = maxRounds;
    progressionState.agentsSpokeThisRound = [];

    // Update step states
    for (let i = 1; i <= 5; i++) {
        const step = document.getElementById(`round-step-${i}`);
        if (!step) continue;

        step.classList.remove('waiting', 'active', 'completed');

        if (i < round) {
            step.classList.add('completed');
        } else if (i === round) {
            step.classList.add('active');
        } else {
            step.classList.add('waiting');
        }
    }

    updateProgressionSummary();
}

// Mark agent as having spoken in current round
function markAgentSpoke(agentName, round) {
    if (!progressionState.agentsSpokeThisRound.includes(agentName)) {
        progressionState.agentsSpokeThisRound.push(agentName);
        progressionState.totalAgentsSpoke++;
    }

    // Update agent badge
    const agentsContainer = document.getElementById(`step-agents-${round}`);
    if (agentsContainer) {
        const badge = agentsContainer.querySelector(`[data-agent="${agentName}"]`);
        if (badge) {
            badge.classList.add('spoke');
        }
    }

    updateProgressionSummary();
}

// Mark vote cast
function markVoteCast() {
    progressionState.totalVotesCast++;
    updateProgressionSummary();
}

// Update progression summary
function updateProgressionSummary() {
    const spokeCount = document.getElementById('agents-spoke-count');
    const votesCount = document.getElementById('votes-cast-count');
    const progressFill = document.getElementById('overall-progress-fill');

    if (spokeCount) {
        spokeCount.textContent = progressionState.totalAgentsSpoke;
    }

    if (votesCount) {
        votesCount.textContent = progressionState.totalVotesCast;
    }

    if (progressFill) {
        const progress = (progressionState.currentRound / progressionState.maxRounds) * 100;
        progressFill.style.width = `${progress}%`;
    }
}

// Complete current round
function completeRound(round) {
    const step = document.getElementById(`round-step-${round}`);
    if (step) {
        step.classList.remove('active', 'waiting');
        step.classList.add('completed');
    }
}

// Reset progression for new session
function resetProgression() {
    initRoundProgression();
    stopSessionTimer();
    const timerEl = document.getElementById('session-timer');
    if (timerEl) {
        timerEl.textContent = '00:00';
    }
}

// ============== AGENT PROFILES ==============
let currentAgentProfile = null;

// Load agent profiles on page load
async function loadAgentProfiles() {
    try {
        const response = await fetch('/api/agents');
        const data = await response.json();

        if (data.agents) {
            renderAgentProfiles(data.agents);
        }
    } catch (error) {
        console.error('Failed to load agent profiles:', error);
    }
}

// Render agent profile cards
function renderAgentProfiles(agents) {
    const container = document.getElementById('agent-profiles-grid');
    if (!container) return;

    container.innerHTML = agents.map(agent => `
        <div class="agent-profile-card" onclick="showAgentDetail('${agent.id}')">
            <div class="agent-profile-header">
                <span class="agent-profile-avatar">${agent.avatar}</span>
                <div class="agent-profile-info">
                    <h4>${agent.name}</h4>
                    <span>${agent.role}</span>
                </div>
            </div>
            <div class="agent-profile-stats">
                <div class="agent-stat">
                    <span class="agent-stat-value">${agent.totalSessions}</span>
                    <span class="agent-stat-label">Sessions</span>
                </div>
                <div class="agent-stat">
                    <span class="agent-stat-value">${agent.memorySize}</span>
                    <span class="agent-stat-label">Memories</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Show agent detail modal
async function showAgentDetail(agentId) {
    try {
        const response = await fetch(`/api/agents/${agentId}`);
        const data = await response.json();

        if (data.agent) {
            currentAgentProfile = data.agent;
            populateAgentModal(data.agent);
            document.getElementById('agent-detail-modal').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load agent detail:', error);
    }
}

// Hide agent detail modal
function hideAgentDetail() {
    document.getElementById('agent-detail-modal').classList.add('hidden');
    currentAgentProfile = null;
}

// Populate agent modal with data
function populateAgentModal(agent) {
    // Header
    document.querySelector('.agent-modal-avatar').textContent = agent.avatar;
    document.getElementById('agent-modal-name').textContent = agent.fullName || agent.name;
    document.getElementById('agent-modal-role').textContent = agent.role;

    // Profile Tab
    const traitsContainer = document.getElementById('agent-personality-traits');
    traitsContainer.innerHTML = agent.personality.traits.map(trait =>
        `<span class="trait-badge">${trait}</span>`
    ).join('');

    document.getElementById('agent-comm-style').textContent = agent.personality.communicationStyle;
    document.getElementById('agent-decision-style').textContent = agent.personality.decisionMaking;
    document.getElementById('agent-risk-tolerance').textContent = agent.personality.riskTolerance;

    const expertiseContainer = document.getElementById('agent-expertise');
    expertiseContainer.innerHTML = agent.expertise.map(exp =>
        `<span class="expertise-badge">${exp}</span>`
    ).join('');

    document.getElementById('agent-api').textContent = agent.api;
    document.getElementById('agent-voting-weight').textContent = agent.votingWeight;

    // Objectives Tab
    document.getElementById('agent-primary-objective').textContent = agent.objectives.primary;

    const missionsContainer = document.getElementById('agent-missions');
    missionsContainer.innerHTML = agent.objectives.missions.map(m =>
        `<li>${m}</li>`
    ).join('');

    const kpisContainer = document.getElementById('agent-kpis');
    kpisContainer.innerHTML = agent.objectives.kpis.map(kpi =>
        `<li>${kpi}</li>`
    ).join('');

    // Memory Tab
    populateMemoryTab(agent.memory);

    // History Tab
    populateHistoryTab(agent.history, agent.performance);
}

// Populate memory tab
function populateMemoryTab(memory) {
    const shortTermContainer = document.getElementById('agent-short-term-memory');
    if (memory.shortTerm && memory.shortTerm.length > 0) {
        shortTermContainer.innerHTML = memory.shortTerm.map(item => `
            <div class="memory-item">
                <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                <p>${item.content || JSON.stringify(item)}</p>
            </div>
        `).join('');
    } else {
        shortTermContainer.innerHTML = '<p class="empty">No recent context</p>';
    }

    const longTermContainer = document.getElementById('agent-long-term-memory');
    if (memory.longTerm && memory.longTerm.length > 0) {
        longTermContainer.innerHTML = memory.longTerm.map(item => `
            <div class="memory-item">
                <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                <p>${item.insight || JSON.stringify(item)}</p>
            </div>
        `).join('');
    } else {
        longTermContainer.innerHTML = '<p class="empty">No long-term memories</p>';
    }

    const learningsContainer = document.getElementById('agent-learnings');
    if (memory.learnings && memory.learnings.length > 0) {
        learningsContainer.innerHTML = memory.learnings.map(item => `
            <div class="memory-item">
                <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                <p>${item.lesson || JSON.stringify(item)}</p>
            </div>
        `).join('');
    } else {
        learningsContainer.innerHTML = '<p class="empty">No learnings recorded</p>';
    }
}

// Populate history tab
function populateHistoryTab(history, performance) {
    document.getElementById('agent-total-sessions').textContent = history.totalSessions;
    document.getElementById('agent-total-discussions').textContent = history.totalDiscussions;
    document.getElementById('agent-total-votes').textContent = history.totalVotes;
    document.getElementById('agent-prediction-accuracy').textContent = performance.predictionAccuracy;

    const contributionsContainer = document.getElementById('agent-contributions');
    if (history.contributions && history.contributions.length > 0) {
        contributionsContainer.innerHTML = history.contributions.slice(-10).reverse().map(c => `
            <div class="memory-item">
                <span class="timestamp">${new Date(c.timestamp).toLocaleString()}</span>
                <p><strong>${c.type}:</strong> ${c.summary}</p>
            </div>
        `).join('');
    } else {
        contributionsContainer.innerHTML = '<p class="empty">No contributions yet</p>';
    }

    const milestonesContainer = document.getElementById('agent-milestones');
    if (history.milestones && history.milestones.length > 0) {
        milestonesContainer.innerHTML = history.milestones.map(m => `
            <div class="memory-item">
                <span class="timestamp">${new Date(m.timestamp).toLocaleString()}</span>
                <p>${m.description || m.title}</p>
            </div>
        `).join('');
    } else {
        milestonesContainer.innerHTML = '<p class="empty">No milestones yet</p>';
    }
}

// Show agent tab
function showAgentTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.agent-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Show selected tab
    document.getElementById(`agent-tab-${tabName}`).classList.remove('hidden');

    // Update tab buttons
    document.querySelectorAll('.detail-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Initialize agent profiles on DOM ready
document.addEventListener('DOMContentLoaded', loadAgentProfiles);

// ============== API STATUS TESTING ==============
async function testApiConnections() {
    // Set all to testing state
    const apis = ['claude', 'deepseek', 'qween'];
    apis.forEach(api => {
        const el = document.getElementById(`api-${api}-status`);
        if (el) {
            el.textContent = '🔄 Testing...';
            el.className = 'api-status testing';
        }
    });

    try {
        const response = await fetch('/api/status/apis');
        const data = await response.json();

        // Update status for each API
        updateApiStatus('claude', data.claude);
        updateApiStatus('deepseek', data.deepseek);
        updateApiStatus('qween', data.qween);

    } catch (error) {
        apis.forEach(api => {
            const el = document.getElementById(`api-${api}-status`);
            if (el) {
                el.textContent = '❌ Test failed';
                el.className = 'api-status error';
            }
        });
    }
}

function updateApiStatus(apiName, status) {
    const el = document.getElementById(`api-${apiName}-status`);
    if (!el) return;

    if (!status.configured) {
        el.textContent = '⚠️ Not configured';
        el.className = 'api-status error';
    } else if (status.connected) {
        el.textContent = '✅ Connected';
        el.className = 'api-status connected';
    } else {
        el.textContent = `❌ ${status.status}`;
        el.className = 'api-status error';
    }
}

// Test APIs on page load (delayed)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(testApiConnections, 2000);
});
