/**
 * AI Council - Orchestrator Engine
 * Manages the consensus loop between Claude, DeepSeek, and Qwen
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AIProvider,
  AIResponse,
  Message,
  CouncilSession,
  ConsensusState,
  CouncilConfig,
  DEFAULT_COUNCIL_CONFIG,
  TokenUsage,
  StreamEvent
} from '../types/index.js';
import { ClaudeAdapter } from '../adapters/claude.js';
import { DeepSeekAdapter } from '../adapters/deepseek.js';
import { QwenAdapter } from '../adapters/qwen.js';
import { StreamCallback } from '../adapters/base.js';
import { SYSTEM_PROMPTS, DEBATE_ROUND_PROMPT } from '../prompts/system.js';

export type CouncilEventHandler = (event: StreamEvent) => void;

export class CouncilOrchestrator {
  private adapters: Map<AIProvider, ClaudeAdapter | DeepSeekAdapter | QwenAdapter>;
  private config: CouncilConfig;
  private session: CouncilSession | null = null;
  private eventHandlers: CouncilEventHandler[] = [];

  constructor(
    claudeApiKey: string,
    deepseekApiKey: string,
    qwenApiKey: string,
    config: Partial<CouncilConfig> = {}
  ) {
    this.config = { ...DEFAULT_COUNCIL_CONFIG, ...config };
    this.adapters = new Map();
    this.adapters.set('claude', new ClaudeAdapter(claudeApiKey));
    this.adapters.set('deepseek', new DeepSeekAdapter(deepseekApiKey));
    this.adapters.set('qwen', new QwenAdapter(qwenApiKey));
  }

  /**
   * Register an event handler for streaming events
   */
  onEvent(handler: CouncilEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: StreamEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Start a new council session with a task/question
   */
  async startSession(task: string): Promise<CouncilSession> {
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

    // Add user message
    this.addMessage({
      id: uuidv4(),
      type: 'user',
      content: task,
      timestamp: new Date()
    });

    this.emit({
      type: 'status',
      data: { status: 'started', session: this.session.id, task },
      timestamp: new Date()
    });

    // Run the consensus loop
    await this.runConsensusLoop();

    return this.session;
  }

  /**
   * Main consensus loop
   */
  private async runConsensusLoop(): Promise<void> {
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

      // Get responses from all AIs in parallel
      const responses = await this.getParallelResponses();

      // Update positions
      for (const response of responses) {
        this.session.consensus.positions.set(response.provider, response);
        this.updateTotalTokens(response.tokens);

        this.addMessage({
          id: uuidv4(),
          type: 'ai',
          provider: response.provider,
          content: response.content,
          reasoning: response.reasoning,
          tokens: response.tokens,
          stance: response.stance,
          confidence: response.confidence,
          timestamp: response.timestamp,
          round: this.session.consensus.round
        });
      }

      // Check for consensus
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

    // If max rounds reached without consensus
    if (!this.session.consensus.consensusReached) {
      const responses = Array.from(this.session.consensus.positions.values());
      this.session.consensus.votingResult = this.conductMajorityVote(responses);
      this.session.consensus.finalDecision = this.session.consensus.votingResult.decision;
      this.session.status = 'completed';

      this.emit({
        type: 'consensus',
        data: {
          reached: false,
          votingResult: this.session.consensus.votingResult,
          maxRoundsReached: true
        },
        timestamp: new Date()
      });
    }

    this.session.endTime = new Date();
  }

  /**
   * Get responses from all AIs in parallel
   */
  private async getParallelResponses(): Promise<AIResponse[]> {
    if (!this.session) return [];

    const providers: AIProvider[] = ['claude', 'deepseek', 'qwen'];
    const previousResponses = this.formatPreviousResponses();
    const isFirstRound = this.session.consensus.round === 1;

    const userMessage = isFirstRound
      ? this.session.task
      : DEBATE_ROUND_PROMPT(previousResponses);

    const promises = providers.map(async (provider) => {
      const adapter = this.adapters.get(provider);
      if (!adapter) throw new Error(`No adapter for ${provider}`);

      const streamCallback: StreamCallback = (event) => {
        this.emit(event);
      };

      return adapter.chat(
        SYSTEM_PROMPTS[provider],
        userMessage,
        this.config.enableStreaming ? streamCallback : undefined
      );
    });

    return Promise.all(promises);
  }

  /**
   * Format previous responses for debate rounds
   */
  private formatPreviousResponses(): string {
    if (!this.session) return '';

    const aiMessages = this.session.messages.filter(
      (m) => m.type === 'ai' && m.round === this.session!.consensus.round - 1
    );

    return aiMessages
      .map((m) => {
        const emoji = m.provider === 'claude' ? '🟣' : m.provider === 'deepseek' ? '🟢' : '🔵';
        return `${emoji} ${m.provider?.toUpperCase()}:\n${m.content}\n`;
      })
      .join('\n---\n');
  }

  /**
   * Calculate agreement score based on stances
   */
  private calculateAgreementScore(responses: AIResponse[]): number {
    const stances = responses.map((r) => r.stance);
    const agreeCount = stances.filter((s) => s === 'agree').length;
    const partialCount = stances.filter((s) => s === 'partial_agree').length;

    // Weight: agree = 1, partial = 0.5, disagree = 0
    const score = (agreeCount + partialCount * 0.5) / responses.length;

    // Also factor in confidence
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

    return (score * 0.7 + (avgConfidence / 100) * 0.3);
  }

  /**
   * Extract final decision from responses
   */
  private extractFinalDecision(responses: AIResponse[]): string {
    // Get the response with highest confidence that's in agreement
    const agreeing = responses.filter((r) => r.stance === 'agree' || r.stance === 'partial_agree');
    if (agreeing.length === 0) return responses[0].content;

    const highest = agreeing.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    return highest.content;
  }

  /**
   * Conduct majority vote if consensus not reached
   */
  private conductMajorityVote(responses: AIResponse[]): { majority: AIProvider[]; decision: string } {
    // Simple majority based on highest confidence
    const sorted = [...responses].sort((a, b) => b.confidence - a.confidence);
    return {
      majority: sorted.slice(0, 2).map((r) => r.provider),
      decision: sorted[0].content
    };
  }

  /**
   * Add a message to the session
   */
  private addMessage(message: Message): void {
    if (!this.session) return;
    this.session.messages.push(message);

    this.emit({
      type: 'message',
      provider: message.provider,
      data: message,
      timestamp: message.timestamp
    });
  }

  /**
   * Update total token usage
   */
  private updateTotalTokens(tokens: TokenUsage): void {
    if (!this.session) return;
    this.session.totalTokens.input += tokens.input;
    this.session.totalTokens.output += tokens.output;
    this.session.totalTokens.total += tokens.total;
    this.session.totalTokens.cost += tokens.cost;
  }

  /**
   * Get current session
   */
  getSession(): CouncilSession | null {
    return this.session;
  }

  /**
   * Inject a user message into the current session
   */
  async injectUserMessage(message: string): Promise<void> {
    if (!this.session) return;

    this.addMessage({
      id: uuidv4(),
      type: 'user',
      content: message,
      timestamp: new Date()
    });

    // Trigger another round of responses
    this.session.consensus.round++;
    const responses = await this.getParallelResponses();

    for (const response of responses) {
      this.session.consensus.positions.set(response.provider, response);
      this.updateTotalTokens(response.tokens);

      this.addMessage({
        id: uuidv4(),
        type: 'ai',
        provider: response.provider,
        content: response.content,
        reasoning: response.reasoning,
        tokens: response.tokens,
        stance: response.stance,
        confidence: response.confidence,
        timestamp: response.timestamp,
        round: this.session.consensus.round
      });
    }
  }
}
