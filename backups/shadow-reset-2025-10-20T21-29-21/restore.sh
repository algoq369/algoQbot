#!/bin/bash
# Restore script for shadow reset backup: 2025-10-20T21-29-21
# Created: 2025-10-20T21:29:23.181Z

echo "🔄 Restoring shadow mode data from backup..."
echo ""

# Restore shadow trades
if [ -f "./backups/shadow-reset-2025-10-20T21-29-21/shadow-trades.json" ]; then
  cp "./backups/shadow-reset-2025-10-20T21-29-21/shadow-trades.json" ./data/shadow-trades.json
  echo "✅ Restored shadow trades"
fi

# Restore database
if [ -f "./backups/shadow-reset-2025-10-20T21-29-21/trading_bot.db" ]; then
  cp "./backups/shadow-reset-2025-10-20T21-29-21/trading_bot.db" ./data/trading_bot.db
  echo "✅ Restored database"
fi

# Restore price history
if [ -f "./backups/shadow-reset-2025-10-20T21-29-21/price-history.json" ]; then
  cp "./backups/shadow-reset-2025-10-20T21-29-21/price-history.json" ./data/price-history.json
  echo "✅ Restored price history"
fi

echo ""
echo "✅ Restore complete!"
echo "⚠️  Restart the bot to use restored data"
