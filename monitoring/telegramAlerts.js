/**
 * Telegram Alerts Integration
 * Sends real-time notifications to your mobile device
 */

const TelegramBot = require('node-telegram-bot-api');
const logger = require('../logger');

class TelegramAlerts {
  constructor() {
    // 🔧 CONFIGURATION - Edit these values with your bot details
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
    this.chatId = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE';

    // Check if configured
    if (this.botToken === 'YOUR_BOT_TOKEN_HERE' || this.chatId === 'YOUR_CHAT_ID_HERE') {
      logger.warn('⚠️  Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables');
      this.enabled = false;
      return;
    }

    try {
      this.bot = new TelegramBot(this.botToken, { polling: false });
      this.enabled = true;
      logger.info('✅ Telegram alerts enabled');
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
      this.enabled = false;
    }
  }

  /**
   * Send alert to Telegram
   * @param {string} message - Message to send
   * @param {object} options - Additional options
   */
  async sendAlert(message, options = {}) {
    if (!this.enabled) return;

    try {
      const formattedMessage = this.formatMessage(message, options);
      await this.bot.sendMessage(this.chatId, formattedMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      logger.debug(`📱 Telegram alert sent: ${message.substring(0, 50)}...`);
    } catch (error) {
      logger.error('Failed to send Telegram alert:', error);
    }
  }

  /**
   * Format message with emoji and markdown
   */
  formatMessage(message, options) {
    const timestamp = new Date().toLocaleString();
    let formatted = `*${options.title || 'Trading Bot Alert'}*\n\n`;
    formatted += message + '\n\n';
    formatted += `_${timestamp}_`;
    return formatted;
  }

  /**
   * Send exit notification
   */
  async notifyExit(position, currentPrice, reason) {
    const profit = position.profit_loss || 0;
    const profitPercent = ((profit / position.size) * 100).toFixed(2);
    const emoji = profit > 0 ? '🎯' : '🚨';

    const message = `${emoji} *Position Exit*\n\n` +
      `Side: ${position.side.toUpperCase()}\n` +
      `Entry: $${position.entry_price.toFixed(6)}\n` +
      `Exit: $${currentPrice.toFixed(6)}\n` +
      `P&L: ${profit > 0 ? '+' : ''}$${profit.toFixed(2)} (${profitPercent}%)\n` +
      `Reason: ${reason}\n` +
      `Hold Time: ${this.getHoldTime(position)}`;

    await this.sendAlert(message, { title: profit > 0 ? 'Profit!' : 'Loss' });
  }

  /**
   * Send entry notification
   */
  async notifyEntry(position) {
    const message = `📊 *New Position*\n\n` +
      `Side: ${position.side.toUpperCase()}\n` +
      `Size: $${position.size.toFixed(2)}\n` +
      `Entry: $${position.entry_price.toFixed(6)}\n` +
      `TP: $${position.takeProfit.toFixed(6)} (+0.5%)\n` +
      `SL: $${position.stopLoss.toFixed(6)} (-2%)`;

    await this.sendAlert(message, { title: 'Position Opened' });
  }

  /**
   * Send balance warning
   */
  async notifyBalanceWarning(asset, current, required) {
    const message = `⚠️ *Balance Warning*\n\n` +
      `Asset: ${asset}\n` +
      `Current: ${current.toFixed(4)}\n` +
      `Required: ${required.toFixed(4)}\n` +
      `Shortfall: ${(required - current).toFixed(4)}`;

    await this.sendAlert(message, { title: 'Low Balance' });
  }

  /**
   * Send error notification
   */
  async notifyError(error, context = '') {
    const message = `🚨 *Error Detected*\n\n` +
      `Context: ${context}\n` +
      `Error: ${error.message}\n` +
      `\`\`\`${error.stack?.substring(0, 200) || 'No stack trace'}\`\`\``;

    await this.sendAlert(message, { title: 'Bot Error' });
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(stats) {
    const message = `📊 *Daily Summary*\n\n` +
      `Total Trades: ${stats.totalTrades}\n` +
      `Wins: ${stats.wins} (${stats.winRate.toFixed(1)}%)\n` +
      `Losses: ${stats.losses}\n` +
      `P&L: ${stats.totalPnL > 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}\n` +
      `Avg Profit: $${stats.avgProfit.toFixed(2)}\n` +
      `Portfolio: $${stats.portfolioValue.toFixed(2)}`;

    await this.sendAlert(message, { title: 'Daily Report' });
  }

  /**
   * Test notification
   */
  async sendTestMessage() {
    const message = `✅ *Telegram Integration Test*\n\n` +
      `Bot is connected and ready to send alerts!\n\n` +
      `You will receive notifications for:\n` +
      `• Position entries & exits\n` +
      `• Balance warnings\n` +
      `• Errors & critical events\n` +
      `• Daily summaries`;

    await this.sendAlert(message, { title: 'Test Successful' });
  }

  /**
   * Get hold time in human-readable format
   */
  getHoldTime(position) {
    const holdTime = Date.now() - position.timestamp;
    const minutes = Math.floor(holdTime / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
}

// Singleton instance
let instance = null;

function getTelegramAlerts() {
  if (!instance) {
    instance = new TelegramAlerts();
  }
  return instance;
}

module.exports = getTelegramAlerts;
