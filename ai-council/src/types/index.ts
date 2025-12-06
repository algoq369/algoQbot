/**
 * AI Council - Type Definitions
 * Multi-AI Consensus System
 */

export type AIProvider = 'claude' | 'deepseek' | 'qwen';

export type AIRole = 'architect' | 'mathematician' | 'strategist';

export type MessageType = 'user' | 'ai' | 'system' | 'consensus';

export type TaskStatus = 'pending' | 'in_progress' | 'debating' | 'consensus_reached' | 'completed' | 'failed';

export type Stance = 'agree' | 'disagree' | 'partial_agree' | 'abstain';

export interface AIConfig {
  provider: AIProvider;
  role: AIRole;
  model: string;
  apiKey: string;
  baseUrl?: string;
  color: string;
  emoji: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cost: number;
}

export interface AIResponse {
  provider: AIProvider;
  content: string;
  reasoning?: string;
  stance?: Stance;
  confidence: number;
  agreesWithd?: AIProvider[];
  disagreesWithd?: AIProvider[];
  tokens: TokenUsage;
  timestamp: Date;
}

export interface Message {
  id: string;
  type: MessageType;
  provider?: AIProvider;
  content: string;
  reasoning?: string;
  tokens?: TokenUsage;
  stance?: Stance;
  confidence?: number;
  timestamp: Date;
  round?: number;
}

export interface ConsensusState {
  round: number;
  maxRounds: number;
  positions: Map<AIProvider, AIResponse>;
  agreementScore: number;
  consensusReached: boolean;
  finalDecision?: string;
  votingResult?: {
    majority: AIProvider[];
    decision: string;
  };
}

export interface CouncilSession {
  id: string;
  task: string;
  status: TaskStatus;
  messages: Message[];
  consensus: ConsensusState;
  totalTokens: TokenUsage;
  startTime: Date;
  endTime?: Date;
}

export interface StreamEvent {
  type: 'token' | 'message' | 'consensus' | 'status' | 'error';
  provider?: AIProvider;
  data: any;
  timestamp: Date;
}

export interface CouncilConfig {
  maxRounds: number;
  consensusThreshold: number;  // 0.0 - 1.0
  enableReasoning: boolean;
  enableStreaming: boolean;
  mode: 'debate' | 'brainstorm' | 'review' | 'pair';
}

export const DEFAULT_COUNCIL_CONFIG: CouncilConfig = {
  maxRounds: 5,
  consensusThreshold: 0.8,
  enableReasoning: true,
  enableStreaming: true,
  mode: 'debate'
};

export const AI_CONFIGS: Record<AIProvider, Omit<AIConfig, 'apiKey'>> = {
  claude: {
    provider: 'claude',
    role: 'architect',
    model: 'claude-sonnet-4-20250514',
    color: '#9B59B6',
    emoji: '🟣'
  },
  deepseek: {
    provider: 'deepseek',
    role: 'mathematician',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    color: '#2ECC71',
    emoji: '🟢'
  },
  qwen: {
    provider: 'qwen',
    role: 'strategist',
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    color: '#3498DB',
    emoji: '🔵'
  }
};

// Cost per 1M tokens (approximate)
export const TOKEN_COSTS: Record<AIProvider, { input: number; output: number }> = {
  claude: { input: 3.0, output: 15.0 },
  deepseek: { input: 0.14, output: 0.28 },
  qwen: { input: 0.5, output: 2.0 }
};
