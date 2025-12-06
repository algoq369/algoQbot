/**
 * AI Council - Claude Adapter
 * Anthropic Claude API integration
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIResponse, StreamEvent } from '../types/index.js';
import { BaseAdapter, StreamCallback } from './base.js';

export class ClaudeAdapter extends BaseAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    super('claude', 'claude-sonnet-4-20250514', apiKey);
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    onStream?: StreamCallback
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      if (onStream) {
        // Streaming mode
        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const token = event.delta.text;
            fullContent += token;
            onStream({
              type: 'token',
              provider: 'claude',
              data: { token, cumulative: fullContent },
              timestamp: new Date()
            });
          }
        }

        const finalMessage = await stream.finalMessage();
        inputTokens = finalMessage.usage.input_tokens;
        outputTokens = finalMessage.usage.output_tokens;
      } else {
        // Non-streaming mode
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        });

        fullContent = response.content[0].type === 'text'
          ? response.content[0].text
          : '';
        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;
      }

      const parsed = this.parseResponse(fullContent);
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        provider: 'claude',
        content: parsed.content,
        reasoning: parsed.reasoning,
        stance: parsed.stance,
        confidence: parsed.confidence,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
          cost
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }
}
