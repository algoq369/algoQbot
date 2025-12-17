# Contributing to algoQbot

Thank you for your interest in contributing to algoQbot! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Contribution Guidelines](#contribution-guidelines)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Security](#security)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- Git
- A GitHub account
- Basic knowledge of JavaScript/Node.js
- Understanding of trading concepts (helpful but not required)

### Setting Up Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/algoQbot.git
   cd algoQbot
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/algoq369/algoQbot.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your test credentials
   ```

6. **Run in shadow mode** for testing:
   ```bash
   npm run start-shadow
   ```

### Keeping Your Fork in Sync

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Development Process

### Branching Strategy

We use the following branching model:

- `main`: Production-ready code
- `develop`: Development branch (if applicable)
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Urgent fixes for production

### Creating a Feature Branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

## Contribution Guidelines

### What We're Looking For

We welcome contributions in the following areas:

- **Bug fixes**: Fixing issues reported in GitHub Issues
- **New features**: Adding new trading strategies, indicators, or functionality
- **Documentation**: Improving documentation, adding examples, tutorials
- **Performance**: Optimizations and performance improvements
- **Testing**: Adding or improving tests
- **Code quality**: Refactoring, code cleanup, improving maintainability

### What We're NOT Looking For

Please avoid:

- Breaking changes without discussion
- Undocumented code
- Changes without tests
- Commits with API keys or sensitive data
- Features that significantly increase complexity without clear benefit

### Before You Start

1. **Check existing issues**: See if someone is already working on it
2. **Create or comment on an issue**: Discuss your idea before starting work
3. **Get feedback**: For large changes, get maintainer approval first
4. **Start small**: Consider starting with a small contribution to get familiar

## Testing

### Running Tests

```bash
npm test
```

### Testing Your Changes

1. **Shadow Mode Testing**:
   ```bash
   npm run start-shadow
   ```
   - Run for at least 1 hour
   - Monitor dashboard for errors
   - Check logs for unexpected behavior

2. **Manual Testing**:
   - Test affected functionality thoroughly
   - Test edge cases
   - Verify no regressions in existing features

3. **Write Tests** (when applicable):
   - Add unit tests for new functions
   - Add integration tests for new features
   - Ensure tests pass: `npm test`

### Test Coverage

- Aim for high test coverage on new code
- Don't decrease overall test coverage
- Test both success and failure cases

## Code Style

### JavaScript Style Guide

We follow standard JavaScript best practices:

```javascript
// Use const by default, let when reassignment is needed
const maxRetries = 3;
let currentRetry = 0;

// Use descriptive variable names
const calculatePortfolioValue = (balances) => {
  // Clear, descriptive names
  const totalValue = balances.reduce((sum, balance) => sum + balance, 0);
  return totalValue;
};

// Use async/await instead of callbacks
async function fetchPrice() {
  try {
    const response = await api.getPrice();
    return response.price;
  } catch (error) {
    logger.error('Failed to fetch price', { error });
    throw error;
  }
}

// Add JSDoc comments for functions
/**
 * Calculates confidence score based on indicators
 * @param {Object} indicators - Indicator values
 * @param {string} regime - Current volatility regime
 * @returns {number} Confidence score between 0-100
 */
function calculateConfidence(indicators, regime) {
  // Implementation
}
```

### Code Formatting

- **Indentation**: 2 spaces
- **Line length**: Maximum 100 characters (flexible for readability)
- **Quotes**: Single quotes for strings
- **Semicolons**: Use semicolons
- **Trailing commas**: Use in multi-line objects/arrays

### Naming Conventions

- **Variables**: camelCase (`let tradingVolume`)
- **Constants**: UPPER_SNAKE_CASE (`const MAX_RETRIES`)
- **Functions**: camelCase (`function calculateProfit()`)
- **Classes**: PascalCase (`class TradingBot`)
- **Files**: camelCase or kebab-case (`priceCache.js`, `risk-manager.js`)

### Comments

- Write self-documenting code when possible
- Add comments for complex logic
- Use JSDoc for functions
- Explain "why", not "what"
- Keep comments up-to-date

```javascript
// GOOD: Explains why
// Retry 3 times because BSC RPC can be unreliable during high traffic
const MAX_RETRIES = 3;

// BAD: Explains what (obvious from code)
// Set max retries to 3
const MAX_RETRIES = 3;
```

## Commit Messages

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Examples

```
feat(strategies): add VWAP strategy

Implement VWAP-based trading strategy for institutional price levels.
Includes entry/exit logic and position sizing.

Closes #123
```

```
fix(risk): correct circuit breaker threshold

Circuit breaker was triggering too early at 3 losses.
Increased threshold to 5 losses and added minimum loss amount.

Fixes #456
```

```
docs(readme): update installation instructions

Added troubleshooting section and clarified Node.js version requirements.
```

### Commit Best Practices

- One logical change per commit
- Write clear, descriptive messages
- Reference issue numbers
- Keep commits focused and atomic
- Don't commit debugging code or commented-out code
- Don't commit sensitive data (API keys, private keys)

## Pull Request Process

### Before Submitting

1. **Update your branch**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Test thoroughly** in shadow mode

4. **Update documentation** if needed

5. **Check for sensitive data**:
   ```bash
   git diff main | grep -i "private\|key\|secret\|password"
   ```

### Submitting a Pull Request

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub

3. **Fill out the PR template** completely

4. **Link related issues** using keywords:
   - `Fixes #123`
   - `Closes #123`
   - `Relates to #123`

### Pull Request Title

Use the same format as commit messages:

```
feat(strategies): add mean reversion strategy
fix(risk): correct position size calculation
docs(contributing): add code style guidelines
```

### Pull Request Description

Your PR description should include:

- **Summary**: What does this PR do?
- **Motivation**: Why is this change needed?
- **Testing**: How was this tested?
- **Screenshots**: If applicable (dashboards, UI changes)
- **Breaking Changes**: Any breaking changes?
- **Related Issues**: Links to related issues

### Review Process

1. **Automated checks** must pass (if configured)
2. **Maintainer review** required
3. **Address feedback** promptly
4. **Keep PR updated** with main branch
5. **Squash commits** if requested

### After Your PR is Merged

1. **Delete your branch**:
   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

2. **Update your fork**:
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

## Reporting Bugs

### Before Submitting a Bug Report

1. **Check existing issues**: Your bug might already be reported
2. **Update to latest version**: Bug might be already fixed
3. **Test in shadow mode**: Verify it's reproducible
4. **Gather information**: Logs, configuration, steps to reproduce

### Bug Report Template

Use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) which includes:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Exact steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, Node.js version, etc.
- **Logs**: Relevant log excerpts (remove sensitive data!)
- **Screenshots**: If applicable

### Important

**Never include sensitive data** in bug reports:
- No private keys
- No API keys
- No wallet addresses
- No transaction hashes (if they reveal trading activity)

## Suggesting Features

### Before Submitting

1. **Check existing issues**: Feature might be planned or rejected
2. **Check roadmap**: Feature might be on our roadmap
3. **Discuss on Discussions**: Get community feedback first

### Feature Request Template

Use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) which includes:

- **Problem**: What problem does this solve?
- **Proposed Solution**: How would you implement it?
- **Alternatives**: What alternatives have you considered?
- **Use Cases**: Specific examples of how this would be used
- **Impact**: Who would benefit and how?

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities!

Instead:

1. **Email** security concerns to project maintainers (if email available)
2. Or **open a private security advisory** on GitHub
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Security Best Practices

When contributing:

- Never commit secrets (keys, passwords, etc.)
- Use `.env` files for configuration
- Validate all inputs
- Handle errors securely (don't leak sensitive info)
- Follow [SECURITY.md](SECURITY.md) guidelines

## Development Tips

### Useful Commands

```bash
# Start bot in shadow mode
npm run start-shadow

# Run tests
npm test

# View logs
tail -f logs/combined-$(date +%Y-%m-%d).log.1

# Monitor dashboard
./monitor-dashboard-institutional.sh

# Check shadow trades
sqlite3 data/trading_bot.db "SELECT * FROM shadow_trades ORDER BY timestamp DESC LIMIT 10;"
```

### Debugging

1. **Enable debug logging**:
   ```bash
   LOG_LEVEL=debug npm run start-shadow
   ```

2. **Use console.log sparingly**: Use logger instead
   ```javascript
   logger.debug('Debug info', { data });
   ```

3. **Check logs**: `logs/combined-*.log`

4. **Monitor dashboard**: Real-time status

### Common Pitfalls

- **Don't forget to test in shadow mode**
- **Don't commit .env file**
- **Don't use unlimited token approvals**
- **Don't skip error handling**
- **Don't hardcode values** (use configuration)

## Questions?

- **GitHub Discussions**: Ask questions, share ideas
- **GitHub Issues**: Report bugs, request features
- **Documentation**: Check existing docs first

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- README acknowledgments (for major contributions)

## Thank You!

Thank you for contributing to algoQbot! Your contributions help make algorithmic trading more accessible and robust for everyone.

---

**Happy Trading! 🚀**
