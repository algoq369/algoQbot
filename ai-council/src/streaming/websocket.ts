/**
 * AI Council - WebSocket Streaming Server
 * Real-time streaming of council deliberations to web clients
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { CouncilOrchestrator } from '../orchestrator/engine.js';
import { StreamEvent, AIProvider } from '../types/index.js';

// Load API keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const QWEN_API_KEY = process.env.QWEN_API_KEY || '';

const PORT = process.env.COUNCIL_PORT || 3030;

// Create Express app and Socket.IO server
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files for web UI
app.use(express.static('web'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoint to get session stats
app.get('/api/session', (req, res) => {
  if (!activeCouncil) {
    res.json({ status: 'no_active_session' });
    return;
  }
  const session = activeCouncil.getSession();
  res.json(session);
});

// Store active council per socket
let activeCouncil: CouncilOrchestrator | null = null;

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send welcome message
  socket.emit('welcome', {
    message: 'Connected to AI Council',
    participants: ['claude', 'deepseek', 'qwen'],
    timestamp: new Date().toISOString()
  });

  // Handle new council session request
  socket.on('start_session', async (data: { task: string; config?: any }) => {
    console.log(`Starting session: ${data.task}`);

    // Create new council
    activeCouncil = new CouncilOrchestrator(
      ANTHROPIC_API_KEY,
      DEEPSEEK_API_KEY,
      QWEN_API_KEY,
      {
        maxRounds: data.config?.maxRounds || 3,
        consensusThreshold: data.config?.consensusThreshold || 0.8,
        enableStreaming: true,
        enableReasoning: true
      }
    );

    // Set up event streaming to client
    activeCouncil.onEvent((event: StreamEvent) => {
      socket.emit('council_event', event);

      // Also broadcast to all clients
      socket.broadcast.emit('council_event', event);
    });

    try {
      const session = await activeCouncil.startSession(data.task);

      socket.emit('session_complete', {
        sessionId: session.id,
        status: session.status,
        consensus: {
          reached: session.consensus.consensusReached,
          score: session.consensus.agreementScore,
          rounds: session.consensus.round,
          decision: session.consensus.finalDecision
        },
        tokens: session.totalTokens,
        duration: session.endTime
          ? session.endTime.getTime() - session.startTime.getTime()
          : 0
      });
    } catch (error) {
      socket.emit('error', { message: String(error) });
    }
  });

  // Handle user injection (add comment during deliberation)
  socket.on('inject_message', async (data: { message: string }) => {
    if (!activeCouncil) {
      socket.emit('error', { message: 'No active session' });
      return;
    }

    try {
      await activeCouncil.injectUserMessage(data.message);
    } catch (error) {
      socket.emit('error', { message: String(error) });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🏛️  AI COUNCIL - WebSocket Server                  ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                    ║
║                                                              ║
║  Endpoints:                                                  ║
║    GET  /health     - Health check                           ║
║    GET  /api/session - Get current session                   ║
║    WS   /           - WebSocket for real-time events         ║
║                                                              ║
║  WebSocket Events:                                           ║
║    → start_session  - Start new council session              ║
║    → inject_message - Add user comment during session        ║
║    ← council_event  - Real-time council events               ║
║    ← session_complete - Session finished                     ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export { app, io, httpServer };
