# algoQbot Data Directory

This directory contains runtime data, trading history, and persistent storage for the algoQbot BSC trading system.

## Directory Structure

```
data/
├── README.md                    # This file
├── trading_bot.db               # SQLite database (main persistent storage)
├── virtual_balances.json        # Shadow mode virtual portfolio balances
├── shadow_trades.json           # Shadow mode trade history
├── price-history.json           # Main price history cache
├── price-history/               # Price history backups and archives
│   └── .gitkeep
├── trades/                      # Trade execution logs and reports
│   └── .gitkeep
└── backups/                     # Database and data backups
    └── .gitkeep
```

## File Descriptions

### Core Data Files

- **trading_bot.db**: SQLite database containing all trading activity, positions, P&L, and system metrics
- **virtual_balances.json**: Real-time shadow mode portfolio balances (USDT/BNB allocation)
- **shadow_trades.json**: Complete history of all shadow mode trades with entry/exit details
- **price-history.json**: Cached price data for USDT/BNB with timestamps (performance optimization)

### Subdirectories

#### `price-history/`
Stores historical price snapshots and archives:
- Hourly/daily price history backups
- Long-term price data for backtesting
- Market volatility calculations

#### `trades/`
Trade execution logs and analysis:
- Individual trade reports
- Performance metrics exports
- Trade journal entries

#### `backups/`
Automated backups of critical data:
- Database snapshots (trading_bot.db.backup_YYYYMMDD_HHMMSS)
- Shadow trades archives
- Configuration backups

## Data Persistence

### Shadow Mode (Default)
- All trades are **virtual** (no blockchain transactions)
- Portfolio state persisted in `virtual_balances.json`
- Trade history saved to `shadow_trades.json`
- Perfect for testing and validation

### Live Mode
- Real blockchain transactions on BSC
- Portfolio synchronized with wallet balances
- Trade history recorded in database
- Gas fees and slippage tracked

## Security & Privacy

**⚠️  IMPORTANT**: This directory contains sensitive trading data:

- Portfolio balances and allocation
- Trade history with entry/exit prices
- Performance metrics and P&L
- Position sizing and risk parameters

**All files in this directory are excluded from Git** (see `.gitignore`).

Only directory structure (`.gitkeep` files) is tracked for repository integrity.

## Backup Recommendations

1. **Daily**: Automated database backups to `backups/`
2. **Weekly**: Export shadow_trades.json for external analysis
3. **Monthly**: Archive old price-history data
4. **Before Updates**: Manual backup of entire `data/` directory

## Maintenance

### Disk Space Management
The database can grow large (>1GB) with extended runtime. Recommended maintenance:

```bash
# Check database size
ls -lh data/trading_bot.db

# Clean old backups (keep last 7 days)
find data/backups/ -name "*.backup*" -mtime +7 -delete

# Archive old shadow trades
mv data/shadow_trades.json data/backups/shadow_trades_$(date +%Y%m%d).json
echo "[]" > data/shadow_trades.json
```

### Performance Optimization
- Price cache TTL: 30 seconds (configurable via `PRICE_CACHE_TTL`)
- Database auto-vacuum on startup
- Automatic cleanup of old price history (>7 days)

## Troubleshooting

### "ENOENT: no such file or directory"
If you see errors about missing data files:

```bash
# Recreate directory structure
mkdir -p data/price-history data/trades data/backups
chmod -R 755 data
```

### Database Corruption
If `trading_bot.db` becomes corrupted:

```bash
# Restore from latest backup
cp data/backups/trading_bot.db.backup data/trading_bot.db

# Or start fresh (⚠️  loses all history)
rm data/trading_bot.db
# Bot will recreate database on next startup
```

### Shadow Trades Reset
To reset shadow mode performance:

```bash
# Backup existing trades
cp data/shadow_trades.json data/backups/shadow_trades_backup_$(date +%Y%m%d).json

# Reset to initial state
echo '[]' > data/shadow_trades.json
echo '{"USDT": 60000, "BNB": 0}' > data/virtual_balances.json
```

## Monitoring

Key metrics to monitor:
- Database size growth rate
- Price cache hit ratio (target: 75-90%)
- Shadow trades file size
- Backup success rate

See `monitoring/dashboard.py` for real-time data monitoring.

---

**Last Updated**: 2025-11-16
**Version**: 2.0.0 (Professional TP/SL Standards)
