# Chat API Key Setup Guide

## Problem: 401 Authentication Error

If you're getting `Error: AI service error: 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`, follow these steps:

## Step 1: Get Your Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it should start with `sk-ant-api03-`)

## Step 2: Set the Environment Variable

### Option A: Export in Terminal (Temporary)
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

### Option B: Add to .env File (Permanent)
Create or edit `.env` file in the project root:
```bash
cd /Users/sheirraza/algoQbot
echo "ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here" >> .env
```

### Option C: Add to Shell Profile (Permanent for Terminal)
Add to `~/.zshrc` or `~/.bash_profile`:
```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here' >> ~/.zshrc
source ~/.zshrc
```

## Step 3: Verify the Key is Set

```bash
echo $ANTHROPIC_API_KEY
```

Should show your key (starting with `sk-ant-api03-`)

## Step 4: Restart the Bot

After setting the key, restart the bot:
```bash
npm run start-web
```

## Troubleshooting

### Check if key is loaded:
```bash
cd /Users/sheirraza/algoQbot
node -e "require('dotenv').config(); console.log('Key found:', !!process.env.ANTHROPIC_API_KEY); console.log('Key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));"
```

### Common Issues:

1. **Key not starting with "sk-ant-"**
   - Make sure you copied the full key from Anthropic console
   - Check for extra spaces or characters

2. **Key not persisting**
   - Use `.env` file or shell profile (not just `export`)
   - Make sure to restart terminal/bot after setting

3. **Wrong key format**
   - Anthropic keys should be: `sk-ant-api03-...`
   - If you have an older key format, generate a new one

4. **Key not being read**
   - Check `.env` file is in project root
   - Verify `dotenv` is installed: `npm list dotenv`
   - Check bot logs for "API key found" message

## Test the Chat

1. Start bot: `npm run start-web`
2. Open: http://localhost:9000
3. Click "💬 Chat"
4. Type "hi" and send
5. Should get a response (not 401 error)

