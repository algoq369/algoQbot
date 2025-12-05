const logger = require('../logger');

/**
 * P&L Calculator Utility
 * 
 * Calculates profit and loss for trading positions
 * Supports both entry/exit pairs and position-based calculations
 * 
 * @class PNLCalculator
 */
class PNLCalculator {
  /**
   * Calculate P&L percentage from entry and exit prices
   * 
   * @param {number} entryPrice - Entry price
   * @param {number} exitPrice - Exit price
   * @param {string} side - Position side ('buy' or 'sell')
   * @returns {number} P&L percentage (positive = profit, negative = loss)
   */
  static calculatePLPercent(entryPrice, exitPrice, side) {
    if (!entryPrice || !exitPrice || entryPrice <= 0 || exitPrice <= 0) {
      logger.warn('Invalid prices for P&L calculation:', { entryPrice, exitPrice });
      return 0;
    }

    if (side === 'buy') {
      // Long position: profit when exit > entry
      return ((exitPrice - entryPrice) / entryPrice) * 100;
    } else if (side === 'sell') {
      // Short position: profit when exit < entry
      return ((entryPrice - exitPrice) / entryPrice) * 100;
    } else {
      logger.warn('Invalid position side for P&L calculation:', side);
      return 0;
    }
  }

  /**
   * Calculate P&L in USD from entry and exit prices
   * 
   * @param {number} entryPrice - Entry price
   * @param {number} exitPrice - Exit price
   * @param {number} positionSize - Position size in base currency (USDT for buy, BNB for sell)
   * @param {string} side - Position side ('buy' or 'sell')
   * @returns {number} P&L in USD
   */
  static calculatePLUSD(entryPrice, exitPrice, positionSize, side) {
    const plPercent = this.calculatePLPercent(entryPrice, exitPrice, side);
    
    if (side === 'buy') {
      // For buy positions, positionSize is in USDT
      // Profit = positionSize * (exitPrice - entryPrice) / entryPrice
      return (positionSize * plPercent) / 100;
    } else if (side === 'sell') {
      // For sell positions, positionSize is in BNB
      // Convert to USD value first, then calculate profit
      const entryValueUSD = positionSize * entryPrice;
      return (entryValueUSD * plPercent) / 100;
    } else {
      logger.warn('Invalid position side for P&L USD calculation:', side);
      return 0;
    }
  }

  /**
   * Calculate P&L for a complete trade (entry + exit)
   * 
   * @param {Object} entry - Entry trade data
   * @param {Object} exit - Exit trade data
   * @returns {Object} Complete P&L calculation
   */
  static calculateTradePL(entry, exit) {
    if (!entry || !exit) {
      logger.warn('Missing entry or exit data for P&L calculation');
      return {
        plPercent: 0,
        plUSD: 0,
        entryPrice: entry?.price || 0,
        exitPrice: exit?.price || 0,
        positionSize: entry?.amount || 0,
        side: entry?.side || 'buy',
        holdDuration: exit?.timestamp && entry?.timestamp 
          ? exit.timestamp - entry.timestamp 
          : 0
      };
    }

    const side = entry.side || 'buy';
    const entryPrice = entry.price || entry.targetPrice || 0;
    const exitPrice = exit.price || exit.targetPrice || 0;
    const positionSize = entry.amount || entry.positionSize || 0;

    const plPercent = this.calculatePLPercent(entryPrice, exitPrice, side);
    const plUSD = this.calculatePLUSD(entryPrice, exitPrice, positionSize, side);

    return {
      plPercent: parseFloat(plPercent.toFixed(4)),
      plUSD: parseFloat(plUSD.toFixed(2)),
      entryPrice,
      exitPrice,
      positionSize,
      side,
      holdDuration: exit.timestamp && entry.timestamp 
        ? exit.timestamp - entry.timestamp 
        : 0,
      entryTime: entry.timestamp,
      exitTime: exit.timestamp,
      strategy: entry.strategy || exit.strategy || 'unknown',
      exitReason: exit.exitReason || exit.reason || 'unknown'
    };
  }

  /**
   * Calculate aggregate P&L statistics from multiple trades
   * 
   * @param {Array} trades - Array of trade P&L objects
   * @returns {Object} Aggregate statistics
   */
  static calculateAggregatePL(trades) {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPLUSD: 0,
        totalPLPercent: 0,
        avgPLUSD: 0,
        avgPLPercent: 0,
        maxWin: 0,
        maxLoss: 0,
        sharpeRatio: 0
      };
    }

    const validTrades = trades.filter(t => t.plUSD !== undefined && t.plUSD !== null);
    if (validTrades.length === 0) {
      return this.calculateAggregatePL([]);
    }

    const winningTrades = validTrades.filter(t => t.plUSD > 0);
    const losingTrades = validTrades.filter(t => t.plUSD < 0);
    
    const totalPLUSD = validTrades.reduce((sum, t) => sum + (t.plUSD || 0), 0);
    const totalPLPercent = validTrades.reduce((sum, t) => sum + (t.plPercent || 0), 0);
    
    const avgPLUSD = totalPLUSD / validTrades.length;
    const avgPLPercent = totalPLPercent / validTrades.length;
    
    const maxWin = Math.max(...validTrades.map(t => t.plUSD || 0));
    const maxLoss = Math.min(...validTrades.map(t => t.plUSD || 0));
    
    // Calculate Sharpe ratio (simplified)
    const returns = validTrades.map(t => t.plPercent || 0);
    const avgReturn = avgPLPercent;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      totalTrades: validTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / validTrades.length) * 100,
      totalPLUSD: parseFloat(totalPLUSD.toFixed(2)),
      totalPLPercent: parseFloat(totalPLPercent.toFixed(4)),
      avgPLUSD: parseFloat(avgPLUSD.toFixed(2)),
      avgPLPercent: parseFloat(avgPLPercent.toFixed(4)),
      maxWin: parseFloat(maxWin.toFixed(2)),
      maxLoss: parseFloat(maxLoss.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(4))
    };
  }

  /**
   * Match entry and exit trades by positionId
   * 
   * @param {Array} shadowTrades - Array of shadow trade records
   * @returns {Array} Array of matched entry/exit pairs with P&L
   */
  static matchEntryExitPairs(shadowTrades) {
    if (!shadowTrades || shadowTrades.length === 0) {
      return [];
    }

    const entries = new Map();
    const completedTrades = [];

    // First pass: collect entries
    shadowTrades.forEach(trade => {
      if (trade.type === 'ENTRY' && trade.positionId) {
        entries.set(trade.positionId, trade);
      }
    });

    // Second pass: match exits to entries
    shadowTrades.forEach(trade => {
      if (trade.type === 'EXIT' && trade.positionId) {
        const entry = entries.get(trade.positionId);
        if (entry) {
          const pl = this.calculateTradePL(entry, trade);
          completedTrades.push({
            positionId: trade.positionId,
            entry,
            exit: trade,
            ...pl
          });
          entries.delete(trade.positionId); // Remove matched entry
        }
      }
    });

    // Report unmatched entries
    if (entries.size > 0) {
      logger.info(`📊 Found ${entries.size} unmatched entry positions (still open)`);
    }

    return completedTrades;
  }
}

module.exports = PNLCalculator;


