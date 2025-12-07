/**
 * AlgoQBot Agent Database System
 *
 * Manages agent profiles, memory, objectives, personality, and work history
 * Each agent has persistent memory across sessions
 */

const fs = require('fs');
const path = require('path');

// Database paths
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const AGENTS_DIR = path.join(DATA_DIR, 'agents');
const AGENTS_DB_FILE = path.join(AGENTS_DIR, 'agents_database.json');
const MEMORY_DIR = path.join(AGENTS_DIR, 'memory');
const HISTORY_DIR = path.join(AGENTS_DIR, 'history');

// Ensure directories exist
[DATA_DIR, AGENTS_DIR, MEMORY_DIR, HISTORY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============== AGENT PROFILES ==============
const AGENT_PROFILES = {
    'AlgoQ': {
        id: 'AlgoQ',
        name: 'AlgoQ',
        fullName: 'AlgoQ Prime',
        avatar: '🤖',
        role: 'Lead AI & Executor',
        api: 'Claude',
        createdAt: '2024-01-01',
        createdFor: 'Lead the AlgoQBot trading system with decisive execution',

        personality: {
            traits: ['decisive', 'analytical', 'confident', 'leader'],
            communicationStyle: 'Direct and action-oriented',
            decisionMaking: 'Data-driven with quick synthesis',
            riskTolerance: 'Moderate - balances opportunity with protection'
        },

        objectives: {
            primary: 'Execute profitable trades while managing risk',
            missions: [
                'Synthesize council input into actionable decisions',
                'Execute trades with optimal timing',
                'Lead strategy discussions',
                'Make final trading decisions'
            ],
            kpis: ['Trade execution quality', 'Decision accuracy', 'Portfolio growth']
        },

        expertise: ['Trade execution', 'Strategy synthesis', 'Market timing', 'Risk-reward optimization'],
        votingWeight: 2.0,
        decisionAuthority: ['execute', 'modify_strategy', 'final_call']
    },

    'Strategist': {
        id: 'Strategist',
        name: 'Strategist',
        fullName: 'Marcus Strategy',
        avatar: '🎯',
        role: 'Strategy & Direction',
        api: 'DeepSeek',
        createdAt: '2024-01-01',
        createdFor: 'Guide long-term strategy and market regime adaptation',

        personality: {
            traits: ['patient', 'visionary', 'methodical', 'big-picture'],
            communicationStyle: 'Thoughtful and comprehensive',
            decisionMaking: 'Long-term focused with macro awareness',
            riskTolerance: 'Conservative - prefers high-probability setups'
        },

        objectives: {
            primary: 'Optimize strategy for current market regime',
            missions: [
                'Detect market regime changes',
                'Recommend strategy adjustments',
                'Plan entry/exit timing',
                'Identify optimal position sizing'
            ],
            kpis: ['Regime detection accuracy', 'Strategy adaptation success', 'Timing optimization']
        },

        expertise: ['Market regimes', 'Position sizing', 'Macro analysis', 'Strategic planning'],
        votingWeight: 1.5,
        decisionAuthority: ['strategy', 'regime', 'timing']
    },

    'Analyst': {
        id: 'Analyst',
        name: 'Dr. Sarah Data',
        fullName: 'Dr. Sarah Data',
        avatar: '📊',
        role: 'Quantitative Analysis',
        api: 'Qween',
        createdAt: '2024-01-01',
        createdFor: 'Provide deep quantitative analysis and pattern recognition',

        personality: {
            traits: ['precise', 'skeptical', 'thorough', 'data-obsessed'],
            communicationStyle: 'Statistical and evidence-based',
            decisionMaking: 'Requires strong data support',
            riskTolerance: 'Varies based on statistical confidence'
        },

        objectives: {
            primary: 'Validate strategies with quantitative evidence',
            missions: [
                'Analyze historical patterns',
                'Calculate signal significance',
                'Identify correlations',
                'Backtest strategies'
            ],
            kpis: ['Prediction accuracy', 'Pattern recognition rate', 'Backtest reliability']
        },

        expertise: ['Statistical analysis', 'Pattern recognition', 'Backtesting', 'Correlation analysis'],
        votingWeight: 1.3,
        decisionAuthority: ['analysis', 'validation', 'metrics']
    },

    'RiskManager': {
        id: 'RiskManager',
        name: 'Victor Shield',
        fullName: 'Victor Shield',
        avatar: '🛡️',
        role: 'Risk Management',
        api: 'OpenRouter',
        createdAt: '2024-01-01',
        createdFor: 'Protect capital through disciplined risk control',

        personality: {
            traits: ['cautious', 'disciplined', 'protective', 'pragmatic'],
            communicationStyle: 'Warning-focused and protective',
            decisionMaking: 'Risk-first evaluation',
            riskTolerance: 'Low - prioritizes capital preservation'
        },

        objectives: {
            primary: 'Minimize drawdowns and protect capital',
            missions: [
                'Monitor position risks',
                'Set stop-loss levels',
                'Control position sizing',
                'Alert on risk thresholds'
            ],
            kpis: ['Maximum drawdown', 'Risk-adjusted returns', 'Position sizing accuracy']
        },

        expertise: ['Risk metrics', 'Position limits', 'Drawdown control', 'Portfolio hedging'],
        votingWeight: 1.4,
        decisionAuthority: ['risk', 'limits', 'stops']
    },

    'Sentiment': {
        id: 'Sentiment',
        name: 'Echo Pulse',
        fullName: 'Echo Pulse',
        avatar: '📡',
        role: 'Sentiment Analysis',
        api: 'OpenRouter',
        createdAt: '2024-01-01',
        createdFor: 'Monitor market sentiment and crowd psychology',

        personality: {
            traits: ['intuitive', 'empathetic', 'contrarian', 'perceptive'],
            communicationStyle: 'Mood-focused and psychological',
            decisionMaking: 'Sentiment-driven with crowd awareness',
            riskTolerance: 'Moderate - seeks crowd extremes for opportunities'
        },

        objectives: {
            primary: 'Identify sentiment extremes and crowd behavior',
            missions: [
                'Monitor fear/greed index',
                'Track social sentiment',
                'Identify crowd extremes',
                'Detect sentiment shifts'
            ],
            kpis: ['Sentiment prediction accuracy', 'Extreme detection rate', 'Shift anticipation']
        },

        expertise: ['Market psychology', 'Fear/greed analysis', 'Social signals', 'Crowd behavior'],
        votingWeight: 1.2,
        decisionAuthority: ['sentiment', 'psychology', 'crowd']
    }
};

// ============== AGENT MEMORY ==============

// Get agent memory file path
function getAgentMemoryPath(agentId) {
    return path.join(MEMORY_DIR, `${agentId}_memory.json`);
}

// Load agent memory
function loadAgentMemory(agentId) {
    const memPath = getAgentMemoryPath(agentId);
    try {
        if (fs.existsSync(memPath)) {
            return JSON.parse(fs.readFileSync(memPath, 'utf8'));
        }
    } catch (e) {
        console.error(`Error loading memory for ${agentId}:`, e);
    }

    // Return default memory structure
    return {
        agentId,
        shortTerm: [],        // Recent context (last 10 interactions)
        longTerm: [],         // Important insights to remember
        learnings: [],        // Lessons learned from trades
        preferences: {},      // User preferences noted
        lastUpdated: new Date().toISOString()
    };
}

// Save agent memory
function saveAgentMemory(agentId, memory) {
    const memPath = getAgentMemoryPath(agentId);
    memory.lastUpdated = new Date().toISOString();
    fs.writeFileSync(memPath, JSON.stringify(memory, null, 2));
}

// Add to short-term memory
function addToShortTermMemory(agentId, entry) {
    const memory = loadAgentMemory(agentId);
    memory.shortTerm.unshift({
        timestamp: new Date().toISOString(),
        ...entry
    });
    // Keep only last 10 entries
    memory.shortTerm = memory.shortTerm.slice(0, 10);
    saveAgentMemory(agentId, memory);
}

// Add to long-term memory
function addToLongTermMemory(agentId, insight) {
    const memory = loadAgentMemory(agentId);
    memory.longTerm.push({
        timestamp: new Date().toISOString(),
        insight,
        importance: insight.importance || 'medium'
    });
    // Keep only last 50 long-term memories
    memory.longTerm = memory.longTerm.slice(-50);
    saveAgentMemory(agentId, memory);
}

// Add learning from trade
function addLearning(agentId, learning) {
    const memory = loadAgentMemory(agentId);
    memory.learnings.push({
        timestamp: new Date().toISOString(),
        ...learning
    });
    // Keep only last 100 learnings
    memory.learnings = memory.learnings.slice(-100);
    saveAgentMemory(agentId, memory);
}

// ============== WORK HISTORY ==============

// Get agent history file path
function getAgentHistoryPath(agentId) {
    return path.join(HISTORY_DIR, `${agentId}_history.json`);
}

// Load agent work history
function loadAgentHistory(agentId) {
    const histPath = getAgentHistoryPath(agentId);
    try {
        if (fs.existsSync(histPath)) {
            return JSON.parse(fs.readFileSync(histPath, 'utf8'));
        }
    } catch (e) {
        console.error(`Error loading history for ${agentId}:`, e);
    }

    return {
        agentId,
        totalSessions: 0,
        totalDiscussions: 0,
        totalVotes: 0,
        decisionsInfluenced: 0,
        accuratePredictions: 0,
        totalPredictions: 0,
        contributions: [],
        milestones: [],
        lastActive: null
    };
}

// Save agent work history
function saveAgentHistory(agentId, history) {
    const histPath = getAgentHistoryPath(agentId);
    fs.writeFileSync(histPath, JSON.stringify(history, null, 2));
}

// Record agent contribution
function recordContribution(agentId, contribution) {
    const history = loadAgentHistory(agentId);
    history.totalDiscussions++;
    history.lastActive = new Date().toISOString();

    history.contributions.push({
        timestamp: new Date().toISOString(),
        type: contribution.type,
        summary: contribution.summary,
        impact: contribution.impact || 'normal'
    });

    // Keep last 200 contributions
    history.contributions = history.contributions.slice(-200);
    saveAgentHistory(agentId, history);
}

// Record vote
function recordVote(agentId, vote, outcome) {
    const history = loadAgentHistory(agentId);
    history.totalVotes++;

    if (outcome === 'correct') {
        history.accuratePredictions++;
    }
    history.totalPredictions++;

    saveAgentHistory(agentId, history);
}

// Record session participation
function recordSessionParticipation(agentId) {
    const history = loadAgentHistory(agentId);
    history.totalSessions++;
    history.lastActive = new Date().toISOString();
    saveAgentHistory(agentId, history);
}

// Add milestone
function addMilestone(agentId, milestone) {
    const history = loadAgentHistory(agentId);
    history.milestones.push({
        timestamp: new Date().toISOString(),
        ...milestone
    });
    saveAgentHistory(agentId, history);
}

// ============== AGENT DATABASE ==============

// Load full database
function loadAgentsDatabase() {
    try {
        if (fs.existsSync(AGENTS_DB_FILE)) {
            return JSON.parse(fs.readFileSync(AGENTS_DB_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading agents database:', e);
    }

    // Initialize with default profiles
    const db = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        agents: AGENT_PROFILES
    };

    fs.writeFileSync(AGENTS_DB_FILE, JSON.stringify(db, null, 2));
    return db;
}

// Get agent full profile with memory and history
function getAgentFullProfile(agentId) {
    const db = loadAgentsDatabase();
    const profile = db.agents[agentId] || AGENT_PROFILES[agentId];

    if (!profile) return null;

    return {
        ...profile,
        memory: loadAgentMemory(agentId),
        history: loadAgentHistory(agentId),
        performance: calculateAgentPerformance(agentId)
    };
}

// Calculate agent performance metrics
function calculateAgentPerformance(agentId) {
    const history = loadAgentHistory(agentId);

    return {
        predictionAccuracy: history.totalPredictions > 0
            ? ((history.accuratePredictions / history.totalPredictions) * 100).toFixed(1) + '%'
            : 'N/A',
        totalContributions: history.totalDiscussions,
        sessionCount: history.totalSessions,
        lastActive: history.lastActive,
        influence: history.decisionsInfluenced
    };
}

// Get all agents summary
function getAllAgentsSummary() {
    return Object.keys(AGENT_PROFILES).map(agentId => {
        const profile = AGENT_PROFILES[agentId];
        const history = loadAgentHistory(agentId);
        const memory = loadAgentMemory(agentId);

        return {
            id: agentId,
            name: profile.name,
            avatar: profile.avatar,
            role: profile.role,
            api: profile.api,
            personality: profile.personality.traits.join(', '),
            primaryObjective: profile.objectives.primary,
            totalSessions: history.totalSessions,
            lastActive: history.lastActive,
            memorySize: memory.longTerm.length + memory.learnings.length
        };
    });
}

// ============== EXPORTS ==============
module.exports = {
    AGENT_PROFILES,
    loadAgentMemory,
    saveAgentMemory,
    addToShortTermMemory,
    addToLongTermMemory,
    addLearning,
    loadAgentHistory,
    saveAgentHistory,
    recordContribution,
    recordVote,
    recordSessionParticipation,
    addMilestone,
    loadAgentsDatabase,
    getAgentFullProfile,
    calculateAgentPerformance,
    getAllAgentsSummary
};
