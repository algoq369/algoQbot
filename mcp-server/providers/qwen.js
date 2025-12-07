/**
 * Qwen AI Provider (via DashScope/Alibaba Cloud)
 * Cost: ~$0.10/1M input, ~$0.20/1M output tokens
 * Best for: Fast decisions, real-time processing
 */

export class QwenProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
    this.model = "qwen-turbo";
    
    // Cost per 1M tokens (approximate)
    this.pricing = {
      input: 0.10,
      output: 0.20
    };
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async complete(prompt, options = {}) {
    if (!this.apiKey) {
      return {
        content: "[Qwen not configured - set QWEN_API_KEY]",
        usage: { input: 0, output: 0, cost: 0 }
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + this.apiKey
        },
        body: JSON.stringify({
          model: options.model || this.model,
          input: {
            messages: [
              {
                role: "system",
                content: options.systemPrompt || "You are a helpful AI assistant."
              },
              {
                role: "user",
                content: prompt
              }
            ]
          },
          parameters: {
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1500
          }
        })
      });

      const data = await response.json();

      if (data.code && data.code !== "200") {
        throw new Error(data.message || "Qwen API error");
      }

      const usage = data.usage || {};
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cost = (inputTokens * this.pricing.input / 1000000) + 
                   (outputTokens * this.pricing.output / 1000000);

      return {
        content: data.output?.text || data.output?.choices?.[0]?.message?.content || "",
        usage: {
          input: inputTokens,
          output: outputTokens,
          cost: cost
        }
      };
    } catch (error) {
      return {
        content: "Qwen Error: " + error.message,
        usage: { input: 0, output: 0, cost: 0 }
      };
    }
  }

  async quickDecision(context) {
    const prompt = "Quick trading decision needed:\n" +
      JSON.stringify(context, null, 2) +
      "\n\nRespond with: ACTION (BUY/SELL/HOLD), CONFIDENCE (0-100), REASON (one line)";

    return await this.complete(prompt, {
      systemPrompt: "You are a fast-response trading assistant. Be concise.",
      maxTokens: 200
    });
  }
}
