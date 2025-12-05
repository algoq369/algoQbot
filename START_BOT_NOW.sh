#!/bin/bash

# ═══════════════════════════════════════════════════════════
# START ALGOQBOT IN SHADOW MODE
# Quick start script with monitoring
# ═══════════════════════════════════════════════════════════

cd ~/algoQbot

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         STARTING ALGOQBOT IN SHADOW MODE                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if already running
if pm2 list 2>/dev/null | grep -q "algoqbot.*online"; then
  echo "⚠️  Bot is already running!"
  echo ""
  pm2 list | grep algoqbot
  echo ""
  echo "View logs: pm2 logs algoqbot"
  echo "Restart:   pm2 restart algoqbot"
  echo "Stop:      pm2 stop algoqbot"
  exit 0
fi

# Verify environment
echo "1️⃣  Verifying environment..."
if [ ! -f ".env" ]; then
  echo "❌ .env file not found!"
  exit 1
fi

if ! grep -q "SHADOW_MODE_ENABLED=true" .env; then
  echo "⚠️  SHADOW_MODE_ENABLED not set to true in .env"
  echo "   Adding it now..."
  echo "SHADOW_MODE_ENABLED=true" >> .env
fi

echo "   ✅ Shadow mode enabled in .env"
echo ""

# Start with PM2
echo "2️⃣  Starting bot with PM2..."
pm2 start npm --name "algoqbot" -- run start-shadow

if [ $? -eq 0 ]; then
  echo "   ✅ Bot started successfully"
  pm2 save
  echo ""
else
  echo "   ❌ Failed to start bot"
  echo ""
  echo "   Try manually:"
  echo "   npm run start-shadow"
  exit 1
fi

# Wait for initialization
echo "3️⃣  Waiting for initialization (10 seconds)..."
sleep 10
echo ""

# Show status
echo "4️⃣  Bot Status:"
pm2 list | grep algoqbot
echo ""

# Show recent logs
echo "5️⃣  Recent Logs (last 20 lines):"
echo "────────────────────────────────────────────────────"
pm2 logs algoqbot --lines 20 --nostream
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                   MONITORING COMMANDS                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Watch logs in real-time:"
echo "   pm2 logs algoqbot"
echo ""
echo "📈 Monitor shadow trades:"
echo "   watch -n 5 'tail -10 ~/algoQbot/data/shadow_trades.json'"
echo ""
echo "🔍 Quick status check:"
echo "   ~/algoQbot/quick-check.sh"
echo ""
echo "⏸️  Stop bot:"
echo "   pm2 stop algoqbot"
echo ""
echo "🔄 Restart bot:"
echo "   pm2 restart algoqbot"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Bot is running in shadow mode!"
echo "   Monitor for errors in the first 5 minutes"
echo "═══════════════════════════════════════════════════════════"

