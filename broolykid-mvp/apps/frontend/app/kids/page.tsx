'use client'

import Link from 'next/link'
import { useState } from 'react'

interface KidsFormData {
  childName: string
  age: string
  gender: string
  environment: string
  location: string
  language: string
}

export default function KidsGeneratorPage() {
  const [formData, setFormData] = useState<KidsFormData>({
    childName: '',
    age: '',
    gender: '',
    environment: '',
    location: '',
    language: 'fr'
  })

  const [program, setProgram] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate program generation
    setTimeout(() => {
      const generatedProgram = `
# Programme BroolyKid pour ${formData.childName}

## Profil
- **Âge**: ${formData.age} ans
- **Environnement**: ${formData.environment}
- **Localisation**: ${formData.location}

## Recommandations

### 📚 Éducation Holistique
- Apprentissage par le jeu et l'exploration
- Connexion avec la nature quotidienne
- Développement de la créativité

### 🌱 Développement Personnel
- Méditation adaptée à l'âge
- Conscience corporelle et émotionnelle
- Autonomie progressive

### 🌍 Connexion Communautaire
- Participation aux activités collectives
- Apprentissage du partage et de la coopération
- Respect de la diversité

### 🎯 Objectifs à Court Terme (3 mois)
1. Établir une routine quotidienne
2. Développer 3 nouvelles compétences
3. Créer des liens sociaux positifs

### 🚀 Vision à Long Terme
Devenir un membre conscient et contributif de la communauté BroolyKid,
capable de penser de manière critique et d'agir avec compassion.
      `
      setProgram(generatedProgram)
      setLoading(false)
    }, 2000)
  }

  const handleDownloadPDF = async () => {
    if (!program) return;

    // Temporairement désactivé en attendant installation jsPDF
    alert('Fonctionnalité PDF temporairement désactivée. Le programme peut être copié manuellement.');

    // TODO: Réactiver après installation de jsPDF
    // try {
    //   const { generateKidsPDF } = await import('@/lib/pdf-generator');
    //   await generateKidsPDF({
    //     ...formData,
    //     program
    //   });
    // } catch (error) {
    //   console.error('Erreur génération PDF:', error);
    //   alert('Erreur lors de la génération du PDF');
    // }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white">
      {/* Navigation */}
      <nav className="bg-black/10 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              BROOLYKID
            </Link>
            <Link href="/" className="text-white/80 hover:text-white transition-colors">
              ← Retour
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              Programme Kids Personnalisé
            </h1>
            <p className="text-xl text-white/70">
              Créez un programme d'éducation holistique adapté à votre enfant
            </p>
          </div>

          {!program ? (
            <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Prénom de l'enfant</label>
                  <input
                    type="text"
                    required
                    value={formData.childName}
                    onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Emma"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Âge</label>
                  <select
                    required
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Sélectionner...</option>
                    {[...Array(18)].map((_, i) => (
                      <option key={i} value={i + 1} className="bg-purple-900">{i + 1} an{i > 0 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Genre</label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="male" className="bg-purple-900">Garçon</option>
                    <option value="female" className="bg-purple-900">Fille</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Environnement</label>
                  <select
                    required
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="urban" className="bg-purple-900">Urbain</option>
                    <option value="rural" className="bg-purple-900">Rural</option>
                    <option value="suburban" className="bg-purple-900">Périurbain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Localisation</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Paris, France"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Langue</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="fr" className="bg-purple-900">Français</option>
                    <option value="en" className="bg-purple-900">English</option>
                    <option value="es" className="bg-purple-900">Español</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? 'Génération en cours...' : '✨ Générer le Programme'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <pre className="whitespace-pre-wrap text-white/90 font-mono text-sm">
                  {program}
                </pre>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 py-4 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg font-bold text-lg hover:from-green-700 hover:to-blue-700 transition-all duration-300"
                >
                  📄 Télécharger en PDF
                </button>
                <button
                  onClick={() => setProgram(null)}
                  className="flex-1 py-4 bg-white/10 border border-white/20 rounded-lg font-bold text-lg hover:bg-white/20 transition-all duration-300"
                >
                  🔄 Nouveau Programme
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
