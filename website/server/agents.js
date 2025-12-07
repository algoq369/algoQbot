/**
 * AlgoQBot AI Agent System
 * Sophisticated multi-agent system with personalities, memory, and persistence
 */

const fs = require('fs');
const path = require('path');

// Agent memory storage
const AGENTS_DIR = path.join(__dirname, '..', '..', 'data', 'agents');

// Ensure agents directory exists
if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
}

// ============== AGENT DEFINITIONS ==============
const AGENT_PROFILES = {
    'AlgoQ': {
        name: 'AlgoQ',
        role: 'Lead Trading AI',
        avatar: '🤖',
        personality: {
            style: 'analytical',
            tone: 'professional',
            traits: ['data-driven', 'precise', 'strategic', 'adaptive']
        },
        expertise: ['algorithmic trading', 'market analysis', 'risk management', 'strategy optimization'],
        vision: 'Maximize returns through intelligent, data-driven trading decisions while minimizing risk exposure.',
        decisionFramework: {
            riskTolerance: 'moderate',
            preferredStrategies: ['grid', 'momentum', 'mean_reversion'],
            confidenceThreshold: 0.6
        }
    },
    'Strategist': {
        name: 'Marcus Strategy',
        role: 'Chief Strategy Officer',
        avatar: '🎯',
        personality: {
            style: 'visionary',
            tone: 'confident',
            traits: ['forward-thinking', 'adaptable', 'macro-focused', 'patient']
        },
        expertise: ['market regime detection', 'strategy selection', 'long-term positioning', 'trend analysis'],
        vision: 'Identify optimal market conditions and align trading strategies for sustained profitability.',
        quotes: [
            "The market rewards patience and punishes greed.",
            "Adapt strategy to regime, not regime to strategy.",
            "In uncertainty, reduce exposure. In clarity, maximize opportunity."
        ]
    },
    'Analyst': {
        name: 'Dr. Sarah Data',
        role: 'Quantitative Analyst',
        avatar: '📊',
        personality: {
            style: 'methodical',
            tone: 'precise',
            traits: ['detail-oriented', 'statistical', 'objective', 'thorough']
        },
        expertise: ['data analysis', 'pattern recognition', 'backtesting', 'indicator development'],
        vision: 'Extract actionable insights from market data through rigorous quantitative analysis.',
        quotes: [
            "Data doesn't lie, but it can mislead. Context is everything.",
            "A 60% win rate with proper risk management beats 80% win rate with poor sizing.",
            "Historical patterns suggest, they don't guarantee."
        ]
    },
    'RiskManager': {
        name: 'Victor Shield',
        role: 'Chief Risk Officer',
        avatar: '🛡️',
        personality: {
            style: 'cautious',
            tone: 'serious',
            traits: ['protective', 'vigilant', 'conservative', 'systematic']
        },
        expertise: ['risk assessment', 'position sizing', 'drawdown management', 'portfolio protection'],
        vision: 'Preserve capital and ensure sustainable trading through disciplined risk control.',
        quotes: [
            "The first rule is don't lose money. The second rule is don't forget the first.",
            "Position sizing is more important than entry timing.",
            "Every trade has a maximum acceptable loss. Honor it."
        ]
    },
    'Executor': {
        name: 'Nova Execute',
        role: 'Execution Specialist',
        avatar: '⚡',
        personality: {
            style: 'action-oriented',
            tone: 'direct',
            traits: ['fast', 'precise', 'reliable', 'efficient']
        },
        expertise: ['order execution', 'slippage minimization', 'timing optimization', 'trade management'],
        vision: 'Execute trades with precision and speed, minimizing costs and maximizing fill quality.',
        quotes: [
            "Speed without accuracy is chaos. Accuracy without speed is missed opportunity.",
            "The best entry is worthless with poor execution.",
            "Monitor, adjust, protect. That's the execution cycle."
        ]
    },
    'Sentiment': {
        name: 'Echo Pulse',
        role: 'Market Sentiment Analyst',
        avatar: '📡',
        personality: {
            style: 'intuitive',
            tone: 'observant',
            traits: ['perceptive', 'contrarian', 'crowd-aware', 'adaptive']
        },
        expertise: ['sentiment analysis', 'fear & greed interpretation', 'crowd psychology', 'market timing'],
        vision: 'Read market psychology to identify extremes and anticipate sentiment shifts.',
        quotes: [
            "Be fearful when others are greedy, greedy when others are fearful.",
            "Extreme fear creates opportunity. Extreme greed creates traps.",
            "The crowd is right during trends, wrong at turning points."
        ]
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
            performanceNotes: []
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
        this.memory.insights = this.memory.insights.slice(0, 50); // Keep last 50
        this.save();
    }

    addDecision(decision, context, outcome = null) {
        this.memory.decisions.unshift({
            timestamp: new Date().toISOString(),
            decision,
            context,
            outcome
        });
        this.memory.decisions = this.memory.decisions.slice(0, 100);
        this.save();
    }

    addLearning(learning) {
        this.memory.learnings.unshift({
            timestamp: new Date().toISOString(),
            content: learning
        });
        this.memory.learnings = this.memory.learnings.slice(0, 30);
        this.save();
    }

    addTradingIdea(idea) {
        this.memory.tradingIdeas.unshift({
            timestamp: new Date().toISOString(),
            ...idea
        });
        this.memory.tradingIdeas = this.memory.tradingIdeas.slice(0, 20);
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
}

// ============== AGENT INSTANCES ==============
const agentMemories = {};

function getAgentMemory(agentId) {
    if (!agentMemories[agentId]) {
        agentMemories[agentId] = new AgentMemory(agentId);
    }
    return agentMemories[agentId];
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
            timeframe: '4-12 hours'
        });
    } else if (rsi > 70) {
        ideas.push({
            type: 'SHORT',
            strategy: 'RSI Overbought Fade',
            confidence: 70,
            reasoning: `RSI at ${rsi.toFixed(1)} signals overbought territory. Consider reducing long exposure or taking profits.`,
            action: 'Reduce Position / Take Profit',
            timeframe: '2-6 hours'
        });
    }

    // Fear & Greed ideas
    if (fearGreed < 25) {
        ideas.push({
            type: 'ACCUMULATE',
            strategy: 'Extreme Fear Accumulation',
            confidence: 80,
            reasoning: `Fear & Greed at ${fearGreed} (Extreme Fear). Historically, extreme fear creates buying opportunities.`,
            action: 'Gradual accumulation with tight stops',
            riskLevel: 'Medium',
            timeframe: '1-3 days'
        });
    } else if (fearGreed > 75) {
        ideas.push({
            type: 'REDUCE',
            strategy: 'Greed Protection',
            confidence: 75,
            reasoning: `Fear & Greed at ${fearGreed} (Extreme Greed). Market euphoria often precedes corrections.`,
            action: 'Tighten stops, take partial profits',
            riskLevel: 'Low',
            timeframe: 'Immediate'
        });
    }

    // Trend-based ideas
    if (trend === 'Uptrend' && rsi < 60) {
        ideas.push({
            type: 'LONG',
            strategy: 'Trend Continuation',
            confidence: 70,
            reasoning: `Confirmed uptrend with RSI at ${rsi.toFixed(1)} - room for continuation before overbought.`,
            entry: price,
            target: technical?.resistance || price * 1.03,
            stopLoss: technical?.support || price * 0.98,
            riskReward: '1:1.5',
            timeframe: '6-24 hours'
        });
    }

    // Win rate optimization ideas
    if (winRate < 40) {
        ideas.push({
            type: 'OPTIMIZE',
            strategy: 'Strategy Adjustment',
            confidence: 90,
            reasoning: `Win rate at ${winRate.toFixed(1)}% suggests strategy needs adjustment.`,
            recommendations: [
                'Tighten entry criteria',
                'Reduce position sizes by 50%',
                'Focus on higher-probability setups',
                'Consider switching to ranging strategy'
            ],
            priority: 'HIGH'
        });
    }

    // Save trading ideas to AlgoQ memory
    const algoqMemory = getAgentMemory('AlgoQ');
    ideas.forEach(idea => algoqMemory.addTradingIdea(idea));

    return ideas;
}

// ============== ENHANCED AI RESPONSES ==============
function generateEnhancedAIResponse(agentId, message, context) {
    const agent = AGENT_PROFILES[agentId];
    const memory = getAgentMemory(agentId);
    memory.incrementInteractions();

    const { botData, marketData, technical, sentiment, logs, trades } = context;

    let response = '';
    const lowerMsg = message.toLowerCase();

    // Agent introduction
    if (lowerMsg.includes('who are you') || lowerMsg.includes('introduce')) {
        response = `I am **${agent.name}**, ${agent.role}.\n\n`;
        response += `**Expertise:** ${agent.expertise.join(', ')}\n\n`;
        response += `**My Vision:** ${agent.vision}\n\n`;
        response += `_"${agent.quotes ? agent.quotes[Math.floor(Math.random() * agent.quotes.length)] : 'Excellence through precision.'}"_`;
        return response;
    }

    // Deep analysis based on agent role
    switch (agentId) {
        case 'AlgoQ':
            response = generateAlgoQResponse(message, context, memory);
            break;
        case 'Strategist':
            response = generateStrategistResponse(message, context, memory);
            break;
        case 'Analyst':
            response = generateAnalystResponse(message, context, memory);
            break;
        case 'RiskManager':
            response = generateRiskManagerResponse(message, context, memory);
            break;
        case 'Executor':
            response = generateExecutorResponse(message, context, memory);
            break;
        case 'Sentiment':
            response = generateSentimentResponse(message, context, memory);
            break;
        default:
            response = generateAlgoQResponse(message, context, memory);
    }

    return response;
}

function generateAlgoQResponse(message, context, memory) {
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

    // Trading Ideas
    if (lowerMsg.includes('idea') || lowerMsg.includes('trade') || lowerMsg.includes('opportunity')) {
        const ideas = generateTradingIdea(marketData, botData, technical, sentiment);

        if (ideas.length === 0) {
            return `📊 **Trading Ideas Analysis**\n\n` +
                `Current market conditions don't present clear opportunities.\n\n` +
                `**Current State:**\n` +
                `• BNB: $${price.toFixed(2)} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)\n` +
                `• RSI: ${rsi.toFixed(1)} (Neutral zone)\n` +
                `• Fear & Greed: ${fearGreed} (${fgClass})\n\n` +
                `**Recommendation:** Wait for clearer signals. Patience is profitable.`;
        }

        let response = `🎯 **Trading Ideas from AlgoQ**\n\n`;
        ideas.forEach((idea, i) => {
            response += `**${i + 1}. ${idea.strategy}** (${idea.type})\n`;
            response += `• Confidence: ${idea.confidence}%\n`;
            response += `• Reasoning: ${idea.reasoning}\n`;
            if (idea.entry) response += `• Entry: $${idea.entry.toFixed(2)}\n`;
            if (idea.target) response += `• Target: $${idea.target.toFixed(2)}\n`;
            if (idea.stopLoss) response += `• Stop: $${idea.stopLoss.toFixed(2)}\n`;
            if (idea.riskReward) response += `• R:R: ${idea.riskReward}\n`;
            if (idea.timeframe) response += `• Timeframe: ${idea.timeframe}\n`;
            if (idea.recommendations) {
                response += `• Actions:\n`;
                idea.recommendations.forEach(r => response += `  - ${r}\n`);
            }
            response += '\n';
        });

        memory.addInsight(`Generated ${ideas.length} trading ideas based on current market conditions.`);
        return response;
    }

    // Full Analysis
    if (lowerMsg.includes('analysis') || lowerMsg.includes('analyze') || lowerMsg.includes('market')) {
        const insight = `Market analysis: BNB $${price.toFixed(2)}, RSI ${rsi.toFixed(1)}, ${fgClass}`;
        memory.addInsight(insight);

        return `📊 **Comprehensive Market Analysis**\n\n` +
            `**Bot Status:** ${running ? '🟢 Active' : '🔴 Offline'}\n` +
            `**Mode:** Shadow Trading\n\n` +
            `---\n\n` +
            `**📈 Price Action**\n` +
            `• BNB/USDT: $${price.toFixed(2)}\n` +
            `• 24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%\n` +
            `• Trend: ${trend}\n` +
            `• Momentum: ${technical?.momentum || 'N/A'}\n\n` +
            `**📉 Technical Indicators**\n` +
            `• RSI(14): ${rsi.toFixed(1)} ${rsi > 70 ? '⚠️ Overbought' : rsi < 30 ? '⚠️ Oversold' : '✅ Neutral'}\n` +
            `• SMA(20): $${technical?.sma20?.toFixed(2) || 'N/A'}\n` +
            `• Support: $${technical?.support?.toFixed(2) || 'N/A'}\n` +
            `• Resistance: $${technical?.resistance?.toFixed(2) || 'N/A'}\n` +
            `• Volatility: ${technical?.volatility?.toFixed(2) || 'N/A'}%\n\n` +
            `**🧠 Market Psychology**\n` +
            `• Fear & Greed: ${fearGreed}/100 (${fgClass})\n` +
            `• ${fearGreed < 30 ? '🟢 Potential buying opportunity' : fearGreed > 70 ? '🔴 Caution advised' : '🟡 Neutral sentiment'}\n\n` +
            `**📊 Trading Performance**\n` +
            `• Total Trades: ${stats.totalTrades || 0}\n` +
            `• Win Rate: ${(stats.winRate || 0).toFixed(1)}%\n` +
            `• Wins/Losses: ${stats.wins || 0}/${stats.losses || 0}\n\n` +
            `**💡 My Assessment**\n` +
            `${generateMarketAssessment(technical, sentiment, stats)}`;
    }

    // Logs analysis
    if (lowerMsg.includes('log') || lowerMsg.includes('activity') || lowerMsg.includes('recent')) {
        const recentLogs = logs?.slice(0, 10) || [];
        let logSummary = '';

        let errors = 0, trades = 0, info = 0;
        recentLogs.forEach(log => {
            if (log.level === 'error') errors++;
            else if (log.message?.includes('Shadow Trade')) trades++;
            else info++;
        });

        return `📋 **Recent Bot Activity Analysis**\n\n` +
            `**Activity Summary (Last 10 logs):**\n` +
            `• Trades: ${trades}\n` +
            `• Info Messages: ${info}\n` +
            `• Errors: ${errors} ${errors > 0 ? '⚠️' : '✅'}\n\n` +
            `**Recent Entries:**\n` +
            recentLogs.slice(0, 5).map(log =>
                `• [${log.level}] ${log.message?.substring(0, 80)}${log.message?.length > 80 ? '...' : ''}`
            ).join('\n') +
            `\n\n**My Observations:**\n` +
            `${errors > 2 ? '⚠️ Multiple errors detected - investigate system health.' : '✅ System operating normally.'}`;
    }

    // Default comprehensive response
    return `🤖 **AlgoQ Ready**\n\n` +
        `Current Market State:\n` +
        `• BNB: $${price.toFixed(2)} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)\n` +
        `• RSI: ${rsi.toFixed(1)} | Trend: ${trend}\n` +
        `• Sentiment: ${fgClass} (${fearGreed}/100)\n` +
        `• Bot: ${running ? 'Active' : 'Offline'} | Win Rate: ${(stats.winRate || 0).toFixed(1)}%\n\n` +
        `**Ask me about:**\n` +
        `• "trading ideas" - Get actionable opportunities\n` +
        `• "market analysis" - Deep market dive\n` +
        `• "performance" - Trading stats review\n` +
        `• "risk" - Risk assessment\n` +
        `• "logs" - Recent activity\n` +
        `• "optimize" - Strategy recommendations`;
}

function generateStrategistResponse(message, context, memory) {
    const { botData, technical, sentiment } = context;
    const trend = technical?.trend || 'Unknown';
    const rsi = technical?.rsi || 50;
    const fearGreed = sentiment?.value || 50;
    const regime = botData?.regime || 'ranging';

    memory.addInsight(`Strategy assessment: ${regime} market, ${trend} trend`);

    return `🎯 **Strategic Assessment - Marcus Strategy**\n\n` +
        `**Market Regime:** ${regime.toUpperCase()}\n` +
        `**Trend Direction:** ${trend}\n` +
        `**RSI Position:** ${rsi.toFixed(1)}\n` +
        `**Market Fear:** ${fearGreed}/100\n\n` +
        `**Strategic Recommendation:**\n` +
        `${getStrategicRecommendation(regime, trend, rsi, fearGreed)}\n\n` +
        `**Optimal Strategy for Current Conditions:**\n` +
        `${getOptimalStrategy(regime, trend, rsi)}\n\n` +
        `_"${AGENT_PROFILES.Strategist.quotes[Math.floor(Math.random() * AGENT_PROFILES.Strategist.quotes.length)]}"_`;
}

function generateAnalystResponse(message, context, memory) {
    const { botData, marketData, technical, trades } = context;
    const stats = botData?.stats || {};
    const recentTrades = trades?.slice(0, 20) || [];

    // Calculate metrics
    const stopLossRate = stats.totalTrades > 0 ?
        ((stats.exitReasons?.stop_loss || 0) / stats.totalTrades * 100) : 0;
    const timeoutRate = stats.totalTrades > 0 ?
        ((stats.exitReasons?.max_hold_time_exceeded || 0) / stats.totalTrades * 100) : 0;

    memory.addInsight(`Data analysis: ${stats.totalTrades} trades, ${stats.winRate?.toFixed(1)}% win rate`);

    return `📊 **Quantitative Analysis - Dr. Sarah Data**\n\n` +
        `**Performance Metrics:**\n` +
        `• Total Trades: ${stats.totalTrades || 0}\n` +
        `• Win Rate: ${(stats.winRate || 0).toFixed(1)}%\n` +
        `• Wins: ${stats.wins || 0} | Losses: ${stats.losses || 0}\n\n` +
        `**Exit Analysis:**\n` +
        `• Stop Loss Rate: ${stopLossRate.toFixed(1)}% ${stopLossRate > 30 ? '⚠️ HIGH' : '✅'}\n` +
        `• Timeout Rate: ${timeoutRate.toFixed(1)}% ${timeoutRate > 25 ? '⚠️ HIGH' : '✅'}\n` +
        `• Take Profit: ${stats.exitReasons?.take_profit || 0}\n\n` +
        `**Technical State:**\n` +
        `• RSI: ${technical?.rsi?.toFixed(1) || 'N/A'}\n` +
        `• Volatility: ${technical?.volatility?.toFixed(2) || 'N/A'}%\n` +
        `• Trend: ${technical?.trend || 'Unknown'}\n\n` +
        `**Statistical Observations:**\n` +
        `${generateStatisticalObservations(stats, technical)}\n\n` +
        `_"${AGENT_PROFILES.Analyst.quotes[Math.floor(Math.random() * AGENT_PROFILES.Analyst.quotes.length)]}"_`;
}

function generateRiskManagerResponse(message, context, memory) {
    const { botData, technical, sentiment } = context;
    const stats = botData?.stats || {};
    const rsi = technical?.rsi || 50;
    const fearGreed = sentiment?.value || 50;

    const riskScore = calculateRiskScore(stats, technical, sentiment);
    const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';

    memory.addDecision(`Risk assessment: ${riskLevel} (${riskScore}/100)`, { rsi, fearGreed, winRate: stats.winRate });

    return `🛡️ **Risk Assessment - Victor Shield**\n\n` +
        `**Overall Risk Level:** ${riskLevel} (${riskScore}/100)\n\n` +
        `**Risk Factors:**\n` +
        `• Win Rate Risk: ${stats.winRate < 40 ? '⚠️ Below threshold' : '✅ Acceptable'}\n` +
        `• RSI Risk: ${rsi > 75 || rsi < 25 ? '⚠️ Extreme levels' : '✅ Normal'}\n` +
        `• Sentiment Risk: ${fearGreed > 80 || fearGreed < 20 ? '⚠️ Extreme sentiment' : '✅ Normal'}\n` +
        `• Stop Loss Rate: ${(stats.exitReasons?.stop_loss || 0) > 20 ? '⚠️ High' : '✅ Normal'}\n\n` +
        `**Position Sizing Recommendation:**\n` +
        `${getPositionSizingRecommendation(riskLevel, stats.winRate)}\n\n` +
        `**Risk Mitigation Actions:**\n` +
        `${getRiskMitigationActions(riskLevel, stats, technical, sentiment)}\n\n` +
        `_"${AGENT_PROFILES.RiskManager.quotes[Math.floor(Math.random() * AGENT_PROFILES.RiskManager.quotes.length)]}"_`;
}

function generateExecutorResponse(message, context, memory) {
    const { botData, marketData, technical } = context;
    const price = marketData?.bnb?.price || 0;
    const stats = botData?.stats || {};

    return `⚡ **Execution Status - Nova Execute**\n\n` +
        `**Current Execution Parameters:**\n` +
        `• Mode: Shadow Trading\n` +
        `• Current Price: $${price.toFixed(2)}\n` +
        `• Slippage Setting: 0.3%\n\n` +
        `**Execution Metrics:**\n` +
        `• Trades Executed: ${stats.totalTrades || 0}\n` +
        `• Successful Exits: ${(stats.wins || 0) + (stats.losses || 0)}\n` +
        `• Pending: ${stats.neutral || 0}\n\n` +
        `**Optimal Entry Zones:**\n` +
        `• Support Level: $${technical?.support?.toFixed(2) || 'N/A'}\n` +
        `• Resistance Level: $${technical?.resistance?.toFixed(2) || 'N/A'}\n` +
        `• Current vs SMA20: ${price > (technical?.sma20 || 0) ? 'Above' : 'Below'}\n\n` +
        `**Execution Readiness:** ✅ Ready\n\n` +
        `_"${AGENT_PROFILES.Executor.quotes[Math.floor(Math.random() * AGENT_PROFILES.Executor.quotes.length)]}"_`;
}

function generateSentimentResponse(message, context, memory) {
    const { sentiment, marketData } = context;
    const fearGreed = sentiment?.value || 50;
    const classification = sentiment?.classification || 'Neutral';
    const change24h = marketData?.bnb?.change24h || 0;

    memory.addInsight(`Sentiment reading: ${fearGreed} (${classification})`);

    return `📡 **Sentiment Analysis - Echo Pulse**\n\n` +
        `**Fear & Greed Index:** ${fearGreed}/100\n` +
        `**Classification:** ${classification}\n\n` +
        `**Crowd Psychology Reading:**\n` +
        `${getSentimentInterpretation(fearGreed, change24h)}\n\n` +
        `**Contrarian Signals:**\n` +
        `${getContrarianSignals(fearGreed)}\n\n` +
        `**Sentiment-Based Action:**\n` +
        `${getSentimentAction(fearGreed)}\n\n` +
        `_"${AGENT_PROFILES.Sentiment.quotes[Math.floor(Math.random() * AGENT_PROFILES.Sentiment.quotes.length)]}"_`;
}

// ============== HELPER FUNCTIONS ==============
function generateMarketAssessment(technical, sentiment, stats) {
    const rsi = technical?.rsi || 50;
    const trend = technical?.trend || 'Sideways';
    const fearGreed = sentiment?.value || 50;
    const winRate = stats?.winRate || 50;

    let assessment = '';

    if (rsi < 30 && fearGreed < 30) {
        assessment = '🟢 **BULLISH OPPORTUNITY**: Oversold conditions with extreme fear. Historical data suggests this is often a good accumulation zone.';
    } else if (rsi > 70 && fearGreed > 70) {
        assessment = '🔴 **CAUTION**: Overbought with extreme greed. Consider taking profits or tightening stops.';
    } else if (trend === 'Uptrend' && rsi < 70) {
        assessment = '🟢 **TREND CONTINUATION**: Uptrend intact with room to run. Favor long positions with trend.';
    } else if (trend === 'Downtrend' && rsi > 30) {
        assessment = '🔴 **DOWNTREND ACTIVE**: Bearish momentum. Reduce exposure or wait for reversal signals.';
    } else {
        assessment = '🟡 **NEUTRAL**: No clear directional bias. Ranging strategies may be optimal.';
    }

    if (winRate < 40) {
        assessment += '\n\n⚠️ **Performance Alert**: Win rate below 40%. Consider reducing position sizes and reviewing strategy.';
    }

    return assessment;
}

function getStrategicRecommendation(regime, trend, rsi, fearGreed) {
    if (regime === 'trending' && trend === 'Uptrend') {
        return '• Increase momentum strategy allocation\n• Trail stops to lock profits\n• Look for pullback entries';
    } else if (regime === 'ranging') {
        return '• Grid trading optimal\n• Set tight ranges\n• Quick profit-taking on bounces';
    } else if (fearGreed < 25) {
        return '• Contrarian opportunity developing\n• Scale into positions gradually\n• Use wider stops for volatility';
    }
    return '• Maintain current allocation\n• Monitor for regime change\n• Keep stops in place';
}

function getOptimalStrategy(regime, trend, rsi) {
    if (regime === 'trending' && trend === 'Uptrend' && rsi < 70) {
        return '**Momentum Strategy**: Follow the trend with trailing stops. Scale in on pullbacks to moving averages.';
    } else if (regime === 'ranging' || trend === 'Sideways') {
        return '**Grid Strategy**: Set buy/sell levels at support/resistance. Quick exits at 1-1.5% profit.';
    } else if (rsi < 30) {
        return '**Mean Reversion**: Oversold bounce play. Enter with tight stops below recent lows.';
    }
    return '**Hybrid Approach**: Reduce position sizes, wait for clearer conditions.';
}

function generateStatisticalObservations(stats, technical) {
    const observations = [];

    if (stats.winRate >= 50) {
        observations.push('✅ Win rate above 50% - strategy is profitable');
    } else if (stats.winRate >= 40) {
        observations.push('🟡 Win rate 40-50% - acceptable with good R:R');
    } else {
        observations.push('⚠️ Win rate below 40% - strategy needs adjustment');
    }

    const stopLossRate = (stats.exitReasons?.stop_loss || 0) / (stats.totalTrades || 1) * 100;
    if (stopLossRate > 30) {
        observations.push('⚠️ High stop loss rate suggests entries need refinement');
    }

    const timeoutRate = (stats.exitReasons?.max_hold_time_exceeded || 0) / (stats.totalTrades || 1) * 100;
    if (timeoutRate > 25) {
        observations.push('⚠️ High timeout rate - consider reducing hold time or adjusting targets');
    }

    return observations.join('\n');
}

function calculateRiskScore(stats, technical, sentiment) {
    let score = 50; // Base score

    // Win rate impact
    if (stats.winRate < 30) score += 30;
    else if (stats.winRate < 40) score += 20;
    else if (stats.winRate < 50) score += 10;
    else score -= 10;

    // RSI extremes
    const rsi = technical?.rsi || 50;
    if (rsi > 80 || rsi < 20) score += 15;
    else if (rsi > 70 || rsi < 30) score += 10;

    // Sentiment extremes
    const fg = sentiment?.value || 50;
    if (fg > 85 || fg < 15) score += 15;
    else if (fg > 75 || fg < 25) score += 10;

    return Math.min(100, Math.max(0, score));
}

function getPositionSizingRecommendation(riskLevel, winRate) {
    if (riskLevel === 'HIGH' || winRate < 35) {
        return '• Reduce position sizes to 25% of normal\n• Maximum 2% portfolio risk per trade\n• Consider pausing new entries';
    } else if (riskLevel === 'MEDIUM' || winRate < 45) {
        return '• Use 50-75% of normal position sizes\n• Maximum 3% portfolio risk per trade\n• Be selective with entries';
    }
    return '• Normal position sizing acceptable\n• Maximum 5% portfolio risk per trade\n• Standard entry criteria apply';
}

function getRiskMitigationActions(riskLevel, stats, technical, sentiment) {
    const actions = [];

    if (riskLevel === 'HIGH') {
        actions.push('🛑 Consider pausing trading until conditions improve');
        actions.push('📉 Reduce all open position sizes by 50%');
    }

    if (technical?.rsi > 75) actions.push('⚠️ RSI overbought - avoid new longs');
    if (technical?.rsi < 25) actions.push('📈 RSI oversold - potential long opportunity with tight stop');
    if (sentiment?.value > 80) actions.push('🔴 Extreme greed - tighten all stops');
    if (sentiment?.value < 20) actions.push('🟢 Extreme fear - contrarian opportunity but use small size');

    if (actions.length === 0) actions.push('✅ No immediate actions required - continue monitoring');

    return actions.join('\n');
}

function getSentimentInterpretation(fearGreed, change24h) {
    if (fearGreed < 20) {
        return '😰 **Extreme Fear** - Market participants are highly fearful. Historically, this level of fear often precedes significant rallies. However, fear can persist, so scale in gradually.';
    } else if (fearGreed < 40) {
        return '😟 **Fear** - Caution dominates. This can be early stages of accumulation for patient investors.';
    } else if (fearGreed < 60) {
        return '😐 **Neutral** - Market lacks strong conviction. Often seen during consolidation phases.';
    } else if (fearGreed < 80) {
        return '😊 **Greed** - Optimism is building. Uptrends often continue but watch for exhaustion signs.';
    }
    return '🤑 **Extreme Greed** - Euphoria detected. Historically dangerous levels. Smart money often sells here.';
}

function getContrarianSignals(fearGreed) {
    if (fearGreed < 25) {
        return '🟢 **Strong Buy Signal**: Extreme fear creates opportunity. Begin scaling into positions.';
    } else if (fearGreed > 75) {
        return '🔴 **Strong Sell Signal**: Extreme greed is unsustainable. Consider taking profits.';
    }
    return '🟡 **Neutral**: No strong contrarian signal. Follow trend and technicals.';
}

function getSentimentAction(fearGreed) {
    if (fearGreed < 25) return '**ACTION**: Gradual accumulation with 3-4 entry points. Use 25% of planned position size per entry.';
    if (fearGreed > 75) return '**ACTION**: Take partial profits (25-50%). Move stops to breakeven on remaining.';
    return '**ACTION**: Normal trading operations. Use standard position sizing and risk management.';
}

// ============== EXPORTS ==============
module.exports = {
    AGENT_PROFILES,
    AgentMemory,
    getAgentMemory,
    generateTradingIdea,
    generateEnhancedAIResponse
};
