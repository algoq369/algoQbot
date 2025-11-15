# Troubleshooting Guide

Solutions to common issues with algoQbot.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Trading Issues](#trading-issues)
- [Dashboard Issues](#dashboard-issues)

---

## Installation Issues

### Node.js Version Too Old

**Problem:**
```
Error: The engine "node" is incompatible with this module
```

**Solution:**
```bash
# Check current version
node --version

# Install Node.js 16+ (macOS)
brew install node@16

# Install Node.js 16+ (Linux)
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v16+ or higher
```

### npm install Fails

**Problem:**
```
npm ERR! code EACCES
npm ERR! syscall access
```

**Solution:**
```bash
# Fix permissions
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER /Users/$USER/algoQbot

# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### jq Command Not Found

**Problem:**
```
./monitor-dashboard-institutional.sh: line 69: jq: command not found
```

**Solution:**
```bash
# Install jq (macOS)
brew install jq

# Install jq (Linux)
sudo apt-get install jq

# Verify
jq --version
```

---

## Configuration Issues

### .env File Not Found

**Problem:**
```
Error: Cannot find module 'dotenv'
```

**Solution:**
```bash
# Create .env from example
cp .env.example .env

# Edit with your values
nano .env

# Verify file exists
ls -la .env
```

### Invalid Private Key

**Problem:**
```
Error: Invalid private key format
```

**Solution:**
```bash
# Private key should be 64 hex characters (without 0x prefix)
# CORRECT: abc123def456...  (64 characters)
# WRONG: 0xabc123def456...  (has 0x prefix)

# Verify length
echo -n "$PRIVATE_KEY" | wc -c
# Should output: 64
```

### RPC Connection Failed

**Problem:**
```
Error: Could not connect to BSC RPC
```

**Solution:**
```bash
# Test RPC connection
curl -X POST https://bsc-dataseed1.binance.org/ \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Try alternative RPC
BSC_RPC_URL=https://bsc-dataseed2.binance.org/

# Or use a paid provider
# QuickNode: https://www.quicknode.com/
# Ankr: https://www.ankr.com/
```

---

## Runtime Errors

### Insufficient Funds

**Problem:**
```
Error: Insufficient balance for trade
```

**Solution:**
```bash
# Check wallet balances on BSCScan
# https://bscscan.com/address/YOUR_WALLET_ADDRESS

# Verify USDT balance >= MIN_TRADE_AMOUNT
# Verify BNB balance >= 0.01 (for gas)

# Fund wallet if needed
```

### Gas Estimation Failed

**Problem:**
```
Error: Cannot estimate gas; transaction may fail
```

**Solution:**
```bash
# Increase gas limit multiplier in .env
GAS_LIMIT_MULTIPLIER=1.5

# Check BNB balance for gas
# Need at least 0.01 BNB

# Verify slippage tolerance
MAX_SLIPPAGE=2.0  # Increase if needed
```

### Nonce Too Low

**Problem:**
```
Error: Nonce too low
```

**Solution:**
```bash
# Restart the bot (nonce will reset)
# Ctrl+C to stop
npm run start-shadow

# If persists, clear pending transactions on BSCScan
```

### Anthropic API Error

**Problem:**
```
Error: Invalid API key (401)
```

**Solution:**
```bash
# Verify API key format
echo $ANTHROPIC_API_KEY | grep "sk-ant-"
# Should match: sk-ant-api...

# Check API key on Anthropic Console
# https://console.anthropic.com/

# Verify spending limits not exceeded

# Generate new key if needed
```

---

## Performance Issues

### Slow Analysis Time

**Problem:**
Bot taking > 1 second per analysis cycle.

**Solution:**
```bash
# Enable price caching
PRICE_CACHE_TTL=30

# Verify cache is working
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "Cache hit"

# Monitor performance
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "Performance"
```

### High RPC Call Count

**Problem:**
Too many RPC calls, hitting rate limits.

**Solution:**
```bash
# Increase cache TTL
PRICE_CACHE_TTL=60

# Use paid RPC provider (higher limits)
# QuickNode, Ankr, etc.

# Enable performance tracking
ENABLE_PERFORMANCE_TRACKING=true
```

### Memory Usage Growing

**Problem:**
Bot memory usage keeps increasing.

**Solution:**
```bash
# Restart bot daily (use cron or pm2)
# Add to crontab:
0 0 * * * /path/to/restart-bot.sh

# Or use PM2 auto-restart
pm2 start start-shadow-mode.js --max-memory-restart 500M
```

---

## Trading Issues

### Trades Not Executing

**Problem:**
Bot shows opportunities but doesn't trade.

**Solution:**
```bash
# Check if shadow mode is enabled
cat .env | grep SHADOW_MODE_ENABLED
# Should be 'false' for live trading

# Check confidence thresholds
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "confidence"
# Confidence must exceed threshold for regime

# Verify sufficient volatility
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "4h Volatility"
# Must exceed minimum for regime
```

### All Trades Failing

**Problem:**
```
Error: Transaction reverted
```

**Solution:**
```bash
# Check wallet has sufficient BNB for gas
# Need ~0.01 BNB minimum

# Increase slippage tolerance
MAX_SLIPPAGE=2.0

# Verify token addresses are correct
cat .env | grep "_ADDRESS"

# Check if trading pair has liquidity on DEX
```

### Circuit Breaker Activated

**Problem:**
```
Circuit breaker activated: Too many losses
```

**Solution:**
```bash
# Review recent trades
sqlite3 data/trading_bot.db "SELECT * FROM shadow_trades ORDER BY timestamp DESC LIMIT 20;"

# Adjust strategy or pause trading
# Circuit breaker is a safety feature

# Reset circuit breaker by restarting bot
# But first analyze why losses occurred!
```

### Position Size Too Small

**Problem:**
Positions are smaller than expected.

**Solution:**
```bash
# Check MIN_TRADE_AMOUNT setting
cat .env | grep MIN_TRADE_AMOUNT

# Verify portfolio balance
cat data/virtual_balances.json

# Check MAX_POSITION_SIZE limit
cat .env | grep MAX_POSITION_SIZE

# Review position sizing logic in logs
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "Position size"
```

---

## Dashboard Issues

### Dashboard Shows "No Data"

**Problem:**
Dashboard displays empty or "No data available".

**Solution:**
```bash
# Verify bot is running
ps aux | grep "start-shadow-mode.js"

# Check log file exists
ls -la logs/combined-$(date +%Y-%m-%d).log.1

# Verify log format
tail -1 logs/combined-$(date +%Y-%m-%d).log.1 | jq

# Wait 30-60 seconds for first data collection
```

### Dashboard Not Updating

**Problem:**
Dashboard shows stale data.

**Solution:**
```bash
# Use watch for auto-refresh
watch -n 10 ./monitor-dashboard-institutional.sh

# Or manually refresh
./monitor-dashboard-institutional.sh

# Verify log file is being written
tail -f logs/combined-$(date +%Y-%m-%d).log.1
```

### jq Parse Errors

**Problem:**
```
jq: parse error: Invalid numeric literal
```

**Solution:**
```bash
# Verify JSON format in logs
tail -10 logs/combined-$(date +%Y-%m-%d).log.1

# Check for malformed JSON
tail -100 logs/combined-$(date +%Y-%m-%d).log.1 | jq .

# If logs are corrupted, restart bot
```

---

## Database Issues

### Database Locked

**Problem:**
```
Error: database is locked
```

**Solution:**
```bash
# Stop all instances of the bot
pkill -f "start-shadow-mode.js"

# Wait a few seconds
sleep 5

# Restart
npm run start-shadow
```

### Cannot Open Database

**Problem:**
```
Error: unable to open database file
```

**Solution:**
```bash
# Create data directory
mkdir -p data

# Set permissions
chmod 755 data

# Verify path in .env
cat .env | grep DATABASE_PATH

# Let bot recreate database on next start
npm run start-shadow
```

---

## Network Issues

### Transactions Taking Too Long

**Problem:**
Transactions pending for minutes.

**Solution:**
```bash
# Increase gas price multiplier
GAS_PRICE_MULTIPLIER=1.5

# Check BSC network status
# https://bscscan.com/

# Use different RPC endpoint
BSC_RPC_URL=https://bsc-dataseed2.binance.org/
```

### Rate Limiting

**Problem:**
```
Error: Rate limit exceeded
```

**Solution:**
```bash
# Use paid RPC provider
# QuickNode: No rate limits
# Ankr: Higher limits

# Increase cache TTL
PRICE_CACHE_TTL=60

# Reduce analysis frequency (if customized)
```

---

## Debugging Tips

### Enable Debug Logging

```bash
# Set log level to debug
LOG_LEVEL=debug

# Restart bot
npm run start-shadow

# View debug logs
tail -f logs/combined-$(date +%Y-%m-%d).log.1
```

### Check Recent Errors

```bash
# View error logs
grep '"level":"error"' logs/combined-$(date +%Y-%m-%d).log.1 | tail -20

# Count errors
grep '"level":"error"' logs/combined-$(date +%Y-%m-%d).log.1 | wc -l
```

### Monitor in Real-Time

```bash
# Watch all activity
tail -f logs/combined-$(date +%Y-%m-%d).log.1

# Filter for specific events
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "Shadow Trade"
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "REGIME"
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "confidence"
```

### Test Components Individually

```bash
# Test RPC connection
curl -X POST $BSC_RPC_URL -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Test Anthropic API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

---

## Getting Help

If you can't resolve an issue:

1. **Search GitHub Issues**: Someone may have had the same problem
   - https://github.com/algoq369/algoQbot/issues

2. **Collect Information**:
   ```bash
   # System info
   uname -a
   node --version
   npm --version
   
   # Recent logs (sanitized!)
   tail -100 logs/combined-$(date +%Y-%m-%d).log.1 | grep -v "PRIVATE_KEY"
   
   # Configuration (sanitized!)
   cat .env | grep -v "PRIVATE_KEY" | grep -v "API_KEY"
   ```

3. **Open a GitHub Issue**:
   - Describe the problem
   - Include error messages (remove sensitive data!)
   - List steps you've tried
   - Attach relevant logs

4. **Emergency Stop**:
   ```bash
   # Stop bot immediately
   pkill -f "start-shadow-mode.js"
   
   # Verify stopped
   ps aux | grep "start-shadow"
   ```

---

## Preventive Measures

### Regular Maintenance

```bash
# Daily: Check logs for errors
grep '"level":"error"' logs/combined-$(date +%Y-%m-%d).log.1

# Weekly: Update dependencies
npm update

# Monthly: Rotate API keys
# Review and update security settings
```

### Monitoring Checklist

Daily checks:
- [ ] Bot is running
- [ ] No errors in logs
- [ ] Trades executing as expected
- [ ] Dashboard shows current data
- [ ] Wallet balances normal
- [ ] Performance metrics healthy

---

**Still stuck? Open a GitHub issue with details!**
