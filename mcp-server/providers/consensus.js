/**
 * AI Consensus Engine
 * Combines responses from multiple AI providers for better decisions
 */

export class ConsensusEngine {
  constructor(deepseek, qwen) {
    this.deepseek = deepseek;
    this.qwen = qwen;
    this.consensusThreshold = 0.7; // 70% agreement needed
  }

  async getConsensus(toolName, args) {
    const context = JSON.stringify(args, null, 2);
    const prompt = this.buildConsensusPrompt(toolName, context);

    // Query both providers in parallel
    const [deepseekResult, qwenResult] = await Promise.all([
      this.deepseek.complete(prompt, {
        systemPrompt: "You are a trading analyst. Respond in JSON format with: action (BUY/SELL/HOLD), confidence (0-100), reasoning (string)"
      }),
      this.qwen.complete(prompt, {
        systemPrompt: "You are a trading analyst. Respond in JSON format with: action (BUY/SELL/HOLD), confidence (0-100), reasoning (string)"
      })
    ]);

    // Parse responses
    const deepseekVote = this.parseVote(deepseekResult.content, "deepseek");
    const qwenVote = this.parseVote(qwenResult.content, "qwen");

    // Calculate consensus
    const consensus = this.calculateConsensus([deepseekVote, qwenVote]);

    return {
      consensus: consensus.action,
      confidence: consensus.confidence,
      agreement: consensus.agreement,
      votes: {
        deepseek: deepseekVote,
        qwen: qwenVote
      },
      reasoning: consensus.reasoning,
      tokenUsage: {
        deepseek: deepseekResult.usage,
        qwen: qwenResult.usage,
        totalCost: (deepseekResult.usage?.cost || 0) + (qwenResult.usage?.cost || 0)
      }
    };
  }

  buildConsensusPrompt(toolName, context) {
    return "You are participating in an AI council decision for trading.\n\n" +
           "Tool: " + toolName + "\n" +
           "Context:\n" + context + "\n\n" +
           "Analyze and provide your vote in JSON format:\n" +
           "{\n" +
           '  "action": "BUY" or "SELL" or "HOLD",\n' +
           '  "confidence": 0-100,\n' +
           '  "reasoning": "your reasoning"\n' +
           "}";
  }

  parseVote(content, provider) {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          provider,
          action: (parsed.action || "HOLD").toUpperCase(),
          confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
          reasoning: parsed.reasoning || "No reasoning provided"
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    // Default vote if parsing fails
    return {
      provider,
      action: "HOLD",
      confidence: 50,
      reasoning: content.substring(0, 200)
    };
  }

  calculateConsensus(votes) {
    const actionCounts = { BUY: 0, SELL: 0, HOLD: 0 };
    let totalConfidence = 0;
    const reasonings = [];

    for (const vote of votes) {
      actionCounts[vote.action] = (actionCounts[vote.action] || 0) + 1;
      totalConfidence += vote.confidence;
      reasonings.push(vote.provider + ": " + vote.reasoning);
    }

    // Find majority action
    let majorityAction = "HOLD";
    let maxCount = 0;
    for (const [action, count] of Object.entries(actionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        majorityAction = action;
      }
    }

    // Calculate agreement percentage
    const agreement = maxCount / votes.length;
    const avgConfidence = totalConfidence / votes.length;

    // Adjust confidence based on agreement
    const finalConfidence = avgConfidence * agreement;

    return {
      action: majorityAction,
      confidence: Math.round(finalConfidence),
      agreement: Math.round(agreement * 100),
      reasoning: reasonings.join("\n\n")
    };
  }
}
