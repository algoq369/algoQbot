# 🚀 Quick Reference - BSC Trading Bot

## 📋 **Essential Commands**

```bash
# Start bot in shadow mode (safe testing)
npm run start-shadow

# Start bot in production mode (real trading)
npm run start

# Run tests
npm test

# Check logs
tail -f logs/trading-bot.log

# Monitor shadow trades
cat .shadow-trades.json | jq '.'
```

## 🔧 **Key Files**

| File | Purpose | Status |
|------|---------|--------|
| `AdvancedTradingBot.js` | Main orchestrator | ✅ Fixed |
| `agents/TradingStrategyAgent.js` | AI decisions | ✅ Fixed |
| `utils/priceHistoryManager.js` | Persistent price data | ✅ New |
| `security/rateLimiter.js` | Rate limiting | ✅ Working |
| `testing/shadowMode.js` | Safe testing | ✅ Working |

## 🐛 **Recent Fixes Applied**

1. ✅ **Rate Limiter Null Error** - Fixed import issue
2. ✅ **Trade Validation Errors** - Fixed hold decision handling
3. ✅ **RAG System Crashes** - Made initialization optional
4. ✅ **Price History Bug** - Added persistent storage

## 📊 **Current Status**

- **Bot Status**: ✅ Ready for testing
- **Price History**: ✅ Persists across restarts
- **Shadow Mode**: ✅ Safe testing enabled
- **All Bugs**: ✅ Fixed and verified

## 🎯 **Next Steps**

1. **Extended Testing**: Run 48+ hours in shadow mode
2. **Performance Validation**: Check trading results
3. **Production Prep**: Final optimizations
4. **OpenAI Migration**: Move to Agent Builder

## ⚡ **Quick Debugging**

### Common Issues & Solutions:

**Bot won't start:**
```bash
# Check for syntax errors
node -c AdvancedTradingBot.js
node -c agents/TradingStrategyAgent.js

# Check dependencies
npm install
```

**Price history not persisting:**
```bash
# Check data directory
ls -la data/

# Verify file permissions
chmod 644 data/price-history.json
```

**Rate limiting errors:**
```bash
# Check rate limit state
cat data/ratelimit-state.json

# Reset if needed
rm data/ratelimit-state.json
```

**Shadow mode not recording:**
```bash
# Check shadow trades file
ls -la .shadow-trades.json

# Verify write permissions
touch .shadow-trades.json
```

## 🔍 **Monitoring Commands**

```bash
# Real-time log monitoring
tail -f logs/trading-bot.log | grep -E "(ERROR|WARN|TRADE|SHADOW)"

# Check bot process
ps aux | grep "node.*AdvancedTradingBot"

# Monitor price history growth
watch "wc -l data/price-history.json"

# Check shadow trade count
jq '.trades | length' .shadow-trades.json
```

## 📈 **Performance Metrics**

```bash
# Check bot uptime
ps -o etime,cmd -p $(pgrep -f "AdvancedTradingBot")

# Monitor memory usage
ps -o pid,vsz,rss,cmd -p $(pgrep -f "AdvancedTradingBot")

# Check disk usage
du -sh data/ logs/ backups/
```

## 🚨 **Emergency Procedures**

### Stop Bot Safely:
```bash
# Find bot process
ps aux | grep "AdvancedTradingBot"

# Kill gracefully (SIGTERM)
kill -TERM <PID>

# Force kill if needed (SIGKILL)
kill -KILL <PID>
```

### Reset Bot State:
```bash
# Backup current state
cp data/price-history.json data/price-history.json.backup

# Reset rate limiting
rm data/ratelimit-state.json

# Clear shadow trades
rm .shadow-trades.json
```

### Recovery from Crashes:
```bash
# Check crash logs
tail -50 logs/trading-bot.log

# Restore from backup
cp data/price-history.json.backup data/price-history.json

# Restart bot
npm run start-shadow
```

## 🎯 **Development Workflow**

1. **Make Changes** → Test in shadow mode
2. **Verify Fixes** → Check logs and behavior
3. **Extended Testing** → Run 24+ hours
4. **Performance Check** → Analyze results
5. **Production Deploy** → Real trading

## 📞 **Support Contacts**

- **Technical Issues**: Check logs first, then review code
- **Strategy Questions**: Refer to expert validations
- **Performance Issues**: Monitor metrics and optimize
- **Emergency**: Use emergency procedures above

---

**Last Updated**: After critical bug fixes
**Status**: Ready for extended testing
**Next Review**: After 48-hour shadow mode run
