#!/usr/bin/env node
/**
 * AI Council - MCP Server
 * Model Context Protocol server for Cursor and IDE integration
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { CouncilOrchestrator } from '../orchestrator/engine.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Load API keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const QWEN_API_KEY = process.env.QWEN_API_KEY || '';
const BOT_PATH = process.env.BOT_PATH || process.cwd();

// Create MCP server
const server = new Server(
  {
    name: 'ai-council',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Council instance (lazy initialization)
let council: CouncilOrchestrator | null = null;

function getCouncil(): CouncilOrchestrator {
  if (!council) {
    council = new CouncilOrchestrator(
      ANTHROPIC_API_KEY,
      DEEPSEEK_API_KEY,
      QWEN_API_KEY,
      { maxRounds: 3, consensusThreshold: 0.8, enableStreaming: false }
    );
  }
  return council;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'council_deliberate',
        description: 'Start an AI Council session where Claude, DeepSeek, and Qwen collaborate to solve a problem or answer a question. Returns the consensus decision.',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The question or task for the AI Council to deliberate on'
            },
            maxRounds: {
              type: 'number',
              description: 'Maximum debate rounds (default: 3)',
              default: 3
            }
          },
          required: ['task']
        }
      },
      {
        name: 'council_ask_ai',
        description: 'Ask a specific AI (Claude, DeepSeek, or Qwen) a question directly without the full council process',
        inputSchema: {
          type: 'object',
          properties: {
            ai: {
              type: 'string',
              enum: ['claude', 'deepseek', 'qwen'],
              description: 'Which AI to ask'
            },
            question: {
              type: 'string',
              description: 'The question to ask'
            }
          },
          required: ['ai', 'question']
        }
      },
      {
        name: 'read_bot_file',
        description: 'Read a file from the algoQbot codebase',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path to the file (e.g., "src/strategies/ranging.js")'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'list_bot_files',
        description: 'List files in a directory of the algoQbot codebase',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path to the directory (e.g., "src/strategies")',
              default: ''
            }
          }
        }
      },
      {
        name: 'search_bot_code',
        description: 'Search for a pattern in the algoQbot codebase',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Search pattern (regex supported)'
            },
            filePattern: {
              type: 'string',
              description: 'File pattern to search in (e.g., "*.js")',
              default: '*'
            }
          },
          required: ['pattern']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'council_deliberate': {
        const c = getCouncil();
        const session = await c.startSession(args?.task as string);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessionId: session.id,
                status: session.status,
                rounds: session.consensus.round,
                agreementScore: session.consensus.agreementScore,
                consensusReached: session.consensus.consensusReached,
                finalDecision: session.consensus.finalDecision,
                totalTokens: session.totalTokens,
                messages: session.messages.map(m => ({
                  type: m.type,
                  provider: m.provider,
                  content: m.content,
                  confidence: m.confidence,
                  stance: m.stance,
                  round: m.round
                }))
              }, null, 2)
            }
          ]
        };
      }

      case 'council_ask_ai': {
        const c = getCouncil();
        // This would need a direct API call to one AI
        // For now, we run a single-round council
        const session = await c.startSession(
          `[Question for ${args?.ai}]: ${args?.question}`
        );

        const aiMessage = session.messages.find(
          m => m.provider === args?.ai
        );

        return {
          content: [
            {
              type: 'text',
              text: aiMessage?.content || 'No response from AI'
            }
          ]
        };
      }

      case 'read_bot_file': {
        const filePath = join(BOT_PATH, args?.path as string);
        const content = readFileSync(filePath, 'utf-8');
        return {
          content: [{ type: 'text', text: content }]
        };
      }

      case 'list_bot_files': {
        const dirPath = join(BOT_PATH, (args?.path as string) || '');
        const files = readdirSync(dirPath).map(f => {
          const fullPath = join(dirPath, f);
          const stat = statSync(fullPath);
          return {
            name: f,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: stat.size
          };
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(files, null, 2) }]
        };
      }

      case 'search_bot_code': {
        // Simple file search (in production, use grep)
        const pattern = new RegExp(args?.pattern as string, 'gi');
        const results: Array<{ file: string; line: number; content: string }> = [];

        function searchDir(dir: string): void {
          const files = readdirSync(dir);
          for (const file of files) {
            const fullPath = join(dir, file);
            const stat = statSync(fullPath);

            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
              searchDir(fullPath);
            } else if (file.endsWith('.js') || file.endsWith('.ts')) {
              try {
                const content = readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                  if (pattern.test(line)) {
                    results.push({
                      file: relative(BOT_PATH, fullPath),
                      line: idx + 1,
                      content: line.trim()
                    });
                  }
                });
              } catch {
                // Skip unreadable files
              }
            }
          }
        }

        searchDir(BOT_PATH);
        return {
          content: [{ type: 'text', text: JSON.stringify(results.slice(0, 50), null, 2) }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error}` }],
      isError: true
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'bot://status',
        name: 'Bot Status',
        description: 'Current algoQbot status and configuration',
        mimeType: 'application/json'
      },
      {
        uri: 'bot://strategies',
        name: 'Trading Strategies',
        description: 'Available trading strategies and their configurations',
        mimeType: 'application/json'
      },
      {
        uri: 'bot://council/session',
        name: 'Council Session',
        description: 'Current AI Council session state',
        mimeType: 'application/json'
      }
    ]
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'bot://status':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              name: 'algoQbot',
              version: '1.0.0',
              mode: process.env.SHADOW_MODE_ENABLED === 'true' ? 'shadow' : 'live',
              pair: process.env.TRADING_PAIR || 'USDT/BNB',
              strategy: process.env.DEFAULT_STRATEGY || 'ranging'
            }, null, 2)
          }
        ]
      };

    case 'bot://strategies':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              available: ['ranging', 'momentum', 'grid', 'meanReversion', 'breakout', 'vwap'],
              active: process.env.DEFAULT_STRATEGY || 'ranging',
              enabled: {
                ranging: process.env.ENABLE_RANGING !== 'false',
                momentum: process.env.ENABLE_MOMENTUM !== 'false',
                grid: process.env.ENABLE_GRID !== 'false',
                meanReversion: process.env.ENABLE_MEAN_REVERSION !== 'false',
                breakout: process.env.ENABLE_BREAKOUT !== 'false',
                vwap: process.env.ENABLE_VWAP !== 'false'
              }
            }, null, 2)
          }
        ]
      };

    case 'bot://council/session':
      const session = council?.getSession();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: session
              ? JSON.stringify({
                  id: session.id,
                  status: session.status,
                  rounds: session.consensus.round,
                  agreement: session.consensus.agreementScore,
                  tokens: session.totalTokens
                }, null, 2)
              : JSON.stringify({ status: 'no_active_session' })
          }
        ]
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AI Council MCP Server running on stdio');
}

main().catch(console.error);
