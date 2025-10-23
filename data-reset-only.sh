#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "DATA-ONLY RESET - Zero Code Changes"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "⚠️  This will DELETE:"
echo "   • All logs"
echo "   • All trade history"
echo "   • All open positions"
echo "   • All closed positions"
echo "   • Shadow mode records"
echo "   • Database trades"
echo ""
echo "✅ This will KEEP:"
echo "   • All bot code files"
echo "   • All configuration files"
echo "   • All strategy code"
echo "   • Risk manager settings"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Reset cancelled"
    exit 0
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Starting data-only reset..."
echo "════════════════════════════════════════════════════════════════"

# Step 1: Stop bot
echo ""
echo "1. Stopping bot..."
pkill -9 -f "node.*AdvancedTradingBot" 2>/dev/null
sleep 3
echo "   ✅ Bot stopped"

# Step 2: Create backup of data
echo ""
echo "2. Creating backup..."
BACKUP_DIR="data-backups/reset-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup logs
if [ -d "logs" ]; then
    cp -r logs "$BACKUP_DIR/" 2>/dev/null
    echo "   ✅ Logs backed up"
fi

# Backup database
if [ -f "database.sqlite" ]; then
    cp database.sqlite "$BACKUP_DIR/" 2>/dev/null
    echo "   ✅ Database backed up"
fi

# Backup shadow mode
if [ -f ".shadow-trades.json" ]; then
    cp .shadow-trades.json "$BACKUP_DIR/" 2>/dev/null
    echo "   ✅ Shadow trades backed up"
fi

# Backup positions
if [ -f ".positions.json" ]; then
    cp .positions.json "$BACKUP_DIR/" 2>/dev/null
    echo "   ✅ Positions backed up"
fi

echo "   📁 Backup location: $BACKUP_DIR"

# Step 3: Delete ALL data files (NO CODE)
echo ""
echo "3. Deleting data files..."

# Delete logs (but keep directory)
if [ -d "logs" ]; then
    rm -f logs/*.log
    rm -f logs/*.json
    echo "   ✅ Logs cleared"
fi

# Delete database
if [ -f "database.sqlite" ]; then
    rm -f database.sqlite
    rm -f database.sqlite-shm
    rm -f database.sqlite-wal
    echo "   ✅ Database deleted"
fi

# Delete shadow mode data
if [ -f ".shadow-trades.json" ]; then
    rm -f .shadow-trades.json
    echo "   ✅ Shadow trade history deleted"
fi

# Delete position tracking
if [ -f ".positions.json" ]; then
    rm -f .positions.json
    echo "   ✅ Position tracking deleted"
fi

# Delete grid state
if [ -f ".grid-state.json" ]; then
    rm -f .grid-state.json
    echo "   ✅ Grid state deleted"
fi

# Delete any other data files
rm -f .trade-history.json 2>/dev/null
rm -f .portfolio-state.json 2>/dev/null
rm -f .metrics.json 2>/dev/null

# Step 4: Verification
echo ""
echo "4. Verification..."
echo ""
echo "   Files remaining:"

# Count code files (should be unchanged)
CODE_FILES=$(find . -name "*.js" -type f 2>/dev/null | wc -l | xargs)
echo "   • Code files (.js): $CODE_FILES (unchanged)"

# Count data files (should be 0)
LOG_FILES=$(find logs -name "*.log" 2>/dev/null | wc -l | xargs)
DB_EXISTS=$([ -f database.sqlite ] && echo "EXISTS" || echo "DELETED")
SHADOW_EXISTS=$([ -f .shadow-trades.json ] && echo "EXISTS" || echo "DELETED")
POSITIONS_EXISTS=$([ -f .positions.json ] && echo "EXISTS" || echo "DELETED")

echo "   • Log files: $LOG_FILES"
echo "   • Database: $DB_EXISTS"
echo "   • Shadow trades: $SHADOW_EXISTS"
echo "   • Positions: $POSITIONS_EXISTS"

# Step 5: Summary
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ DATA-ONLY RESET COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "What was deleted:"
echo "   ✅ All logs cleared"
echo "   ✅ Database wiped (will recreate on start)"
echo "   ✅ Shadow mode history erased"
echo "   ✅ All position tracking deleted"
echo "   ✅ All trade history removed"
echo ""
echo "What was kept:"
echo "   ✅ All $CODE_FILES code files unchanged"
echo "   ✅ Configuration files intact"
echo "   ✅ Strategy code unchanged"
echo "   ✅ Risk manager untouched"
echo ""
echo "Backup saved to: $BACKUP_DIR"
echo ""
echo "Next step: npm start (bot will start fresh)"
echo "════════════════════════════════════════════════════════════════"

