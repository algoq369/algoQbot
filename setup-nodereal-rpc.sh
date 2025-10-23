#!/bin/bash

echo "🚀 Setting up NodeReal RPC for BSC Trading Bot..."
echo ""

# Navigate to bot directory
cd /Users/sheirraza/bsc-ranging-bot || { echo "❌ Error: bsc-ranging-bot directory not found"; exit 1; }
echo "✅ In directory: $(pwd)"
echo ""

# Backup existing .env
if [ -f .env ]; then
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  echo "✅ Backed up existing .env to .env.backup.$(date +%Y%m%d_%H%M%S)"
else
  echo "ℹ️  No existing .env file (will create new one)"
fi
echo ""

# Add NodeReal RPC configuration
cat >> .env << 'EOF'

# ═══════════════════════════════════════════════════════════
# RPC PROVIDERS - NodeReal FREE TIER
# ═══════════════════════════════════════════════════════════
NODEREAL_RPC_URL=https://bsc-mainnet.nodereal.io/v1/fb4dc1af0281439e8e7d1451c7bd326b
BSC_RPC_URL=https://bsc-dataseed1.binance.org
RPC_TIMEOUT=30000
RPC_MAX_RETRIES=3
RPC_FAILOVER_THRESHOLD=5
EOF

echo "✅ Added NodeReal RPC configuration to .env"
echo ""

# Verify configuration
echo "🔍 Verifying .env configuration..."
grep "NODEREAL_RPC_URL" .env
echo ""

# Create tests directory if it doesn't exist
mkdir -p tests
echo "✅ Tests directory ready"
echo ""

echo "✅ NodeReal RPC setup complete!"
echo ""
echo "📋 Next step: Run connection test with node tests/test-nodereal-connection.js"
