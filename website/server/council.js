/**
 * AlgoQBot AI Council - Autonomous Consensus System
 *
 * Features:
 * - Automated discussion rounds (max 5 rounds)
 * - Voting system with consensus detection
 * - Session history database
 * - Control panel (start/stop/restart)
 * - Agent directives and missions
 * - Knowledge growth through experience
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// ============== DATABASE PATHS ==============
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const COUNCIL_DIR = path.join(DATA_DIR, 'council');
const HISTORY_FILE = path.join(COUNCIL_DIR, 'session_history.json');
const KNOWLEDGE_FILE = path.join(COUNCIL_DIR, 'collective_knowledge.json');

// Ensure directories exist
[DATA_DIR, COUNCIL_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============== COUNCIL STATE ==============
const CouncilState = {
    IDLE: 'idle',
    RESEARCHING: 'researching',
    DISCUSSING: 'discussing',
    VOTING: 'voting',
    CONSENSUS_REACHED: 'consensus_reached',
    PAUSED: 'paused',
    STOPPED: 'stopped'
};

// ============== DISCUSSION MODES ==============
const DiscussionModes = {
    ANALYSE: 'analyse',
    BRAINSTORM: 'brainstorm',
    DEBATE: 'debate'
};

const MODE_PROMPTS = {
    analyse: {
        instruction: 'Provide detailed quantitative analysis with specific data points, metrics, and evidence-based conclusions. Reference exact numbers and percentages.',
        style: 'analytical',
        responseLength: 'detailed'
    },
    brainstorm: {
        instruction: 'Think creatively and propose innovative strategies. Build on previous speakers\' ideas. Suggest unconventional approaches and explore "what if" scenarios.',
        style: 'creative',
        responseLength: 'exploratory'
    },
    debate: {
        instruction: 'Challenge the previous speaker\'s position directly. Present counter-arguments and alternative viewpoints. Point out weaknesses in their reasoning but remain constructive.',
        style: 'confrontational',
        responseLength: 'argumentative'
    }
};

// ============== AGENT DIRECTIVES & MISSIONS ==============
// TIER 1: MAIN AGENTS (Premium APIs - Decision Makers)
const MAIN_AGENT_DIRECTIVES = {
    'AlgoQ': {
        directive: 'Lead the council as chief orchestrator. Synthesize all inputs, consult specialists when needed, and make final trading decisions.',
        missions: [
            'Orchestrate council discussions and synthesize agent insights',
            'Consult specialist agents for detailed analysis when confidence is low',
            'Analyze market conditions and identify optimal entry/exit points',
            'Execute trades with minimal slippage and optimal timing',
            'Make final decisions after weighing all agent inputs'
        ],
        votingWeight: 2.5,  // Lead AI has highest weight
        decisionAuthority: ['execute', 'modify_strategy', 'final_call', 'consult_specialists'],
        tier: 'main',
        apiProvider: 'claude'
    },
    'Strategist': {
        directive: 'Guide long-term strategy and market direction. Define the strategic compass for all trading decisions.',
        missions: [
            'Detect market regime changes (trending/ranging/volatile)',
            'Define strategic direction and bias',
            'Recommend strategy adjustments based on conditions',
            'Identify optimal position sizing for current regime',
            'Plan entry/exit timing based on strategic outlook'
        ],
        votingWeight: 2.0,
        decisionAuthority: ['strategy', 'regime', 'direction', 'timing'],
        tier: 'main',
        apiProvider: 'deepseek'
    },
    'Analyst': {
        directive: 'Provide rigorous quantitative analysis. Every number verified, every pattern validated with statistical confidence.',
        missions: [
            'Analyze historical patterns and backtesting results',
            'Calculate statistical significance of trading signals',
            'Identify correlations and leading indicators',
            'Validate strategy performance with hard data',
            'Provide probability assessments for setups'
        ],
        votingWeight: 1.8,
        decisionAuthority: ['analysis', 'validation', 'metrics', 'statistics'],
        tier: 'main',
        apiProvider: 'qween'
    }
};

// TIER 2: SPECIALIST AGENTS (Hugging Face - Consulted by Main Agents)
const SPECIALIST_AGENT_DIRECTIVES = {
    'PriceMovement': {
        directive: 'Master of price action. Read every candle, map every level, detect every momentum shift.',
        missions: [
            'Analyze candlestick patterns and price structure',
            'Map key support and resistance levels with exact prices',
            'Detect breakout/breakdown setups and probability',
            'Assess momentum strength and direction',
            'Provide specific price targets for trades'
        ],
        votingWeight: 1.2,
        decisionAuthority: ['price_levels', 'patterns', 'targets'],
        tier: 'specialist',
        apiProvider: 'huggingface'
    },
    'Microstructure': {
        directive: 'See beneath the surface. Analyze order flow, liquidity, and execution quality.',
        missions: [
            'Analyze order book depth and imbalances',
            'Map liquidity concentration zones',
            'Detect whale activity and large orders',
            'Assess slippage risk for different sizes',
            'Recommend optimal execution strategy'
        ],
        votingWeight: 1.0,
        decisionAuthority: ['execution', 'liquidity', 'order_flow'],
        tier: 'specialist',
        apiProvider: 'huggingface'
    },
    'Fundamentals': {
        directive: 'Understand the why behind the what. Fundamentals drive long-term value.',
        missions: [
            'Analyze project tokenomics and supply dynamics',
            'Track news, announcements, and catalysts',
            'Assess development activity and roadmap progress',
            'Evaluate competitive positioning',
            'Identify upcoming events that could move price'
        ],
        votingWeight: 1.0,
        decisionAuthority: ['fundamentals', 'catalysts', 'news'],
        tier: 'specialist',
        apiProvider: 'huggingface'
    },
    'Macro': {
        directive: 'See the forest, not just the trees. Global macro forces shape all markets.',
        missions: [
            'Analyze Fed policy and rate expectations',
            'Track global liquidity conditions',
            'Monitor DXY and crypto correlation',
            'Assess risk-on vs risk-off environment',
            'Identify key macro events on calendar'
        ],
        votingWeight: 1.3,
        decisionAuthority: ['macro', 'liquidity', 'correlation'],
        tier: 'specialist',
        apiProvider: 'huggingface'
    },
    'RiskManager': {
        directive: 'Protect capital through disciplined risk control. Survival first, profits second.',
        missions: [
            'Monitor portfolio risk and drawdown levels',
            'Set appropriate stop-loss and take-profit levels',
            'Recommend position sizing based on risk parameters',
            'Veto trades that exceed risk thresholds',
            'Assess overall portfolio heat'
        ],
        votingWeight: 1.8,  // Risk has veto power
        decisionAuthority: ['risk', 'position_size', 'veto', 'stops'],
        tier: 'specialist',
        apiProvider: 'huggingface'
    },
    'Sentiment': {
        directive: 'Read the crowd. Fade extremes. Follow the smart money.',
        missions: [
            'Track Fear & Greed Index and sentiment indicators',
            'Identify crowd positioning extremes',
            'Signal contrarian entry/exit opportunities',
            'Monitor funding rates and leverage',
            'Detect smart money vs retail divergence'
        ],
        votingWeight: 1.2,
        decisionAuthority: ['sentiment', 'contrarian', 'crowd'],
        tier: 'specialist',
        apiProvider: 'huggingface'
    }
};

// Combined agent directives
const AGENT_DIRECTIVES = { ...MAIN_AGENT_DIRECTIVES, ...SPECIALIST_AGENT_DIRECTIVES };

// ============== COUNCIL SESSION CLASS ==============
class CouncilSession extends EventEmitter {
    constructor(sessionId, topic, context, mode = 'analyse') {
        super();
        this.sessionId = sessionId;
        this.topic = topic;
        this.context = context;
        this.state = CouncilState.IDLE;
        this.currentRound = 0;
        this.maxRounds = 5;
        this.discussions = [];
        this.votes = [];
        this.consensus = null;
        this.startTime = new Date();
        this.endTime = null;
        this.isPaused = false;
        this.userInterventions = [];
        this.discussionMode = mode;
        this.lastSpeaker = null;
        this.roundDiscussions = []; // Current round's discussions for agent exchange
    }

    toJSON() {
        return {
            sessionId: this.sessionId,
            topic: this.topic,
            state: this.state,
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            discussions: this.discussions,
            votes: this.votes,
            consensus: this.consensus,
            startTime: this.startTime,
            endTime: this.endTime,
            userInterventions: this.userInterventions,
            context: {
                price: this.context?.marketData?.bnb?.price,
                rsi: this.context?.technical?.rsi,
                fearGreed: this.context?.sentiment?.value
            }
        };
    }
}

// ============== COUNCIL MANAGER ==============
class CouncilManager {
    constructor() {
        this.activeSession = null;
        this.sessionHistory = this.loadHistory();
        this.collectiveKnowledge = this.loadKnowledge();
        this.eventHandlers = {};
    }

    // Event handling for real-time updates
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => handler(data));
        }
    }

    // Load/Save history
    loadHistory() {
        try {
            if (fs.existsSync(HISTORY_FILE)) {
                return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            }
        } catch (e) {}
        return { sessions: [], totalSessions: 0, successfulConsensus: 0 };
    }

    saveHistory() {
        try {
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.sessionHistory, null, 2));
        } catch (e) {
            console.error('Failed to save council history:', e);
        }
    }

    loadKnowledge() {
        try {
            if (fs.existsSync(KNOWLEDGE_FILE)) {
                return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
            }
        } catch (e) {}
        return {
            patterns: [],
            successfulStrategies: [],
            failedStrategies: [],
            marketInsights: [],
            learnings: []
        };
    }

    saveKnowledge() {
        try {
            fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(this.collectiveKnowledge, null, 2));
        } catch (e) {
            console.error('Failed to save collective knowledge:', e);
        }
    }

    // ============== SESSION CONTROL ==============
    startSession(topic, context, generateResponse, mode = 'analyse') {
        if (this.activeSession && this.activeSession.state !== CouncilState.STOPPED) {
            return { error: 'Session already in progress', session: this.activeSession.toJSON() };
        }

        const sessionId = `council_${Date.now()}`;
        this.activeSession = new CouncilSession(sessionId, topic, context, mode);
        this.activeSession.state = CouncilState.RESEARCHING;
        this.generateResponse = generateResponse;

        this.emit('session-started', {
            sessionId,
            topic,
            mode,
            state: this.activeSession.state
        });

        // Start automated discussion loop
        this.runCouncilLoop();

        return { success: true, session: this.activeSession.toJSON() };
    }

    // Change discussion mode mid-session
    setDiscussionMode(mode) {
        if (!this.activeSession) return { error: 'No active session' };
        if (!MODE_PROMPTS[mode]) return { error: 'Invalid mode' };

        this.activeSession.discussionMode = mode;

        this.emit('mode-changed', {
            sessionId: this.activeSession.sessionId,
            mode
        });

        return { success: true, mode };
    }

    pauseSession() {
        if (!this.activeSession) return { error: 'No active session' };

        this.activeSession.isPaused = true;
        this.activeSession.state = CouncilState.PAUSED;

        this.emit('session-paused', {
            sessionId: this.activeSession.sessionId,
            round: this.activeSession.currentRound
        });

        return { success: true, state: CouncilState.PAUSED };
    }

    resumeSession() {
        if (!this.activeSession) return { error: 'No active session' };
        if (!this.activeSession.isPaused) return { error: 'Session not paused' };

        this.activeSession.isPaused = false;
        this.activeSession.state = CouncilState.DISCUSSING;

        this.emit('session-resumed', {
            sessionId: this.activeSession.sessionId,
            round: this.activeSession.currentRound
        });

        // Continue the loop
        this.runCouncilLoop();

        return { success: true, state: CouncilState.DISCUSSING };
    }

    stopSession() {
        if (!this.activeSession) return { error: 'No active session' };

        this.activeSession.state = CouncilState.STOPPED;
        this.activeSession.endTime = new Date();

        // Save to history
        this.sessionHistory.sessions.unshift(this.activeSession.toJSON());
        this.sessionHistory.sessions = this.sessionHistory.sessions.slice(0, 50); // Keep last 50
        this.sessionHistory.totalSessions++;
        this.saveHistory();

        this.emit('session-stopped', {
            sessionId: this.activeSession.sessionId,
            discussions: this.activeSession.discussions.length
        });

        const result = this.activeSession.toJSON();
        this.activeSession = null;

        return { success: true, session: result };
    }

    restartSession(topic, context, generateResponse) {
        this.stopSession();
        return this.startSession(topic || 'Market Analysis', context, generateResponse);
    }

    // User intervention during council discussion
    userIntervene(message) {
        if (!this.activeSession) return { error: 'No active session' };

        const intervention = {
            timestamp: new Date().toISOString(),
            message,
            round: this.activeSession.currentRound
        };

        this.activeSession.userInterventions.push(intervention);

        this.emit('user-intervention', {
            sessionId: this.activeSession.sessionId,
            intervention
        });

        return { success: true, intervention };
    }

    // ============== AUTOMATED DISCUSSION LOOP ==============
    async runCouncilLoop() {
        if (!this.activeSession || this.activeSession.isPaused) return;
        if (this.activeSession.state === CouncilState.STOPPED) return;
        if (this.activeSession.state === CouncilState.CONSENSUS_REACHED) return;

        // Check max rounds
        if (this.activeSession.currentRound >= this.activeSession.maxRounds) {
            await this.forceConsensus();
            return;
        }

        this.activeSession.currentRound++;
        this.activeSession.state = CouncilState.DISCUSSING;

        // Reset round discussions for agent exchange tracking
        this.activeSession.roundDiscussions = [];
        this.activeSession.lastSpeaker = null;

        this.emit('round-started', {
            sessionId: this.activeSession.sessionId,
            round: this.activeSession.currentRound,
            maxRounds: this.activeSession.maxRounds,
            mode: this.activeSession.discussionMode
        });

        // Each agent discusses in sequence, with context from previous speakers
        const agents = ['AlgoQ', 'Strategist', 'Analyst', 'RiskManager', 'Sentiment'];
        const roundDiscussions = [];

        for (const agentId of agents) {
            if (this.activeSession.isPaused || this.activeSession.state === CouncilState.STOPPED) {
                return;
            }

            const discussion = await this.agentDiscuss(agentId);
            roundDiscussions.push(discussion);

            // Emit with respondingTo field for frontend agent exchange display
            this.emit('agent-spoke', {
                sessionId: this.activeSession.sessionId,
                round: this.activeSession.currentRound,
                agent: agentId,
                respondingTo: discussion.respondingTo,
                discussion
            });

            // Delay between agents for realistic discussion
            await this.delay(2000);
        }

        this.activeSession.discussions.push({
            round: this.activeSession.currentRound,
            timestamp: new Date().toISOString(),
            mode: this.activeSession.discussionMode,
            discussions: roundDiscussions
        });

        // Check for user interventions that need addressing
        const recentIntervention = this.activeSession.userInterventions.find(
            i => i.round === this.activeSession.currentRound
        );

        if (recentIntervention) {
            this.emit('addressing-intervention', {
                intervention: recentIntervention.message
            });
            await this.delay(1500);
        }

        // Voting round
        await this.conductVoting();

        // Check for consensus
        if (this.checkConsensus()) {
            await this.finalizeConsensus();
        } else if (this.activeSession.currentRound < this.activeSession.maxRounds) {
            // Continue to next round
            this.emit('no-consensus', {
                round: this.activeSession.currentRound,
                continuing: true
            });
            await this.delay(3000);
            this.runCouncilLoop();
        } else {
            await this.forceConsensus();
        }
    }

    async agentDiscuss(agentId) {
        const directive = AGENT_DIRECTIVES[agentId];
        const context = this.activeSession.context;
        const topic = this.activeSession.topic;
        const previousRounds = this.activeSession.discussions;
        const userInterventions = this.activeSession.userInterventions;
        const mode = this.activeSession.discussionMode || 'analyse';
        const modeConfig = MODE_PROMPTS[mode];
        const roundDiscussions = this.activeSession.roundDiscussions || [];
        const lastSpeaker = this.activeSession.lastSpeaker;

        // Build prompt with context and previous discussions
        let prompt = `You are ${agentId}, an AI agent in a trading council.\n`;
        prompt += `Topic: ${topic}\n`;
        prompt += `Your directive: ${directive.directive}\n`;
        prompt += `Round ${this.activeSession.currentRound} of ${this.activeSession.maxRounds}\n\n`;

        // Add discussion mode instructions
        prompt += `**DISCUSSION MODE: ${mode.toUpperCase()}**\n`;
        prompt += `${modeConfig.instruction}\n\n`;

        // Add previous rounds context
        if (previousRounds.length > 0) {
            prompt += `### Previous Round Summary:\n`;
            const lastRound = previousRounds[previousRounds.length - 1];
            lastRound.discussions.forEach(d => {
                prompt += `- **${d.agent}**: ${d.summary}\n`;
            });
            prompt += '\n';
        }

        // Add current round discussions - THIS ENABLES AGENT EXCHANGE
        if (roundDiscussions.length > 0) {
            prompt += `### This Round So Far:\n`;
            roundDiscussions.forEach(d => {
                prompt += `- **${d.agent}**: ${d.content}\n`;
            });
            prompt += '\n';

            // In debate mode, specifically reference the last speaker to respond to
            if (mode === 'debate' && lastSpeaker) {
                const lastDiscussion = roundDiscussions.find(d => d.agent === lastSpeaker);
                if (lastDiscussion) {
                    prompt += `**You must respond directly to ${lastSpeaker}'s position:** "${lastDiscussion.summary}"\n`;
                    prompt += `Challenge their reasoning, present counter-arguments, or build upon their analysis.\n\n`;
                }
            }

            // In brainstorm mode, encourage building on ideas
            if (mode === 'brainstorm' && lastSpeaker) {
                prompt += `Build upon the ideas presented so far. What creative strategies can you add?\n\n`;
            }
        }

        // Add user guidance
        if (userInterventions.length > 0) {
            const recent = userInterventions[userInterventions.length - 1];
            prompt += `**User Guidance**: ${recent.message}\n\n`;
        }

        // Add market context
        if (context?.marketData?.bnb) {
            const bnb = context.marketData.bnb;
            prompt += `### Current Market Data:\n`;
            prompt += `- BNB Price: $${bnb.price?.toFixed(2) || 'N/A'}\n`;
            prompt += `- 24h Change: ${bnb.change24h?.toFixed(2) || 'N/A'}%\n`;
            if (context.technical) {
                prompt += `- RSI: ${context.technical.rsi?.toFixed(1) || 'N/A'}\n`;
                prompt += `- Trend: ${context.technical.trend || 'N/A'}\n`;
            }
            if (context.sentiment) {
                prompt += `- Fear & Greed: ${context.sentiment.value || 'N/A'} (${context.sentiment.classification || 'N/A'})\n`;
            }
            prompt += '\n';
        }

        prompt += `Provide your ${modeConfig.style} response. Be specific and reference the data. ${lastSpeaker ? `Engage with ${lastSpeaker}'s points.` : ''}`;

        // Get AI response
        let response;
        let respondingTo = lastSpeaker;

        if (this.generateResponse) {
            try {
                response = await this.generateResponse(agentId, prompt, context);
            } catch (e) {
                response = this.generateFallbackResponse(agentId, context, mode, roundDiscussions);
            }
        } else {
            response = this.generateFallbackResponse(agentId, context, mode, roundDiscussions);
        }

        // Track this agent's discussion for next agents
        const discussion = {
            agent: agentId,
            directive: directive.directive,
            content: response,
            summary: this.extractSummary(response),
            respondingTo,
            mode,
            timestamp: new Date().toISOString()
        };

        this.activeSession.roundDiscussions.push(discussion);
        this.activeSession.lastSpeaker = agentId;

        return discussion;
    }

    generateFallbackResponse(agentId, context, mode = 'analyse', roundDiscussions = []) {
        const directive = AGENT_DIRECTIVES[agentId];
        const price = context?.marketData?.bnb?.price || 700;
        const rsi = context?.technical?.rsi || 50;
        const fg = context?.sentiment?.value || 50;
        const trend = context?.technical?.trend || 'Sideways';
        const lastSpeaker = roundDiscussions.length > 0 ? roundDiscussions[roundDiscussions.length - 1] : null;

        // Base analysis
        const baseAnalysis = {
            'AlgoQ': `BNB: $${price.toFixed(2)}, RSI: ${rsi.toFixed(1)}, Trend: ${trend}`,
            'Strategist': `Regime: ${trend}, RSI: ${rsi.toFixed(1)}, F&G: ${fg}`,
            'Analyst': `RSI: ${rsi.toFixed(1)} (${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'})`,
            'RiskManager': `Risk: ${rsi > 75 || rsi < 25 ? 'ELEVATED' : 'MODERATE'}, F&G: ${fg}`,
            'Sentiment': `F&G: ${fg} (${fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed'})`
        };

        // Mode-specific responses with agent exchange
        const modeResponses = {
            analyse: {
                'AlgoQ': `**Data Analysis**: ${baseAnalysis['AlgoQ']}.\n\nBased on quantitative metrics:\n• RSI at ${rsi.toFixed(1)} indicates ${rsi > 70 ? 'overbought conditions - 73% historical probability of 3% correction' : rsi < 30 ? 'oversold conditions - 68% historical bounce probability' : 'neutral territory - no statistical edge'}.\n• Recommendation: ${rsi > 70 ? 'Scale out 25% of long positions' : rsi < 30 ? 'Initiate 15% position accumulation' : 'Maintain current allocation'}.`,
                'Strategist': `**Strategic Assessment**: ${baseAnalysis['Strategist']}.\n\n${lastSpeaker ? `Building on ${lastSpeaker.agent}'s analysis, ` : ''}Current regime suggests:\n• ${trend === 'Uptrend' ? 'Trend-following long bias with momentum entries' : trend === 'Downtrend' ? 'Defensive positioning with counter-trend scalps' : 'Range-bound strategy with mean reversion'}.\n• Position sizing: ${fg < 30 ? 'Contrarian accumulation (larger size)' : fg > 70 ? 'Reduced exposure (smaller size)' : 'Standard sizing'}.`,
                'Analyst': `**Quantitative Analysis**: ${baseAnalysis['Analyst']}.\n\n${lastSpeaker ? `Validating ${lastSpeaker.agent}'s points: ` : ''}Statistical observations:\n• RSI divergence: ${rsi > 60 && trend === 'Downtrend' ? 'Bullish divergence forming' : rsi < 40 && trend === 'Uptrend' ? 'Bearish divergence warning' : 'No significant divergence'}.\n• Win rate impact: ${rsi > 70 ? 'Historical win rate drops 15% in overbought' : rsi < 30 ? 'Win rate improves 12% from oversold' : 'Baseline win rate expected'}.`,
                'RiskManager': `**Risk Assessment**: ${baseAnalysis['RiskManager']}.\n\n${lastSpeaker ? `Regarding ${lastSpeaker.agent}'s recommendations: ` : ''}Risk parameters:\n• Max drawdown tolerance: ${fg < 25 ? '3% (fear = opportunity)' : fg > 75 ? '1.5% (greed = danger)' : '2.5% standard'}.\n• Stop-loss adjustment: ${rsi > 70 ? 'Tighten to 1.2%' : 'Standard 2%'}.\n• Position limit: ${fg > 80 ? 'Reduce to 50% max allocation' : '75% max allocation'}.`,
                'Sentiment': `**Sentiment Analysis**: ${baseAnalysis['Sentiment']}.\n\n${lastSpeaker ? `Adding to ${lastSpeaker.agent}'s view: ` : ''}Market psychology:\n• Crowd positioning: ${fg < 30 ? 'Extreme pessimism = contrarian BUY signal' : fg > 70 ? 'Extreme optimism = contrarian SELL warning' : 'Neutral sentiment'}.\n• Recommended action: ${fg < 25 ? 'LONG with conviction' : fg > 75 ? 'SHORT or REDUCE' : 'Follow technical signals'}.`
            },
            brainstorm: {
                'AlgoQ': `**Creative Strategy Ideas**: ${baseAnalysis['AlgoQ']}.\n\nInnovative approaches:\n• Grid trading: Set up 5 buy orders at 1% intervals below current price.\n• DCA enhancement: ${rsi < 40 ? 'Accelerate accumulation schedule' : 'Pause and wait for dip'}.\n• What if we tried: Momentum scalping with 0.5% targets during high volume periods?`,
                'Strategist': `**Strategic Innovation**: ${lastSpeaker ? `Building on ${lastSpeaker.agent}'s ideas: ` : ''}What if we:\n• ${trend === 'Uptrend' ? 'Add pyramid positions at each new high' : 'Set up inverse DCA for shorts'}?\n• Explore: Cross-asset correlation strategy using BTC/BNB ratio.\n• Consider: Time-based entries during historically profitable hours (2-4 AM UTC).`,
                'Analyst': `**Data-Driven Creativity**: ${lastSpeaker ? `Expanding ${lastSpeaker.agent}'s concept: ` : ''}New approaches:\n• Pattern recognition: ${rsi > 50 ? 'Look for continuation flags' : 'Scout for reversal patterns'}.\n• Alternative metrics: What if we weighted recent trades 2x in our signals?\n• Experimental: Machine learning ensemble voting on next 4h direction.`,
                'RiskManager': `**Risk Innovation**: ${lastSpeaker ? `Making ${lastSpeaker.agent}'s idea safer: ` : ''}Creative risk management:\n• Dynamic stops: Trail by ATR(14) * 1.5 instead of fixed %.\n• Position scaling: What if we used inverse volatility sizing?\n• Insurance: Consider options collar during high F&G readings.`,
                'Sentiment': `**Sentiment Strategies**: ${lastSpeaker ? `Adding emotional intelligence to ${lastSpeaker.agent}'s strategy: ` : ''}Crowd psychology plays:\n• Contrarian timing: ${fg < 30 ? 'Buy when Twitter is crying' : fg > 70 ? 'Sell when everyone is celebrating' : 'Follow momentum'}.\n• Social signals: Monitor large wallet movements for early warnings.`
            },
            debate: {
                'AlgoQ': `**Challenging the Analysis**: ${baseAnalysis['AlgoQ']}.\n\n${lastSpeaker ? `I disagree with ${lastSpeaker.agent}'s position. ` : ''}Counter-argument:\n• ${rsi < 30 ? 'Just because RSI is oversold doesn\'t mean it can\'t go lower - "oversold can stay oversold"' : 'Overbought conditions can persist in strong trends'}.\n• My position: ${rsi > 60 ? 'Wait for confirmation before acting' : 'Smaller initial size, scale in on confirmation'}.`,
                'Strategist': `**Strategic Counter-Point**: ${lastSpeaker ? `While ${lastSpeaker.agent} makes valid points, ` : ''}I challenge:\n• ${trend === 'Uptrend' ? 'Trends end eventually - we may be near exhaustion' : 'Downtrends offer short opportunities many miss'}.\n• Risk of their approach: ${fg > 50 ? 'Chasing at potentially elevated levels' : 'Missing the turn if sentiment shifts'}.\n• Alternative view: Consider the opposite scenario.`,
                'Analyst': `**Data Debate**: ${lastSpeaker ? `${lastSpeaker.agent}'s analysis overlooks: ` : ''}Statistical concerns:\n• Selection bias: Are we cherry-picking supportive data?\n• Counter-data: ${rsi > 50 ? 'Similar RSI readings in 2022 led to 30% drops' : 'Oversold bounces failed 40% of time in bear markets'}.\n• Weakness: Single-indicator reliance is dangerous.`,
                'RiskManager': `**Risk Challenge**: ${lastSpeaker ? `I must push back on ${lastSpeaker.agent}: ` : ''}Safety concerns:\n• ${fg < 40 ? 'Fear can be justified - don\'t catch falling knives' : 'Complacency is the biggest risk right now'}.\n• Position size debate: ${rsi > 60 ? 'Proposed sizing is too aggressive for these conditions' : 'We\'re being too conservative, missing opportunities'}.\n• Counter-proposal: ${rsi > 70 ? 'Reduce ALL positions by 30%' : 'Maximum 50% of proposed size'}.`,
                'Sentiment': `**Sentiment Counter**: ${lastSpeaker ? `Against ${lastSpeaker.agent}'s view: ` : ''}Market psychology debate:\n• ${fg > 50 ? 'The crowd is right during trends - contrarian losses money' : 'Fear is sometimes rational - smart money is exiting'}.\n• Challenge: ${fg < 30 ? 'Is this "extreme fear" or rational response to real risks?' : 'Is greed driving prices or is there fundamental support?'}.\n• Alternative read: Maybe the crowd is smarter than we think.`
            }
        };

        return modeResponses[mode]?.[agentId] || `Analysis in progress for ${mode} mode...`;
    }

    extractSummary(response) {
        // Extract first sentence or key point
        const sentences = response.split(/[.!?]/);
        return sentences[0]?.trim().slice(0, 100) || 'Analysis provided';
    }

    // ============== VOTING SYSTEM ==============
    async conductVoting() {
        this.activeSession.state = CouncilState.VOTING;

        this.emit('voting-started', {
            sessionId: this.activeSession.sessionId,
            round: this.activeSession.currentRound
        });

        const context = this.activeSession.context;
        const rsi = context?.technical?.rsi || 50;
        const fg = context?.sentiment?.value || 50;
        const trend = context?.technical?.trend || 'Sideways';

        // Each agent votes
        const agents = ['AlgoQ', 'Strategist', 'Analyst', 'RiskManager', 'Sentiment'];
        const roundVotes = {
            round: this.activeSession.currentRound,
            timestamp: new Date().toISOString(),
            votes: [],
            tallies: {
                'LONG': 0,
                'SHORT': 0,
                'HOLD': 0,
                'REDUCE': 0
            }
        };

        for (const agentId of agents) {
            const vote = this.calculateAgentVote(agentId, context);
            const weight = AGENT_DIRECTIVES[agentId].votingWeight;

            roundVotes.votes.push({
                agent: agentId,
                vote: vote.decision,
                confidence: vote.confidence,
                weight,
                weightedScore: vote.confidence * weight,
                reasoning: vote.reasoning
            });

            roundVotes.tallies[vote.decision] =
                (roundVotes.tallies[vote.decision] || 0) + (vote.confidence * weight);

            this.emit('agent-voted', {
                agent: agentId,
                vote: vote.decision,
                confidence: vote.confidence,
                weight
            });

            await this.delay(500);
        }

        // Calculate winning decision
        const sortedDecisions = Object.entries(roundVotes.tallies)
            .sort((a, b) => b[1] - a[1]);

        roundVotes.leadingDecision = sortedDecisions[0][0];
        roundVotes.leadingScore = sortedDecisions[0][1];
        roundVotes.totalVotes = Object.values(roundVotes.tallies).reduce((a, b) => a + b, 0);
        roundVotes.consensusStrength = (roundVotes.leadingScore / roundVotes.totalVotes) * 100;

        this.activeSession.votes.push(roundVotes);

        this.emit('voting-complete', {
            round: this.activeSession.currentRound,
            leadingDecision: roundVotes.leadingDecision,
            consensusStrength: roundVotes.consensusStrength.toFixed(1),
            tallies: roundVotes.tallies
        });

        return roundVotes;
    }

    calculateAgentVote(agentId, context) {
        const rsi = context?.technical?.rsi || 50;
        const fg = context?.sentiment?.value || 50;
        const trend = context?.technical?.trend || 'Sideways';
        const winRate = context?.botData?.stats?.winRate || 50;

        // Agent-specific voting logic
        const voteLogic = {
            'AlgoQ': () => {
                if (rsi < 30 && fg < 40) return { decision: 'LONG', confidence: 0.8, reasoning: 'Oversold with fear' };
                if (rsi > 70 && fg > 60) return { decision: 'SHORT', confidence: 0.7, reasoning: 'Overbought with greed' };
                if (trend === 'Uptrend' && rsi < 65) return { decision: 'LONG', confidence: 0.6, reasoning: 'Trend continuation' };
                if (trend === 'Downtrend' && rsi > 35) return { decision: 'SHORT', confidence: 0.6, reasoning: 'Trend continuation' };
                return { decision: 'HOLD', confidence: 0.5, reasoning: 'No clear signal' };
            },
            'Strategist': () => {
                if (trend === 'Uptrend') return { decision: 'LONG', confidence: 0.7, reasoning: 'Trend is friend' };
                if (trend === 'Downtrend') return { decision: 'SHORT', confidence: 0.7, reasoning: 'Respect the trend' };
                return { decision: 'HOLD', confidence: 0.6, reasoning: 'Ranging market' };
            },
            'Analyst': () => {
                if (rsi < 25) return { decision: 'LONG', confidence: 0.75, reasoning: 'Statistical oversold' };
                if (rsi > 75) return { decision: 'SHORT', confidence: 0.75, reasoning: 'Statistical overbought' };
                if (winRate < 40) return { decision: 'REDUCE', confidence: 0.8, reasoning: 'Poor win rate' };
                return { decision: 'HOLD', confidence: 0.5, reasoning: 'Neutral statistics' };
            },
            'RiskManager': () => {
                if (fg < 20 || fg > 80) return { decision: 'REDUCE', confidence: 0.85, reasoning: 'Extreme sentiment risk' };
                if (rsi < 20 || rsi > 80) return { decision: 'REDUCE', confidence: 0.8, reasoning: 'Extreme RSI risk' };
                if (winRate < 35) return { decision: 'REDUCE', confidence: 0.9, reasoning: 'Protect capital' };
                return { decision: 'HOLD', confidence: 0.6, reasoning: 'Risk acceptable' };
            },
            'Sentiment': () => {
                if (fg < 25) return { decision: 'LONG', confidence: 0.8, reasoning: 'Extreme fear = opportunity' };
                if (fg > 75) return { decision: 'SHORT', confidence: 0.8, reasoning: 'Extreme greed = caution' };
                return { decision: 'HOLD', confidence: 0.5, reasoning: 'Neutral sentiment' };
            }
        };

        return voteLogic[agentId]?.() || { decision: 'HOLD', confidence: 0.5, reasoning: 'Default' };
    }

    // ============== CONSENSUS DETECTION ==============
    checkConsensus() {
        if (this.activeSession.votes.length === 0) return false;

        const lastVote = this.activeSession.votes[this.activeSession.votes.length - 1];

        // Consensus requires 70% agreement
        return lastVote.consensusStrength >= 70;
    }

    async finalizeConsensus() {
        const lastVote = this.activeSession.votes[this.activeSession.votes.length - 1];

        this.activeSession.state = CouncilState.CONSENSUS_REACHED;
        this.activeSession.endTime = new Date();

        this.activeSession.consensus = {
            decision: lastVote.leadingDecision,
            strength: lastVote.consensusStrength,
            round: this.activeSession.currentRound,
            votes: lastVote.votes,
            timestamp: new Date().toISOString(),
            actionPlan: this.generateActionPlan(lastVote.leadingDecision)
        };

        // Add to collective knowledge
        this.addToKnowledge({
            type: 'consensus',
            topic: this.activeSession.topic,
            decision: lastVote.leadingDecision,
            context: {
                rsi: this.activeSession.context?.technical?.rsi,
                fg: this.activeSession.context?.sentiment?.value,
                trend: this.activeSession.context?.technical?.trend
            },
            outcome: 'pending', // Will be updated later
            timestamp: new Date().toISOString()
        });

        // Save session to history
        this.sessionHistory.sessions.unshift(this.activeSession.toJSON());
        this.sessionHistory.sessions = this.sessionHistory.sessions.slice(0, 50);
        this.sessionHistory.totalSessions++;
        this.sessionHistory.successfulConsensus++;
        this.saveHistory();

        this.emit('consensus-reached', {
            sessionId: this.activeSession.sessionId,
            consensus: this.activeSession.consensus
        });

        return this.activeSession.consensus;
    }

    async forceConsensus() {
        // Force consensus after max rounds - use weighted majority
        const allVotes = this.activeSession.votes;
        const aggregatedTallies = {
            'LONG': 0,
            'SHORT': 0,
            'HOLD': 0,
            'REDUCE': 0
        };

        allVotes.forEach(roundVote => {
            Object.entries(roundVote.tallies).forEach(([decision, score]) => {
                aggregatedTallies[decision] += score;
            });
        });

        const sorted = Object.entries(aggregatedTallies).sort((a, b) => b[1] - a[1]);
        const totalScore = Object.values(aggregatedTallies).reduce((a, b) => a + b, 0);

        this.activeSession.state = CouncilState.CONSENSUS_REACHED;
        this.activeSession.endTime = new Date();

        this.activeSession.consensus = {
            decision: sorted[0][0],
            strength: (sorted[0][1] / totalScore) * 100,
            round: this.activeSession.currentRound,
            forced: true,
            timestamp: new Date().toISOString(),
            actionPlan: this.generateActionPlan(sorted[0][0])
        };

        // Save to history
        this.sessionHistory.sessions.unshift(this.activeSession.toJSON());
        this.sessionHistory.sessions = this.sessionHistory.sessions.slice(0, 50);
        this.sessionHistory.totalSessions++;
        this.saveHistory();

        this.emit('consensus-forced', {
            sessionId: this.activeSession.sessionId,
            consensus: this.activeSession.consensus,
            reason: 'Max rounds reached'
        });

        return this.activeSession.consensus;
    }

    generateActionPlan(decision) {
        const plans = {
            'LONG': {
                action: 'Open or increase long position',
                steps: [
                    'Verify entry conditions met',
                    'Calculate position size based on risk parameters',
                    'Set stop-loss at support level',
                    'Set take-profit at resistance',
                    'Execute entry order'
                ],
                riskLevel: 'Medium'
            },
            'SHORT': {
                action: 'Close longs or reduce exposure',
                steps: [
                    'Review current positions',
                    'Identify positions to close',
                    'Execute closing orders',
                    'Tighten stops on remaining positions',
                    'Avoid new long entries'
                ],
                riskLevel: 'Low'
            },
            'HOLD': {
                action: 'Maintain current positions',
                steps: [
                    'Monitor existing positions',
                    'Adjust stops if needed',
                    'Wait for clearer signals',
                    'Continue data collection'
                ],
                riskLevel: 'Low'
            },
            'REDUCE': {
                action: 'Reduce overall exposure',
                steps: [
                    'Close 25-50% of positions',
                    'Tighten all stop-losses',
                    'Reduce position sizes for new trades',
                    'Increase cash allocation',
                    'Wait for conditions to improve'
                ],
                riskLevel: 'Conservative'
            }
        };

        return plans[decision] || plans['HOLD'];
    }

    // ============== KNOWLEDGE MANAGEMENT ==============
    addToKnowledge(learning) {
        this.collectiveKnowledge.learnings.unshift(learning);
        this.collectiveKnowledge.learnings = this.collectiveKnowledge.learnings.slice(0, 200);
        this.saveKnowledge();
    }

    recordOutcome(sessionId, outcome, result) {
        // Update knowledge with actual outcome
        const learning = this.collectiveKnowledge.learnings.find(
            l => l.timestamp && sessionId.includes(l.timestamp.split('T')[0])
        );

        if (learning) {
            learning.outcome = outcome;
            learning.result = result;

            if (outcome === 'success') {
                this.collectiveKnowledge.successfulStrategies.unshift({
                    ...learning,
                    recordedAt: new Date().toISOString()
                });
            } else {
                this.collectiveKnowledge.failedStrategies.unshift({
                    ...learning,
                    recordedAt: new Date().toISOString()
                });
            }

            this.saveKnowledge();
        }
    }

    getKnowledgeContext() {
        return {
            totalLearnings: this.collectiveKnowledge.learnings.length,
            successfulStrategies: this.collectiveKnowledge.successfulStrategies.slice(0, 5),
            failedStrategies: this.collectiveKnowledge.failedStrategies.slice(0, 5),
            recentInsights: this.collectiveKnowledge.learnings.slice(0, 10)
        };
    }

    // ============== HISTORY ACCESS ==============
    getHistory(limit = 20) {
        return {
            sessions: this.sessionHistory.sessions.slice(0, limit),
            totalSessions: this.sessionHistory.totalSessions,
            successfulConsensus: this.sessionHistory.successfulConsensus,
            successRate: this.sessionHistory.totalSessions > 0
                ? ((this.sessionHistory.successfulConsensus / this.sessionHistory.totalSessions) * 100).toFixed(1)
                : 0
        };
    }

    getSessionDetails(sessionId) {
        return this.sessionHistory.sessions.find(s => s.sessionId === sessionId);
    }

    // ============== STATUS ==============
    getStatus() {
        return {
            hasActiveSession: !!this.activeSession,
            activeSession: this.activeSession?.toJSON() || null,
            totalHistoricalSessions: this.sessionHistory.totalSessions,
            knowledgeItems: this.collectiveKnowledge.learnings.length
        };
    }

    // Utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
const councilManager = new CouncilManager();

module.exports = {
    CouncilManager,
    CouncilState,
    DiscussionModes,
    MODE_PROMPTS,
    AGENT_DIRECTIVES,
    councilManager
};
