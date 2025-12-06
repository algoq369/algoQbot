#!/usr/bin/env node
/**
 * AlgoQBot MCP Server with DeepSeek Integration
 * Provides bot status, trading data, and direct AI access to Cursor/IDE
 *
 * Features:
 * - Direct DeepSeek API queries
 * - Direct Qwen API queries
 * - Claude API integration
 * - Full AI Council consensus system
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
import OpenAI from 'openai';

const BOT_PATH = process.env.BOT_PATH || process.cwd();

// Load environment from parent directory if not set
const envPath = join(BOT_PATH, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

// AI API Keys
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize AI clients
const deepseekClient = DEEPSEEK_API_KEY ? new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
}) : null;

const qwenClient = QWEN_API_KEY ? new OpenAI({
  apiKey: QWEN_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
}) : null;

// Helper function to query DeepSeek
async function queryDeepSeek(prompt: string, systemPrompt?: string): Promise<string> {
  if (!deepseekClient) {
    throw new Error('DeepSeek API key not configured. Set DEEPSEEK_API_KEY in .env');
  }

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant specialized in trading, mathematics, and quantitative analysis.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 4096
  });

  return response.choices[0]?.message?.content || 'No response';
}

// Helper function to query Qwen
async function queryQwen(prompt: string, systemPrompt?: string): Promise<string> {
  if (!qwenClient) {
    throw new Error('Qwen API key not configured. Set QWEN_API_KEY in .env');
  }

  const response = await qwenClient.chat.completions.create({
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant specialized in strategic analysis and creative problem-solving.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 4096
  });

  return response.choices[0]?.message?.content || 'No response';
}

// Helper function for AI Council consensus
async function runCouncilConsensus(question: string): Promise<any> {
  const results: any = {
    question,
    responses: {},
    timestamp: new Date().toISOString()
  };

  const systemPrompt = `You are part of an AI Council for trading decisions. Analyze the question and provide:
1. Your analysis/recommendation
2. Confidence level (0-100%)
3. Key reasoning points

Format your response as:
ANALYSIS: [Your detailed analysis]
CONFIDENCE: [0-100]%
REASONING: [Key points]`;

  // Query all available AIs in parallel
  const queries: Promise<void>[] = [];

  if (deepseekClient) {
    queries.push(
      queryDeepSeek(question, systemPrompt + '\nRole: Mathematical/Quantitative Analyst')
        .then(r => { results.responses.deepseek = r; })
        .catch(e => { results.responses.deepseek = `Error: ${e.message}`; })
    );
  }

  if (qwenClient) {
    queries.push(
      queryQwen(question, systemPrompt + '\nRole: Strategic Analyst')
        .then(r => { results.responses.qwen = r; })
        .catch(e => { results.responses.qwen = `Error: ${e.message}`; })
    );
  }

  await Promise.all(queries);

  // Generate summary
  const aiCount = Object.keys(results.responses).length;
  results.summary = `AI Council queried ${aiCount} AI(s). Check individual responses for analysis.`;

  return results;
}

// Create MCP server
const server = new Server(
  { name: 'algoqbot-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ===== AI Tools =====
      {
        name: 'ask_deepseek',
        description: 'Query DeepSeek AI directly. Specialized in mathematical analysis, quantitative reasoning, and technical problem-solving.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Your question or prompt for DeepSeek' },
            system_prompt: { type: 'string', description: 'Optional system prompt to set context' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'ask_qwen',
        description: 'Query Qwen AI directly. Specialized in strategic analysis, creative solutions, and alternative perspectives.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Your question or prompt for Qwen' },
            system_prompt: { type: 'string', description: 'Optional system prompt to set context' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'ai_council',
        description: 'Query the full AI Council (DeepSeek + Qwen) for consensus analysis. All AIs analyze the question in parallel and provide their perspectives.',
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Question for the AI Council to deliberate on' }
          },
          required: ['question']
        }
      },
      {
        name: 'get_trading_advice',
        description: 'Get AI-powered trading advice. The AI Council analyzes market conditions and provides recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            pair: { type: 'string', description: 'Trading pair (e.g., BNB/USDT)', default: 'BNB/USDT' },
            context: { type: 'string', description: 'Additional context (market conditions, recent price action, etc.)' }
          }
        }
      },
      // ===== Bot Tools =====
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
      // ===== Code Tools =====
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
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ===== AI Tools =====
      case 'ask_deepseek': {
        const prompt = args?.prompt as string;
        const systemPrompt = args?.system_prompt as string | undefined;

        if (!deepseekClient) {
          return { content: [{ type: 'text', text: 'DeepSeek API not configured. Set DEEPSEEK_API_KEY in .env' }], isError: true };
        }

        const response = await queryDeepSeek(prompt, systemPrompt);
        return { content: [{ type: 'text', text: `**DeepSeek Response:**\n\n${response}` }] };
      }

      case 'ask_qwen': {
        const prompt = args?.prompt as string;
        const systemPrompt = args?.system_prompt as string | undefined;

        if (!qwenClient) {
          return { content: [{ type: 'text', text: 'Qwen API not configured. Set QWEN_API_KEY in .env' }], isError: true };
        }

        const response = await queryQwen(prompt, systemPrompt);
        return { content: [{ type: 'text', text: `**Qwen Response:**\n\n${response}` }] };
      }

      case 'ai_council': {
        const question = args?.question as string;
        const result = await runCouncilConsensus(question);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_trading_advice': {
        const pair = (args?.pair as string) || 'BNB/USDT';
        const context = (args?.context as string) || '';

        const tradingQuestion = `Analyze the trading pair ${pair} and provide actionable trading advice.
${context ? `Additional context: ${context}` : ''}

Consider:
1. Entry/exit points
2. Risk management (stop-loss, take-profit)
3. Position sizing recommendation
4. Market regime assessment
5. Confidence level

Provide specific, actionable recommendations.`;

        const result = await runCouncilConsensus(tradingQuestion);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // ===== Bot Tools =====
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
