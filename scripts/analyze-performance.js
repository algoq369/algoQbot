#!/usr/bin/env node

/**
 * AlgoQBot Performance Analysis Report
 * Analyzes trades from yesterday and today
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');

async function generateReport() {
  let db;

  try {
    // Connect to database
    db = new Database('./data/trading_bot.db', { readonly: true });
    console.log('✅ Database connected\n');

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('📅 Analysis Period:');
    console.log(`Yesterday: ${yesterday.toISOString().split('T')[0]}`);
    console.log(`Today: ${today.toISOString().split('T')[0]}\n`);

    // Query yesterday's trades
    const yesterdayTrades = db.prepare(`
      SELECT * FROM trades
      WHERE created_at >= ? AND created_at < ?
      ORDER BY created_at ASC
    `).all(yesterday.toISOString(), today.toISOString());

    // Query today's trades
    const todayTrades = db.prepare(`
      SELECT * FROM trades
      WHERE created_at >= ? AND created_at < ?
      ORDER BY created_at ASC
    `).all(today.toISOString(), tomorrow.toISOString());

    // Analyze yesterday
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 YESTERDAY\'S PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    const yesterdayAnalysis = analyzeDay(yesterdayTrades, 'Yesterday');
    displayAnalysis(yesterdayAnalysis);

    // Analyze today
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 TODAY\'S PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    const todayAnalysis = analyzeDay(todayTrades, 'Today');
    displayAnalysis(todayAnalysis);

    // Comparison
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📈 COMPARISON & TRENDS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    displayComparison(yesterdayAnalysis, todayAnalysis);

    // Strategy breakdown
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎯 STRATEGY PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    displayStrategyBreakdown(yesterdayTrades, todayTrades);

    // Time of day analysis
    if (todayTrades.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🕐 TIME OF DAY ANALYSIS');
      console.log('═══════════════════════════════════════════════════════════════\n');
      displayTimeOfDayAnalysis(todayTrades);
    }

    // Insights & Recommendations
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('💡 INSIGHTS & RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    const insights = generateInsights(yesterdayAnalysis, todayAnalysis, yesterdayTrades, todayTrades);

    // Export reports
    await exportReports(yesterdayAnalysis, todayAnalysis, yesterdayTrades, todayTrades, insights, today, yesterday);

    console.log('\n✅ Analysis complete!\n');

    db.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error generating report:', error);
    if (db) db.close();
    process.exit(1);
  }
}

function analyzeDay(trades, label) {
  if (trades.length === 0) {
    return {
      label: label,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      breakeven_trades: 0,
      win_rate: 0,
      total_pnl: 0,
      avg_profit: 0,
      avg_loss: 0,
      largest_win: 0,
      largest_loss: 0,
      profit_factor: 0,
      strategies: {},
      trades: []
    };
  }

  const winners = trades.filter(t => (t.profit_loss || 0) > 0);
  const losers = trades.filter(t => (t.profit_loss || 0) < 0);
  const breakeven = trades.filter(t => (t.profit_loss || 0) === 0);

  const totalProfit = winners.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
  const totalLoss = Math.abs(losers.reduce((sum, t) => sum + (t.profit_loss || 0), 0));
  const totalPnL = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);

  const strategies = {};
  trades.forEach(t => {
    const strat = t.strategy || 'unknown';
    if (!strategies[strat]) {
      strategies[strat] = { count: 0, pnl: 0, wins: 0 };
    }
    strategies[strat].count++;
    strategies[strat].pnl += (t.profit_loss || 0);
    if ((t.profit_loss || 0) > 0) strategies[strat].wins++;
  });

  return {
    label: label,
    total_trades: trades.length,
    winning_trades: winners.length,
    losing_trades: losers.length,
    breakeven_trades: breakeven.length,
    win_rate: trades.length > 0 ? (winners.length / trades.length * 100).toFixed(2) : 0,
    total_pnl: totalPnL.toFixed(2),
    avg_profit: winners.length > 0 ? (totalProfit / winners.length).toFixed(2) : 0,
    avg_loss: losers.length > 0 ? (totalLoss / losers.length).toFixed(2) : 0,
    largest_win: winners.length > 0 ? Math.max(...winners.map(t => t.profit_loss || 0)).toFixed(2) : 0,
    largest_loss: losers.length > 0 ? Math.min(...losers.map(t => t.profit_loss || 0)).toFixed(2) : 0,
    profit_factor: totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : 0,
    strategies: strategies,
    trades: trades
  };
}

function displayAnalysis(analysis) {
  if (analysis.total_trades === 0) {
    console.log(`No trades executed on ${analysis.label}`);
    return;
  }

  console.log(`📊 Overview:`);
  console.log(`   Total Trades: ${analysis.total_trades}`);
  console.log(`   Winners: ${analysis.winning_trades} (${analysis.win_rate}%)`);
  console.log(`   Losers: ${analysis.losing_trades}`);
  console.log(`   Breakeven: ${analysis.breakeven_trades}\n`);

  console.log(`💰 P&L Metrics:`);
  const pnlColor = parseFloat(analysis.total_pnl) >= 0 ? '✅' : '❌';
  console.log(`   Total P&L: ${pnlColor} $${analysis.total_pnl}`);
  console.log(`   Avg Win: $${analysis.avg_profit}`);
  console.log(`   Avg Loss: -$${analysis.avg_loss}`);
  console.log(`   Largest Win: $${analysis.largest_win}`);
  console.log(`   Largest Loss: $${analysis.largest_loss}\n`);

  console.log(`📈 Performance Metrics:`);
  const pfGood = parseFloat(analysis.profit_factor) > 1.5;
  const wrGood = parseFloat(analysis.win_rate) > 60;
  console.log(`   Profit Factor: ${analysis.profit_factor} ${pfGood ? '✅' : '⚠️'}`);
  console.log(`   Win Rate: ${analysis.win_rate}% ${wrGood ? '✅' : '⚠️'}`);
}

function displayComparison(yesterday, today) {
  const tradeDiff = today.total_trades - yesterday.total_trades;
  const pnlDiff = parseFloat(today.total_pnl) - parseFloat(yesterday.total_pnl);
  const winRateDiff = parseFloat(today.win_rate) - parseFloat(yesterday.win_rate);

  console.log(`📊 Trade Volume:`);
  console.log(`   Yesterday: ${yesterday.total_trades} trades`);
  console.log(`   Today: ${today.total_trades} trades`);
  console.log(`   Change: ${tradeDiff >= 0 ? '+' : ''}${tradeDiff} ${tradeDiff >= 0 ? '📈' : '📉'}\n`);

  console.log(`💰 Profitability:`);
  console.log(`   Yesterday: $${yesterday.total_pnl}`);
  console.log(`   Today: $${today.total_pnl}`);
  console.log(`   Change: ${pnlDiff >= 0 ? '+' : ''}$${pnlDiff.toFixed(2)} ${pnlDiff >= 0 ? '✅' : '❌'}\n`);

  console.log(`📈 Win Rate:`);
  console.log(`   Yesterday: ${yesterday.win_rate}%`);
  console.log(`   Today: ${today.win_rate}%`);
  console.log(`   Change: ${winRateDiff >= 0 ? '+' : ''}${winRateDiff.toFixed(2)}% ${winRateDiff >= 0 ? '📈' : '📉'}`);
}

function displayStrategyBreakdown(yesterdayTrades, todayTrades) {
  const allTrades = [...yesterdayTrades, ...todayTrades];

  if (allTrades.length === 0) {
    console.log('   No strategy data available (no trades)');
    return;
  }

  const strategies = {};

  allTrades.forEach(t => {
    const strat = t.strategy || 'unknown';
    if (!strategies[strat]) {
      strategies[strat] = {
        total: 0,
        wins: 0,
        pnl: 0
      };
    }
    strategies[strat].total++;
    if ((t.profit_loss || 0) > 0) strategies[strat].wins++;
    strategies[strat].pnl += (t.profit_loss || 0);
  });

  console.log(`Strategy Performance (Last 2 Days):\n`);

  Object.entries(strategies)
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .forEach(([strategy, stats]) => {
      const winRate = ((stats.wins / stats.total) * 100).toFixed(1);
      console.log(`   ${strategy}:`);
      console.log(`      Trades: ${stats.total}`);
      console.log(`      Win Rate: ${winRate}%`);
      console.log(`      P&L: $${stats.pnl.toFixed(2)}`);
      console.log('');
    });
}

function displayTimeOfDayAnalysis(todayTrades) {
  const morningTrades = todayTrades.filter(t => {
    const hour = new Date(t.created_at).getHours();
    return hour >= 6 && hour < 12;
  });

  const afternoonTrades = todayTrades.filter(t => {
    const hour = new Date(t.created_at).getHours();
    return hour >= 12 && hour < 18;
  });

  const eveningTrades = todayTrades.filter(t => {
    const hour = new Date(t.created_at).getHours();
    return hour >= 18 || hour < 6;
  });

  const morningPnL = morningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
  const afternoonPnL = afternoonTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
  const eveningPnL = eveningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);

  console.log(`   Morning (6am-12pm): ${morningTrades.length} trades, P&L: $${morningPnL.toFixed(2)}`);
  console.log(`   Afternoon (12pm-6pm): ${afternoonTrades.length} trades, P&L: $${afternoonPnL.toFixed(2)}`);
  console.log(`   Evening (6pm-6am): ${eveningTrades.length} trades, P&L: $${eveningPnL.toFixed(2)}`);
}

function generateInsights(yesterday, today, yesterdayTrades, todayTrades) {
  const insights = [];

  // Win rate analysis
  const todayWinRate = parseFloat(today.win_rate);
  if (today.total_trades > 0) {
    if (todayWinRate < 60) {
      insights.push({
        type: '⚠️ WARNING',
        message: `Win rate at ${todayWinRate}% is below 60% target`,
        recommendation: 'Consider raising confidence thresholds to filter out marginal trades'
      });
    } else if (todayWinRate >= 70) {
      insights.push({
        type: '✅ STRENGTH',
        message: `Excellent win rate of ${todayWinRate}%`,
        recommendation: 'Current strategy selection working well - maintain approach'
      });
    }
  }

  // P&L trend
  const todayPnL = parseFloat(today.total_pnl);
  if (today.total_trades > 0) {
    if (todayPnL < 0) {
      insights.push({
        type: '❌ CONCERN',
        message: `Today showing negative P&L of $${todayPnL}`,
        recommendation: 'Review trade quality - may need to increase confidence requirements'
      });
    } else if (todayPnL > 50) {
      insights.push({
        type: '✅ SUCCESS',
        message: `Strong profit of $${todayPnL} today`,
        recommendation: 'Analyze successful trades to identify patterns for replication'
      });
    }
  }

  // Trade volume
  if (today.total_trades === 0 && yesterday.total_trades === 0) {
    insights.push({
      type: '⚠️ OBSERVATION',
      message: 'No trades executed in last 2 days',
      recommendation: 'Check if market conditions (volatility) prevented trading, or if system has issues'
    });
  } else if (today.total_trades > 20) {
    insights.push({
      type: '⚠️ CAUTION',
      message: `High trade volume (${today.total_trades} trades) today`,
      recommendation: 'Ensure not overtrading - quality over quantity'
    });
  }

  // Profit factor
  const profitFactor = parseFloat(today.profit_factor);
  if (profitFactor < 1.5 && today.total_trades > 0) {
    insights.push({
      type: '⚠️ WARNING',
      message: `Profit factor of ${profitFactor} is below 1.5 target`,
      recommendation: 'Need better risk-reward ratio - consider wider TPs or tighter SLs'
    });
  }

  // Strategy performance
  if (Object.keys(today.strategies).length > 0) {
    const bestStrategy = Object.entries(today.strategies)
      .sort((a, b) => b[1].pnl - a[1].pnl)[0];

    if (bestStrategy) {
      insights.push({
        type: '💡 INSIGHT',
        message: `Best performing strategy today: ${bestStrategy[0]} ($${bestStrategy[1].pnl.toFixed(2)})`,
        recommendation: 'Consider allocating more capital to top-performing strategy'
      });
    }
  }

  // Display insights
  insights.forEach(insight => {
    console.log(`${insight.type}: ${insight.message}`);
    console.log(`   Recommendation: ${insight.recommendation}\n`);
  });

  // Action items
  console.log(`🎯 IMMEDIATE ACTION ITEMS:\n`);

  if (todayWinRate < 60 && today.total_trades > 0) {
    console.log(`   1. Raise confidence threshold by 5% (current: varies by regime)`);
  }
  if (todayPnL < 0 && today.total_trades > 0) {
    console.log(`   2. Review last ${today.total_trades} trades for pattern analysis`);
  }
  if (today.total_trades === 0 && yesterday.total_trades === 0) {
    console.log(`   3. Check volatility filter settings and current market conditions`);
  }
  if (insights.length === 0 || (insights.length === 1 && insights[0].type.includes('OBSERVATION'))) {
    console.log(`   ✅ No immediate actions required - system operating as expected`);
  }

  return insights;
}

async function exportReports(yesterdayAnalysis, todayAnalysis, yesterdayTrades, todayTrades, insights, today, yesterday) {
  // Ensure directories exist
  await fs.mkdir('./data', { recursive: true });
  await fs.mkdir('./reports', { recursive: true });

  // Export JSON report
  const report = {
    generated_at: new Date().toISOString(),
    yesterday: {
      ...yesterdayAnalysis,
      trades: yesterdayTrades.map(formatTrade)
    },
    today: {
      ...todayAnalysis,
      trades: todayTrades.map(formatTrade)
    },
    insights: insights
  };

  await fs.writeFile(
    `./data/performance-report-${today.toISOString().split('T')[0]}.json`,
    JSON.stringify(report, null, 2)
  );

  console.log(`\n✅ JSON report exported to: ./data/performance-report-${today.toISOString().split('T')[0]}.json`);

  // Export text summary
  const tradeDiff = todayAnalysis.total_trades - yesterdayAnalysis.total_trades;
  const pnlDiff = parseFloat(todayAnalysis.total_pnl) - parseFloat(yesterdayAnalysis.total_pnl);
  const winRateDiff = parseFloat(todayAnalysis.win_rate) - parseFloat(yesterdayAnalysis.win_rate);

  const summaryReport = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║            AlgoQBot Performance Report                        ║
║            Generated: ${new Date().toLocaleString()}                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

YESTERDAY (${yesterday.toISOString().split('T')[0]})
────────────────────────────────────────────────────────────────
Trades: ${yesterdayAnalysis.total_trades}
Win Rate: ${yesterdayAnalysis.win_rate}%
P&L: $${yesterdayAnalysis.total_pnl}
Profit Factor: ${yesterdayAnalysis.profit_factor}

TODAY (${today.toISOString().split('T')[0]})
────────────────────────────────────────────────────────────────
Trades: ${todayAnalysis.total_trades}
Win Rate: ${todayAnalysis.win_rate}%
P&L: $${todayAnalysis.total_pnl}
Profit Factor: ${todayAnalysis.profit_factor}

TREND ANALYSIS
────────────────────────────────────────────────────────────────
Trade Volume: ${tradeDiff >= 0 ? '↑' : '↓'} ${Math.abs(tradeDiff)} trades
Profitability: ${pnlDiff >= 0 ? '↑' : '↓'} $${Math.abs(pnlDiff).toFixed(2)}
Win Rate: ${winRateDiff >= 0 ? '↑' : '↓'} ${Math.abs(winRateDiff).toFixed(2)}%

TOP INSIGHTS
────────────────────────────────────────────────────────────────
${insights.length > 0 ? insights.map(i => `• ${i.message}`).join('\n') : '• No significant insights - performance is stable'}

RECOMMENDATIONS
────────────────────────────────────────────────────────────────
${insights.length > 0 ? insights.map(i => `• ${i.recommendation}`).join('\n') : '• Continue current approach - no immediate changes needed'}
`;

  await fs.writeFile(
    `./reports/summary-${today.toISOString().split('T')[0]}.txt`,
    summaryReport
  );

  console.log(`✅ Summary report saved to: ./reports/summary-${today.toISOString().split('T')[0]}.txt`);
}

function formatTrade(trade) {
  return {
    timestamp: trade.created_at,
    type: trade.type,
    strategy: trade.strategy,
    token_pair: trade.token_pair,
    amount_in: trade.amount_in,
    amount_out: trade.amount_out,
    price: trade.price,
    profit_loss: trade.profit_loss,
    status: trade.status
  };
}

// Run report
generateReport();
