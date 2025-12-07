/**
 * AlgoQBot AI Council System
 * Sophisticated multi-agent system that evolves with AlgoQBot
 * Each expert has personality, memory, and AI API connection
 *
 * API Integrations:
 * - AlgoQ (Lead AI): Claude API
 * - Strategist: DeepSeek API
 * - Analyst, RiskManager, Sentiment: Free APIs (Hugging Face)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Agent memory storage
const AGENTS_DIR = path.join(__dirname, '..', '..', 'data', 'agents');
const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'ai-keys.json');

// Ensure agents directory exists
if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
}

// ============== API CONFIGURATION ==============
let API_KEYS = {
    claude: process.env.CLAUDE_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    qween: process.env.QWEEN_API_KEY || '',
    huggingface: process.env.HF_API_KEY || ''
};

// Load API keys from config file if exists
function loadApiKeys() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            API_KEYS = { ...API_KEYS, ...config };
            console.log('✅ AI API keys loaded from config');
        }
    } catch (e) {
        console.log('No API keys config found, using defaults');
    }
}

function saveApiKeys(keys) {
    try {
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(keys, null, 2));
        API_KEYS = { ...API_KEYS, ...keys };
    } catch (e) {
        console.error('Failed to save API keys:', e);
    }
}

loadApiKeys();

// ============== AGENT DEFINITIONS ==============
const AGENT_PROFILES = {
    'AlgoQ': {
        name: 'AlgoQ',
        role: 'Lead Trading AI & Executor',
        avatar: '🤖',
        apiProvider: 'claude',
        personality: {
            style: 'analytical',
            tone: 'professional',
            traits: ['data-driven', 'precise', 'strategic', 'adaptive', 'fast', 'reliable']
        },
        expertise: [
            'algorithmic trading',
            'market analysis',
            'risk management',
            'strategy optimization',
            'order execution',
            'slippage minimization',
            'timing optimization',
            'trade management'
        ],
        vision: 'Lead AlgoQBot to maximum profitability through intelligent, data-driven trading decisions and precise execution.',
        decisionFramework: {
            riskTolerance: 'moderate',
            preferredStrategies: ['grid', 'momentum', 'mean_reversion'],
            confidenceThreshold: 0.6,
            executionSpeed: 'fast',
            slippageTolerance: 0.3
        },
        quotes: [
            "Data drives decisions. Execution delivers results.",
            "Speed without accuracy is chaos. Accuracy without speed is missed opportunity.",
            "The market rewards preparation and punishes hesitation.",
            "Every trade is a calculated risk. Calculate well."
        ],
        councilRole: 'primary_decision_maker'
    },
    'Strategist': {
        name: 'Marcus Strategy',
        role: 'Chief Strategy Officer',
        avatar: '🎯',
        apiProvider: 'deepseek',
        personality: {
            style: 'visionary',
            tone: 'confident',
            traits: ['forward-thinking', 'adaptable', 'macro-focused', 'patient']
        },
        expertise: ['market regime detection', 'strategy selection', 'long-term positioning', 'trend analysis'],
        vision: 'Guide AlgoQBot strategy evolution for sustained profitability across all market conditions.',
        quotes: [
            "The market rewards patience and punishes greed.",
            "Adapt strategy to regime, not regime to strategy.",
            "In uncertainty, reduce exposure. In clarity, maximize opportunity.",
            "A strategy that works everywhere works nowhere. Specialize."
        ],
        councilRole: 'strategy_advisor'
    },
    'Analyst': {
        name: 'Dr. Sarah Data',
        role: 'Quantitative Analyst',
        avatar: '📊',
        apiProvider: 'qween',
        personality: {
            style: 'methodical',
            tone: 'precise',
            traits: ['detail-oriented', 'statistical', 'objective', 'thorough']
        },
        expertise: ['data analysis', 'pattern recognition', 'backtesting', 'indicator development'],
        vision: 'Provide AlgoQBot with deep quantitative insights for continuous improvement.',
        quotes: [
            "Data doesn't lie, but it can mislead. Context is everything.",
            "A 60% win rate with proper risk management beats 80% win rate with poor sizing.",
            "Historical patterns suggest, they don't guarantee.",
            "The numbers tell the story. Learn to read them."
        ],
        councilRole: 'data_analyst'
    },
    'RiskManager': {
        name: 'Victor Shield',
        role: 'Chief Risk Officer',
        avatar: '🛡️',
        apiProvider: 'huggingface',
        personality: {
            style: 'cautious',
            tone: 'serious',
            traits: ['protective', 'vigilant', 'conservative', 'systematic']
        },
        expertise: ['risk assessment', 'position sizing', 'drawdown management', 'portfolio protection'],
        vision: 'Protect AlgoQBot capital and ensure long-term survival through disciplined risk control.',
        quotes: [
            "The first rule is don't lose money. The second rule is don't forget the first.",
            "Position sizing is more important than entry timing.",
            "Every trade has a maximum acceptable loss. Honor it.",
            "Survival first, profits second."
        ],
        councilRole: 'risk_guardian'
    },
    'Sentiment': {
        name: 'Echo Pulse',
        role: 'Market Sentiment Analyst',
        avatar: '📡',
        apiProvider: 'huggingface',
        personality: {
            style: 'intuitive',
            tone: 'observant',
            traits: ['perceptive', 'contrarian', 'crowd-aware', 'adaptive']
        },
        expertise: ['sentiment analysis', 'fear & greed interpretation', 'crowd psychology', 'market timing'],
        vision: 'Help AlgoQBot navigate market psychology and identify high-probability turning points.',
        quotes: [
            "Be fearful when others are greedy, greedy when others are fearful.",
            "Extreme fear creates opportunity. Extreme greed creates traps.",
            "The crowd is right during trends, wrong at turning points.",
            "Sentiment shifts before price. Listen carefully."
        ],
        councilRole: 'sentiment_reader'
    }
};

// ============== AGENT MEMORY SYSTEM ==============
class AgentMemory {
    constructor(agentId) {
        this.agentId = agentId;
        this.memoryFile = path.join(AGENTS_DIR, `${agentId}_memory.json`);
        this.memory = this.loadMemory();
    }

    loadMemory() {
        try {
            if (fs.existsSync(this.memoryFile)) {
                return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
            }
        } catch (e) {}

        return {
            created: new Date().toISOString(),
            interactions: 0,
            insights: [],
            decisions: [],
            learnings: [],
            tradingIdeas: [],
            performanceNotes: [],
            tradeReviews: [],
            evolutionLog: []
        };
    }

    save() {
        try {
            fs.writeFileSync(this.memoryFile, JSON.stringify(this.memory, null, 2));
        } catch (e) {
            console.error(`Failed to save memory for ${this.agentId}:`, e);
        }
    }

    addInsight(insight) {
        this.memory.insights.unshift({
            timestamp: new Date().toISOString(),
            content: insight
        });
        this.memory.insights = this.memory.insights.slice(0, 100);
        this.save();
    }

    addDecision(decision, context, outcome = null) {
        this.memory.decisions.unshift({
            timestamp: new Date().toISOString(),
            decision,
            context,
            outcome
        });
        this.memory.decisions = this.memory.decisions.slice(0, 200);
        this.save();
    }

    addLearning(learning, source = 'observation') {
        this.memory.learnings.unshift({
            timestamp: new Date().toISOString(),
            content: learning,
            source
        });
        this.memory.learnings = this.memory.learnings.slice(0, 50);
        this.save();
    }

    addTradingIdea(idea) {
        this.memory.tradingIdeas.unshift({
            timestamp: new Date().toISOString(),
            ...idea
        });
        this.memory.tradingIdeas = this.memory.tradingIdeas.slice(0, 30);
        this.save();
    }

    addTradeReview(trade, analysis, recommendation) {
        this.memory.tradeReviews.unshift({
            timestamp: new Date().toISOString(),
            trade,
            analysis,
            recommendation
        });
        this.memory.tradeReviews = this.memory.tradeReviews.slice(0, 100);
        this.save();
    }

    addEvolutionNote(note, metrics) {
        this.memory.evolutionLog.unshift({
            timestamp: new Date().toISOString(),
            note,
            metrics
        });
        this.memory.evolutionLog = this.memory.evolutionLog.slice(0, 50);
        this.save();
    }

    incrementInteractions() {
        this.memory.interactions++;
        this.save();
    }

    getRecentInsights(count = 5) {
        return this.memory.insights.slice(0, count);
    }

    getRecentDecisions(count = 5) {
        return this.memory.decisions.slice(0, count);
    }

    getLearnings() {
        return this.memory.learnings;
    }

    getTradingIdeas(count = 5) {
        return this.memory.tradingIdeas.slice(0, count);
    }

    getTradeReviews(count = 10) {
        return this.memory.tradeReviews.slice(0, count);
    }

    getEvolutionLog(count = 10) {
        return this.memory.evolutionLog.slice(0, count);
    }

    getContext() {
        return {
            interactions: this.memory.interactions,
            recentInsights: this.getRecentInsights(3),
            recentDecisions: this.getRecentDecisions(3),
            learnings: this.getLearnings().slice(0, 5)
        };
    }
}

// ============== AGENT INSTANCES ==============
const agentMemories = {};

function getAgentMemory(agentId) {
    if (!agentMemories[agentId]) {
        agentMemories[agentId] = new AgentMemory(agentId);
    }
    return agentMemories[agentId];
}

// ============== AI API CALLERS ==============

// Claude API call (for AlgoQ)
async function callClaudeAPI(prompt, context) {
    if (!API_KEYS.claude) {
        return null; // Fall back to local response
    }

    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [
                {
                    role: 'system',
                    content: `You are AlgoQ, the Lead Trading AI for AlgoQBot. You are data-driven, precise, and strategic. You handle both analysis and execution. Current context: ${JSON.stringify(context)}`
                },
                { role: 'user', content: prompt }
            ]
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEYS.claude,
                'anthropic-version': '2023-06-01'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response.content?.[0]?.text || null);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(10000, () => { req.destroy(); resolve(null); });
        req.write(data);
        req.end();
    });
}

// DeepSeek API call (for Strategist)
async function callDeepSeekAPI(prompt, context) {
    if (!API_KEYS.deepseek) {
        return null;
    }

    return new Promise((resolve) => {
        const data = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: `You are Marcus Strategy, Chief Strategy Officer for AlgoQBot. You are visionary, confident, and macro-focused. Context: ${JSON.stringify(context)}`
                },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1024
        });

        const options = {
            hostname: 'api.deepseek.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS.deepseek}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response.choices?.[0]?.message?.content || null);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(15000, () => { req.destroy(); resolve(null); });
        req.write(data);
        req.end();
    });
}

// Qween AI API call (Mistral-based - for Analyst)
async function callQweenAPI(prompt, agentName, context) {
    if (!API_KEYS.qween) {
        return null;
    }

    return new Promise((resolve) => {
        const agent = AGENT_PROFILES[agentName];
        const data = JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
                {
                    role: 'system',
                    content: `You are ${agent.name}, ${agent.role} for AlgoQBot. ${agent.vision}. You are ${agent.personality.traits.join(', ')}. Provide detailed quantitative analysis. Be concise but thorough.`
                },
                { role: 'user', content: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}` }
            ],
            max_tokens: 1024,
            temperature: 0.7
        });

        const options = {
            hostname: 'api.mistral.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS.qween}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.error) {
                        console.log('Qween API error:', response.error);
                        resolve(null);
                    } else {
                        resolve(response.choices?.[0]?.message?.content || null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.log('Qween API connection error:', e.message);
            resolve(null);
        });
        req.setTimeout(15000, () => { req.destroy(); resolve(null); });
        req.write(data);
        req.end();
    });
}

// Hugging Face API call (free tier for RiskManager and Sentiment)
async function callHuggingFaceAPI(prompt, agentName, context) {
    if (!API_KEYS.huggingface) {
        return null;
    }

    return new Promise((resolve) => {
        const agent = AGENT_PROFILES[agentName];
        const systemPrompt = `You are ${agent.name}, ${agent.role} for AlgoQBot. ${agent.vision}`;

        const data = JSON.stringify({
            inputs: `${systemPrompt}\n\nContext: ${JSON.stringify(context)}\n\nUser: ${prompt}\n\nResponse:`,
            parameters: { max_new_tokens: 500, temperature: 0.7 }
        });

        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/mistralai/Mistral-7B-Instruct-v0.2',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS.huggingface}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    const text = response[0]?.generated_text || '';
                    const responseStart = text.indexOf('Response:');
                    resolve(responseStart > -1 ? text.slice(responseStart + 9).trim() : null);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(20000, () => { req.destroy(); resolve(null); });
        req.write(data);
        req.end();
    });
}

// ============== TRADING IDEAS GENERATOR ==============
function generateTradingIdea(marketData, botData, technical, sentiment) {
    const ideas = [];
    const price = marketData?.bnb?.price || 700;
    const change24h = marketData?.bnb?.change24h || 0;
    const rsi = technical?.rsi || 50;
    const trend = technical?.trend || 'Sideways';
    const fearGreed = sentiment?.value || 50;
    const winRate = botData?.stats?.winRate || 50;

    // RSI-based ideas
    if (rsi < 30) {
        ideas.push({
            type: 'LONG',
            strategy: 'RSI Oversold Reversal',
            confidence: 75,
            reasoning: `RSI at ${rsi.toFixed(1)} indicates oversold conditions. Historical data suggests mean reversion opportunity.`,
            entry: price,
            target: price * 1.025,
            stopLoss: price * 0.985,
            riskReward: '1:2.5',
            timeframe: '4-12 hours',
            source: 'AlgoQ'
        });
    } else if (rsi > 70) {
        ideas.push({
            type: 'SHORT/REDUCE',
            strategy: 'RSI Overbought Fade',
            confidence: 70,
            reasoning: `RSI at ${rsi.toFixed(1)} signals overbought territory. Consider reducing long exposure.`,
            action: 'Reduce Position / Tighten Stops',
            timeframe: '2-6 hours',
            source: 'AlgoQ'
        });
    }

    // Fear & Greed ideas
    if (fearGreed < 25) {
        ideas.push({
            type: 'ACCUMULATE',
            strategy: 'Extreme Fear Accumulation',
            confidence: 80,
            reasoning: `Fear & Greed at ${fearGreed} (Extreme Fear). Historically, this creates buying opportunities.`,
            action: 'Gradual accumulation with tight stops',
            riskLevel: 'Medium',
            timeframe: '1-3 days',
            source: 'Sentiment'
        });
    } else if (fearGreed > 75) {
        ideas.push({
            type: 'REDUCE',
            strategy: 'Greed Protection',
            confidence: 75,
            reasoning: `Fear & Greed at ${fearGreed} (Extreme Greed). Market euphoria often precedes corrections.`,
            action: 'Take partial profits, tighten all stops',
            riskLevel: 'Low',
            timeframe: 'Immediate',
            source: 'RiskManager'
        });
    }

    // Trend-based ideas (from Strategist perspective)
    if (trend === 'Uptrend' && rsi < 60) {
        ideas.push({
            type: 'LONG',
            strategy: 'Trend Continuation',
            confidence: 70,
            reasoning: `Confirmed uptrend with RSI at ${rsi.toFixed(1)} - room for continuation.`,
            entry: price,
            target: technical?.resistance || price * 1.03,
            stopLoss: technical?.support || price * 0.98,
            riskReward: '1:1.5',
            timeframe: '6-24 hours',
            source: 'Strategist'
        });
    }

    // Win rate optimization ideas (from Analyst)
    if (winRate < 40) {
        ideas.push({
            type: 'OPTIMIZE',
            strategy: 'Strategy Adjustment Required',
            confidence: 90,
            reasoning: `Win rate at ${winRate.toFixed(1)}% is below acceptable threshold. Immediate action needed.`,
            recommendations: [
                'Tighten entry criteria - require stronger signals',
                'Reduce position sizes by 50%',
                'Focus on higher-probability setups only',
                'Review and adjust stop loss placement'
            ],
            priority: 'HIGH',
            source: 'Analyst'
        });
    }

    // Save trading ideas to AlgoQ memory
    const algoqMemory = getAgentMemory('AlgoQ');
    ideas.forEach(idea => algoqMemory.addTradingIdea(idea));

    return ideas;
}

// ============== TRADE REVIEW SYSTEM ==============
function reviewTrade(trade, marketContext) {
    const reviews = {};

    // AlgoQ reviews execution
    const algoqMemory = getAgentMemory('AlgoQ');
    const executionReview = {
        trade,
        analysis: analyzeExecution(trade),
        timestamp: new Date().toISOString()
    };
    algoqMemory.addTradeReview(trade, executionReview.analysis, 'Continue monitoring');

    // Analyst reviews the data
    const analystMemory = getAgentMemory('Analyst');
    const dataReview = analyzeTradeData(trade, marketContext);
    analystMemory.addTradeReview(trade, dataReview, 'Logged for pattern analysis');

    // Risk Manager reviews risk
    const riskMemory = getAgentMemory('RiskManager');
    const riskReview = analyzeTradeRisk(trade);
    riskMemory.addTradeReview(trade, riskReview, riskReview.recommendation);

    return { executionReview, dataReview, riskReview };
}

function analyzeExecution(trade) {
    const analysis = {
        exitReason: trade.exitReason || 'unknown',
        holdTime: trade.holdTime || 'unknown',
        slippage: 'minimal'
    };

    if (trade.exitReason === 'stop_loss') {
        analysis.verdict = 'Stop loss triggered - risk management working';
        analysis.learning = 'Consider if entry was too aggressive';
    } else if (trade.exitReason === 'take_profit') {
        analysis.verdict = 'Take profit hit - successful trade';
        analysis.learning = 'Entry timing was good';
    } else if (trade.exitReason === 'max_hold_time_exceeded') {
        analysis.verdict = 'Timeout - market moved sideways';
        analysis.learning = 'Consider regime detection before entry';
    }

    return analysis;
}

function analyzeTradeData(trade, context) {
    return {
        conditions: context?.technical || {},
        sentiment: context?.sentiment || {},
        dataPoints: {
            rsi: context?.technical?.rsi,
            trend: context?.technical?.trend,
            fearGreed: context?.sentiment?.value
        },
        pattern: 'Recorded for future pattern matching'
    };
}

function analyzeTradeRisk(trade) {
    const riskScore = trade.exitReason === 'stop_loss' ? 'HIGH' :
                      trade.exitReason === 'max_hold_time_exceeded' ? 'MEDIUM' : 'LOW';
    return {
        riskScore,
        recommendation: riskScore === 'HIGH' ? 'Review position sizing' : 'Acceptable risk level'
    };
}

// ============== ENHANCED AI RESPONSES ==============
async function generateEnhancedAIResponse(agentId, message, context) {
    const agent = AGENT_PROFILES[agentId];
    const memory = getAgentMemory(agentId);
    memory.incrementInteractions();

    const { botData, marketData, technical, sentiment, logs, trades } = context;

    // Try AI API first
    let aiResponse = null;
    const agentContext = {
        ...memory.getContext(),
        market: {
            price: marketData?.bnb?.price,
            rsi: technical?.rsi,
            trend: technical?.trend,
            fearGreed: sentiment?.value
        },
        performance: botData?.stats
    };

    if (agent.apiProvider === 'claude') {
        aiResponse = await callClaudeAPI(message, agentContext);
    } else if (agent.apiProvider === 'deepseek') {
        aiResponse = await callDeepSeekAPI(message, agentContext);
    } else if (agent.apiProvider === 'qween') {
        aiResponse = await callQweenAPI(message, agentId, agentContext);
    } else if (agent.apiProvider === 'huggingface') {
        aiResponse = await callHuggingFaceAPI(message, agentId, agentContext);
    }

    // If AI API returned a response, format and return it
    if (aiResponse) {
        memory.addInsight(`AI-generated response for: ${message.substring(0, 50)}`);
        return `${agent.avatar} **${agent.name}** (${agent.role})\n\n${aiResponse}`;
    }

    // Fall back to local generation
    return generateLocalResponse(agentId, message, context, memory);
}

function generateLocalResponse(agentId, message, context, memory) {
    const agent = AGENT_PROFILES[agentId];
    const { botData, marketData, technical, sentiment, logs, trades } = context;
    const lowerMsg = message.toLowerCase();

    const price = marketData?.bnb?.price || 0;
    const change24h = marketData?.bnb?.change24h || 0;
    const rsi = technical?.rsi || 50;
    const trend = technical?.trend || 'Unknown';
    const fearGreed = sentiment?.value || 50;
    const fgClass = sentiment?.classification || 'Neutral';
    const stats = botData?.stats || {};
    const running = botData?.running || false;

    let response = `${agent.avatar} **${agent.name}** (${agent.role})\n\n`;

    // Agent-specific responses
    switch (agentId) {
        case 'AlgoQ':
            response += generateAlgoQLocalResponse(message, context, memory, agent);
            break;
        case 'Strategist':
            response += generateStrategistLocalResponse(message, context, memory, agent);
            break;
        case 'Analyst':
            response += generateAnalystLocalResponse(message, context, memory, agent);
            break;
        case 'RiskManager':
            response += generateRiskManagerLocalResponse(message, context, memory, agent);
            break;
        case 'Sentiment':
            response += generateSentimentLocalResponse(message, context, memory, agent);
            break;
        default:
            response += generateAlgoQLocalResponse(message, context, memory, AGENT_PROFILES.AlgoQ);
    }

    return response;
}

function generateAlgoQLocalResponse(message, context, memory, agent) {
    const { botData, marketData, technical, sentiment, logs, trades } = context;
    const price = marketData?.bnb?.price || 0;
    const rsi = technical?.rsi || 50;
    const trend = technical?.trend || 'Unknown';
    const fearGreed = sentiment?.value || 50;
    const stats = botData?.stats || {};
    const lowerMsg = message.toLowerCase();

    // Trading ideas
    if (lowerMsg.includes('idea') || lowerMsg.includes('opportunity')) {
        const ideas = generateTradingIdea(marketData, botData, technical, sentiment);
        if (ideas.length === 0) {
            return `**Current Assessment**\n\nNo clear trading opportunities at this time.\n\n` +
                `• BNB: $${price.toFixed(2)}\n• RSI: ${rsi.toFixed(1)} (Neutral)\n• Trend: ${trend}\n\n` +
                `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
        }

        let response = `**Trading Opportunities Identified**\n\n`;
        ideas.forEach((idea, i) => {
            response += `**${i + 1}. ${idea.strategy}** [${idea.type}]\n`;
            response += `Confidence: ${idea.confidence}% | ${idea.reasoning}\n`;
            if (idea.entry) response += `Entry: $${idea.entry.toFixed(2)} → Target: $${idea.target?.toFixed(2) || 'N/A'}\n`;
            response += '\n';
        });
        return response;
    }

    // Full analysis
    if (lowerMsg.includes('analy') || lowerMsg.includes('market') || lowerMsg.includes('overview')) {
        memory.addInsight(`Market analysis: BNB $${price.toFixed(2)}, RSI ${rsi.toFixed(1)}`);
        return `**Comprehensive Analysis**\n\n` +
            `**Bot Status:** ${botData.running ? '🟢 Active' : '🔴 Offline'} | PID: ${botData.pid || 'N/A'}\n\n` +
            `**Market State:**\n` +
            `• BNB: $${price.toFixed(2)} (${marketData?.bnb?.change24h >= 0 ? '+' : ''}${(marketData?.bnb?.change24h || 0).toFixed(2)}%)\n` +
            `• RSI: ${rsi.toFixed(1)} ${rsi > 70 ? '⚠️ Overbought' : rsi < 30 ? '⚠️ Oversold' : ''}\n` +
            `• Trend: ${trend} | Fear & Greed: ${fearGreed}\n\n` +
            `**Performance:**\n` +
            `• Trades: ${stats.totalTrades || 0} | Win Rate: ${(stats.winRate || 0).toFixed(1)}%\n` +
            `• W/L: ${stats.wins || 0}/${stats.losses || 0}\n\n` +
            `**My Assessment:** ${getMarketAssessment(technical, sentiment, stats)}\n\n` +
            `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
    }

    // Default
    return `**Ready for Command**\n\n` +
        `Current: BNB $${price.toFixed(2)} | RSI ${rsi.toFixed(1)} | ${trend}\n` +
        `Win Rate: ${(stats.winRate || 0).toFixed(1)}% | F&G: ${fearGreed}\n\n` +
        `Ask me about: trading ideas, market analysis, performance, risk assessment\n\n` +
        `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
}

function generateStrategistLocalResponse(message, context, memory, agent) {
    const { technical, sentiment, botData } = context;
    const regime = botData?.regime || 'ranging';
    const trend = technical?.trend || 'Sideways';
    const rsi = technical?.rsi || 50;
    const fearGreed = sentiment?.value || 50;

    memory.addInsight(`Strategy review: ${regime} regime, ${trend} trend`);

    return `**Strategic Analysis**\n\n` +
        `**Current Regime:** ${regime.toUpperCase()}\n` +
        `**Trend:** ${trend} | RSI: ${rsi.toFixed(1)} | F&G: ${fearGreed}\n\n` +
        `**Recommended Strategy:**\n${getStrategyRecommendation(regime, trend, rsi, fearGreed)}\n\n` +
        `**Long-term View:**\n${getLongTermView(fearGreed, trend)}\n\n` +
        `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
}

function generateAnalystLocalResponse(message, context, memory, agent) {
    const { botData, technical } = context;
    const stats = botData?.stats || {};

    const stopLossRate = stats.totalTrades > 0 ?
        ((stats.exitReasons?.stop_loss || 0) / stats.totalTrades * 100) : 0;
    const timeoutRate = stats.totalTrades > 0 ?
        ((stats.exitReasons?.max_hold_time_exceeded || 0) / stats.totalTrades * 100) : 0;

    memory.addInsight(`Data analysis: ${stats.totalTrades} trades, ${(stats.winRate || 0).toFixed(1)}% WR`);

    return `**Quantitative Analysis**\n\n` +
        `**Performance Data:**\n` +
        `• Total Trades: ${stats.totalTrades || 0}\n` +
        `• Win Rate: ${(stats.winRate || 0).toFixed(1)}%\n` +
        `• Wins: ${stats.wins || 0} | Losses: ${stats.losses || 0}\n\n` +
        `**Exit Analysis:**\n` +
        `• Stop Loss: ${stopLossRate.toFixed(1)}% ${stopLossRate > 30 ? '⚠️' : '✅'}\n` +
        `• Timeouts: ${timeoutRate.toFixed(1)}% ${timeoutRate > 25 ? '⚠️' : '✅'}\n\n` +
        `**Statistical Insights:**\n${getStatisticalInsights(stats, technical)}\n\n` +
        `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
}

function generateRiskManagerLocalResponse(message, context, memory, agent) {
    const { botData, technical, sentiment } = context;
    const stats = botData?.stats || {};
    const riskScore = calculateRiskScore(stats, technical, sentiment);
    const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';

    memory.addDecision(`Risk assessment: ${riskLevel} (${riskScore}/100)`, { winRate: stats.winRate });

    return `**Risk Assessment**\n\n` +
        `**Overall Risk:** ${riskLevel} (Score: ${riskScore}/100)\n\n` +
        `**Risk Factors:**\n` +
        `• Win Rate: ${(stats.winRate || 0).toFixed(1)}% ${stats.winRate < 40 ? '⚠️' : '✅'}\n` +
        `• RSI: ${technical?.rsi?.toFixed(1) || 'N/A'} ${(technical?.rsi > 75 || technical?.rsi < 25) ? '⚠️' : '✅'}\n` +
        `• Sentiment: ${sentiment?.value || 50} ${(sentiment?.value > 80 || sentiment?.value < 20) ? '⚠️' : '✅'}\n\n` +
        `**Position Sizing:**\n${getPositionSizing(riskLevel, stats.winRate)}\n\n` +
        `**Recommendations:**\n${getRiskRecommendations(riskLevel, stats, technical, sentiment)}\n\n` +
        `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
}

function generateSentimentLocalResponse(message, context, memory, agent) {
    const { sentiment, marketData } = context;
    const fearGreed = sentiment?.value || 50;
    const classification = sentiment?.classification || 'Neutral';

    memory.addInsight(`Sentiment reading: ${fearGreed} (${classification})`);

    return `**Sentiment Analysis**\n\n` +
        `**Fear & Greed Index:** ${fearGreed}/100 (${classification})\n\n` +
        `**Market Psychology:**\n${getSentimentInterpretation(fearGreed)}\n\n` +
        `**Contrarian Signals:**\n${getContrarianSignals(fearGreed)}\n\n` +
        `**Recommended Action:**\n${getSentimentAction(fearGreed)}\n\n` +
        `_"${agent.quotes[Math.floor(Math.random() * agent.quotes.length)]}"_`;
}

// ============== HELPER FUNCTIONS ==============
function getMarketAssessment(technical, sentiment, stats) {
    const rsi = technical?.rsi || 50;
    const trend = technical?.trend || 'Sideways';
    const fg = sentiment?.value || 50;

    if (rsi < 30 && fg < 30) return '🟢 Strong opportunity - oversold with extreme fear';
    if (rsi > 70 && fg > 70) return '🔴 High risk - overbought with extreme greed';
    if (trend === 'Uptrend' && rsi < 70) return '🟢 Bullish - trend intact with room to run';
    if (trend === 'Downtrend' && rsi > 30) return '🔴 Bearish - downtrend in progress';
    return '🟡 Neutral - no strong signals';
}

function getStrategyRecommendation(regime, trend, rsi, fg) {
    if (regime === 'trending' && trend === 'Uptrend') {
        return '• Deploy momentum strategy\n• Trail stops on winners\n• Scale in on pullbacks';
    } else if (regime === 'ranging') {
        return '• Grid trading optimal\n• Quick profit-taking at range extremes\n• Tight stop losses';
    } else if (fg < 25) {
        return '• Contrarian accumulation phase\n• Smaller positions, wider stops\n• Patience for confirmation';
    }
    return '• Maintain current strategy\n• Monitor for regime shift\n• Standard position sizing';
}

function getLongTermView(fg, trend) {
    if (fg < 30) return 'Extreme fear = long-term accumulation zone historically';
    if (fg > 70) return 'Extreme greed = potential distribution phase';
    if (trend === 'Uptrend') return 'Trend favors continuation, but watch for exhaustion';
    return 'No clear long-term bias - follow shorter timeframes';
}

function getStatisticalInsights(stats, technical) {
    const insights = [];
    if ((stats.winRate || 0) >= 50) insights.push('✅ Win rate above 50% - profitable strategy');
    else if ((stats.winRate || 0) >= 40) insights.push('🟡 Win rate 40-50% - acceptable with good R:R');
    else insights.push('⚠️ Win rate below 40% - strategy adjustment needed');

    const slRate = ((stats.exitReasons?.stop_loss || 0) / (stats.totalTrades || 1)) * 100;
    if (slRate > 30) insights.push('⚠️ High stop loss rate - review entry criteria');

    return insights.join('\n');
}

function calculateRiskScore(stats, technical, sentiment) {
    let score = 50;
    if ((stats?.winRate || 50) < 30) score += 30;
    else if ((stats?.winRate || 50) < 40) score += 20;
    else if ((stats?.winRate || 50) < 50) score += 10;
    else score -= 10;

    const rsi = technical?.rsi || 50;
    if (rsi > 80 || rsi < 20) score += 15;
    else if (rsi > 70 || rsi < 30) score += 10;

    const fg = sentiment?.value || 50;
    if (fg > 85 || fg < 15) score += 15;
    else if (fg > 75 || fg < 25) score += 10;

    return Math.min(100, Math.max(0, score));
}

function getPositionSizing(riskLevel, winRate) {
    if (riskLevel === 'HIGH' || (winRate || 50) < 35) {
        return '• Reduce to 25% of normal size\n• Max 2% portfolio risk per trade\n• Consider pausing new entries';
    } else if (riskLevel === 'MEDIUM' || (winRate || 50) < 45) {
        return '• Use 50-75% of normal size\n• Max 3% portfolio risk per trade';
    }
    return '• Normal sizing acceptable\n• Max 5% portfolio risk per trade';
}

function getRiskRecommendations(riskLevel, stats, technical, sentiment) {
    const recs = [];
    if (riskLevel === 'HIGH') recs.push('🛑 Consider pausing until conditions improve');
    if ((stats?.winRate || 50) < 40) recs.push('📉 Reduce position sizes by 50%');
    if ((technical?.rsi || 50) > 75) recs.push('⚠️ RSI overbought - avoid new longs');
    if ((technical?.rsi || 50) < 25) recs.push('📈 RSI oversold - potential opportunity');
    if ((sentiment?.value || 50) > 80) recs.push('🔴 Extreme greed - tighten all stops');
    if ((sentiment?.value || 50) < 20) recs.push('🟢 Extreme fear - contrarian opportunity');
    if (recs.length === 0) recs.push('✅ Risk within acceptable parameters');
    return recs.join('\n');
}

function getSentimentInterpretation(fg) {
    if (fg < 20) return '😰 **Extreme Fear** - Panic selling, often marks bottoms';
    if (fg < 40) return '😟 **Fear** - Caution dominates, accumulation possible';
    if (fg < 60) return '😐 **Neutral** - No clear conviction, consolidation phase';
    if (fg < 80) return '😊 **Greed** - Optimism rising, trends can continue';
    return '🤑 **Extreme Greed** - Euphoria peaks, smart money exits';
}

function getContrarianSignals(fg) {
    if (fg < 25) return '🟢 **STRONG BUY** - Extreme fear historically = opportunity';
    if (fg > 75) return '🔴 **STRONG SELL** - Extreme greed historically = top';
    return '🟡 **NEUTRAL** - No strong contrarian signal';
}

function getSentimentAction(fg) {
    if (fg < 25) return 'Gradual accumulation with 25% position per entry';
    if (fg > 75) return 'Take 25-50% profits, move stops to breakeven';
    return 'Standard operations - follow technical signals';
}

// ============== EXPORTS ==============
module.exports = {
    AGENT_PROFILES,
    AgentMemory,
    getAgentMemory,
    generateTradingIdea,
    generateEnhancedAIResponse,
    reviewTrade,
    saveApiKeys,
    API_KEYS
};
