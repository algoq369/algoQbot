# AI Council - Multi-AI Consensus System

A collaborative AI system that enables Claude, DeepSeek, and Qwen to deliberate on questions and tasks, working toward consensus through structured debate rounds.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI COUNCIL CHAMBER                       │
├─────────────────────────────────────────────────────────────┤
│   🟣 CLAUDE        🟢 DEEPSEEK       🔵 QWEN               │
│   (Architect)      (Mathematician)   (Strategist)          │
│                                                             │
│        └──────────────┬───────────────┘                    │
│                       ▼                                     │
│            ┌─────────────────────┐                         │
│            │    ORCHESTRATOR     │                         │
│            │  Consensus Engine   │                         │
│            └─────────────────────┘                         │
│                       │                                     │
│        ┌──────────────┼──────────────┐                     │
│        ▼              ▼              ▼                     │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐                 │
│   │   CLI   │   │   Web   │   │   MCP   │                 │
│   │ Console │   │   UI    │   │ Server  │                 │
│   └─────────┘   └─────────┘   └─────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Consensus Loop**: AIs debate until 80% agreement or max rounds
- **Real-time Streaming**: Watch token-by-token responses
- **Token Tracking**: Monitor usage and costs per AI
- **Multiple Interfaces**: CLI, Web UI, and MCP for IDEs
- **Specialized Roles**: Each AI has unique strengths

## Quick Start

### 1. Install Dependencies

```bash
cd ai-council
npm install
```

### 2. Configure API Keys

Add to your `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-your-key
DEEPSEEK_API_KEY=sk-your-deepseek-key
QWEN_API_KEY=sk-your-qwen-key
```

### 3. Run the Council

**CLI Mode** (Terminal interface):
```bash
npm run council
```

**Web Mode** (Browser interface):
```bash
npm run web
# Open http://localhost:3030
```

**MCP Mode** (For Cursor/Claude Code):
```bash
npm run mcp
```

## Usage

### CLI Mode

```
═══════════════════════════════════════════════════════════════
          🏛️  AI COUNCIL - Multi-AI Consensus System
═══════════════════════════════════════════════════════════════

👤 You: Should we add RSI indicator to the trading strategy?

📢 Starting Round 1/3...

🟣 CLAUDE [Round 1]
──────────────────────────────────────────────────────
I recommend RSI with a 14-period lookback...
Confidence: 85% | Stance: propose

🟢 DEEPSEEK [Round 1]
──────────────────────────────────────────────────────
I AGREE with Claude. Mathematical analysis shows...
Confidence: 90% | Stance: agree

🔵 QWEN [Round 1]
──────────────────────────────────────────────────────
I PARTIALLY AGREE. Consider Stochastic RSI instead...
Confidence: 78% | Stance: partial_agree

📊 Round 1 Complete | Agreement: 72%

📢 Starting Round 2/3...
...

✅ CONSENSUS REACHED!
   Agreement Score: 85%
   Rounds: 2
```

### MCP Integration

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "ai-council": {
      "command": "node",
      "args": ["./ai-council/dist/mcp/server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "...",
        "DEEPSEEK_API_KEY": "...",
        "QWEN_API_KEY": "..."
      }
    }
  }
}
```

For Cursor, add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ai-council": {
      "command": "node",
      "args": ["./ai-council/dist/mcp/server.js"]
    }
  }
}
```

### MCP Tools Available

| Tool | Description |
|------|-------------|
| `council_deliberate` | Start a full council session on a task |
| `council_ask_ai` | Ask a specific AI directly |
| `read_bot_file` | Read algoQbot source files |
| `list_bot_files` | List files in a directory |
| `search_bot_code` | Search codebase with regex |

## AI Roles

| AI | Role | Strengths |
|----|------|-----------|
| **Claude** | Architect | System design, code quality, security |
| **DeepSeek** | Mathematician | Quantitative analysis, algorithms, proofs |
| **Qwen** | Strategist | Market patterns, alternative perspectives |

## Configuration

```typescript
const config = {
  maxRounds: 3,           // Maximum debate rounds
  consensusThreshold: 0.8, // 80% agreement required
  enableReasoning: true,   // Show AI thinking process
  enableStreaming: true,   // Stream tokens in real-time
  mode: 'debate'          // debate | brainstorm | review | pair
};
```

## Cost Estimates

| AI | Input (per 1M) | Output (per 1M) |
|----|----------------|-----------------|
| Claude | $3.00 | $15.00 |
| DeepSeek | $0.14 | $0.28 |
| Qwen | $0.50 | $2.00 |

Typical session (3 rounds): ~$0.05-0.15

## File Structure

```
ai-council/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── types/                # TypeScript types
│   ├── adapters/             # AI API adapters
│   │   ├── claude.ts
│   │   ├── deepseek.ts
│   │   └── qwen.ts
│   ├── orchestrator/         # Consensus engine
│   │   └── engine.ts
│   ├── prompts/              # System prompts
│   │   └── system.ts
│   ├── mcp/                  # MCP server
│   │   └── server.ts
│   └── streaming/            # WebSocket server
│       └── websocket.ts
├── web/                      # Web UI
│   └── index.html
├── package.json
└── tsconfig.json
```

## License

MIT - Part of algoQbot project
