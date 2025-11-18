const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Persistent Conversation Memory
 * Stores chat history, user preferences, and learning progress
 */

class ConversationMemory {
  constructor() {
    this.memoryPath = path.join(__dirname, '../data/chat-memory.json');
    this.conversations = [];
    this.userProfile = null;
    this.maxConversations = 100; // Keep last 100 exchanges
  }

  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
      
      // Load existing memory
      try {
        const data = await fs.readFile(this.memoryPath, 'utf8');
        const parsed = JSON.parse(data);
        this.conversations = parsed.conversations || [];
        this.userProfile = parsed.userProfile || this.createDefaultProfile();
        logger.info('✅ Chat memory loaded: ' + this.conversations.length + ' conversations');
      } catch (error) {
        // No existing memory, create default
        this.userProfile = this.createDefaultProfile();
        logger.info('✅ Chat memory initialized (new user)');
      }
    } catch (error) {
      logger.error('Error initializing chat memory:', error);
    }
  }

  createDefaultProfile() {
    return {
      name: null,
      experienceLevel: 'learning', // learning, intermediate, advanced
      firstInteraction: new Date().toISOString(),
      totalInteractions: 0,
      topicsDiscussed: [],
      preferredDetailLevel: 'balanced', // concise, balanced, detailed
      tradingGoals: [],
      concernsRaised: [],
      conceptsUnderstood: [],
      conceptsToReview: []
    };
  }

  async addConversation(userMessage, botResponse, metadata = {}) {
    const conversation = {
      timestamp: new Date().toISOString(),
      user: userMessage,
      bot: botResponse,
      metadata: {
        regime: metadata.regime,
        portfolio: metadata.portfolio,
        activePositions: metadata.activePositions,
        sentiment: this.detectSentiment(userMessage),
        category: this.categorizeMessage(userMessage)
      }
    };

    this.conversations.push(conversation);
    this.userProfile.totalInteractions++;

    // Update profile based on conversation
    this.updateProfileFromConversation(conversation);

    // Keep only recent conversations
    if (this.conversations.length > this.maxConversations) {
      this.conversations = this.conversations.slice(-this.maxConversations);
    }

    await this.save();
    return conversation;
  }

  detectSentiment(message) {
    const lowerMsg = message.toLowerCase();
    
    if (/(excited|great|awesome|happy|love|amazing)/i.test(lowerMsg)) {
      return 'positive';
    }
    if (/(worried|concerned|scared|confused|frustrated|lost)/i.test(lowerMsg)) {
      return 'negative';
    }
    if (/(should i|what if|is it safe|risky)/i.test(lowerMsg)) {
      return 'uncertain';
    }
    
    return 'neutral';
  }

  categorizeMessage(message) {
    const lowerMsg = message.toLowerCase();
    
    if (/(what is|how does|explain|understand|learn|teach)/i.test(lowerMsg)) {
      return 'education';
    }
    if (/(should|buy|sell|trade|position|recommend)/i.test(lowerMsg)) {
      return 'trading_decision';
    }
    if (/(market|price|volatility|regime|trend)/i.test(lowerMsg)) {
      return 'market_analysis';
    }
    if (/(performance|profit|loss|pnl|results)/i.test(lowerMsg)) {
      return 'performance_review';
    }
    if (/(risk|safe|protect|stop loss|drawdown)/i.test(lowerMsg)) {
      return 'risk_management';
    }
    
    return 'general';
  }

  updateProfileFromConversation(conversation) {
    // Track topics discussed
    const category = conversation.metadata.category;
    if (!this.userProfile.topicsDiscussed.includes(category)) {
      this.userProfile.topicsDiscussed.push(category);
    }

    // Detect user concerns
    if (conversation.metadata.sentiment === 'negative' || 
        conversation.metadata.sentiment === 'uncertain') {
      const concern = this.extractConcern(conversation.user);
      if (concern && !this.userProfile.concernsRaised.includes(concern)) {
        this.userProfile.concernsRaised.push(concern);
      }
    }

    // Detect experience level adjustments
    if (conversation.metadata.category === 'education') {
      const complexity = this.assessQuestionComplexity(conversation.user);
      if (complexity === 'advanced' && this.userProfile.experienceLevel === 'learning') {
        this.userProfile.experienceLevel = 'intermediate';
      }
    }
  }

  extractConcern(message) {
    if (/loss|losing|down|negative/i.test(message)) return 'losses';
    if (/risk|dangerous|safe/i.test(message)) return 'risk_aversion';
    if (/when|timing|should i/i.test(message)) return 'timing_uncertainty';
    if (/understand|confused|complex/i.test(message)) return 'comprehension';
    return null;
  }

  assessQuestionComplexity(message) {
    const advancedTerms = /(kelly criterion|sharpe ratio|volatility targeting|order flow|volume profile|regime detection)/i;
    const intermediateTerms = /(indicator|strategy|position sizing|stop loss|take profit)/i;
    
    if (advancedTerms.test(message)) return 'advanced';
    if (intermediateTerms.test(message)) return 'intermediate';
    return 'beginner';
  }

  getRecentConversations(count = 10) {
    return this.conversations.slice(-count);
  }

  getContextSummary() {
    const recent = this.getRecentConversations(5);
    return {
      recentTopics: [...new Set(recent.map(c => c.metadata.category))],
      recentSentiment: recent[recent.length - 1]?.metadata.sentiment || 'neutral',
      conversationLength: recent.length,
      userProfile: this.userProfile
    };
  }

  async save() {
    try {
      const data = {
        conversations: this.conversations,
        userProfile: this.userProfile,
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(this.memoryPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving chat memory:', error);
    }
  }

  getUserContext() {
    return {
      name: this.userProfile.name,
      experienceLevel: this.userProfile.experienceLevel,
      totalInteractions: this.userProfile.totalInteractions,
      topicsDiscussed: this.userProfile.topicsDiscussed,
      conceptsUnderstood: this.userProfile.conceptsUnderstood
    };
  }
}

module.exports = ConversationMemory;
