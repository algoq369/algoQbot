#!/usr/bin/env node

/**
 * Deep Shadow Trade Analysis
 * Extracts maximum insights to guide config adjustments
 */

const fs = require('fs').promises;

async function deepAnalysis() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║         🔍 DEEP SHADOW TRADE ANALYSIS                     ║');
    console.log('║         Configuration Optimization Report                 ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Load shadow trades
    const data = await fs.readFile('./data/shadow_trades.json', 'utf8');
    const trades = JSON.parse(data);

    console.log(`📊 Analyzing ${trades.length} shadow trades...\n`);

    // Load current config
    const config = require('../config');

    // ═══════════════════════════════════════════════════════════
    // 1. STRATEGY EXIT PATTERN ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SECTION 1: STRATEGY EXIT PATTERNS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const strategies = {};

    trades.forEach(t => {
      const strat = t.strategy || 'unknown';
      if (!strategies[strat]) {
        strategies[strat] = {
          total: 0,
          exitReasons: {
            stop_loss: 0,
            take_profit: 0,
            max_hold_time_exceeded: 0,
            emergency_time: 0,
            breakout: 0,
            downward_breakout: 0,
            upward_breakout: 0,
            reversion_complete: 0
          },
          avgSize: 0,
          totalSize: 0,
          avgConfidence: 0,
          totalConfidence: 0,
          hours: []
        };
      }

      strategies[strat].total++;

      // Parse exit reason from reasoning
      const reasoning = t.reasoning || '';
      if (reasoning.includes('stop_loss')) strategies[strat].exitReasons.stop_loss++;
      else if (reasoning.includes('take_profit')) strategies[strat].exitReasons.take_profit++;
      else if (reasoning.includes('max_hold_time')) strategies[strat].exitReasons.max_hold_time_exceeded++;
      else if (reasoning.includes('downward_breakout')) strategies[strat].exitReasons.downward_breakout++;
      else if (reasoning.includes('upward_breakout')) strategies[strat].exitReasons.upward_breakout++;
      else if (reasoning.includes('emergency')) strategies[strat].exitReasons.emergency_time++;

      strategies[strat].totalSize += (t.sizeUSD || 0);
      strategies[strat].totalConfidence += (t.confidence || 0) * 100;
      strategies[strat].hours.push(new Date(t.timestamp).getHours());
    });

    // Calculate averages
    Object.keys(strategies).forEach(strat => {
      const s = strategies[strat];
      s.avgSize = s.totalSize / s.total;
      s.avgConfidence = s.totalConfidence / s.total;
    });

    // Sort by frequency
    const sortedStrategies = Object.entries(strategies)
      .sort((a, b) => b[1].total - a[1].total);

    console.log('🎯 Strategy Usage & Exit Patterns:\n');

    sortedStrategies.forEach(([stratName, stats]) => {
      const pct = ((stats.total / trades.length) * 100).toFixed(1);

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`\n${stratName.toUpperCase()}`);
      console.log(`Usage: ${stats.total} trades (${pct}%)`);
      console.log(`Avg Size: $${stats.avgSize.toFixed(2)}`);
      console.log(`Avg Confidence: ${stats.avgConfidence.toFixed(1)}%\n`);

      console.log('Exit Reasons:');
      const sortedReasons = Object.entries(stats.exitReasons)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

      sortedReasons.forEach(([reason, count]) => {
        const reasonPct = ((count / stats.total) * 100).toFixed(1);
        const symbol = reason === 'take_profit' ? '✅' :
                      reason === 'stop_loss' ? '❌' : '⚠️';
        console.log(`   ${symbol} ${reason}: ${count} (${reasonPct}%)`);
      });

      console.log('');
    });

    // ═══════════════════════════════════════════════════════════
    // 2. PROBLEM IDENTIFICATION
    // ═══════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚠️  SECTION 2: IDENTIFIED PROBLEMS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const problems = [];

    // Analyze each strategy
    sortedStrategies.forEach(([stratName, stats]) => {
      const stopLossRate = (stats.exitReasons.stop_loss / stats.total) * 100;
      const maxHoldRate = (stats.exitReasons.max_hold_time_exceeded / stats.total) * 100;
      const takeProfitRate = (stats.exitReasons.take_profit / stats.total) * 100;
      const breakoutRate = ((stats.exitReasons.downward_breakout + stats.exitReasons.upward_breakout) / stats.total) * 100;

      // Problem: High stop loss rate
      if (stopLossRate > 50) {
        problems.push({
          strategy: stratName,
          severity: 'HIGH',
          issue: `${stopLossRate.toFixed(1)}% of exits are stop losses`,
          cause: 'Stop loss too tight OR poor entry timing',
          impact: 'Cutting positions short, not letting strategy work',
          recommendation: `Widen ${stratName} stop loss by 50% (current likely 1.5%, try 2.25%)`
        });
      }

      // Problem: High max hold time
      if (maxHoldRate > 50) {
        problems.push({
          strategy: stratName,
          severity: 'HIGH',
          issue: `${maxHoldRate.toFixed(1)}% of exits hit max hold time`,
          cause: 'Take profit too far OR not enough volatility',
          impact: 'Tying up capital in dead positions',
          recommendation: `Reduce ${stratName} take profit by 30% (if current is 3.5%, try 2.5%)`
        });
      }

      // Problem: Low take profit rate
      if (takeProfitRate < 10 && stats.total > 5) {
        problems.push({
          strategy: stratName,
          severity: 'MEDIUM',
          issue: `Only ${takeProfitRate.toFixed(1)}% of exits are take profits`,
          cause: 'Take profit target unrealistic for current volatility',
          impact: 'Never capturing planned profits',
          recommendation: `Lower ${stratName} take profit target or disable in low volatility`
        });
      }

      // Problem: Strategy overuse
      const usagePct = (stats.total / trades.length) * 100;
      if (usagePct > 50 && stopLossRate > 60) {
        problems.push({
          strategy: stratName,
          severity: 'CRITICAL',
          issue: `${usagePct.toFixed(1)}% of trades using underperforming strategy`,
          cause: 'Strategy selection algorithm favoring wrong strategy',
          impact: 'Majority of trades failing',
          recommendation: `Reduce ${stratName} confidence threshold or improve entry conditions`
        });
      }

      // Highlight breakout exits
      if (breakoutRate > 30) {
        problems.push({
          strategy: stratName,
          severity: 'INFO',
          issue: `${breakoutRate.toFixed(1)}% exits on breakouts`,
          cause: 'Strategy designed to exit on range breaks',
          impact: 'Expected behavior for ranging strategy',
          recommendation: 'Monitor if breakouts are profitable or loss-making'
        });
      }
    });

    // Display problems
    if (problems.length === 0) {
      console.log('✅ No critical problems identified!\n');
    } else {
      problems.forEach((prob, i) => {
        const sevSymbol = prob.severity === 'CRITICAL' ? '🚨' :
                         prob.severity === 'HIGH' ? '⚠️' :
                         prob.severity === 'INFO' ? 'ℹ️' : '⚡';

        console.log(`${sevSymbol} PROBLEM #${i + 1}: ${prob.strategy.toUpperCase()}`);
        console.log(`   Severity: ${prob.severity}`);
        console.log(`   Issue: ${prob.issue}`);
        console.log(`   Cause: ${prob.cause}`);
        console.log(`   Impact: ${prob.impact}`);
        console.log(`   → Recommendation: ${prob.recommendation}\n`);
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 3. TIME-OF-DAY ANALYSIS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('⏰ SECTION 3: TIME-OF-DAY PATTERNS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const timeSlots = {
      'Late Night (00-03)': { trades: [], hours: [0, 1, 2] },
      'Early Morning (03-06)': { trades: [], hours: [3, 4, 5] },
      'Morning (06-09)': { trades: [], hours: [6, 7, 8] },
      'Late Morning (09-12)': { trades: [], hours: [9, 10, 11] },
      'Afternoon (12-15)': { trades: [], hours: [12, 13, 14] },
      'Late Afternoon (15-18)': { trades: [], hours: [15, 16, 17] },
      'Evening (18-21)': { trades: [], hours: [18, 19, 20] },
      'Night (21-24)': { trades: [], hours: [21, 22, 23] }
    };

    trades.forEach(t => {
      const hour = new Date(t.timestamp).getHours();
      Object.entries(timeSlots).forEach(([slot, data]) => {
        if (data.hours.includes(hour)) {
          data.trades.push(t);
        }
      });
    });

    console.log('📊 Exit Distribution by Time:\n');

    Object.entries(timeSlots)
      .filter(([_, data]) => data.trades.length > 0)
      .sort((a, b) => b[1].trades.length - a[1].trades.length)
      .forEach(([slot, data]) => {
        const pct = ((data.trades.length / trades.length) * 100).toFixed(1);

        // Calculate exit reasons for this time
        const stopLosses = data.trades.filter(t =>
          t.reasoning?.includes('stop_loss')
        ).length;
        const stopLossPct = ((stopLosses / data.trades.length) * 100).toFixed(1);

        console.log(`${slot}: ${data.trades.length} trades (${pct}%)`);
        console.log(`   Stop Loss Rate: ${stopLossPct}%`);

        // Strategy distribution
        const stratCounts = {};
        data.trades.forEach(t => {
          const strat = t.strategy || 'unknown';
          stratCounts[strat] = (stratCounts[strat] || 0) + 1;
        });
        console.log(`   Strategies: ${Object.entries(stratCounts)
          .map(([s, c]) => `${s}(${c})`)
          .join(', ')}`);
        console.log('');
      });

    // ═══════════════════════════════════════════════════════════
    // 4. CONFIGURATION RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 SECTION 4: CONFIGURATION ADJUSTMENTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📝 Recommended config.js Changes:\n');

    const recommendations = [];

    // Grid strategy adjustments
    if (strategies.grid || strategies.gridTrading) {
      const gridStats = strategies.grid || strategies.gridTrading;
      const gridStopLossRate = (gridStats.exitReasons.stop_loss / gridStats.total) * 100;
      const gridMaxHoldRate = (gridStats.exitReasons.max_hold_time_exceeded / gridStats.total) * 100;

      if (gridStopLossRate > 60) {
        recommendations.push({
          section: 'Grid Trading Strategy',
          current: 'Stop Loss: ~1.5% (estimated)',
          recommended: 'Stop Loss: 2.25-2.5%',
          reason: `${gridStopLossRate.toFixed(1)}% stop loss rate indicates stops are too tight`,
          configPath: 'config.trading.gridTrading.stopLoss',
          value: 0.025
        });

        recommendations.push({
          section: 'Grid Trading Strategy',
          current: 'Grid Levels: 10 (estimated)',
          recommended: 'Grid Levels: 7-8',
          reason: 'Fewer, wider grid levels reduce stop-out frequency',
          configPath: 'config.trading.gridTrading.levels',
          value: 8
        });
      }

      if (gridMaxHoldRate > 20) {
        recommendations.push({
          section: 'Grid Trading Strategy',
          current: 'Max Hold Time: 24 hours',
          recommended: 'Max Hold Time: 18 hours',
          reason: `${gridMaxHoldRate.toFixed(1)}% hitting max hold - positions not resolving`,
          configPath: 'config.trading.gridTrading.maxHoldTime',
          value: 64800000 // 18 hours in ms
        });
      }
    }

    // Momentum strategy adjustments
    if (strategies.momentum) {
      const momentumMaxHold = (strategies.momentum.exitReasons.max_hold_time_exceeded / strategies.momentum.total) * 100;
      if (momentumMaxHold > 80) {
        recommendations.push({
          section: 'Momentum Strategy',
          current: 'Take Profit: 3.5%',
          recommended: 'Take Profit: 2.5%',
          reason: `${momentumMaxHold.toFixed(1)}% hit max hold time - not capturing profits`,
          configPath: 'config.trading.momentum.takeProfit',
          value: 0.025
        });

        recommendations.push({
          section: 'Momentum Strategy',
          current: 'Max Hold Time: 24 hours',
          recommended: 'Max Hold Time: 12 hours',
          reason: 'Faster exit of non-performing positions',
          configPath: 'config.trading.momentum.maxHoldTime',
          value: 43200000 // 12 hours in ms
        });
      }
    }

    // Ranging strategy - analyze breakout behavior
    if (strategies.ranging) {
      const rangingBreakouts = strategies.ranging.exitReasons.downward_breakout + strategies.ranging.exitReasons.upward_breakout;
      const breakoutRate = (rangingBreakouts / strategies.ranging.total) * 100;

      if (breakoutRate > 50) {
        recommendations.push({
          section: 'Ranging Strategy',
          current: 'Breakout Detection: Standard',
          recommended: 'Breakout Detection: More Conservative',
          reason: `${breakoutRate.toFixed(1)}% exits on breakouts - may be too sensitive`,
          configPath: 'config.trading.ranging.breakoutThreshold',
          value: 1.5 // Increase threshold
        });
      }
    }

    // Position sizing validation
    const avgSize = trades.reduce((sum, t) => sum + (t.sizeUSD || 0), 0) / trades.length;
    const portfolioValue = 56400; // Current portfolio
    const avgSizePercent = (avgSize / portfolioValue) * 100;

    console.log(`📊 Position Sizing Analysis:`);
    console.log(`   Current Avg: $${avgSize.toFixed(2)} (${avgSizePercent.toFixed(2)}% of portfolio)`);
    console.log(`   Assessment: ${avgSizePercent < 3 ? '✅ Conservative (good)' : avgSizePercent < 5 ? '⚠️ Moderate' : '❌ Aggressive'}`);

    if (avgSizePercent > 3) {
      recommendations.push({
        section: 'Position Sizing',
        current: `${avgSizePercent.toFixed(2)}% per trade`,
        recommended: '2-3% per trade',
        reason: 'Current sizing slightly aggressive for shadow mode testing',
        configPath: 'config.positionSizing.medium',
        value: 0.03
      });
    }
    console.log('');

    // Display recommendations
    if (recommendations.length === 0) {
      console.log('✅ Current configuration appears optimal based on available data!\n');
    } else {
      recommendations.forEach((rec, i) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`\n🔧 CHANGE #${i + 1}: ${rec.section}`);
        console.log(`   Current: ${rec.current}`);
        console.log(`   Recommended: ${rec.recommended}`);
        console.log(`   Reason: ${rec.reason}`);
        console.log(`   Config Path: ${rec.configPath}`);
        console.log(`   New Value: ${rec.value}\n`);
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 5. GENERATE CONFIG PATCH
    // ═══════════════════════════════════════════════════════════

    if (recommendations.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📄 SECTION 5: CONFIGURATION PATCH');
      console.log('═══════════════════════════════════════════════════════════\n');

      console.log('Copy these changes to config.js:\n');
      console.log('```javascript');
      console.log('// ═══════════════════════════════════════════════════════════');
      console.log('// OPTIMIZATIONS BASED ON SHADOW TRADE ANALYSIS');
      console.log('// Date: ' + new Date().toISOString().split('T')[0]);
      console.log('// Analyzed: ' + trades.length + ' shadow trades');
      console.log('// ═══════════════════════════════════════════════════════════\n');

      recommendations.forEach(rec => {
        console.log(`// ${rec.section}: ${rec.reason}`);
        console.log(`${rec.configPath} = ${JSON.stringify(rec.value)};\n`);
      });

      console.log('```\n');
    }

    // ═══════════════════════════════════════════════════════════
    // 6. SUMMARY & ACTION PLAN
    // ═══════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 SECTION 6: ACTION PLAN');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🎯 Recommended Actions (in order):\n');

    const actions = [];

    // Build action plan from problems
    if (strategies.grid || strategies.gridTrading) {
      const gridStats = strategies.grid || strategies.gridTrading;
      const gridStopLossRate = (gridStats.exitReasons.stop_loss / gridStats.total) * 100;

      if (gridStopLossRate > 60) {
        actions.push({
          priority: 1,
          action: 'Fix Grid Strategy Stop Loss',
          details: `Widen from 1.5% to 2.25% to reduce ${gridStopLossRate.toFixed(1)}% stop-out rate`,
          impact: `HIGH - Grid is ${((gridStats.total / trades.length) * 100).toFixed(1)}% of trades`
        });
      }
    }

    if (strategies.momentum) {
      const momentumMaxHold = (strategies.momentum.exitReasons.max_hold_time_exceeded / strategies.momentum.total) * 100;

      if (momentumMaxHold > 80) {
        actions.push({
          priority: 2,
          action: 'Reduce Momentum Take Profit',
          details: 'Lower from 3.5% to 2.5% to capture profits before max hold time',
          impact: `MEDIUM - Momentum is ${((strategies.momentum.total / trades.length) * 100).toFixed(1)}% of trades`
        });
      }
    }

    actions.push({
      priority: actions.length + 1,
      action: 'Implement Full P&L Tracking',
      details: 'Add entry logging to calculate actual profitability',
      impact: 'HIGH - Enables win rate measurement'
    });

    actions.forEach(action => {
      console.log(`${action.priority}. ${action.action}`);
      console.log(`   Details: ${action.details}`);
      console.log(`   Impact: ${action.impact}\n`);
    });

    // Export analysis
    const analysis = {
      analysis_date: new Date().toISOString(),
      trades_analyzed: trades.length,
      strategies: Object.fromEntries(
        sortedStrategies.map(([name, stats]) => [name, {
          usage_percent: ((stats.total / trades.length) * 100).toFixed(1),
          exit_reasons: stats.exitReasons,
          avg_size: stats.avgSize,
          avg_confidence: stats.avgConfidence
        }])
      ),
      problems: problems,
      recommendations: recommendations,
      action_plan: actions
    };

    await fs.mkdir('./reports', { recursive: true });
    await fs.writeFile(
      './reports/shadow-deep-analysis.json',
      JSON.stringify(analysis, null, 2)
    );

    console.log('✅ Analysis exported to: ./reports/shadow-deep-analysis.json\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         DEEP ANALYSIS COMPLETE                            ║');
    console.log('║                                                           ║');
    console.log('║   Next: Apply config changes and restart bot              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.error(error.stack);
  }
}

deepAnalysis();
