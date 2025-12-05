#!/bin/bash

# Auto-refresh Dashboard Script
# Reloads the institutional dashboard every 30 seconds

cd /Users/sheirraza/algoQbot

echo "🔄 Starting auto-refresh dashboard (30 second intervals)..."
echo "Press Ctrl+C to stop"
echo ""

watch -n 30 ./monitor-dashboard-institutional.sh

