# 🐛 BugBot Quick Start

## 🚀 Start Using BugBot Now (3 Commands)

### 1. Start Your Bot (BugBot runs automatically)
```bash
cd /Users/sheirraza/bsc-ranging-bot
npm start
```

### 2. Check BugBot Status
```bash
./check-bugbot.sh
```

### 3. Open BugBot Dashboard
Visit: **https://cursor.com/dashboard?tab=bugbot**

---

## ✅ What Just Happened?

BugBot is now **actively monitoring** your trading bot for:

- ✅ Exit system failures (0 exits bug)
- ✅ Position monitoring issues
- ✅ Take profit not being reached
- ✅ Stop loss not triggering
- ✅ Price data errors
- ✅ Database failures
- ✅ Risk management bypasses
- ✅ Memory leaks

### Automatic Detection
- **Runs every 5 minutes**
- **Checks 8+ bug patterns**
- **Monitors trading metrics**
- **Provides fix suggestions**

---

## 🎯 Fix Your Current Bug (0 Exits Issue)

BugBot has detected: **359 trades, 0 exits, $0 P&L**

### Quick Fix (30 seconds):

```bash
# 1. Lower take profit from 0.8% to 0.3%
sed -i '' 's/FIXED_TP_PERCENT = 0.008/FIXED_TP_PERCENT = 0.003/g' agents/TradingStrategyAgent.js

# 2. Restart bot
lsof -ti:3001 | xargs kill -9
npm start

# 3. Check in 10 minutes if exits are happening
sleep 600
./check-bugbot.sh
```

**Expected Result:**
- Within 1 hour: 10-20 exits
- P&L starts accumulating
- BugBot alert clears

---

## 📊 Monitor BugBot

### Real-Time Monitoring
```bash
# Watch for bug alerts
tail -f logs/combined.log | grep "CRITICAL BUG"

# Watch BugBot reports
tail -f logs/bugbot-reports.json | jq '.'

# Auto-refresh BugBot status every 30s
watch -n 30 './check-bugbot.sh'
```

### API Checks
```bash
# Get BugBot status as JSON
curl -s http://localhost:3001/api/bugbot/status | jq

# Get overall bot health
curl -s http://localhost:3001/api/health | jq

# Get trading stats
curl -s http://localhost:3001/api/status | jq
```

---

## 🔔 What BugBot Alerts Look Like

### In Logs (logs/combined.log):
```
🚨 CRITICAL BUG DETECTED: Exit system not working properly
Type: exitFailure
Category: trading_logic
Log: "no exits in 11 hours"
💡 Fix suggestion: Check if monitorPositions() cron job is running...
```

### In API (http://localhost:3001/api/bugbot/status):
```json
{
  "status": "issues_detected",
  "criticalBugsCount": 1,
  "criticalBugs": [
    {
      "type": "zero_exits",
      "severity": "critical",
      "description": "359 trades created but 0 exits",
      "timestamp": "2025-10-09T09:29:00Z"
    }
  ]
}
```

### In Cursor Dashboard:
- Red alert badge
- Bug description
- Suggested fixes
- Code location

---

## 🎓 Learn More

Full guide: `BUGBOT_SETUP_GUIDE.md`

Quick commands:
- Check status: `./check-bugbot.sh`
- View logs: `tail -f logs/combined.log | grep CRITICAL`
- View reports: `cat logs/bugbot-reports.json | jq`
- Dashboard: https://cursor.com/dashboard?tab=bugbot

---

## ✨ Benefits

1. **Automatic Detection** - Finds bugs you might miss
2. **Fix Suggestions** - Tells you exactly what to do
3. **Trading-Specific** - Tuned for crypto trading bots
4. **Real-Time Alerts** - Know immediately when issues arise
5. **Historical Data** - Track bugs over time
6. **CI/CD Ready** - Can integrate with deployment pipelines

---

**Status:** ✅ BugBot Integration Complete
**Monitoring:** 🟢 Active
**Current Issues:** 🚨 1 Critical (exit system)
**Action Required:** Fix TP percentage (see above)







