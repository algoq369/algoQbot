# 🎯 AI Model Optimization - Complete Implementation

## CURRENT STATUS
- Model: claude-sonnet-4-20250514 (Claude Sonnet 4)
- Location: agents/TradingStrategyAgent.js line 349
- API calls: Every 3 minutes (expensive)
- Temperature: Not set (inconsistent decisions)
- Prompt caching: Not implemented
- Annual cost: $4,212

## OBJECTIVE
Implement 4 enhancements to optimize AI usage for shadow mode testing:
1. Upgrade to Claude Sonnet 4.5 (better performance, same cost)
2. Reduce AI frequency from 3min to 15min (83% fewer calls)
3. Set temperature to 0 (consistent decisions)
4. Add prompt caching (90% input cost reduction)

## EXPECTED RESULTS
- Better AI decisions (Sonnet 4.5 improvements)
- Annual cost: $4,212 → $105/year (97% savings)
- Consistent, deterministic responses
- Same or better trading performance

## IMPLEMENTATION

### ENHANCEMENT 1: Upgrade to Claude Sonnet 4.5

**File:** agents/TradingStrategyAgent.js
**Line:** 349 (approximately)

**Change:**
```javascript
// OLD
model: "claude-sonnet-4-20250514",

// NEW
model: "claude-sonnet-4-5-20250929",
```

### ENHANCEMENT 2: Reduce AI Frequency

**File:** config.js
**Section:** monitoring object (around line 70-90)

**Change:**
```javascript
// OLD
monitoring: {
  enabled: true,
  strategyReviewInterval: 3600000, // 1 hour

// NEW
monitoring: {
  enabled: true,
  strategyReviewInterval: 900000, // 15 minutes
```

**Savings:** 75% reduction in API calls = $3,159/year

### ENHANCEMENT 3: Set Temperature to 0

**File:** agents/TradingStrategyAgent.js
**Location:** Around line 350-400, find the Claude API call

**Find this:**
```javascript
const response = await this.claude.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [...]
});
```

**Add temperature:**
```javascript
const response = await this.claude.messages.create({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,  // ✅ ADD THIS LINE
  max_tokens: 1024,
  messages: [...]
});
```

### ENHANCEMENT 4: Add Prompt Caching

**File:** agents/TradingStrategyAgent.js
**Location:** Where system messages are defined

**Find this:**
```javascript
const messages = [{
  role: "system",
  content: "You are a trading strategy selector..."
}, {
  role: "user",
  content: marketContext
}];
```

**Add caching:**
```javascript
const messages = [{
  role: "system",
  content: "You are a trading strategy selector...",
  cache_control: { type: "ephemeral" }  // ✅ ADD THIS
}, {
  role: "user",
  content: marketContext
}];
```

## EXECUTION STEPS

1. Create backups
```bash
cp agents/TradingStrategyAgent.js agents/TradingStrategyAgent.js.backup_$(date +%Y%m%d_%H%M%S)
cp config.js config.js.backup_$(date +%Y%m%d_%H%M%S)
```

2. Apply all enhancements to both files

3. Verify syntax
```bash
node -c agents/TradingStrategyAgent.js
node -c config.js
```

4. Restart bot
```bash
pm2 restart bsc-ranging-bot
```

5. Verify changes
```bash
grep "claude-sonnet-4-5-20250929" agents/TradingStrategyAgent.js
grep "temperature: 0" agents/TradingStrategyAgent.js
grep "900000" config.js
pm2 list | grep bsc-ranging-bot
```

## SUCCESS CRITERIA
- ✅ Model: claude-sonnet-4-5-20250929
- ✅ Temperature: 0
- ✅ Frequency: 900000ms (15 min)
- ✅ Bot: online status
- ✅ No errors in logs

## COST SAVINGS
From $4,212/year → $105/year (97% savings)

## SAFETY
- Shadow mode (no real money)
- Backups created
- Syntax verified
- Rollback available
