# Free AI Chat Setup Guide

## ✅ Switched to Free Open-Source AI Models!

The chat now uses **FREE** AI providers instead of paid Anthropic API. No API keys required for basic usage!

## Available Free Providers

### 1. **Ollama** (Recommended - Completely Free, Local)
- ✅ 100% free
- ✅ Runs locally on your machine
- ✅ No API keys needed
- ✅ Privacy-focused
- ✅ Works offline

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download a free model (choose one):
ollama pull llama3.2        # Small, fast (2GB)
ollama pull llama3.1:8b     # Medium (4.7GB)
ollama pull mistral         # Alternative model

# Set environment variable (optional)
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.2
```

### 2. **Groq** (Free Tier - Cloud-Based)
- ✅ Free tier available
- ✅ Very fast responses
- ✅ No setup needed
- ⚠️ Requires internet connection

**Setup:**
```bash
# Optional: Get free API key from https://console.groq.com/
export GROQ_API_KEY=your_free_key_here

# Or use without key (some models work without auth)
export AI_PROVIDER=groq
```

### 3. **Hugging Face** (Free Tier)
- ✅ Free tier available
- ✅ Many open-source models
- ⚠️ Rate limited

**Setup:**
```bash
# Optional: Get free API key from https://huggingface.co/settings/tokens
export HUGGINGFACE_API_KEY=your_free_key_here
export AI_PROVIDER=huggingface
```

### 4. **Fallback** (Always Works)
- ✅ No setup needed
- ✅ Works immediately
- ✅ Basic rule-based responses
- ⚠️ Limited intelligence

## Configuration

Set your preferred provider in `.env` file:
```bash
# Choose provider: 'ollama', 'groq', 'huggingface', or leave empty for auto-fallback
AI_PROVIDER=ollama

# Ollama settings (if using Ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Groq settings (if using Groq)
GROQ_API_KEY=your_key_here  # Optional

# Hugging Face settings (if using Hugging Face)
HUGGINGFACE_API_KEY=your_key_here  # Optional
HUGGINGFACE_MODEL=microsoft/DialoGPT-medium
```

## Quick Start (No Setup Required!)

The chat will work immediately with the **fallback mode** - no installation needed!

1. Start the bot:
   ```bash
   npm run start-web
   ```

2. Open chat: http://localhost:9000

3. Try it! The fallback will respond to basic questions.

## Recommended Setup (Ollama)

For best experience, install Ollama:

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Download a model
ollama pull llama3.2

# 3. Set in .env
echo "AI_PROVIDER=ollama" >> .env
echo "OLLAMA_MODEL=llama3.2" >> .env

# 4. Restart bot
npm run start-web
```

## Testing

Test which provider is active:
```bash
curl http://localhost:9000/api/test-api-key
```

## Troubleshooting

### Ollama not found?
- Make sure Ollama is running: `ollama serve`
- Check if it's accessible: `curl http://localhost:11434/api/tags`

### All providers failing?
- The fallback mode will always work
- Check bot logs for error messages
- Verify internet connection (for cloud providers)

### Want to switch providers?
Just change `AI_PROVIDER` in `.env` and restart the bot!

## Benefits

✅ **No API costs** - All providers are free
✅ **Privacy** - Ollama runs locally
✅ **Always works** - Fallback mode ensures chat never fails
✅ **Open source** - Using open-source models
✅ **Flexible** - Easy to switch between providers

Enjoy your free AI chat! 🎉

