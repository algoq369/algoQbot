#!/usr/bin/env node

/**
 * Connected Chat with AlgoQBot #1
 * Connects to running bot via file-based communication
 */

const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

// Communication via shared state file
const STATE_FILE = path.join(__dirname, '../data/bot-state.json');

async function getBotState() {
  try {
    const state = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(state);
  } catch (error) {
    return null;
  }
}

async function startChat() {
  console.clear();

  console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           🤖 AlgoQBot #1 - Trading Agent Chat             ║
║                                                           ║
║  Initiateur: Talk with your autonomous trading agent      ║
║  Purpose: Improve trading performance through dialogue    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`));

  console.log(chalk.yellow('Connecting to AlgoQBot #1...\n'));

  // Check bot state
  const botState = await getBotState();

  if (!botState) {
    console.log(chalk.yellow('⚠️  Bot state not available. Bot may still be starting...\n'));
    console.log(chalk.gray('Continuing anyway - chat will work once bot publishes state.\n'));
  } else {
    console.log(chalk.green('✅ Connected to running bot\n'));
    console.log(chalk.gray(`Portfolio: $${botState.portfolioValue || 'N/A'}`));
    console.log(chalk.gray(`Regime: ${botState.regime || 'N/A'}`));
    console.log(chalk.gray(`Volatility: ${botState.volatility || 'N/A'}%\n`));
  }

  // Initialize AlgoQBot agent directly (doesn't need global.bot)
  const AlgoQBotAgent = require('../agent/AlgoQBotAgent');

  // Create mock bot object with state
  const mockBot = {
    tradingStrategyAgent: {
      currentVolatility4h: (botState?.volatility || 0) / 100,
      currentRegime: botState?.regime || 'UNKNOWN',
      activePositions: new Map()
    },
    riskManager: {},
    portfolioManager: {
      cachedValue: botState?.portfolioValue || 0
    },
    multiDexManager: {
      dexs: {
        pancakeSwap: {
          getCurrentPrice: async () => botState?.currentPrice || 0
        }
      }
    }
  };

  const agent = new AlgoQBotAgent(mockBot);
  await agent.initialize();

  // Show agent status
  const status = agent.getStatus();
  console.log(chalk.gray(`Conversations: ${status.performance.conversations}`));
  console.log(chalk.gray(`Lessons Learned: ${status.learning.total_lessons}`));
  console.log(chalk.gray(`Decisions Made: ${status.trading.decisions_made}\n`));

  console.log(chalk.cyan('Commands:'));
  console.log(chalk.gray('  /status      - Show agent status'));
  console.log(chalk.gray('  /performance - Show trading performance'));
  console.log(chalk.gray('  /lessons     - Show lessons learned'));
  console.log(chalk.gray('  /refresh     - Refresh bot state'));
  console.log(chalk.gray('  /clear       - Clear screen'));
  console.log(chalk.gray('  /exit        - Exit chat\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue.bold('💬 Initiateur: ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input === '/exit') {
      console.log(chalk.cyan('\n👋 AlgoQBot: Until next time, Initiateur! Let\'s keep improving! 🚀\n'));
      process.exit(0);
    }

    if (input === '/clear') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === '/refresh') {
      const newState = await getBotState();
      if (newState) {
        console.log(chalk.green('\n✅ Bot state refreshed\n'));
        console.log(chalk.white(`Portfolio: $${newState.portfolioValue}`));
        console.log(chalk.white(`Regime: ${newState.regime}`));
        console.log(chalk.white(`Volatility: ${newState.volatility}%\n`));
      } else {
        console.log(chalk.yellow('\n⚠️  Could not refresh state\n'));
      }
      rl.prompt();
      return;
    }

    if (input === '/status') {
      const status = agent.getStatus();
      console.log(chalk.yellow('\n📊 AlgoQBot #1 Status:\n'));
      console.log(chalk.white(`Instance: ${status.identity.name}`));
      console.log(chalk.white(`Status: ${status.identity.status}`));
      console.log(chalk.white(`Conversations: ${status.performance.conversations}`));
      console.log(chalk.white(`Lessons Learned: ${status.learning.total_lessons}`));
      console.log(chalk.white(`Improvements Proposed: ${status.learning.improvement_proposals}\n`));
      rl.prompt();
      return;
    }

    if (input === '/performance') {
      const state = await getBotState();
      console.log(chalk.yellow('\n📈 Current Trading Performance:\n'));
      if (state) {
        console.log(chalk.white(`Portfolio: $${state.portfolioValue}`));
        console.log(chalk.white(`Active Positions: ${state.activePositions || 0}`));
        console.log(chalk.white(`Regime: ${state.regime}`));
        console.log(chalk.white(`Volatility: ${state.volatility}%\n`));
      } else {
        console.log(chalk.gray('State not available\n'));
      }
      rl.prompt();
      return;
    }

    if (input === '/lessons') {
      const status = agent.getStatus();
      console.log(chalk.yellow('\n📚 Recent Lessons Learned:\n'));
      if (status.learning.total_lessons === 0) {
        console.log(chalk.gray('   No lessons yet - teach me something!'));
      } else {
        status.learning.recent_lessons.forEach((lesson, i) => {
          console.log(chalk.white(`${i + 1}. [${lesson.category}] ${lesson.teaching.substring(0, 80)}...`));
        });
      }
      console.log('');
      rl.prompt();
      return;
    }

    // Regular conversation
    process.stdout.write(chalk.gray('\n🤖 AlgoQBot is thinking...\n'));

    try {
      const { response } = await agent.chat(input);

      console.log(chalk.green('\n🤖 AlgoQBot:\n'));
      console.log(chalk.white(response));
      console.log('');

    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\n👋 Goodbye!\n'));
    process.exit(0);
  });
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  process.exit(1);
});

// Start chat
startChat().catch(error => {
  console.error(chalk.red('Failed to start chat:'), error);
  process.exit(1);
});
