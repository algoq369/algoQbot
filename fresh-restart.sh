#!/bin/bash

echo "🔄 Step 1: Nuclear kill of all node processes..."
pkill -9 node
sleep 2

echo "🔄 Step 2: Force kill anything on port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2

echo "🔄 Step 3: Verify port is free..."
if lsof -i:3001 > /dev/null 2>&1; then
  echo "❌ Port 3001 still occupied, trying port 3002 instead..."
  export API_PORT=3002
else
  echo "✅ Port 3001 is free"
  export API_PORT=3001
fi

echo "🔄 Step 4: Change port permanently in code..."
cd ~/bsc-ranging-bot
sed -i.bak 's/port 3001/port 3002/g' AdvancedTradingBot.js
sed -i.bak 's/:3001/:3002/g' AdvancedTradingBot.js

echo "✅ Port changed to 3002 permanently"

echo "🚀 Step 5: Starting bot on port 3002..."
node AdvancedTradingBot.js > /dev/null 2>&1 &

echo "⏳ Waiting 15 seconds for initialization..."
sleep 15

echo "📊 Step 6: Checking bot status..."
if ps aux | grep -v grep | grep "AdvancedTradingBot.js" > /dev/null; then
  echo "✅ Bot is RUNNING"
  echo "🌐 API Server on: http://localhost:3002"
  echo ""
  echo "📊 Monitoring 8-indicator logs (Press Ctrl+C to stop)..."
  tail -f logs/combined-$(date +%Y-%m-%d).log | grep --line-buffered -E "\[1/8\]|\[8/8\]|FINAL CONFIDENCE"
else
  echo "❌ Bot failed to start, checking logs..."
  tail -50 logs/combined-$(date +%Y-%m-%d).log
fi
