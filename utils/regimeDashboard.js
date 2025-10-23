// ═══════════════════════════════════════════════════════════════
// VOLATILITY REGIME DASHBOARD
// Professional visual monitoring system
// ═══════════════════════════════════════════════════════════════

const chalk = require('chalk');

/**
 * Display current regime status and trading parameters
 */
function displayRegimeStatus(regime, volatility4h, strategy, positionSize, tp, sl) {
  const regimeColors = {
    HIGH: chalk.red.bold,
    MEDIUM: chalk.yellow.bold,
    LOW: chalk.blue.bold,
    VERY_LOW: chalk.gray.bold
  };

  const color = regimeColors[regime] || chalk.white;
  const volPercent = (volatility4h * 100).toFixed(2);

  console.log('');
  console.log(chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan.bold('           VOLATILITY REGIME DASHBOARD'));
  console.log(chalk.cyan('═'.repeat(60)));
  console.log('');
  console.log(`  ${chalk.bold('Current Regime:')} ${color(regime)}`);
  console.log(`  ${chalk.bold('4h Volatility:')} ${chalk.white(volPercent + '%')}`);
  console.log(`  ${chalk.bold('Strategy:')} ${strategy ? chalk.green(strategy) : chalk.gray('None')}`);
  console.log('');

  if (positionSize > 0) {
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.cyan.bold('  Trading Parameters'));
    console.log(chalk.cyan('─'.repeat(60)));
    console.log('');
    console.log(`  ${chalk.bold('Position Size:')} ${chalk.yellow('$' + positionSize.toFixed(2))}`);
    console.log(`  ${chalk.bold('Take Profit:')} ${chalk.green((tp * 100).toFixed(2) + '%')}`);
    console.log(`  ${chalk.bold('Stop Loss:')} ${chalk.red((sl * 100).toFixed(2) + '%')}`);
    console.log('');
  } else {
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.gray.bold('  Waiting for trading conditions...'));
    console.log(chalk.cyan('─'.repeat(60)));
    console.log('');
  }

  console.log(chalk.cyan('═'.repeat(60)));
  console.log('');
}

/**
 * Display performance statistics by regime
 */
function displayRegimeStats(regimeStats) {
  console.log('');
  console.log(chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan.bold('        REGIME PERFORMANCE STATISTICS'));
  console.log(chalk.cyan('═'.repeat(60)));
  console.log('');

  // Header
  console.log(`  ${chalk.bold('Regime'.padEnd(12))} ${chalk.bold('Trades'.padEnd(12))} ${chalk.bold('Win Rate'.padEnd(12))} ${chalk.bold('Profit')}`);
  console.log(chalk.cyan('─'.repeat(60)));

  Object.keys(regimeStats).forEach(regime => {
    const stats = regimeStats[regime];
    const winRate = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(1) : '0.0';

    let color = chalk.white;
    if (regime === 'HIGH') color = chalk.red;
    if (regime === 'MEDIUM') color = chalk.yellow;
    if (regime === 'LOW') color = chalk.blue;
    if (regime === 'VERY_LOW') color = chalk.gray;

    const regimeLabel = color(regime.padEnd(12));
    const tradesLabel = `${stats.trades} trades`.padEnd(12);
    const winRateLabel = `${winRate}%`.padEnd(12);
    const profitLabel = stats.totalProfit >= 0
      ? chalk.green(`+$${stats.totalProfit.toFixed(2)}`)
      : chalk.red(`-$${Math.abs(stats.totalProfit).toFixed(2)}`);

    console.log(`  ${regimeLabel} ${tradesLabel} ${winRateLabel} ${profitLabel}`);
  });

  console.log('');
  console.log(chalk.cyan('═'.repeat(60)));
  console.log('');
}

/**
 * Display compact regime indicator
 */
function displayRegimeIndicator(regime, volatility4h) {
  const regimeEmojis = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🔵',
    VERY_LOW: '⚪'
  };

  const emoji = regimeEmojis[regime] || '⚫';
  const volPercent = (volatility4h * 100).toFixed(2);

  console.log(`${emoji} ${regime} | Vol: ${volPercent}%`);
}

module.exports = {
  displayRegimeStatus,
  displayRegimeStats,
  displayRegimeIndicator
};
