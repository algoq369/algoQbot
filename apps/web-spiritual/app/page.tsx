import React from 'react';

export default function BroolyKidWebsite() {
  return (
    <div className="min-h-screen bg-white text-black">
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-xl font-semibold">BROOLYKID</div>
          <div className="flex gap-8 text-sm">
            <a href="#about" className="hover:opacity-50 transition">About</a>
            <a href="#vision" className="hover:opacity-50 transition">Vision 2035</a>
            <a href="#cities" className="hover:opacity-50 transition">10 Cities</a>
            <a href="#roadmap" className="hover:opacity-50 transition">Roadmap</a>
          </div>
          <button className="px-6 py-2 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition">
            Join Discord
          </button>
        </div>
      </nav>

      <section className="pt-40 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-8">
            <p className="text-sm text-gray-500 mb-2">"DREAM BIG THE UNIVERSE WILL FUND IT" - AlgoQ</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider">SPIRITUAL AWAKENING AS ANTIDOTE TO TRANSHUMANISM</p>
          </div>
          <h1 className="text-7xl md:text-8xl font-bold mb-6">BROOLYKID</h1>
          <p className="text-3xl mb-4">The Future of Sovereign Cities</p>
          <p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">A sovereign community reimagining technology in service of life, peace, and collective harmony</p>
          <div className="flex gap-4 justify-center mb-20">
            <button className="px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition">Discover the Project</button>
            <button className="px-8 py-3 border-2 border-black rounded-full hover:bg-black hover:text-white transition">White Paper</button>
          </div>
          <div className="grid grid-cols-4 gap-8">
            <div><div className="text-5xl font-bold mb-2">10</div><div className="text-sm">SMART CITIES</div><div className="text-xs text-gray-500 mt-1">by 2035</div></div>
            <div><div className="text-5xl font-bold mb-2">200K</div><div className="text-sm">ASICs</div><div className="text-xs text-gray-500 mt-1">Bitcoin Mining</div></div>
            <div><div className="text-5xl font-bold mb-2">100K</div><div className="text-sm">RESIDENTS</div><div className="text-xs text-gray-500 mt-1">Community</div></div>
            <div><div className="text-5xl font-bold mb-2">$56B</div><div className="text-sm">TREASURY</div><div className="text-xs text-gray-500 mt-1">DAO</div></div>
          </div>
        </div>
      </section>

      <section id="vision" className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-center mb-16">Our Vision</h2>
          <div className="space-y-12">
            <div><h3 className="text-2xl font-bold mb-4">🌟 A New Paradigm of Consciousness</h3><p className="text-lg leading-relaxed text-gray-700">We are building a community of sovereign individuals who are conscious—conscious that we are transitioning into a new era, the Era of Information and Data. Conscious of the transformative potential of blockchain and AI technology. Conscious that spirituality and astral alignment reveal divine guidance and purpose.</p></div>
            <div><h3 className="text-2xl font-bold mb-4">🚀 Elevation of Consciousness</h3><p className="text-lg leading-relaxed text-gray-700">For those willing to do the extra work, we propose an elevation of consciousness—an alternative to the traditional systems that have governed human interaction for the past 120 years. Capitalizing on this emerging era, we gather conscious minds into a society based on a circular economy, leveraging the power of ideas.</p></div>
            <div><h3 className="text-2xl font-bold mb-4">💫 Body, Mind & Heart Coherence</h3><p className="text-lg leading-relaxed text-gray-700">Our vision is to build a community where body and mind are aligned, where we achieve proper brain and heart coherence. Through this alignment, we facilitate and enhance talent development. Our children will become the most optimized form of human potential since genesis.</p></div>
            <div><h3 className="text-2xl font-bold mb-4">🎓 Education as Foundation</h3><p className="text-lg leading-relaxed text-gray-700">We plant seeds of inception into our children from birth and before, enabling maximum potential development. In the ongoing era of information, value creation comes from great ideas. Our community is highly focused on education—the Academy is central to our cities, forming the talent of tomorrow.</p></div>
            <div><h3 className="text-2xl font-bold mb-4">₿ Self-Sovereign & Self-Sufficient</h3><p className="text-lg leading-relaxed text-gray-700">What differentiates us from other smart city projects is our elevation to a sovereign, self-financed city through Bitcoin mining. We assure generational wealth and guarantee sustainable life for generations to come. Integration of AI and blockchain technology is vital to our infrastructure.</p></div>
            <div><h3 className="text-2xl font-bold mb-4">🔄 Circular Economy Model</h3><p className="text-lg leading-relaxed text-gray-700">When we clear our initial debt, we achieve a full circular economy. Citizens participate in debt repayment earning reputation points that grant access to free services. High-reputation, high-net-worth individuals live alongside those building their reputation, lifting each other up. Nomadism is incentivized—we believe in non-attachment. Citizens can travel to other cities, earning reputation points. We maintain 20% habitation vacancy to enable fluid movement.</p></div>
            <div><h3 className="text-2xl font-bold mb-4">⛪ Solomon's Temple: Spiritual Pillar & Strategic Reserve</h3><p className="text-lg leading-relaxed text-gray-700">Our city architecture places the Solomon Temple at the center—serving as both our spiritual pillar and strategic reserve. Mining operations are positioned at the city's edge, utilizing hydroelectric and heat reconversion technology to heat our cities and power our agricultural production. We optimize every resource.</p></div>
            <div className="text-center pt-8 border-t border-gray-300"><p className="text-xl font-bold italic">"We are not just building a city—we are introducing human beings to a new way of living life."</p></div>
          </div>
        </div>
      </section>

      <section id="about" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-bold text-center mb-4">What is BroolyKid?</h2>
          <p className="text-center text-gray-600 mb-16">A new model of civilization based on sovereignty, autonomy and harmony</p>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center"><div className="text-6xl mb-6">🏛️</div><h3 className="text-xl font-bold mb-4">Network State</h3><p className="text-gray-600 leading-relaxed">10 autonomous sovereign cities connected by blockchain, governed by DAO, funded by Bitcoin mining.</p></div>
            <div className="text-center"><div className="text-6xl mb-6">⚡</div><h3 className="text-xl font-bold mb-4">Sovereign Mining</h3><p className="text-gray-600 leading-relaxed">200,000 ASICs by 2037. 100% renewable energy. $56B Treasury to fund the ecosystem.</p></div>
            <div className="text-center"><div className="text-6xl mb-6">🎓</div><h3 className="text-xl font-bold mb-4">Academy</h3><p className="text-gray-600 leading-relaxed">Planting the seeds of sovereignty: campuses where inner alchemy, blockchain mastery and ancestral wisdom cultivate young souls</p></div>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-600">
          <p className="mb-4">© 2025 BroolyKid • Building the Future of Sovereign Cities</p>
          <div className="flex gap-8 justify-center">
            <a href="#" className="hover:text-black transition">Twitter</a>
            <a href="#" className="hover:text-black transition">Discord</a>
            <a href="#" className="hover:text-black transition">Telegram</a>
            <a href="#" className="hover:text-black transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}






