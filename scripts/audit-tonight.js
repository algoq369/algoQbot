#!/usr/bin/env node

/**
 * Comprehensive Trading Audit - Tonight's Session
 * Analyzes P&L, trades, positions, and performance
 */

const { sequelize, Trade } = require('../database/models');
const fs = require('fs').promises;
const path = require('path');

async function auditTonight() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Define "tonight" - last 12 hours
    const now = new Date();
    const tonightStart = new Date(now.getTime() - (12 * 60 * 60 * 1000));

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║         🌙 TONIGHT\'S TRADING AUDIT                        ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log(`📅 Audit Period: ${tonightStart.toLocaleString()} → ${now.toLocaleString()}\n`);

    // ═══════════════════════════════════════════════════════════
    // 1. TRADES ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 1: TRADES EXECUTED');
    console.log('═══════════════════════════════════════════════════════════\n');

    const trades = await Trade.findAll({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.gte]: tonightStart
        }
      },
      order: [['createdAt', 'DESC']]
    });

    console.log(`Total Trades: ${trades.length}\n`);

    let winners = [];
    let losers = [];
    let breakeven = [];
    let totalPnL = 0;

    if (trades.length === 0) {
      console.log('✅ No trades executed tonight (HOLD strategy - protecting capital)\n');
    } else {
      // Analyze trades
      winners = trades.filter(t => (t.profit_loss || 0) > 0);
      losers = trades.filter(t => (t.profit_loss || 0) < 0);
      breakeven = trades.filter(t => (t.profit_loss || 0) === 0);

      totalPnL = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const totalProfit = winners.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
      const totalLoss = Math.abs(losers.reduce((sum, t) => sum + (t.profit_loss || 0), 0));

      console.log('📈 P&L Summary:');
      console.log(`   Total P&L: ${totalPnL >= 0 ? '✅' : '❌'} $${totalPnL.toFixed(2)}`);
      console.log(`   Total Profits: $${totalProfit.toFixed(2)}`);
      console.log(`   Total Losses: -$${totalLoss.toFixed(2)}`);
      console.log(`   Net Result: $${(totalProfit - totalLoss).toFixed(2)}\n`);

      console.log('🎯 Win/Loss Breakdown:');
      console.log(`   Winners: ${winners.length} (${((winners.length / trades.length) * 100).toFixed(1)}%)`);
      console.log(`   Losers: ${losers.length} (${((losers.length / trades.length) * 100).toFixed(1)}%)`);
      console.log(`   Breakeven: ${breakeven.length}\n`);

      if (winners.length > 0) {
        const avgWin = totalProfit / winners.length;
        const largestWin = Math.max(...winners.map(t => t.profit_loss || 0));
        console.log('💰 Winner Analysis:');
        console.log(`   Average Win: $${avgWin.toFixed(2)}`);
        console.log(`   Largest Win: $${largestWin.toFixed(2)}\n`);
      }

      if (losers.length > 0) {
        const avgLoss = totalLoss / losers.length;
        const largestLoss = Math.min(...losers.map(t => t.profit_loss || 0));
        console.log('📉 Loser Analysis:');
        console.log(`   Average Loss: -$${avgLoss.toFixed(2)}`);
        console.log(`   Largest Loss: $${largestLoss.toFixed(2)}\n`);
      }

      if (totalLoss > 0) {
        const profitFactor = totalProfit / totalLoss;
        console.log('📊 Performance Metrics:');
        console.log(`   Profit Factor: ${profitFactor.toFixed(2)} ${profitFactor > 1.5 ? '✅' : '⚠️'}`);
        console.log(`   Risk/Reward: 1:${(totalProfit / totalLoss).toFixed(2)}\n`);
      }

      // Strategy breakdown
      console.log('🎯 Strategy Performance:\n');
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

      Object.entries(strategies)
        .sort((a, b) => b[1].pnl - a[1].pnl)
        .forEach(([strategy, stats]) => {
          const winRate = ((stats.wins / stats.count) * 100).toFixed(1);
          console.log(`   ${strategy}:`);
          console.log(`      Trades: ${stats.count}`);
          console.log(`      Win Rate: ${winRate}%`);
          console.log(`      P&L: $${stats.pnl.toFixed(2)}`);
        });

      console.log('\n📝 Individual Trades:\n');
      trades.forEach((t, i) => {
        const profitSymbol = (t.profit_loss || 0) >= 0 ? '✅' : '❌';
        console.log(`   ${i + 1}. ${t.side?.toUpperCase()} ${t.strategy || 'unknown'}`);
        console.log(`      Time: ${new Date(t.created_at).toLocaleTimeString()}`);
        console.log(`      Entry: ${t.entry_price}`);
        console.log(`      Exit: ${t.exit_price || 'N/A'}`);
        console.log(`      P&L: ${profitSymbol} $${(t.profit_loss || 0).toFixed(2)}`);
        console.log('');
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 2. OPEN POSITIONS (from agent tracking file)
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 2: OPEN POSITIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    let openPositions = [];
    try {
      const agentFile = await fs.readFile('./data/agent-positions.json', 'utf8');
      openPositions = JSON.parse(agentFile);
    } catch (error) {
      console.log('ℹ️  No positions tracking file found\n');
    }

    console.log(`Total Open Positions: ${openPositions.length}\n`);

    if (openPositions.length === 0) {
      console.log('✅ No open positions (clean slate)\n');
    } else {
      openPositions.forEach((pos, i) => {
        const age = Date.now() - new Date(pos.entryTime).getTime();
        const ageHours = (age / 3600000).toFixed(1);
        const ageMinutes = (age / 60000).toFixed(0);

        console.log(`   Position ${i + 1}:`);
        console.log(`      ID: ${pos.positionId}`);
        console.log(`      Side: ${pos.side?.toUpperCase()}`);
        console.log(`      Entry: ${pos.entryPrice}`);
        console.log(`      Take Profit: ${pos.takeProfit}`);
        console.log(`      Stop Loss: ${pos.stopLoss}`);
        console.log(`      Size: ${pos.size}`);
        console.log(`      Age: ${ageHours}h (${ageMinutes} minutes)`);
        console.log(`      Strategy: ${pos.strategy || 'unknown'}`);
        console.log('');
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 3. SHADOW MODE ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 3: SHADOW MODE TRADING');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
      const shadowData = await fs.readFile('./data/shadow_trades.json', 'utf8');
      const shadowTrades = JSON.parse(shadowData);

      // Filter tonight's shadow trades
      const tonightShadow = shadowTrades.filter(t =>
        new Date(t.timestamp) >= tonightStart
      );

      console.log(`Total Shadow Trades Tonight: ${tonightShadow.length}\n`);

      if (tonightShadow.length > 0) {
        const shadowWinners = tonightShadow.filter(t => (t.profit || 0) > 0);
        const shadowPnL = tonightShadow.reduce((sum, t) => sum + (t.profit || 0), 0);
        const shadowWinRate = ((shadowWinners.length / tonightShadow.length) * 100).toFixed(1);

        console.log('👻 Shadow Performance:');
        console.log(`   Shadow P&L: $${shadowPnL.toFixed(2)}`);
        console.log(`   Shadow Win Rate: ${shadowWinRate}%`);
        console.log(`   Average Per Trade: $${(shadowPnL / tonightShadow.length).toFixed(2)}\n`);
      }
    } catch (error) {
      console.log('⚠️  Shadow trades file not found or empty\n');
    }

    // ═══════════════════════════════════════════════════════════
    // 4. BOT ACTIVITY LOG
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 4: BOT ACTIVITY');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
      const today = new Date().toISOString().split('T')[0];
      const logPath = `./logs/combined-${today}.log`;
      const logs = await fs.readFile(logPath, 'utf8');
      const logLines = logs.split('\n');

      // Count key events tonight
      const tonightLogs = logLines.filter(line => {
        try {
          const timestamp = line.match(/\d{2}:\d{2}:\d{2}/)?.[0];
          if (!timestamp) return false;
          const [hours, minutes] = timestamp.split(':').map(Number);
          const logTime = new Date();
          logTime.setHours(hours, minutes, 0, 0);
          return logTime >= tonightStart;
        } catch {
          return false;
        }
      });

      const aiDecisions = tonightLogs.filter(l => l.includes('AI Strategy executed')).length;
      const holdDecisions = tonightLogs.filter(l => l.includes('Action: hold')).length;
      const errors = tonightLogs.filter(l => l.includes('[error]')).length;
      const regimeChanges = tonightLogs.filter(l => l.includes('Detected:')).length;

      console.log('🤖 Bot Statistics:');
      console.log(`   AI Decisions Made: ${aiDecisions}`);
      console.log(`   HOLD Decisions: ${holdDecisions} (${((holdDecisions / Math.max(aiDecisions, 1)) * 100).toFixed(1)}%)`);
      console.log(`   Regime Changes: ${regimeChanges}`);
      console.log(`   Errors: ${errors} ${errors === 0 ? '✅' : '⚠️'}\n`);

      // Get latest regime
      const latestRegime = tonightLogs
        .filter(l => l.includes('Detected:'))
        .pop()
        ?.match(/Detected: (\w+)/)?.[1];

      if (latestRegime) {
        console.log(`📊 Current Regime: ${latestRegime}\n`);
      }

    } catch (error) {
      console.log('⚠️  Could not analyze logs\n');
    }

    // ═══════════════════════════════════════════════════════════
    // 5. RISK METRICS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 5: RISK ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
      const stateData = await fs.readFile('./data/bot-state.json', 'utf8');
      const state = JSON.parse(stateData);

      console.log('💼 Portfolio Status:');
      console.log(`   Portfolio Value: $${state.portfolioValue?.toFixed(2) || 'N/A'}`);
      console.log(`   Current Price: ${state.currentPrice || 'N/A'}`);
      console.log(`   Volatility: ${state.volatility?.toFixed(2) || 'N/A'}%`);
      console.log(`   Regime: ${state.regime || 'UNKNOWN'}`);
      console.log(`   Active Positions: ${state.activePositions || 0}\n`);

      if (trades.length > 0) {
        const maxDrawdown = Math.min(...trades.map(t => t.profit_loss || 0));
        const avgPositionSize = trades.reduce((sum, t) => sum + (t.size || 0), 0) / trades.length;

        console.log('🎯 Risk Metrics:');
        console.log(`   Max Drawdown Tonight: $${maxDrawdown.toFixed(2)}`);
        console.log(`   Avg Position Size: ${avgPositionSize.toFixed(4)}`);
        console.log(`   Risk Per Trade: ${((Math.abs(maxDrawdown) / state.portfolioValue) * 100).toFixed(2)}%\n`);
      }

    } catch (error) {
      console.log('⚠️  Could not load portfolio state\n');
    }

    // ═══════════════════════════════════════════════════════════
    // 6. SUMMARY & RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 6: SUMMARY & RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const insights = [];

    if (trades.length === 0) {
      insights.push({
        type: '✅ GOOD',
        message: 'No trades executed - bot correctly held during unfavorable conditions',
        recommendation: 'Continue monitoring for volatility increase'
      });
    } else {
      const winRate = (winners.length / trades.length) * 100;

      if (winRate >= 70) {
        insights.push({
          type: '✅ EXCELLENT',
          message: `Outstanding win rate of ${winRate.toFixed(1)}%`,
          recommendation: 'Current strategy working well - maintain approach'
        });
      } else if (winRate < 60) {
        insights.push({
          type: '⚠️ WARNING',
          message: `Win rate at ${winRate.toFixed(1)}% is below target`,
          recommendation: 'Consider raising confidence thresholds'
        });
      }

      if (totalPnL < 0) {
        insights.push({
          type: '❌ CONCERN',
          message: `Net loss of $${Math.abs(totalPnL).toFixed(2)} tonight`,
          recommendation: 'Review trade quality and strategy selection'
        });
      } else if (totalPnL > 0) {
        insights.push({
          type: '✅ SUCCESS',
          message: `Net profit of $${totalPnL.toFixed(2)} tonight`,
          recommendation: 'Analyze successful patterns for replication'
        });
      }
    }

    if (openPositions && openPositions.length > 0) {
      const oldestPosition = openPositions.reduce((oldest, pos) =>
        new Date(pos.entryTime || pos.created_at) < new Date(oldest.entryTime || oldest.created_at) ? pos : oldest
      );
      const age = Date.now() - new Date(oldestPosition.entryTime || oldestPosition.created_at).getTime();
      const ageHours = (age / 3600000).toFixed(1);

      if (age > 4 * 60 * 60 * 1000) { // > 4 hours
        insights.push({
          type: '⚠️ ATTENTION',
          message: `Oldest position is ${ageHours}h old`,
          recommendation: 'Consider reviewing exit conditions'
        });
      }
    }

    console.log('💡 Key Insights:\n');
    insights.forEach(insight => {
      console.log(`   ${insight.type}: ${insight.message}`);
      console.log(`      → ${insight.recommendation}\n`);
    });

    // Export audit report
    const report = {
      audit_time: now.toISOString(),
      period: {
        start: tonightStart.toISOString(),
        end: now.toISOString()
      },
      trades: {
        total: trades.length,
        winners: winners?.length || 0,
        losers: losers?.length || 0,
        win_rate: trades.length > 0 ? ((winners?.length || 0) / trades.length * 100).toFixed(2) : 0,
        total_pnl: totalPnL?.toFixed(2) || 0
      },
      positions: {
        open: openPositions?.length || 0,
        details: openPositions?.map(p => ({
          id: p.positionId || p.position_id,
          side: p.side,
          age_hours: ((Date.now() - new Date(p.entryTime || p.created_at).getTime()) / 3600000).toFixed(1)
        })) || []
      },
      insights: insights
    };

    await fs.mkdir('./reports', { recursive: true });
    await fs.writeFile(
      `./reports/audit-${now.toISOString().split('T')[0]}.json`,
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Audit report exported to: ./reports/audit-*.json\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                 AUDIT COMPLETE                            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run audit
auditTonight();
