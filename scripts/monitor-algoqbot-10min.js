#!/usr/bin/env node

/**
 * 10-Minute Bot Activity Monitor
 * 
 * Starts the bot and monitors:
 * - Logs
 * - P&L (Profit & Loss)
 * - Trade count
 * - Open positions
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class BotMonitor {
  constructor() {
    this.startTime = new Date();
    this.duration = 10 * 60 * 1000; // 10 minutes
    this.endTime = new Date(this.startTime.getTime() + this.duration);
    this.stats = {
      trades: [],
      startBalance: 0,
      currentBalance: 0,
      openPositions: 0,
      logs: [],
      tasks: []
    };
  }

  async start() {
    console.clear();
    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        🤖 AlgoQBot - 10 Minute Activity Monitor                ║
║                                                                ║
║  Tracking: Logs, P&L, Trade Count, Open Positions            ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`));

    console.log(chalk.yellow(`⏱️  Monitor Duration: 10 minutes`));
    console.log(chalk.yellow(`⏱️  Start Time: ${this.startTime.toISOString()}`));
    console.log(chalk.yellow(`⏱️  End Time: ${this.endTime.toISOString()}\n`));

    // Load initial data
    await this.loadInitialData();

    // Display initial status
    this.displayStatus();

    // Monitor for 10 minutes
    const monitorInterval = setInterval(async () => {
      const elapsed = new Date() - this.startTime;
      const remaining = this.duration - elapsed;

      if (remaining <= 0) {
        clearInterval(monitorInterval);
        await this.finalReport();
        process.exit(0);
      }

      // Update every 30 seconds
      await this.updateMetrics();
      this.displayStatus();

      // Show time remaining
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      console.log(chalk.gray(`\n⏳ Time remaining: ${mins}m ${secs}s\n`));
    }, 30000); // Update every 30 seconds
  }

  async loadInitialData() {
    try {
      // Check for shadow trades
      const shadowPath = path.join(__dirname, '../data/shadow_trades.json');
      try {
        const data = await fs.readFile(shadowPath, 'utf8');
        const trades = JSON.parse(data);
        this.stats.trades = Array.isArray(trades) ? trades : [];
        this.calculateStats();
      } catch (err) {
        console.log(chalk.gray('No shadow trades found yet'));
        this.stats.trades = [];
      }

      // Check for AlgoQBot agent memory
      const agentPath = path.join(__dirname, '../data/algoqbot-agent/agent-memory.json');
      try {
        const agentData = await fs.readFile(agentPath, 'utf8');
        const memory = JSON.parse(agentData);
        this.stats.tasks = memory.task_history || [];
      } catch (err) {
        this.stats.tasks = [];
      }
    } catch (error) {
      console.error(chalk.red('Error loading initial data:'), error);
    }
  }

  calculateStats() {
    if (!this.stats.trades || this.stats.trades.length === 0) {
      return;
    }

    const trades = this.stats.trades;
    
    // Calculate P&L
    const totalPL = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    
    // Count winning and losing trades
    const winners = trades.filter(t => (t.profit || 0) > 0).length;
    const losers = trades.filter(t => (t.profit || 0) < 0).length;
    
    // Win rate
    const winRate = trades.length > 0 ? ((winners / trades.length) * 100).toFixed(1) : 0;
    
    // Find open positions (status = 'open')
    const openPositions = trades.filter(t => t.status === 'open').length;
    
    this.stats.pnl = totalPL;
    this.stats.winners = winners;
    this.stats.losers = losers;
    this.stats.winRate = winRate;
    this.stats.openPositions = openPositions;
  }

  async updateMetrics() {
    await this.loadInitialData();
    this.calculateStats();
  }

  displayStatus() {
    console.clear();
    
    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════════╗
║        🤖 AlgoQBot - 10 Minute Activity Monitor                ║
╚════════════════════════════════════════════════════════════════╝
`));

    const elapsed = new Date() - this.startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    
    console.log(chalk.yellow(`⏱️  Elapsed: ${mins}m ${secs}s / 10m 0s`));
    console.log(chalk.yellow(`⏱️  Start: ${this.startTime.toLocaleTimeString()}`));
    console.log(chalk.yellow(`⏱️  Current: ${new Date().toLocaleTimeString()}\n`));

    // P&L Section
    console.log(chalk.blue.bold('📊 PERFORMANCE'));
    console.log(chalk.gray('─'.repeat(60)));
    
    if (this.stats.trades.length === 0) {
      console.log(chalk.gray('  No trades yet'));
    } else {
      const pnl = this.stats.pnl || 0;
      const pnlColor = pnl > 0 ? chalk.green : pnl < 0 ? chalk.red : chalk.gray;
      
      console.log(`  💰 P&L: ${pnlColor(`$${pnl.toFixed(2)}`)}`);
      console.log(`  📈 Total Trades: ${this.stats.trades.length}`);
      console.log(`  ✅ Winners: ${chalk.green(this.stats.winners)}`);
      console.log(`  ❌ Losers: ${chalk.red(this.stats.losers)}`);
      console.log(`  📊 Win Rate: ${chalk.cyan(`${this.stats.winRate}%`)}`);
    }

    // Positions Section
    console.log(`\n${chalk.blue.bold('💼 POSITIONS')}`);
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  📂 Open Positions: ${chalk.yellow(this.stats.openPositions)}`);

    // Task Activity Section
    console.log(`\n${chalk.blue.bold('⚙️ AGENT ACTIVITY')}`);
    console.log(chalk.gray('─'.repeat(60)));
    
    if (this.stats.tasks && this.stats.tasks.length > 0) {
      const recentTasks = this.stats.tasks.slice(-5);
      console.log(`  📋 Recent Tasks: ${recentTasks.length}`);
      
      const taskStats = {
        completed: recentTasks.filter(t => t.status === 'completed').length,
        failed: recentTasks.filter(t => t.status === 'failed').length,
        running: recentTasks.filter(t => t.status === 'running').length
      };
      
      console.log(`  ✅ Completed: ${chalk.green(taskStats.completed)}`);
      console.log(`  ❌ Failed: ${chalk.red(taskStats.failed)}`);
      console.log(`  ⏳ Running: ${chalk.yellow(taskStats.running)}`);
      
      // Show last task
      if (recentTasks.length > 0) {
        const lastTask = recentTasks[recentTasks.length - 1];
        console.log(`\n  📌 Last Task: ${lastTask.name}`);
        console.log(`     Type: ${lastTask.type}`);
        console.log(`     Status: ${lastTask.status}`);
        console.log(`     Duration: ${lastTask.duration}ms`);
      }
    } else {
      console.log(chalk.gray('  No agent tasks yet'));
    }

    // System Info Section
    console.log(`\n${chalk.blue.bold('🖥️ SYSTEM')}`);
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  🔄 Memory: ${this.formatMemory(process.memoryUsage().heapUsed)}`);
    console.log(`  📁 Uptime: ${mins}m ${secs}s`);

    console.log(chalk.gray('\n' + '─'.repeat(60)));
  }

  formatMemory(bytes) {
    const mb = (bytes / 1024 / 1024).toFixed(2);
    return `${mb} MB`;
  }

  async finalReport() {
    await this.loadInitialData();
    this.calculateStats();

    console.clear();
    
    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════════════════════════╗
║        🤖 AlgoQBot - 10 Minute Monitor - FINAL REPORT         ║
╚════════════════════════════════════════════════════════════════╝
`));

    // Summary
    console.log(chalk.green.bold('📋 MONITORING SUMMARY'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  ⏱️  Duration: 10 minutes (${this.duration / 1000 / 60} min)`);
    console.log(`  📅 Started: ${this.startTime.toLocaleString()}`);
    console.log(`  📅 Ended: ${new Date().toLocaleString()}`);

    // Performance Summary
    console.log(`\n${chalk.green.bold('📊 PERFORMANCE SUMMARY')}`);
    console.log(chalk.gray('─'.repeat(60)));

    if (this.stats.trades.length === 0) {
      console.log(chalk.gray('  No trades recorded'));
    } else {
      const pnl = this.stats.pnl || 0;
      const pnlColor = pnl > 0 ? chalk.green : pnl < 0 ? chalk.red : chalk.gray;
      
      console.log(`  💰 Total P&L: ${pnlColor(`$${pnl.toFixed(2)}`)}`);
      console.log(`  📈 Total Trades: ${this.stats.trades.length}`);
      console.log(`  ✅ Winning Trades: ${chalk.green(this.stats.winners)}`);
      console.log(`  ❌ Losing Trades: ${chalk.red(this.stats.losers)}`);
      console.log(`  📊 Win Rate: ${chalk.cyan(`${this.stats.winRate}%`)}`);
      
      // Average trade profit
      const avgProfit = (this.stats.pnl / this.stats.trades.length).toFixed(2);
      console.log(`  📍 Average Trade: $${avgProfit}`);
    }

    // Positions Summary
    console.log(`\n${chalk.green.bold('💼 POSITIONS SUMMARY')}`);
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  📂 Open Positions: ${this.stats.openPositions}`);
    console.log(`  🔒 Closed Positions: ${Math.max(0, (this.stats.trades.length || 0) - this.stats.openPositions)}`);

    // Agent Activity Summary
    console.log(`\n${chalk.green.bold('⚙️ AGENT ACTIVITY SUMMARY')}`);
    console.log(chalk.gray('─'.repeat(60)));
    
    if (this.stats.tasks && this.stats.tasks.length > 0) {
      const taskStats = {
        completed: this.stats.tasks.filter(t => t.status === 'completed').length,
        failed: this.stats.tasks.filter(t => t.status === 'failed').length,
        total: this.stats.tasks.length
      };
      
      console.log(`  📋 Total Tasks Executed: ${taskStats.total}`);
      console.log(`  ✅ Completed: ${chalk.green(taskStats.completed)}`);
      console.log(`  ❌ Failed: ${chalk.red(taskStats.failed)}`);
      
      // Average task duration
      const avgDuration = this.stats.tasks.reduce((sum, t) => sum + (t.duration || 0), 0) / this.stats.tasks.length;
      console.log(`  ⏱️  Average Task Duration: ${avgDuration.toFixed(0)}ms`);
    } else {
      console.log(chalk.gray('  No agent tasks recorded'));
    }

    // Recommendations
    console.log(`\n${chalk.cyan.bold('💡 OBSERVATIONS')}`);
    console.log(chalk.gray('─'.repeat(60)));
    
    if (this.stats.trades.length === 0) {
      console.log('  • No trades were executed during monitoring period');
      console.log('  • Bot may be in analysis/setup phase');
    } else {
      if (this.stats.winRate > 50) {
        console.log(chalk.green('  ✅ Win rate above 50% - Strategy performing well'));
      } else if (this.stats.winRate > 0) {
        console.log(chalk.yellow('  ⚠️  Win rate below 50% - May need strategy adjustment'));
      }
      
      if (this.stats.pnl > 0) {
        console.log(chalk.green('  ✅ Positive P&L - Trading strategy profitable'));
      } else if (this.stats.pnl < 0) {
        console.log(chalk.red('  ❌ Negative P&L - Review strategy and risk management'));
      }
    }

    if (this.stats.tasks && this.stats.tasks.length > 0) {
      const failureRate = (this.stats.tasks.filter(t => t.status === 'failed').length / this.stats.tasks.length * 100).toFixed(1);
      if (failureRate > 0) {
        console.log(chalk.yellow(`  ⚠️  Task failure rate: ${failureRate}%`));
      } else {
        console.log(chalk.green('  ✅ All agent tasks completed successfully'));
      }
    }

    console.log(`\n${chalk.gray('─'.repeat(60))}`);
    console.log(chalk.cyan.bold('\n✅ Monitoring Complete!\n'));
  }
}

// Run the monitor
const monitor = new BotMonitor();
monitor.start().catch(error => {
  console.error(chalk.red('Monitor error:'), error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n⏹️  Monitoring stopped by user'));
  await monitor.finalReport();
  process.exit(0);
});
