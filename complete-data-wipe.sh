#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# COMPLETE DATA WIPE SCRIPT (Fixed Version)
# Targets the CORRECT database files this time
# ═══════════════════════════════════════════════════════════════

set -e  # Exit on error

echo ""
echo "════════════════════════════════════════════════════════════"
echo "   COMPLETE DATA WIPE - Fixed Version"
echo "   This will delete ALL trading data including:"
echo "   - data/trading_bot.db (1.5GB - the actual database)"
echo "   - All other database files"
echo "   - All logs"
echo "   - bugbot-reports.json"
echo "   - Shadow trades, positions, grid state"
echo "════════════════════════════════════════════════════════════"
echo ""

# Get timestamp for backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="data-backups/complete-wipe-$TIMESTAMP"

echo "📦 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo ""
echo "🔍 Checking what will be deleted:"
echo ""

# Check database files
echo "📊 Database files:"
[ -f "data/trading_bot.db" ] && ls -lh data/trading_bot.db && echo "   ✅ data/trading_bot.db (WILL BE DELETED)"
[ -f "database/trading_bot.db" ] && ls -lh database/trading_bot.db && echo "   ✅ database/trading_bot.db (WILL BE DELETED)"
[ -f "database.sqlite" ] && ls -lh database.sqlite && echo "   ✅ database.sqlite (WILL BE DELETED)"

echo ""
echo "📝 Log files:"
LOG_COUNT=$(ls -1 logs/*.log 2>/dev/null | wc -l | tr -d ' ')
echo "   Found $LOG_COUNT log files (WILL BE DELETED)"

echo ""
echo "🐛 BugBot reports:"
[ -f "logs/bugbot-reports.json" ] && ls -lh logs/bugbot-reports.json && echo "   ✅ bugbot-reports.json (WILL BE DELETED)"

echo ""
echo "💾 Data files:"
[ -f ".shadow-trades.json" ] && echo "   ✅ .shadow-trades.json (WILL BE DELETED)"
[ -f ".positions.json" ] && echo "   ✅ .positions.json (WILL BE DELETED)"
[ -f ".grid-state.json" ] && echo "   ✅ .grid-state.json (WILL BE DELETED)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
read -p "⚠️  Are you sure you want to DELETE ALL this data? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Aborted by user"
    exit 1
fi

echo ""
echo "🛑 Step 1: Stopping bot..."
pkill -9 -f "node.*AdvancedTradingBot" 2>/dev/null || echo "   Bot not running"
sleep 2

echo ""
echo "💾 Step 2: Creating backup..."

# Backup database files
[ -f "data/trading_bot.db" ] && cp data/trading_bot.db "$BACKUP_DIR/" && echo "   ✅ Backed up data/trading_bot.db"
[ -f "database/trading_bot.db" ] && cp database/trading_bot.db "$BACKUP_DIR/" && echo "   ✅ Backed up database/trading_bot.db"
[ -f "database.sqlite" ] && cp database.sqlite "$BACKUP_DIR/" && echo "   ✅ Backed up database.sqlite"

# Backup logs
mkdir -p "$BACKUP_DIR/logs"
cp logs/*.log "$BACKUP_DIR/logs/" 2>/dev/null && echo "   ✅ Backed up log files"
[ -f "logs/bugbot-reports.json" ] && cp logs/bugbot-reports.json "$BACKUP_DIR/logs/" && echo "   ✅ Backed up bugbot-reports.json"

# Backup data files
[ -f ".shadow-trades.json" ] && cp .shadow-trades.json "$BACKUP_DIR/" && echo "   ✅ Backed up .shadow-trades.json"
[ -f ".positions.json" ] && cp .positions.json "$BACKUP_DIR/" && echo "   ✅ Backed up .positions.json"
[ -f ".grid-state.json" ] && cp .grid-state.json "$BACKUP_DIR/" && echo "   ✅ Backed up .grid-state.json"

echo ""
echo "🗑️  Step 3: Deleting data..."

# Delete database files
if [ -f "data/trading_bot.db" ]; then
    rm -f data/trading_bot.db
    echo "   ✅ Deleted data/trading_bot.db (1.5GB)"
fi

if [ -f "database/trading_bot.db" ]; then
    rm -f database/trading_bot.db
    echo "   ✅ Deleted database/trading_bot.db"
fi

if [ -f "database.sqlite" ]; then
    rm -f database.sqlite
    echo "   ✅ Deleted database.sqlite"
fi

# Delete logs
rm -f logs/*.log 2>/dev/null && echo "   ✅ Deleted all log files"

# Delete bugbot reports
if [ -f "logs/bugbot-reports.json" ]; then
    rm -f logs/bugbot-reports.json
    echo "   ✅ Deleted bugbot-reports.json"
fi

# Delete data files
[ -f ".shadow-trades.json" ] && rm -f .shadow-trades.json && echo "   ✅ Deleted .shadow-trades.json"
[ -f ".positions.json" ] && rm -f .positions.json && echo "   ✅ Deleted .positions.json"
[ -f ".grid-state.json" ] && rm -f .grid-state.json && echo "   ✅ Deleted .grid-state.json"

# Delete log files in root directory (from previous sessions)
rm -f bot-fresh-start.log bot-multiplier-fix.log bot-getprice-fix.log bot.log 2>/dev/null && echo "   ✅ Deleted root log files"

echo ""
echo "✅ Step 4: Verifying cleanup..."

# Verify deletions
echo ""
echo "🔍 Verification:"

if [ -f "data/trading_bot.db" ]; then
    echo "   ❌ ERROR: data/trading_bot.db still exists!"
    exit 1
else
    echo "   ✅ data/trading_bot.db deleted"
fi

if [ -f "database/trading_bot.db" ]; then
    echo "   ❌ ERROR: database/trading_bot.db still exists!"
    exit 1
else
    echo "   ✅ database/trading_bot.db deleted"
fi

if [ -f "logs/bugbot-reports.json" ]; then
    echo "   ❌ ERROR: bugbot-reports.json still exists!"
    exit 1
else
    echo "   ✅ bugbot-reports.json deleted"
fi

REMAINING_LOGS=$(ls -1 logs/*.log 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ Remaining log files: $REMAINING_LOGS (should be 0)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "   ✅ COMPLETE DATA WIPE SUCCESSFUL"
echo ""
echo "   Backup saved to: $BACKUP_DIR"
echo ""
echo "   Code files preserved: $(find . -name "*.js" -not -path "./node_modules/*" | wc -l | tr -d ' ') files"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
