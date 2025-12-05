# Free API Keys Setup for AlgoQBot Chat

## Overview
AlgoQBot chat supports multiple free AI providers. You can use any of these without cost:

1. **Groq** (Recommended) - Fast, free tier with API key
2. **Ollama** - Local, completely free, no API key needed
3. **Hugging Face** - Free tier, some models don't need API key
4. **Fallback** - Rule-based responses (always works, no setup needed)

## Quick Setup

### Option 1: Groq (Fastest & Easiest)

1. **Get Free API Key:**
   - Go to https://console.groq.com/
   - Sign up for free account
   - Navigate to API Keys section
   - Create a new API key (free tier includes generous limits)

2. **Add to `.env` file:**
   ```bash
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. **Restart bot:**
   ```bash
   npm run start-web
   ```

**That's it!** Chat will now use Groq's fast AI models.

### Option 2: Ollama (Local, No API Key)

1. **Install Ollama:**
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Pull a model:**
   ```bash
   ollama pull llama3.2
   ```

3. **Start Ollama:**
   ```bash
   ollama serve
   ```

4. **Optional: Set in `.env`:**
   ```bash
   AI_PROVIDER=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```

### Option 3: Hugging Face (Free Tier)

1. **Get API Key (optional for some models):**
   - Go to https://huggingface.co/settings/tokens
   - Create a free account
   - Generate a token

2. **Add to `.env`:**
   ```bash
   HUGGINGFACE_API_KEY=your_hf_token_here
   HUGGINGFACE_MODEL=microsoft/DialoGPT-medium
   ```

## Configuration Options

### Environment Variables

Add these to your `.env` file:

```bash
# Choose AI Provider (auto, groq, ollama, huggingface)
AI_PROVIDER=auto

# Groq Settings
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

# Ollama Settings
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Hugging Face Settings
HUGGINGFACE_API_KEY=your_hf_token_here
HUGGINGFACE_MODEL=microsoft/DialoGPT-medium
```

### Provider Priority (when AI_PROVIDER=auto)

The chat will try providers in this order:
1. **Groq** (if API key is set)
2. **Ollama** (if running locally)
3. **Hugging Face** (if API key is set)
4. **Fallback** (always works, basic responses)

## Getting Free API Keys

### Groq (Recommended)
- **URL:** https://console.groq.com/
- **Free Tier:** Yes, generous limits
- **Speed:** Very fast
- **Models:** llama-3.1-8b-instant, mixtral-8x7b-32768, etc.
- **Setup Time:** 2 minutes

### Hugging Face
- **URL:** https://huggingface.co/settings/tokens
- **Free Tier:** Yes
- **Speed:** Medium (depends on model)
- **Models:** Many free models available
- **Setup Time:** 3 minutes

### Ollama
- **URL:** https://ollama.com/
- **Free Tier:** Completely free, runs locally
- **Speed:** Fast (local processing)
- **Models:** llama3.2, mistral, codellama, etc.
- **Setup Time:** 5 minutes (includes installation)

## Testing Your Setup

1. **Start the bot:**
   ```bash
   npm run start-web
   ```

2. **Open browser:**
   ```
   http://localhost:9000
   ```

3. **Go to Chat section**

4. **Test with:**
   - "What's my portfolio status?"
   - "Analyze BTC market"
   - "What trading strategy should I use?"

## Troubleshooting

### Groq API Key Not Working
- Check API key is correct in `.env`
- Verify key is active at https://console.groq.com/
- Check logs for error messages

### Ollama Not Responding
- Make sure Ollama is running: `ollama serve`
- Check if model is pulled: `ollama list`
- Verify OLLAMA_URL in `.env` matches your setup

### All Providers Failing
- Don't worry! Fallback mode will always work
- Check `.env` file exists and is in project root
- Restart bot after changing `.env`

## Example .env File

```bash
# AI Chat Configuration
AI_PROVIDER=auto

# Groq (Free API Key)
GROQ_API_KEY=gsk_your_key_here_1234567890

# Ollama (Local, No Key Needed)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Hugging Face (Optional)
HUGGINGFACE_API_KEY=hf_your_token_here
HUGGINGFACE_MODEL=microsoft/DialoGPT-medium
```

## Notes

- **No API Key Required:** Fallback mode works without any setup
- **Multiple Providers:** You can set up multiple providers, bot will use the first available
- **Free Tiers:** All recommended providers have generous free tiers
- **Privacy:** Ollama runs locally, no data sent to external servers

## Support

If you need help:
1. Check bot logs: `logs/bot-console.log`
2. Verify `.env` file is in project root
3. Restart bot after configuration changes
4. Test each provider individually by setting `AI_PROVIDER=groq` (or ollama, huggingface)

