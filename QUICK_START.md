# 🚀 Quick Start Commands

## Start Bot and Monitoring (Easiest Way)

```bash
cd /Users/sheirraza/algoQbot && ./start-bot-and-monitoring.sh
```

---

## Individual Commands

### 1. Start Trading Bot

```bash
cd /Users/sheirraza/algoQbot && npm start > logs/bot-console.log 2>&1 &
```

### 2. Start Monitoring Script

```bash
cd /Users/sheirraza/algoQbot && node scripts/monitor-positions.js > logs/monitoring-console.log 2>&1 &
```

### 3. View Monitoring Dashboard

```bash
cd /Users/sheirraza/algoQbot && ./monitor-dashboard-institutional.sh
```

**Auto-refresh (updates every 10 seconds):**
```bash
cd /Users/sheirraza/algoQbot && watch -n 10 ./monitor-dashboard-institutional.sh
```

---

## View Logs

**Bot logs (real-time):**
```bash
tail -f /Users/sheirraza/algoQbot/logs/combined-$(date +%Y-%m-%d).log
```

**Monitoring logs:**
```bash
tail -f /Users/sheirraza/algoQbot/logs/position-monitoring.log
```

**Latest monitoring summary:**
```bash
cat /Users/sheirraza/algoQbot/data/monitoring-summary.json | jq
```

---

## Check Status

```bash
ps aux | grep -E "(AdvancedTradingBot|monitor-positions)" | grep -v grep
```

---

## Stop Commands

**Stop bot:**
```bash
pkill -f "AdvancedTradingBot"
```

**Stop monitoring:**
```bash
pkill -f "monitor-positions"
```

**Stop both:**
```bash
pkill -f "AdvancedTradingBot" && pkill -f "monitor-positions"
```

