#!/usr/bin/env node
/**
 * MCP Multi-AI Server
 * Provides DeepSeek + Qwen AI for AlgoQBot, Blockchain & Smart City projects
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { DeepSeekProvider } from "./providers/deepseek.js";
import { QwenProvider } from "./providers/qwen.js";
import { ConsensusEngine } from "./providers/consensus.js";
import { tradingTools } from "./tools/trading.js";
import { blockchainTools } from "./tools/blockchain.js";
import { smartCityTools } from "./tools/smartcity.js";
import { researchTools } from "./tools/research.js";

class MCPMultiAIServer {
  constructor() {
    this.server = new Server(
      {
        name: "algoqbot-multi-ai",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize AI providers
    this.deepseek = new DeepSeekProvider(process.env.DEEPSEEK_API_KEY);
    this.qwen = new QwenProvider(process.env.QWEN_API_KEY);
    this.consensus = new ConsensusEngine(this.deepseek, this.qwen);

    // Cost tracking
    this.tokenUsage = {
      deepseek: { input: 0, output: 0, cost: 0 },
      qwen: { input: 0, output: 0, cost: 0 },
      total: 0
    };

    // Merge all tools
    this.tools = {
      ...tradingTools,
      ...blockchainTools,
      ...smartCityTools,
      ...researchTools
    };

    // Data paths
    this.dataPath = process.env.ALGOQBOT_DATA || "/home/user/algoQbot/data";

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(this.tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: {
          type: "object",
          properties: tool.parameters || {},
          required: tool.required || []
        }
      }))
    }));

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools[name];

      if (!tool) {
        return {
          content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
          isError: true
        };
      }

      try {
        const result = await this.executeTool(name, tool, args || {});
        return {
          content: [{
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });

    // List resources (data files)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "algoqbot://portfolio",
          name: "Portfolio Data",
          description: "Current portfolio balances and allocation",
          mimeType: "application/json"
        },
        {
          uri: "algoqbot://trades",
          name: "Trade History",
          description: "Shadow and live trade history",
          mimeType: "application/json"
        },
        {
          uri: "algoqbot://bot-state",
          name: "Bot State",
          description: "Current bot status, strategy, volatility",
          mimeType: "application/json"
        },
        {
          uri: "algoqbot://token-usage",
          name: "Token Usage",
          description: "AI token usage and costs",
          mimeType: "application/json"
        }
      ]
    }));

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      let data;

      switch (uri) {
        case "algoqbot://portfolio":
          data = await this.readDataFile("virtual_balances.json");
          break;
        case "algoqbot://trades":
          data = await this.readDataFile("shadow_trades.json");
          break;
        case "algoqbot://bot-state":
          data = await this.readDataFile("bot_state.json");
          break;
        case "algoqbot://token-usage":
          data = this.tokenUsage;
          break;
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }

      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2)
        }]
      };
    });
  }

  async readDataFile(filename) {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(this.dataPath, filename);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  }

  async executeTool(name, tool, args) {
    // Route to appropriate AI provider based on tool type
    if (name.includes("consensus") || name.includes("council")) {
      return await this.consensus.getConsensus(name, args);
    }

    if (name.includes("analyze") || name.includes("research") || name.includes("assess")) {
      // Use DeepSeek for analysis (best reasoning/cost)
      return await this.executeWithProvider("deepseek", name, tool, args);
    }

    if (name.includes("quick") || name.includes("realtime")) {
      // Use Qwen for fast operations
      return await this.executeWithProvider("qwen", name, tool, args);
    }

    // Default: use tool's handler if available, else DeepSeek
    if (tool.handler) {
      return await tool.handler(args, this);
    }

    return await this.executeWithProvider("deepseek", name, tool, args);
  }

  async executeWithProvider(providerName, toolName, tool, args) {
    const provider = providerName === "deepseek" ? this.deepseek : this.qwen;
    
    const prompt = `Execute the following tool:
Tool: ${toolName}
Description: ${tool.description}
Arguments: ${JSON.stringify(args)}

Provide a structured response.`;

    const result = await provider.complete(prompt);
    
    // Track usage
    this.tokenUsage[providerName].input += result.usage?.input || 0;
    this.tokenUsage[providerName].output += result.usage?.output || 0;
    this.tokenUsage[providerName].cost += result.usage?.cost || 0;
    this.tokenUsage.total = this.tokenUsage.deepseek.cost + this.tokenUsage.qwen.cost;

    return result.content;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP Multi-AI Server started");
    console.error(`Data path: ${this.dataPath}`);
    console.error(`DeepSeek: ${this.deepseek.isConfigured() ? "configured" : "not configured"}`);
    console.error(`Qwen: ${this.qwen.isConfigured() ? "configured" : "not configured"}`);
  }
}

const server = new MCPMultiAIServer();
server.run().catch(console.error);
