/**
 * AlgoQBot Unified Web Server
 * Everything in one place at port 9000:
 * - Chat with AlgoQBot
 * - AI Council (Claude + DeepSeek + Qwen)
 * - Trading Dashboard
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

class UnifiedWebServer {
  constructor(bot = null) {
    this.bot = bot;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
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
          trading: 'ready'
        }
      });
    });

    // Bot status
    this.app.get('/api/status', (req, res) => {
      const dataPath = path.join(__dirname, '..', 'data');
      let status = { mode: 'shadow', running: false };

      try {
        const virtualBalances = path.join(dataPath, 'virtual_balances.json');
        if (fs.existsSync(virtualBalances)) {
          const data = JSON.parse(fs.readFileSync(virtualBalances, 'utf-8'));
          status.portfolio = data;
        }
      } catch (e) {}

      res.json(status);
    });

    // Get trades
    this.app.get('/api/trades', (req, res) => {
      const tradesFile = path.join(__dirname, '..', 'data', 'shadow_trades.json');
      try {
        if (fs.existsSync(tradesFile)) {
          const trades = JSON.parse(fs.readFileSync(tradesFile, 'utf-8'));
          res.json({ trades: trades.slice(-20), total: trades.length });
        } else {
          res.json({ trades: [], total: 0 });
        }
      } catch (e) {
        res.json({ trades: [], error: e.message });
      }
    });

    // Main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API session info
    this.app.get('/api/session', (req, res) => {
      res.json({
        activeConnections: this.io.sockets.sockets.size,
        uptime: process.uptime()
      });
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      socket.emit('welcome', {
        message: 'Connected to AlgoQBot Unified Server',
        features: ['chat', 'ai-council', 'trading'],
        timestamp: new Date().toISOString()
      });

      // Regular chat with bot
      socket.on('chat:message', async (data) => {
        console.log('Chat message:', data.message);
        // For now, respond with helpful info
        socket.emit('chat:response', {
          response: `I received: "${data.message}"\n\nFor multi-AI analysis, switch to the AI Council tab where Claude, DeepSeek, and Qwen will collaborate on your question.`,
          timestamp: new Date()
        });
      });

      // AI Council session
      socket.on('start_session', async (data) => {
        console.log('🏛️ Starting AI Council session:', data.task);
        await this.runCouncilSession(socket, data.task);
      });

      // Also support council:start event name
      socket.on('council:start', async (data) => {
        console.log('🏛️ Starting AI Council session:', data.task);
        await this.runCouncilSession(socket, data.task);
      });

      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });
  }

  async runCouncilSession(socket, task) {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
    const QWEN_KEY = process.env.QWEN_API_KEY;

    // Check API keys
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
      // Dynamic import for ESM module
      const { CouncilOrchestrator } = await import('../ai-council/src/orchestrator/engine.js');

      const council = new CouncilOrchestrator(
        ANTHROPIC_KEY,
        DEEPSEEK_KEY,
        QWEN_KEY,
        { maxRounds: 3, consensusThreshold: 0.8, enableStreaming: false }
      );

      // Stream events to client
      council.onEvent((event) => {
        socket.emit('council_event', event);
        socket.emit('council:event', event); // Support both event names
      });

      const session = await council.startSession(task);

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
      socket.emit('error', { message: error.message });
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(PORT)
        .on('listening', () => {
          console.log(`
╔══════════════════════════════════════════════════════════════╗
║        🤖 AlgoQBot - Unified Web Interface                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  🌐 Server: http://localhost:${PORT}                            ║
║                                                              ║
║  Features:                                                   ║
║    💬 Chat Tab      - Talk to AlgoQBot                       ║
║    🏛️ AI Council    - Claude + DeepSeek + Qwen consensus     ║
║    📈 Trading Tab   - Dashboard & metrics                    ║
║                                                              ║
║  API Endpoints:                                              ║
║    GET  /health     - Server health                          ║
║    GET  /api/status - Bot status                             ║
║    GET  /api/trades - Recent trades                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
          `);
          resolve(this.server);
        })
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is in use!`);
            console.log(`   Run: kill -9 $(lsof -t -i:${PORT})`);
            reject(err);
          } else {
            reject(err);
          }
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
