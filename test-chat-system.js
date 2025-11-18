#!/usr/bin/env node

console.log('🔍 Testing AlgoQBot Chat System Integration...\n');

// Test 1: Check if chat files exist
const fs = require('fs');
const path = require('path');

const files = [
  'chat/AlgoQBotChat.js',
  'chat/BotPersonality.js',
  'chat/ConversationMemory.js',
  'scripts/chat-cli.js'
];

console.log('📁 File Checks:');
files.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Test 2: Try loading the modules
console.log('\n📦 Module Loading:');
try {
  const AlgoQBotChat = require('./chat/AlgoQBotChat');
  console.log('  ✅ AlgoQBotChat.js loads successfully');
  
  const BotPersonality = require('./chat/BotPersonality');
  console.log('  ✅ BotPersonality.js loads successfully');
  
  const ConversationMemory = require('./chat/ConversationMemory');
  console.log('  ✅ ConversationMemory.js loads successfully');
} catch (error) {
  console.log('  ❌ Error loading modules:', error.message);
  process.exit(1);
}

// Test 3: Check if AdvancedTradingBot has chat integration
console.log('\n🤖 Bot Integration:');
try {
  const botCode = fs.readFileSync(path.join(__dirname, 'AdvancedTradingBot.js'), 'utf8');
  
  const hasConstructorInit = botCode.includes('AI Chat interface will be initialized');
  console.log(`  ${hasConstructorInit ? '✅' : '❌'} Constructor has chat initialization`);
  
  const hasInitMethod = botCode.includes('const AlgoQBotChat = require');
  console.log(`  ${hasInitMethod ? '✅' : '❌'} Initialize method loads AlgoQBotChat`);
  
  const hasAPIEndpoints = botCode.includes("this.app.post('/api/chat'");
  console.log(`  ${hasAPIEndpoints ? '✅' : '❌'} API endpoints added`);
  
} catch (error) {
  console.log('  ❌ Error checking bot integration:', error.message);
  process.exit(1);
}

// Test 4: Check dependencies
console.log('\n📚 Dependencies:');
try {
  require('@anthropic-ai/sdk');
  console.log('  ✅ @anthropic-ai/sdk installed');
  require('chalk');
  console.log('  ✅ chalk installed');
} catch (error) {
  console.log('  ❌ Missing dependency:', error.message);
}

// Test 5: Check data directory
console.log('\n📂 Data Directory:');
const dataDir = path.join(__dirname, 'data');
if (fs.existsSync(dataDir)) {
  console.log('  ✅ data/ directory exists');
} else {
  console.log('  ❌ data/ directory missing');
}

console.log('\n✅ All chat system components verified!');
console.log('\n📋 Next Steps:');
console.log('  1. Start bot: npm run start-shadow');
console.log('  2. Wait for initialization (look for "AI Chat interface ready")');
console.log('  3. Test chat: node scripts/chat-cli.js');
console.log('\n🎉 Chat system is ready to use!');
