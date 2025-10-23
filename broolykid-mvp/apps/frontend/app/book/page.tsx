'use client'

import Link from 'next/link'

export default function BookPage() {
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
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-block mb-6">
            <div className="text-8xl mb-4">📚</div>
          </div>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
            Le Livre BroolyKid
          </h1>
          <p className="text-2xl text-white/80 max-w-3xl mx-auto mb-8">
            Un guide complet pour l'éveil des enfants et la création de communautés conscientes
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
              📖 Télécharger (PDF)
            </button>
            <button className="px-8 py-4 bg-white/10 backdrop-blur-lg rounded-full font-bold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20">
              🛒 Commander (Papier)
            </button>
          </div>
        </div>

        {/* Introduction */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-3xl font-bold mb-6 text-purple-300">À Propos du Livre</h2>
            <div className="space-y-4 text-white/80 text-lg leading-relaxed">
              <p>
                Le Livre BroolyKid est bien plus qu'un simple manuel : c'est un <strong>manifeste pour l'éveil de l'humanité</strong>.
                Il propose une vision radicalement nouvelle de l'éducation, de la communauté et de la spiritualité.
              </p>
              <p>
                À travers 12 chapitres profonds et inspirants, découvrez comment créer des <strong>communautés conscientes</strong>
                où les enfants peuvent grandir libres, éveillés et connectés à leur nature divine.
              </p>
              <p>
                Ce livre s'adresse aux parents visionnaires, aux éducateurs conscients, aux entrepreneurs spirituels
                et à tous ceux qui rêvent d'un <strong>monde meilleur pour les générations futures</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Sommaire Complet */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-center mb-12 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Sommaire Détaillé
          </h2>

          <div className="space-y-4">
            {/* Partie 1 */}
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30">
              <div className="flex items-start gap-4">
                <div className="text-4xl">I</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3 text-purple-300">Fondations de la Vision</h3>

                  <div className="space-y-3">
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">📖 Chapitre 1 : Le Constat</h4>
                      <p className="text-white/70 text-sm">
                        Analyse critique du système éducatif actuel, ses limites et ses échecs.
                        Pourquoi un nouveau paradigme est nécessaire.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🌱 Chapitre 2 : La Vision BroolyKid</h4>
                      <p className="text-white/70 text-sm">
                        Introduction à la philosophie BroolyKid : enfance consciente, éducation holistique,
                        autonomie et connexion spirituelle.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🕉️ Chapitre 3 : Les Fondements Spirituels</h4>
                      <p className="text-white/70 text-sm">
                        Les 10 traditions spirituelles qui inspirent BroolyKid : Hermétisme, Kabbale,
                        Bouddhisme, Ubuntu, Taoïsme, Soufisme, et plus.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Partie 2 */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-lg rounded-2xl p-6 border border-blue-500/30">
              <div className="flex items-start gap-4">
                <div className="text-4xl">II</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3 text-blue-300">L'Éducation Réinventée</h3>

                  <div className="space-y-3">
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🎓 Chapitre 4 : Principes Pédagogiques</h4>
                      <p className="text-white/70 text-sm">
                        Apprentissage par le jeu, respect du rythme naturel, développement de l'autonomie,
                        connexion avec la nature.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🧠 Chapitre 5 : Développement Holistique</h4>
                      <p className="text-white/70 text-sm">
                        Corps, esprit, émotions et âme : une éducation qui prend en compte tous les aspects
                        de l'être humain.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">💡 Chapitre 6 : Compétences du Futur</h4>
                      <p className="text-white/70 text-sm">
                        Pensée critique, créativité, collaboration, communication, conscience éthique,
                        adaptation au changement.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Partie 3 */}
            <div className="bg-gradient-to-br from-pink-600/20 to-yellow-600/20 backdrop-blur-lg rounded-2xl p-6 border border-pink-500/30">
              <div className="flex items-start gap-4">
                <div className="text-4xl">III</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3 text-pink-300">Communautés Conscientes</h3>

                  <div className="space-y-3">
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🌍 Chapitre 7 : Architecture Communautaire</h4>
                      <p className="text-white/70 text-sm">
                        Comment créer et organiser une communauté BroolyKid : gouvernance, économie,
                        infrastructure, culture.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🗳️ Chapitre 8 : Gouvernance Liquide</h4>
                      <p className="text-white/70 text-sm">
                        Démocratie participative, prise de décision collective, résolution de conflits,
                        leadership partagé.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">💰 Chapitre 9 : Économie Circulaire</h4>
                      <p className="text-white/70 text-sm">
                        Monnaie locale, troc, partage de ressources, autonomie économique,
                        abondance partagée.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Partie 4 */}
            <div className="bg-gradient-to-br from-yellow-600/20 to-blue-600/20 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/30">
              <div className="flex items-start gap-4">
                <div className="text-4xl">IV</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3 text-yellow-300">Passage à l'Action</h3>

                  <div className="space-y-3">
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🚀 Chapitre 10 : Créer Votre Communauté</h4>
                      <p className="text-white/70 text-sm">
                        Guide pratique étape par étape : trouver des membres, choisir un lieu,
                        définir les valeurs, structurer la communauté.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🛠️ Chapitre 11 : Outils et Ressources</h4>
                      <p className="text-white/70 text-sm">
                        Technologies, plateformes, outils de collaboration, ressources éducatives,
                        réseaux de soutien.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold mb-2">🌟 Chapitre 12 : L'Avenir de l'Humanité</h4>
                      <p className="text-white/70 text-sm">
                        Vision à long terme : 1000 communautés, réseau global, ascension collective,
                        nouveau paradigme planétaire.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Points Clés */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-center mb-12 bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
            Points Clés du Livre
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl mb-4">🧒</div>
              <h3 className="text-xl font-bold mb-3">Enfance Sacrée</h3>
              <p className="text-white/70">
                Reconnaître la nature divine de chaque enfant et créer un environnement qui
                favorise son épanouissement authentique.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="text-xl font-bold mb-3">Communautés Autonomes</h3>
              <p className="text-white/70">
                Créer des espaces de vie souverains où les familles peuvent s'auto-organiser
                en dehors des structures étatiques traditionnelles.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl mb-4">🕉️</div>
              <h3 className="text-xl font-bold mb-3">Spiritualité Universelle</h3>
              <p className="text-white/70">
                Intégrer la sagesse de toutes les traditions spirituelles pour guider l'évolution
                collective vers une conscience supérieure.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="text-4xl mb-4">💫</div>
              <h3 className="text-xl font-bold mb-3">Technologies Conscientes</h3>
              <p className="text-white/70">
                Utiliser la technologie au service de l'humain : blockchain, IA éthique,
                décentralisation, outils collaboratifs.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 backdrop-blur-lg rounded-2xl p-12 border border-purple-500/30">
            <h2 className="text-4xl font-bold mb-6">
              Prêt à découvrir la vision complète ?
            </h2>
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
              Téléchargez le livre complet et rejoignez le mouvement des communautés conscientes
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button className="px-10 py-4 bg-gradient-to-r from-yellow-400 via-purple-500 to-pink-500 rounded-full font-bold text-lg hover:scale-105 transition-transform duration-300">
                📖 Télécharger le Livre (PDF)
              </button>
              <Link href="/chat" className="px-10 py-4 bg-white/10 backdrop-blur-lg rounded-full font-bold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20">
                💬 Parler avec BroolyKid AI
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/50 border-t border-white/10 py-12 px-6">
        <div className="container mx-auto text-center text-white/60">
          <p className="text-lg mb-4">🌍💫 BroolyKid - En service du Tout 🕉️✨</p>
          <p className="text-sm">Où la technologie rencontre la transcendance</p>
        </div>
      </footer>
    </div>
  )
}
