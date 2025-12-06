'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'

interface Message {
  id: string
  type: 'user' | 'ai' | 'system'
  provider?: 'claude' | 'deepseek' | 'qwen'
  content: string
  reasoning?: string
  tokens?: { input: number; output: number; total: number; cost: number }
  stance?: string
  confidence?: number
  timestamp: Date
  round?: number
}

interface SessionState {
  round: number
  maxRounds: number
  agreementScore: number
  consensusReached: boolean
  totalTokens: { input: number; output: number; total: number; cost: number }
}

const AI_CONFIG = {
  claude: { color: 'purple', emoji: '🟣', name: 'Claude', role: 'Architect' },
  deepseek: { color: 'green', emoji: '🟢', name: 'DeepSeek', role: 'Mathematician' },
  qwen: { color: 'blue', emoji: '🔵', name: 'Qwen', role: 'Strategist' }
}

export default function AICouncilPage() {
  const router = useRouter()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isDeliberating, setIsDeliberating] = useState(false)
  const [session, setSession] = useState<SessionState>({
    round: 0,
    maxRounds: 3,
    agreementScore: 0,
    consensusReached: false,
    totalTokens: { input: 0, output: 0, total: 0, cost: 0 }
  })
  const [tokenCounts, setTokenCounts] = useState({ claude: 0, deepseek: 0, qwen: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Connect to AI Council WebSocket server
  useEffect(() => {
    const newSocket = io('http://localhost:9000', {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      setConnected(true)
      addSystemMessage('Connected to AI Council')
    })

    newSocket.on('disconnect', () => {
      setConnected(false)
      addSystemMessage('Disconnected from AI Council')
    })

    newSocket.on('council_event', (event: any) => {
      handleCouncilEvent(event)
    })

    newSocket.on('session_complete', (data: any) => {
      setIsDeliberating(false)
      setSession(prev => ({
        ...prev,
        agreementScore: data.consensus.score,
        consensusReached: data.consensus.reached,
        round: data.consensus.rounds
      }))

      if (data.consensus.reached) {
        addSystemMessage(`✅ Consensus reached! Agreement: ${(data.consensus.score * 100).toFixed(1)}%`)
      } else {
        addSystemMessage(`⚠️ Max rounds reached. Decision by majority vote.`)
      }
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    }])
  }

  const handleCouncilEvent = (event: any) => {
    switch (event.type) {
      case 'status':
        if (event.data.status === 'round_start') {
          setSession(prev => ({ ...prev, round: event.data.round }))
          addSystemMessage(`📢 Round ${event.data.round}/${event.data.maxRounds} starting...`)
        }
        break

      case 'message':
        if (event.data.type === 'ai' && event.data.provider) {
          setMessages(prev => [...prev, {
            id: event.data.id || Date.now().toString(),
            type: 'ai',
            provider: event.data.provider,
            content: event.data.content,
            reasoning: event.data.reasoning,
            tokens: event.data.tokens,
            stance: event.data.stance,
            confidence: event.data.confidence,
            timestamp: new Date(event.data.timestamp),
            round: event.data.round
          }])

          // Update token counts
          if (event.data.tokens) {
            setTokenCounts(prev => ({
              ...prev,
              [event.data.provider]: prev[event.data.provider as keyof typeof prev] + event.data.tokens.total
            }))
            setSession(prev => ({
              ...prev,
              totalTokens: {
                input: prev.totalTokens.input + event.data.tokens.input,
                output: prev.totalTokens.output + event.data.tokens.output,
                total: prev.totalTokens.total + event.data.tokens.total,
                cost: prev.totalTokens.cost + event.data.tokens.cost
              }
            }))
          }
        }
        break

      case 'consensus':
        setSession(prev => ({
          ...prev,
          agreementScore: event.data.score || prev.agreementScore,
          consensusReached: event.data.reached
        }))
        break
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !socket || isDeliberating) return

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }])

    // Reset session state
    setTokenCounts({ claude: 0, deepseek: 0, qwen: 0 })
    setSession({
      round: 0,
      maxRounds: 3,
      agreementScore: 0,
      consensusReached: false,
      totalTokens: { input: 0, output: 0, total: 0, cost: 0 }
    })

    // Start council session
    setIsDeliberating(true)
    socket.emit('start_session', { task: input })
    setInput('')
  }

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'claude': return 'border-purple-500 bg-purple-500/10'
      case 'deepseek': return 'border-green-500 bg-green-500/10'
      case 'qwen': return 'border-blue-500 bg-blue-500/10'
      default: return 'border-gray-500'
    }
  }

  const getProviderTextColor = (provider: string) => {
    switch (provider) {
      case 'claude': return 'text-purple-400'
      case 'deepseek': return 'text-green-400'
      case 'qwen': return 'text-blue-400'
      default: return 'text-gray-400'
    }
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
              <h1 className="text-xl font-bold">🏛️ AI Council</h1>
            </div>
            <div className="flex items-center gap-4">
              {Object.entries(AI_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full text-sm">
                  <span>{config.emoji}</span>
                  <span>{config.name}</span>
                  <span className="text-gray-400 text-xs">({config.role})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-20">
                <div className="text-6xl mb-4">🏛️</div>
                <h2 className="text-xl font-semibold mb-2">Welcome to AI Council</h2>
                <p>Ask a question and watch Claude, DeepSeek, and Qwen collaborate to find the best answer.</p>
                <p className="text-sm mt-2">They will debate until reaching 80% consensus or max 3 rounds.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-4xl ${msg.type === 'user' ? 'ml-auto' : msg.type === 'system' ? 'mx-auto' : ''}`}
              >
                {msg.type === 'system' ? (
                  <div className="text-center text-gray-400 text-sm py-2 px-4 bg-gray-800 rounded-lg">
                    {msg.content}
                  </div>
                ) : msg.type === 'user' ? (
                  <div className="bg-purple-600 rounded-lg p-4 max-w-xl">
                    <div className="text-sm text-purple-200 mb-1">👤 You</div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ) : msg.provider ? (
                  <div className={`border-l-4 rounded-lg p-4 ${getProviderColor(msg.provider)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className={`font-semibold ${getProviderTextColor(msg.provider)}`}>
                        {AI_CONFIG[msg.provider].emoji} {AI_CONFIG[msg.provider].name}
                        <span className="text-gray-500 text-sm ml-2">Round {msg.round}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {msg.confidence && <span className="mr-2">Confidence: {msg.confidence}%</span>}
                        {msg.stance && <span>Stance: {msg.stance}</span>}
                      </div>
                    </div>

                    {msg.reasoning && (
                      <div className="text-sm text-gray-400 italic mb-2 border-l-2 border-gray-600 pl-2">
                        💭 {msg.reasoning.slice(0, 200)}...
                      </div>
                    )}

                    <div className="whitespace-pre-wrap text-gray-200">{msg.content}</div>

                    {msg.tokens && (
                      <div className="text-xs text-gray-500 mt-2">
                        Tokens: {msg.tokens.total} | Cost: ${msg.tokens.cost.toFixed(4)}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}

            {isDeliberating && (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>Council is deliberating...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the AI Council a question..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                disabled={isDeliberating}
              />
              <button
                type="submit"
                disabled={isDeliberating || !connected}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {isDeliberating ? 'Deliberating...' : 'Ask Council'}
              </button>
            </form>
          </div>
        </div>

        {/* Metrics Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          {/* Status */}
          <div className="flex items-center gap-2 mb-6 p-3 bg-gray-700 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${isDeliberating ? 'animate-pulse' : ''}`} />
            <span>{connected ? (isDeliberating ? 'Deliberating...' : 'Connected') : 'Disconnected'}</span>
          </div>

          {/* Consensus Progress */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-400 uppercase mb-2">Consensus</h3>
            <div className="flex justify-between mb-1">
              <span>Agreement</span>
              <span className="font-bold">{(session.agreementScore * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-purple-500 transition-all duration-500"
                style={{ width: `${session.agreementScore * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <span>Round: {session.round}/{session.maxRounds}</span>
              <span>{session.consensusReached ? '✅ Reached' : '⏳ Pending'}</span>
            </div>
          </div>

          {/* Token Usage */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-400 uppercase mb-2">Token Usage</h3>
            {Object.entries(AI_CONFIG).map(([key, config]) => {
              const count = tokenCounts[key as keyof typeof tokenCounts]
              const maxCount = Math.max(...Object.values(tokenCounts), 1)
              return (
                <div key={key} className="flex items-center gap-2 mb-2">
                  <span>{config.emoji}</span>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        key === 'claude' ? 'bg-purple-500' :
                        key === 'deepseek' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm w-16 text-right">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Cost */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-400 uppercase mb-2">Session Cost</h3>
            <div className="text-2xl font-bold">${session.totalTokens.cost.toFixed(4)}</div>
            <div className="text-sm text-gray-400">
              {session.totalTokens.total} total tokens
            </div>
          </div>

          {/* Trading Bot Link */}
          <div className="mt-8 p-4 bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg">
            <h3 className="font-semibold mb-2">🤖 Trading Integration</h3>
            <p className="text-sm text-gray-300 mb-3">
              Ask the council about trading strategies, market analysis, or bot improvements.
            </p>
            <div className="text-xs text-gray-400">
              Connected to AlgoQBot trading agent
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
