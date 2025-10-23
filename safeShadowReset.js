#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function safeShadowReset() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = `./backups/shadow-reset-${timestamp}`;

  console.log('\n🔒 ULTRA-SAFE SHADOW MODE RESET');
  console.log('═══════════════════════════════════════\n');

  try {
    // Step 1: Create backup directory
    console.log('📁 Step 1: Creating backup directory...');
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`   ✅ Created: ${backupDir}\n`);

    // Step 2: Backup shadow trades file
    console.log('📋 Step 2: Backing up shadow trades...');
    try {
      const shadowTradesPath = './data/shadow-trades.json';
      const shadowTradesBackup = path.join(backupDir, 'shadow-trades.json');

      const shadowData = await fs.readFile(shadowTradesPath, 'utf8');
      await fs.writeFile(shadowTradesBackup, shadowData);

      const trades = JSON.parse(shadowData);
      console.log(`   ✅ Backed up ${trades.length} shadow trades`);
      console.log(`   📍 Location: ${shadowTradesBackup}\n`);
    } catch (error) {
      console.log('   ⚠️  No shadow trades file found (this is normal for fresh start)\n');
    }

    // Step 3: Backup database
    console.log('💾 Step 3: Exporting database...');
    try {
      const dbPath = './data/trading_bot.db';
      const dbBackup = path.join(backupDir, 'trading_bot.db');

      await fs.copyFile(dbPath, dbBackup);

      const stats = await fs.stat(dbBackup);
      console.log(`   ✅ Database backed up (${(stats.size / 1024).toFixed(2)} KB)`);
      console.log(`   📍 Location: ${dbBackup}\n`);
    } catch (error) {
      console.log('   ⚠️  No database found (this is normal for fresh start)\n');
    }

    // Step 4: Backup price history
    console.log('📊 Step 4: Backing up price history...');
    try {
      const priceHistoryPath = './data/price-history.json';
      const priceHistoryBackup = path.join(backupDir, 'price-history.json');

      const priceData = await fs.readFile(priceHistoryPath, 'utf8');
      await fs.writeFile(priceHistoryBackup, priceData);

      const prices = JSON.parse(priceData);
      console.log(`   ✅ Backed up ${prices.length} price points`);
      console.log(`   📍 Location: ${priceHistoryBackup}\n`);
    } catch (error) {
      console.log('   ⚠️  No price history found\n');
    }

    // Step 5: Backup logs
    console.log('📝 Step 5: Backing up logs...');
    try {
      const logFiles = ['bot.log', 'error.log', 'combined.log'];
      let backedUpLogs = 0;

      for (const logFile of logFiles) {
        try {
          const logPath = `./${logFile}`;
          const logBackup = path.join(backupDir, logFile);
          await fs.copyFile(logPath, logBackup);
          backedUpLogs++;
        } catch (err) {
          // Skip missing log files
        }
      }

      if (backedUpLogs > 0) {
        console.log(`   ✅ Backed up ${backedUpLogs} log file(s)`);
        console.log(`   📍 Location: ${backupDir}\n`);
      } else {
        console.log('   ℹ️  No log files to backup\n');
      }
    } catch (error) {
      console.log('   ⚠️  Could not backup logs\n');
    }

    // Step 6: Create restore script
    console.log('🔄 Step 6: Creating restore script...');
    const restoreScript = `#!/bin/bash
# Restore script for shadow reset backup: ${timestamp}
# Created: ${new Date().toISOString()}

echo "🔄 Restoring shadow mode data from backup..."
echo ""

# Restore shadow trades
if [ -f "${backupDir}/shadow-trades.json" ]; then
  cp "${backupDir}/shadow-trades.json" ./data/shadow-trades.json
  echo "✅ Restored shadow trades"
fi

# Restore database
if [ -f "${backupDir}/trading_bot.db" ]; then
  cp "${backupDir}/trading_bot.db" ./data/trading_bot.db
  echo "✅ Restored database"
fi

# Restore price history
if [ -f "${backupDir}/price-history.json" ]; then
  cp "${backupDir}/price-history.json" ./data/price-history.json
  echo "✅ Restored price history"
fi

echo ""
echo "✅ Restore complete!"
echo "⚠️  Restart the bot to use restored data"
`;

    await fs.writeFile(path.join(backupDir, 'restore.sh'), restoreScript);
    await fs.chmod(path.join(backupDir, 'restore.sh'), 0o755);
    console.log(`   ✅ Restore script created`);
    console.log(`   📍 Run: bash ${backupDir}/restore.sh\n`);

    // Step 7: Create backup summary
    const summary = {
      timestamp: timestamp,
      backupDir: backupDir,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      purpose: 'Shadow mode reset - safe backup before clearing data',
      restoreCommand: `bash ${backupDir}/restore.sh`
    };

    await fs.writeFile(
      path.join(backupDir, 'backup-info.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('📋 Step 7: Backup summary created\n');
    console.log('═══════════════════════════════════════');
    console.log('✅ ALL BACKUPS COMPLETE!');
    console.log('═══════════════════════════════════════\n');
    console.log('📦 Backup Location:', backupDir);
    console.log('🔄 Restore Command:', `bash ${backupDir}/restore.sh`);
    console.log('⏰ Backup Expires:', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString());
    console.log('\n🧹 Now clearing shadow data...\n');

    // Step 8: Clear shadow data
    console.log('🗑️  Clearing shadow trades...');
    await fs.writeFile('./data/shadow-trades.json', JSON.stringify([], null, 2));
    console.log('   ✅ Shadow trades cleared (reset to empty array)\n');

    console.log('═══════════════════════════════════════');
    console.log('✅ SAFE RESET COMPLETE!');
    console.log('═══════════════════════════════════════\n');
    console.log('🔒 All data safely backed up to:', backupDir);
    console.log('📊 Shadow mode ready for fresh testing');
    console.log('🔄 Rollback available anytime for 30 days');
    console.log('\n💡 Restart the bot with: npm start\n');

  } catch (error) {
    console.error('❌ Error during backup:', error.message);
    process.exit(1);
  }
}

// Run the safe reset
safeShadowReset();
