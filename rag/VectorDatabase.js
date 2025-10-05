let MilvusClient;
try {
  MilvusClient = require('@milvus-io/milvus-sdk-node').MilvusClient;
} catch (error) {
  console.log('Milvus SDK not available, using mock mode');
  MilvusClient = null;
}
let OpenAI;
try {
  OpenAI = require('openai').OpenAI;
} catch (error) {
  console.log('OpenAI SDK not available, using mock mode');
  OpenAI = null;
}
const logger = require('../logger');

class VectorDatabase {
  constructor() {
    this.client = null;
    this.openai = null;
    this.isConnected = false;
    this.collections = {
      market_data: 'market_data_vectors',
      news_articles: 'news_article_vectors',
      trading_logs: 'trading_log_vectors',
      strategies: 'strategy_vectors'
    };
  }

  async initialize() {
    try {
      logger.info('🔗 Initializing vector database...');
      
      // Initialize Milvus client
      if (MilvusClient) {
        this.client = new MilvusClient({
          address: process.env.MILVUS_HOST || 'localhost:19530',
          username: process.env.MILVUS_USERNAME || '',
          password: process.env.MILVUS_PASSWORD || ''
        });
      } else {
        throw new Error('Milvus SDK not available');
      }

      // Initialize OpenAI client
      if (OpenAI) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      } else {
        this.openai = null;
      }

      // Test connection
      await this.client.hasCollection({
        collection_name: 'test'
      });

      this.isConnected = true;
      logger.info('✅ Vector database connected successfully');

      // Create collections if they don't exist
      await this.createCollections();

      return true;
    } catch (error) {
      logger.error('❌ Error initializing vector database:', error);
      // Fallback to mock mode if Milvus is not available
      logger.warn('🔄 Falling back to mock vector database mode');
      this.isConnected = false;
      return false;
    }
  }

  async createCollections() {
    try {
      for (const [key, collectionName] of Object.entries(this.collections)) {
        const exists = await this.client.hasCollection({
          collection_name: collectionName
        });

        if (!exists) {
          await this.client.createCollection({
            collection_name: collectionName,
            dimension: 1536, // OpenAI embedding dimension
            metric_type: 'COSINE',
            auto_id: true,
            enable_dynamic_field: true
          });

          // Create index for faster search
          await this.client.createIndex({
            collection_name: collectionName,
            field_name: 'vector',
            index_type: 'IVF_FLAT',
            metric_type: 'COSINE',
            params: { nlist: 1024 }
          });

          logger.info(`✅ Created collection: ${collectionName}`);
        }
      }

      // Load collections for search
      for (const collectionName of Object.values(this.collections)) {
        await this.client.loadCollection({
          collection_name: collectionName
        });
      }

    } catch (error) {
      logger.error('Error creating collections:', error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    try {
      if (!this.openai) {
        // Mock embedding for fallback mode
        return this.generateMockEmbedding(text);
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      return this.generateMockEmbedding(text);
    }
  }

  generateMockEmbedding(text) {
    // Generate a deterministic mock embedding based on text hash
    const hash = this.simpleHash(text);
    const embedding = [];
    
    for (let i = 0; i < 1536; i++) {
      embedding.push(Math.sin(hash + i) * 0.1);
    }
    
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async storeMarketData(data) {
    try {
      if (!this.isConnected) {
        logger.warn('Vector database not connected, skipping storage');
        return;
      }

      const text = `${data.symbol} ${data.price} ${data.volume} ${data.timestamp}`;
      const embedding = await this.generateEmbedding(text);

      await this.client.insert({
        collection_name: this.collections.market_data,
        data: [{
          vector: embedding,
          symbol: data.symbol,
          price: data.price,
          volume: data.volume,
          timestamp: data.timestamp,
          metadata: JSON.stringify(data)
        }]
      });

      logger.debug('Stored market data in vector database');
    } catch (error) {
      logger.error('Error storing market data:', error);
    }
  }

  async storeNewsArticle(article) {
    try {
      if (!this.isConnected) {
        logger.warn('Vector database not connected, skipping storage');
        return;
      }

      const text = `${article.title} ${article.content}`;
      const embedding = await this.generateEmbedding(text);

      await this.client.insert({
        collection_name: this.collections.news_articles,
        data: [{
          vector: embedding,
          title: article.title,
          content: article.content,
          source: article.source,
          url: article.url,
          published_at: article.published_at,
          sentiment: article.sentiment,
          relevance_score: article.relevance_score,
          metadata: JSON.stringify(article)
        }]
      });

      logger.debug('Stored news article in vector database');
    } catch (error) {
      logger.error('Error storing news article:', error);
    }
  }

  async storeTradingLog(log) {
    try {
      if (!this.isConnected) {
        logger.warn('Vector database not connected, skipping storage');
        return;
      }

      const text = `${log.action} ${log.pair} ${log.amount} ${log.price} ${log.reasoning}`;
      const embedding = await this.generateEmbedding(text);

      await this.client.insert({
        collection_name: this.collections.trading_logs,
        data: [{
          vector: embedding,
          action: log.action,
          pair: log.pair,
          amount: log.amount,
          price: log.price,
          timestamp: log.timestamp,
          reasoning: log.reasoning,
          success: log.success,
          metadata: JSON.stringify(log)
        }]
      });

      logger.debug('Stored trading log in vector database');
    } catch (error) {
      logger.error('Error storing trading log:', error);
    }
  }

  async searchMarketData(query, limit = 10) {
    try {
      if (!this.isConnected) {
        return this.mockSearch(query, limit);
      }

      const embedding = await this.generateEmbedding(query);

      const results = await this.client.search({
        collection_name: this.collections.market_data,
        vector: embedding,
        limit,
        output_fields: ['symbol', 'price', 'volume', 'timestamp', 'metadata']
      });

      return results.map(result => ({
        score: result.score,
        data: JSON.parse(result.metadata || '{}'),
        symbol: result.symbol,
        price: result.price,
        volume: result.volume,
        timestamp: result.timestamp
      }));
    } catch (error) {
      logger.error('Error searching market data:', error);
      return this.mockSearch(query, limit);
    }
  }

  async searchNewsArticles(query, limit = 10) {
    try {
      if (!this.isConnected) {
        return this.mockSearch(query, limit);
      }

      const embedding = await this.generateEmbedding(query);

      const results = await this.client.search({
        collection_name: this.collections.news_articles,
        vector: embedding,
        limit,
        output_fields: ['title', 'content', 'source', 'url', 'published_at', 'sentiment', 'relevance_score']
      });

      return results.map(result => ({
        score: result.score,
        title: result.title,
        content: result.content,
        source: result.source,
        url: result.url,
        published_at: result.published_at,
        sentiment: result.sentiment,
        relevance_score: result.relevance_score
      }));
    } catch (error) {
      logger.error('Error searching news articles:', error);
      return this.mockSearch(query, limit);
    }
  }

  async searchTradingLogs(query, limit = 10) {
    try {
      if (!this.isConnected) {
        return this.mockSearch(query, limit);
      }

      const embedding = await this.generateEmbedding(query);

      const results = await this.client.search({
        collection_name: this.collections.trading_logs,
        vector: embedding,
        limit,
        output_fields: ['action', 'pair', 'amount', 'price', 'timestamp', 'reasoning', 'success']
      });

      return results.map(result => ({
        score: result.score,
        action: result.action,
        pair: result.pair,
        amount: result.amount,
        price: result.price,
        timestamp: result.timestamp,
        reasoning: result.reasoning,
        success: result.success
      }));
    } catch (error) {
      logger.error('Error searching trading logs:', error);
      return this.mockSearch(query, limit);
    }
  }

  async searchStrategies(query, limit = 5) {
    try {
      if (!this.isConnected) {
        return this.mockSearch(query, limit);
      }

      const embedding = await this.generateEmbedding(query);

      const results = await this.client.search({
        collection_name: this.collections.strategies,
        vector: embedding,
        limit,
        output_fields: ['strategy_name', 'description', 'performance', 'parameters']
      });

      return results.map(result => ({
        score: result.score,
        strategy_name: result.strategy_name,
        description: result.description,
        performance: result.performance,
        parameters: result.parameters
      }));
    } catch (error) {
      logger.error('Error searching strategies:', error);
      return this.mockSearch(query, limit);
    }
  }

  async getRelevantContext(query, contextTypes = ['market_data', 'news_articles', 'trading_logs']) {
    try {
      const context = {};

      for (const type of contextTypes) {
        switch (type) {
          case 'market_data':
            context.market_data = await this.searchMarketData(query, 5);
            break;
          case 'news_articles':
            context.news_articles = await this.searchNewsArticles(query, 5);
            break;
          case 'trading_logs':
            context.trading_logs = await this.searchTradingLogs(query, 5);
            break;
          case 'strategies':
            context.strategies = await this.searchStrategies(query, 3);
            break;
        }
      }

      return context;
    } catch (error) {
      logger.error('Error getting relevant context:', error);
      return {};
    }
  }

  mockSearch(query, limit) {
    // Return mock search results when vector database is not available
    const results = [];
    for (let i = 0; i < limit; i++) {
      results.push({
        score: Math.random() * 0.5 + 0.5,
        data: {
          mock: true,
          query,
          index: i
        }
      });
    }
    return results;
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          message: 'Vector database not connected (mock mode)',
          timestamp: new Date()
        };
      }

      const health = await this.client.getMetric({
        request: { metric_type: 'system_info' }
      });

      return {
        status: 'healthy',
        message: 'Vector database is operational',
        timestamp: new Date(),
        collections: Object.keys(this.collections).length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        timestamp: new Date()
      };
    }
  }

  async close() {
    try {
      if (this.client && this.isConnected) {
        await this.client.closeConnection();
        this.isConnected = false;
        logger.info('Vector database connection closed');
      }
    } catch (error) {
      logger.error('Error closing vector database:', error);
    }
  }
}

module.exports = VectorDatabase;
