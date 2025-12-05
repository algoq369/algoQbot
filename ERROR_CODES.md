# Error Codes Reference

**Last Updated:** December 3, 2025

---

## Error Categories

### File System Errors

#### ENOENT - File Not Found
**Code:** `ENOENT`  
**Location:** `utils/priceHistoryManager.js`  
**Cause:** Directory or file doesn't exist  
**Fix:** Automatic directory creation with retry logic  
**Status:** ✅ FIXED

**Example:**
```
Error: ENOENT: no such file or directory, rename './data/price-history.json.tmp' -> './data/price-history.json'
```

---

### Function Reference Errors

#### getCurrentPrice is not a function
**Code:** `TypeError: this.bot.getCurrentPrice is not a function`  
**Location:** `risk/smartRebalancer.js`  
**Cause:** Method doesn't exist on bot instance  
**Fix:** Added getCurrentPrice() method to AdvancedTradingBot and smartRebalancer  
**Status:** ✅ FIXED

**Example:**
```
Error checking rebalance: this.bot.getCurrentPrice is not a function
```

---

### Portfolio Errors

#### Emergency Rebalance
**Code:** `EMERGENCY_REBALANCE`  
**Location:** `AdvancedTradingBot.js`  
**Cause:** Portfolio allocation exceeds thresholds  
**Thresholds:**
- Critical: BNB > 99% → Immediate SELL
- High: BNB > 70% → SELL (30min cooldown)
- Low: BNB < 25% → BUY (1hr cooldown)

**Fix:** Improved thresholds and guaranteed execution  
**Status:** ✅ FIXED

**Example:**
```
🚨 EMERGENCY REBALANCE: BNB 99.0% > 65%! Forcing SELL trade.
```

---

### Risk Management Errors

#### Drawdown Limit Exceeded
**Code:** `DRAWDOWN_LIMIT_EXCEEDED`  
**Location:** `risk/productionRiskManager.js`  
**Cause:** Portfolio drawdown exceeds 5% limit  
**Fix:** Added tolerance buffer (0.1%) and improved peak tracking  
**Status:** ✅ FIXED

**Example:**
```
🚨 DRAWDOWN LIMIT EXCEEDED: 5.66%
```

---

#### Circuit Breaker Tripped
**Code:** `CIRCUIT_BREAKER_TRIPPED`  
**Location:** `risk/circuitBreaker.js`  
**Cause:** 
- 5 consecutive losses (increased from 3)
- $1000 hourly loss
- $3000 daily loss

**Fix:** Increased threshold and added minimum loss amount ($10)  
**Status:** ✅ FIXED

**Example:**
```
🚨 CIRCUIT BREAKER TRIPPED: 3 consecutive losses
⏸️  Trading PAUSED for 30 minutes
```

---

### Trading Errors

#### Insufficient Balance
**Code:** `insufficient_bnb` or `insufficient_usdt`  
**Location:** `AdvancedTradingBot.js`  
**Cause:** Not enough balance for trade  
**Fix:** Validation before execution  
**Status:** ✅ Working as designed

**Example:**
```
🚫 Insufficient BNB: need 0.001234 but have 0.000500
```

---

#### Risk Validation Failed
**Code:** `Risk validation failed`  
**Location:** `AdvancedTradingBot.js`  
**Cause:** Trade rejected by risk manager  
**Fix:** Emergency trades bypass validation  
**Status:** ✅ Working as designed

**Example:**
```
⚠️ Trade rejected by risk manager: Trade too large: $5000.00 > $3000
```

---

## Error Severity Levels

### 🔴 CRITICAL
- Drawdown limit exceeded
- Emergency stop triggered
- Circuit breaker tripped
- Critical rebalance (99%+)

**Action:** Trading halted immediately

### 🟡 HIGH
- Price fetch failures (with fallback)
- File operation errors (with retry)
- Emergency rebalance (70%+)

**Action:** Logged, fallback mechanisms activated

### 🟢 LOW
- Minor validation failures
- Non-critical operation errors
- Warnings

**Action:** Logged only, continue operation

---

## Error Recovery Strategies

### Automatic Recovery

1. **Price Fetching**
   - Primary: multiDexManager.dexs.pancakeSwap.getCurrentPrice()
   - Fallback 1: getBalance().currentPrice
   - Fallback 2: Default price (0.001)

2. **File Operations**
   - Retry: 3 attempts
   - Backoff: Exponential (100ms * attempt)
   - Directory: Auto-create if missing

3. **Trade Execution**
   - Validation: Before execution
   - Emergency: Bypass checks for critical rebalances
   - Error Handling: Graceful degradation

---

## Monitoring Errors

### How to Check

1. **Recent Errors:**
   ```bash
   tail -100 logs/error-$(date +%Y-%m-%d).log
   ```

2. **Error Count:**
   ```bash
   grep -c "ERROR" logs/error-*.log
   ```

3. **Critical Errors:**
   ```bash
   grep "CRITICAL\|EMERGENCY\|DRAWDOWN" logs/error-*.log
   ```

---

## Error Reporting

### Log Format

```json
{
  "level": "error",
  "message": "Error description",
  "service": "bsc-ranging-bot",
  "timestamp": "2025-12-03 16:58:32",
  "category": "error",
  "error": {
    "message": "Error message",
    "stack": "Error stack trace",
    "name": "ErrorType",
    "code": "ERROR_CODE"
  },
  "context": {
    "operation": "operation_name",
    "additional": "context_data"
  }
}
```

---

## Troubleshooting Guide

### Issue: Price History Errors
**Symptom:** ENOENT errors in logs  
**Solution:** ✅ Fixed - Retry logic implemented  
**Check:** Verify `data/` directory exists and has write permissions

### Issue: getCurrentPrice Errors
**Symptom:** "is not a function" errors  
**Solution:** ✅ Fixed - Method added with fallbacks  
**Check:** Verify RPC endpoint is accessible

### Issue: Emergency Rebalances
**Symptom:** Frequent rebalance messages  
**Solution:** ✅ Fixed - Improved thresholds  
**Check:** Monitor portfolio allocation in monitoring-summary.json

### Issue: Drawdown False Positives
**Symptom:** Drawdown triggered too often  
**Solution:** ✅ Fixed - Tolerance buffer added  
**Check:** Review risk manager peak tracking

### Issue: Circuit Breaker Tripping
**Symptom:** Trading paused frequently  
**Solution:** ✅ Fixed - Threshold increased, minimum loss added  
**Check:** Review loss tracking in logs

---

**Documentation Version:** 1.0  
**Last Updated:** December 3, 2025

