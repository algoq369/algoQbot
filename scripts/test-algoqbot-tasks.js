#!/usr/bin/env node

/**
 * Test script for AlgoQBot task tracking
 * Demonstrates the last active task feature
 */

const chalk = require('chalk');
const AlgoQBotAgent = require('../agent/AlgoQBotAgent');

async function testTaskTracking() {
  console.clear();

  console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🤖 AlgoQBot Task Tracking Test                     ║
║                                                           ║
║  Testing: Last Active Task, Task History, Task Status     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`));

  // Create a mock trading bot
  const mockBot = {
    tradingStrategyAgent: {},
    riskManager: {},
    portfolioManager: {}
  };

  // Initialize AlgoQBot
  console.log(chalk.yellow('Initializing AlgoQBot...\n'));
  const agent = new AlgoQBotAgent(mockBot);
  await agent.initialize();

  console.log(chalk.green('✅ AlgoQBot initialized\n'));

  // Test 1: Start a task
  console.log(chalk.cyan.bold('TEST 1: Starting a task\n'));
  const taskId1 = agent.startTask('Market Analysis', 'analysis', {
    pair: 'BNB/USDT',
    timeframe: '4h'
  });
  console.log(chalk.white(`Task ID: ${taskId1}`));
  console.log(chalk.white(`Last Active Task: ${agent.getLastActiveTask()?.name}\n`));

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Complete the task
  console.log(chalk.cyan.bold('TEST 2: Completing a task\n'));
  const completed1 = agent.endTask(taskId1, {
    trend: 'bullish',
    strength: 0.75
  }, {
    analysis_time: '1000ms'
  });
  console.log(chalk.white(`Status: ${completed1.status}`));
  console.log(chalk.white(`Duration: ${completed1.duration}ms`));
  console.log(chalk.white(`Result: ${JSON.stringify(completed1.result)}\n`));

  // Test 3: Start multiple tasks (simulating concurrent work)
  console.log(chalk.cyan.bold('TEST 3: Starting multiple concurrent tasks\n'));
  const taskId2 = agent.startTask('Price Monitoring', 'monitoring', {
    pair: 'BNB/USDT'
  });
  console.log(chalk.white(`Task 1 ID: ${taskId2}`));

  const taskId3 = agent.startTask('Signal Detection', 'strategy', {
    indicator: 'RSI'
  });
  console.log(chalk.white(`Task 2 ID: ${taskId3}`));

  console.log(chalk.white(`Active Tasks Count: ${agent.getActiveTasksCount()}\n`));

  // Test 4: Complete one task
  console.log(chalk.cyan.bold('TEST 4: Completing first concurrent task\n'));
  await new Promise(resolve => setTimeout(resolve, 500));
  const completed2 = agent.endTask(taskId2, { price: 625.50 });
  console.log(chalk.white(`Completed: ${completed2.name}`));
  console.log(chalk.white(`Status: ${completed2.status}`));
  console.log(chalk.white(`Duration: ${completed2.duration}ms`));
  console.log(chalk.white(`Active Tasks Remaining: ${agent.getActiveTasksCount()}\n`));

  // Test 5: Fail a task
  console.log(chalk.cyan.bold('TEST 5: Failing a task\n'));
  const failedTask = agent.failTask(taskId3, new Error('Connection timeout'), {
    retry_count: 3
  });
  console.log(chalk.white(`Task: ${failedTask.name}`));
  console.log(chalk.white(`Status: ${failedTask.status}`));
  console.log(chalk.white(`Error: ${failedTask.result.error}\n`));

  // Test 6: View last active task
  console.log(chalk.cyan.bold('TEST 6: Last Active Task\n'));
  const lastTask = agent.getLastActiveTask();
  console.log(chalk.white(`Name: ${lastTask.name}`));
  console.log(chalk.white(`Type: ${lastTask.type}`));
  console.log(chalk.white(`Status: ${lastTask.status}`));
  console.log(chalk.white(`Start: ${lastTask.startTime}`));
  console.log(chalk.white(`End: ${lastTask.endTime}`));
  console.log(chalk.white(`Duration: ${lastTask.duration}ms\n`));

  // Test 7: View task history
  console.log(chalk.cyan.bold('TEST 7: Task History (Last 5)\n'));
  const history = agent.getTaskHistory(5);
  history.forEach((task, index) => {
    console.log(chalk.white(`${index + 1}. [${task.status.toUpperCase()}] ${task.name} - ${task.type}`));
    console.log(chalk.gray(`   Duration: ${task.duration}ms`));
  });
  console.log('');

  // Test 8: Get full status
  console.log(chalk.cyan.bold('TEST 8: Full Agent Status\n'));
  const status = agent.getStatus();
  console.log(chalk.white(JSON.stringify(status, null, 2)));
  console.log('');

  // Test 9: Start a new task and show active
  console.log(chalk.cyan.bold('TEST 9: Active Tasks List\n'));
  const taskId4 = agent.startTask('Portfolio Rebalancing', 'execution', {
    allocation: 'equal'
  });
  console.log(chalk.white(`New Task: ${taskId4}`));
  console.log(chalk.white(`Active Tasks: ${agent.getActiveTasksCount()}`));
  const activeTasks = agent.getAllActiveTasks();
  activeTasks.forEach(task => {
    console.log(chalk.gray(`  - ${task.name} [${task.id}]`));
  });
  console.log('');

  // Complete the last task
  agent.endTask(taskId4, { success: true });

  // Test 10: Memory persistence
  console.log(chalk.cyan.bold('TEST 10: Memory Persistence\n'));
  await agent.saveMemory();
  console.log(chalk.green('✅ Agent memory saved'));

  // Verify tasks are in memory
  await agent.loadMemory();
  console.log(chalk.green('✅ Agent memory loaded'));
  const reloadedLastTask = agent.getLastActiveTask();
  console.log(chalk.white(`Reloaded Last Task: ${reloadedLastTask?.name || 'None'}\n`));

  console.log(chalk.green.bold('✅ All tests completed successfully!\n'));
  console.log(chalk.cyan('API Endpoints Available:'));
  console.log(chalk.gray('  GET  /api/algoqbot/last-active-task  - Get last active task'));
  console.log(chalk.gray('  GET  /api/algoqbot/active-tasks      - Get all active tasks'));
  console.log(chalk.gray('  GET  /api/algoqbot/task-history      - Get task history (with ?limit=N)'));
  console.log(chalk.gray('  GET  /api/algoqbot/status            - Get full AlgoQBot status\n'));
}

// Run tests
testTaskTracking().catch(error => {
  console.error(chalk.red('Test error:'), error);
  process.exit(1);
});
