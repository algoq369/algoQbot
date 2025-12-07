# OpenRouter API Integration Plan for AlgoQBot

## Overview

This document outlines the plan to integrate **OpenRouter API** as an additional AI provider for the AlgoQBot chat system. OpenRouter provides access to multiple LLM models through a unified API.

---

## Current State (What Exists)

### Existing AI Providers
| Provider | Status | Configuration |
|----------|--------|---------------|
| **Anthropic Claude** | Active (Primary) | `ANTHROPIC_API_KEY` in `.env` |
| **Groq** | Documented | `GROQ_API_KEY` in `.env` |
| **Ollama** | Documented | Local, `OLLAMA_URL` |
| **Hugging Face** | Documented | `HUGGINGFACE_API_KEY` |
| **OpenRouter** | **NOT YET IMPLEMENTED** | - |

### Key Files
- `chat/AlgoQBotChat.js` - Main chat class (uses Anthropic SDK)
- `chat/BotPersonality.js` - Bot personality configuration
- `chat/ConversationMemory.js` - Conversation memory management
- `config.js` - Main configuration file
- `.env.example` - Environment template
- `FREE_API_KEYS_SETUP.md` - Provider setup documentation

### Current Chat Architecture
```
AlgoQBotChat
    |
    +-- Anthropic SDK (claude-sonnet-4)
    +-- BotPersonality
    +-- ConversationMemory
```

---

## What Needs to Be Done

### Phase 1: Configuration Setup
- [ ] Add OpenRouter environment variables to `.env.example`
- [ ] Update `config.js` with OpenRouter configuration
- [ ] Create `.env` file with OpenRouter API key

### Phase 2: Implementation
- [ ] Create `chat/providers/OpenRouterProvider.js` adapter
- [ ] Update `AlgoQBotChat.js` to support multiple providers
- [ ] Add provider selection logic (auto-detect or manual)

### Phase 3: Documentation
- [ ] Update `FREE_API_KEYS_SETUP.md` with OpenRouter instructions
- [ ] Add OpenRouter models list and recommendations

### Phase 4: Testing
- [ ] Run website locally (`npm run start-web`)
- [ ] Test chat functionality with OpenRouter
- [ ] Verify fallback to other providers works

---

## OpenRouter Configuration

### Environment Variables to Add
```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_SITE_URL=https://algoqbot.com
OPENROUTER_SITE_NAME=AlgoQBot
```

### Available OpenRouter Models (Recommended)
| Model | Provider | Use Case |
|-------|----------|----------|
| `anthropic/claude-3.5-sonnet` | Anthropic | Best quality |
| `openai/gpt-4o` | OpenAI | Fast & capable |
| `google/gemini-pro` | Google | Good balance |
| `meta-llama/llama-3.1-70b-instruct` | Meta | Open source |
| `mistralai/mistral-large` | Mistral | European option |

---

## Implementation Details

### OpenRouter API Format
```javascript
// OpenRouter uses OpenAI-compatible API
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': OPENROUTER_SITE_URL,
    'X-Title': OPENROUTER_SITE_NAME,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    max_tokens: 2000,
    temperature: 0.7
  })
});
```

### Provider Priority (Proposed)
```
1. OpenRouter (if API key set) - Access to many models
2. Anthropic (if API key set) - Direct Claude access
3. Groq (if API key set) - Fast inference
4. Ollama (if running) - Local/private
5. Hugging Face (if API key set) - Free tier
6. Fallback - Rule-based responses
```

---

## Files to Create/Modify

### New Files
1. `chat/providers/OpenRouterProvider.js` - OpenRouter adapter class

### Modified Files
1. `.env.example` - Add OpenRouter variables
2. `config.js` - Add OpenRouter configuration section
3. `chat/AlgoQBotChat.js` - Add provider selection logic
4. `FREE_API_KEYS_SETUP.md` - Add OpenRouter documentation

---

## Testing Checklist

- [ ] OpenRouter API key is valid
- [ ] Chat responds using OpenRouter
- [ ] Fallback works if OpenRouter fails
- [ ] Bot personality is maintained
- [ ] Conversation memory works
- [ ] Web interface displays responses correctly

---

## Next Steps

1. **User provides OpenRouter API key**
2. Create `.env` file with the key
3. Implement OpenRouter provider
4. Test locally with `npm run start-web`
5. Verify and commit changes

---

## Resources

- OpenRouter Docs: https://openrouter.ai/docs
- OpenRouter Models: https://openrouter.ai/models
- API Pricing: https://openrouter.ai/pricing

---

*Created: December 7, 2025*
*Branch: claude/add-openrouter-api-016Gm5Gd7C6QKuAepCzsA1Qd*
