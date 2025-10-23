# Telegram Bot Setup Guide

## Step 1: Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow prompts to name your bot
4. **Save the API token** you receive (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Step 2: Get Your Chat ID

1. Search for `@userinfobot` on Telegram
2. Start a conversation
3. **Save your chat ID** (looks like: `123456789`)

## Step 3: Configure Environment Variables

Add these to your `.env` file or export them:

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token-here"
export TELEGRAM_CHAT_ID="your-chat-id-here"
```

Or add to `.env` file:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

## Step 4: Test Integration

```bash
node -e "const getTelegram = require('./monitoring/telegramAlerts'); const telegram = getTelegram(); telegram.sendTestMessage();"
```

You should receive a test message on Telegram!

## Alert Types

Your bot will send alerts for:

- 🎯 **Position Exits** - Profit/loss notifications
- 📊 **Position Entries** - New trades opened
- ⚠️ **Balance Warnings** - Low balance alerts
- 🚨 **Errors** - Critical bot errors
- 📊 **Daily Summary** - Daily performance report

## Usage in Code

```javascript
const getTelegramAlerts = require('./monitoring/telegramAlerts');
const telegram = getTelegramAlerts();

// Send custom alert
await telegram.sendAlert('Bot started successfully!');

// Exit notification
await telegram.notifyExit(position, currentPrice, 'take_profit');

// Entry notification
await telegram.notifyEntry(position);

// Balance warning
await telegram.notifyBalanceWarning('BNB', 1.12, 3.5);

// Error notification
await telegram.notifyError(error, 'Position monitoring');

// Daily summary
await telegram.sendDailySummary(stats);
```

## Security Notes

- Never commit your bot token to GitHub
- Use environment variables
- Restrict bot access to your chat ID only
- Rotate token if compromised
