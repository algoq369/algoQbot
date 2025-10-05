#!/usr/bin/env node

const AdvancedTradingBot = require('./AdvancedTradingBot');
const logger = require('./logger');

console.log('🚀 Quick Start - Advanced BSC Trading Bot');
console.log('==========================================');

async function quickStart() {
  try {
    console.log('📋 Quick Start Options:');
    console.log('1. Start Bot (Full AI System)');
    console.log('2. Start Bot (Mock Mode - No AI)');
    console.log('3. Start Monitoring Dashboard Only');
    console.log('4. Setup Database Only');
    console.log('5. Test API Endpoints');
    
    // For demo purposes, let's start in mock mode
    console.log('\n🎯 Starting in Demo Mode...');
    console.log('⚠️  This will run with mock data and no real trading');
    
    // Create bot instance
    const bot = new AdvancedTradingBot();
    
    // Override for demo mode
    process.env.NODE_ENV = 'demo';
    process.env.DEMO_MODE = 'true';
    
    console.log('\n🤖 Initializing bot components...');
    
    // Initialize without wallet connection for demo
    try {
      await bot.initialize();
      console.log('✅ Bot initialized successfully');
      
      // Start API server only for demo
      console.log('🌐 API server available at: http://localhost:3001');
      console.log('📊 Monitoring dashboard: Run "npm run monitor"');
      
      console.log('\n🎉 Quick start completed!');
      console.log('\n📚 Next steps:');
      console.log('1. Configure .env file with your wallet details');
      console.log('2. Run "npm start" for full bot operation');
      console.log('3. Run "npm run monitor" for dashboard');
      console.log('4. Visit http://localhost:3001/api/health for API status');
      
    } catch (error) {
      console.log('⚠️  Demo mode - some components may not be available');
      console.log('Error details:', error.message);
      console.log('\n🔧 To run the full bot:');
      console.log('1. Copy env.example to .env');
      console.log('2. Configure your wallet settings');
      console.log('3. Run npm start');
    }
    
  } catch (error) {
    console.error('❌ Quick start failed:', error.message);
    console.log('\n🔧 Manual setup:');
    console.log('1. Run: ./setup.sh');
    console.log('2. Configure .env file');
    console.log('3. Run: npm start');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

quickStart();
