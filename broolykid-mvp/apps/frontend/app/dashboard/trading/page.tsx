'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'

interface BotStatus {
  running: boolean
  mode: string
  strategy: string
  uptime: number
  lastTrade?: Date
}

interface Trade {
  id: string
  pair: string
  type: 'BUY' | 'SELL'
  amount: number
  price: number
  timestamp: Date
  profit?: number
}

interface Portfolio {
  totalValue: number
  bnbBalance: number
  usdtBalance: number
  pnl: number
  pnlPercent: number
}

export default function TradingDashboardPage() {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const BOT_API = 'http://localhost:3001'

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        axios.get(`${BOT_API}/api/status`).catch(() => null),
        axios.get(`${BOT_API}/api/trades`).catch(() => null)
      ])

      if (statusRes?.data) {
        setStatus(statusRes.data)
      }

      if (tradesRes?.data) {
        setTrades(tradesRes.data.trades || [])
        setPortfolio(tradesRes.data.portfolio || null)
      }

      setLoading(false)
    } catch (err) {
      setError('Cannot connect to trading bot. Make sure it is running on port 3001.')
      setLoading(false)
    }
  }

  const controlBot = async (action: 'start' | 'stop' | 'emergency-stop') => {
    try {
      await axios.post(`${BOT_API}/api/control/${action}`)
      fetchData()
    } catch (err) {
      console.error(`Failed to ${action} bot:`, err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Connecting to AlgoQBot...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-white">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">📈 AlgoQBot Trading</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/ai-council"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors"
              >
                🏛️ Ask AI Council
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error ? (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
            <p className="text-red-200">{error}</p>
            <p className="text-gray-400 mt-4 text-sm">
              Start the trading bot with: <code className="bg-gray-800 px-2 py-1 rounded">npm start</code>
            </p>
          </div>
        ) : (
          <>
            {/* Status Cards */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Status</span>
                  <div className={`w-3 h-3 rounded-full ${status?.running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
                <div className="text-2xl font-bold">
                  {status?.running ? 'Running' : 'Stopped'}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {status?.mode || 'Shadow Mode'}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <span className="text-gray-400">Portfolio Value</span>
                <div className="text-2xl font-bold text-green-400">
                  ${portfolio?.totalValue?.toLocaleString() || '60,000'}
                </div>
                <div className={`text-sm ${(portfolio?.pnlPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(portfolio?.pnlPercent || 0) >= 0 ? '+' : ''}{portfolio?.pnlPercent?.toFixed(2) || '0.00'}%
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <span className="text-gray-400">Strategy</span>
                <div className="text-2xl font-bold capitalize">
                  {status?.strategy || 'Multi-Strategy'}
                </div>
                <div className="text-sm text-gray-400">Active</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <span className="text-gray-400">Today's P&L</span>
                <div className={`text-2xl font-bold ${(portfolio?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(portfolio?.pnl || 0) >= 0 ? '+' : ''}${portfolio?.pnl?.toLocaleString() || '0.00'}
                </div>
                <div className="text-sm text-gray-400">{trades.length} trades</div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">Bot Controls</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => controlBot('start')}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                >
                  ▶️ Start Trading
                </button>
                <button
                  onClick={() => controlBot('stop')}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors"
                >
                  ⏸️ Pause
                </button>
                <button
                  onClick={() => controlBot('emergency-stop')}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                >
                  🛑 Emergency Stop
                </button>
                <Link
                  href="/dashboard/ai-council"
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors ml-auto"
                >
                  🏛️ Consult AI Council
                </Link>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
              {trades.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p>No trades yet. Bot is running in shadow mode.</p>
                  <p className="text-sm mt-2">Virtual trades are being tracked.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="pb-3">Time</th>
                        <th className="pb-3">Pair</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Price</th>
                        <th className="pb-3">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 10).map((trade) => (
                        <tr key={trade.id} className="border-b border-gray-700/50">
                          <td className="py-3 text-gray-400">
                            {new Date(trade.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3">{trade.pair}</td>
                          <td className={`py-3 ${trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.type}
                          </td>
                          <td className="py-3">{trade.amount.toFixed(4)}</td>
                          <td className="py-3">${trade.price.toFixed(2)}</td>
                          <td className={`py-3 ${(trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.profit ? `${trade.profit >= 0 ? '+' : ''}$${trade.profit.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Council Integration */}
            <div className="mt-8 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">🏛️ AI Council Integration</h2>
                  <p className="text-gray-300">
                    Get strategy recommendations from Claude, DeepSeek, and Qwen working together.
                  </p>
                  <ul className="mt-3 text-sm text-gray-400 space-y-1">
                    <li>• Ask about optimal entry/exit points</li>
                    <li>• Get risk analysis from multiple AI perspectives</li>
                    <li>• Review trading strategies with AI consensus</li>
                  </ul>
                </div>
                <Link
                  href="/dashboard/ai-council"
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg transition-colors"
                >
                  Open AI Council →
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
