/**
 * AI Council - Orchestrator Engine (JavaScript version)
 * Manages the consensus loop between Claude, DeepSeek, and Qwen
 */

const { v4: uuidv4 } = require('uuid');

class CouncilOrchestrator {
  constructor(claudeApiKey, deepseekApiKey, qwenApiKey, config = {}) {
    this.claudeApiKey = claudeApiKey;
    this.deepseekApiKey = deepseekApiKey;
    this.qwenApiKey = qwenApiKey;
    this.config = {
      maxRounds: config.maxRounds || 3,
      consensusThreshold: config.consensusThreshold || 0.8,
      enableStreaming: config.enableStreaming || false
    };
    this.session = null;
    this.eventHandlers = [];
  }

  onEvent(handler) {
    this.eventHandlers.push(handler);
  }

  emit(event) {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  async startSession(task) {
    this.session = {
      id: uuidv4(),
      task,
      status: 'in_progress',
      messages: [],
      consensus: {
        round: 0,
        maxRounds: this.config.maxRounds,
        positions: new Map(),
        agreementScore: 0,
        consensusReached: false
      },
      totalTokens: { input: 0, output: 0, total: 0, cost: 0 },
      startTime: new Date()
    };

    this.emit({
      type: 'status',
      data: { status: 'started', session: this.session.id, task },
      timestamp: new Date()
    });

    await this.runConsensusLoop();
    return this.session;
  }

  async runConsensusLoop() {
    if (!this.session) return;

    while (
      this.session.consensus.round < this.config.maxRounds &&
      !this.session.consensus.consensusReached
    ) {
      this.session.consensus.round++;
      this.session.status = 'debating';

      this.emit({
        type: 'status',
        data: {
          status: 'round_start',
          round: this.session.consensus.round,
          maxRounds: this.config.maxRounds
        },
        timestamp: new Date()
      });

      const responses = await this.getParallelResponses();

      for (const response of responses) {
        this.session.consensus.positions.set(response.provider, response);
        this.updateTotalTokens(response.tokens);
        this.emit({
          type: 'message',
          provider: response.provider,
          data: {
            provider: response.provider,
            content: response.content,
            confidence: response.confidence,
            stance: response.stance
          },
          timestamp: new Date()
        });
      }

      this.session.consensus.agreementScore = this.calculateAgreementScore(responses);

      if (this.session.consensus.agreementScore >= this.config.consensusThreshold) {
        this.session.consensus.consensusReached = true;
        this.session.consensus.finalDecision = this.extractFinalDecision(responses);
        this.session.status = 'consensus_reached';

        this.emit({
          type: 'consensus',
          data: {
            reached: true,
            score: this.session.consensus.agreementScore,
            decision: this.session.consensus.finalDecision,
            round: this.session.consensus.round
          },
          timestamp: new Date()
        });
      } else {
        this.emit({
          type: 'status',
          data: {
            status: 'round_end',
            round: this.session.consensus.round,
            agreementScore: this.session.consensus.agreementScore,
            consensusReached: false
          },
          timestamp: new Date()
        });
      }
    }

    if (!this.session.consensus.consensusReached) {
      const responses = Array.from(this.session.consensus.positions.values());
      const votingResult = this.conductMajorityVote(responses);
      this.session.consensus.votingResult = votingResult;
      this.session.consensus.finalDecision = votingResult.decision;
      this.session.status = 'completed';

      this.emit({
        type: 'consensus',
        data: {
          reached: false,
          votingResult: votingResult,
          maxRoundsReached: true
        },
        timestamp: new Date()
      });
    }

    this.session.endTime = new Date();
  }

  async getParallelResponses() {
    if (!this.session) return [];

    const previousResponses = this.formatPreviousResponses();
    const isFirstRound = this.session.consensus.round === 1;

    const userMessage = isFirstRound
      ? this.session.task
      : `Previous responses from the council:\n${previousResponses}\n\nPlease review and refine your position.`;

    const promises = [
      this.callClaude(userMessage),
      this.callDeepSeek(userMessage),
      this.callQwen(userMessage)
    ];

    const results = await Promise.allSettled(promises);
    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async callClaude(message) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: 'You are Claude, an AI assistant participating in a council discussion. Be concise and provide clear reasoning. End your response with a confidence level (0-100) and stance (agree/partial_agree/disagree).',
          messages: [{ role: 'user', content: message }]
        })
      });

      const data = await response.json();
      const content = data.content?.[0]?.text || 'No response';
      const { confidence, stance } = this.extractMetadata(content);

      return {
        provider: 'claude',
        content,
        confidence,
        stance,
        tokens: {
          input: data.usage?.input_tokens || 0,
          output: data.usage?.output_tokens || 0,
          total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
          cost: 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Claude error:', error.message);
      return this.errorResponse('claude', error.message);
    }
  }

  async callDeepSeek(message) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deepseekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are DeepSeek, an AI assistant participating in a council discussion. Be concise and provide clear reasoning. End your response with a confidence level (0-100) and stance (agree/partial_agree/disagree).'
            },
            { role: 'user', content: message }
          ],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'No response';
      const { confidence, stance } = this.extractMetadata(content);

      return {
        provider: 'deepseek',
        content,
        confidence,
        stance,
        tokens: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
          cost: 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DeepSeek error:', error.message);
      return this.errorResponse('deepseek', error.message);
    }
  }

  async callQwen(message) {
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.qwenApiKey}`
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are Qwen, an AI assistant participating in a council discussion. Be concise and provide clear reasoning. End your response with a confidence level (0-100) and stance (agree/partial_agree/disagree).'
            },
            { role: 'user', content: message }
          ],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'No response';
      const { confidence, stance } = this.extractMetadata(content);

      return {
        provider: 'qwen',
        content,
        confidence,
        stance,
        tokens: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
          cost: 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Qwen error:', error.message);
      return this.errorResponse('qwen', error.message);
    }
  }

  extractMetadata(content) {
    let confidence = 75;
    let stance = 'partial_agree';

    const confMatch = content.match(/confidence[:\s]*(\d+)/i);
    if (confMatch) confidence = parseInt(confMatch[1], 10);

    if (content.toLowerCase().includes('disagree')) stance = 'disagree';
    else if (content.toLowerCase().includes('partial')) stance = 'partial_agree';
    else if (content.toLowerCase().includes('agree')) stance = 'agree';

    return { confidence: Math.min(100, Math.max(0, confidence)), stance };
  }

  errorResponse(provider, error) {
    return {
      provider,
      content: `Error: ${error}`,
      confidence: 0,
      stance: 'disagree',
      tokens: { input: 0, output: 0, total: 0, cost: 0 },
      timestamp: new Date()
    };
  }

  formatPreviousResponses() {
    if (!this.session) return '';
    const positions = Array.from(this.session.consensus.positions.entries());
    return positions
      .map(([provider, response]) => {
        const emoji = provider === 'claude' ? '🟣' : provider === 'deepseek' ? '🟢' : '🔵';
        return `${emoji} ${provider.toUpperCase()}:\n${response.content}\n`;
      })
      .join('\n---\n');
  }

  calculateAgreementScore(responses) {
    const stances = responses.map(r => r.stance);
    const agreeCount = stances.filter(s => s === 'agree').length;
    const partialCount = stances.filter(s => s === 'partial_agree').length;
    const score = (agreeCount + partialCount * 0.5) / responses.length;
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    return score * 0.7 + (avgConfidence / 100) * 0.3;
  }

  extractFinalDecision(responses) {
    const agreeing = responses.filter(r => r.stance === 'agree' || r.stance === 'partial_agree');
    if (agreeing.length === 0) return responses[0].content;
    const highest = agreeing.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    return highest.content;
  }

  conductMajorityVote(responses) {
    const sorted = [...responses].sort((a, b) => b.confidence - a.confidence);
    return {
      majority: sorted.slice(0, 2).map(r => r.provider),
      decision: sorted[0].content
    };
  }

  updateTotalTokens(tokens) {
    if (!this.session) return;
    this.session.totalTokens.input += tokens.input;
    this.session.totalTokens.output += tokens.output;
    this.session.totalTokens.total += tokens.total;
    this.session.totalTokens.cost += tokens.cost;
  }

  getSession() {
    return this.session;
  }
}

module.exports = { CouncilOrchestrator };
