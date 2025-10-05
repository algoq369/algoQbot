const BaseAgent = require('./BaseAgent');
const axios = require('axios');
const cheerio = require('cheerio');
const { NewsArticle } = require('../database/models');
const logger = require('../logger');

class MarketResearchAgent extends BaseAgent {
  constructor() {
    super(
      'MarketResearchAgent',
      'Researches market news, sentiment, and fundamental analysis for trading decisions'
    );
    
    this.sources = [
      {
        name: 'CoinDesk',
        url: 'https://www.coindesk.com/',
        selector: '.at-headline',
        type: 'crypto_news'
      },
      {
        name: 'CoinTelegraph',
        url: 'https://cointelegraph.com/',
        selector: '.post-card-inline__title-link',
        type: 'crypto_news'
      },
      {
        name: 'DeFiPulse',
        url: 'https://defipulse.com/',
        selector: '.defi-pulse-card',
        type: 'defi_data'
      }
    ];
  }

  async performAction(input, metadata) {
    const { action = 'research', query = 'BSC BNB USDT', timeframe = '24h' } = input;
    
    switch (action) {
      case 'research':
        return await this.researchMarket(query, timeframe);
      case 'sentiment':
        return await this.analyzeSentiment(query);
      case 'news':
        return await this.fetchLatestNews(query);
      case 'fundamental':
        return await this.analyzeFundamentals(query);
      default:
        return await this.researchMarket(query, timeframe);
    }
  }

  async researchMarket(query, timeframe) {
    try {
      logger.info(`🔍 Researching market for: ${query}`);
      
      const [news, sentiment, fundamentals] = await Promise.all([
        this.fetchLatestNews(query),
        this.analyzeSentiment(query),
        this.analyzeFundamentals(query)
      ]);

      const research = {
        query,
        timeframe,
        timestamp: new Date(),
        news: news.slice(0, 5), // Top 5 articles
        sentiment: sentiment,
        fundamentals: fundamentals,
        summary: await this.generateSummary(news, sentiment, fundamentals)
      };

      // Store relevant news articles in database
      await this.storeNewsArticles(news);

      return research;
    } catch (error) {
      logger.error('Error in market research:', error);
      throw error;
    }
  }

  async fetchLatestNews(query) {
    const articles = [];
    
    for (const source of this.sources) {
      try {
        const response = await axios.get(source.url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        const newsItems = $(source.selector).slice(0, 10);

        newsItems.each((i, element) => {
          const $el = $(element);
          const title = $el.text().trim();
          const url = $el.attr('href') || source.url;
          
          if (title && this.isRelevantToQuery(title, query)) {
            articles.push({
              title,
              url: url.startsWith('http') ? url : `${source.url}${url}`,
              source: source.name,
              type: source.type,
              published_at: new Date(),
              relevance_score: this.calculateRelevance(title, query)
            });
          }
        });

        // Add delay between requests to be respectful
        await this.delay(1000);
      } catch (error) {
        logger.warn(`Failed to fetch from ${source.name}:`, error.message);
      }
    }

    // Sort by relevance and return top articles
    return articles
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 20);
  }

  async analyzeSentiment(query) {
    try {
      // Simple sentiment analysis based on keywords
      const positiveKeywords = [
        'bullish', 'surge', 'rally', 'growth', 'adoption', 'partnership',
        'upgrade', 'launch', 'breakthrough', 'milestone', 'record'
      ];
      
      const negativeKeywords = [
        'bearish', 'crash', 'decline', 'hack', 'security', 'regulation',
        'ban', 'suspension', 'delay', 'concern', 'risk'
      ];

      const articles = await this.fetchLatestNews(query);
      let positiveCount = 0;
      let negativeCount = 0;
      let totalCount = articles.length;

      articles.forEach(article => {
        const text = article.title.toLowerCase();
        positiveCount += positiveKeywords.filter(keyword => text.includes(keyword)).length;
        negativeCount += negativeKeywords.filter(keyword => text.includes(keyword)).length;
      });

      const sentimentScore = totalCount > 0 ? (positiveCount - negativeCount) / totalCount : 0;
      
      let sentiment;
      if (sentimentScore > 0.1) sentiment = 'positive';
      else if (sentimentScore < -0.1) sentiment = 'negative';
      else sentiment = 'neutral';

      return {
        score: sentimentScore,
        sentiment,
        positive_signals: positiveCount,
        negative_signals: negativeCount,
        total_articles: totalCount,
        confidence: Math.min(totalCount / 10, 1) // Confidence based on article count
      };
    } catch (error) {
      logger.error('Error analyzing sentiment:', error);
      return {
        score: 0,
        sentiment: 'neutral',
        confidence: 0,
        error: error.message
      };
    }
  }

  async analyzeFundamentals(query) {
    try {
      // Fetch key metrics for BSC/BNB
      const metrics = {
        network_activity: await this.getNetworkActivity(),
        defi_tvl: await this.getDeFiTVL(),
        gas_metrics: await this.getGasMetrics(),
        developer_activity: await this.getDeveloperActivity()
      };

      return {
        timestamp: new Date(),
        metrics,
        score: this.calculateFundamentalScore(metrics)
      };
    } catch (error) {
      logger.error('Error analyzing fundamentals:', error);
      return {
        timestamp: new Date(),
        score: 0,
        error: error.message
      };
    }
  }

  async getNetworkActivity() {
    try {
      // This would typically call BSC APIs
      // For now, return mock data
      return {
        daily_transactions: Math.floor(Math.random() * 1000000) + 5000000,
        active_addresses: Math.floor(Math.random() * 100000) + 1000000,
        network_utilization: Math.random() * 0.8 + 0.2
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getDeFiTVL() {
    try {
      // This would call DeFi Pulse or similar APIs
      return {
        total_value_locked: Math.floor(Math.random() * 10000000000) + 50000000000,
        protocols_count: Math.floor(Math.random() * 100) + 200,
        growth_24h: (Math.random() - 0.5) * 10 // -5% to +5%
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getGasMetrics() {
    try {
      return {
        average_gas_price: Math.random() * 10 + 5, // 5-15 gwei
        gas_usage_24h: Math.floor(Math.random() * 1000000) + 5000000,
        congestion_level: Math.random() > 0.7 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getDeveloperActivity() {
    try {
      return {
        github_commits_24h: Math.floor(Math.random() * 1000) + 500,
        new_projects: Math.floor(Math.random() * 50) + 10,
        smart_contract_deployments: Math.floor(Math.random() * 200) + 100
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async generateSummary(news, sentiment, fundamentals) {
    const summary = {
      overall_sentiment: sentiment.sentiment,
      confidence: sentiment.confidence,
      key_events: news.slice(0, 3).map(article => article.title),
      fundamental_health: fundamentals.score > 0.7 ? 'strong' : fundamentals.score > 0.4 ? 'moderate' : 'weak',
      recommendation: this.generateRecommendation(sentiment, fundamentals)
    };

    return summary;
  }

  generateRecommendation(sentiment, fundamentals) {
    if (sentiment.sentiment === 'positive' && fundamentals.score > 0.6) {
      return 'bullish';
    } else if (sentiment.sentiment === 'negative' || fundamentals.score < 0.3) {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }

  isRelevantToQuery(title, query) {
    const queryTerms = query.toLowerCase().split(' ');
    const titleLower = title.toLowerCase();
    return queryTerms.some(term => titleLower.includes(term));
  }

  calculateRelevance(title, query) {
    const queryTerms = query.toLowerCase().split(' ');
    const titleLower = title.toLowerCase();
    let score = 0;
    
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) {
        score += 1;
        // Bonus for exact matches
        if (titleLower.includes(term + ' ')) score += 0.5;
      }
    });
    
    return Math.min(score / queryTerms.length, 1);
  }

  calculateFundamentalScore(metrics) {
    // Simple scoring algorithm
    let score = 0.5; // Base score
    
    if (metrics.network_activity && !metrics.network_activity.error) {
      score += 0.1; // Network activity bonus
    }
    
    if (metrics.defi_tvl && !metrics.defi_tvl.error) {
      score += 0.1; // DeFi TVL bonus
    }
    
    if (metrics.gas_metrics && !metrics.gas_metrics.error) {
      score += 0.1; // Gas metrics bonus
    }
    
    if (metrics.developer_activity && !metrics.developer_activity.error) {
      score += 0.2; // Developer activity bonus
    }
    
    return Math.min(score, 1);
  }

  async storeNewsArticles(articles) {
    try {
      for (const article of articles.slice(0, 10)) { // Store top 10
        await NewsArticle.findOrCreate({
          where: { 
            title: article.title,
            source: article.source
          },
          defaults: {
            title: article.title,
            content: article.title, // Using title as content for now
            source: article.source,
            url: article.url,
            published_at: article.published_at,
            sentiment: this.analyzeArticleSentiment(article.title),
            relevance_score: article.relevance_score,
            tags: [article.type]
          }
        });
      }
    } catch (error) {
      logger.error('Error storing news articles:', error);
    }
  }

  analyzeArticleSentiment(title) {
    const text = title.toLowerCase();
    const positiveKeywords = ['bullish', 'surge', 'rally', 'growth', 'adoption'];
    const negativeKeywords = ['bearish', 'crash', 'decline', 'hack', 'ban'];
    
    const positiveCount = positiveKeywords.filter(keyword => text.includes(keyword)).length;
    const negativeCount = negativeKeywords.filter(keyword => text.includes(keyword)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MarketResearchAgent;
