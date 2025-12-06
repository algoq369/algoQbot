/**
 * AlgoQBot Web Chat Server
 * Integrated with AI Council - Multi-AI Consensus System
 * Port: 9000 (configurable)
 */

const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const cors = require('cors');

class AlgoQBotChatServer {
  constructor(bot, port = 9000) {
    this.bot = bot;
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    // AI Council state
    this.councilSessions = new Map();

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
        bot: this.bot ? 'connected' : 'standalone',
        aiCouncil: 'ready'
      });
    });

    // Bot status API
    this.app.get('/api/status', (req, res) => {
      if (!this.bot) {
        res.json({ status: 'standalone', message: 'Bot not connected' });
        return;
      }
      res.json({
        running: this.bot.isRunning,
        shadowMode: this.bot.shadowMode?.isActive,
        uptime: this.bot.getUptime?.() || 0
      });
    });

    // Chat with bot
    this.app.post('/api/chat', async (req, res) => {
      const { message } = req.body;
      try {
        if (this.bot?.agent) {
          const response = await this.bot.agent.processMessage(message);
          res.json({ response });
        } else {
          res.json({ response: 'Bot agent not available. Use AI Council instead.' });
        }
      } catch (error) {
        res.json({ response: `Error: ${error.message}` });
      }
    });

    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.emit('welcome', {
        message: 'Connected to AlgoQBot + AI Council',
        features: ['chat', 'ai-council', 'trading'],
        timestamp: new Date().toISOString()
      });

      // Bot chat
      socket.on('chat:message', async (data) => {
        try {
          if (this.bot?.agent) {
            const response = await this.bot.agent.processMessage(data.message);
            socket.emit('chat:response', { response, timestamp: new Date() });
          } else {
            socket.emit('chat:response', {
              response: 'Bot not connected. Try the AI Council for multi-AI analysis.',
              timestamp: new Date()
            });
          }
        } catch (error) {
          socket.emit('chat:error', { error: error.message });
        }
      });

      // AI Council - Start session
      socket.on('council:start', async (data) => {
        console.log('Starting AI Council session:', data.task);

        try {
          // Import council dynamically
          const { CouncilOrchestrator } = await import('../ai-council/src/orchestrator/engine.js');

          const council = new CouncilOrchestrator(
            process.env.ANTHROPIC_API_KEY,
            process.env.DEEPSEEK_API_KEY,
            process.env.QWEN_API_KEY,
            { maxRounds: 3, consensusThreshold: 0.8, enableStreaming: true }
          );

          // Stream events to client
          council.onEvent((event) => {
            socket.emit('council:event', event);
          });

          const session = await council.startSession(data.task);

          socket.emit('council:complete', {
            sessionId: session.id,
            status: session.status,
            consensus: {
              reached: session.consensus.consensusReached,
              score: session.consensus.agreementScore,
              rounds: session.consensus.round,
              decision: session.consensus.finalDecision
            },
            tokens: session.totalTokens
          });
        } catch (error) {
          console.error('Council error:', error);
          socket.emit('council:error', { error: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port)
        .on('listening', () => {
          console.log(`
╔══════════════════════════════════════════════════════════════╗
║       🤖 AlgoQBot Web Interface + AI Council                 ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${this.port}                    ║
║                                                              ║
║  Features:                                                   ║
║    💬 Chat with AlgoQBot                                     ║
║    🏛️ AI Council (Claude + DeepSeek + Qwen)                  ║
║    📊 Trading Dashboard                                      ║
║    📈 Live Metrics                                           ║
╚══════════════════════════════════════════════════════════════╝
          `);
          resolve(this.server);
        })
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${this.port} in use, trying ${this.port + 1}...`);
            this.port++;
            this.start().then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
    });
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(resolve);
    });
  }
}

module.exports = AlgoQBotChatServer;

// Allow standalone run
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const server = new AlgoQBotChatServer(null, process.env.CHAT_PORT || 9000);
  server.start();
}
