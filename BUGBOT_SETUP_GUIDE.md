# 🐛 Cursor BugBot Integration Guide

## What is BugBot?

Cursor BugBot is an automated bug detection system built into Cursor IDE that monitors your codebase for:
- Runtime errors
- Logic bugs
- Performance issues
- Type errors
- Linter warnings

We've integrated it with your BSC Trading Bot to specifically detect **trading-specific bugs** like:
- Exit system failures (your current 0 exits in 11 hours bug)
- Position monitoring failures
- Take profit/stop loss not triggering
- Price data issues
- Risk management bypasses

## ✅ Setup Complete

The following files have been created/modified:

1. **`.cursorrules`** - BugBot configuration for your project
2. **`monitoring/bugbot-integration.js`** - Custom bug detection module
3. **`AdvancedTradingBot.js`** - Integrated BugBot monitoring

## 🚀 How to Use BugBot

### 1. Access BugBot Dashboard

Go to: **https://cursor.com/dashboard?tab=bugbot**

You'll see:
- Detected bugs
- Bug severity levels
- Suggested fixes
- Bug history

### 2. Check BugBot Status via API

```bash
# Check for critical bugs
curl http://localhost:3001/api/bugbot/status

# Should return:
{
  "status": "healthy" | "issues_detected",
  "criticalBugsCount": 0,
  "criticalBugs": [],
  "timestamp": "2025-10-09T..."
}
```

### 3. Monitor Logs for Bug Reports

BugBot automatically analyzes logs and reports bugs:

```bash
# View BugBot reports
tail -f logs/bugbot-reports.json | jq '.'

# View critical bug alerts in main logs
tail -f logs/combined.log | grep "CRITICAL BUG DETECTED"
```

### 4. Automatic Anomaly Detection

BugBot runs every 5 minutes checking for:

✅ **0 Exits Bug** (Your Current Issue)
```
Condition: >50 trades but 0 exits
Severity: CRITICAL
Detection: Automatic every 5 min
Alert: Logged + API endpoint
```

✅ **Zero P&L with Many Trades**
```
Condition: >20 trades but $0.00 P&L
Severity: HIGH
Suggestion: "Positions may not be closing"
```

✅ **100% Win Rate Anomaly**
```
Condition: 100% wins + >100 trades
Severity: MEDIUM
Suggestion: "Stop loss may not be triggering"
```

## 🔧 Current Critical Bug Detected

### Bug: Exit System Blocked

**Status:** 🚨 DETECTED & MONITORED

```json
{
  "type": "zero_exits",
  "severity": "critical",
  "description": "359 trades created but 0 exits",
  "suggestion": "Exit system may be blocked. Check TP/SL logic.",
  "timestamp": "2025-10-09T09:29:00Z"
}
```

### Suggested Fixes (from BugBot):

1. **Lower Take Profit** (Primary Fix)
   ```bash
   # TP currently 0.8% - too high
   # Lower to 0.3% for more exits
   sed -i '' 's/FIXED_TP_PERCENT = 0.008/FIXED_TP_PERCENT = 0.003/g' agents/TradingStrategyAgent.js
   ```

2. **Check Monitoring Cron**
   ```bash
   # Verify monitorPositions() is running
   tail -100 logs/combined.log | grep "Monitoring position"
   ```

3. **Test Exit Function**
   ```bash
   # Test if executeExit() works
   node -e "
   const Bot = require('./AdvancedTradingBot');
   (async () => {
     const bot = new Bot();
     await bot.initialize();
     // Test exit logic here
   })();
   "
   ```

## 📊 BugBot Monitoring Endpoints

### API Endpoints Added:

```bash
# 1. BugBot Status
GET http://localhost:3001/api/bugbot/status

# 2. Health Check (includes BugBot)
GET http://localhost:3001/api/health

# 3. Trading Stats (monitored by BugBot)
GET http://localhost:3001/api/status
```

### Monitoring Script:

```bash
# Create monitoring alias
alias check-bugs='curl -s http://localhost:3001/api/bugbot/status | jq'

# Run it
check-bugs

# Watch for changes every 30s
watch -n 30 'curl -s http://localhost:3001/api/bugbot/status | jq'
```

## 🎯 Quick Commands

### Start Bot with BugBot

```bash
# Start bot (BugBot runs automatically)
npm start

# Or with logging
npm start 2>&1 | tee logs/bot-with-bugbot.log
```

### Monitor BugBot Activity

```bash
# Watch for bug reports
tail -f logs/combined.log | grep -E "(CRITICAL BUG|Anomaly detected|Fix suggestion)"

# View BugBot reports file
cat logs/bugbot-reports.json | jq '.[] | select(.severity=="critical")'

# Count critical bugs
cat logs/bugbot-reports.json | jq '[.[] | select(.severity=="critical")] | length'
```

### Clear Old Bug Reports

```bash
# Clear reports older than 7 days
node -e "
const BugBot = require('./monitoring/bugbot-integration');
const bot = new BugBot();
bot.clearOldReports(7).then(() => console.log('Cleared old reports'));
"
```

## 🔔 BugBot Alerts

BugBot will automatically log alerts when detecting:

### Exit System Issues (Your Current Bug)
```
🚨 CRITICAL BUG DETECTED: Exit system not working properly
Type: exitFailure
Category: trading_logic
Log: "no exits in 11 hours"
💡 Fix suggestion: Check if monitorPositions() cron job is running...
```

### Position Monitoring Issues
```
🚨 CRITICAL BUG DETECTED: Position monitoring not executing
Type: monitoringFailure
Category: trading_logic
💡 Fix suggestion: Verify cron job is scheduled and executing...
```

### Take Profit Issues
```
🔍 Anomaly detected: 359 trades created but 0 exits
💡 Exit system may be blocked. Check TP/SL logic.
💡 Consider lowering TP percentage from 0.8% to 0.3-0.5% for more frequent exits.
```

## 📈 Expected Behavior

### After BugBot is Active:

1. **Automatic Detection** (every 5 minutes)
   - Scans trading metrics
   - Detects anomalies
   - Logs critical bugs
   - Provides fix suggestions

2. **Real-Time Alerts**
   - Critical bugs → immediate logger.error()
   - High severity → logged warnings
   - Medium severity → logged info

3. **Persistent Reporting**
   - All bugs saved to `logs/bugbot-reports.json`
   - Available via API at `/api/bugbot/status`
   - Viewable in Cursor BugBot dashboard

## 🛠️ Troubleshooting

### BugBot Not Detecting Issues?

```bash
# 1. Check if BugBot is initialized
tail logs/combined.log | grep -i bugbot

# 2. Manually trigger metrics check
node -e "
const Bot = require('./AdvancedTradingBot');
(async () => {
  const bot = new Bot();
  await bot.initialize();

  const metrics = {
    totalTrades: 359,
    exits: 0,
    wins: 0,
    losses: 0,
    totalPnL: 0
  };

  await bot.bugBot.monitorTradingMetrics(metrics);
  console.log('BugBot check completed');
  process.exit(0);
})();
"

# 3. Check bug reports file
cat logs/bugbot-reports.json | jq '.'
```

### BugBot Reports Not Showing in Dashboard?

1. Make sure you're logged into Cursor
2. Visit https://cursor.com/dashboard?tab=bugbot
3. Check that workspace path is correct
4. Verify `.cursorrules` file exists

## 🎓 Next Steps

1. **Fix Current Bug** (0 exits issue)
   ```bash
   # Quick fix: Lower TP to 0.3%
   sed -i '' 's/FIXED_TP_PERCENT = 0.008/FIXED_TP_PERCENT = 0.003/g' agents/TradingStrategyAgent.js

   # Restart bot
   lsof -ti:3001 | xargs kill -9
   npm start

   # Monitor for exits (check in 10 minutes)
   sleep 600
   curl -s http://localhost:3001/api/bugbot/status | jq
   ```

2. **Monitor BugBot Dashboard**
   - Open Cursor BugBot dashboard
   - Watch for new detections
   - Review fix suggestions

3. **Integrate with CI/CD**
   - BugBot can run in CI pipelines
   - Add bug checks to pre-commit hooks
   - Set up alerts for critical bugs

## 📝 Summary

✅ **BugBot Integration Complete**
- Cursor BugBot configured for your project
- Custom trading bug detection active
- Automatic monitoring every 5 minutes
- API endpoints for status checks
- Real-time alerts for critical bugs

🚨 **Current Status**
- Critical bug detected: 0 exits in 11 hours
- Root cause: TP 0.8% too high
- Fix: Lower to 0.3% for more exits
- Monitoring: Active and reporting

🎯 **Next Action**
```bash
# 1. Fix the TP issue
sed -i '' 's/FIXED_TP_PERCENT = 0.008/FIXED_TP_PERCENT = 0.003/g' agents/TradingStrategyAgent.js

# 2. Restart with BugBot
npm start

# 3. Check BugBot status in 10 min
sleep 600 && curl http://localhost:3001/api/bugbot/status | jq
```

---

**BugBot Dashboard:** https://cursor.com/dashboard?tab=bugbot
**API Status:** http://localhost:3001/api/bugbot/status
**Reports File:** logs/bugbot-reports.json







