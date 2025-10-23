'use client'

import { authApi } from '@/lib/api-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
      return
    }

    authApi.me()
      .then(res => {
        setUser(res.data.user)
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('token')
        router.push('/auth/login')
      })
  }, [router])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between">
            <h1 className="text-xl font-bold">🌍 BROOLYKID</h1>
            <div className="flex items-center gap-4">
              <span>Welcome, {user?.username}</span>
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  router.push('/')
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Dashboard</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">👥 Community</h3>
            <p className="text-gray-600">Manage your profile</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">🗳️ Governance</h3>
            <p className="text-gray-600">Vote on proposals</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">🎓 Academy</h3>
            <p className="text-gray-600">Learn and grow</p>
          </div>

          <Link href="/chat" className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-lg shadow text-white hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
            <h3 className="text-lg font-semibold mb-2">🌟 BroolyKid AI</h3>
            <p className="text-purple-100">Chat with the Universal Messenger</p>
            <div className="mt-4 text-sm opacity-90">
              ✨ Spiritual guidance • 🕉️ Universal wisdom • 💫 Consciousness evolution
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
