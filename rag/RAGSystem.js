const VectorDatabase = require('./VectorDatabase');
let OpenAI;
try {
  OpenAI = require('openai').OpenAI;
} catch (error) {
  console.log('OpenAI SDK not available, using mock mode');
  OpenAI = null;
}
const logger = require('../logger');

class RAGSystem {
  constructor() {
    this.vectorDB = new VectorDatabase();
    this.openai = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('🧠 Initializing RAG system...');
      
      // Initialize vector database
      await this.vectorDB.initialize();
      
      // Initialize OpenAI
      if (OpenAI && process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.info('✅ OpenAI client initialized');
      } else {
        this.openai = null;
        logger.warn('⚠️ OpenAI API key not found or SDK not available, using mock responses');
      }

      this.isInitialized = true;
      logger.info('✅ RAG system initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('❌ Error initializing RAG system:', error);
      return false;
    }
  }

  async query(query, contextTypes = ['market_data', 'news_articles', 'trading_logs']) {
    try {
      logger.info(`🔍 RAG query: ${query}`);
      
      // Retrieve relevant context from vector database
      const context = await this.vectorDB.getRelevantContext(query, contextTypes);
      
      // Generate response using LLM
      const response = await this.generateResponse(query, context);
      
      logger.info('✅ RAG query completed successfully');
      return response;
    } catch (error) {
      logger.error('❌ Error in RAG query:', error);
      throw error;
    }
  }

  async generateResponse(query, context) {
    try {
      if (!this.openai) {
        return this.generateMockResponse(query, context);
      }

      // Prepare context for the LLM
      const contextString = this.formatContext(context);
      
      const systemPrompt = `You are an advanced trading bot AI assistant. You have access to real-time market data, news, and trading logs. 

Your role is to:
1. Analyze market conditions and provide insights
2. Answer questions about trading performance and strategies
3. Provide recommendations based on available data
4. Explain trading decisions and market movements

Always be factual, concise, and provide actionable insights. If you don't have enough information, say so clearly.`;

      const userPrompt = `Query: ${query}

Available Context:
${contextString}

Please provide a comprehensive response based on the available context.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const response = completion.choices[0].message.content;

      return {
        query,
        response,
        context: this.summarizeContext(context),
        timestamp: new Date(),
        model: 'gpt-4',
        confidence: this.calculateConfidence(context)
      };
    } catch (error) {
      logger.error('Error generating response:', error);
      return this.generateMockResponse(query, context);
    }
  }

  generateMockResponse(query, context) {
    const responses = {
      'market analysis': 'Based on the available market data, current conditions show moderate volatility with mixed sentiment indicators.',
      'trading performance': 'Trading performance metrics indicate a positive trend with recent successful trades.',
      'news sentiment': 'Recent news sentiment appears to be neutral to positive for the BSC ecosystem.',
      'strategy recommendation': 'The current ranging strategy appears to be performing well in the current market conditions.'
    };

    const queryLower = query.toLowerCase();
    let response = 'I understand your query, but I need more specific information to provide a detailed analysis.';

    for (const [key, value] of Object.entries(responses)) {
      if (queryLower.includes(key)) {
        response = value;
        break;
      }
    }

    return {
      query,
      response,
      context: this.summarizeContext(context),
      timestamp: new Date(),
      model: 'mock',
      confidence: 0.5
    };
  }

  formatContext(context) {
    let contextString = '';

    if (context.market_data && context.market_data.length > 0) {
      contextString += '\nMarket Data:\n';
      context.market_data.slice(0, 3).forEach(item => {
        contextString += `- ${item.symbol || 'Unknown'}: Price ${item.price || 'N/A'}, Volume ${item.volume || 'N/A'}\n`;
      });
    }

    if (context.news_articles && context.news_articles.length > 0) {
      contextString += '\nRecent News:\n';
      context.news_articles.slice(0, 3).forEach(article => {
        contextString += `- ${article.title || 'No title'}: ${article.sentiment || 'neutral'} sentiment\n`;
      });
    }

    if (context.trading_logs && context.trading_logs.length > 0) {
      contextString += '\nRecent Trading Activity:\n';
      context.trading_logs.slice(0, 3).forEach(log => {
        contextString += `- ${log.action || 'unknown'}: ${log.pair || 'unknown pair'} at ${log.price || 'N/A'}\n`;
      });
    }

    if (context.strategies && context.strategies.length > 0) {
      contextString += '\nStrategy Information:\n';
      context.strategies.slice(0, 2).forEach(strategy => {
        contextString += `- ${strategy.strategy_name || 'Unknown strategy'}: ${strategy.description || 'No description'}\n`;
      });
    }

    return contextString || 'No relevant context found.';
  }

  summarizeContext(context) {
    const summary = {
      market_data_count: context.market_data?.length || 0,
      news_articles_count: context.news_articles?.length || 0,
      trading_logs_count: context.trading_logs?.length || 0,
      strategies_count: context.strategies?.length || 0
    };

    return summary;
  }

  calculateConfidence(context) {
    let confidence = 0;
    let totalSources = 0;

    if (context.market_data && context.market_data.length > 0) {
      confidence += Math.min(context.market_data.length / 5, 1) * 0.3;
      totalSources++;
    }

    if (context.news_articles && context.news_articles.length > 0) {
      confidence += Math.min(context.news_articles.length / 5, 1) * 0.3;
      totalSources++;
    }

    if (context.trading_logs && context.trading_logs.length > 0) {
      confidence += Math.min(context.trading_logs.length / 5, 1) * 0.2;
      totalSources++;
    }

    if (context.strategies && context.strategies.length > 0) {
      confidence += Math.min(context.strategies.length / 3, 1) * 0.2;
      totalSources++;
    }

    // Bonus for multiple data sources
    if (totalSources > 1) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  async storeMarketData(data) {
    try {
      await this.vectorDB.storeMarketData(data);
      logger.debug('Market data stored in RAG system');
    } catch (error) {
      logger.error('Error storing market data in RAG system:', error);
    }
  }

  async storeNewsArticle(article) {
    try {
      await this.vectorDB.storeNewsArticle(article);
      logger.debug('News article stored in RAG system');
    } catch (error) {
      logger.error('Error storing news article in RAG system:', error);
    }
  }

  async storeTradingLog(log) {
    try {
      await this.vectorDB.storeTradingLog(log);
      logger.debug('Trading log stored in RAG system');
    } catch (error) {
      logger.error('Error storing trading log in RAG system:', error);
    }
  }

  async analyzeMarketConditions(query = 'current market conditions') {
    try {
      return await this.query(query, ['market_data', 'news_articles']);
    } catch (error) {
      logger.error('Error analyzing market conditions:', error);
      throw error;
    }
  }

  async analyzeTradingPerformance(query = 'trading performance analysis') {
    try {
      return await this.query(query, ['trading_logs', 'market_data']);
    } catch (error) {
      logger.error('Error analyzing trading performance:', error);
      throw error;
    }
  }

  async getNewsSentiment(query = 'news sentiment analysis') {
    try {
      return await this.query(query, ['news_articles']);
    } catch (error) {
      logger.error('Error getting news sentiment:', error);
      throw error;
    }
  }

  async recommendStrategy(query = 'strategy recommendation') {
    try {
      return await this.query(query, ['strategies', 'market_data', 'trading_logs']);
    } catch (error) {
      logger.error('Error getting strategy recommendation:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const vectorDBHealth = await this.vectorDB.healthCheck();
      
      return {
        status: this.isInitialized ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        components: {
          rag_system: this.isInitialized ? 'healthy' : 'unhealthy',
          vector_database: vectorDBHealth.status,
          openai: this.openai ? 'configured' : 'not_configured'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  async close() {
    try {
      await this.vectorDB.close();
      this.isInitialized = false;
      logger.info('RAG system closed');
    } catch (error) {
      logger.error('Error closing RAG system:', error);
    }
  }
}

module.exports = RAGSystem;
