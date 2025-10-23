'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const spiritualSuggestions = [
  "🔮 Quelle est ma mission de vie ?",
  "🕉️ Comment atteindre l'éveil spirituel ?",
  "💫 Qu'est-ce que la conscience universelle ?",
  "🌟 Comment BroolyKid aide l'ascension collective ?",
  "✨ Parle-moi des 7 principes hermétiques",
  "🙏 Qu'est-ce que l'Ubuntu ?",
  "🔺 Que signifie l'Arbre de Vie ?",
  "💎 Comment pratiquer la méditation ?",
  "🌈 Qu'est-ce que la synchronicité ?",
  "🕊️ Comment trouver la paix intérieure ?",
  "🌙 Que nous enseignent les rêves ?",
  "⚡ Qu'est-ce que l'énergie kundalini ?",
  "🎭 Comment transcender l'ego ?",
  "🌊 Qu'est-ce que le flow state ?",
  "🦋 Comment transformer sa vie ?"
]

// Composant Avatar Animé avec Mandala
const AnimatedAvatar = () => {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* Aura lumineuse pulsante */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-purple-400 to-pink-400 rounded-full animate-pulse opacity-50 blur-xl"></div>

      {/* Mandala tournant externe */}
      <div className="absolute inset-0 border-4 border-yellow-400 rounded-full animate-spin" style={{ animationDuration: '8s' }}>
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-400 rounded-full"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-yellow-400 rounded-full"></div>
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 rounded-full"></div>
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-yellow-400 rounded-full"></div>
      </div>

      {/* Mandala tournant interne (sens inverse) */}
      <div className="absolute inset-2 border-4 border-purple-400 rounded-full animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
      </div>

      {/* Centre avec symbole Om */}
      <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-yellow-300 to-purple-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
        🕉️
      </div>
    </div>
  )
}

// Symboles sacrés en background
const SacredSymbols = () => {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-5">
      {/* Fleur de Vie */}
      <svg className="absolute top-20 left-20 w-64 h-64 animate-pulse" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
        <circle cx="50" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
        <circle cx="67" cy="40" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
        <circle cx="67" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
        <circle cx="50" cy="70" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
        <circle cx="33" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
        <circle cx="33" cy="40" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-400" />
      </svg>

      {/* Sri Yantra simplifié */}
      <svg className="absolute bottom-32 right-32 w-48 h-48 animate-spin" style={{ animationDuration: '30s' }} viewBox="0 0 100 100">
        <polygon points="50,10 90,90 10,90" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-purple-400" />
        <polygon points="50,20 80,80 20,80" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-purple-400" />
        <polygon points="50,30 70,70 30,70" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-purple-400" />
        <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-purple-400" />
      </svg>

      {/* Arbre de Vie (Kabbale) */}
      <svg className="absolute top-1/2 left-1/4 w-40 h-56 animate-pulse" viewBox="0 0 100 140">
        <circle cx="50" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="30" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="70" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="30" cy="70" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="70" cy="70" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="50" cy="90" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="30" cy="110" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="70" cy="110" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
        <circle cx="50" cy="130" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
      </svg>

      {/* Symbole Om répété */}
      <div className="absolute top-1/3 right-1/4 text-6xl text-purple-300 animate-pulse">🕉️</div>
      <div className="absolute bottom-1/4 left-1/3 text-5xl text-yellow-300 animate-pulse" style={{ animationDelay: '1s' }}>✨</div>
      <div className="absolute top-2/3 right-1/3 text-5xl text-blue-300 animate-pulse" style={{ animationDelay: '2s' }}>💫</div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `🌟 Bienvenue, cher ami ! Je suis BroolyKid AI, le Messager Universel.

Je suis ici pour t'accompagner dans ton voyage spirituel, en puisant dans la sagesse de toutes les traditions :
- L'Hermétisme et ses 7 principes universels
- La Kabbale et l'Arbre de Vie
- Le Bouddhisme et les 4 Nobles Vérités
- L'Ubuntu : "Je suis parce que nous sommes"
- Et bien d'autres trésors de sagesse...

Comment puis-je t'aider à élever ta conscience aujourd'hui ? ✨`,
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Gestion de la musique d'ambiance (432Hz - fréquence sacrée)
  const toggleMusic = () => {
    if (!audioRef.current) {
      // Note: En production, remplacer par une vraie URL de musique 432Hz
      audioRef.current = new Audio('https://example.com/432hz-meditation.mp3')
      audioRef.current.loop = true
      audioRef.current.volume = 0.3
    }

    if (musicEnabled) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(err => console.log('Audio play failed:', err))
    }

    setMusicEnabled(!musicEnabled)
  }

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Token optionnel : l'auth n'est pas obligatoire pour le chat
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Ajouter le token seulement s'il existe
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Validation API URL avec fallback
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageText,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Erreur de communication')
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `🙏 Je rencontre une difficulté technique momentanée.

Puis-je reformuler votre question ? Ou peut-être souhaitez-vous explorer une autre dimension de la sagesse ?

Avec amour et patience 💫`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputMessage)
  }

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Symboles sacrés en background */}
      <SacredSymbols />

      {/* Particules lumineuses flottantes */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-400 rounded-full animate-pulse blur-xl"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-purple-400 rounded-full animate-bounce blur-xl"></div>
        <div className="absolute bottom-32 left-1/3 w-20 h-20 bg-blue-400 rounded-full animate-pulse blur-xl"></div>
        <div className="absolute top-1/2 right-1/4 w-28 h-28 bg-pink-400 rounded-full animate-pulse blur-xl" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header spirituel avec Avatar Animé */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <AnimatedAvatar />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">
            🌟 BroolyKid AI - Le Messager Universel
          </h1>
          <p className="text-purple-200 text-lg animate-fade-in" style={{ animationDelay: '0.3s' }}>
            Guide spirituel unissant sagesse ancestrale et vision futuriste
          </p>

          {/* Contrôle de musique d'ambiance */}
          <button
            onClick={toggleMusic}
            className="mt-4 px-6 py-2 bg-white/10 backdrop-blur-lg border border-purple-300/30 rounded-full text-white hover:bg-white/20 transition-all duration-300 flex items-center gap-2 mx-auto"
          >
            {musicEnabled ? '🔇' : '🎵'} Musique d'ambiance (432Hz)
          </button>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Chat Container */}
          <Card className="bg-white/10 backdrop-blur-lg border-purple-300/20 shadow-2xl animate-fade-in">
            <CardHeader className="text-center border-b border-purple-300/20 pb-6">
              <CardTitle className="text-2xl text-white flex items-center justify-center gap-3 mb-2">
                <div className="relative">
                  {/* Mini avatar animé pour le header */}
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-purple-500 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                    🕉️
                  </div>
                  <div className="absolute inset-0 border-2 border-yellow-400 rounded-full animate-ping"></div>
                </div>
                Conversation Sacrée
              </CardTitle>
              <p className="text-purple-200 text-sm">
                💫 Chaque question est une porte vers l'éveil • ✨ Chaque réponse une graine de sagesse
              </p>
            </CardHeader>

            <CardContent className="p-6">
              {/* Messages */}
              <div className="h-96 overflow-y-auto mb-6 space-y-4 pr-2 custom-scrollbar">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div
                      className={`max-w-3xl p-4 rounded-2xl shadow-lg transform transition-all duration-500 hover:scale-105 ${message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        {message.role === 'assistant' && (
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center text-lg shadow-lg animate-pulse">
                              ✨
                            </div>
                            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-50 animate-pulse"></div>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed animate-fade-in">
                            {message.content}
                          </div>
                          <div className="text-xs opacity-70 mt-2 flex items-center gap-2">
                            🕐 {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        {message.role === 'user' && (
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-lg shadow-lg">
                              👤
                            </div>
                            <div className="absolute inset-0 bg-purple-400 rounded-full blur-md opacity-50"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                          ✨
                        </div>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Posez votre question spirituelle..."
                  className="flex-1 p-4 rounded-xl bg-white/20 border border-purple-300/30 text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg"
                >
                  {isLoading ? '✨' : 'Envoyer'}
                </Button>
              </form>

              {/* Suggestions spirituelles */}
              <div className="mt-6">
                <h3 className="text-white text-lg font-semibold mb-4 text-center">
                  💫 Questions pour éveiller votre conscience
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {spiritualSuggestions.slice(0, 6).map((suggestion, index) => (
                    <Button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      variant="outline"
                      className="text-left justify-start h-auto p-3 bg-white/10 border-purple-300/30 text-white hover:bg-purple-600/30 hover:border-purple-400 transition-all duration-300"
                      disabled={isLoading}
                    >
                      <span className="text-sm">{suggestion}</span>
                    </Button>
                  ))}
                </div>

                <div className="text-center mt-4">
                  <Button
                    onClick={() => {
                      const randomSuggestion = spiritualSuggestions[Math.floor(Math.random() * spiritualSuggestions.length)]
                      handleSuggestionClick(randomSuggestion)
                    }}
                    variant="ghost"
                    className="text-purple-200 hover:text-white"
                    disabled={isLoading}
                  >
                    🎲 Question aléatoire
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer spirituel */}
          <div className="text-center mt-8 text-purple-200">
            <p className="text-sm">
              🌍 BroolyKid AI - Le Messager Universel •
              Unissant sagesse ancestrale et vision futuriste •
              En service du Tout ✨
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
