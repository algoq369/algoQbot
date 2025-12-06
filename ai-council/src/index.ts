#!/usr/bin/env node
/**
 * AI Council - Main Entry Point
 * Multi-AI Consensus System for algoQbot
 *
 * Usage: npm run council
 */

import 'dotenv/config';
import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { CouncilOrchestrator } from './orchestrator/engine.js';
import { AIProvider, StreamEvent, Message } from './types/index.js';

// Load API keys from environment
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const QWEN_API_KEY = process.env.QWEN_API_KEY || '';

// Check for required API keys
function checkApiKeys(): boolean {
  const missing: string[] = [];
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
    missing.push('ANTHROPIC_API_KEY');
  }
  if (!DEEPSEEK_API_KEY) {
    missing.push('DEEPSEEK_API_KEY');
  }
  if (!QWEN_API_KEY) {
    missing.push('QWEN_API_KEY');
  }

  if (missing.length > 0) {
    console.log(chalk.red('\n Missing API Keys:'));
    missing.forEach((key) => console.log(chalk.yellow(`   - ${key}`)));
    console.log(chalk.gray('\n Add them to your .env file in the project root.\n'));
    return false;
  }
  return true;
}

// Color formatting for each AI
const AI_COLORS: Record<AIProvider, chalk.Chalk> = {
  claude: chalk.magenta,
  deepseek: chalk.green,
  qwen: chalk.blue
};

const AI_EMOJIS: Record<AIProvider, string> = {
  claude: '🟣',
  deepseek: '🟢',
  qwen: '🔵'
};

// Format token usage
function formatTokens(input: number, output: number, cost: number): string {
  return chalk.gray(`[${input}→${output} tokens | $${cost.toFixed(4)}]`);
}

// Print council header
function printHeader(): void {
  console.log(chalk.bold.cyan('\n' + '═'.repeat(60)));
  console.log(chalk.bold.cyan('          🏛️  AI COUNCIL - Multi-AI Consensus System'));
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.gray('  Participants: Claude (Architect) | DeepSeek (Math) | Qwen (Strategy)'));
  console.log(chalk.gray('  Mode: Consensus Loop | Threshold: 80% Agreement'));
  console.log(chalk.bold.cyan('═'.repeat(60) + '\n'));
}

// Print a message from an AI
function printAIMessage(message: Message): void {
  if (!message.provider) return;

  const color = AI_COLORS[message.provider];
  const emoji = AI_EMOJIS[message.provider];
  const name = message.provider.toUpperCase();

  console.log(color(`\n${emoji} ${name} [Round ${message.round}]`));
  console.log(chalk.gray('─'.repeat(50)));

  // Print reasoning if available
  if (message.reasoning) {
    console.log(chalk.dim.italic('Thinking: ' + message.reasoning.slice(0, 200) + '...'));
    console.log();
  }

  // Print main content
  console.log(message.content);

  // Print metadata
  if (message.tokens) {
    console.log();
    console.log(
      formatTokens(message.tokens.input, message.tokens.output, message.tokens.cost),
      message.confidence ? chalk.yellow(`Confidence: ${message.confidence}%`) : '',
      message.stance ? chalk.cyan(`Stance: ${message.stance}`) : ''
    );
  }
}

// Main function
async function main(): Promise<void> {
  printHeader();

  if (!checkApiKeys()) {
    process.exit(1);
  }

  // Create orchestrator
  const council = new CouncilOrchestrator(
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
    QWEN_API_KEY,
    {
      maxRounds: 3,
      consensusThreshold: 0.8,
      enableReasoning: true,
      enableStreaming: false  // Set to false for cleaner output
    }
  );

  // Track streaming tokens per AI
  const streamBuffers: Record<AIProvider, string> = {
    claude: '',
    deepseek: '',
    qwen: ''
  };

  // Event handler
  council.onEvent((event: StreamEvent) => {
    switch (event.type) {
      case 'status':
        if (event.data.status === 'round_start') {
          console.log(chalk.yellow(`\n📢 Starting Round ${event.data.round}/${event.data.maxRounds}...`));
        } else if (event.data.status === 'round_end') {
          console.log(chalk.yellow(`\n📊 Round ${event.data.round} Complete | Agreement: ${(event.data.agreementScore * 100).toFixed(1)}%`));
        }
        break;

      case 'token':
        if (event.provider) {
          // For streaming, we could print tokens as they arrive
          // For now, we just accumulate
          streamBuffers[event.provider] = event.data.cumulative;
        }
        break;

      case 'message':
        if (event.data.type === 'ai') {
          printAIMessage(event.data);
        }
        break;

      case 'consensus':
        if (event.data.reached) {
          console.log(chalk.green.bold('\n✅ CONSENSUS REACHED!'));
          console.log(chalk.green(`   Agreement Score: ${(event.data.score * 100).toFixed(1)}%`));
          console.log(chalk.green(`   Rounds: ${event.data.round}`));
        } else if (event.data.maxRoundsReached) {
          console.log(chalk.yellow.bold('\n⚠️  MAX ROUNDS REACHED - Majority Vote'));
          console.log(chalk.yellow(`   Majority: ${event.data.votingResult?.majority.join(', ')}`));
        }
        break;

      case 'error':
        console.log(chalk.red(`\n❌ Error: ${event.data}`));
        break;
    }
  });

  // Create readline interface
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (): void => {
    rl.question(chalk.cyan('\n👤 You: '), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(chalk.gray('\n👋 Goodbye!\n'));
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === 'stats') {
        const session = council.getSession();
        if (session) {
          console.log(chalk.cyan('\n📊 Session Statistics:'));
          console.log(chalk.gray(`   Total Tokens: ${session.totalTokens.total}`));
          console.log(chalk.gray(`   Total Cost: $${session.totalTokens.cost.toFixed(4)}`));
          console.log(chalk.gray(`   Rounds: ${session.consensus.round}`));
          console.log(chalk.gray(`   Agreement: ${(session.consensus.agreementScore * 100).toFixed(1)}%`));
        }
        askQuestion();
        return;
      }

      const spinner = ora('Council is deliberating...').start();

      try {
        const session = await council.startSession(trimmed);
        spinner.stop();

        // Print final summary
        console.log(chalk.cyan('\n' + '─'.repeat(60)));
        console.log(chalk.bold.cyan('📋 SESSION SUMMARY'));
        console.log(chalk.cyan('─'.repeat(60)));
        console.log(chalk.gray(`   Session ID: ${session.id}`));
        console.log(chalk.gray(`   Rounds: ${session.consensus.round}`));
        console.log(chalk.gray(`   Total Tokens: ${session.totalTokens.total}`));
        console.log(chalk.gray(`   Total Cost: $${session.totalTokens.cost.toFixed(4)}`));
        console.log(chalk.gray(`   Agreement: ${(session.consensus.agreementScore * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Status: ${session.status}`));
        console.log(chalk.cyan('─'.repeat(60)));

      } catch (error) {
        spinner.stop();
        console.log(chalk.red(`\n❌ Error: ${error}`));
      }

      askQuestion();
    });
  };

  console.log(chalk.gray('Type your question or task for the council.'));
  console.log(chalk.gray('Commands: "stats" for session stats, "exit" to quit.\n'));

  askQuestion();
}

// Run
main().catch(console.error);
