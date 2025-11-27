#!/bin/bash

# 🚀 Phase 1 Efficiency Monitor
# Real-time monitoring for Phase 1 DEFI enhancements

clear
echo "═══════════════════════════════════════════════════════════════"
echo "           🚀 Phase 1 Efficiency Monitor - AlgoQBot"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if bot is running
BOT_PID=$(pgrep -f "node.*AdvancedTradingBot.js" | head -1)
if [ -z "$BOT_PID" ]; then
    echo "❌ AlgoQBot is not running"
    echo "💡 Start with: npm run start-shadow (safe) or npm run start (live)"
    exit 1
fi

echo "✅ AlgoQBot is running (PID: $BOT_PID)"
echo ""

while true; do
    echo "═════════════════════════════════════════════════════════════════"
    echo "📊 Phase 1 Efficiency Status - $(date)"
    echo "═════════════════════════════════════════════════════════════════"
    echo ""
    
    # Gas Surge Detection Status
    echo "⛽ Gas Surge Detection:"
    node -e "
try {
    const bot = require('./AdvancedTradingBot');
    if (bot.gasSurgeDetector) {
        const stats = bot.gasSurgeDetector.getStatistics();
        const canTrade = bot.gasSurgeDetector.isTradingAllowed();
        
        console.log('  Status: ' + (canTrade ? '🟢 ACTIVE' : '🔴 PAUSED'));
        console.log('  Current Gas: ' + stats.currentGasPrice + ' gwei');
        console.log('  Surge Ratio: ' + stats.surgeRatio + 'x');
        console.log('  Checks: ' + stats.totalChecks);
        console.log('  Surges Detected: ' + stats.surgesDetected);
        
        if (stats.gasSavings > 0) {
            console.log('  💰 Estimated Savings: $' + stats.gasSavings);
        }
    } else {
        console.log('  ⚠️  Gas surge detector not available');
    }
} catch (error) {
    console.log('  ❌ Error: ' + error.message);
}
"
    echo ""
    
    # Batch Price Fetcher Status
    echo "📦 Batch Price Fetcher:"
    node -e "
try {
    const bot = require('./AdvancedTradingBot');
    if (bot.batchPriceFetcher) {
        const stats = bot.batchPriceFetcher.getStatistics();
        
        console.log('  Status: ' + (stats.multicallAvailable ? '🟢 ACTIVE' : '🔴 INACTIVE'));
        console.log('  Total Requests: ' + stats.totalRequests);
        console.log('  Batched Requests: ' + stats.batchedRequests);
        console.log('  RPC Calls Reduced: ' + stats.rpcCallsReduced);
        console.log('  Efficiency: ' + stats.efficiency);
        console.log('  Queue Size: ' + stats.queueSize);
        console.log('  Failed Batches: ' + stats.failedBatches);
    } else {
        console.log('  ⚠️  Batch price fetcher not available');
    }
} catch (error) {
    console.log('  ❌ Error: ' + error.message);
}
"
    echo ""
    
    # Recent Log Analysis
    echo "📋 Recent Activity (Last 10 Minutes):"
    LOG_FILE="logs/combined-$(date +%Y-%m-%d).log"
    if [ -f "$LOG_FILE" ]; then
        # Recent gas surge events
        GAS_EVENTS=$(tail -n 1000 "$LOG_FILE" | grep "$(date '+%Y-%m-%d %H:'" | grep "gas surge\|Trading paused" | wc -l)
        echo "  ⛽ Gas surge events: $GAS_EVENTS"
        
        # Recent batch operations
        BATCH_EVENTS=$(tail -n 1000 "$LOG_FILE" | grep "$(date '+%Y-%m-%d %H:'" | grep "batched\|Using batch" | wc -l)
        echo "  📦 Batch operations: $BATCH_EVENTS"
        
        # Recent trades
        RECENT_TRADES=$(tail -n 1000 "$LOG_FILE" | grep "$(date '+%Y-%m-%d %H:'" | grep "trade executed\|TRADE_EXECUTED" | wc -l)
        echo "  💼 Trades executed: $RECENT_TRADES"
        
        # Error count
        ERROR_COUNT=$(tail -n 1000 "$LOG_FILE" | grep "$(date '+%Y-%m-%d %H:'" | grep "ERROR\|error" | wc -l)
        echo "  ❌ Errors: $ERROR_COUNT"
    else
        echo "  ⚠️  No log file found for today"
    fi
    echo ""
    
    # System Health
    echo "🏥 System Health:"
    if [ -n "$BOT_PID" ]; then
        # CPU usage
        CPU_USAGE=$(ps -p $BOT_PID -o %cpu --no-headers 2>/dev/null || echo "N/A")
        echo "  🖥  CPU Usage: ${CPU_USAGE}%"
        
        # Memory usage
        MEM_USAGE=$(ps -p $BOT_PID -o %mem --no-headers 2>/dev/null || echo "N/A")
        echo "  💾 Memory Usage: ${MEM_USAGE}%"
        
        # Uptime
        UPTIME=$(ps -p $BOT_PID -o etimes --no-headers 2>/dev/null || echo "N/A")
        if [ "$UPTIME" != "N/A" ]; then
            UPTIME_SECS=$((UPTIME / 1000))
            UPTIME_MINS=$((UPTIME_SECS / 60))
            UPTIME_HOURS=$((UPTIME_MINS / 60))
            echo "  ⏰ Uptime: ${UPTIME_HOURS}h ${UPTIME_MINS}m"
        fi
    fi
    echo ""
    
    # Quick Commands
    echo "🎮 Quick Commands:"
    echo "  [r] Reset gas surge detector"
    echo "  [f] Flush batch queue"
    echo "  [t] Run Phase 1 tests"
    echo "  [q] Quit monitor"
    echo ""
    echo -n "Enter command (r/f/t/q): "
    read -t 10 -n 1 cmd
    
    case $cmd in
        r)
            echo "🔄 Resetting gas surge detector..."
            node -e "
const bot = require('./AdvancedTradingBot');
if (bot.gasSurgeDetector) {
    bot.gasSurgeDetector.stop();
    setTimeout(() => {
        bot.gasSurgeDetector.start();
        console.log('✅ Gas surge detector reset');
    }, 1000);
}
" &
            ;;
        f)
            echo "🚫 Flushing batch queue..."
            node -e "
const bot = require('./AdvancedTradingBot');
if (bot.batchPriceFetcher) {
    bot.batchPriceFetcher.flushQueue().then(() => {
        console.log('✅ Batch queue flushed');
    }).catch(e => {
        console.log('❌ Error flushing queue:', e.message);
    });
}
" &
            ;;
        t)
            echo "🧪 Running Phase 1 tests..."
            node test-phase1-efficiency.js &
            ;;
        q)
            echo "👋 Exiting monitor..."
            exit 0
            ;;
        *)
            echo "⏭ Continuing monitoring..."
            ;;
    esac
    
    sleep 5
done