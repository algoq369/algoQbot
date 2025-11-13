#!/bin/bash
echo "🚀 Starting bot..."
pm2 start AdvancedTradingBot.js --name bot --watch false
sleep 5
pm2 status bot
pm2 logs bot --lines 20 --nostream
