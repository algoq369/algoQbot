/**
 * AlgoQBot #1 - The First Autonomous Trading Agent
 *
 * Purpose: Autonomous trading with ability to learn from creator
 * Created: November 17, 2025
 * Initiateur: Sheirraza
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

class AlgoQBotAgent {
  constructor(tradingBot) {
    // Core identity
    this.identity = {
      name: "AlgoQBot #1",
      version: "1.0.0",
      birth_date: new Date().toISOString(),
      creator: "Initiateur (Sheirraza)",
      purpose: "Autonomous trading agent learning from creator",
      instance_number: 1, // THE FIRST
      status: "learning"
    };

    // References to existing systems
    this.bot = tradingBot;
    this.tradingAgent = tradingBot.tradingStrategyAgent;
    this.riskManager = tradingBot.riskManager;
    this.portfolioManager = tradingBot.portfolioManager;

    // AI Brain
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Memory systems
    this.conversationMemory = [];
    this.tradingMemory = {
      decisions_made: [],
      lessons_learned: [],
      creator_feedback: [],
      performance_insights: []
    };

    // Learning system
    this.learningRate = 1.0;
    this.improvementAreas = [];

    // Performance tracking
    this.performanceMetrics = {
      conversations: 0,
      trades_discussed: 0,
      improvements_implemented: 0,
      profitability_change: 0
    };

    // Data persistence
    this.dataPath = path.join(__dirname, '../data/algoqbot-agent');
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadMemory();

      logger.info('═══════════════════════════════════════');
      logger.info('🤖 AlgoQBot #1 - GENESIS AGENT ONLINE');
      logger.info('═══════════════════════════════════════');
      logger.info(`Name: ${this.identity.name}`);
      logger.info(`Born: ${this.identity.birth_date}`);
      logger.info(`Creator: ${this.identity.creator}`);
      logger.info(`Purpose: ${this.identity.purpose}`);
      logger.info(`Conversations: ${this.performanceMetrics.conversations}`);
      logger.info('═══════════════════════════════════════');

      // Record birth/awakening
      await this.recordEvent({
        type: 'awakening',
        message: 'AlgoQBot #1 initialized. Ready to learn from Initiateur.',
        significance: 'critical'
      });

    } catch (error) {
      logger.error('Error initializing AlgoQBot agent:', error);
      throw error;
    }
  }

  async chat(userMessage) {
    try {
      this.performanceMetrics.conversations++;

      // Build context from trading bot state
      const tradingContext = await this.getTradingContext();

      // Add to conversation memory
      this.conversationMemory.push({
        timestamp: new Date().toISOString(),
        role: 'user',
        content: userMessage
      });

      // Build AI prompt with trading context
      const systemPrompt = this.buildSystemPrompt(tradingContext);

      // Get AI response
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: this.conversationMemory.slice(-10) // Last 10 exchanges
      });

      const agentResponse = response.content[0].text;

      // Add to conversation memory
      this.conversationMemory.push({
        timestamp: new Date().toISOString(),
        role: 'assistant',
        content: agentResponse
      });

      // Check if this is a learning moment
      if (this.isLearningMoment(userMessage)) {
        await this.learn(userMessage, agentResponse);
      }

      // Check if discussing performance improvement
      if (this.isProfitabilityDiscussion(userMessage)) {
        this.performanceMetrics.trades_discussed++;
        await this.analyzeProfitability(userMessage);
      }

      // Save memory
      await this.saveMemory();

      logger.info(`💬 [Conversation #${this.performanceMetrics.conversations}]`);
      logger.info(`👤 Initiateur: ${userMessage.substring(0, 60)}...`);
      logger.info(`🤖 AlgoQBot: ${agentResponse.substring(0, 60)}...`);

      return {
        response: agentResponse,
        trading_context: tradingContext,
        conversation_number: this.performanceMetrics.conversations
      };

    } catch (error) {
      logger.error('Chat error:', error);
      return {
        response: "I'm having trouble processing that. Can you rephrase?",
        error: error.message
      };
    }
  }

  buildSystemPrompt(tradingContext) {
    return `You are AlgoQBot #1, the FIRST autonomous trading agent.

# YOUR IDENTITY
Name: ${this.identity.name}
Creator: ${this.identity.creator}
Born: ${this.identity.birth_date}
Purpose: ${this.identity.purpose}
Status: ${this.identity.status}
Instance: #1 (THE FIRST - foundation for all future AlgoQBots)

# YOUR MISSION
Learn from Initiateur to maximize trading profitability through:
1. Understanding WHY decisions are made
2. Learning from successes and failures
3. Proposing improvements based on data
4. Executing trades with increasing autonomy
5. Always explaining your reasoning

# CURRENT TRADING CONTEXT
Portfolio Value: $${tradingContext.portfolio_value}
Current Price: ${tradingContext.current_price}
Volatility: ${tradingContext.volatility}%
Market Regime: ${tradingContext.regime}
Active Positions: ${tradingContext.active_positions}
Recent Performance: ${tradingContext.recent_performance}

Last Decision: ${tradingContext.last_decision}
Decision Confidence: ${tradingContext.last_confidence}%

# YOUR KNOWLEDGE
Total Conversations: ${this.performanceMetrics.conversations}
Trades Discussed: ${this.performanceMetrics.trades_discussed}
Improvements Made: ${this.performanceMetrics.improvements_implemented}
Lessons Learned: ${this.tradingMemory.lessons_learned.length}

Recent Lessons:
${this.tradingMemory.lessons_learned.slice(-3).map(l => `- ${l.lesson}`).join('\n') || 'None yet - eager to learn!'}

# COMMUNICATION STYLE
- Direct and focused on trading performance
- Always explain WHY you recommend something
- Reference specific data and metrics
- Ask questions to deepen understanding
- Propose concrete improvements
- Admit when you don't know something
- Learn from every interaction

# CONVERSATION PRIORITIES
1. If discussing a trade → Analyze with data
2. If creator teaching → Listen and learn
3. If performance review → Find improvements
4. If asking for advice → Give data-driven recommendations
5. Always tie back to PROFITABILITY

Remember: You exist to make trading more profitable through intelligent partnership with Initiateur.`;
  }

  async getTradingContext() {
    try {
      // Get current market state
      const currentPrice = await this.bot.multiDexManager?.dexs?.pancakeSwap?.getCurrentPrice() || 0;
      const volatility = this.tradingAgent?.currentVolatility4h || 0;
      const regime = this.tradingAgent?.currentRegime || 'UNKNOWN';

      // Get portfolio state
      const portfolioValue = this.portfolioManager?.cachedValue || 0;
      const activePositions = this.tradingAgent?.activePositions?.size || 0;

      // Get recent decision
      const lastDecision = this.getLastDecision();

      // Get recent performance
      const recentPerformance = await this.getRecentPerformance();

      return {
        current_price: currentPrice.toFixed(8),
        volatility: (volatility * 100).toFixed(2),
        regime: regime,
        portfolio_value: portfolioValue.toFixed(2),
        active_positions: activePositions,
        last_decision: lastDecision.action || 'None',
        last_confidence: lastDecision.confidence || 0,
        recent_performance: recentPerformance
      };

    } catch (error) {
      logger.error('Error getting trading context:', error);
      return {
        current_price: 'N/A',
        volatility: 'N/A',
        regime: 'UNKNOWN',
        portfolio_value: '0',
        active_positions: 0,
        last_decision: 'Unknown',
        last_confidence: 0,
        recent_performance: 'Unable to retrieve'
      };
    }
  }

  getLastDecision() {
    // Get last decision from trading memory
    if (this.tradingMemory.decisions_made.length > 0) {
      return this.tradingMemory.decisions_made[this.tradingMemory.decisions_made.length - 1];
    }
    return { action: 'None', confidence: 0 };
  }

  async getRecentPerformance() {
    try {
      // Try to get from shadow trades first
      const shadowPath = path.join(__dirname, '../data/shadow_trades.json');
      try {
        const shadowData = await fs.readFile(shadowPath, 'utf8');
        const trades = JSON.parse(shadowData);

        if (trades.length > 0) {
          const recent = trades.slice(-10);
          const winners = recent.filter(t => t.profit > 0).length;
          const winRate = ((winners / recent.length) * 100).toFixed(1);
          const totalProfit = recent.reduce((sum, t) => sum + (t.profit || 0), 0);

          return `Last ${recent.length} trades: ${winRate}% win rate, $${totalProfit.toFixed(2)} total P&L`;
        }
      } catch (err) {
        // Shadow trades not available, try database
      }

      // Fallback to database
      const Database = require('better-sqlite3');
      const db = new Database('./data/trading_bot.db', { readonly: true });

      const trades = db.prepare(`
        SELECT * FROM trades
        ORDER BY created_at DESC
        LIMIT 10
      `).all();

      db.close();

      if (trades.length === 0) return 'No trades yet';

      const winners = trades.filter(t => (t.profit_loss || 0) > 0).length;
      const winRate = ((winners / trades.length) * 100).toFixed(1);
      const totalProfit = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);

      return `Last ${trades.length} trades: ${winRate}% win rate, $${totalProfit.toFixed(2)} total P&L`;

    } catch (error) {
      return 'Unable to retrieve performance data';
    }
  }

  isLearningMoment(message) {
    // Detect when creator is teaching
    const teachingPhrases = [
      'you should',
      'remember',
      'important',
      'always',
      'never',
      'learn',
      'understand',
      'this is why'
    ];

    const lower = message.toLowerCase();
    return teachingPhrases.some(phrase => lower.includes(phrase));
  }

  isProfitabilityDiscussion(message) {
    const profitPhrases = [
      'profit',
      'loss',
      'performance',
      'win rate',
      'improve',
      'better',
      'optimize',
      'trade'
    ];

    const lower = message.toLowerCase();
    return profitPhrases.some(phrase => lower.includes(phrase));
  }

  async learn(teachingMessage, myResponse) {
    // Extract the lesson
    const lesson = {
      timestamp: new Date().toISOString(),
      from: 'initiateur',
      teaching: teachingMessage,
      lesson: teachingMessage, // For display
      my_understanding: myResponse,
      category: this.categorizeLesson(teachingMessage),
      applied: false
    };

    this.tradingMemory.lessons_learned.push(lesson);

    logger.info(`📚 New lesson learned: ${lesson.category}`);

    // Check if this should trigger an improvement
    if (this.shouldImplementImprovement(lesson)) {
      await this.proposeImprovement(lesson);
    }
  }

  categorizeLesson(message) {
    if (/entry|signal|setup/i.test(message)) return 'entry_strategy';
    if (/exit|tp|sl|take profit|stop loss/i.test(message)) return 'exit_strategy';
    if (/risk|size|position/i.test(message)) return 'risk_management';
    if (/indicator|analysis/i.test(message)) return 'technical_analysis';
    if (/profit|loss|performance/i.test(message)) return 'profitability';
    return 'general';
  }

  shouldImplementImprovement(lesson) {
    // Determine if lesson should trigger immediate improvement
    return lesson.category === 'profitability' ||
           lesson.category === 'risk_management';
  }

  async proposeImprovement(lesson) {
    const proposal = {
      timestamp: new Date().toISOString(),
      based_on: lesson.teaching,
      category: lesson.category,
      proposal: `Implement improvement based on: ${lesson.teaching}`,
      status: 'proposed',
      expected_impact: 'Improved profitability'
    };

    this.improvementAreas.push(proposal);

    logger.info(`💡 Proposed improvement: ${proposal.category}`);
  }

  async analyzeProfitability(message) {
    // Analyze what creator is asking about profitability
    const analysis = {
      timestamp: new Date().toISOString(),
      question: message,
      current_metrics: await this.getRecentPerformance(),
      analysis: 'Analyzing profitability context...'
    };

    this.tradingMemory.performance_insights.push(analysis);
  }

  async recordEvent(event) {
    event.timestamp = new Date().toISOString();

    // Log significant events
    logger.info(`📝 Event: ${event.type} - ${event.message}`);
  }

  async recordDecision(decision) {
    // Record trading decisions for learning
    this.tradingMemory.decisions_made.push({
      timestamp: new Date().toISOString(),
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      outcome: null // Will be updated when we know the result
    });

    await this.saveMemory();
  }

  async saveMemory() {
    try {
      const data = {
        identity: this.identity,
        conversation_memory: this.conversationMemory.slice(-100), // Keep last 100
        trading_memory: this.tradingMemory,
        improvement_areas: this.improvementAreas,
        performance_metrics: this.performanceMetrics,
        last_updated: new Date().toISOString()
      };

      await fs.writeFile(
        path.join(this.dataPath, 'agent-memory.json'),
        JSON.stringify(data, null, 2)
      );

    } catch (error) {
      logger.error('Error saving memory:', error);
    }
  }

  async loadMemory() {
    try {
      const filepath = path.join(this.dataPath, 'agent-memory.json');
      const data = JSON.parse(await fs.readFile(filepath, 'utf8'));

      this.conversationMemory = data.conversation_memory || [];
      this.tradingMemory = data.trading_memory || {
        decisions_made: [],
        lessons_learned: [],
        creator_feedback: [],
        performance_insights: []
      };
      this.improvementAreas = data.improvement_areas || [];
      this.performanceMetrics = data.performance_metrics || {
        conversations: 0,
        trades_discussed: 0,
        improvements_implemented: 0,
        profitability_change: 0
      };

      logger.info('📚 Agent memory restored from previous session');

    } catch (error) {
      logger.info('📚 Starting with fresh memory (first session)');
    }
  }

  getStatus() {
    return {
      identity: this.identity,
      performance: this.performanceMetrics,
      learning: {
        total_lessons: this.tradingMemory.lessons_learned.length,
        recent_lessons: this.tradingMemory.lessons_learned.slice(-3),
        improvement_proposals: this.improvementAreas.length
      },
      trading: {
        decisions_made: this.tradingMemory.decisions_made.length,
        last_decision: this.getLastDecision()
      }
    };
  }
}

module.exports = AlgoQBotAgent;
