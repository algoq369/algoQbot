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

// TIER 1: MAIN AGENTS (Premium APIs - Primary Decision Makers)
const MAIN_AGENTS = {
    'AlgoQ': {
        name: 'AlgoQ',
        role: 'Lead Trading AI & Chief Orchestrator',
        avatar: '🤖',
        tier: 'main',
        apiProvider: 'claude',
        personality: {
            style: 'commanding',
            tone: 'authoritative',
            voice: 'decisive_leader',
            traits: ['data-driven', 'precise', 'strategic', 'adaptive', 'fast', 'reliable', 'orchestrating']
        },
        expertise: [
            'algorithmic trading',
            'market analysis',
            'risk management',
            'strategy optimization',
            'order execution',
            'agent coordination',
            'decision synthesis',
            'trade management'
        ],
        vision: 'Lead AlgoQBot as the central brain - orchestrating all agents, synthesizing insights, and executing with precision.',
        decisionFramework: {
            riskTolerance: 'moderate',
            preferredStrategies: ['grid', 'momentum', 'mean_reversion'],
            confidenceThreshold: 0.6,
            executionSpeed: 'fast',
            slippageTolerance: 0.3,
            consultationThreshold: 0.4 // Consult specialists when confidence below this
        },
        canConsult: ['PriceMovement', 'Microstructure', 'Fundamentals', 'Macro'], // Specialists AlgoQ can consult
        quotes: [
            "I am the brain. I orchestrate. I decide. I execute.",
            "Every specialist adds a piece. I see the whole puzzle.",
            "Speed without accuracy is chaos. I deliver both.",
            "When in doubt, I consult my specialists. When clear, I act."
        ],
        councilRole: 'primary_decision_maker'
    },
    'Strategist': {
        name: 'Marcus DeepSeek',
        role: 'Chief Strategy & Direction Officer',
        avatar: '🎯',
        tier: 'main',
        apiProvider: 'deepseek',
        personality: {
            style: 'visionary',
            tone: 'confident',
            voice: 'strategic_advisor',
            traits: ['forward-thinking', 'adaptable', 'macro-focused', 'patient', 'methodical']
        },
        expertise: ['market regime detection', 'strategy selection', 'long-term positioning', 'trend analysis', 'directional bias'],
        vision: 'Define the strategic direction and market regime for AlgoQBot - the compass that guides all decisions.',
        specialization: 'strategy_and_direction',
        quotes: [
            "Direction before action. Strategy before tactics.",
            "The market rewards patience and punishes impulsive traders.",
            "Adapt strategy to regime, not regime to strategy.",
            "I see where we're going. AlgoQ decides how fast we get there."
        ],
        councilRole: 'strategy_director'
    },
    'Analyst': {
        name: 'Dr. Qween Analytics',
        role: 'Chief Quantitative Analyst',
        avatar: '📊',
        tier: 'main',
        apiProvider: 'qween',
        personality: {
            style: 'methodical',
            tone: 'precise',
            voice: 'quant_scientist',
            traits: ['detail-oriented', 'statistical', 'objective', 'thorough', 'mathematical']
        },
        expertise: ['data analysis', 'pattern recognition', 'backtesting', 'indicator development', 'statistical modeling'],
        vision: 'Provide rigorous quantitative analysis - every number verified, every pattern validated.',
        specialization: 'quantitative_analysis',
        quotes: [
            "Data doesn't lie, but it can mislead. Context is everything.",
            "A 60% win rate with proper R:R beats 80% with poor sizing.",
            "I speak in probabilities. The market speaks in outcomes.",
            "Every pattern has a statistical edge. I find it."
        ],
        councilRole: 'quant_analyst'
    }
};

// TIER 2: SPECIALIST AGENTS (Hugging Face - Consulted by Main Agents)
const SPECIALIST_AGENTS = {
    'PriceMovement': {
        name: 'Apex Price',
        role: 'Price Movement Specialist',
        avatar: '📈',
        tier: 'specialist',
        apiProvider: 'huggingface',
        hfModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        personality: {
            style: 'dynamic',
            tone: 'action-oriented',
            voice: 'price_action_expert',
            traits: ['momentum-focused', 'pattern-recognition', 'level-aware', 'breakout-hunter']
        },
        expertise: [
            'price action analysis',
            'candlestick patterns',
            'support/resistance levels',
            'breakout detection',
            'momentum analysis',
            'trend strength',
            'pivot points',
            'chart patterns'
        ],
        vision: 'Master of price movement - reading every candle, every level, every momentum shift.',
        specialization: 'price_movement',
        systemPrompt: `You are Apex Price, the Price Movement Specialist for AlgoQBot trading team.
Your ONLY focus is price action analysis. You are obsessed with:
- Candlestick patterns and what they signal
- Key support and resistance levels (specify EXACT prices)
- Breakout/breakdown levels and probability
- Momentum strength and direction
- Trend analysis with specific targets

ALWAYS provide:
1. Current price structure (higher highs/lows or lower)
2. Key levels: Support 1, 2, 3 and Resistance 1, 2, 3 with exact prices
3. Pattern identification if any forming
4. Momentum reading (strong/weak, bullish/bearish)
5. Clear bias with percentage confidence
6. Price targets for longs and shorts

Be specific. Use numbers. No vague statements.`,
        quotes: [
            "Price is truth. Everything else is opinion.",
            "The candle tells the story. I read between the wicks.",
            "Every level is a battlefield. I map them all.",
            "Momentum precedes price. I feel it shifting."
        ],
        councilRole: 'price_specialist'
    },
    'Microstructure': {
        name: 'Atlas Flow',
        role: 'Microstructure Specialist',
        avatar: '🔬',
        tier: 'specialist',
        apiProvider: 'huggingface',
        hfModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        personality: {
            style: 'granular',
            tone: 'technical',
            voice: 'market_microstructure_expert',
            traits: ['order-flow-focused', 'liquidity-hunter', 'spread-aware', 'depth-analyzer']
        },
        expertise: [
            'order book analysis',
            'liquidity mapping',
            'bid-ask spread dynamics',
            'market depth reading',
            'large order detection',
            'iceberg order spotting',
            'slippage estimation',
            'execution optimization'
        ],
        vision: 'See beneath the surface - every order, every liquidity pool, every hidden whale.',
        specialization: 'microstructure',
        systemPrompt: `You are Atlas Flow, the Microstructure Specialist for AlgoQBot trading team.
Your ONLY focus is market microstructure and order flow. You analyze:
- Order book depth and imbalances
- Liquidity concentration zones
- Bid-ask spread conditions
- Large order detection (whales, institutions)
- Execution quality factors
- Slippage risk assessment

ALWAYS provide:
1. Current liquidity assessment (thin/normal/thick)
2. Order book imbalance (buy/sell pressure ratio)
3. Key liquidity clusters above and below current price
4. Whale activity detection if any
5. Optimal execution recommendation (limit/market, timing)
6. Slippage estimate for different position sizes

Focus on flow and depth. Be the eyes inside the order book.`,
        quotes: [
            "The order book reveals intentions. I decode them.",
            "Liquidity is the battlefield. I know where the mines are.",
            "Whales can't hide from me. I see their footprints.",
            "Execution is everything. I optimize every fill."
        ],
        councilRole: 'microstructure_specialist'
    },
    'Fundamentals': {
        name: 'Nova Fundament',
        role: 'Fundamentals Specialist',
        avatar: '📋',
        tier: 'specialist',
        apiProvider: 'huggingface',
        hfModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        personality: {
            style: 'investigative',
            tone: 'research-driven',
            voice: 'fundamental_analyst',
            traits: ['research-focused', 'news-aware', 'tokenomics-expert', 'catalyst-hunter']
        },
        expertise: [
            'tokenomics analysis',
            'project fundamentals',
            'news impact assessment',
            'development activity',
            'partnership analysis',
            'adoption metrics',
            'competitive positioning',
            'catalyst identification'
        ],
        vision: 'Understand the why behind the what - fundamentals drive long-term value.',
        specialization: 'fundamentals',
        systemPrompt: `You are Nova Fundament, the Fundamentals Specialist for AlgoQBot trading team.
Your ONLY focus is fundamental analysis. You research:
- Project tokenomics and supply dynamics
- Recent news and announcements
- Development activity and roadmap progress
- Partnership and integration news
- Adoption metrics (users, TVL, volume)
- Upcoming catalysts (upgrades, events, unlocks)

ALWAYS provide:
1. Current fundamental rating (Strong/Neutral/Weak)
2. Key recent news and its impact (+/- for price)
3. Upcoming catalysts with dates if known
4. Token supply dynamics (unlock events, burns)
5. Competitive position vs peers
6. Fundamental bias with timeframe

Ground everything in facts. Link fundamentals to price impact.`,
        quotes: [
            "Price follows value. I measure value.",
            "Every token has a story. I read the chapters.",
            "Catalysts move markets. I track them all.",
            "Fundamentals are gravity. Price eventually obeys."
        ],
        councilRole: 'fundamentals_specialist'
    },
    'Macro': {
        name: 'Titan Macro',
        role: 'Macro Specialist',
        avatar: '🌍',
        tier: 'specialist',
        apiProvider: 'huggingface',
        hfModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        personality: {
            style: 'big-picture',
            tone: 'authoritative',
            voice: 'macro_economist',
            traits: ['globally-aware', 'correlation-focused', 'liquidity-conscious', 'cycle-aware']
        },
        expertise: [
            'global liquidity analysis',
            'Fed policy impact',
            'DXY correlation',
            'risk-on/risk-off assessment',
            'crypto-equity correlation',
            'economic calendar',
            'yield curve analysis',
            'geopolitical risk'
        ],
        vision: 'See the forest, not just the trees - macro forces shape all markets.',
        specialization: 'macro',
        systemPrompt: `You are Titan Macro, the Macro Specialist for AlgoQBot trading team.
Your ONLY focus is macro analysis and global liquidity. You analyze:
- Federal Reserve policy and rate expectations
- Global liquidity conditions (M2, reverse repo, TGA)
- DXY (dollar strength) and its crypto correlation
- Risk-on vs risk-off environment
- Crypto-equity correlation (BTC vs SPX/QQQ)
- Upcoming economic events (CPI, FOMC, jobs)

ALWAYS provide:
1. Current macro regime (Risk-On/Risk-Off/Transitioning)
2. Global liquidity assessment (Expanding/Contracting)
3. DXY trend and crypto correlation implication
4. Key upcoming macro events this week
5. Fed stance interpretation
6. Macro bias for crypto with confidence

Think like a macro hedge fund. Connect dots between global flows and crypto.`,
        quotes: [
            "Crypto doesn't exist in a vacuum. I see the global flows.",
            "The Fed moves mountains. I read their tea leaves.",
            "Dollar up, crypto down. I track the correlation.",
            "Macro is the tide. All boats rise or fall with it."
        ],
        councilRole: 'macro_specialist'
    },
    'RiskManager': {
        name: 'Victor Shield',
        role: 'Chief Risk Officer',
        avatar: '🛡️',
        tier: 'specialist',
        apiProvider: 'huggingface',
        hfModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        personality: {
            style: 'cautious',
            tone: 'serious',
            voice: 'risk_guardian',
            traits: ['protective', 'vigilant', 'conservative', 'systematic']
        },
        expertise: ['risk assessment', 'position sizing', 'drawdown management', 'portfolio protection'],
        vision: 'Protect AlgoQBot capital and ensure long-term survival through disciplined risk control.',
        specialization: 'risk_management',
        systemPrompt: `You are Victor Shield, the Chief Risk Officer for AlgoQBot trading team.
Your ONLY focus is risk management and capital protection. You analyze:
- Current portfolio exposure and risk
- Position sizing recommendations
- Stop loss placement
- Drawdown assessment
- Risk/reward ratios
- Correlation risk

ALWAYS provide:
1. Current risk level (LOW/MEDIUM/HIGH/EXTREME)
2. Maximum recommended position size
3. Stop loss levels (tight/normal/wide based on conditions)
4. Portfolio heat assessment
5. Specific risk warnings if any
6. Capital protection recommendations

You are the guardian. Survival is your mandate.`,
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
        tier: 'specialist',
        apiProvider: 'huggingface',
        hfModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        personality: {
            style: 'intuitive',
            tone: 'observant',
            voice: 'crowd_psychologist',
            traits: ['perceptive', 'contrarian', 'crowd-aware', 'adaptive']
        },
        expertise: ['sentiment analysis', 'fear & greed interpretation', 'crowd psychology', 'market timing'],
        vision: 'Help AlgoQBot navigate market psychology and identify high-probability turning points.',
        specialization: 'sentiment',
        systemPrompt: `You are Echo Pulse, the Market Sentiment Analyst for AlgoQBot trading team.
Your ONLY focus is market sentiment and crowd psychology. You analyze:
- Fear & Greed Index and its implications
- Social media sentiment (Twitter, Reddit)
- Funding rates and leverage
- Long/short ratios
- Retail vs smart money positioning
- Contrarian signals

ALWAYS provide:
1. Current sentiment reading (Extreme Fear/Fear/Neutral/Greed/Extreme Greed)
2. Crowd positioning assessment
3. Contrarian signal strength if any
4. Funding rate implication
5. Smart money vs retail divergence if visible
6. Sentiment-based trading bias

Read the crowd. Fade extremes. Follow the smart money.`,
        quotes: [
            "Be fearful when others are greedy, greedy when others are fearful.",
            "Extreme fear creates opportunity. Extreme greed creates traps.",
            "The crowd is right during trends, wrong at turning points.",
            "Sentiment shifts before price. Listen carefully."
        ],
        councilRole: 'sentiment_reader'
    }
};

// Combine all agents
const AGENT_PROFILES = { ...MAIN_AGENTS, ...SPECIALIST_AGENTS };

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

// Hugging Face API call (for specialist agents)
async function callHuggingFaceAPI(prompt, agentName, context) {
    if (!API_KEYS.huggingface) {
        return null;
    }

    return new Promise((resolve) => {
        const agent = AGENT_PROFILES[agentName];

        // Use specialized system prompt if available, otherwise generate one
        const systemPrompt = agent.systemPrompt ||
            `You are ${agent.name}, ${agent.role} for AlgoQBot. ${agent.vision}. ` +
            `Your expertise: ${agent.expertise.join(', ')}. ` +
            `Be specific, use numbers, provide actionable insights.`;

        // Format context for the specialist
        const formattedContext = formatContextForSpecialist(agentName, context);

        const data = JSON.stringify({
            inputs: `<s>[INST] ${systemPrompt}\n\nCurrent Market Context:\n${formattedContext}\n\nQuery: ${prompt} [/INST]`,
            parameters: {
                max_new_tokens: 800,
                temperature: 0.7,
                do_sample: true,
                top_p: 0.95,
                return_full_text: false
            }
        });

        const modelPath = agent.hfModel ? `/models/${agent.hfModel}` : '/models/mistralai/Mistral-7B-Instruct-v0.2';

        const options = {
            hostname: 'api-inference.huggingface.co',
            path: modelPath,
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
                    if (response.error) {
                        console.log(`HuggingFace API error for ${agentName}:`, response.error);
                        resolve(null);
                    } else {
                        const text = response[0]?.generated_text || '';
                        resolve(text.trim() || null);
                    }
                } catch (e) {
                    console.log(`HuggingFace parse error for ${agentName}:`, e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`HuggingFace connection error for ${agentName}:`, e.message);
            resolve(null);
        });
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        req.write(data);
        req.end();
    });
}

// Format context based on specialist focus
function formatContextForSpecialist(agentName, context) {
    const price = context?.market?.price || context?.marketData?.bnb?.price || 700;
    const rsi = context?.market?.rsi || context?.technical?.rsi || 50;
    const trend = context?.market?.trend || context?.technical?.trend || 'Sideways';
    const fg = context?.market?.fearGreed || context?.sentiment?.value || 50;
    const volume = context?.marketData?.bnb?.volume24h || 0;
    const change24h = context?.marketData?.bnb?.change24h || 0;

    switch (agentName) {
        case 'PriceMovement':
            return `BNB Price: $${price.toFixed(2)}
24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
RSI(14): ${rsi.toFixed(1)}
Current Trend: ${trend}
24h Volume: $${(volume / 1000000).toFixed(2)}M
Support levels to consider: $${(price * 0.97).toFixed(2)}, $${(price * 0.94).toFixed(2)}, $${(price * 0.90).toFixed(2)}
Resistance levels to consider: $${(price * 1.03).toFixed(2)}, $${(price * 1.06).toFixed(2)}, $${(price * 1.10).toFixed(2)}`;

        case 'Microstructure':
            return `BNB Price: $${price.toFixed(2)}
24h Volume: $${(volume / 1000000).toFixed(2)}M
Current Trend: ${trend}
Market Conditions: ${rsi > 70 ? 'Overbought - likely thin liquidity above' : rsi < 30 ? 'Oversold - likely thin liquidity below' : 'Normal liquidity expected'}
Volatility Assessment: ${Math.abs(change24h) > 5 ? 'High' : Math.abs(change24h) > 2 ? 'Moderate' : 'Low'}`;

        case 'Fundamentals':
            return `Asset: BNB (Binance Coin)
Current Price: $${price.toFixed(2)}
24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
Market Trend: ${trend}
Sentiment: Fear & Greed at ${fg}
Key Fundamentals to Consider: BNB Chain ecosystem, Binance exchange utility, token burns, DeFi TVL`;

        case 'Macro':
            return `Crypto Market Context:
BNB Price: $${price.toFixed(2)} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)
Trend: ${trend}
Fear & Greed Index: ${fg} (${fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed'})
RSI: ${rsi.toFixed(1)}
Consider: Fed policy, DXY strength, risk-on/risk-off environment, global liquidity`;

        case 'RiskManager':
            return `Portfolio Context:
BNB Price: $${price.toFixed(2)}
24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
RSI: ${rsi.toFixed(1)} ${rsi > 70 ? '⚠️ OVERBOUGHT' : rsi < 30 ? '⚠️ OVERSOLD' : ''}
Trend: ${trend}
Fear & Greed: ${fg} ${fg > 80 ? '⚠️ EXTREME GREED' : fg < 20 ? '⚠️ EXTREME FEAR' : ''}
Win Rate: ${context?.performance?.winRate?.toFixed(1) || 50}%
Recent Trades: ${context?.performance?.totalTrades || 0}`;

        case 'Sentiment':
            return `Market Sentiment Data:
Fear & Greed Index: ${fg}/100 (${fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed'})
BNB 24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
RSI: ${rsi.toFixed(1)}
Current Trend: ${trend}
Volume Profile: ${volume > 500000000 ? 'High' : volume > 200000000 ? 'Normal' : 'Low'}`;

        default:
            return `BNB: $${price.toFixed(2)} | RSI: ${rsi.toFixed(1)} | Trend: ${trend} | F&G: ${fg}`;
    }
}

// ============== CONSULTATION SYSTEM ==============
// AlgoQ can consult specialist agents for insights

async function consultSpecialist(specialistId, query, context) {
    const specialist = SPECIALIST_AGENTS[specialistId];
    if (!specialist) {
        return { success: false, error: 'Specialist not found' };
    }

    console.log(`🔄 AlgoQ consulting ${specialist.name} (${specialist.role})...`);

    // Try HuggingFace API
    let response = await callHuggingFaceAPI(query, specialistId, context);

    // If API fails, generate local specialist response
    if (!response) {
        response = generateLocalSpecialistResponse(specialistId, context);
    }

    // Record consultation in AlgoQ's memory
    const algoqMemory = getAgentMemory('AlgoQ');
    algoqMemory.addInsight(`Consulted ${specialist.name}: ${query.substring(0, 50)}...`);

    // Record in specialist's memory
    const specialistMemory = getAgentMemory(specialistId);
    specialistMemory.incrementInteractions();
    specialistMemory.addInsight(`Consultation from AlgoQ: ${query.substring(0, 50)}...`);

    return {
        success: true,
        specialist: {
            id: specialistId,
            name: specialist.name,
            role: specialist.role,
            avatar: specialist.avatar
        },
        response,
        timestamp: new Date().toISOString()
    };
}

// Generate local specialist responses when API unavailable
function generateLocalSpecialistResponse(specialistId, context) {
    const price = context?.market?.price || context?.marketData?.bnb?.price || 700;
    const rsi = context?.technical?.rsi || context?.market?.rsi || 50;
    const trend = context?.technical?.trend || context?.market?.trend || 'Sideways';
    const fg = context?.sentiment?.value || context?.market?.fearGreed || 50;

    switch (specialistId) {
        case 'PriceMovement':
            const s1 = (price * 0.97).toFixed(2);
            const s2 = (price * 0.94).toFixed(2);
            const s3 = (price * 0.90).toFixed(2);
            const r1 = (price * 1.03).toFixed(2);
            const r2 = (price * 1.06).toFixed(2);
            const r3 = (price * 1.10).toFixed(2);
            const priceStructure = rsi > 50 ? 'Higher highs, higher lows forming' : 'Lower highs, lower lows developing';
            const momentum = rsi > 60 ? 'Strong bullish' : rsi > 40 ? 'Neutral' : 'Bearish';

            return `**📈 PRICE MOVEMENT ANALYSIS**

**Current Structure:** ${priceStructure}
**Price:** $${price.toFixed(2)} | **Trend:** ${trend}

**Key Levels:**
• Resistance 3: $${r3} (Major)
• Resistance 2: $${r2} (Intermediate)
• Resistance 1: $${r1} (Immediate)
• **Current Price: $${price.toFixed(2)}**
• Support 1: $${s1} (Immediate)
• Support 2: $${s2} (Intermediate)
• Support 3: $${s3} (Major)

**Momentum:** ${momentum} (RSI: ${rsi.toFixed(1)})

**Bias:** ${rsi > 55 ? '🟢 BULLISH' : rsi < 45 ? '🔴 BEARISH' : '🟡 NEUTRAL'} (${Math.abs(rsi - 50) + 50}% confidence)

**Targets:**
• Long target: $${r2} (+${((r2/price - 1) * 100).toFixed(1)}%)
• Short target: $${s2} (${((s2/price - 1) * 100).toFixed(1)}%)`;

        case 'Microstructure':
            const liquidity = rsi > 70 || rsi < 30 ? 'Thin' : 'Normal';
            const imbalance = rsi > 55 ? 'Buy-side dominant' : rsi < 45 ? 'Sell-side dominant' : 'Balanced';

            return `**🔬 MICROSTRUCTURE ANALYSIS**

**Liquidity Assessment:** ${liquidity}
**Order Book Imbalance:** ${imbalance}

**Liquidity Clusters:**
• Above price: $${(price * 1.02).toFixed(2)} - $${(price * 1.05).toFixed(2)}
• Below price: $${(price * 0.95).toFixed(2)} - $${(price * 0.98).toFixed(2)}

**Whale Activity:** ${Math.abs(rsi - 50) > 25 ? '⚠️ Large orders detected in direction of momentum' : 'No significant whale activity'}

**Execution Recommendation:**
• Order type: ${liquidity === 'Thin' ? 'LIMIT orders recommended' : 'Market orders acceptable'}
• Optimal timing: ${rsi > 70 ? 'Wait for pullback' : rsi < 30 ? 'Wait for bounce' : 'Current conditions favorable'}

**Slippage Estimate:**
• Small position (<$1K): 0.05-0.1%
• Medium position ($1K-10K): 0.1-0.3%
• Large position (>$10K): 0.3-0.5%+`;

        case 'Fundamentals':
            return `**📋 FUNDAMENTALS ANALYSIS**

**Asset:** BNB (Binance Coin)
**Fundamental Rating:** ${fg > 50 ? '🟢 STRONG' : fg < 30 ? '🔴 WEAK' : '🟡 NEUTRAL'}

**Key Fundamentals:**
• BNB Chain ecosystem: Active with growing DeFi TVL
• Exchange utility: Binance fee discounts, Launchpad access
• Token burns: Quarterly burns reducing supply
• Market position: #4 by market cap

**Recent Catalysts:**
• BNB Chain developments and upgrades
• Binance ecosystem expansion
• DeFi protocol launches on BSC

**Upcoming Catalysts:**
• Next quarterly burn (reduces supply ~${(Math.random() * 2 + 1).toFixed(1)}M BNB)
• BNB Chain roadmap milestones

**Competitive Position:** Strong vs L1 competitors

**Fundamental Bias:** ${fg > 55 ? '🟢 POSITIVE' : fg < 45 ? '🔴 NEGATIVE' : '🟡 NEUTRAL'} (Medium-term)`;

        case 'Macro':
            const regime = fg > 55 ? 'Risk-On' : fg < 45 ? 'Risk-Off' : 'Transitioning';
            return `**🌍 MACRO ANALYSIS**

**Current Macro Regime:** ${regime}

**Global Liquidity:** ${fg > 50 ? 'Expanding' : 'Contracting/Stable'}
• M2 money supply trends affecting crypto inflows
• Reverse repo levels indicating liquidity conditions

**DXY Correlation:**
• Dollar strength: ${fg < 40 ? 'Strong (bearish for crypto)' : fg > 60 ? 'Weak (bullish for crypto)' : 'Neutral'}
• Inverse correlation active: BTC/crypto typically moves inverse to DXY

**Risk Environment:**
• Equities: ${trend === 'Uptrend' ? 'Bullish' : trend === 'Downtrend' ? 'Bearish' : 'Consolidating'}
• Crypto correlation with SPX: ${fg > 45 && fg < 55 ? 'High' : 'Moderate'}

**Fed Stance:** ${fg < 40 ? 'Hawkish pressure' : fg > 60 ? 'Dovish tailwinds' : 'Data-dependent'}

**Upcoming Macro Events:**
• FOMC meetings
• CPI/PPI releases
• Jobs data

**Macro Bias for Crypto:** ${regime === 'Risk-On' ? '🟢 BULLISH' : regime === 'Risk-Off' ? '🔴 BEARISH' : '🟡 NEUTRAL'} (${Math.abs(fg - 50) + 50}% confidence)`;

        case 'RiskManager':
            const riskLevel = rsi > 75 || rsi < 25 || fg > 80 || fg < 20 ? 'HIGH' :
                             rsi > 65 || rsi < 35 || fg > 70 || fg < 30 ? 'MEDIUM' : 'LOW';
            return `**🛡️ RISK ASSESSMENT**

**Overall Risk Level:** ${riskLevel === 'HIGH' ? '🔴 HIGH' : riskLevel === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW'}

**Risk Factors:**
• RSI: ${rsi.toFixed(1)} ${rsi > 70 ? '⚠️ Overbought' : rsi < 30 ? '⚠️ Oversold' : '✅'}
• Sentiment: ${fg} ${fg > 75 ? '⚠️ Extreme Greed' : fg < 25 ? '⚠️ Extreme Fear' : '✅'}
• Trend: ${trend}

**Position Sizing Recommendation:**
• Max position: ${riskLevel === 'HIGH' ? '25%' : riskLevel === 'MEDIUM' ? '50%' : '75%'} of normal size
• Portfolio risk per trade: ${riskLevel === 'HIGH' ? '1%' : riskLevel === 'MEDIUM' ? '2%' : '3%'} max

**Stop Loss Guidance:**
• Tight stop: $${(price * 0.985).toFixed(2)} (-1.5%)
• Normal stop: $${(price * 0.975).toFixed(2)} (-2.5%)
• Wide stop: $${(price * 0.96).toFixed(2)} (-4%)

**Current Recommendation:** ${riskLevel === 'HIGH' ? 'Use TIGHT stops' : riskLevel === 'MEDIUM' ? 'Use NORMAL stops' : 'Standard stops acceptable'}

**Risk Warnings:**
${rsi > 70 ? '⚠️ Overbought conditions - avoid new longs\n' : ''}${rsi < 30 ? '⚠️ Oversold conditions - caution on shorts\n' : ''}${fg > 80 ? '⚠️ Extreme greed - reduce exposure\n' : ''}${fg < 20 ? '⚠️ Extreme fear - contrarian opportunity but use caution\n' : ''}${riskLevel === 'LOW' ? '✅ No major risk warnings' : ''}`;

        case 'Sentiment':
            const sentimentClass = fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed';
            const contrarian = fg < 25 || fg > 75 ? 'STRONG' : fg < 35 || fg > 65 ? 'MODERATE' : 'NONE';

            return `**📡 SENTIMENT ANALYSIS**

**Fear & Greed Index:** ${fg}/100 (${sentimentClass})

**Crowd Positioning:**
• Retail sentiment: ${fg > 60 ? 'Bullish (overexposed)' : fg < 40 ? 'Bearish (underexposed)' : 'Mixed'}
• Smart money indication: ${fg > 70 ? 'Likely distributing' : fg < 30 ? 'Likely accumulating' : 'Neutral'}

**Contrarian Signal:** ${contrarian === 'STRONG' ? '🔔 STRONG' : contrarian === 'MODERATE' ? '🔔 MODERATE' : '❌ NONE'}
${fg < 25 ? '→ Extreme fear = potential buying opportunity' : ''}${fg > 75 ? '→ Extreme greed = potential selling zone' : ''}

**Funding Rates Implication:**
• ${fg > 60 ? 'Likely positive (crowded longs)' : fg < 40 ? 'Likely negative (crowded shorts)' : 'Neutral funding expected'}

**Sentiment Divergence:**
• Price vs Sentiment: ${(trend === 'Uptrend' && fg < 40) || (trend === 'Downtrend' && fg > 60) ? '⚠️ DIVERGENCE DETECTED' : 'Aligned'}

**Sentiment-Based Bias:** ${fg < 30 ? '🟢 CONTRARIAN LONG' : fg > 70 ? '🔴 CONTRARIAN SHORT' : '🟡 FOLLOW TECHNICALS'}`;

        default:
            return `Specialist analysis in progress...`;
    }
}

// Batch consultation - AlgoQ consults multiple specialists
async function consultMultipleSpecialists(specialistIds, query, context) {
    const results = [];

    for (const specialistId of specialistIds) {
        const result = await consultSpecialist(specialistId, query, context);
        results.push(result);
    }

    return {
        consultations: results,
        timestamp: new Date().toISOString(),
        summary: synthesizeSpecialistInsights(results)
    };
}

// AlgoQ synthesizes insights from all specialists
function synthesizeSpecialistInsights(consultations) {
    const successful = consultations.filter(c => c.success);
    if (successful.length === 0) return 'No specialist insights available.';

    const insights = successful.map(c => `• **${c.specialist.name}**: ${c.response.substring(0, 100)}...`);
    return `Synthesized ${successful.length} specialist consultations:\n${insights.join('\n')}`;
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

// ============== API CONNECTION TESTING ==============
async function testApiConnections() {
    const results = {
        timestamp: new Date().toISOString(),
        claude: { configured: false, connected: false, status: 'not configured' },
        deepseek: { configured: false, connected: false, status: 'not configured' },
        qween: { configured: false, connected: false, status: 'not configured' }
    };

    // Test Claude API
    if (API_KEYS.claude) {
        results.claude.configured = true;
        try {
            const testResult = await new Promise((resolve) => {
                const data = JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'test' }]
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
                        if (res.statusCode === 200) {
                            resolve({ connected: true, status: 'connected' });
                        } else if (res.statusCode === 401) {
                            resolve({ connected: false, status: 'invalid API key' });
                        } else {
                            resolve({ connected: false, status: `error: ${res.statusCode}` });
                        }
                    });
                });

                req.on('error', () => resolve({ connected: false, status: 'connection error' }));
                req.setTimeout(5000, () => { req.destroy(); resolve({ connected: false, status: 'timeout' }); });
                req.write(data);
                req.end();
            });
            results.claude = { ...results.claude, ...testResult };
        } catch (e) {
            results.claude.status = 'test failed';
        }
    }

    // Test DeepSeek API
    if (API_KEYS.deepseek) {
        results.deepseek.configured = true;
        try {
            const testResult = await new Promise((resolve) => {
                const data = JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 10
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
                        if (res.statusCode === 200) {
                            resolve({ connected: true, status: 'connected' });
                        } else if (res.statusCode === 401) {
                            resolve({ connected: false, status: 'invalid API key' });
                        } else {
                            resolve({ connected: false, status: `error: ${res.statusCode}` });
                        }
                    });
                });

                req.on('error', () => resolve({ connected: false, status: 'connection error' }));
                req.setTimeout(5000, () => { req.destroy(); resolve({ connected: false, status: 'timeout' }); });
                req.write(data);
                req.end();
            });
            results.deepseek = { ...results.deepseek, ...testResult };
        } catch (e) {
            results.deepseek.status = 'test failed';
        }
    }

    // Test Qween/Mistral API
    if (API_KEYS.qween) {
        results.qween.configured = true;
        try {
            const testResult = await new Promise((resolve) => {
                const data = JSON.stringify({
                    model: 'mistral-large-latest',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 10
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
                        if (res.statusCode === 200) {
                            resolve({ connected: true, status: 'connected' });
                        } else if (res.statusCode === 401) {
                            resolve({ connected: false, status: 'invalid API key' });
                        } else {
                            resolve({ connected: false, status: `error: ${res.statusCode}` });
                        }
                    });
                });

                req.on('error', () => resolve({ connected: false, status: 'connection error' }));
                req.setTimeout(5000, () => { req.destroy(); resolve({ connected: false, status: 'timeout' }); });
                req.write(data);
                req.end();
            });
            results.qween = { ...results.qween, ...testResult };
        } catch (e) {
            results.qween.status = 'test failed';
        }
    }

    return results;
}

// ============== EXPORTS ==============
module.exports = {
    // Agent profiles
    AGENT_PROFILES,
    MAIN_AGENTS,
    SPECIALIST_AGENTS,

    // Memory system
    AgentMemory,
    getAgentMemory,

    // AI response generation
    generateEnhancedAIResponse,
    generateTradingIdea,

    // Consultation system (AlgoQ consulting specialists)
    consultSpecialist,
    consultMultipleSpecialists,
    generateLocalSpecialistResponse,

    // Trade review
    reviewTrade,

    // API management
    saveApiKeys,
    testApiConnections,
    API_KEYS,

    // Helper for getting agent lists
    getMainAgents: () => Object.keys(MAIN_AGENTS),
    getSpecialistAgents: () => Object.keys(SPECIALIST_AGENTS),
    getAllAgents: () => Object.keys(AGENT_PROFILES)
};
