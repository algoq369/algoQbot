#!/usr/bin/env node

/**
 * 🏥 BSC Trading Bot Health Check Utility
 *
 * This script performs comprehensive health checks on the trading bot:
 * - Risk manager state (emergency shutdown, error counts)
 * - Database connectivity and data integrity
 * - Shadow mode portfolio validation
 * - Open positions monitoring
 * - Recent trade performance
 * - System resource usage
 *
 * Usage:
 *   node utils/healthCheck.js
 *   npm run health-check
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class HealthChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.info = [];
    this.dbPath = path.join(__dirname, '../data/trades.db');
    this.shadowDbPath = path.join(__dirname, '../data/shadow_mode.db');
  }

  // Main health check runner
  async run() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         🏥 BSC TRADING BOT HEALTH CHECK UTILITY           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.checkDatabaseHealth();
      await this.checkShadowModeHealth();
      await this.checkRiskManagerState();
      await this.checkOpenPositions();
      await this.checkRecentPerformance();
      await this.checkSystemResources();

      this.printReport();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  }

  // Check database health
  async checkDatabaseHealth() {
    console.log('🔍 Checking database health...\n');

    if (!fs.existsSync(this.dbPath)) {
      this.issues.push('❌ Main database not found at: ' + this.dbPath);
      return;
    }

    const db = new sqlite3.Database(this.dbPath);

    // Check tables exist
    const tables = await this.queryDb(db,
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );

    const expectedTables = ['trades', 'positions', 'portfolio_snapshots'];
    const existingTables = tables.map(t => t.name);

    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        this.info.push(`✅ Table '${table}' exists`);
      } else {
        this.warnings.push(`⚠️  Table '${table}' missing`);
      }
    }

    // Check trade count
    const tradeCount = await this.queryDb(db,
      "SELECT COUNT(*) as count FROM trades"
    );
    console.log(`   📊 Total trades: ${tradeCount[0].count}`);

    // Check recent trades
    const recentTrades = await this.queryDb(db,
      "SELECT COUNT(*) as count FROM trades WHERE timestamp > datetime('now', '-24 hours')"
    );
    console.log(`   📈 Trades (24h): ${recentTrades[0].count}\n`);

    db.close();
  }

  // Check shadow mode health
  async checkShadowModeHealth() {
    console.log('🧪 Checking shadow mode health...\n');

    if (!fs.existsSync(this.shadowDbPath)) {
      this.warnings.push('⚠️  Shadow mode database not found');
      console.log('   ⚠️  Shadow mode database not found\n');
      return;
    }

    const db = new sqlite3.Database(this.shadowDbPath);

    // Check shadow portfolio
    const portfolio = await this.queryDb(db,
      "SELECT * FROM portfolio ORDER BY timestamp DESC LIMIT 1"
    );

    if (portfolio.length > 0) {
      const p = portfolio[0];
      const totalValue = parseFloat(p.usdt_balance) + parseFloat(p.bnb_balance) * parseFloat(p.bnb_price);

      console.log(`   💰 Shadow Portfolio:`);
      console.log(`      USDT: $${parseFloat(p.usdt_balance).toFixed(2)}`);
      console.log(`      BNB: ${parseFloat(p.bnb_balance).toFixed(6)} (@ $${parseFloat(p.bnb_price).toFixed(8)})`);
      console.log(`      Total: $${totalValue.toFixed(2)}`);

      if (totalValue < 10) {
        this.issues.push('❌ Shadow portfolio value critically low: $' + totalValue.toFixed(2));
      } else if (totalValue < 1000) {
        this.warnings.push('⚠️  Shadow portfolio value low: $' + totalValue.toFixed(2));
      } else {
        this.info.push('✅ Shadow portfolio value healthy: $' + totalValue.toFixed(2));
      }
    }

    // Check shadow trades
    const shadowTrades = await this.queryDb(db,
      "SELECT COUNT(*) as count, SUM(profit_loss) as total_pnl FROM shadow_trades WHERE status = 'closed'"
    );

    if (shadowTrades.length > 0) {
      console.log(`   📊 Shadow trades: ${shadowTrades[0].count}`);
      console.log(`   💵 Total P&L: $${(shadowTrades[0].total_pnl || 0).toFixed(2)}\n`);
    }

    db.close();
  }

  // Check risk manager state
  async checkRiskManagerState() {
    console.log('🛡️  Checking risk manager state...\n');

    // Check if risk manager state file exists
    const riskStatePath = path.join(__dirname, '../data/risk-manager-state.json');

    if (fs.existsSync(riskStatePath)) {
      const state = JSON.parse(fs.readFileSync(riskStatePath, 'utf8'));

      console.log(`   Emergency Shutdown: ${state.emergencyState?.isShutdown ? '🚨 YES' : '✅ NO'}`);

      if (state.emergencyState?.isShutdown) {
        this.issues.push(`❌ EMERGENCY SHUTDOWN ACTIVE: ${state.emergencyState.shutdownReason}`);
        console.log(`   Shutdown Reason: ${state.emergencyState.shutdownReason}`);
        console.log(`   Shutdown Time: ${new Date(state.emergencyState.shutdownTime).toISOString()}`);
      }

      console.log(`   Consecutive Errors: ${state.state?.consecutiveErrors || 0}`);
      console.log(`   Daily Trades: ${state.state?.dailyTrades || 0}`);
      console.log(`   Portfolio Value: $${(state.state?.portfolioValue || 0).toFixed(2)}\n`);

      if (state.state?.consecutiveErrors >= 10) {
        this.issues.push('❌ Consecutive error count at maximum: ' + state.state.consecutiveErrors);
      } else if (state.state?.consecutiveErrors >= 7) {
        this.warnings.push('⚠️  High consecutive error count: ' + state.state.consecutiveErrors);
      }
    } else {
      this.warnings.push('⚠️  Risk manager state file not found');
      console.log('   ⚠️  Risk manager state file not found\n');
    }
  }

  // Check open positions
  async checkOpenPositions() {
    console.log('📊 Checking open positions...\n');

    const db = new sqlite3.Database(this.dbPath);

    const positions = await this.queryDb(db,
      "SELECT * FROM positions WHERE status = 'open'"
    );

    console.log(`   Open positions: ${positions.length}`);

    if (positions.length > 0) {
      for (const pos of positions) {
        const holdTime = Date.now() - pos.timestamp;
        const holdHours = (holdTime / 3600000).toFixed(1);

        console.log(`\n   Position ${pos.id}:`);
        console.log(`      Side: ${pos.side}`);
        console.log(`      Entry: ${pos.entry_price}`);
        console.log(`      Size: $${pos.size}`);
        console.log(`      Hold time: ${holdHours}h`);

        if (holdTime > 2 * 3600000) { // 2 hours
          this.warnings.push(`⚠️  Position ${pos.id} exceeding max hold time (${holdHours}h)`);
        }

        if (!pos.side || pos.side === 'undefined') {
          this.issues.push(`❌ Position ${pos.id} has invalid side: "${pos.side}"`);
        }
      }
    }

    console.log();
    db.close();
  }

  // Check recent performance
  async checkRecentPerformance() {
    console.log('📈 Checking recent performance...\n');

    const db = new sqlite3.Database(this.dbPath);

    // Last 24 hours
    const stats = await this.queryDb(db, `
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN profit_loss < 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(profit_loss) as total_pnl,
        AVG(profit_loss) as avg_pnl
      FROM trades
      WHERE timestamp > datetime('now', '-24 hours')
        AND status = 'closed'
    `);

    if (stats.length > 0 && stats[0].total_trades > 0) {
      const s = stats[0];
      const winRate = (s.winning_trades / s.total_trades * 100).toFixed(1);

      console.log(`   📊 Last 24 hours:`);
      console.log(`      Total trades: ${s.total_trades}`);
      console.log(`      Winning: ${s.winning_trades}`);
      console.log(`      Losing: ${s.losing_trades}`);
      console.log(`      Win rate: ${winRate}%`);
      console.log(`      Total P&L: $${(s.total_pnl || 0).toFixed(2)}`);
      console.log(`      Avg P&L: $${(s.avg_pnl || 0).toFixed(2)}\n`);

      if (s.total_pnl < -1000) {
        this.issues.push(`❌ Significant losses in 24h: -$${Math.abs(s.total_pnl).toFixed(2)}`);
      } else if (s.total_pnl < -500) {
        this.warnings.push(`⚠️  Moderate losses in 24h: -$${Math.abs(s.total_pnl).toFixed(2)}`);
      }

      if (parseFloat(winRate) < 30) {
        this.warnings.push(`⚠️  Low win rate: ${winRate}%`);
      }
    } else {
      console.log('   ℹ️  No trades in last 24 hours\n');
    }

    db.close();
  }

  // Check system resources
  async checkSystemResources() {
    console.log('🖥️  Checking system resources...\n');

    const used = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(used.rss / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024)
    };

    console.log(`   Memory usage:`);
    console.log(`      RSS: ${memoryMB.rss} MB`);
    console.log(`      Heap used: ${memoryMB.heapUsed} MB`);
    console.log(`      Heap total: ${memoryMB.heapTotal} MB`);

    if (memoryMB.heapUsed > 500) {
      this.warnings.push(`⚠️  High memory usage: ${memoryMB.heapUsed} MB`);
    }

    // Check log file size
    const logPath = path.join(__dirname, '../logs/combined.log');
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   Log file size: ${sizeMB} MB`);

      if (stats.size > 100 * 1024 * 1024) { // 100 MB
        this.warnings.push(`⚠️  Large log file: ${sizeMB} MB`);
      }
    }

    console.log();
  }

  // Print final report
  printReport() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    📋 HEALTH CHECK REPORT                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (this.issues.length > 0) {
      console.log('🚨 CRITICAL ISSUES:\n');
      this.issues.forEach(issue => console.log('   ' + issue));
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:\n');
      this.warnings.forEach(warning => console.log('   ' + warning));
      console.log();
    }

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ ALL SYSTEMS HEALTHY!\n');
      console.log('   No critical issues or warnings detected.\n');
    }

    // Recommendations
    if (this.issues.length > 0 || this.warnings.length > 0) {
      console.log('💡 RECOMMENDATIONS:\n');

      if (this.issues.some(i => i.includes('EMERGENCY SHUTDOWN'))) {
        console.log('   1. Reset emergency shutdown: node utils/resetEmergency.js');
      }

      if (this.warnings.some(w => w.includes('error count'))) {
        console.log('   2. Review recent error logs: tail -100 logs/combined.log');
      }

      if (this.warnings.some(w => w.includes('hold time'))) {
        console.log('   3. Review position exit logic in TradingStrategyAgent.js');
      }

      if (this.warnings.some(w => w.includes('losses'))) {
        console.log('   4. Consider reducing position sizes or adjusting strategy');
      }

      console.log();
    }

    // Exit code
    if (this.issues.length > 0) {
      console.log('❌ Health check FAILED with critical issues\n');
      process.exit(1);
    } else if (this.warnings.length > 0) {
      console.log('⚠️  Health check PASSED with warnings\n');
      process.exit(0);
    } else {
      console.log('✅ Health check PASSED\n');
      process.exit(0);
    }
  }

  // Helper: Query database
  queryDb(db, sql) {
    return new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

// Run health check
const checker = new HealthChecker();
checker.run();
