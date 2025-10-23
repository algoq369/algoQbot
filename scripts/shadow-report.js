#!/usr/bin/env node

/**
 * Shadow Mode Performance Report Generator
 * Analyzes shadow trade data and generates comprehensive metrics
 */

const fs = require('fs');
const path = require('path');

// Find all shadow trade files
// Default: only current data file. Use --all flag to include historical backups.
const showAll = process.argv.includes('--all');

const shadowFiles = showAll ? [
  path.join(__dirname, '../data/shadow_trades.json'),
  path.join(__dirname, '../data/shadow-trades.json'),
  path.join(__dirname, '../.shadow-trades.json'),
  path.join(__dirname, '../.shadow-trades-BEFORE-IMPROVEMENTS.json'),
  path.join(__dirname, '../.shadow-trades-OLD-MISLEADING.json')
] : [
  path.join(__dirname, '../data/shadow_trades.json')
];

console.log('═══════════════════════════════════════════════════════════');
console.log('          📊 SHADOW MODE PERFORMANCE REPORT');
console.log('═══════════════════════════════════════════════════════════\n');

let allTrades = [];
let fileStats = [];

// Normalize trade structure (handle old and new formats)
function normalizeTrade(trade) {
  // Old format: { params: { action, confidence, reasoning }, timestamp (number) }
  // New format: { action, confidence, reasoning, timestamp (ISO string) }
  return {
    action: trade.action || trade.params?.action,
    confidence: trade.confidence || trade.params?.confidence || 0,
    reasoning: trade.reasoning || trade.params?.reasoning || '',
    amount: trade.amount || trade.params?.amount || 0,
    timestamp: trade.timestamp,
    balances: trade.balances
  };
}

// Load all shadow trade files
for (const filePath of shadowFiles) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      // Handle both formats:
      // 1. Direct array: [{trade1}, {trade2}, ...]
      // 2. Wrapper object: { trades: [{trade1}, {trade2}, ...] }
      let trades = Array.isArray(data) ? data : data.trades;

      if (Array.isArray(trades) && trades.length > 0) {
        const fileName = path.basename(filePath);
        const fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);

        fileStats.push({
          file: fileName,
          size: fileSize,
          trades: trades.length
        });

        // Normalize trades before adding them
        const normalizedTrades = trades.map(normalizeTrade);
        allTrades = allTrades.concat(normalizedTrades);
      }
    } catch (error) {
      // Skip invalid JSON files
    }
  }
}

if (allTrades.length === 0) {
  console.log('❌ No shadow trade data found!\n');
  console.log('Searched in:');
  shadowFiles.forEach(f => console.log(`   - ${f}`));
  process.exit(1);
}

// Display file statistics
console.log('📁 DATA FILES:');
console.log('─'.repeat(60));
fileStats.forEach(stat => {
  console.log(`   ${stat.file}`);
  console.log(`      Trades: ${stat.trades} | Size: ${stat.fileSize} KB`);
});
console.log('');

// Calculate statistics
const totalTrades = allTrades.length;
const buyTrades = allTrades.filter(t => t.action === 'buy').length;
const sellTrades = allTrades.filter(t => t.action === 'sell').length;

// Get unique dates
const dates = [...new Set(allTrades.map(t => new Date(t.timestamp).toDateString()))];
const firstTrade = new Date(allTrades[0].timestamp);
const lastTrade = new Date(allTrades[allTrades.length - 1].timestamp);
const daysTrading = Math.ceil((lastTrade - firstTrade) / (1000 * 60 * 60 * 24));

// Confidence statistics
const avgConfidence = (allTrades.reduce((sum, t) => sum + (t.confidence || 0), 0) / totalTrades * 100).toFixed(1);
const highConfidenceTrades = allTrades.filter(t => (t.confidence || 0) >= 0.8).length;

console.log('📊 OVERALL STATISTICS:');
console.log('─'.repeat(60));
console.log(`   Total Trades: ${totalTrades}`);
console.log(`   Buy Trades: ${buyTrades} (${(buyTrades/totalTrades*100).toFixed(1)}%)`);
console.log(`   Sell Trades: ${sellTrades} (${(sellTrades/totalTrades*100).toFixed(1)}%)`);
console.log('');
console.log(`   Trading Period: ${daysTrading} days`);
console.log(`   First Trade: ${firstTrade.toLocaleString()}`);
console.log(`   Last Trade: ${lastTrade.toLocaleString()}`);
console.log(`   Avg Trades/Day: ${(totalTrades/Math.max(daysTrading, 1)).toFixed(1)}`);
console.log('');
console.log(`   Avg Confidence: ${avgConfidence}%`);
console.log(`   High Confidence (≥80%): ${highConfidenceTrades} (${(highConfidenceTrades/totalTrades*100).toFixed(1)}%)`);
console.log('');

// Strategy breakdown
console.log('🎯 STRATEGY BREAKDOWN:');
console.log('─'.repeat(60));
const strategies = {};
allTrades.forEach(t => {
  if (t.reasoning) {
    let strategy = 'unknown';
    if (t.reasoning.includes('Mean reversion')) strategy = 'mean_reversion';
    else if (t.reasoning.includes('momentum')) strategy = 'momentum';
    else if (t.reasoning.includes('ranging')) strategy = 'ranging';
    else if (t.reasoning.includes('WEAK')) strategy = 'weak_signal';

    strategies[strategy] = (strategies[strategy] || 0) + 1;
  }
});

Object.entries(strategies)
  .sort((a, b) => b[1] - a[1])
  .forEach(([strategy, count]) => {
    console.log(`   ${strategy.replace('_', ' ').toUpperCase()}: ${count} (${(count/totalTrades*100).toFixed(1)}%)`);
  });

console.log('');

// Balance analysis (if available)
const finalBalances = allTrades[allTrades.length - 1]?.balances;
if (finalBalances) {
  console.log('💰 FINAL BALANCES (from last trade):');
  console.log('─'.repeat(60));
  console.log(`   USDT: ${finalBalances.usdt?.toFixed(2) || 'N/A'}`);
  console.log(`   BNB: ${finalBalances.bnb?.toFixed(2) || 'N/A'}`);
  console.log('');
}

// Recent trades
console.log('📅 RECENT TRADES (Last 5):');
console.log('─'.repeat(60));
const recentTrades = allTrades.slice(-5).reverse();
recentTrades.forEach((t, i) => {
  const time = new Date(t.timestamp).toLocaleString();
  const action = t.action.toUpperCase();
  const conf = ((t.confidence || 0) * 100).toFixed(0);
  console.log(`   ${recentTrades.length - i}. ${time}`);
  console.log(`      Action: ${action} | Confidence: ${conf}%`);
  console.log(`      Amount: ${t.amount?.toFixed(4) || 'N/A'} USDT`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Report generated at ${new Date().toLocaleString()}`);
console.log('═══════════════════════════════════════════════════════════\n');
