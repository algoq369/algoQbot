/**
 * AlgoQBot Trading Tools
 * Tools for trading analysis, portfolio management, and AI consensus
 */

import fs from "fs/promises";
import path from "path";

const DATA_PATH = process.env.ALGOQBOT_DATA || "/home/user/algoQbot/data";

async function readDataFile(filename) {
  try {
    const content = await fs.readFile(path.join(DATA_PATH, filename), "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

export const tradingTools = {
  // Get current portfolio
  trading_get_portfolio: {
    description: "Get current portfolio allocation with USDT/BNB balances and P&L",
    parameters: {},
    required: [],
    handler: async () => {
      const balances = await readDataFile("virtual_balances.json");
      const trades = await readDataFile("shadow_trades.json") || [];
      
      if (!balances) {
        return { error: "Could not read portfolio data" };
      }

      const bnbValue = balances.bnb * balances.currentPrice;
      const total = balances.usdt + bnbValue;

      return {
        usdt: balances.usdt,
        bnb: balances.bnb,
        bnbPrice: balances.currentPrice,
        bnbValue: bnbValue,
        total: total,
        allocation: {
          usdt: ((balances.usdt / total) * 100).toFixed(1) + "%",
          bnb: ((bnbValue / total) * 100).toFixed(1) + "%"
        },
        tradesCount: trades.length,
        lastUpdated: balances.lastUpdated
      };
    }
  },

  // Get bot state
  trading_get_bot_state: {
    description: "Get current bot status, strategy, and volatility regime",
    parameters: {},
    required: [],
    handler: async () => {
      const state = await readDataFile("bot_state.json");
      
      if (!state) {
        return { error: "Could not read bot state" };
      }

      return {
        running: state.running,
        mode: state.mode,
        strategy: state.strategy,
        volatility: state.volatility,
        confidence: state.confidence,
        lastAction: state.lastAction,
        lastUpdate: state.lastUpdate
      };
    }
  },

  // Analyze market conditions
  trading_analyze_market: {
    description: "Analyze current market conditions for BNB/USDT",
    parameters: {
      timeframe: { type: "string", description: "Timeframe: 1h, 4h, or 1d" },
      depth: { type: "string", description: "Analysis depth: quick or full" }
    },
    required: [],
    handler: async (args, server) => {
      const state = await readDataFile("bot_state.json");
      const balances = await readDataFile("virtual_balances.json");

      const context = {
        price: balances?.currentPrice || 0,
        volatility: state?.volatility || {},
        strategy: state?.strategy || "unknown",
        confidence: state?.confidence || 0,
        timeframe: args.timeframe || "4h"
      };

      // Use DeepSeek for analysis
      if (args.depth === "full" && server?.deepseek) {
        return await server.deepseek.analyzeTrading(context);
      }

      return {
        timeframe: args.timeframe || "4h",
        price: context.price,
        volatility: context.volatility,
        strategy: context.strategy,
        confidence: context.confidence,
        recommendation: context.volatility.regime === "VERY_LOW" 
          ? "Wait for higher volatility before trading"
          : "Market conditions suitable for " + context.strategy + " strategy"
      };
    }
  },

  // Get trade history
  trading_get_trades: {
    description: "Get recent trade history with P&L",
    parameters: {
      limit: { type: "number", description: "Number of trades to return (default 20)" }
    },
    required: [],
    handler: async (args) => {
      const trades = await readDataFile("shadow_trades.json") || [];
      const limit = args.limit || 20;

      const recentTrades = trades.slice(-limit);
      
      const stats = {
        total: trades.length,
        wins: trades.filter(t => (t.profit || 0) > 0).length,
        losses: trades.filter(t => (t.profit || 0) < 0).length,
        totalPnL: trades.reduce((sum, t) => sum + (t.profit || 0), 0)
      };

      return {
        trades: recentTrades,
        stats: stats,
        winRate: stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) + "%" : "0%"
      };
    }
  },

  // AI Council consensus decision
  trading_ai_council: {
    description: "Get AI council consensus on trading decision (uses DeepSeek + Qwen)",
    parameters: {
      action: { type: "string", description: "Proposed action: BUY, SELL, or HOLD" },
      context: { type: "string", description: "Additional context for the decision" }
    },
    required: ["action"],
    handler: async (args, server) => {
      if (!server?.consensus) {
        return { error: "AI consensus engine not available" };
      }

      const state = await readDataFile("bot_state.json");
      const balances = await readDataFile("virtual_balances.json");

      const fullContext = {
        proposedAction: args.action,
        userContext: args.context,
        currentState: state,
        portfolio: balances
      };

      return await server.consensus.getConsensus("trading_decision", fullContext);
    }
  },

  // Assess portfolio risk
  trading_assess_risk: {
    description: "Assess current portfolio risk level",
    parameters: {},
    required: [],
    handler: async () => {
      const state = await readDataFile("bot_state.json");
      const balances = await readDataFile("virtual_balances.json");
      const trades = await readDataFile("shadow_trades.json") || [];

      const bnbValue = balances.bnb * balances.currentPrice;
      const total = balances.usdt + bnbValue;
      const bnbPercent = (bnbValue / total) * 100;

      const losses = trades.filter(t => (t.profit || 0) < 0);
      const maxDrawdown = Math.min(...losses.map(t => t.profit || 0), 0);

      let riskLevel = "LOW";
      if (bnbPercent > 50) riskLevel = "HIGH";
      else if (bnbPercent > 40) riskLevel = "MEDIUM";

      return {
        riskLevel: riskLevel,
        bnbExposure: bnbPercent.toFixed(1) + "%",
        volatilityRegime: state?.volatility?.regime || "UNKNOWN",
        maxDrawdown: maxDrawdown,
        recommendations: [
          bnbPercent > 45 ? "Consider reducing BNB exposure" : "BNB allocation within target",
          state?.volatility?.regime === "VERY_LOW" ? "Low volatility - reduced trading opportunities" : "Volatility suitable for trading"
        ]
      };
    }
  }
};
