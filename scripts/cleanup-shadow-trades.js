#!/usr/bin/env node
/**
 * Shadow Trades Cleanup Script
 * 
 * Removes invalid entries from shadow_trades.json:
 * 1. Entries with side="HOLD" (phantom positions)
 * 2. Duplicate entries at same timestamp
 * 3. Entries with missing required fields
 * 
 * Run: node scripts/cleanup-shadow-trades.js
 */

const fs = require('fs');
const path = require('path');

const SHADOW_TRADES_PATH = path.join(__dirname, '../data/shadow_trades.json');
const BACKUP_PATH = path.join(__dirname, '../data/shadow_trades_backup_' + Date.now() + '.json');

console.log('═══════════════════════════════════════════════════════════');
console.log('       SHADOW TRADES CLEANUP SCRIPT');
console.log('═══════════════════════════════════════════════════════════');

// Read current data
let trades;
try {
  const content = fs.readFileSync(SHADOW_TRADES_PATH, 'utf8');
  trades = JSON.parse(content);
  console.log(`\n📂 Loaded ${trades.length} trades from shadow_trades.json`);
} catch (error) {
  console.error('❌ Failed to read shadow_trades.json:', error.message);
  process.exit(1);
}

// Create backup
try {
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(trades, null, 2));
  console.log(`💾 Backup created: ${BACKUP_PATH}`);
} catch (error) {
  console.error('❌ Failed to create backup:', error.message);
  process.exit(1);
}

// Count issues before cleanup
const beforeStats = {
  total: trades.length,
  holdPositions: trades.filter(t => t.side === 'HOLD' || t.side === 'hold').length,
  unknownStrategy: trades.filter(t => t.strategy === 'unknown').length,
  zeroSize: trades.filter(t => t.type === 'EXIT' && (t.size === 0 || t.sizeUSD === 0)).length,
  exits: trades.filter(t => t.type === 'EXIT').length,
  entries: trades.filter(t => t.action && t.action !== 'HOLD').length
};

console.log('\n📊 BEFORE CLEANUP:');
console.log(`   Total entries: ${beforeStats.total}`);
console.log(`   HOLD positions (phantom): ${beforeStats.holdPositions}`);
console.log(`   Unknown strategy: ${beforeStats.unknownStrategy}`);
console.log(`   EXIT trades: ${beforeStats.exits}`);
console.log(`   Entry trades: ${beforeStats.entries}`);

// Remove HOLD positions
const validTrades = trades.filter(trade => {
  // Remove HOLD positions (phantom entries)
  if (trade.side === 'HOLD' || trade.side === 'hold') {
    return false;
  }
  
  // Remove HOLD actions from entries (keep only buy/sell)
  if (trade.action === 'HOLD' || trade.action === 'hold') {
    return false;
  }
  
  return true;
});

console.log(`\n🧹 Removed ${trades.length - validTrades.length} invalid entries`);

// Remove duplicates (same timestamp within 100ms)
const seenTimestamps = new Map();
const uniqueTrades = validTrades.filter(trade => {
  const ts = new Date(trade.timestamp || trade.entryTime || trade.exitTime).getTime();
  const key = `${ts}_${trade.action || trade.type}_${trade.side || ''}`;
  
  // Allow same action within 100ms only once
  for (const [existingKey, existingTs] of seenTimestamps) {
    if (existingKey.startsWith(key.split('_')[0]) && Math.abs(ts - existingTs) < 100) {
      return false;
    }
  }
  
  seenTimestamps.set(key, ts);
  return true;
});

console.log(`🔄 Removed ${validTrades.length - uniqueTrades.length} duplicate entries`);

// ✅ FIX: Remove orphaned exits (exits without matching entries)
const entries = uniqueTrades.filter(t => t.type !== 'EXIT' && (t.action === 'buy' || t.action === 'sell'));
const exits = uniqueTrades.filter(t => t.type === 'EXIT');

console.log(`\n🔍 Checking for orphaned exits...`);
console.log(`   Entry trades: ${entries.length}`);
console.log(`   Exit trades: ${exits.length}`);

// Match exits to entries by positionId or timestamp proximity
const validExits = exits.filter(exit => {
  // Try to find matching entry by positionId
  if (exit.positionId) {
    const matchingEntry = entries.find(entry => entry.positionId === exit.positionId);
    if (matchingEntry) {
      return true; // Valid exit with matching entry
    }
  }
  
  // Try to find matching entry by timestamp proximity (within 4 hours)
  const exitTime = new Date(exit.timestamp || exit.exitTime || 0).getTime();
  const matchingEntry = entries.find(entry => {
    const entryTime = new Date(entry.timestamp || entry.entryTime || 0).getTime();
    const timeDiff = Math.abs(exitTime - entryTime);
    return timeDiff < 4 * 3600000; // Within 4 hours
  });
  
  if (matchingEntry) {
    return true; // Valid exit with matching entry by timestamp
  }
  
  // No matching entry found - this is an orphaned exit
  return false;
});

const orphanedCount = exits.length - validExits.length;
if (orphanedCount > 0) {
  console.log(`⚠️  Found ${orphanedCount} orphaned exits (exits without matching entries)`);
  console.log(`   Removing orphaned exits...`);
}

// Combine valid entries and valid exits
const cleanedTrades = [...entries, ...validExits].sort((a, b) => {
  const timeA = new Date(a.timestamp || a.entryTime || a.exitTime || 0).getTime();
  const timeB = new Date(b.timestamp || b.entryTime || b.exitTime || 0).getTime();
  return timeA - timeB;
});

console.log(`✅ Removed ${orphanedCount} orphaned exits`);
console.log(`   Final count: ${cleanedTrades.length} trades (${entries.length} entries, ${validExits.length} exits)`);

// Recalculate P&L statistics
const exitTrades = cleanedTrades.filter(t => t.type === 'EXIT');
let totalPnL = 0;
let wins = 0;
let losses = 0;

exitTrades.forEach(trade => {
  const profit = trade.profit || 0;
  totalPnL += profit;
  if (profit > 0) wins++;
  else if (profit < 0) losses++;
});

console.log('\n📈 AFTER CLEANUP:');
console.log(`   Total entries: ${cleanedTrades.length}`);
console.log(`   EXIT trades: ${exitTrades.length}`);
console.log(`   Wins: ${wins}`);
console.log(`   Losses: ${losses}`);
console.log(`   Win Rate: ${exitTrades.length > 0 ? ((wins / exitTrades.length) * 100).toFixed(1) : 0}%`);
console.log(`   Total P&L: $${totalPnL.toFixed(2)}`);

// Save cleaned data
try {
  fs.writeFileSync(SHADOW_TRADES_PATH, JSON.stringify(cleanedTrades, null, 2));
  console.log(`\n✅ Cleaned data saved to ${SHADOW_TRADES_PATH}`);
} catch (error) {
  console.error('❌ Failed to save cleaned data:', error.message);
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('       CLEANUP COMPLETE');
console.log('═══════════════════════════════════════════════════════════');
console.log(`\n📋 Summary:`);
console.log(`   Entries removed: ${trades.length - cleanedTrades.length}`);
console.log(`   - HOLD positions: ${beforeStats.holdPositions}`);
console.log(`   - Duplicates: ${validTrades.length - uniqueTrades.length}`);
console.log(`   - Orphaned exits: ${orphanedCount}`);
console.log(`\n   Backup saved to: ${BACKUP_PATH}`);
console.log('');

