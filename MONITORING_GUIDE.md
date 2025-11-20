# 🎨 AlgoQBot Colorful Monitoring Guide

## Quick Start

Load the aliases:
```bash
source bot-aliases.sh
```

## Available Monitoring Commands

### 1. Bot Monitoring Dashboard
**Command**: `bot-monitor`
**What it shows**:
- Bot status (online/offline, uptime, memory, CPU)
- Market regime and volatility
- Shadow mode statistics
- Recent trading decisions
- Error count

**Usage**:
```bash
# Single snapshot
bot-monitor

# Live updating (refreshes every 5 seconds)
bot-monitor-live
```

### 2. Colored Live Logs
**Command**: `bot-logs-color`
**What it shows**:
- Real-time bot logs with color coding
  - 🔴 Red: Errors
  - 🟡 Yellow: Warnings
  - 🟢 Green: Success messages and BUY signals
  - 🔵 Blue: Shadow mode trades
  - 🟣 Magenta: Position exits and SELL signals
  - 🔵 Cyan: Info messages

**Usage**:
```bash
bot-logs-color
```

### 3. Exit Monitor
**Command**: `bot-watch-exits`
**What it shows**:
- Bot status
- Recent exit activity (last 20 lines)
- Shadow mode exit statistics
  - Total records
  - Entry count
  - Exit count
- Last 5 exits with details (profit, reason, strategy, duration)

**Usage**:
```bash
bot-watch-exits
```

## Direct Script Execution

You can also run the scripts directly:

```bash
# Snapshot dashboard
./monitor-colored.sh

# Live colored logs
./logs-colored.sh

# Exit monitoring (auto-refreshes every 10 seconds)
./watch-exits.sh
```

## Color Legend

### Dashboard Colors:
- **Cyan**: Headers, borders, metadata
- **Green**: Positive status (online, success)
- **Red**: Negative status (offline, errors)
- **Yellow**: Warnings, neutral metrics
- **Blue**: Shadow mode data
- **Magenta**: Exit-related information
- **Gray**: Timestamps, secondary info

### Market Regime Colors:
- **Dark Blue**: VERY_LOW volatility
- **Cyan**: LOW volatility
- **Yellow**: MEDIUM volatility
- **Orange**: HIGH volatility
- **Red**: VERY_HIGH volatility

## Monitoring Tips

1. **Use `bot-monitor-live` for active trading**: Auto-refreshes to show real-time bot status
2. **Use `bot-logs-color` to debug issues**: See all log messages with color-coded severity
3. **Use `bot-watch-exits` during testing**: Focus on position exit patterns and performance

## Example Workflow

```bash
# Terminal 1: Monitor dashboard
source bot-aliases.sh
bot-monitor-live

# Terminal 2: Watch logs
source bot-aliases.sh
bot-logs-color

# Terminal 3: Track exits
source bot-aliases.sh
bot-watch-exits
```

## Customization

All scripts are located in the root directory:
- `monitor-colored.sh` - Main dashboard
- `logs-colored.sh` - Log viewer
- `watch-exits.sh` - Exit monitor

Feel free to modify these scripts to customize:
- Refresh intervals
- Color schemes
- Information displayed
- Data filtering

## Troubleshooting

**Issue**: Colors not displaying
**Solution**: Ensure your terminal supports ANSI color codes

**Issue**: PM2 commands not found
**Solution**: Ensure PM2 is installed: `npm install -g pm2`

**Issue**: Script permission denied
**Solution**: Make scripts executable: `chmod +x *.sh`

**Issue**: Bot showing offline
**Solution**: Start the bot: `npm run start-shadow`

---

**Created**: 2025-11-20
**Purpose**: Colorful monitoring tools for AlgoQBot real-time visibility
