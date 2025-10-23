#!/usr/bin/env node

/**
 * 🔄 Emergency Shutdown Reset Utility
 *
 * This script resets the emergency shutdown state of the trading bot.
 * Use this when the bot is stuck in emergency shutdown mode.
 *
 * Usage:
 *   node utils/resetEmergency.js
 *   npm run reset-emergency
 *
 * Safety:
 *   - Backs up current state before reset
 *   - Provides detailed report of what's being reset
 *   - Requires confirmation (use --force to skip)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class EmergencyReset {
  constructor() {
    this.riskStatePath = path.join(__dirname, '../data/risk-manager-state.json');
    this.backupPath = path.join(__dirname, '../data/backups/risk-manager-state-' + Date.now() + '.json');
  }

  async run(force = false) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         🔄 EMERGENCY SHUTDOWN RESET UTILITY               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      // Check if state file exists
      if (!fs.existsSync(this.riskStatePath)) {
        console.log('ℹ️  No risk manager state file found. Nothing to reset.\n');
        return;
      }

      // Load current state
      const state = JSON.parse(fs.readFileSync(this.riskStatePath, 'utf8'));

      // Display current state
      console.log('📊 CURRENT STATE:\n');
      console.log(`   Emergency Shutdown: ${state.emergencyState?.isShutdown ? '🚨 YES' : '✅ NO'}`);

      if (state.emergencyState?.isShutdown) {
        console.log(`   Shutdown Reason: ${state.emergencyState.shutdownReason}`);
        console.log(`   Shutdown Time: ${new Date(state.emergencyState.shutdownTime).toISOString()}`);
        console.log(`   Duration: ${((Date.now() - state.emergencyState.shutdownTime) / 60000).toFixed(1)} minutes`);
      }

      console.log(`   Consecutive Errors: ${state.state?.consecutiveErrors || 0}`);
      console.log(`   Error History: ${state.state?.errorHistory?.length || 0} errors`);
      console.log(`   Daily Trades: ${state.state?.dailyTrades || 0}`);
      console.log(`   Daily Loss: $${(state.state?.dailyLoss || 0).toFixed(2)}`);
      console.log(`   Portfolio Value: $${(state.state?.portfolioValue || 0).toFixed(2)}\n`);

      // Check if reset is needed
      if (!state.emergencyState?.isShutdown && state.state?.consecutiveErrors === 0) {
        console.log('✅ System is already in healthy state. No reset needed.\n');
        return;
      }

      // Confirm reset
      if (!force) {
        const confirmed = await this.confirm(
          '⚠️  This will reset the emergency shutdown state and error counters.\n   Continue? (yes/no): '
        );

        if (!confirmed) {
          console.log('\n❌ Reset cancelled by user.\n');
          return;
        }
      }

      // Create backup
      console.log('\n📦 Creating backup...');
      const backupDir = path.dirname(this.backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(this.backupPath, JSON.stringify(state, null, 2));
      console.log(`   ✅ Backup saved to: ${this.backupPath}`);

      // Reset state
      console.log('\n🔄 Resetting emergency state...');

      const resetState = {
        ...state,
        emergencyState: {
          isShutdown: false,
          shutdownReason: null,
          shutdownTime: null,
          lastHealthCheck: Date.now()
        },
        state: {
          ...state.state,
          consecutiveErrors: 0,
          errorHistory: [], // Clear error history
          dailyLoss: 0,     // Reset daily loss
          dailyTrades: 0,   // Reset daily trades
          hourlyTrades: 0,  // Reset hourly trades
          lastResetTime: Date.now(),
          lastHourReset: Date.now()
        }
      };

      // Save reset state
      fs.writeFileSync(this.riskStatePath, JSON.stringify(resetState, null, 2));

      console.log('\n✅ RESET COMPLETE!\n');
      console.log('📊 NEW STATE:\n');
      console.log('   Emergency Shutdown: ✅ NO');
      console.log('   Consecutive Errors: 0');
      console.log('   Error History: Cleared');
      console.log('   Daily Loss: $0.00');
      console.log('   Daily Trades: 0\n');

      console.log('💡 NEXT STEPS:\n');
      console.log('   1. Review the error logs to understand what caused the shutdown');
      console.log('   2. Restart the bot: npm start');
      console.log('   3. Monitor the bot closely for the first few trades');
      console.log('   4. Run health check: npm run health-check\n');

      console.log('📁 Backup location: ' + this.backupPath + '\n');

    } catch (error) {
      console.error('❌ Reset failed:', error);
      process.exit(1);
    }
  }

  async confirm(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(question, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }
}

// Parse command line args
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');

// Run reset
const reset = new EmergencyReset();
reset.run(force);
