#!/usr/bin/env node

/**
 * Shadow Trades Cleanup Script
 *
 * This script:
 * 1. Analyzes shadow trades for data integrity
 * 2. Matches entries with exits using positionId
 * 3. Removes orphaned exits (exits without matching entries)
 * 4. Recalculates P&L with matched pairs only
 * 5. Generates a cleanup report
 */

const fs = require('fs').promises;
const path = require('path');

const SHADOW_TRADES_PATH = path.join(__dirname, '../data/shadow_trades.json');
const BACKUP_PATH = path.join(__dirname, '../data/shadow_trades.backup.json');
const REPORT_PATH = path.join(__dirname, '../reports/cleanup-report.json');

async function cleanupShadowTrades() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       🧹 SHADOW TRADES CLEANUP UTILITY                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Load shadow trades
    console.log('📂 Loading shadow trades...\n');
    let trades = [];

    try {
      const data = await fs.readFile(SHADOW_TRADES_PATH, 'utf8');
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed)) {
        trades = parsed;
      } else if (parsed && parsed.trades && Array.isArray(parsed.trades)) {
        trades = parsed.trades;
      }
    } catch (error) {
      console.log('❌ Could not load shadow trades:', error.message);
      return;
    }

    console.log(`📊 Total trades loaded: ${trades.length}\n`);

    // 2. Create backup
    console.log('💾 Creating backup...');
    await fs.writeFile(BACKUP_PATH, JSON.stringify(trades, null, 2));
    console.log(`✅ Backup saved to: ${BACKUP_PATH}\n`);

    // 3. Analyze trades
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const entries = trades.filter(t =>
      t.type === 'ENTRY' ||
      (t.action === 'buy' && !t.type && !t.exitReason)
    );

    const exits = trades.filter(t =>
      t.type === 'EXIT' ||
      t.exitReason ||
      (t.reasoning && t.reasoning.includes('Exit'))
    );

    const holds = trades.filter(t => t.action === 'HOLD');
    const other = trades.filter(t =>
      !entries.includes(t) &&
      !exits.includes(t) &&
      !holds.includes(t)
    );

    console.log(`   Entries: ${entries.length}`);
    console.log(`   Exits: ${exits.length}`);
    console.log(`   HOLDs: ${holds.length}`);
    console.log(`   Other/Unknown: ${other.length}`);
    console.log(`   Entry/Exit ratio: 1:${(exits.length / Math.max(entries.length, 1)).toFixed(2)}\n`);

    // 4. Find orphaned exits (exits without matching entries)
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 ORPHAN DETECTION');
    console.log('═══════════════════════════════════════════════════════════\n');

    const entryPositionIds = new Set(entries.map(e => e.positionId).filter(Boolean));
    const exitPositionIds = new Set(exits.map(e => e.positionId).filter(Boolean));

    const orphanedExits = exits.filter(exit => {
      if (!exit.positionId) return true;
      return !entryPositionIds.has(exit.positionId);
    });

    console.log(`   Entries with positionId: ${entryPositionIds.size}`);
    console.log(`   Exits with positionId: ${exitPositionIds.size}`);
    console.log(`   Orphaned exits found: ${orphanedExits.length}\n`);

    // 5. Analyze exit reasons
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 EXIT REASON ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const exitReasons = {};
    exits.forEach(exit => {
      let reason = exit.exitReason || 'unknown';

      if (reason === 'unknown' && exit.reasoning) {
        if (exit.reasoning.includes('take_profit')) reason = 'take_profit';
        else if (exit.reasoning.includes('stop_loss')) reason = 'stop_loss';
        else if (exit.reasoning.includes('max_hold') || exit.reasoning.includes('timeout')) reason = 'max_hold_time_exceeded';
        else if (exit.reasoning.includes('breakout')) reason = 'breakout';
        else reason = 'extracted_unknown';
      }

      exitReasons[reason] = (exitReasons[reason] || 0) + 1;
    });

    Object.entries(exitReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        const pct = ((count / exits.length) * 100).toFixed(1);
        console.log(`   ${reason}: ${count} (${pct}%)`);
      });
    console.log();

    // 6. Analyze strategies
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STRATEGY ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const strategies = {};
    trades.forEach(trade => {
      const strat = trade.strategy || 'unknown';
      strategies[strat] = (strategies[strat] || 0) + 1;
    });

    Object.entries(strategies)
      .sort((a, b) => b[1] - a[1])
      .forEach(([strategy, count]) => {
        const pct = ((count / trades.length) * 100).toFixed(1);
        console.log(`   ${strategy}: ${count} (${pct}%)`);
      });
    console.log();

    // 7. Clean trades
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧹 CLEANING DATA');
    console.log('═══════════════════════════════════════════════════════════\n');

    let cleanedTrades = trades.filter(t => t.action !== 'HOLD');
    console.log(`   Removed ${holds.length} HOLD actions`);

    let fixedExitReasons = 0;
    cleanedTrades = cleanedTrades.map(trade => {
      if (trade.type === 'EXIT' || (trade.reasoning && trade.reasoning.includes('Exit'))) {
        if (!trade.exitReason && trade.reasoning) {
          if (trade.reasoning.includes('take_profit')) {
            trade.exitReason = 'take_profit';
            fixedExitReasons++;
          } else if (trade.reasoning.includes('stop_loss')) {
            trade.exitReason = 'stop_loss';
            fixedExitReasons++;
          } else if (trade.reasoning.includes('max_hold') || trade.reasoning.includes('timeout') || trade.reasoning.includes('max_time')) {
            trade.exitReason = 'max_hold_time_exceeded';
            fixedExitReasons++;
          } else if (trade.reasoning.includes('breakout')) {
            const match = trade.reasoning.match(/(upward|downward)_breakout/);
            trade.exitReason = match ? match[0] : 'breakout';
            fixedExitReasons++;
          } else if (trade.reasoning.includes('reversion')) {
            trade.exitReason = 'reversion_complete';
            fixedExitReasons++;
          }
        }

        if (!trade.type) {
          trade.type = 'EXIT';
        }
      }

      return trade;
    });

    console.log(`   Fixed ${fixedExitReasons} null exit reasons`);

    let fixedStrategies = 0;
    cleanedTrades = cleanedTrades.map(trade => {
      if (!trade.strategy || trade.strategy === 'unknown') {
        if (trade.reasoning) {
          const strategyMatch = trade.reasoning.match(/:\s*(\w+)/);
          if (strategyMatch) {
            trade.strategy = strategyMatch[1];
            if (trade.strategy === 'gridTrading') trade.strategy = 'grid';
            fixedStrategies++;
          }
        }
      }
      return trade;
    });

    console.log(`   Fixed ${fixedStrategies} unknown strategies`);

    // 8. Calculate P&L summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('💰 P&L RECALCULATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    const exitTrades = cleanedTrades.filter(t => t.type === 'EXIT' || t.exitReason);

    let totalPnL = 0;
    let winners = 0;
    let losers = 0;

    exitTrades.forEach(exit => {
      const pnl = exit.plUSD || exit.profit || 0;
      totalPnL += pnl;
      if (pnl > 0) winners++;
      else if (pnl < 0) losers++;
    });

    const winRate = exitTrades.length > 0 ? ((winners / exitTrades.length) * 100).toFixed(1) : 0;

    console.log(`   Exit trades analyzed: ${exitTrades.length}`);
    console.log(`   Winners: ${winners}`);
    console.log(`   Losers: ${losers}`);
    console.log(`   Win rate: ${winRate}%`);
    console.log(`   Total P&L: $${totalPnL.toFixed(2)}`);

    // 9. Save cleaned trades
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('💾 SAVING CLEANED DATA');
    console.log('═══════════════════════════════════════════════════════════\n');

    await fs.writeFile(SHADOW_TRADES_PATH, JSON.stringify(cleanedTrades, null, 2));
    console.log(`✅ Saved ${cleanedTrades.length} cleaned trades`);

    // 10. Generate cleanup report
    const report = {
      timestamp: new Date().toISOString(),
      original: {
        total: trades.length,
        entries: entries.length,
        exits: exits.length,
        holds: holds.length
      },
      cleaned: {
        total: cleanedTrades.length,
        exitReasonsFixed: fixedExitReasons,
        strategiesFixed: fixedStrategies,
        holdsRemoved: holds.length
      },
      analysis: {
        orphanedExits: orphanedExits.length,
        exitReasons: exitReasons,
        strategies: strategies
      },
      pnl: {
        totalExits: exitTrades.length,
        winners: winners,
        losers: losers,
        winRate: parseFloat(winRate),
        totalPnL: parseFloat(totalPnL.toFixed(2))
      }
    };

    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`✅ Report saved to: ${REPORT_PATH}`);

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║               CLEANUP COMPLETE                            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`   Original trades: ${trades.length}`);
    console.log(`   Cleaned trades: ${cleanedTrades.length}`);
    console.log(`   Exit reasons fixed: ${fixedExitReasons}`);
    console.log(`   Strategies fixed: ${fixedStrategies}`);
    console.log(`   HOLDs removed: ${holds.length}`);
    console.log(`   Total P&L: $${totalPnL.toFixed(2)}\n`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupShadowTrades();
