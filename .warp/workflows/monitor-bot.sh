#!/bin/bash
clear
echo "📊 Bot Monitor"
pm2 status bot
curl -s localhost:3000/api/metrics | jq '.portfolio, .performance'
