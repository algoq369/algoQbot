#!/usr/bin/env node

/**
 * Chat with AlgoQBot #1
 * Direct communication interface with the first autonomous trading agent
 */

const readline = require('readline');
const chalk = require('chalk');

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

  // Load AlgoQBot agent
  console.log(chalk.yellow('Connecting to AlgoQBot #1...\n'));

  // Check if bot is running
  if (!global.bot) {
    console.log(chalk.red('⚠️  Trading bot not running. Start it first:\n'));
    console.log(chalk.yellow('   cd ~/algoQbot && npm run start-shadow\n'));
    process.exit(1);
  }

  // Initialize AlgoQBot agent
  const AlgoQBotAgent = require('../agent/AlgoQBotAgent');
  const agent = new AlgoQBotAgent(global.bot);
  await agent.initialize();

  // Show agent status
  const status = agent.getStatus();
  console.log(chalk.green(`✅ Connected to ${status.identity.name}\n`));
  console.log(chalk.gray(`Conversations: ${status.performance.conversations}`));
  console.log(chalk.gray(`Lessons Learned: ${status.learning.total_lessons}`));
  console.log(chalk.gray(`Decisions Made: ${status.trading.decisions_made}\n`));

  console.log(chalk.cyan('Commands:'));
  console.log(chalk.gray('  /status      - Show agent status'));
  console.log(chalk.gray('  /performance - Show trading performance'));
  console.log(chalk.gray('  /lessons     - Show lessons learned'));
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
      const context = await agent.getTradingContext();
      console.log(chalk.yellow('\n📈 Current Trading Performance:\n'));
      console.log(chalk.white(`Portfolio: $${context.portfolio_value}`));
      console.log(chalk.white(`Active Positions: ${context.active_positions}`));
      console.log(chalk.white(`Recent: ${context.recent_performance}\n`));
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
