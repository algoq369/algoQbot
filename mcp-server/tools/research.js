/**
 * Research Tools
 * General AI-powered research and analysis capabilities
 */

export const researchTools = {
  // Deep research on a topic
  research_topic: {
    description: "Conduct deep research on any topic using AI",
    parameters: {
      topic: { type: "string", description: "Topic to research" },
      depth: { type: "string", description: "Depth: quick, standard, comprehensive" },
      focus: { type: "string", description: "Focus area: technical, market, trends, all" }
    },
    required: ["topic"],
    handler: async (args, server) => {
      const prompt = "Research the following topic thoroughly:\n\n" +
        "Topic: " + args.topic + "\n" +
        "Depth: " + (args.depth || "standard") + "\n" +
        "Focus: " + (args.focus || "all") + "\n\n" +
        "Provide:\n" +
        "1. Overview\n" +
        "2. Key findings\n" +
        "3. Technical details (if applicable)\n" +
        "4. Market implications\n" +
        "5. Future trends\n" +
        "6. Recommendations";

      if (server?.deepseek) {
        const result = await server.deepseek.complete(prompt, {
          maxTokens: args.depth === "comprehensive" ? 3000 : 1500
        });
        return {
          topic: args.topic,
          depth: args.depth || "standard",
          research: result.content,
          tokenUsage: result.usage
        };
      }

      return {
        topic: args.topic,
        status: "requires_ai",
        note: "Deep research requires AI provider configuration (DEEPSEEK_API_KEY)"
      };
    }
  },

  // Code analysis
  research_analyze_code: {
    description: "Analyze code for improvements, bugs, or optimization",
    parameters: {
      code: { type: "string", description: "Code to analyze" },
      language: { type: "string", description: "Programming language" },
      focus: { type: "string", description: "Focus: security, performance, quality, all" }
    },
    required: ["code"],
    handler: async (args, server) => {
      const prompt = "Analyze this " + (args.language || "code") + ":\n\n" +
        args.code + "\n\n" +
        "Focus: " + (args.focus || "all") + "\n" +
        "Provide: issues, improvements, best practices, refactored version if needed";

      if (server?.deepseek) {
        const result = await server.deepseek.complete(prompt, {
          systemPrompt: "You are a senior software engineer and code reviewer."
        });
        return {
          language: args.language,
          focus: args.focus || "all",
          analysis: result.content,
          tokenUsage: result.usage
        };
      }

      return { status: "requires_ai" };
    }
  },

  // Quick question
  research_quick_answer: {
    description: "Get a quick answer to any question",
    parameters: {
      question: { type: "string", description: "Question to answer" }
    },
    required: ["question"],
    handler: async (args, server) => {
      if (server?.qwen) {
        const result = await server.qwen.complete(args.question, {
          maxTokens: 500
        });
        return {
          question: args.question,
          answer: result.content,
          provider: "qwen",
          tokenUsage: result.usage
        };
      }

      if (server?.deepseek) {
        const result = await server.deepseek.complete(args.question, {
          maxTokens: 500
        });
        return {
          question: args.question,
          answer: result.content,
          provider: "deepseek",
          tokenUsage: result.usage
        };
      }

      return { status: "requires_ai" };
    }
  },

  // Compare options
  research_compare: {
    description: "Compare multiple options or technologies",
    parameters: {
      options: { type: "string", description: "Comma-separated list of options to compare" },
      criteria: { type: "string", description: "Comparison criteria (optional)" }
    },
    required: ["options"],
    handler: async (args, server) => {
      const prompt = "Compare the following options:\n" +
        args.options + "\n\n" +
        (args.criteria ? "Criteria: " + args.criteria + "\n\n" : "") +
        "Provide a detailed comparison with pros, cons, and recommendation.";

      if (server?.deepseek) {
        const result = await server.deepseek.complete(prompt);
        return {
          options: args.options.split(",").map(s => s.trim()),
          criteria: args.criteria,
          comparison: result.content,
          tokenUsage: result.usage
        };
      }

      return { status: "requires_ai" };
    }
  },

  // Summarize text
  research_summarize: {
    description: "Summarize long text or documents",
    parameters: {
      text: { type: "string", description: "Text to summarize" },
      length: { type: "string", description: "Summary length: brief, standard, detailed" }
    },
    required: ["text"],
    handler: async (args, server) => {
      const lengthInstructions = {
        brief: "Summarize in 2-3 sentences",
        standard: "Summarize in a short paragraph",
        detailed: "Provide a detailed summary with key points"
      };

      const prompt = (lengthInstructions[args.length] || lengthInstructions.standard) +
        ":\n\n" + args.text;

      if (server?.qwen) {
        const result = await server.qwen.complete(prompt, {
          maxTokens: args.length === "detailed" ? 500 : 200
        });
        return {
          summary: result.content,
          length: args.length || "standard",
          originalLength: args.text.length,
          tokenUsage: result.usage
        };
      }

      return { status: "requires_ai" };
    }
  },

  // Get token usage stats
  research_token_usage: {
    description: "Get current session token usage and costs",
    parameters: {},
    required: [],
    handler: async (args, server) => {
      return {
        deepseek: server?.tokenUsage?.deepseek || { input: 0, output: 0, cost: 0 },
        qwen: server?.tokenUsage?.qwen || { input: 0, output: 0, cost: 0 },
        totalCost: server?.tokenUsage?.total || 0,
        pricing: {
          deepseek: { input: "$0.14/1M", output: "$0.28/1M" },
          qwen: { input: "$0.10/1M", output: "$0.20/1M" }
        }
      };
    }
  }
};
