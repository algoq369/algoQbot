#!/bin/bash
set -e
echo "🚀 Setting up Warp + Claude..."
mkdir -p .warp/workflows logs backups

# Create workflows
cat > .warp/workflows/start-bot.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting bot..."
pm2 start AdvancedTradingBot.js --name bot --watch false
sleep 5
pm2 status bot
pm2 logs bot --lines 20 --nostream
EOF

cat > .warp/workflows/monitor-bot.sh << 'EOF'
#!/bin/bash
clear
echo "📊 Bot Monitor"
pm2 status bot
curl -s localhost:3000/api/metrics | jq '.portfolio, .performance'
EOF

chmod +x .warp/workflows/*.sh

# Create aliases
cat > bot-aliases.sh << 'EOF'
alias bot-start="pm2 start AdvancedTradingBot.js --name bot"
alias bot-stop="pm2 stop bot"
alias bot-status="pm2 status bot && curl -s localhost:3000/api/metrics | jq '.'"
alias bot-quick-status="clear && pm2 status bot && curl -s localhost:3000/api/metrics | jq '.portfolio, .performance'"
alias portfolio="curl -s localhost:3000/api/metrics | jq .portfolio"
alias pnl="curl -s localhost:3000/api/metrics | jq .performance"
echo "🤖 Aliases loaded!"
EOF

# Add to shell
echo "[ -f \"$(pwd)/bot-aliases.sh\" ] && source \"$(pwd)/bot-aliases.sh\"" >> ~/.zshrc

echo "✅ Done! Run: source ~/.zshrc && bot-quick-status"
