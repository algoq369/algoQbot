# 🚀 Quick Start Commands

**Last Updated:** December 3, 2025

---

## 🤖 Start Trading Bot

### Option 1: Simple Start (Foreground)
```bash
cd /Users/sheirraza/algoQbot && npm start
```

### Option 2: Start in Background
```bash
cd /Users/sheirraza/algoQbot && npm start > logs/bot-console.log 2>&1 &
```

### Option 3: Start with PM2 (Recommended for Production)
```bash
cd /Users/sheirraza/algoQbot
pm2 start AdvancedTradingBot.js --name algoqbot
pm2 save
pm2 startup
```

### Option 4: Start Shadow Mode (Testing - No Real Trades)
```bash
cd /Users/sheirraza/algoQbot && npm run start-shadow
```

---

## 📊 Start Monitoring Dashboard

### Option 1: Position Monitoring Script (Hourly Reports)
```bash
cd /Users/sheirraza/algoQbot && node scripts/monitor-positions.js > logs/position-monitoring.log 2>&1 &
```

### Option 2: Start Monitoring in Background
```bash
cd /Users/sheirraza/algoQbot && nohup node scripts/monitor-positions.js > logs/monitoring-console.log 2>&1 &
```

### Option 3: Use Monitoring Script (if available)
```bash
cd /Users/sheirraza/algoQbot && ./start-monitoring.sh
```

### Option 4: Streamlit Dashboard (if installed)
```bash
cd /Users/sheirraza/algoQbot && npm run monitor
```

---

## 🔍 Check Status

### Check if Bot is Running
```bash
ps aux | grep "AdvancedTradingBot" | grep -v grep
```

### Check if Monitoring is Running
```bash
ps aux | grep "monitor-positions" | grep -v grep
```

### View Bot Logs (Real-time)
```bash
tail -f /Users/sheirraza/algoQbot/logs/combined.log
```

### View Monitoring Logs (Real-time)
```bash
tail -f /Users/sheirraza/algoQbot/logs/position-monitoring.log
```

### View Latest Monitoring Summary
```bash
cat /Users/sheirraza/algoQbot/data/monitoring-summary.json | jq
```

---

## 🛑 Stop Commands

### Stop Bot
```bash
# Find and kill bot process
pkill -f "AdvancedTradingBot"

# Or if using PM2
pm2 stop algoqbot
```

### Stop Monitoring
```bash
# Find and kill monitoring process
pkill -f "monitor-positions"
```

---

## 📋 Complete Startup Sequence

### Start Everything (Bot + Monitoring)
```bash
cd /Users/sheirraza/algoQbot

# Start bot in background
npm start > logs/bot-console.log 2>&1 &

# Start monitoring in background
nohup node scripts/monitor-positions.js > logs/monitoring-console.log 2>&1 &

# Wait a moment
sleep 3

# Check status
echo "Bot Status:"
ps aux | grep "AdvancedTradingBot" | grep -v grep || echo "❌ Bot not running"

echo "Monitoring Status:"
ps aux | grep "monitor-positions" | grep -v grep || echo "❌ Monitoring not running"

echo ""
echo "✅ Startup complete!"
echo "📊 View logs: tail -f logs/combined.log"
echo "📈 View monitoring: tail -f logs/position-monitoring.log"
```

---

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3001 (if bot uses this port)
lsof -ti:3001 | xargs kill -9 2>/dev/null
```

### Check Bot Health
```bash
cd /Users/sheirraza/algoQbot && npm run health-check
```

### View Recent Errors
```bash
tail -100 /Users/sheirraza/algoQbot/logs/error-$(date +%Y-%m-%d).log
```

---

## 📊 Monitoring Dashboard Access

### Real-time Monitoring Data
The bot automatically updates `data/monitoring-summary.json` every minute with:
- Bot status (running/stopped)
- Market status (price, regime, volatility)
- Portfolio (balances, value, allocation)
- Positions (active positions, P&L)
- Risk metrics (drawdown, circuit breaker status)

### View Monitoring Summary
```bash
# Pretty print JSON
cat /Users/sheirraza/algoQbot/data/monitoring-summary.json | jq

# Or view specific fields
cat /Users/sheirraza/algoQbot/data/monitoring-summary.json | jq '.botStatus'
cat /Users/sheirraza/algoQbot/data/monitoring-summary.json | jq '.portfolio'
cat /Users/sheirraza/algoQbot/data/monitoring-summary.json | jq '.risk'
```

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| **Start Bot** | `cd /Users/sheirraza/algoQbot && npm start &` |
| **Start Monitoring** | `cd /Users/sheirraza/algoQbot && node scripts/monitor-positions.js &` |
| **View Bot Logs** | `tail -f /Users/sheirraza/algoQbot/logs/combined.log` |
| **View Monitoring** | `tail -f /Users/sheirraza/algoQbot/logs/position-monitoring.log` |
| **Check Status** | `ps aux \| grep -E "(AdvancedTradingBot\|monitor-positions)"` |
| **Stop Bot** | `pkill -f "AdvancedTradingBot"` |
| **Stop Monitoring** | `pkill -f "monitor-positions"` |

---

**Note:** Make sure you're in the correct directory (`/Users/sheirraza/algoQbot`) before running commands.

