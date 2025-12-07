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

// ============== AGENT DIRECTIVES & MISSIONS ==============
const AGENT_DIRECTIVES = {
    'AlgoQ': {
        directive: 'Lead the council to profitable trading decisions through data-driven analysis and precise execution.',
        missions: [
            'Analyze market conditions and identify optimal entry/exit points',
            'Review bot performance and suggest strategy adjustments',
            'Execute trades with minimal slippage and optimal timing',
            'Synthesize council input into actionable trading decisions'
        ],
        votingWeight: 2.0,  // Lead AI has higher weight
        decisionAuthority: ['execute', 'modify_strategy', 'final_call']
    },
    'Strategist': {
        directive: 'Guide long-term strategy evolution and market regime adaptation.',
        missions: [
            'Detect market regime changes (trending/ranging/volatile)',
            'Recommend strategy adjustments based on macro conditions',
            'Identify optimal position sizing for current regime',
            'Plan entry/exit timing based on strategic outlook'
        ],
        votingWeight: 1.5,
        decisionAuthority: ['strategy', 'regime', 'timing']
    },
    'Analyst': {
        directive: 'Provide deep quantitative analysis and pattern recognition.',
        missions: [
            'Analyze historical patterns and backtesting results',
            'Calculate statistical significance of trading signals',
            'Identify correlations and leading indicators',
            'Validate strategy performance with data'
        ],
        votingWeight: 1.3,
        decisionAuthority: ['analysis', 'validation', 'metrics']
    },
    'RiskManager': {
        directive: 'Protect capital through disciplined risk control and position management.',
        missions: [
            'Monitor portfolio risk and drawdown levels',
            'Set appropriate stop-loss and take-profit levels',
            'Recommend position sizing based on risk parameters',
            'Veto trades that exceed risk thresholds'
        ],
        votingWeight: 1.5,  // Risk has veto power
        decisionAuthority: ['risk', 'position_size', 'veto']
    },
    'Sentiment': {
        directive: 'Interpret market psychology and crowd behavior for contrarian opportunities.',
        missions: [
            'Track Fear & Greed Index and sentiment indicators',
            'Identify crowd positioning extremes',
            'Signal contrarian entry/exit opportunities',
            'Monitor social sentiment and news flow'
        ],
        votingWeight: 1.0,
        decisionAuthority: ['sentiment', 'timing', 'contrarian']
    }
};

// ============== COUNCIL SESSION CLASS ==============
class CouncilSession extends EventEmitter {
    constructor(sessionId, topic, context) {
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
    startSession(topic, context, generateResponse) {
        if (this.activeSession && this.activeSession.state !== CouncilState.STOPPED) {
            return { error: 'Session already in progress', session: this.activeSession.toJSON() };
        }

        const sessionId = `council_${Date.now()}`;
        this.activeSession = new CouncilSession(sessionId, topic, context);
        this.activeSession.state = CouncilState.RESEARCHING;
        this.generateResponse = generateResponse;

        this.emit('session-started', {
            sessionId,
            topic,
            state: this.activeSession.state
        });

        // Start automated discussion loop
        this.runCouncilLoop();

        return { success: true, session: this.activeSession.toJSON() };
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

        this.emit('round-started', {
            sessionId: this.activeSession.sessionId,
            round: this.activeSession.currentRound,
            maxRounds: this.activeSession.maxRounds
        });

        // Each agent discusses in sequence
        const agents = ['AlgoQ', 'Strategist', 'Analyst', 'RiskManager', 'Sentiment'];
        const roundDiscussions = [];

        for (const agentId of agents) {
            if (this.activeSession.isPaused || this.activeSession.state === CouncilState.STOPPED) {
                return;
            }

            const discussion = await this.agentDiscuss(agentId);
            roundDiscussions.push(discussion);

            this.emit('agent-spoke', {
                sessionId: this.activeSession.sessionId,
                round: this.activeSession.currentRound,
                agent: agentId,
                discussion
            });

            // Delay between agents for realistic discussion
            await this.delay(2000);
        }

        this.activeSession.discussions.push({
            round: this.activeSession.currentRound,
            timestamp: new Date().toISOString(),
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

        // Build prompt with context and previous discussions
        let prompt = `Topic: ${topic}\n`;
        prompt += `Your directive: ${directive.directive}\n`;
        prompt += `Round ${this.activeSession.currentRound} of ${this.activeSession.maxRounds}\n\n`;

        if (previousRounds.length > 0) {
            prompt += `Previous round summary:\n`;
            const lastRound = previousRounds[previousRounds.length - 1];
            lastRound.discussions.forEach(d => {
                prompt += `- ${d.agent}: ${d.summary}\n`;
            });
            prompt += '\n';
        }

        if (userInterventions.length > 0) {
            const recent = userInterventions[userInterventions.length - 1];
            prompt += `User guidance: ${recent.message}\n\n`;
        }

        prompt += `Based on your expertise, provide your analysis and recommendation. Consider what consensus we should reach.`;

        // Get AI response
        let response;
        if (this.generateResponse) {
            try {
                response = await this.generateResponse(agentId, prompt, context);
            } catch (e) {
                response = this.generateFallbackResponse(agentId, context);
            }
        } else {
            response = this.generateFallbackResponse(agentId, context);
        }

        return {
            agent: agentId,
            directive: directive.directive,
            content: response,
            summary: this.extractSummary(response),
            timestamp: new Date().toISOString()
        };
    }

    generateFallbackResponse(agentId, context) {
        const directive = AGENT_DIRECTIVES[agentId];
        const price = context?.marketData?.bnb?.price || 700;
        const rsi = context?.technical?.rsi || 50;
        const fg = context?.sentiment?.value || 50;
        const trend = context?.technical?.trend || 'Sideways';

        const responses = {
            'AlgoQ': `Based on current market conditions (BNB: $${price.toFixed(2)}, RSI: ${rsi.toFixed(1)}, Trend: ${trend}), I recommend ${rsi > 70 ? 'reducing long exposure' : rsi < 30 ? 'considering accumulation' : 'maintaining current strategy'}. My directive is to ${directive.directive}`,
            'Strategist': `Current regime appears to be ${trend.toLowerCase()}. With RSI at ${rsi.toFixed(1)} and Fear & Greed at ${fg}, I suggest ${fg < 30 ? 'contrarian accumulation' : fg > 70 ? 'defensive positioning' : 'trend-following strategy'}.`,
            'Analyst': `Statistical analysis shows RSI at ${rsi.toFixed(1)}, which is ${rsi > 70 ? 'overbought - historically leads to correction' : rsi < 30 ? 'oversold - historically leads to bounce' : 'neutral - no clear signal'}. Win rate and exit patterns should guide position sizing.`,
            'RiskManager': `Risk assessment: ${rsi > 75 || rsi < 25 ? 'ELEVATED' : 'MODERATE'}. Fear & Greed at ${fg} suggests ${fg < 25 ? 'extreme fear - opportunity but careful sizing' : fg > 75 ? 'extreme greed - reduce exposure' : 'normal conditions'}. Recommend ${rsi > 70 ? 'tighter stops' : 'standard risk parameters'}.`,
            'Sentiment': `Fear & Greed Index at ${fg} (${fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed'}). ${fg < 30 ? 'Contrarian BUY signal' : fg > 70 ? 'Contrarian SELL signal' : 'No extreme sentiment'}.`
        };

        return responses[agentId] || `Analysis in progress...`;
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
    AGENT_DIRECTIVES,
    councilManager
};
