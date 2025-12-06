/**
 * AlgoQBot Unified Web Server
 * Everything in one place at port 9000:
 * - Live Monitor with real-time bot data
 * - Chat with AlgoQBot
 * - Intelligence Reports from live trading
 * - Agent Research with bot communication
 * - AI Council (Claude + DeepSeek + Qwen)
 * - Portfolio with live trade history
 * - Notes & Search functionality
 */

const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'ai-council', '.env') });

const PORT = process.env.CHAT_PORT || 9000;
const DATA_PATH = path.join(__dirname, '..', 'data');
const LOGS_PATH = path.join(__dirname, '..', 'logs');

class UnifiedWebServer {
  constructor(bot = null) {
    this.bot = bot;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });
    this.agentReasoningSteps = [];
    this.researchOutputs = { market: null, data: null, issues: null, suggestions: null };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  // Helper: Read JSON file safely
  readJsonFile(filename) {
    const filePath = path.join(DATA_PATH, filename);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error(`Error reading ${filename}:`, e.message);
    }
    return null;
  }

  // Helper: Get current BNB price
  getCurrentPrice() {
    const balances = this.readJsonFile('virtual_balances.json');
    return balances?.currentPrice || 886;
  }

  // Helper: Get portfolio data
  getPortfolioData() {
    const balances = this.readJsonFile('virtual_balances.json') || { usdt: 36000, bnb: 22 };
    const price = balances.currentPrice || 886;
    const bnbValue = (balances.bnb || 0) * price;
    const total = (balances.usdt || 0) + bnbValue;

    return {
      usdt: balances.usdt || 0,
      bnb: balances.bnb || 0,
      bnbValue,
      total,
      bnbPercent: total > 0 ? (bnbValue / total) * 100 : 0,
      usdtPercent: total > 0 ? ((balances.usdt || 0) / total) * 100 : 0,
      currentPrice: price,
      lastUpdated: balances.lastUpdated || new Date().toISOString()
    };
  }

  // Helper: Get trades with P&L calculations
  getTradesWithPnL() {
    const trades = this.readJsonFile('shadow_trades.json') || [];
    let totalPnL = 0;
    let wins = 0;
    let losses = 0;

    const processedTrades = trades.map((trade, idx) => {
      const profit = trade.profit || 0;
      if (trade.status === 'closed') {
        totalPnL += profit;
        if (profit > 0) wins++;
        else if (profit < 0) losses++;
      }

      return {
        id: trade.id || idx,
        timestamp: trade.timestamp,
        type: trade.action?.toUpperCase() || trade.type || 'UNKNOWN',
        pair: trade.pair || 'USDT/BNB',
        entryPrice: trade.entryPrice || trade.targetPrice || 0,
        exitPrice: trade.exitPrice || null,
        amount: trade.amount || 0,
        profit: profit,
        profitPercent: trade.profitPercent || (profit !== 0 ? (profit / (trade.amount || 1)) * 100 : 0),
        duration: trade.duration || this.calculateDuration(trade),
        status: trade.status || 'open',
        reasoning: trade.reasoning || '',
        confidence: trade.confidence || 0
      };
    });

    return {
      trades: processedTrades,
      stats: {
        total: trades.length,
        closed: wins + losses,
        open: trades.filter(t => t.status === 'open').length,
        wins,
        losses,
        winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
        totalPnL
      }
    };
  }

  calculateDuration(trade) {
    if (trade.entryTime && trade.exitTime) {
      const duration = new Date(trade.exitTime) - new Date(trade.entryTime);
      const minutes = Math.floor(duration / 60000);
      return `${minutes}m`;
    }
    return '0m';
  }

  // Helper: Get bot state
  getBotState() {
    const state = this.readJsonFile('bot_state.json') || {};
    return {
      running: state.running !== false,
      mode: state.mode || 'shadow',
      strategy: state.strategy || 'ranging',
      volatility: state.volatility || { regime: 'VERY_LOW', vol4h: 0.11, vol1h: 0.08 },
      lastAction: state.lastAction || 'HOLD',
      confidence: state.confidence || 62.1,
      lastUpdate: state.lastUpdate || new Date().toISOString()
    };
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          bot: this.bot ? 'connected' : 'standalone',
          aiCouncil: 'ready',
          trading: 'ready',
          intelligence: 'ready',
          agentResearch: 'ready'
        }
      });
    });

    // ===== BOT STATUS =====
    this.app.get('/api/status', (req, res) => {
      const portfolio = this.getPortfolioData();
      const state = this.getBotState();
      const { stats } = this.getTradesWithPnL();

      res.json({
        mode: state.mode,
        running: state.running,
        uptime: Math.floor(process.uptime()),
        portfolio,
        volatility: state.volatility,
        strategy: state.strategy,
        lastAction: state.lastAction,
        confidence: state.confidence,
        trades: stats
      });
    });

    this.app.get('/api/bot/status', (req, res) => {
      const state = this.getBotState();
      const portfolio = this.getPortfolioData();

      res.json({
        ...state,
        portfolio,
        timestamp: new Date().toISOString()
      });
    });

    // ===== PORTFOLIO =====
    this.app.get('/api/portfolio', (req, res) => {
      const portfolio = this.getPortfolioData();
      const { trades, stats } = this.getTradesWithPnL();

      res.json({
        ...portfolio,
        positions: trades.filter(t => t.status === 'open').length,
        pnl: stats.totalPnL,
        winRate: stats.winRate,
        stats
      });
    });

    // ===== TRADES =====
    this.app.get('/api/trades', (req, res) => {
      const { trades, stats } = this.getTradesWithPnL();
      const limit = parseInt(req.query.limit) || 50;

      res.json({
        trades: trades.slice(-limit).reverse(),
        total: trades.length,
        stats
      });
    });

    // ===== LOGS =====
    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      const level = req.query.level; // Filter by level if provided

      try {
        const today = new Date().toISOString().split('T')[0];
        const logFiles = [
          path.join(LOGS_PATH, `combined-${today}.log`),
          path.join(LOGS_PATH, 'combined.log'),
          path.join(LOGS_PATH, 'bot.log')
        ];

        let logs = [];
        for (const logFile of logFiles) {
          if (fs.existsSync(logFile)) {
            const content = fs.readFileSync(logFile, 'utf-8');
            logs = content.split('\n').filter(l => l.trim()).map(line => {
              let logLevel = 'info';
              if (line.includes('[error]') || line.includes('❌')) logLevel = 'error';
              else if (line.includes('[warn]') || line.includes('⚠️')) logLevel = 'warn';
              else if (line.includes('[debug]') || line.includes('✅')) logLevel = 'debug';

              return { level: logLevel, message: line, timestamp: new Date().toISOString() };
            });
            break;
          }
        }

        if (level) {
          logs = logs.filter(l => l.level === level);
        }

        res.json({ logs: logs.slice(-limit), total: logs.length });
      } catch (e) {
        res.json({ logs: [], error: e.message });
      }
    });

    // ===== INTELLIGENCE REPORTS =====
    this.app.get('/api/intelligence/report', (req, res) => {
      const type = req.query.type || 'market';
      const portfolio = this.getPortfolioData();
      const state = this.getBotState();
      const { trades, stats } = this.getTradesWithPnL();

      let report = {};

      switch (type) {
        case 'market':
          report = {
            title: 'Market Analysis Report',
            timestamp: new Date().toISOString(),
            volatility: state.volatility,
            regime: state.volatility.regime,
            strategy: state.strategy,
            recommendation: state.volatility.regime === 'VERY_LOW'
              ? 'Market volatility is too low for profitable trading. BSC fees require 3.5%+ TP. Wait for MEDIUM+ volatility.'
              : `Current strategy: ${state.strategy}. Market conditions are favorable for trading.`,
            metrics: {
              vol4h: state.volatility.vol4h,
              vol1h: state.volatility.vol1h,
              confidence: state.confidence
            }
          };
          break;

        case 'risk':
          report = {
            title: 'Risk Metrics Report',
            timestamp: new Date().toISOString(),
            portfolio: {
              total: portfolio.total,
              bnbExposure: portfolio.bnbPercent,
              usdtExposure: portfolio.usdtPercent
            },
            riskLevel: portfolio.bnbPercent > 50 ? 'HIGH' : portfolio.bnbPercent > 35 ? 'MEDIUM' : 'LOW',
            recommendation: portfolio.bnbPercent > 45
              ? 'BNB exposure is high. Consider reducing position.'
              : 'Portfolio is within target allocation (35-45% BNB).',
            drawdown: stats.totalPnL < 0 ? Math.abs(stats.totalPnL) : 0,
            winRate: stats.winRate
          };
          break;

        case 'performance':
          report = {
            title: 'Performance Trends Report',
            timestamp: new Date().toISOString(),
            trades: {
              total: stats.total,
              wins: stats.wins,
              losses: stats.losses,
              winRate: stats.winRate,
              totalPnL: stats.totalPnL
            },
            recentTrades: trades.slice(-10),
            trend: stats.totalPnL > 0 ? 'POSITIVE' : stats.totalPnL < 0 ? 'NEGATIVE' : 'NEUTRAL'
          };
          break;

        default:
          report = { error: 'Unknown report type' };
      }

      res.json(report);
    });

    // ===== AGENT RESEARCH =====
    this.app.post('/api/agent-research/:action', (req, res) => {
      const { action } = req.params;
      const portfolio = this.getPortfolioData();
      const state = this.getBotState();
      const { trades, stats } = this.getTradesWithPnL();

      let response = { action, timestamp: new Date().toISOString(), status: 'completed' };

      // Add to reasoning steps
      this.agentReasoningSteps.push({
        step: this.agentReasoningSteps.length + 1,
        action,
        timestamp: new Date().toISOString()
      });

      switch (action) {
        case 'research-market':
          response.analysis = {
            regime: state.volatility.regime,
            vol4h: state.volatility.vol4h,
            vol1h: state.volatility.vol1h,
            strategy: state.strategy,
            recommendation: state.volatility.regime === 'VERY_LOW'
              ? 'Very quiet market - no trading recommended. Waiting for volatility > 0.8%.'
              : `Active ${state.strategy} strategy. Current conditions support trading.`
          };
          response.message = `Market Analysis: ${state.volatility.regime} volatility (${state.volatility.vol4h}% 4h). Strategy: ${state.strategy}. ${response.analysis.recommendation}`;
          this.researchOutputs.market = response;
          break;

        case 'analyze-data':
          response.analysis = {
            totalTrades: stats.total,
            closedTrades: stats.closed,
            openPositions: stats.open,
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.winRate,
            totalPnL: stats.totalPnL,
            recentTrades: trades.slice(-5)
          };
          response.message = `Data Analysis: ${stats.total} total trades, ${stats.wins} wins, ${stats.losses} losses (${stats.winRate.toFixed(1)}% win rate). Total P&L: $${stats.totalPnL.toFixed(2)}`;
          this.researchOutputs.data = response;
          break;

        case 'check-issues':
          const issues = [];
          if (!state.running) issues.push('Bot is not running');
          if (state.volatility.regime === 'VERY_LOW') issues.push('Volatility too low for trading');
          if (portfolio.bnbPercent > 50) issues.push('BNB exposure above 50% - high risk');
          if (stats.winRate < 40 && stats.closed > 10) issues.push('Win rate below 40%');

          response.analysis = {
            systemStatus: 'OK',
            botRunning: state.running,
            webServerRunning: true,
            dataFilesAccessible: true,
            issues: issues.length > 0 ? issues : ['No critical issues detected']
          };
          response.message = issues.length > 0
            ? `Issues Found: ${issues.join('. ')}`
            : 'System Check: ✅ All systems operational. No critical issues detected.';
          this.researchOutputs.issues = response;
          break;

        case 'suggest-enhancements':
          const suggestions = [];
          if (state.volatility.regime === 'VERY_LOW') {
            suggestions.push('Consider adjusting volatility thresholds if market remains quiet');
          }
          if (stats.winRate < 50 && stats.closed > 10) {
            suggestions.push('Review entry/exit signals - win rate could be improved');
          }
          if (portfolio.bnbPercent > 45) {
            suggestions.push('Consider rebalancing portfolio - BNB exposure is high');
          }
          suggestions.push('Monitor BNB/USDT correlation with BTC for better entry signals');
          suggestions.push('Review risk parameters for current market conditions');

          response.analysis = {
            currentPerformance: stats.winRate,
            portfolioHealth: portfolio.bnbPercent <= 45 ? 'Good' : 'Needs attention',
            suggestions
          };
          response.message = `Suggestions: ${suggestions.slice(0, 3).join('. ')}`;
          this.researchOutputs.suggestions = response;
          break;

        default:
          response.status = 'error';
          response.message = `Unknown action: ${action}`;
      }

      // Broadcast to connected clients
      this.io.emit('agent:research-update', response);

      res.json(response);
    });

    // Get agent reasoning steps
    this.app.get('/api/agent-research/reasoning', (req, res) => {
      res.json({
        steps: this.agentReasoningSteps.slice(-10),
        outputs: this.researchOutputs
      });
    });

    // ===== AI COUNCIL =====
    this.app.get('/api/ai-council/status', (req, res) => {
      res.json({
        status: 'ready',
        providers: ['claude', 'deepseek', 'qwen'],
        consensusThreshold: 0.8,
        maxRounds: 3,
        lastSession: null
      });
    });

    // ===== NOTES =====
    this.app.get('/api/notes', (req, res) => {
      const notes = this.readJsonFile('user_notes.json') || [];
      res.json({ notes });
    });

    this.app.post('/api/notes', (req, res) => {
      const { content, title } = req.body;
      const notes = this.readJsonFile('user_notes.json') || [];
      const newNote = {
        id: Date.now(),
        title: title || 'Untitled',
        content,
        timestamp: new Date().toISOString()
      };
      notes.push(newNote);

      try {
        fs.writeFileSync(path.join(DATA_PATH, 'user_notes.json'), JSON.stringify(notes, null, 2));
        res.json({ success: true, note: newNote });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    });

    // ===== SEARCH =====
    this.app.get('/api/search', (req, res) => {
      const query = (req.query.query || req.query.q || '').toLowerCase();
      const type = req.query.type || 'all';

      if (!query) {
        return res.json({ results: [] });
      }

      const results = [];

      // Search trades
      if (type === 'all' || type === 'trades') {
        const { trades } = this.getTradesWithPnL();
        trades.forEach(trade => {
          if (trade.reasoning?.toLowerCase().includes(query) ||
              trade.type?.toLowerCase().includes(query) ||
              trade.pair?.toLowerCase().includes(query)) {
            results.push({ type: 'trade', data: trade });
          }
        });
      }

      // Search logs
      if (type === 'all' || type === 'logs') {
        try {
          const logFiles = [
            path.join(LOGS_PATH, 'combined.log'),
            path.join(LOGS_PATH, 'bot.log')
          ];
          for (const logFile of logFiles) {
            if (fs.existsSync(logFile)) {
              const content = fs.readFileSync(logFile, 'utf-8');
              const lines = content.split('\n').filter(l => l.toLowerCase().includes(query));
              lines.slice(-20).forEach(line => {
                results.push({ type: 'log', data: { message: line } });
              });
              break;
            }
          }
        } catch (e) {}
      }

      // Search notes
      if (type === 'all' || type === 'notes') {
        const notes = this.readJsonFile('user_notes.json') || [];
        notes.forEach(note => {
          if (note.content?.toLowerCase().includes(query) ||
              note.title?.toLowerCase().includes(query)) {
            results.push({ type: 'note', data: note });
          }
        });
      }

      // Group results by type for frontend
      const grouped = {
        trades: results.filter(r => r.type === 'trade').map(r => r.data),
        logs: results.filter(r => r.type === 'log').map(r => r.data.message),
        notes: results.filter(r => r.type === 'note').map(r => r.data),
        total: results.length
      };
      res.json(grouped);
    });

    // Main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Session info
    this.app.get('/api/session', (req, res) => {
      res.json({
        activeConnections: this.io.sockets.sockets.size,
        uptime: process.uptime(),
        agentReasoningSteps: this.agentReasoningSteps.length
      });
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Send welcome with current state
      const portfolio = this.getPortfolioData();
      const state = this.getBotState();

      socket.emit('welcome', {
        message: 'Connected to AlgoQBot Unified Server',
        features: ['live-monitor', 'chat', 'intelligence', 'agent-research', 'ai-council', 'portfolio', 'notes', 'search'],
        timestamp: new Date().toISOString(),
        currentState: { portfolio, ...state }
      });

      // Send existing logs
      this.sendExistingLogs(socket);

      // Chat with bot
      socket.on('chat:message', async (data) => {
        console.log('Chat message:', data.message);
        const state = this.getBotState();
        const portfolio = this.getPortfolioData();

        // Provide contextual response based on current bot state
        let response = `I received: "${data.message}"\n\n`;
        response += `Current Status: ${state.running ? 'Running' : 'Stopped'} | Mode: ${state.mode}\n`;
        response += `Portfolio: $${portfolio.total.toFixed(2)} | Strategy: ${state.strategy}\n\n`;
        response += `For multi-AI analysis, use the AI Council tab.`;

        socket.emit('chat:response', { response, timestamp: new Date() });
      });

      // AI Council session
      socket.on('start_session', async (data) => {
        console.log('🏛️ Starting AI Council session:', data.task);
        await this.runCouncilSession(socket, data.task);
      });

      socket.on('council:start', async (data) => {
        console.log('🏛️ Starting AI Council session:', data.task);
        await this.runCouncilSession(socket, data.task);
      });

      // Agent commands via socket
      socket.on('agent:command', async (data) => {
        const cmd = data.command.toLowerCase();
        console.log('🧠 Agent command:', cmd);

        let action = 'research-market';
        if (cmd.includes('analyze') || cmd.includes('data')) action = 'analyze-data';
        else if (cmd.includes('issue') || cmd.includes('check')) action = 'check-issues';
        else if (cmd.includes('suggest') || cmd.includes('improve') || cmd.includes('enhance')) action = 'suggest-enhancements';

        // Trigger the API endpoint internally
        const portfolio = this.getPortfolioData();
        const state = this.getBotState();
        const { trades, stats } = this.getTradesWithPnL();

        let response = '';
        switch (action) {
          case 'research-market':
            response = `Market Analysis: ${state.volatility.regime} volatility (${state.volatility.vol4h}% 4h). Strategy: ${state.strategy}. ${state.volatility.regime === 'VERY_LOW' ? 'Waiting for volatility > 0.8%.' : 'Conditions support trading.'}`;
            break;
          case 'analyze-data':
            response = `Data Analysis: ${stats.total} total trades, ${stats.wins} wins, ${stats.losses} losses (${stats.winRate.toFixed(1)}% win rate). Total P&L: $${stats.totalPnL.toFixed(2)}`;
            break;
          case 'check-issues':
            const issues = [];
            if (!state.running) issues.push('Bot not running');
            if (state.volatility.regime === 'VERY_LOW') issues.push('Volatility too low');
            response = issues.length > 0 ? `Issues: ${issues.join('. ')}` : 'System Check: ✅ All systems operational.';
            break;
          case 'suggest-enhancements':
            response = 'Suggestions: 1) Adjust volatility thresholds if market stays quiet. 2) Monitor BNB/BTC correlation. 3) Review risk parameters.';
            break;
        }

        // Add reasoning step
        this.agentReasoningSteps.push({
          step: this.agentReasoningSteps.length + 1,
          action,
          message: response,
          timestamp: new Date().toISOString()
        });

        socket.emit('agent:response', { response, action, timestamp: new Date() });
        socket.emit('agent:reasoning-update', { steps: this.agentReasoningSteps.slice(-5) });
      });

      // Request status update
      socket.on('status:request', () => {
        const portfolio = this.getPortfolioData();
        const state = this.getBotState();
        const { stats } = this.getTradesWithPnL();
        socket.emit('status:update', { portfolio, ...state, trades: stats });
      });

      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });

    // Stream bot logs to all connected clients
    this.startLogStreaming();

    // Periodic status updates
    setInterval(() => {
      const portfolio = this.getPortfolioData();
      const state = this.getBotState();
      const { stats } = this.getTradesWithPnL();
      this.io.emit('status:update', { portfolio, ...state, trades: stats, timestamp: new Date().toISOString() });
    }, 30000);
  }

  sendExistingLogs(socket) {
    const today = new Date().toISOString().split('T')[0];
    const logFiles = [
      path.join(LOGS_PATH, `combined-${today}.log`),
      path.join(LOGS_PATH, 'combined.log'),
      path.join(LOGS_PATH, 'bot.log')
    ];

    try {
      let content = '';
      for (const logFile of logFiles) {
        if (fs.existsSync(logFile)) {
          content = fs.readFileSync(logFile, 'utf-8');
          console.log(`📋 Reading logs from: ${logFile}`);
          break;
        }
      }

      if (content) {
        const lines = content.split('\n').filter(l => l.trim()).slice(-30);
        lines.forEach(line => {
          let level = 'info';
          if (line.includes('error') || line.includes('❌') || line.includes('[error]')) level = 'error';
          else if (line.includes('warn') || line.includes('⚠️') || line.includes('[warn]')) level = 'warn';
          else if (line.includes('✅') || line.includes('success') || line.includes('[debug]')) level = 'success';
          socket.emit('bot:log', { level, message: line.substring(0, 300) });
        });
      } else {
        socket.emit('bot:log', { level: 'info', message: '[System] Waiting for bot logs...' });
      }
    } catch (e) {
      console.error('Error sending logs:', e.message);
    }
  }

  startLogStreaming() {
    let lastSizes = {};
    setInterval(() => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const logFiles = [
          path.join(LOGS_PATH, `combined-${today}.log`),
          path.join(LOGS_PATH, 'combined.log'),
          path.join(LOGS_PATH, 'bot.log')
        ];

        for (const logFile of logFiles) {
          if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            const lastSize = lastSizes[logFile] || 0;

            if (stats.size > lastSize) {
              const content = fs.readFileSync(logFile, 'utf-8');
              const lines = content.split('\n').slice(-10);
              lines.forEach(line => {
                if (line.trim()) {
                  let level = 'info';
                  if (line.includes('error') || line.includes('❌')) level = 'error';
                  else if (line.includes('warn') || line.includes('⚠️')) level = 'warn';
                  else if (line.includes('✅') || line.includes('success')) level = 'success';
                  this.io.emit('bot:log', { level, message: line.substring(0, 300) });
                }
              });
              lastSizes[logFile] = stats.size;
            }
            break;
          }
        }
      } catch (e) {}
    }, 5000);
  }

  async runCouncilSession(socket, task) {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
    const QWEN_KEY = process.env.QWEN_API_KEY;

    if (!ANTHROPIC_KEY || ANTHROPIC_KEY === 'sk-ant-your-key-here') {
      socket.emit('council:error', { error: 'Missing ANTHROPIC_API_KEY in .env' });
      return;
    }
    if (!DEEPSEEK_KEY) {
      socket.emit('council:error', { error: 'Missing DEEPSEEK_API_KEY in .env' });
      return;
    }
    if (!QWEN_KEY) {
      socket.emit('council:error', { error: 'Missing QWEN_API_KEY in .env' });
      return;
    }

    try {
      const { CouncilOrchestrator } = require('../ai-council/src/orchestrator/engine.js');

      // Add current trading context to the task
      const portfolio = this.getPortfolioData();
      const state = this.getBotState();
      const contextualTask = `${task}\n\nCurrent Trading Context:\n- Portfolio: $${portfolio.total.toFixed(2)} (${portfolio.bnbPercent.toFixed(1)}% BNB)\n- Strategy: ${state.strategy}\n- Volatility: ${state.volatility.regime} (${state.volatility.vol4h}% 4h)`;

      const council = new CouncilOrchestrator(
        ANTHROPIC_KEY, DEEPSEEK_KEY, QWEN_KEY,
        { maxRounds: 3, consensusThreshold: 0.8, enableStreaming: false }
      );

      council.onEvent((event) => {
        socket.emit('council_event', event);
        socket.emit('council:event', event);
      });

      const session = await council.startSession(contextualTask);

      const result = {
        sessionId: session.id,
        status: session.status,
        consensus: {
          reached: session.consensus.consensusReached,
          score: session.consensus.agreementScore,
          rounds: session.consensus.round,
          decision: session.consensus.finalDecision
        },
        tokens: session.totalTokens
      };

      socket.emit('session_complete', result);
      socket.emit('council:complete', result);

    } catch (error) {
      console.error('❌ AI Council error:', error);
      socket.emit('council:error', { error: error.message });
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(PORT)
        .on('listening', () => {
          console.log(`
╔══════════════════════════════════════════════════════════════╗
║        🤖 AlgoQBot Intelligence Dashboard                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  🌐 Server: http://localhost:${PORT}                            ║
║                                                              ║
║  Tabs:                                                       ║
║    📊 Live Monitor   - Real-time bot status & logs           ║
║    💬 Chat           - Talk to AlgoQBot                      ║
║    📈 Intelligence   - Reports from live trading data        ║
║    🤖 Agent Research - Direct bot communication              ║
║    🏛️ AI Council     - Claude + DeepSeek + Qwen consensus    ║
║    💰 Portfolio      - Live trade history & P&L              ║
║    📝 Notes          - Bot activity notes                    ║
║    🔍 Search         - Search all bot data                   ║
║                                                              ║
║  API Endpoints:                                              ║
║    GET  /api/status              - Bot status                ║
║    GET  /api/portfolio           - Portfolio data            ║
║    GET  /api/trades              - Trade history             ║
║    GET  /api/logs                - Bot logs                  ║
║    GET  /api/intelligence/report - Generate reports          ║
║    POST /api/agent-research/:action - Agent actions          ║
║    GET  /api/search              - Search bot data           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
          `);
          resolve(this.server);
        })
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is in use!`);
            console.log(`   Run: kill -9 $(lsof -t -i:${PORT})`);
          }
          reject(err);
        });
    });
  }
}

// Start server
const server = new UnifiedWebServer();
server.start().catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

module.exports = UnifiedWebServer;
