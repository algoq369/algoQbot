const { sequelize, Trade, MarketData, BotLog, StrategyPerformance, NewsArticle, Alert, AgentActivity } = require('../database/models');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  try {
    console.log('🚀 Setting up advanced trading bot database...');
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ Created data directory');
    }

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // Sync all models
    await sequelize.sync({ force: false }); // Set to true to recreate tables
    console.log('✅ Database tables synchronized');

    // Create initial strategy performance record
    const [strategy, created] = await StrategyPerformance.findOrCreate({
      where: { strategy_name: 'BSC Ranging Strategy' },
      defaults: {
        period_start: new Date(),
        period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        total_trades: 0,
        successful_trades: 0,
        failed_trades: 0,
        total_profit: 0,
        total_volume: 0,
        win_rate: 0
      }
    });

    if (created) {
      console.log('✅ Created initial strategy performance record');
    } else {
      console.log('✅ Strategy performance record already exists');
    }

    // Create sample alert
    const [alert, alertCreated] = await Alert.findOrCreate({
      where: { 
        type: 'system',
        title: 'Database Setup Complete'
      },
      defaults: {
        severity: 'low',
        message: 'Advanced trading bot database has been successfully initialized',
        triggered_by: 'setup-script',
        acknowledged: false
      }
    });

    if (alertCreated) {
      console.log('✅ Created initial system alert');
    }

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📊 Database Statistics:');
    
    const tradeCount = await Trade.count();
    const logCount = await BotLog.count();
    const alertCount = await Alert.count();
    
    console.log(`   • Trades: ${tradeCount}`);
    console.log(`   • Logs: ${logCount}`);
    console.log(`   • Alerts: ${alertCount}`);
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
