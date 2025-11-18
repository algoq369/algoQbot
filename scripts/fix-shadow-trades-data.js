#!/usr/bin/env node

/**
 * Shadow Trades Data Fix Script
 * Re-processes existing shadow trades to add missing fields:
 * - strategy (extracted from reasoning)
 * - size (token amount)
 * - sizeUSD (USD amount)
 * - Removes HOLD actions
 */

const fs = require('fs').promises;
const path = require('path');

async function fixShadowTradesData() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║         🔧 SHADOW TRADES DATA FIX                         ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const tradesFile = './data/shadow_trades.json';
    const backupFile = './data/shadow_trades-backup.json';

    // Read existing trades
    console.log('📂 Loading shadow trades...');
    const data = await fs.readFile(tradesFile, 'utf8');
    let trades = JSON.parse(data);

    console.log(`✅ Loaded ${trades.length} trades\n`);

    // Create backup
    console.log('💾 Creating backup...');
    await fs.writeFile(backupFile, JSON.stringify(trades, null, 2));
    console.log(`✅ Backup saved: ${backupFile}\n`);

    // Process each trade
    console.log('🔧 Processing trades...\n');

    let holdCount = 0;
    let fixedCount = 0;

    const fixedTrades = [];

    for (const trade of trades) {
      // Skip HOLD actions
      if (trade.action === 'HOLD') {
        holdCount++;
        continue;
      }

      // Extract strategy from reasoning
      let strategy = trade.strategy || 'unknown';
      if (trade.reasoning && strategy === 'unknown') {
        // Parse strategy from reasoning: "Exit downward_breakout: ranging" -> "ranging"
        const strategyMatch = trade.reasoning.match(/:\s*(\w+)/);
        if (strategyMatch) {
          strategy = strategyMatch[1];
        }
        // Also check for common strategy names directly in reasoning
        const strategyKeywords = ['ranging', 'momentum', 'mean_reversion', 'grid', 'breakout'];
        for (const keyword of strategyKeywords) {
          if (trade.reasoning.toLowerCase().includes(keyword)) {
            strategy = keyword;
            break;
          }
        }
      }

      // Calculate position sizes if missing
      const sizeUSD = trade.sizeUSD || trade.amount || 0;
      const currentPrice = trade.targetPrice || 0.00088;
      const sizeToken = trade.size || (trade.action === 'buy' ? (sizeUSD * currentPrice) : sizeUSD);

      // Create fixed trade record
      const fixedTrade = {
        ...trade,
        strategy: strategy,
        size: sizeToken,
        sizeUSD: sizeUSD
      };

      fixedTrades.push(fixedTrade);

      if (strategy !== 'unknown') {
        fixedCount++;
      }
    }

    console.log(`📊 Results:`);
    console.log(`   Original trades: ${trades.length}`);
    console.log(`   HOLD actions removed: ${holdCount}`);
    console.log(`   Trades with strategy extracted: ${fixedCount}`);
    console.log(`   Final trades: ${fixedTrades.length}\n`);

    // Show sample before/after
    if (trades.length > 0 && fixedTrades.length > 0) {
      const originalSample = trades.find(t => t.action !== 'HOLD');
      const fixedSample = fixedTrades[0];

      console.log('═══════════════════════════════════════════════════════════');
      console.log('📝 SAMPLE COMPARISON');
      console.log('═══════════════════════════════════════════════════════════\n');

      console.log('❌ Original:');
      console.log(JSON.stringify({
        action: originalSample.action,
        strategy: originalSample.strategy || '(missing)',
        size: originalSample.size || '(missing)',
        sizeUSD: originalSample.sizeUSD || '(missing)',
        reasoning: originalSample.reasoning
      }, null, 2));
      console.log('');

      console.log('✅ Fixed:');
      console.log(JSON.stringify({
        action: fixedSample.action,
        strategy: fixedSample.strategy,
        size: fixedSample.size.toFixed(6),
        sizeUSD: fixedSample.sizeUSD.toFixed(2),
        reasoning: fixedSample.reasoning
      }, null, 2));
      console.log('');
    }

    // Save fixed trades
    console.log('💾 Saving fixed trades...');
    await fs.writeFile(tradesFile, JSON.stringify(fixedTrades, null, 2));
    console.log(`✅ Saved ${fixedTrades.length} fixed trades\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STRATEGY BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Count strategies
    const strategyCounts = {};
    for (const trade of fixedTrades) {
      strategyCounts[trade.strategy] = (strategyCounts[trade.strategy] || 0) + 1;
    }

    for (const [strategy, count] of Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${strategy}: ${count} trades`);
    }
    console.log('');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║             DATA FIX COMPLETE                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('✅ Next step: Run analyze-shadow-trades.js again to see fixed data\n');

  } catch (error) {
    console.error('❌ Error fixing shadow trades data:', error);
    process.exit(1);
  }
}

fixShadowTradesData();
