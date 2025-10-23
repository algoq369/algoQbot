# Trading Bot Tools - Installation & Setup Guide

**Status:** ✅ All tools installed and configured
**Date:** October 17, 2025
**Last Updated:** October 17, 2025 - 10:15 PM

---

## 📦 INSTALLED TOOLS SUMMARY

### ✅ Immediate Priority (COMPLETED)

1. **PM2** - Process Manager ✅ v6.0.13
2. **Telegram Bot** - Mobile Alerts ✅ (Code ready, needs configuration)
3. **Streamlit** - Dashboard ✅ v1.50.0

### ✅ Short Term (COMPLETED)

4. **Grafana** - Monitoring Dashboards ✅ v12.2.0 (Running)
5. **Prometheus** - Metrics Collection ✅ v3.7.1 (Running)
6. **MetaBase** - Business Intelligence ✅ Downloaded (489MB)
7. **Jupyter Notebook** - Data Analysis ✅ Full Stack Installed

### ✅ Medium Term (COMPLETED)

8. **Clinic.js** - Performance Profiling ✅ v13.0.0
9. **SQLite Browser** - Database GUI ✅ v3.13.1
10. **Apache Superset** - Enterprise BI ❌ (Python 3.13 incompatibility - use Docker)
11. **Discord Webhooks** - Team Notifications ✅ (Code ready, needs configuration)
12. **TradingView Integration** - Signal Webhooks ✅ (Endpoint added to bot)

---

## 🚀 QUICK START COMMANDS

### PM2 - Bot Management

```bash
# View bot status
pm2 status

# View logs
pm2 logs trading-bot

# Restart bot
pm2 restart trading-bot

# Stop bot
pm2 stop trading-bot

# Monitor in real-time
pm2 monit
```

**Auto-start on Mac Reboot (run once):**
```bash
sudo env PATH=$PATH:/Users/sheirraza/.nvm/versions/node/v22.19.0/bin /Users/sheirraza/.nvm/versions/node/v22.19.0/lib/node_modules/pm2/bin/pm2 startup launchd -u sheirraza --hp /Users/sheirraza
```

---

### Streamlit Dashboard

```bash
# Launch dashboard
cd /Users/sheirraza/bsc-ranging-bot
streamlit run monitoring/app.py

# Access at: http://localhost:8501
```

**Features:**
- Real-time portfolio tracking
- Trade history visualization
- P&L charts
- Position monitoring
- Performance analytics

---

### Telegram Bot Alerts

**Setup Steps:**

1. **Create Bot:**
   - Open Telegram, search `@BotFather`
   - Send `/newbot`
   - Save your API token

2. **Get Chat ID:**
   - Search `@userinfobot`
   - Start conversation
   - Save your chat ID

3. **Configure:**
```bash
# Add to .env file
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

4. **Test:**
```bash
node -e "const getTelegram = require('./monitoring/telegramAlerts'); const telegram = getTelegram(); telegram.sendTestMessage();"
```

**Alert Types:**
- 🎯 Position exits (profit/loss)
- 📊 Position entries
- ⚠️ Balance warnings
- 🚨 Critical errors
- 📊 Daily summaries

**Documentation:** See `TELEGRAM-SETUP.md`

---

### Discord Webhooks

**Setup Steps:**

1. **Create Webhook:**
   - Open Discord server settings
   - Go to Integrations → Webhooks
   - Create webhook, copy URL

2. **Configure:**
```bash
# Add to .env file
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

3. **Test:**
```bash
node -e "const getDiscord = require('./monitoring/discordWebhook'); const discord = getDiscord(); discord.sendTestMessage();"
```

---

### Grafana + Prometheus

**Start Services:**
```bash
brew services start prometheus
brew services start grafana
```

**Access:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

**Default Login:**
- Username: `admin`
- Password: `admin`

**Next Steps:**
1. Add Prometheus as data source in Grafana
2. Import bot metrics dashboard
3. Configure alerts

---

### MetaBase

**Download:**
```bash
wget https://downloads.metabase.com/latest/metabase.jar
```

**Start:**
```bash
java -jar metabase.jar
```

**Access:** http://localhost:3000

**Connect to Database:**
- Database type: SQLite
- Database file: `/Users/sheirraza/bsc-ranging-bot/database/trading_bot.db`

---

### Jupyter Notebook

**Launch:**
```bash
jupyter notebook
```

**Access:** http://localhost:8888

**Use Cases:**
- Backtest strategies
- Analyze trade history
- Optimize parameters
- Visualize P&L
- Risk analysis

**Example Notebook:**
```python
import pandas as pd
import sqlite3

# Connect to database
conn = sqlite3.connect('database/trading_bot.db')

# Load trades
trades = pd.read_sql('SELECT * FROM trades', conn)

# Analyze
print(f"Total trades: {len(trades)}")
print(f"Win rate: {(trades['profit_loss'] > 0).mean()*100:.1f}%")
print(f"Total P&L: ${trades['profit_loss'].sum():.2f}")

# Plot
trades['profit_loss'].cumsum().plot(title='Cumulative P&L')
```

---

### SQLite Browser

**Launch:**
```bash
open -a "DB Browser for SQLite"
```

**Open Database:**
- File → Open Database
- Navigate to: `/Users/sheirraza/bsc-ranging-bot/database/trading_bot.db`

**Features:**
- Visual table editor
- SQL query builder
- Schema viewer
- Data export

---

### Clinic.js Profiler

**Profile Bot:**
```bash
# CPU profiling
clinic doctor -- node AdvancedTradingBot.js

# Flame graph
clinic flame -- node AdvancedTradingBot.js

# Bubble profiler
clinic bubbleprof -- node AdvancedTradingBot.js
```

**View Results:**
- Opens automatically in browser
- Identifies performance bottlenecks
- Memory leak detection

---

### Apache Superset

**Initialize:**
```bash
superset db upgrade
superset init
```

**Create Admin:**
```bash
superset fab create-admin
```

**Start:**
```bash
superset run -h 0.0.0.0 -p 8088
```

**Access:** http://localhost:8088

---

### TradingView Integration

**Setup Webhook Endpoint:**

Your bot needs to expose an endpoint for TradingView alerts.

**Add to AdvancedTradingBot.js:**
```javascript
// Webhook endpoint for TradingView
app.post('/webhook/tradingview', (req, res) => {
  const { symbol, action, price, strategy } = req.body;

  logger.info(`📊 TradingView signal: ${action} ${symbol} @ ${price}`);

  // Execute trade based on signal
  if (action === 'buy' || action === 'sell') {
    // Your trading logic here
  }

  res.status(200).json({ received: true });
});
```

**TradingView Alert Setup:**
1. Create alert on TradingView
2. Set webhook URL: `http://your-server:3001/webhook/tradingview`
3. Set message format:
```json
{
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": "{{close}}",
  "strategy": "{{strategy.order.id}}"
}
```

**Security:** Add authentication token validation

---

## 📊 VERIFICATION CHECKLIST

Run these commands to verify installations:

```bash
# PM2
pm2 --version
pm2 status

# Python tools
streamlit --version
jupyter --version
python3 -c "import pandas; print('Pandas:', pandas.__version__)"

# Node tools
clinic --version

# Brew tools
brew list | grep -E "grafana|prometheus|db-browser-for-sqlite"

# Services
brew services list | grep -E "grafana|prometheus"
```

---

## 🔧 CONFIGURATION FILES

### Environment Variables (.env)

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your-token-here
TELEGRAM_CHAT_ID=your-chat-id-here

# Discord
DISCORD_WEBHOOK_URL=your-webhook-url-here

# Grafana (optional)
GRAFANA_API_KEY=your-api-key

# Database
DATABASE_PATH=./database/trading_bot.db

# Bot Configuration
SHADOW_MODE=true
MAX_POSITION_SIZE=0.15
TAKE_PROFIT_PERCENT=0.005
STOP_LOSS_PERCENT=0.02
```

---

## 📈 MONITORING BEST PRACTICES

### 1. Daily Routine
```bash
# Morning: Check bot status
pm2 status
pm2 logs trading-bot --lines 50

# Launch dashboard
streamlit run monitoring/app.py
```

### 2. Weekly Analysis
```bash
# Launch Jupyter
jupyter notebook

# Open analysis notebook
# Review: win rate, P&L, drawdown, Sharpe ratio
```

### 3. Performance Monitoring
```bash
# Run profiler monthly
clinic doctor -- node AdvancedTradingBot.js

# Check Grafana dashboards daily
open http://localhost:3000
```

---

## 🚨 TROUBLESHOOTING

### PM2 Issues

**Bot not starting:**
```bash
pm2 delete trading-bot
pm2 start AdvancedTradingBot.js --name "trading-bot"
```

**Logs not showing:**
```bash
pm2 flush  # Clear logs
pm2 logs trading-bot --lines 100
```

### Streamlit Issues

**Port already in use:**
```bash
streamlit run monitoring/app.py --server.port 8502
```

### Grafana Issues

**Can't access dashboard:**
```bash
brew services restart grafana
open http://localhost:3000
```

### Database Issues

**Database locked:**
```bash
# Stop bot
pm2 stop trading-bot

# Open with SQLite Browser
# Close all connections

# Restart bot
pm2 restart trading-bot
```

---

## 📚 USEFUL RESOURCES

### Documentation
- **PM2:** https://pm2.keymetrics.io/docs/
- **Streamlit:** https://docs.streamlit.io/
- **Grafana:** https://grafana.com/docs/
- **Prometheus:** https://prometheus.io/docs/
- **Jupyter:** https://jupyter.org/documentation

### Tutorials
- **TradingView Webhooks:** https://www.tradingview.com/support/solutions/43000529348
- **Discord Webhooks:** https://support.discord.com/hc/en-us/articles/228383668
- **Telegram Bots:** https://core.telegram.org/bots

---

## ✅ NEXT STEPS

1. **Configure Telegram** - Set up bot token and chat ID
2. **Configure Discord** - Set up webhook URL
3. **Launch Streamlit** - Start monitoring dashboard
4. **Set up Grafana** - Import bot metrics dashboard
5. **Create Jupyter Notebook** - Analyze trade performance
6. **Test Alerts** - Verify all notification channels

---

**Installation Complete!** 🎉

Your trading bot now has professional-grade monitoring, alerting, and analysis tools.

For questions or issues, refer to the individual tool documentation or check the troubleshooting section.
