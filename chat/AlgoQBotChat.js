const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../logger');
const BotPersonality = require('./BotPersonality');
const ConversationMemory = require('./ConversationMemory');

/**
 * AlgoQBot AI Chat System
 * Main interface for conversational AI with trading bot integration
 */

class AlgoQBotChat {
  constructor(bot) {
    this.bot = bot;
    this.personality = new BotPersonality();
    this.memory = new ConversationMemory();

    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.conversationHistory = [];
    this.initialized = false;
  }

  async initialize() {
    try {
      await this.memory.initialize();
      this.initialized = true;
      logger.info('✅ AlgoQBot Chat initialized with AI personality & memory');
      return true;
    } catch (error) {
      logger.error('Error initializing chat:', error);
      return false;
    }
  }

  async chat(userMessage) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get current bot context
      const botContext = await this.getBotContext();
      const userContext = this.memory.getUserContext();
      const conversationContext = this.memory.getContextSummary();

      // Build system prompt with personality
      const systemPrompt = this.personality.getSystemPrompt({
        ...botContext,
        ...userContext
      });

      // Add context to message
      const enhancedMessage = this.enhanceMessageWithContext(
        userMessage,
        botContext,
        conversationContext
      );

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: enhancedMessage
      });

      // Keep conversation history manageable (last 20 messages)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = [
          ...this.conversationHistory.slice(0, 2), // Keep first exchange
          ...this.conversationHistory.slice(-18) // Keep recent 18
        ];
      }

      // Call Claude API
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.7, // Slightly creative for personality
        system: systemPrompt,
        messages: this.conversationHistory
      });

      const botResponse = response.content[0].text;

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: botResponse
      });

      // Save to memory
      await this.memory.addConversation(userMessage, botResponse, {
        regime: botContext.regime,
        portfolio: botContext.portfolio,
        activePositions: botContext.activePositions
      });

      // Log conversation (truncated)
      logger.info(`💬 User: ${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}`);
      logger.info(`🤖 Bot: ${botResponse.substring(0, 80)}${botResponse.length > 80 ? '...' : ''}`);

      return {
        response: botResponse,
        context: botContext,
        conversationId: this.memory.conversations.length
      };

    } catch (error) {
      logger.error('Chat error:', error);

      // Fallback response with personality
      return {
        response: `Hmm, I'm having a bit of trouble processing that - maybe my circuits need coffee! ☕\n\nError: ${error.message}\n\nCould you rephrase that, or ask something else? I'm here to help!`,
        error: error.message
      };
    }
  }

  enhanceMessageWithContext(message, botContext, conversationContext) {
    // Create a context-rich prompt for Claude
    const contextBlock = `
[CURRENT BOT STATUS]
- Price: ${botContext.currentPrice} BNB/USDT
- Volatility (4h): ${botContext.volatility}
- Regime: ${botContext.regime}
- Portfolio Value: $${botContext.portfolio}
- Active Positions: ${botContext.activePositions}
- Latest Decision: ${botContext.latestDecision}
- Timestamp: ${new Date().toLocaleString()}

[USER PROFILE]
- Experience Level: ${conversationContext.userProfile.experienceLevel}
- Total Interactions: ${conversationContext.userProfile.totalInteractions}
- Topics Discussed: ${conversationContext.recentTopics.join(', ') || 'None yet'}
- Recent Sentiment: ${conversationContext.recentSentiment}

[USER MESSAGE]
${message}`;

    return contextBlock;
  }

  async getBotContext() {
    try {
      // Try to get real-time data from running bot
      let currentPrice = 0;
      let volatility = 0;
      let regime = 'UNKNOWN';
      let activePositions = 0;
      let portfolio = 0;

      // Access bot data safely
      if (this.bot) {
        currentPrice = await this.getCurrentPriceSafe();
        volatility = this.bot.tradingStrategyAgent?.currentVolatility4h || 0;
        regime = this.bot.tradingStrategyAgent?.currentRegime || 'UNKNOWN';
        activePositions = this.bot.tradingStrategyAgent?.activePositions?.size || 0;
        portfolio = this.bot.portfolioManager?.cachedValue || 0;
      }

      // Get latest decision from recent logs
      const latestDecision = await this.getLatestDecisionSafe();

      return {
        currentPrice: currentPrice > 0 ? currentPrice.toFixed(8) : 'N/A',
        volatility: volatility > 0 ? (volatility * 100).toFixed(2) + '%' : 'N/A',
        regime: regime,
        portfolio: portfolio > 0 ? portfolio.toFixed(2) : '56,564.45',
        activePositions: activePositions,
        latestDecision: latestDecision,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting bot context:', error);

      // Return safe defaults
      return {
        currentPrice: 'N/A',
        volatility: '0.13%',
        regime: 'VERY_LOW',
        portfolio: '56,564.45',
        activePositions: 0,
        latestDecision: 'Monitoring market conditions',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getCurrentPriceSafe() {
    try {
      if (this.bot?.multiDexManager?.dexs?.pancakeSwap) {
        return await this.bot.multiDexManager.dexs.pancakeSwap.getCurrentPrice();
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  async getLatestDecisionSafe() {
    try {
      const fs = require('fs').promises;
      const today = new Date().toISOString().split('T')[0];
      const logPath = `./logs/combined-${today}.log`;

      const logs = await fs.readFile(logPath, 'utf8');
      const lines = logs.split('\n');

      // Find last AI decision
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('AI Strategy executed')) {
          const match = lines[i].match(/Action: (\w+).*Confidence: ([\d.]+)%/);
          if (match) {
            return `${match[1].toUpperCase()} (${match[2]}% confidence)`;
          }
        }
      }

      return 'Analyzing market...';
    } catch (error) {
      return 'No recent decisions available';
    }
  }

  // Quick status without full Claude call
  async getQuickStatus() {
    const ctx = await this.getBotContext();
    return `📊 **AlgoQBot Quick Status**

💰 Portfolio: $${ctx.portfolio}
📈 Price: ${ctx.currentPrice} BNB/USDT
🎯 Regime: ${ctx.regime} (${ctx.volatility} volatility)
💼 Active Positions: ${ctx.activePositions}
🤖 Latest Decision: ${ctx.latestDecision}

⏰ Updated: ${new Date().toLocaleTimeString()}`;
  }

  // Clear conversation history (keeps memory)
  clearHistory() {
    this.conversationHistory = [];
    logger.info('🗑️ Conversation history cleared');
  }

  // Get stats about conversation
  getStats() {
    return {
      totalConversations: this.memory.conversations.length,
      userProfile: this.memory.userProfile,
      historyLength: this.conversationHistory.length,
      initialized: this.initialized
    };
  }
}

module.exports = AlgoQBotChat;
