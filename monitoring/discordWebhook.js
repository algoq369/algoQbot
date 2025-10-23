/**
 * Discord Webhook Integration
 * Send trading alerts to Discord channel
 */

const { WebhookClient, EmbedBuilder } = require('discord.js');
const logger = require('../logger');

class DiscordAlerts {
  constructor() {
    // 🔧 CONFIGURATION - Set your Discord webhook URL
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || 'YOUR_WEBHOOK_URL_HERE';

    if (this.webhookUrl === 'YOUR_WEBHOOK_URL_HERE') {
      logger.warn('⚠️  Discord not configured. Set DISCORD_WEBHOOK_URL environment variable');
      this.enabled = false;
      return;
    }

    try {
      // Extract webhook ID and token from URL
      const urlParts = this.webhookUrl.split('/');
      const webhookId = urlParts[urlParts.length - 2];
      const webhookToken = urlParts[urlParts.length - 1];

      this.webhook = new WebhookClient({ id: webhookId, token: webhookToken });
      this.enabled = true;
      logger.info('✅ Discord webhooks enabled');
    } catch (error) {
      logger.error('Failed to initialize Discord webhook:', error);
      this.enabled = false;
    }
  }

  /**
   * Send rich embed to Discord
   */
  async sendEmbed(embedData) {
    if (!this.enabled) return;

    try {
      const embed = new EmbedBuilder()
        .setColor(embedData.color || 0x0099FF)
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setTimestamp();

      if (embedData.fields) {
        embed.addFields(embedData.fields);
      }

      if (embedData.footer) {
        embed.setFooter({ text: embedData.footer });
      }

      await this.webhook.send({ embeds: [embed] });
      logger.debug(`📨 Discord embed sent: ${embedData.title}`);
    } catch (error) {
      logger.error('Failed to send Discord embed:', error);
    }
  }

  /**
   * Send exit notification
   */
  async notifyExit(position, currentPrice, reason) {
    const profit = position.profit_loss || 0;
    const profitPercent = ((profit / position.size) * 100).toFixed(2);
    const isProfit = profit > 0;

    const embedData = {
      title: isProfit ? '🎯 Position Exit - Profit!' : '🚨 Position Exit - Loss',
      color: isProfit ? 0x00FF00 : 0xFF0000,
      fields: [
        { name: 'Side', value: position.side.toUpperCase(), inline: true },
        { name: 'Entry Price', value: `$${position.entry_price.toFixed(6)}`, inline: true },
        { name: 'Exit Price', value: `$${currentPrice.toFixed(6)}`, inline: true },
        { name: 'P&L', value: `${profit > 0 ? '+' : ''}$${profit.toFixed(2)}`, inline: true },
        { name: 'P&L %', value: `${profitPercent}%`, inline: true },
        { name: 'Reason', value: reason, inline: true },
        { name: 'Size', value: `$${position.size.toFixed(2)}`, inline: true },
        { name: 'Hold Time', value: this.getHoldTime(position), inline: true }
      ],
      footer: `Position ID: ${position.id}`
    };

    await this.sendEmbed(embedData);
  }

  /**
   * Send entry notification
   */
  async notifyEntry(position) {
    const embedData = {
      title: '📊 New Position Opened',
      color: 0x0099FF,
      fields: [
        { name: 'Side', value: position.side.toUpperCase(), inline: true },
        { name: 'Entry Price', value: `$${position.entry_price.toFixed(6)}`, inline: true },
        { name: 'Size', value: `$${position.size.toFixed(2)}`, inline: true },
        { name: 'Take Profit', value: `$${position.takeProfit.toFixed(6)} (+0.5%)`, inline: true },
        { name: 'Stop Loss', value: `$${position.stopLoss.toFixed(6)} (-2%)`, inline: true },
        { name: 'Strategy', value: position.strategy || 'Mean Reversion', inline: true }
      ],
      footer: `Position ID: ${position.id}`
    };

    await this.sendEmbed(embedData);
  }

  /**
   * Send balance warning
   */
  async notifyBalanceWarning(asset, current, required) {
    const embedData = {
      title: '⚠️ Balance Warning',
      color: 0xFFA500,
      fields: [
        { name: 'Asset', value: asset, inline: true },
        { name: 'Current Balance', value: current.toFixed(4), inline: true },
        { name: 'Required', value: required.toFixed(4), inline: true },
        { name: 'Shortfall', value: (required - current).toFixed(4), inline: true }
      ],
      description: 'Bot may not be able to enter new positions until balance is restored.'
    };

    await this.sendEmbed(embedData);
  }

  /**
   * Send error notification
   */
  async notifyError(error, context = '') {
    const embedData = {
      title: '🚨 Bot Error Detected',
      color: 0xFF0000,
      description: `\`\`\`${error.message}\`\`\``,
      fields: [
        { name: 'Context', value: context || 'Unknown', inline: false },
        { name: 'Stack Trace', value: `\`\`\`${(error.stack || 'No stack trace').substring(0, 1000)}\`\`\``, inline: false }
      ]
    };

    await this.sendEmbed(embedData);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(stats) {
    const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0;
    const isProfit = stats.totalPnL > 0;

    const embedData = {
      title: '📊 Daily Trading Summary',
      color: isProfit ? 0x00FF00 : 0xFF0000,
      fields: [
        { name: 'Total Trades', value: stats.totalTrades.toString(), inline: true },
        { name: 'Wins', value: stats.wins.toString(), inline: true },
        { name: 'Losses', value: stats.losses.toString(), inline: true },
        { name: 'Win Rate', value: `${winRate}%`, inline: true },
        { name: 'Total P&L', value: `${stats.totalPnL > 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`, inline: true },
        { name: 'Avg Profit', value: `$${stats.avgProfit.toFixed(2)}`, inline: true },
        { name: 'Portfolio Value', value: `$${stats.portfolioValue.toFixed(2)}`, inline: true },
        { name: 'Active Positions', value: stats.activePositions?.toString() || '0', inline: true }
      ],
      footer: new Date().toLocaleDateString()
    };

    await this.sendEmbed(embedData);
  }

  /**
   * Test notification
   */
  async sendTestMessage() {
    const embedData = {
      title: '✅ Discord Integration Test',
      color: 0x00FF00,
      description: 'Discord webhook is connected and ready to send alerts!',
      fields: [
        { name: 'Notifications Enabled', value: '✓ Position entries\n✓ Position exits\n✓ Balance warnings\n✓ Errors\n✓ Daily summaries', inline: false }
      ]
    };

    await this.sendEmbed(embedData);
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

function getDiscordAlerts() {
  if (!instance) {
    instance = new DiscordAlerts();
  }
  return instance;
}

module.exports = getDiscordAlerts;
