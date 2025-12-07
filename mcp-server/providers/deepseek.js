/**
 * DeepSeek AI Provider
 * Cost: $0.14/1M input, $0.28/1M output tokens
 * Best for: Deep analysis, reasoning, research
 */

export class DeepSeekProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.deepseek.com/v1";
    this.model = "deepseek-chat";
    
    // Cost per 1M tokens
    this.pricing = {
      input: 0.14,
      output: 0.28
    };
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async complete(prompt, options = {}) {
    if (!this.apiKey) {
      return {
        content: "[DeepSeek not configured - set DEEPSEEK_API_KEY]",
        usage: { input: 0, output: 0, cost: 0 }
      };
    }

    try {
      const response = await fetch(this.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + this.apiKey
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: [
            {
              role: "system",
              content: options.systemPrompt || "You are a helpful AI assistant for trading analysis, blockchain development, and smart city projects."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const usage = data.usage || {};
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const cost = (inputTokens * this.pricing.input / 1000000) + 
                   (outputTokens * this.pricing.output / 1000000);

      return {
        content: data.choices[0]?.message?.content || "",
        usage: {
          input: inputTokens,
          output: outputTokens,
          cost: cost
        }
      };
    } catch (error) {
      return {
        content: "DeepSeek Error: " + error.message,
        usage: { input: 0, output: 0, cost: 0 }
      };
    }
  }

  async analyzeTrading(context) {
    const prompt = "Analyze the following trading context and provide recommendations:\n\n" +
      JSON.stringify(context, null, 2) +
      "\n\nProvide:\n1. Market assessment (bullish/bearish/neutral)\n2. Risk level (1-10)\n3. Recommended action (BUY/SELL/HOLD)\n4. Confidence score (0-100%)\n5. Key reasoning points";

    return await this.complete(prompt, {
      systemPrompt: "You are an expert cryptocurrency trading analyst specializing in BNB/USDT on BSC."
    });
  }
}
