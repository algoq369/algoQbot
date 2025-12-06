#!/usr/bin/env node
/**
 * AlgoQBot MCP Server
 * Provides bot status, trading data, and AI Council access to Cursor/IDE
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
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const BOT_PATH = process.env.BOT_PATH || process.cwd();

// Create MCP server
const server = new Server(
  { name: 'algoqbot-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_bot_status',
        description: 'Get current AlgoQBot status including running state, mode, and stats',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_trades',
        description: 'Get recent trades and P&L data',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of trades to return', default: 10 }
          }
        }
      },
      {
        name: 'read_file',
        description: 'Read a file from the AlgoQBot codebase',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the file' }
          },
          required: ['path']
        }
      },
      {
        name: 'list_files',
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to directory', default: '' }
          }
        }
      },
      {
        name: 'search_code',
        description: 'Search for a pattern in the codebase',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern (regex)' },
            fileType: { type: 'string', description: 'File extension filter (e.g., "js")', default: 'js' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'council_query',
        description: 'Ask the AI Council (Claude, DeepSeek, Qwen) a question. They will deliberate and return a consensus answer.',
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Question for the AI Council' }
          },
          required: ['question']
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
      case 'get_bot_status': {
        // Try to read status from data files
        const statusFile = join(BOT_PATH, 'data', 'bot_status.json');
        const shadowFile = join(BOT_PATH, 'data', 'shadow_trades.json');

        let status: any = { mode: 'unknown', running: false };

        if (existsSync(statusFile)) {
          status = JSON.parse(readFileSync(statusFile, 'utf-8'));
        }

        if (existsSync(shadowFile)) {
          const shadowData = JSON.parse(readFileSync(shadowFile, 'utf-8'));
          status.shadowTrades = shadowData.length || 0;
        }

        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      case 'get_trades': {
        const limit = (args?.limit as number) || 10;
        const tradesFile = join(BOT_PATH, 'data', 'shadow_trades.json');

        if (!existsSync(tradesFile)) {
          return { content: [{ type: 'text', text: 'No trades file found' }] };
        }

        const trades = JSON.parse(readFileSync(tradesFile, 'utf-8'));
        const recentTrades = Array.isArray(trades) ? trades.slice(-limit) : [];

        return { content: [{ type: 'text', text: JSON.stringify(recentTrades, null, 2) }] };
      }

      case 'read_file': {
        const filePath = join(BOT_PATH, args?.path as string);
        if (!existsSync(filePath)) {
          return { content: [{ type: 'text', text: `File not found: ${args?.path}` }] };
        }
        const content = readFileSync(filePath, 'utf-8');
        return { content: [{ type: 'text', text: content }] };
      }

      case 'list_files': {
        const dirPath = join(BOT_PATH, (args?.path as string) || '');
        if (!existsSync(dirPath)) {
          return { content: [{ type: 'text', text: `Directory not found: ${args?.path}` }] };
        }
        const files = readdirSync(dirPath).map(f => {
          const fullPath = join(dirPath, f);
          const stat = statSync(fullPath);
          return { name: f, type: stat.isDirectory() ? 'dir' : 'file', size: stat.size };
        });
        return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] };
      }

      case 'search_code': {
        const pattern = new RegExp(args?.pattern as string, 'gi');
        const fileType = (args?.fileType as string) || 'js';
        const results: Array<{ file: string; line: number; content: string }> = [];

        function searchDir(dir: string): void {
          if (!existsSync(dir)) return;
          const files = readdirSync(dir);
          for (const file of files) {
            const fullPath = join(dir, file);
            try {
              const stat = statSync(fullPath);
              if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                searchDir(fullPath);
              } else if (file.endsWith(`.${fileType}`)) {
                const content = readFileSync(fullPath, 'utf-8');
                content.split('\n').forEach((line, idx) => {
                  if (pattern.test(line)) {
                    results.push({ file: relative(BOT_PATH, fullPath), line: idx + 1, content: line.trim() });
                  }
                });
              }
            } catch { /* skip */ }
          }
        }

        searchDir(BOT_PATH);
        return { content: [{ type: 'text', text: JSON.stringify(results.slice(0, 30), null, 2) }] };
      }

      case 'council_query': {
        // This would connect to the AI Council - for now return info
        return {
          content: [{
            type: 'text',
            text: `AI Council query received: "${args?.question}"\n\nTo use AI Council:\n1. Start the server: cd ai-council && npm run web\n2. Open http://localhost:9000\n3. Ask your question there for multi-AI consensus`
          }]
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error}` }], isError: true };
  }
});

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      { uri: 'bot://status', name: 'Bot Status', description: 'Current AlgoQBot status', mimeType: 'application/json' },
      { uri: 'bot://config', name: 'Bot Config', description: 'Bot configuration', mimeType: 'application/json' },
      { uri: 'bot://trades', name: 'Recent Trades', description: 'Recent trading activity', mimeType: 'application/json' }
    ]
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'bot://status':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            name: 'AlgoQBot',
            mode: process.env.SHADOW_MODE_ENABLED === 'true' ? 'shadow' : 'live',
            strategy: process.env.DEFAULT_STRATEGY || 'multi-strategy'
          }, null, 2)
        }]
      };

    case 'bot://config':
      const configPath = join(BOT_PATH, 'config.js');
      if (existsSync(configPath)) {
        return { contents: [{ uri, mimeType: 'application/json', text: readFileSync(configPath, 'utf-8') }] };
      }
      return { contents: [{ uri, mimeType: 'application/json', text: '{}' }] };

    case 'bot://trades':
      const tradesPath = join(BOT_PATH, 'data', 'shadow_trades.json');
      if (existsSync(tradesPath)) {
        const trades = JSON.parse(readFileSync(tradesPath, 'utf-8'));
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(trades.slice(-10), null, 2) }] };
      }
      return { contents: [{ uri, mimeType: 'application/json', text: '[]' }] };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AlgoQBot MCP Server running on stdio');
}

main().catch(console.error);
