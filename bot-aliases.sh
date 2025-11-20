alias bot-start="pm2 start AdvancedTradingBot.js --name bot"
alias bot-stop="pm2 stop bot"
alias bot-status="pm2 status bot && curl -s localhost:3000/api/metrics | jq '.'"
alias bot-quick-status="clear && pm2 status bot && curl -s localhost:3000/api/metrics | jq '.portfolio, .performance'"
alias portfolio="curl -s localhost:3000/api/metrics | jq .portfolio"
alias pnl="curl -s localhost:3000/api/metrics | jq .performance"
echo "🤖 Aliases loaded!"

# Colorful Monitoring Aliases
alias bot-monitor='cd ~/algoQbot && ./monitor-colored.sh'
alias bot-monitor-live='cd ~/algoQbot && while true; do clear; ./monitor-colored.sh; sleep 5; done'
alias bot-logs-color='cd ~/algoQbot && ./logs-colored.sh'
alias bot-watch-exits='cd ~/algoQbot && while true; do clear; ./watch-exits.sh; sleep 10; done'
