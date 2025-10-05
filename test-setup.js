#!/usr/bin/env node

console.log('🧪 Testing Advanced BSC Trading Bot Setup');
console.log('=========================================');

async function testSetup() {
  try {
    console.log('\n📋 Testing Components...');
    
    // Test 1: Basic imports
    console.log('1. Testing basic imports...');
    const AdvancedTradingBot = require('./AdvancedTradingBot');
    const MarketResearchAgent = require('./agents/MarketResearchAgent');
    const TradingStrategyAgent = require('./agents/TradingStrategyAgent');
    const RAGSystem = require('./rag/RAGSystem');
    console.log('✅ All imports successful');
    
    // Test 2: Database connection
    console.log('2. Testing database connection...');
    const { sequelize } = require('./database/models');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test 3: RAG System initialization
    console.log('3. Testing RAG system...');
    const ragSystem = new RAGSystem();
    await ragSystem.initialize();
    console.log('✅ RAG system initialized');
    
    // Test 4: Agent creation
    console.log('4. Testing agent creation...');
    const marketAgent = new MarketResearchAgent();
    console.log('✅ Market research agent created');
    
    // Test 5: API server initialization
    console.log('5. Testing API server...');
    const bot = new AdvancedTradingBot();
    await bot.initializeAPI();
    console.log('✅ API server initialized');
    
    // Test 6: Mock RAG query
    console.log('6. Testing RAG query...');
    const response = await ragSystem.query('What is the current market sentiment?');
    console.log('✅ RAG query successful');
    console.log('   Response:', response.response.substring(0, 100) + '...');
    
    console.log('\n🎉 All tests passed!');
    console.log('\n📚 Next Steps:');
    console.log('1. Configure your .env file with wallet details');
    console.log('2. Start the bot: npm start');
    console.log('3. Start monitoring: npm run monitor');
    console.log('4. Open http://localhost:8501 for dashboard');
    console.log('5. API available at http://localhost:3001');
    
    await ragSystem.close();
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSetup();
