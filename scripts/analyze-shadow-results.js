#!/usr/bin/env node

/**
 * 📊 SHADOW MODE RESULTS ANALYZER
 * 
 * Analyzes shadow trades data and determines if the bot is profitable enough
 * to move to live trading with real money.
 * 
 * Usage:
 *   node scripts/analyze-shadow-results.js
 * 
 * Output:
 *   - Total trades executed
 *   - Win rate percentage
 *   - Net profit/loss
 *   - Average profit per trade
 *   - Recommendation (go live or stay in shadow mode)
 */

const fs = require('fs');
const path = require('path');

const SHADOW_TRADES_PATH = path.join(__dirname, '..', '.shadow-trades.json');
const MIN_TRADES_FOR_ANALYSIS = 50;  // Need at least 50 trades for meaningful results
const MIN_WIN_RATE = 55;              // Need >55% win rate to be profitable after fees
const MIN_AVG_PROFIT = 0.5;           // Need at least $0.50 avg profit per trade

/**
 * Load shadow trades data
 */
function loadShadowTrades() {
  try {
    if (!fs.existsSync(SHADOW_TRADES_PATH)) {
      console.error('❌ No shadow trades file found:', SHADOW_TRADES_PATH);
      console.error('');
      console.error('Have you run the bot in shadow mode yet?');
      console.error('Start with: node scripts/start-with-password.js');
      console.error('');
      process.exit(1);
    }

    const data = fs.readFileSync(SHADOW_TRADES_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading shadow trades:', error.message);
    process.exit(1);
  }
}

/**
 * Calculate comprehensive statistics
 */
function calculateStats(shadowData) {
  const trades = shadowData.trades || [];
  
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      profitable: 0,
      unprofitable: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      avgProfit: 0,
      bestTrade: 0,
      worstTrade: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0
    };
  }

  let profitable = 0;
  let unprofitable = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let lastWasWin = null;

  trades.forEach(trade => {
    const profit = parseFloat(trade.estimatedProfit || 0);
    
    if (profit > 0) {
      profitable++;
      totalProfit += profit;
      
      if (lastWasWin === true) {
        currentStreak++;
      } else {
        currentStreak = 1;
        lastWasWin = true;
      }
      maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else {
      unprofitable++;
      totalLoss += Math.abs(profit);
      
      if (lastWasWin === false) {
        currentStreak++;
      } else {
        currentStreak = 1;
        lastWasWin = false;
      }
      maxLossStreak = Math.max(maxLossStreak, currentStreak);
    }
    
    bestTrade = Math.max(bestTrade, profit);
    worstTrade = Math.min(worstTrade, profit);
  });

  const winRate = (profitable / trades.length * 100);
  const netProfit = totalProfit - totalLoss;
  const avgProfit = netProfit / trades.length;

  return {
    totalTrades: trades.length,
    profitable,
    unprofitable,
    winRate,
    totalProfit,
    totalLoss,
    netProfit,
    avgProfit,
    bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
    worstTrade: worstTrade === Infinity ? 0 : worstTrade,
    maxWinStreak,
    maxLossStreak
  };
}

/**
 * Determine if ready for live trading
 */
function generateRecommendation(stats) {
  const checks = {
    enoughTrades: stats.totalTrades >= MIN_TRADES_FOR_ANALYSIS,
    goodWinRate: stats.winRate >= MIN_WIN_RATE,
    positiveProfit: stats.netProfit > 0,
    goodAvgProfit: stats.avgProfit >= MIN_AVG_PROFIT
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  return {
    checks,
    passedChecks,
    totalChecks,
    readyForLive: passedChecks === totalChecks
  };
}

/**
 * Print formatted analysis report
 */
function printReport(stats, recommendation, shadowData) {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                    ║');
  console.log('║          📊 SHADOW MODE RESULTS ANALYSIS                           ║');
  console.log('║                                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Basic Stats
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 TRADING STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Trades:        ${stats.totalTrades}`);
  console.log(`Profitable Trades:   ${stats.profitable} (${stats.winRate.toFixed(1)}%)`);
  console.log(`Unprofitable Trades: ${stats.unprofitable} (${(100 - stats.winRate).toFixed(1)}%)`);
  console.log('');

  // Profit/Loss
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 PROFIT & LOSS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Profit:        $${stats.totalProfit.toFixed(2)} USDT`);
  console.log(`Total Loss:          $${stats.totalLoss.toFixed(2)} USDT`);
  console.log(`Net Profit:          ${stats.netProfit >= 0 ? '✅' : '❌'} $${stats.netProfit.toFixed(2)} USDT`);
  console.log(`Avg Profit/Trade:    $${stats.avgProfit.toFixed(2)} USDT`);
  console.log('');

  // Extremes
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 BEST & WORST TRADES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Best Trade:          $${stats.bestTrade.toFixed(2)} USDT`);
  console.log(`Worst Trade:         $${stats.worstTrade.toFixed(2)} USDT`);
  console.log(`Max Win Streak:      ${stats.maxWinStreak} trades`);
  console.log(`Max Loss Streak:     ${stats.maxLossStreak} trades`);
  console.log('');

  // Time Period
  if (shadowData.metrics && shadowData.metrics.startTime) {
    const startTime = new Date(shadowData.metrics.startTime);
    const now = new Date();
    const daysRunning = Math.floor((now - startTime) / (1000 * 60 * 60 * 24));
    const hoursRunning = Math.floor((now - startTime) / (1000 * 60 * 60));
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏱️  TIME PERIOD');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Started:             ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}`);
    console.log(`Duration:            ${daysRunning} days (${hoursRunning} hours)`);
    console.log(`Avg Trades/Day:      ${(stats.totalTrades / Math.max(daysRunning, 1)).toFixed(1)}`);
    console.log('');
  }

  // Readiness Checks
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ LIVE TRADING READINESS CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${recommendation.checks.enoughTrades ? '✅' : '❌'} Minimum Trades:       ${stats.totalTrades} / ${MIN_TRADES_FOR_ANALYSIS}`);
  console.log(`${recommendation.checks.goodWinRate ? '✅' : '❌'} Win Rate:              ${stats.winRate.toFixed(1)}% / ${MIN_WIN_RATE}%`);
  console.log(`${recommendation.checks.positiveProfit ? '✅' : '❌'} Positive Net Profit:   $${stats.netProfit.toFixed(2)}`);
  console.log(`${recommendation.checks.goodAvgProfit ? '✅' : '❌'} Avg Profit/Trade:      $${stats.avgProfit.toFixed(2)} / $${MIN_AVG_PROFIT.toFixed(2)}`);
  console.log('');
  console.log(`Passed Checks:       ${recommendation.passedChecks} / ${recommendation.totalChecks}`);
  console.log('');

  // Final Recommendation
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 RECOMMENDATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (recommendation.readyForLive) {
    console.log('✅ READY FOR LIVE TRADING');
    console.log('');
    console.log('Your bot has met all criteria for live trading.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set SHADOW_MODE_ENABLED=false in .env');
    console.log('2. Start with SMALL capital ($25-50 only)');
    console.log('3. Monitor DAILY for the first week');
    console.log('4. Stop if you lose 20% of capital');
    console.log('5. Only scale up after 4+ weeks of profit');
    console.log('');
    console.log('⚠️  WARNING: Real money = real risk. Start small!');
  } else {
    console.log('❌ NOT READY FOR LIVE TRADING');
    console.log('');
    console.log('Your bot has not met all criteria yet.');
    console.log('');
    console.log('What to do:');
    
    if (!recommendation.checks.enoughTrades) {
      console.log(`- Keep running in shadow mode (need ${MIN_TRADES_FOR_ANALYSIS - stats.totalTrades} more trades)`);
    }
    if (!recommendation.checks.goodWinRate) {
      console.log('- Win rate too low - strategy needs improvement');
      console.log('- Consider adjusting ranging thresholds or parameters');
    }
    if (!recommendation.checks.positiveProfit) {
      console.log('- Bot is losing money - DO NOT trade with real funds');
      console.log('- Review and improve the strategy');
    }
    if (!recommendation.checks.goodAvgProfit) {
      console.log('- Profit per trade too small to cover fees and slippage');
      console.log('- Consider increasing trade sizes or improving entry/exit');
    }
    
    console.log('');
    console.log('Stay in shadow mode until all checks pass.');
    console.log('Better to learn this now than lose real money!');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

/**
 * Main execution
 */
function main() {
  console.log('Loading shadow trades data...');
  
  const shadowData = loadShadowTrades();
  const stats = calculateStats(shadowData);
  const recommendation = generateRecommendation(stats);
  
  printReport(stats, recommendation, shadowData);
  
  // Exit with code indicating readiness
  process.exit(recommendation.readyForLive ? 0 : 1);
}

// Run the analysis
main();

