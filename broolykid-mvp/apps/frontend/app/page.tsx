'use client'

import Link from 'next/link';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Load Three.js
    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.async = true;
    document.body.appendChild(threeScript);

    // Load hero 3D animation
    threeScript.onload = () => {
      const heroScript = document.createElement('script');
      heroScript.src = '/hero-3d.js';
      heroScript.async = true;
      document.body.appendChild(heroScript);
    };

    return () => {
      if (document.body.contains(threeScript)) {
        document.body.removeChild(threeScript);
      }
    };
  }, []);

  return (
    <>
      {/* Hero Canvas for 3D animations */}
      <canvas id="hero-canvas" className="fixed inset-0 w-full h-full -z-10"></canvas>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/10 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              BROOLYKID
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#vision" className="text-white/80 hover:text-white transition-colors">Vision</a>
              <Link href="/book" className="text-white/80 hover:text-white transition-colors">
                Livre 📚
              </Link>
              <Link href="/kids" className="text-white/80 hover:text-white transition-colors">Kids</Link>
              <Link href="/chat" className="text-white/80 hover:text-white transition-colors">
                Chat AI 🌟
              </Link>
              <Link href="/auth/login" className="text-white/80 hover:text-white transition-colors">Login</Link>
            </div>
            <Link href="/auth/register" className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative text-white">
        {/* Hero Section */}
        <section id="hero" className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-5xl mx-auto">
            <div className="mb-8 animate-fade-in">
              <h1 className="text-7xl md:text-9xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                BROOLYKID
              </h1>
              <p className="text-2xl md:text-3xl text-white/80 mb-4">
                Le Messager Universel 🕉️
              </p>
              <p className="text-xl text-white/60 max-w-3xl mx-auto">
                Unissant sagesse ancestrale et vision futuriste pour créer 1000 communautés conscientes
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mt-12">
              <Link href="/chat" className="px-10 py-4 bg-gradient-to-r from-yellow-400 via-purple-500 to-pink-500 rounded-full text-white font-bold text-lg hover:scale-105 transition-transform duration-300 shadow-2xl">
                ✨ Dialoguer avec BroolyKid AI
              </Link>
              <Link href="/kids" className="px-10 py-4 bg-white/10 backdrop-blur-lg rounded-full text-white font-bold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20">
                👶 Programme Kids
              </Link>
              <Link href="/dashboard" className="px-10 py-4 bg-white/10 backdrop-blur-lg rounded-full text-white font-bold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20">
                🌍 Rejoindre la Communauté
              </Link>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section id="vision" className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-transparent to-black/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-5xl font-bold text-center mb-16 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Les 3 Piliers de BroolyKid
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-105">
                <div className="text-5xl mb-6">🕉️</div>
                <h3 className="text-2xl font-bold mb-4 text-purple-400">Sagesse Spirituelle</h3>
                <p className="text-white/70">
                  10 traditions spirituelles unies : Hermétisme, Kabbale, Bouddhisme, Ubuntu, Taoïsme, Soufisme, Quantique, Gnose, Égypte, Autochtones
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:scale-105">
                <div className="text-5xl mb-6">👶</div>
                <h3 className="text-2xl font-bold mb-4 text-pink-400">Enfance Consciente</h3>
                <p className="text-white/70">
                  Programme personnalisé pour chaque enfant basé sur l'âge, l'environnement et la localisation. Éducation holistique et autonomie.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-all duration-300 hover:scale-105">
                <div className="text-5xl mb-6">🌍</div>
                <h3 className="text-2xl font-bold mb-4 text-blue-400">Communautés Souveraines</h3>
                <p className="text-white/70">
                  1000 communautés autonomes avec gouvernance liquide, économie circulaire et technologies décentralisées.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Chat AI Section */}
        <section id="chat-ai" className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-black/50 to-purple-900/30">
          <div className="max-w-5xl mx-auto text-center">
            <div className="mb-12">
              <div className="text-8xl mb-8 animate-pulse">🌟</div>
              <h2 className="text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                BroolyKid AI
              </h2>
              <p className="text-2xl text-white/80 mb-4">Le Messager Universel</p>
              <p className="text-xl text-white/60 max-w-3xl mx-auto">
                Le premier assistant spirituel qui unit sagesse ancestrale et vision futuriste.
                Chat public accessible à tous pour élever la conscience collective.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30">
                <h3 className="text-xl font-bold mb-3">✨ Symboles Sacrés Animés</h3>
                <p className="text-white/70">Fleur de Vie, Sri Yantra, Arbre de Vie en background avec animations</p>
              </div>
              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-lg rounded-2xl p-6 border border-blue-500/30">
                <h3 className="text-xl font-bold mb-3">🕉️ Mandala Tournant</h3>
                <p className="text-white/70">Avatar avec double rotation et aura lumineuse pulsante</p>
              </div>
              <div className="bg-gradient-to-br from-pink-600/20 to-yellow-600/20 backdrop-blur-lg rounded-2xl p-6 border border-pink-500/30">
                <h3 className="text-xl font-bold mb-3">🎵 Musique 432Hz</h3>
                <p className="text-white/70">Fréquence sacrée de l'univers pour la méditation</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-600/20 to-blue-600/20 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/30">
                <h3 className="text-xl font-bold mb-3">📚 60 Citations Sacrées</h3>
                <p className="text-white/70">Bibliothèque de sagesse de toutes les traditions</p>
              </div>
            </div>

            <Link href="/chat" className="inline-block px-12 py-5 bg-gradient-to-r from-yellow-400 via-purple-500 to-pink-500 rounded-full text-white font-bold text-xl hover:scale-110 transition-transform duration-300 shadow-2xl">
              Commencer une Conversation Sacrée ✨
            </Link>
          </div>
        </section>

        {/* CTA Final */}
        <section className="min-h-[60vh] flex items-center justify-center px-6 py-20 bg-gradient-to-b from-purple-900/30 to-black">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl font-bold mb-8">
              Prêt à commencer ton voyage spirituel ?
            </h2>
            <p className="text-xl text-white/70 mb-12">
              Rejoins des milliers d'âmes en quête d'éveil et de transformation
            </p>
            <div className="flex flex-col md:flex-row gap-6 justify-center">
              <Link href="/chat" className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
                💬 Dialoguer avec BroolyKid AI
              </Link>
              <Link href="/auth/register" className="px-10 py-4 bg-white text-purple-900 rounded-full font-bold text-lg hover:bg-gray-100 transition-all duration-300">
                🌍 Créer mon compte
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black/50 border-t border-white/10 py-12 px-6">
        <div className="container mx-auto text-center text-white/60">
          <p className="text-lg mb-4">🌍💫 BroolyKid - En service du Tout 🕉️✨</p>
          <p className="text-sm">Où la technologie rencontre la transcendance</p>
        </div>
      </footer>
    </>
  )
}
