#!/bin/bash
cd /Users/sheirraza/bsc-ranging-bot

echo "=== BSC Trading Bot Comprehensive Fix ==="

# 1. Stop any running bot processes
echo "Stopping bot..."
pkill -f "node.*AdvancedTradingBot" 2>/dev/null || true
sleep 2

# 2. Backup current state
echo "Creating backup..."
cp -r . ../bsc-ranging-bot-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# 3. Fix Claude API model (if any remaining)
echo "Fixing Claude API model..."
find . -name "*.js" -type f -exec sed -i '' 's/claude-3-5-sonnet-20241022/claude-sonnet-4-20250514/g' {} \; 2>/dev/null || true

# 4. Reset shadow mode balances to ensure clean state
echo "Resetting shadow balances..."
cat > /tmp/reset_shadow.js << 'EOF'
const fs = require('fs');
const file = './testing/shadowMode.js';
let content = fs.readFileSync(file, 'utf8');

// Find and replace initial balances
content = content.replace(
  /usdt:\s*\d+/g,
  'usdt: 30000'
);
content = content.replace(
  /bnb:\s*[\d.]+/g,
  'bnb: 1000'
);

fs.writeFileSync(file, content);
console.log('✅ Shadow balances reset to 30K USDT + 1K BNB');
EOF

node /tmp/reset_shadow.js

# 5. Clear old data
echo "Clearing old shadow trades..."
rm -f data/shadow_trades.json
echo "[]" > data/shadow_trades.json

# 6. Clear old database
echo "Clearing old database..."
rm -f data/trading_bot.db

# 7. Start bot
echo "Starting bot..."
npm start &

# 8. Wait for initialization
echo "Waiting for bot initialization..."
sleep 10

# 9. Check if bot is running
if pgrep -f "node.*AdvancedTradingBot" > /dev/null; then
    echo "✅ Bot is running successfully"
else
    echo "❌ Bot failed to start"
    exit 1
fi

echo "=== Fix Complete ==="
echo "Monitor logs: tail -f logs/combined.log"
echo "Expected: Position exits within 10 minutes at 0.5% profit"
