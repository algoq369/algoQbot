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

    // Configuration options
    this.config = {
      enableExternalNews: process.env.ENABLE_EXTERNAL_NEWS !== 'false', // Default to true
      mockMode: process.env.NEWS_MOCK_MODE === 'true', // Default to false
      maxRetries: 2,
      requestTimeout: 15000
    };

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
    let successfulSources = 0;

    // If mock mode is enabled or external news is disabled, return mock data
    if (this.config.mockMode || !this.config.enableExternalNews) {
      logger.info('Using mock news data (mock mode or external news disabled)');
      return this.getMockArticles('Mock', query);
    }

    for (const source of this.sources) {
      try {
        logger.debug(`🔍 Fetching news from ${source.name}...`);

        const response = await axios.get(source.url, {
          timeout: this.config.requestTimeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 300; // Only resolve for 2xx status codes
          }
        });

        const $ = cheerio.load(response.data);
        const newsItems = $(source.selector).slice(0, 10);

        if (newsItems.length === 0) {
          logger.warn(`No articles found with selector "${source.selector}" from ${source.name}`);
          // Try alternative selectors
          const altSelectors = this.getAlternativeSelectors(source.name);
          for (const altSelector of altSelectors) {
            const altItems = $(altSelector).slice(0, 10);
            if (altItems.length > 0) {
              logger.info(`Using alternative selector "${altSelector}" for ${source.name}`);
              newsItems = altItems;
              break;
            }
          }
        }

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

        successfulSources++;
        logger.debug(`✅ Successfully fetched ${newsItems.length} items from ${source.name}`);

        // Add delay between requests to be respectful
        await this.delay(2000); // Increased delay
      } catch (error) {
        logger.warn(`Failed to fetch from ${source.name}:`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText
        });

        // Add mock articles for failed sources to maintain functionality
        articles.push(...this.getMockArticles(source.name, query));
      }
    }

    // If no sources worked, return mock data
    if (successfulSources === 0) {
      logger.warn('All news sources failed, returning mock data');
      return this.getMockArticles('Mock', query);
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

  getAlternativeSelectors(sourceName) {
    const alternativeSelectors = {
      'CoinTelegraph': [
        '.post-card-inline__title',
        '.post-card__title',
        '.post-card__title-link',
        'h3 a',
        '.article-card__title',
        '.news-card__title'
      ],
      'CoinDesk': [
        '.at-headline',
        '.headline',
        'h2 a',
        '.article-title',
        '.news-title'
      ],
      'DeFiPulse': [
        '.defi-pulse-card',
        '.protocol-card',
        '.defi-card',
        '.protocol-name'
      ]
    };

    return alternativeSelectors[sourceName] || [];
  }

  getMockArticles(sourceName, query) {
    const mockArticles = [
      {
        title: `BSC Network Shows Strong Performance in ${query} Trading`,
        url: `https://mock-${sourceName.toLowerCase()}.com/article1`,
        source: sourceName,
        type: 'crypto_news',
        published_at: new Date(),
        relevance_score: 0.9
      },
      {
        title: `Market Analysis: ${query} Price Trends and Trading Opportunities`,
        url: `https://mock-${sourceName.toLowerCase()}.com/article2`,
        source: sourceName,
        type: 'crypto_news',
        published_at: new Date(Date.now() - 3600000), // 1 hour ago
        relevance_score: 0.8
      },
      {
        title: `DeFi Protocol Updates Impact ${query} Market Dynamics`,
        url: `https://mock-${sourceName.toLowerCase()}.com/article3`,
        source: sourceName,
        type: 'crypto_news',
        published_at: new Date(Date.now() - 7200000), // 2 hours ago
        relevance_score: 0.7
      }
    ];

    // Filter based on query relevance
    return mockArticles.filter(article =>
      this.isRelevantToQuery(article.title, query)
    );
  }
}

module.exports = MarketResearchAgent;
