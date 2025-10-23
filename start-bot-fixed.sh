#!/bin/bash
# Quick Start Bot with Fixes Applied
# Generated: October 8, 2025, 10:15 PM

echo "=================================="
echo "🤖 BSC Trading Bot - Quick Start"
echo "=================================="
echo ""

# Change to bot directory
cd /Users/sheirraza/bsc-ranging-bot || exit 1

# Step 1: Verify fixes
echo "📝 Step 1: Verifying syntax..."
node -c agents/TradingStrategyAgent.js
if [ $? -eq 0 ]; then
  echo "✅ Code syntax OK"
else
  echo "❌ Syntax error detected!"
  exit 1
fi

# Step 2: Backup and clean logs
echo ""
echo "🧹 Step 2: Cleaning logs..."
if [ -f logs/combined.log ] && [ -s logs/combined.log ]; then
  BACKUP_FILE="logs_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
  tar -czf "$BACKUP_FILE" logs/
  echo "✅ Logs backed up to: $BACKUP_FILE"
fi

# Clean logs
> logs/combined.log
> logs/error.log
echo "Log files cleaned on $(date)" > logs/CLEANED.txt
echo "✅ Logs cleaned"

# Step 3: Check environment
echo ""
echo "🔍 Step 3: Checking environment..."
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  exit 1
fi

if grep -q "ANTHROPIC_API_KEY=sk-ant" .env; then
  echo "✅ Anthropic API key found"
else
  echo "⚠️  Warning: No Anthropic API key detected"
fi

# Step 4: Check for running instances
echo ""
echo "🔍 Step 4: Checking for running instances..."
if pgrep -f "start-shadow-mode.js" > /dev/null; then
  echo "⚠️  Bot is already running!"
  echo "   PID: $(pgrep -f 'start-shadow-mode.js')"
  read -p "   Stop and restart? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    pkill -f "start-shadow-mode.js"
    echo "✅ Stopped existing instance"
    sleep 2
  else
    echo "❌ Cancelled"
    exit 0
  fi
else
  echo "✅ No running instances found"
fi

# Step 5: Start bot
echo ""
echo "🚀 Step 5: Starting bot in shadow mode..."
echo "   Logs: tail -f logs/combined.log logs/error.log"
echo "   Stop: pkill -f 'start-shadow-mode.js'"
echo ""
read -p "Start now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🤖 Starting bot..."
  npm run start-shadow > /dev/null 2>&1 &
  BOT_PID=$!
  echo "✅ Bot started! PID: $BOT_PID"
  echo ""
  echo "📊 Monitor with:"
  echo "   tail -f logs/combined.log"
  echo "   tail -f logs/error.log"
  echo ""
  echo "🛑 Stop with:"
  echo "   pkill -f 'start-shadow-mode.js'"
  echo ""

  # Wait a few seconds and check if still running
  sleep 5
  if ps -p $BOT_PID > /dev/null; then
    echo "✅ Bot is running successfully!"
    echo ""
    echo "🔍 Checking first few log lines..."
    sleep 2
    tail -20 logs/combined.log
  else
    echo "❌ Bot failed to start! Check logs:"
    tail -50 logs/error.log
    exit 1
  fi
else
  echo "❌ Cancelled"
  exit 0
fi

echo ""
echo "=================================="
echo "✅ Bot Started Successfully!"
echo "=================================="
echo ""
echo "📋 Next Steps:"
echo "1. Monitor for 30 minutes: tail -f logs/combined.log"
echo "2. Check for errors: tail -f logs/error.log"
echo "3. Verify no 'toUpperCase' errors: grep toUpperCase logs/error.log"
echo "4. Check AI errors have details: grep 'AI strategy' logs/error.log"
echo ""
echo "📊 Status report: cat BOT_STATUS_REPORT.md"
echo "🐛 Bug fixes applied: cat BUGS_FIXED_REPORT.md"
echo ""
