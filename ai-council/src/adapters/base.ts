/**
 * AI Council - Base Adapter
 * Common interface for all AI providers
 */

import { AIProvider, AIResponse, TokenUsage, StreamEvent } from '../types/index.js';

export interface StreamCallback {
  (event: StreamEvent): void;
}

export abstract class BaseAdapter {
  protected provider: AIProvider;
  protected model: string;
  protected apiKey: string;
  protected baseUrl?: string;

  constructor(provider: AIProvider, model: string, apiKey: string, baseUrl?: string) {
    this.provider = provider;
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  abstract chat(
    systemPrompt: string,
    userMessage: string,
    onStream?: StreamCallback
  ): Promise<AIResponse>;

  protected calculateCost(inputTokens: number, outputTokens: number): number {
    // Cost per 1M tokens
    const costs: Record<AIProvider, { input: number; output: number }> = {
      claude: { input: 3.0, output: 15.0 },
      deepseek: { input: 0.14, output: 0.28 },
      qwen: { input: 0.5, output: 2.0 }
    };

    const providerCost = costs[this.provider];
    return (
      (inputTokens / 1_000_000) * providerCost.input +
      (outputTokens / 1_000_000) * providerCost.output
    );
  }

  protected parseResponse(content: string): {
    content: string;
    reasoning?: string;
    confidence: number;
    stance?: 'agree' | 'disagree' | 'partial_agree' | 'abstain';
  } {
    let reasoning: string | undefined;
    let cleanContent = content;

    // Extract <think> blocks (DeepSeek style)
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      reasoning = thinkMatch[1].trim();
      cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    }

    // Extract confidence
    const confidenceMatch = cleanContent.match(/\*?\*?Confidence:?\*?\*?\s*(\d+)%/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    // Extract stance
    let stance: 'agree' | 'disagree' | 'partial_agree' | 'abstain' | undefined;
    if (/I\s+(FULLY\s+)?AGREE/i.test(cleanContent)) {
      stance = 'agree';
    } else if (/I\s+DISAGREE/i.test(cleanContent)) {
      stance = 'disagree';
    } else if (/I\s+PARTIAL(LY)?\s+AGREE/i.test(cleanContent)) {
      stance = 'partial_agree';
    }

    return { content: cleanContent, reasoning, confidence, stance };
  }
}
