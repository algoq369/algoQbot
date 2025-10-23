const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function loadHistoricalData() {
  try {
    console.log('📥 Loading 24h historical BNB/USDT data...');

    // Fetch last 288 5-minute candles from Binance (24 hours)
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: 'BNBUSDT',
        interval: '5m',
        limit: 288
      }
    });

    const candles = response.data;
    console.log(`✅ Fetched ${candles.length} candles from Binance`);

    // Convert to price history format
    const priceHistory = candles.map(candle => ({
      price: parseFloat(candle[4]), // Close price
      volume: parseFloat(candle[5]), // Volume
      timestamp: candle[0] // Open time
    }));

    // Calculate actual volatility for verification using LOG RETURNS (correct methodology)
    const prices = priceHistory.map(d => d.price);

    // Calculate logarithmic returns (not simple differences)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const logReturn = Math.log(prices[i] / prices[i - 1]);
      returns.push(logReturn);
    }

    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate variance
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;

    // Calculate volatility (standard deviation of log returns)
    const volatilityPer5Min = Math.sqrt(variance);

    // Scale to 24-hour volatility (288 five-minute periods in 24 hours)
    const volatility24h = volatilityPer5Min * Math.sqrt(288);

    console.log(`✅ Loaded ${priceHistory.length} data points`);
    console.log(`📊 Calculated 24h volatility: ${(volatility24h * 100).toFixed(2)}%`);
    console.log(`💰 Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`);

    // Ensure data directory exists
    const dataDir = './data';
    await fs.mkdir(dataDir, { recursive: true });

    // Write to price-history.json
    const filePath = path.join(dataDir, 'price-history.json');
    await fs.writeFile(filePath, JSON.stringify(priceHistory, null, 2));

    console.log(`✅ Written to ${filePath}`);
    console.log('✅ Historical data loaded successfully!');
    console.log('');
    console.log('🚀 Now restart the bot with: npm start');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error loading historical data:', error.message);
    process.exit(1);
  }
}

loadHistoricalData();
