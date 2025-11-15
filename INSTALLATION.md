# Installation Guide

Complete step-by-step installation guide for algoQbot.

## System Requirements

### Hardware
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space for logs and database
- **Network**: Stable internet connection

### Software
- **Operating System**: 
  - macOS 10.15+ (recommended)
  - Linux (Ubuntu 20.04+, Debian 11+)
  - Windows 10/11 (via WSL2)
- **Node.js**: Version 16.x or higher
- **npm**: Version 7.x or higher (comes with Node.js)
- **Git**: For cloning the repository
- **jq**: JSON processor (for dashboard)

### Requirements for Trading
- BSC wallet with private key
- Minimum $100 USDT for testing (recommended $1000+ for live trading)
- Some BNB for gas fees (~$10-20 worth)
- Anthropic API key (for AI-powered trading decisions)

## Installation Steps

### Step 1: Install Node.js

#### macOS (using Homebrew)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@16

# Verify installation
node --version  # Should show v16.x.x or higher
npm --version   # Should show 7.x.x or higher
```

#### Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install Node.js 16.x
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Windows (WSL2)
```powershell
# First install WSL2 and Ubuntu from Microsoft Store
# Then follow Linux installation steps above in WSL terminal
```

### Step 2: Install jq (JSON Processor)

#### macOS
```bash
brew install jq
```

#### Linux
```bash
sudo apt-get install jq
```

### Step 3: Clone Repository

```bash
# Clone the repository
git clone https://github.com/algoq369/algoQbot.git

# Navigate to project directory
cd algoQbot

# Verify you're in the right directory
ls -la
```

You should see files like `AdvancedTradingBot.js`, `package.json`, etc.

### Step 4: Install Dependencies

```bash
# Install all Node.js dependencies
npm install

# This will install all packages listed in package.json
# Wait for installation to complete (may take 1-3 minutes)
```

**Expected output:**
```
added 247 packages in 45s
```

### Step 5: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration file
nano .env
# Or use your preferred text editor: vim, code, etc.
```

**Minimal Required Configuration:**

Edit `.env` and set these values:

```bash
# Your BSC wallet address (starts with 0x...)
WALLET_ADDRESS=0xYourActualWalletAddress

# Your wallet private key (WITHOUT 0x prefix)
PRIVATE_KEY=YourActualPrivateKeyHere

# Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

# Enable shadow mode for safe testing
SHADOW_MODE_ENABLED=true
```

**Important Security Notes:**
- Never commit your `.env` file to Git
- Never share your private key with anyone
- Use a dedicated wallet for trading (not your main wallet)
- Start with small amounts for testing

### Step 6: Create Required Directories

```bash
# Create logs directory if it doesn't exist
mkdir -p logs

# Create data directory if it doesn't exist
mkdir -p data

# Set proper permissions
chmod 755 logs data
```

### Step 7: Verify Installation

```bash
# Check Node.js installation
node --version

# Check npm installation
npm --version

# Check if all dependencies are installed
npm list --depth=0

# Verify configuration file exists
cat .env | head -5  # Should show your configuration (safely)
```

### Step 8: First Run (Shadow Mode)

```bash
# Start the bot in shadow mode (no real trades)
npm run start-shadow
```

**Expected output:**
```
═══════════════════════════════════════════════════════════════
           VOLATILITY REGIME DASHBOARD
═══════════════════════════════════════════════════════════════

  Current Regime: VERY_LOW
  4h Volatility: 0.13%
  Strategy: Ranging
  
  💤 Waiting for market conditions to improve...
  ...
```

**If you see errors**, check:
1. Is your `.env` file configured correctly?
2. Do you have internet connection?
3. Is your RPC URL working?
4. Did `npm install` complete successfully?

### Step 9: Monitor with Dashboard

Open a **new terminal window** (keep the bot running in the first terminal):

```bash
# Navigate to algoQbot directory
cd algoQbot

# Run the monitoring dashboard
./monitor-dashboard-institutional.sh

# Or with auto-refresh every 10 seconds
watch -n 10 ./monitor-dashboard-institutional.sh
```

**Expected output:**
```
═══════════════════════════════════════════════════════════════
           🤖 algoQbot INSTITUTIONAL DASHBOARD
═══════════════════════════════════════════════════════════════
...
```

## Obtaining Required Credentials

### Getting a BSC Wallet

#### Option 1: Create New Wallet (Recommended for Testing)
```bash
# Install ethers.js globally
npm install -g ethers

# Create a new wallet (save the output securely!)
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

#### Option 2: Use Existing Wallet
- Export private key from MetaMask or Trust Wallet
- **Warning**: Use a dedicated trading wallet, not your main wallet!

### Fund Your Wallet

1. **Get USDT**:
   - Buy USDT on Binance, send to your BSC wallet address
   - Or bridge USDT from Ethereum to BSC using Binance Bridge
   - Minimum: $100 for testing

2. **Get BNB (for gas fees)**:
   - Buy BNB on Binance, send to your BSC wallet address
   - You need ~$10-20 worth for gas fees
   - Minimum: 0.05 BNB

3. **Verify Balances**:
   - Check on BSCScan.com
   - Enter your wallet address
   - Should see both USDT and BNB

### Getting Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)
6. Add to your `.env` file

**Pricing**: Claude API is pay-as-you-go (~$0.25 per 1000 requests for Claude Haiku)

## Troubleshooting Installation

### Issue: Node.js version too old
```bash
# Check current version
node --version

# If less than v16, install newer version
brew install node@16  # macOS
# or
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -  # Linux
```

### Issue: npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Issue: Permission denied errors
```bash
# Fix permissions on macOS/Linux
sudo chown -R $USER:$USER ~/algoQbot

# Or run with sudo (not recommended)
sudo npm install
```

### Issue: jq command not found
```bash
# Install jq
brew install jq        # macOS
sudo apt install jq    # Linux
```

### Issue: Bot won't start
1. Check `.env` file exists: `ls -la .env`
2. Verify configuration: `cat .env | grep -v PRIVATE_KEY`
3. Check logs: `tail -f logs/combined-$(date +%Y-%m-%d).log.1`
4. Verify RPC connection: `curl -X POST https://bsc-dataseed1.binance.org/ -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`

### Issue: Dashboard shows "No data"
1. Make sure bot is running
2. Wait 30-60 seconds for first data collection
3. Check log file exists: `ls -la logs/combined-$(date +%Y-%m-%d).log.1`
4. Verify log format: `tail -1 logs/combined-$(date +%Y-%m-%d).log.1 | jq`

## Post-Installation Steps

### 1. Test in Shadow Mode (Recommended)
```bash
# Run for at least 24 hours in shadow mode
npm run start-shadow

# Monitor performance
watch -n 10 ./monitor-dashboard-institutional.sh
```

### 2. Review Shadow Trade Results
```bash
# Check shadow trades
sqlite3 data/trading_bot.db "SELECT * FROM shadow_trades ORDER BY timestamp DESC LIMIT 10;"

# Check virtual balances
cat data/virtual_balances.json
```

### 3. Switch to Live Trading (Only After Testing!)
```bash
# Edit .env file
nano .env

# Change SHADOW_MODE_ENABLED to false
SHADOW_MODE_ENABLED=false

# Save and restart bot
npm start
```

**⚠️ WARNING**: Only switch to live trading after:
- At least 24 hours of successful shadow mode testing
- Reviewing shadow trade results
- Understanding all risk parameters
- Starting with minimum capital you can afford to lose

## Next Steps

1. Read [CONFIGURATION.md](CONFIGURATION.md) for detailed configuration options
2. Read [SECURITY.md](SECURITY.md) for security best practices
3. Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
4. Join our community for support and updates

## Support

If you encounter issues during installation:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Search GitHub Issues
3. Open a new issue with:
   - Your OS and Node.js version
   - Error messages (without sensitive data!)
   - Steps you've already tried

---

**Congratulations! You've successfully installed algoQbot! 🎉**

Start with shadow mode, monitor carefully, and trade responsibly.
