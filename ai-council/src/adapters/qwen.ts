/**
 * AI Council - Qwen Adapter
 * Alibaba Qwen API integration (OpenAI-compatible via DashScope)
 */

import OpenAI from 'openai';
import { AIResponse, StreamEvent } from '../types/index.js';
import { BaseAdapter, StreamCallback } from './base.js';

export class QwenAdapter extends BaseAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    super('qwen', 'qwen-plus', apiKey, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    onStream?: StreamCallback
  ): Promise<AIResponse> {
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      if (onStream) {
        // Streaming mode
        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 4096,
          stream: true
        });

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            fullContent += token;
            onStream({
              type: 'token',
              provider: 'qwen',
              data: { token, cumulative: fullContent },
              timestamp: new Date()
            });
          }
        }

        // Estimate tokens for streaming
        inputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
        outputTokens = Math.ceil(fullContent.length / 4);
      } else {
        // Non-streaming mode
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 4096
        });

        fullContent = response.choices[0]?.message?.content || '';
        inputTokens = response.usage?.prompt_tokens || 0;
        outputTokens = response.usage?.completion_tokens || 0;
      }

      const parsed = this.parseResponse(fullContent);
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        provider: 'qwen',
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
      console.error('Qwen API error:', error);
      throw error;
    }
  }
}
