# MCP Multi-AI Server Design
## For AlgoQBot + Blockchain + Smart City Projects

---

## Overview

A unified MCP (Model Context Protocol) server that provides:
- **DeepSeek** - Cost-effective reasoning ($0.14/1M tokens vs Claude's $3)
- **Qwen** - Fast inference, good for real-time decisions
- **Claude** - Complex analysis, code generation (via Cursor)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURSOR / CLAUDE CODE                      │
│                    (Your Development Environment)                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ MCP Protocol
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP MULTI-AI SERVER                          │
│                        Port 3100                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  DeepSeek   │  │    Qwen     │  │   Claude    │              │
│  │  Reasoner   │  │   Fast AI   │  │  (Passthru) │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    TOOL REGISTRY                           │  │
│  │  Trading │ Blockchain │ Smart City │ Research │ Analysis  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   AlgoQBot    │       │  Blockchain   │       │  Smart City   │
│  Trading Bot  │       │    Projects   │       │   Projects    │
│   Port 3001   │       │               │       │               │
└───────────────┘       └───────────────┘       └───────────────┘
```

---

## Project-Specific Tools

### 1. AlgoQBot Trading Tools

```javascript
const tradingTools = {
  // Market Analysis
  "trading_analyze_market": {
    description: "Analyze BNB/USDT market conditions",
    parameters: { timeframe: "1h|4h|1d", depth: "quick|full" },
    handler: async (params) => {
      // Calls AlgoQBot API or reads data files
    }
  },

  // Portfolio Management
  "trading_get_portfolio": {
    description: "Get current portfolio allocation",
    parameters: {},
    handler: async () => {
      // Returns USDT, BNB balances, P&L
    }
  },

  // AI Consensus Decision
  "trading_ai_council": {
    description: "Get AI council consensus on trade decision",
    parameters: { action: "BUY|SELL|HOLD", context: "string" },
    handler: async (params) => {
      // Queries DeepSeek + Qwen for consensus
    }
  },

  // Risk Assessment
  "trading_assess_risk": {
    description: "Assess current portfolio risk",
    parameters: {},
    handler: async () => {
      // Returns volatility, exposure, drawdown
    }
  },

  // Execute Strategy
  "trading_execute_strategy": {
    description: "Execute trading strategy",
    parameters: { strategy: "ranging|momentum|grid" },
    handler: async (params) => {
      // Triggers AlgoQBot strategy
    }
  }
};
```

### 2. Blockchain / Proof of Wellness Tools

```javascript
const blockchainTools = {
  // Smart Contract Interaction
  "blockchain_deploy_contract": {
    description: "Deploy smart contract to testnet/mainnet",
    parameters: {
      network: "bsc|ethereum|polygon",
      contract: "string",
      constructor_args: "array"
    }
  },

  // Wellness Token
  "wellness_mint_token": {
    description: "Mint wellness tokens based on health data",
    parameters: {
      user_id: "string",
      wellness_score: "number",
      activity_type: "steps|sleep|meditation|exercise"
    }
  },

  // Proof of Wellness Verification
  "wellness_verify_proof": {
    description: "Verify wellness proof on-chain",
    parameters: {
      proof_hash: "string",
      user_address: "string"
    }
  },

  // Token Economics
  "wellness_calculate_rewards": {
    description: "Calculate wellness rewards",
    parameters: {
      activities: "array",
      streak_days: "number"
    }
  }
};
```

### 3. Smart City Tools

```javascript
const smartCityTools = {
  // Urban Analytics
  "city_analyze_traffic": {
    description: "Analyze city traffic patterns",
    parameters: {
      zone: "string",
      timeframe: "realtime|hourly|daily"
    }
  },

  // Resource Optimization
  "city_optimize_resources": {
    description: "Optimize city resource allocation",
    parameters: {
      resource_type: "energy|water|waste|transport",
      optimization_goal: "cost|efficiency|sustainability"
    }
  },

  // IoT Data Processing
  "city_process_iot_data": {
    description: "Process IoT sensor data",
    parameters: {
      sensor_type: "traffic|air_quality|noise|energy",
      aggregation: "raw|hourly|daily"
    }
  },

  // Citizen Services
  "city_citizen_request": {
    description: "Process citizen service request",
    parameters: {
      request_type: "maintenance|report|inquiry",
      priority: "low|medium|high|urgent"
    }
  }
};
```

---

## MCP Server Implementation

### File Structure

```
/home/user/algoQbot/mcp-server/
├── package.json
├── index.js                 # Main MCP server
├── config/
│   └── providers.json       # API keys config
├── providers/
│   ├── deepseek.js         # DeepSeek API client
│   ├── qwen.js             # Qwen API client
│   └── consensus.js        # Multi-AI consensus logic
├── tools/
│   ├── trading.js          # AlgoQBot tools
│   ├── blockchain.js       # Blockchain tools
│   ├── smartcity.js        # Smart City tools
│   └── research.js         # General research tools
└── utils/
    ├── cache.js            # Response caching
    └── cost-tracker.js     # Token usage tracking
```

### Main Server Code

```javascript
// index.js - MCP Multi-AI Server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Providers
import { DeepSeekProvider } from "./providers/deepseek.js";
import { QwenProvider } from "./providers/qwen.js";
import { ConsensusEngine } from "./providers/consensus.js";

// Tools
import { tradingTools } from "./tools/trading.js";
import { blockchainTools } from "./tools/blockchain.js";
import { smartCityTools } from "./tools/smartcity.js";
import { researchTools } from "./tools/research.js";

class MCPMultiAIServer {
  constructor() {
    this.server = new Server({
      name: "algoqbot-mcp",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    // Initialize providers
    this.deepseek = new DeepSeekProvider(process.env.DEEPSEEK_API_KEY);
    this.qwen = new QwenProvider(process.env.QWEN_API_KEY);
    this.consensus = new ConsensusEngine([this.deepseek, this.qwen]);

    // Merge all tools
    this.tools = {
      ...tradingTools,
      ...blockchainTools,
      ...smartCityTools,
      ...researchTools
    };

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler("tools/list", async () => ({
      tools: Object.entries(this.tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: {
          type: "object",
          properties: tool.parameters
        }
      }))
    }));

    // Execute tool
    this.server.setRequestHandler("tools/call", async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools[name];

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Execute with appropriate AI provider
      const result = await this.executeWithAI(name, tool, args);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    });
  }

  async executeWithAI(toolName, tool, args) {
    // Route to appropriate AI based on tool type
    if (toolName.startsWith("trading_ai_council")) {
      // Use consensus for trading decisions
      return await this.consensus.getConsensus(tool, args);
    } else if (toolName.includes("analyze") || toolName.includes("research")) {
      // Use DeepSeek for analysis (cost-effective)
      return await this.deepseek.execute(tool, args);
    } else {
      // Use Qwen for fast operations
      return await this.qwen.execute(tool, args);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP Multi-AI Server running...");
  }
}

const server = new MCPMultiAIServer();
server.run().catch(console.error);
```

---

## AI Provider Costs Comparison

| Provider | Input Cost | Output Cost | Best For |
|----------|------------|-------------|----------|
| **DeepSeek** | $0.14/1M | $0.28/1M | Analysis, Research, Reasoning |
| **Qwen** | $0.10/1M | $0.20/1M | Fast decisions, Real-time |
| **Claude** | $3.00/1M | $15.00/1M | Complex code, Final review |

### Cost Optimization Strategy

```javascript
// Route requests by complexity and cost
function routeToProvider(task) {
  const taskType = analyzeTask(task);

  switch (taskType) {
    case "quick_decision":
      return "qwen";        // Fastest, cheapest
    case "deep_analysis":
      return "deepseek";    // Best reasoning/cost ratio
    case "code_generation":
      return "claude";      // Best code quality
    case "consensus":
      return ["deepseek", "qwen"];  // Multi-AI vote
  }
}
```

---

## Cursor Integration

### ~/.cursor/mcp.json

```json
{
  "mcpServers": {
    "algoqbot-multi-ai": {
      "command": "node",
      "args": ["/home/user/algoQbot/mcp-server/index.js"],
      "env": {
        "DEEPSEEK_API_KEY": "your-deepseek-key",
        "QWEN_API_KEY": "your-qwen-key",
        "ALGOQBOT_API": "http://localhost:3001",
        "BLOCKCHAIN_RPC": "https://bsc-dataseed.binance.org"
      }
    }
  }
}
```

---

## Example Usage in Cursor

```
User: Analyze the current market and decide if we should buy BNB

Cursor calls: trading_analyze_market { timeframe: "4h", depth: "full" }
  → DeepSeek analyzes volatility, order flow, trends

Cursor calls: trading_ai_council { action: "BUY", context: "4h analysis" }
  → DeepSeek + Qwen vote on decision
  → Returns: { consensus: "HOLD", confidence: 0.72, reason: "Low volatility" }

Cursor calls: trading_get_portfolio
  → Returns: { usdt: 36000, bnb: 22, total: 55492 }

Response: "Market analysis shows VERY_LOW volatility (0.11%).
          AI Council recommends HOLD with 72% confidence.
          Current portfolio: $55,492 (35% BNB exposure)"
```

---

## Next Steps to Implement

1. **Create the MCP server package**
   ```bash
   cd /home/user/algoQbot/mcp-server
   npm init -y
   npm install @modelcontextprotocol/sdk
   ```

2. **Get API keys**
   - DeepSeek: https://platform.deepseek.com
   - Qwen: https://dashscope.aliyun.com

3. **Implement providers**
   - deepseek.js - DeepSeek API client
   - qwen.js - Qwen/DashScope client
   - consensus.js - Multi-AI voting

4. **Implement tools**
   - Connect to AlgoQBot data files
   - Add blockchain interaction
   - Add smart city stubs

5. **Test with Cursor**
   - Configure mcp.json
   - Test tool execution
   - Verify cost tracking
