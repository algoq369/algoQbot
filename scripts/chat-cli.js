#!/usr/bin/env node

const readline = require('readline');
const chalk = require('chalk');

async function startChatCLI() {
  console.clear();

  console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🤖 AlgoQBot AI Chat Interface                ║
║                                                           ║
║  Your intelligent trading analysis companion              ║
║  Ask me anything about markets, strategies, or trading!   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`));

  console.log(chalk.yellow('Initializing AlgoQBot...\n'));

  // Load bot and chat system
  const AlgoQBotChat = require('../chat/AlgoQBotChat');

  // Get bot instance (optional - can work without it)
  let bot = null;
  let botStatus = 'read-only';

  try {
    // Try to get running bot instance
    const AdvancedTradingBot = require('../AdvancedTradingBot');
    if (global.bot) {
      bot = global.bot;
      botStatus = 'live';
      console.log(chalk.green('✅ Connected to live bot instance\n'));
    } else {
      console.log(chalk.yellow('⚠️  Running in read-only mode (bot not connected)'));
      console.log(chalk.gray('   Data from logs and database only'));
      console.log(chalk.gray('   To connect to live bot: Start bot first with npm run start-shadow\n'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Running in read-only mode (bot not found)'));
    console.log(chalk.gray('   Data from logs and database only\n'));
  }

  const chat = new AlgoQBotChat(bot);
  await chat.initialize();

  console.log(chalk.green('✅ AlgoQBot ready to chat!\n'));
  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  /status  - Quick bot status'));
  console.log(chalk.gray('  /clear   - Clear screen'));
  console.log(chalk.gray('  /exit    - Exit chat\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue.bold('💬 You: ')
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
      console.log(chalk.cyan('\n👋 AlgoQBot: See you next time, Initiateur! Happy trading! 🚀\n'));
      process.exit(0);
    }

    if (input === '/clear') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === '/status') {
      const status = await chat.getQuickStatus();
      console.log(chalk.yellow('\n' + status + '\n'));
      rl.prompt();
      return;
    }

    // Get bot response
    process.stdout.write(chalk.gray('\n🤖 AlgoQBot is thinking...\n'));

    try {
      const { response } = await chat.chat(input);

      // Format response
      console.log(chalk.green('\n🤖 AlgoQBot:\n'));
      console.log(chalk.white(formatResponse(response)));
      console.log('');
    } catch (error) {
      console.log(chalk.red('\n❌ Error: ' + error.message + '\n'));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\n👋 Goodbye!\n'));
    process.exit(0);
  });
}

function formatResponse(text) {
  // Add simple formatting for markdown-style text
  return text
    .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
    .replace(/\*(.*?)\*/g, chalk.italic('$1'))
    .replace(/`(.*?)`/g, chalk.cyan('$1'));
}

// Start CLI
startChatCLI().catch(error => {
  console.error(chalk.red('Error starting chat:'), error);
  process.exit(1);
});
