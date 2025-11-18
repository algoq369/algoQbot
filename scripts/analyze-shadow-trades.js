#!/usr/bin/env node

/**
 * Shadow Trades Deep Analysis
 * Analyzes all shadow trades to identify winning patterns
 */

const fs = require('fs').promises;
const path = require('path');

async function analyzeShadowTrades() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║         👻 SHADOW TRADES DEEP ANALYSIS                    ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Load shadow trades
    const shadowData = await fs.readFile('./data/shadow_trades.json', 'utf8');
    const allShadowTrades = JSON.parse(shadowData);

    console.log(`📊 Total Shadow Trades in Database: ${allShadowTrades.length}\n`);

    // Filter tonight's trades (last 12 hours)
    const now = new Date();
    const tonightStart = new Date(now.getTime() - (12 * 60 * 60 * 1000));

    const tonightTrades = allShadowTrades.filter(t =>
      new Date(t.timestamp) >= tonightStart
    );

    console.log(`🌙 Shadow Trades Tonight: ${tonightTrades.length}\n`);

    if (tonightTrades.length === 0) {
      console.log('⚠️  No shadow trades tonight\n');
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // 1. OVERALL PERFORMANCE
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 1: OVERALL SHADOW PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════\n');

    const winners = tonightTrades.filter(t => (t.profit || 0) > 0);
    const losers = tonightTrades.filter(t => (t.profit || 0) < 0);
    const breakeven = tonightTrades.filter(t => (t.profit || 0) === 0);

    const totalPnL = tonightTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalProfit = winners.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalLoss = Math.abs(losers.reduce((sum, t) => sum + (t.profit || 0), 0));

    const winRate = ((winners.length / tonightTrades.length) * 100).toFixed(1);

    console.log('💰 P&L Summary:');
    console.log(`   Total P&L: ${totalPnL >= 0 ? '✅' : '❌'} $${totalPnL.toFixed(2)}`);
    console.log(`   Total Profits: $${totalProfit.toFixed(2)}`);
    console.log(`   Total Losses: -$${totalLoss.toFixed(2)}\n`);

    console.log('🎯 Win/Loss Breakdown:');
    console.log(`   Winners: ${winners.length} (${winRate}%)`);
    console.log(`   Losers: ${losers.length} (${((losers.length / tonightTrades.length) * 100).toFixed(1)}%)`);
    console.log(`   Breakeven: ${breakeven.length}\n`);

    if (totalLoss > 0) {
      const profitFactor = totalProfit / totalLoss;
      const avgWin = winners.length > 0 ? totalProfit / winners.length : 0;
      const avgLoss = losers.length > 0 ? totalLoss / losers.length : 0;

      console.log('📊 Performance Metrics:');
      console.log(`   Profit Factor: ${profitFactor.toFixed(2)} ${profitFactor > 1.5 ? '✅' : '⚠️'}`);
      console.log(`   Average Win: $${avgWin.toFixed(2)}`);
      console.log(`   Average Loss: -$${avgLoss.toFixed(2)}`);
      if (avgLoss > 0) {
        console.log(`   Risk/Reward: 1:${(avgWin / avgLoss).toFixed(2)}\n`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 2. STRATEGY BREAKDOWN
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 2: STRATEGY PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════\n');

    const strategies = {};
    tonightTrades.forEach(t => {
      const strat = t.strategy || 'unknown';
      if (!strategies[strat]) {
        strategies[strat] = {
          trades: [],
          wins: 0,
          losses: 0,
          totalPnL: 0,
          avgProfit: 0,
          avgLoss: 0
        };
      }

      strategies[strat].trades.push(t);
      strategies[strat].totalPnL += (t.profit || 0);

      if ((t.profit || 0) > 0) {
        strategies[strat].wins++;
      } else if ((t.profit || 0) < 0) {
        strategies[strat].losses++;
      }
    });

    // Calculate averages
    Object.keys(strategies).forEach(strat => {
      const s = strategies[strat];
      const winningTrades = s.trades.filter(t => (t.profit || 0) > 0);
      const losingTrades = s.trades.filter(t => (t.profit || 0) < 0);

      s.avgProfit = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length
        : 0;

      s.avgLoss = losingTrades.length > 0
        ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length)
        : 0;

      s.winRate = ((s.wins / s.trades.length) * 100).toFixed(1);
    });

    // Sort by total P&L
    const sortedStrategies = Object.entries(strategies)
      .sort((a, b) => b[1].totalPnL - a[1].totalPnL);

    console.log('🎯 Strategy Rankings (by P&L):\n');

    sortedStrategies.forEach(([stratName, stats], index) => {
      const profitSymbol = stats.totalPnL >= 0 ? '✅' : '❌';

      console.log(`${index + 1}. ${stratName.toUpperCase()}`);
      console.log(`   Trades: ${stats.trades.length}`);
      console.log(`   Win Rate: ${stats.winRate}%`);
      console.log(`   Total P&L: ${profitSymbol} $${stats.totalPnL.toFixed(2)}`);
      console.log(`   Avg Win: $${stats.avgProfit.toFixed(2)}`);
      console.log(`   Avg Loss: -$${stats.avgLoss.toFixed(2)}`);

      if (stats.avgLoss > 0) {
        const rr = stats.avgProfit / stats.avgLoss;
        console.log(`   Risk/Reward: 1:${rr.toFixed(2)}`);
      }
      console.log('');
    });

    // ═══════════════════════════════════════════════════════════
    // 3. TIMING ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 3: TIMING ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const timeSlots = {
      'Night (12am-6am)': [],
      'Morning (6am-12pm)': [],
      'Afternoon (12pm-6pm)': [],
      'Evening (6pm-12am)': []
    };

    tonightTrades.forEach(t => {
      const hour = new Date(t.timestamp).getHours();

      if (hour >= 0 && hour < 6) {
        timeSlots['Night (12am-6am)'].push(t);
      } else if (hour >= 6 && hour < 12) {
        timeSlots['Morning (6am-12pm)'].push(t);
      } else if (hour >= 12 && hour < 18) {
        timeSlots['Afternoon (12pm-6pm)'].push(t);
      } else {
        timeSlots['Evening (6pm-12am)'].push(t);
      }
    });

    console.log('⏰ Performance by Time of Day:\n');

    Object.entries(timeSlots).forEach(([slot, trades]) => {
      if (trades.length === 0) {
        console.log(`${slot}: No trades\n`);
        return;
      }

      const slotWinners = trades.filter(t => (t.profit || 0) > 0);
      const slotPnL = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const slotWinRate = ((slotWinners.length / trades.length) * 100).toFixed(1);

      console.log(`${slot}:`);
      console.log(`   Trades: ${trades.length}`);
      console.log(`   Win Rate: ${slotWinRate}%`);
      console.log(`   P&L: $${slotPnL.toFixed(2)}`);
      console.log('');
    });

    // ═══════════════════════════════════════════════════════════
    // 4. CONFIDENCE SCORE ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 4: CONFIDENCE SCORE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const confidenceBuckets = {
      'Very High (85%+)': [],
      'High (75-85%)': [],
      'Medium (65-75%)': [],
      'Low (55-65%)': [],
      'Very Low (<55%)': []
    };

    tonightTrades.forEach(t => {
      const conf = (t.confidence || 0) * 100; // Convert to percentage

      if (conf >= 85) {
        confidenceBuckets['Very High (85%+)'].push(t);
      } else if (conf >= 75) {
        confidenceBuckets['High (75-85%)'].push(t);
      } else if (conf >= 65) {
        confidenceBuckets['Medium (65-75%)'].push(t);
      } else if (conf >= 55) {
        confidenceBuckets['Low (55-65%)'].push(t);
      } else {
        confidenceBuckets['Very Low (<55%)'].push(t);
      }
    });

    console.log('🎯 Win Rate by Confidence Level:\n');

    Object.entries(confidenceBuckets).forEach(([bucket, trades]) => {
      if (trades.length === 0) {
        console.log(`${bucket}: No trades\n`);
        return;
      }

      const bucketWinners = trades.filter(t => (t.profit || 0) > 0);
      const bucketWinRate = ((bucketWinners.length / trades.length) * 100).toFixed(1);
      const bucketPnL = trades.reduce((sum, t) => sum + (t.profit || 0), 0);

      console.log(`${bucket}:`);
      console.log(`   Trades: ${trades.length}`);
      console.log(`   Win Rate: ${bucketWinRate}%`);
      console.log(`   P&L: $${bucketPnL.toFixed(2)}`);
      console.log('');
    });

    // ═══════════════════════════════════════════════════════════
    // 5. POSITION SIZE ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 5: POSITION SIZE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const avgPositionSize = tonightTrades.reduce((sum, t) => sum + (t.size || 0), 0) / tonightTrades.length;
    const minPositionSize = Math.min(...tonightTrades.map(t => t.size || 0));
    const maxPositionSize = Math.max(...tonightTrades.map(t => t.size || 0));

    console.log('💼 Position Sizing Stats:');
    console.log(`   Average Size: ${avgPositionSize.toFixed(4)}`);
    console.log(`   Min Size: ${minPositionSize.toFixed(4)}`);
    console.log(`   Max Size: ${maxPositionSize.toFixed(4)}\n`);

    // Correlate position size with profitability
    const largePositions = tonightTrades.filter(t => (t.size || 0) > avgPositionSize);
    const smallPositions = tonightTrades.filter(t => (t.size || 0) <= avgPositionSize);

    const largeWinRate = largePositions.length > 0
      ? ((largePositions.filter(t => (t.profit || 0) > 0).length / largePositions.length) * 100).toFixed(1)
      : 0;

    const smallWinRate = smallPositions.length > 0
      ? ((smallPositions.filter(t => (t.profit || 0) > 0).length / smallPositions.length) * 100).toFixed(1)
      : 0;

    console.log('📊 Win Rate by Position Size:');
    console.log(`   Large Positions (>${avgPositionSize.toFixed(4)}): ${largeWinRate}% (${largePositions.length} trades)`);
    console.log(`   Small Positions (≤${avgPositionSize.toFixed(4)}): ${smallWinRate}% (${smallPositions.length} trades)\n`);

    // ═══════════════════════════════════════════════════════════
    // 6. KEY PATTERNS & INSIGHTS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 6: KEY PATTERNS & INSIGHTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const insights = [];

    // Best strategy
    const bestStrategy = sortedStrategies[0];
    if (bestStrategy && bestStrategy[1].totalPnL > 0) {
      insights.push({
        type: '✅ WINNING PATTERN',
        insight: `${bestStrategy[0]} strategy is top performer with $${bestStrategy[1].totalPnL.toFixed(2)} profit`,
        recommendation: `Focus on ${bestStrategy[0]} when conditions match`
      });
    }

    // Win rate analysis
    if (parseFloat(winRate) >= 70) {
      insights.push({
        type: '✅ HIGH WIN RATE',
        insight: `Shadow trades achieving ${winRate}% win rate (excellent)`,
        recommendation: 'These strategies are ready for live testing with small positions'
      });
    } else if (parseFloat(winRate) < 60) {
      insights.push({
        type: '⚠️ WIN RATE CONCERN',
        insight: `Shadow win rate at ${winRate}% (below 60% target)`,
        recommendation: 'Need to improve strategy selection or confidence thresholds'
      });
    }

    // Confidence correlation
    const highConfTrades = confidenceBuckets['Very High (85%+)'].concat(confidenceBuckets['High (75-85%)']);
    if (highConfTrades.length > 0) {
      const highConfWinners = highConfTrades.filter(t => (t.profit || 0) > 0);
      const highConfWinRate = ((highConfWinners.length / highConfTrades.length) * 100).toFixed(1);

      if (parseFloat(highConfWinRate) > parseFloat(winRate)) {
        insights.push({
          type: '💡 INSIGHT',
          insight: `High confidence trades (75%+) have ${highConfWinRate}% win rate vs ${winRate}% overall`,
          recommendation: 'Raising minimum confidence threshold would improve results'
        });
      }
    }

    // Position sizing
    if (parseFloat(largeWinRate) > parseFloat(smallWinRate) + 10) {
      insights.push({
        type: '💡 INSIGHT',
        insight: `Larger positions have ${largeWinRate}% win rate vs ${smallWinRate}% for smaller positions`,
        recommendation: 'System is correctly sizing larger on better setups'
      });
    } else if (parseFloat(smallWinRate) > parseFloat(largeWinRate) + 10) {
      insights.push({
        type: '⚠️ WARNING',
        insight: `Smaller positions outperform larger ones (${smallWinRate}% vs ${largeWinRate}%)`,
        recommendation: 'Review position sizing logic - may be oversizing marginal trades'
      });
    }

    console.log('💡 Key Insights:\n');
    insights.forEach(insight => {
      console.log(`${insight.type}:`);
      console.log(`   ${insight.insight}`);
      console.log(`   → ${insight.recommendation}\n`);
    });

    // ═══════════════════════════════════════════════════════════
    // 7. DETAILED TRADE LOG
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 7: DETAILED TRADE LOG (Last 10)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const recentTrades = tonightTrades.slice(-10).reverse();

    recentTrades.forEach((trade, index) => {
      const profitSymbol = (trade.profit || 0) >= 0 ? '✅' : '❌';
      const time = new Date(trade.timestamp).toLocaleTimeString();

      console.log(`${index + 1}. ${trade.side?.toUpperCase()} - ${trade.strategy || 'unknown'}`);
      console.log(`   Time: ${time}`);
      console.log(`   Confidence: ${((trade.confidence || 0) * 100).toFixed(1)}%`);
      console.log(`   Size: ${(trade.size || 0).toFixed(4)}`);
      console.log(`   Entry: ${trade.entryPrice}`);
      console.log(`   Exit: ${trade.exitPrice || 'N/A'}`);
      console.log(`   P&L: ${profitSymbol} $${(trade.profit || 0).toFixed(2)}`);
      console.log('');
    });

    // Export analysis
    const analysis = {
      analysis_time: new Date().toISOString(),
      total_trades: tonightTrades.length,
      performance: {
        win_rate: parseFloat(winRate),
        total_pnl: totalPnL,
        profit_factor: totalLoss > 0 ? (totalProfit / totalLoss) : 0
      },
      strategies: Object.fromEntries(
        sortedStrategies.map(([name, stats]) => [name, {
          trades: stats.trades.length,
          win_rate: parseFloat(stats.winRate),
          total_pnl: stats.totalPnL
        }])
      ),
      insights: insights,
      best_strategy: bestStrategy ? bestStrategy[0] : null
    };

    await fs.mkdir('./reports', { recursive: true });
    await fs.writeFile(
      `./reports/shadow-analysis-${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(analysis, null, 2)
    );

    console.log('✅ Analysis exported to: ./reports/shadow-analysis-*.json\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║             SHADOW TRADES ANALYSIS COMPLETE               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.error(error.stack);
  }
}

analyzeShadowTrades();
