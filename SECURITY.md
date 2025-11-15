# Security Best Practices

Critical security information for protecting your funds and credentials.

## 🔴 CRITICAL SECURITY WARNINGS

### Private Key Security

⚠️ **YOUR PRIVATE KEY IS YOUR MONEY**

- **NEVER** share your private key with anyone
- **NEVER** commit your `.env` file to Git
- **NEVER** paste your private key in Discord, Telegram, or any chat
- **NEVER** send your private key via email
- **NEVER** store it in plain text files except `.env`
- **NEVER** screenshot your private key

**If someone has your private key, they can steal all your funds!**

### API Key Security

Your Anthropic API key can incur charges:

- **NEVER** commit API keys to Git
- **NEVER** share API keys publicly
- **NEVER** use production API keys for testing
- **ALWAYS** use separate API keys for development/production
- **ALWAYS** set spending limits in Anthropic console

## Wallet Security

### Use a Dedicated Trading Wallet

**DO NOT** use your main wallet for trading:

```bash
# Create a new dedicated wallet for trading
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

**Benefits:**
- Limits exposure if private key is compromised
- Easier accounting and tracking
- Isolates trading funds from long-term holdings

### Start with Minimum Capital

**Testing:**
- Shadow mode: $0 (virtual)
- First live test: $100-500
- After successful testing: Increase gradually

**Never risk more than you can afford to lose!**

### Secure Your Private Key

#### Option 1: Environment Variables (Recommended)
```bash
# Store in .env file (ignored by Git)
PRIVATE_KEY=your_key_here
```

#### Option 2: Encrypted Storage (Advanced)
```javascript
// Use encryption for private key storage
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(password, 'salt', 32);
```

#### Option 3: Hardware Wallet Integration (Future)
Coming soon: Integration with Ledger/Trezor hardware wallets

### .env File Security

#### Proper .env File Permissions

```bash
# Set restrictive permissions (owner read/write only)
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- (600)
```

#### .env File Location

```bash
# CORRECT: Root directory, ignored by Git
/Users/yourname/algoQbot/.env  ✅

# WRONG: Inside a committed directory
/Users/yourname/algoQbot/src/.env  ❌
```

#### Verify .env is Not in Git

```bash
# Check .gitignore includes .env
cat .gitignore | grep .env

# Verify .env is not tracked
git status | grep .env
# Should NOT appear in output
```

## Git Security

### Critical .gitignore Rules

Ensure `.gitignore` contains:

```
# Environment variables
.env
.env.local
.env.production
.env.development

# Sensitive data
*.key
*.pem
credentials.json

# Logs (may contain sensitive info)
logs/*.log
*.log

# Database (may contain trading history)
data/*.db
data/*.sqlite
data/*.json

# Node modules
node_modules/

# OS files
.DS_Store
Thumbs.db
```

### Check for Accidentally Committed Secrets

```bash
# Search Git history for .env files
git log --all --full-history -- .env

# Search for private keys in commits
git log -S "PRIVATE_KEY" --source --all

# If found, you MUST:
# 1. Rotate all compromised credentials immediately
# 2. Remove from Git history using BFG Repo-Cleaner or git filter-branch
```

## Network Security

### RPC Endpoint Security

**Use Trusted RPC Providers:**
- Binance official RPCs (free, rate-limited)
- QuickNode (paid, reliable)
- Ankr (freemium)
- Your own BSC node (most secure, requires technical expertise)

**Avoid:**
- Unknown/untrusted RPC endpoints
- Free public RPCs with no rate limits (often unreliable)
- HTTP endpoints (use HTTPS)

### Protect Against Man-in-the-Middle Attacks

```bash
# Always use HTTPS for RPC URLs
BSC_RPC_URL=https://bsc-dataseed1.binance.org/  ✅
BSC_RPC_URL=http://bsc-dataseed1.binance.org/   ❌

# Verify SSL certificates
curl -v https://bsc-dataseed1.binance.org/ 2>&1 | grep "SSL certificate verify ok"
```

## Smart Contract Security

### Approve Only What You Need

The bot may need token approvals for trading:

```javascript
// GOOD: Approve specific amount
await token.approve(router, tradeAmount);

// BAD: Unlimited approval (currently not used by bot, but be aware)
await token.approve(router, ethers.constants.MaxUint256);
```

### Monitor Approvals

```bash
# Check token approvals on BSCScan
# Go to: https://bscscan.com/tokenapprovalchecker
# Enter your wallet address
# Revoke unnecessary approvals
```

## Operational Security

### Secure Your Development Environment

```bash
# Use strong password for your computer
# Enable full-disk encryption
# Use a password manager
# Enable 2FA on GitHub, Anthropic, etc.
```

### Access Control

```bash
# Restrict who can access the server running the bot
# Use SSH keys, not passwords
# Disable root login
# Use firewall rules
```

### Monitoring for Suspicious Activity

```bash
# Monitor for unusual trades
tail -f logs/combined-$(date +%Y-%m-%d).log.1 | grep "Shadow Trade"

# Monitor wallet balance
# Set up alerts for large balance changes
```

## API Security (Anthropic)

### Protect Your Anthropic API Key

```bash
# Set spending limits in Anthropic Console
# Monitor usage regularly
# Rotate keys periodically
# Use separate keys for dev/prod
```

### Rate Limiting

The bot includes rate limiting to prevent API abuse:

```javascript
// Built-in rate limiting
const MAX_REQUESTS_PER_MINUTE = 60;
```

## Disaster Recovery

### Backup Critical Data

```bash
# Backup .env file (encrypted)
gpg --symmetric --cipher-algo AES256 .env
# Creates: .env.gpg

# Restore later
gpg --decrypt .env.gpg > .env
```

### Emergency Procedures

**If Private Key is Compromised:**

1. **IMMEDIATELY** transfer all funds to a new wallet
2. Stop the bot
3. Generate new wallet and update `.env`
4. Never use the compromised key again

**If API Key is Compromised:**

1. Revoke the key in Anthropic Console
2. Generate new API key
3. Update `.env`
4. Monitor for unauthorized usage

## Security Checklist

Before going live, verify:

- [ ] `.env` file has 600 permissions
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in Git history
- [ ] Using dedicated trading wallet
- [ ] Wallet has minimum funds for testing
- [ ] API keys have spending limits
- [ ] RPC endpoint is HTTPS
- [ ] Strong password on your computer
- [ ] 2FA enabled on all accounts
- [ ] Backups encrypted and secured
- [ ] Monitoring alerts configured

## Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities!

Instead:
1. Email: security@your-domain.com (if available)
2. Or: Open a private security advisory on GitHub
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Resources

- [Ethereum Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [BSCScan Wallet Security Guide](https://bscscan.com/security)
- [Anthropic API Security](https://docs.anthropic.com/claude/docs/security)

## Audit Log

Keep a record of security-relevant actions:

```bash
# Log file access
ls -la .env >> security-audit.log

# Log configuration changes
git log --oneline -- .env.example >> security-audit.log

# Log wallet balance changes
# (Implemented in bot logs)
```

---

## Final Security Reminder

**The Three Cardinal Rules:**

1. **Never share your private key**
2. **Never risk funds you can't afford to lose**
3. **Always test in shadow mode first**

Your security is your responsibility. Stay vigilant! 🔒
