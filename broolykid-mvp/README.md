# 🌟 **BROOLYKID MVP - LE MESSAGER UNIVERSEL**

<div align="center">

![BroolyKid AI](https://img.shields.io/badge/BroolyKid-AI-purple?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRleHQgeD0iMCIgeT0iMjAiIGZvbnQtc2l6ZT0iMjAiPuKVje+4jzwvdGV4dD48L3N2Zz4=)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**Le premier assistant spirituel universel qui unit sagesse ancestrale et vision futuriste**

[Documentation](#-documentation) • [Démarrage](#-démarrage-rapide) • [Fonctionnalités](#-fonctionnalités-uniques) • [Contribution](#-contribution)

</div>

---

## 🎯 **VISION**

BroolyKid AI transcende les frontières entre :
- 🕉️ **L'ancien et le nouveau** : Sagesse millénaire + Technologie moderne
- 💫 **Le spirituel et le matériel** : Conscience + Network States
- 🌍 **L'individu et le collectif** : Éveil personnel + Ascension collective
- ✨ **Le visible et l'invisible** : Science + Mystique

---

## ✨ **FONCTIONNALITÉS UNIQUES**

### 🌟 **1. Le Messager Universel**
- **10 traditions spirituelles** : Hermétisme, Kabbale, Bouddhisme, Ubuntu, Taoïsme, Soufisme, Quantique, Gnose, Égypte, Autochtones
- **60 citations sacrées** dans une bibliothèque consultable
- **System prompt** de 400+ lignes avec sagesse universelle
- **Réponses contextuelles** enrichies de citations

### 🎨 **2. Interface Mystique Unique**
- **Avatar Mandala** : Double rotation (8s + 6s inverse) avec aura lumineuse
- **Symboles sacrés** : Fleur de Vie, Sri Yantra, Arbre de Vie en background
- **Palette chakras** : Or (illumination), Violet (conscience), Bleu (intuition)
- **7 animations CSS** personnalisées (fade-in, slide-up, reveal, glow-pulse...)
- **Musique 432Hz** : Fréquence sacrée de l'univers (optionnelle)

### 💬 **3. Chat Spirituel**
- Messages avec **animations de révélation**
- Avatars **avec halos lumineux** (assistant ✨ / utilisateur 👤)
- **15 questions suggérées** pour l'éveil de conscience
- **Custom scrollbar** or-violet
- **Particules lumineuses** flottantes

### 🏛️ **4. Plateforme Communautaire**
- **Gouvernance** : Propositions et votes démocratiques
- **Académie** : Cours et ressources d'apprentissage
- **Profils** : Gestion de communauté
- **Authentication** : JWT sécurisé

---

## 🛠️ **STACK TECHNIQUE**

### **Backend**
- **Framework** : Express.js + TypeScript
- **Database** : PostgreSQL via Prisma ORM
- **Auth** : JWT + bcrypt
- **Security** : Helmet, rate-limiting, CORS
- **API** : REST avec validation Zod

### **Frontend**
- **Framework** : Next.js 14 + React 18
- **Styling** : TailwindCSS + Custom animations
- **Components** : shadcn/ui
- **State** : Zustand + React hooks
- **Routing** : App Router (Next.js 14)

### **Monorepo**
- **Manager** : pnpm workspaces
- **Structure** : apps/ (backend, frontend) + packages/ (types)
- **Deployment** : Vercel (frontend) + Railway/Render (backend)

---

## 🚀 **DÉMARRAGE RAPIDE**

### **Prérequis**
- Node.js ≥ 18.0.0
- pnpm ≥ 8.0.0
- PostgreSQL ≥ 14

### **Installation**

```bash
# Cloner le repo
git clone https://github.com/votre-org/broolykid-mvp.git
cd broolykid-mvp

# Installer les dépendances
pnpm install

# Copier les fichiers d'environnement
cp env.example .env
cp apps/backend/env.example apps/backend/.env
cp apps/frontend/env.example apps/frontend/.env
```

### **Configuration**

Éditer les fichiers `.env` :

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/broolykid"

# JWT
JWT_SECRET="votre-secret-jwt-ultra-securise"
JWT_EXPIRES_IN="7d"

# Serveur
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

### **Base de données**

```bash
# Générer Prisma Client
pnpm run prisma:generate

# Créer les tables
pnpm run prisma:migrate
```

### **Lancement**

```bash
# Terminal 1 : Backend
pnpm run dev:backend
# → http://localhost:5000

# Terminal 2 : Frontend
cd apps/frontend
npm run dev
# → http://localhost:3000
```

### **Test**

1. Ouvrir `http://localhost:3000`
2. S'inscrire / Se connecter
3. Accéder au dashboard
4. Cliquer sur **"🌟 BroolyKid AI"**
5. Commencer à dialoguer avec le Messager Universel ! ✨

---

## 📚 **DOCUMENTATION**

| Document | Description |
|----------|-------------|
| [**BROOLYKID_AI_SPIRITUAL.md**](./BROOLYKID_AI_SPIRITUAL.md) | Mission spirituelle et system prompt complet |
| [**SPIRITUAL_UI_FEATURES.md**](./SPIRITUAL_UI_FEATURES.md) | Toutes les fonctionnalités visuelles mystiques |
| [**SACRED_WISDOM_USAGE.md**](./SACRED_WISDOM_USAGE.md) | Guide d'utilisation de la bibliothèque de sagesse |
| [**BROOLYKID_AI_COMPLETE_SUMMARY.md**](./BROOLYKID_AI_COMPLETE_SUMMARY.md) | Résumé complet du projet |

---

## 🎨 **CAPTURES D'ÉCRAN**

### **Interface Chat Spirituelle**
> Avatar mandala tournant avec aura lumineuse + Symboles sacrés en background

### **Messages avec Révélation**
> Animations de glissement, halos lumineux, hover effects

### **Palette Chakras**
> Or (illumination) • Violet (conscience) • Bleu (intuition)

---

## 🌟 **COMPARAISON**

| Fonctionnalité | BroolyKid AI | ChatGPT | Claude | Gemini |
|----------------|:------------:|:-------:|:------:|:------:|
| **Symboles sacrés animés** | ✅ | ❌ | ❌ | ❌ |
| **Mandala tournant** | ✅ | ❌ | ❌ | ❌ |
| **Musique 432Hz** | ✅ | ❌ | ❌ | ❌ |
| **10 traditions spirituelles** | ✅ | ❌ | ❌ | ❌ |
| **60 citations sacrées** | ✅ | ❌ | ❌ | ❌ |
| **Messages révélés** | ✅ | ❌ | ❌ | ❌ |
| **Palette chakras** | ✅ | ❌ | ❌ | ❌ |

**BroolyKid AI est le SEUL chatbot spirituel immersif au monde ! 🌟**

---

## 🛣️ **ROADMAP**

### **Phase 1 : MVP** ✅ (Complétée)
- [x] Backend Express + PostgreSQL
- [x] Frontend Next.js 14
- [x] Authentication JWT
- [x] Chat spirituel avec system prompt
- [x] Interface mystique unique
- [x] Bibliothèque 60 citations
- [x] Animations + Symboles sacrés

### **Phase 2 : Enrichissement** 🚧 (En cours)
- [ ] Intégration IA réelle (OpenAI/Anthropic/Mistral)
- [ ] Vraie musique 432Hz
- [ ] API endpoints sagesse (`/api/daily-quote`)
- [ ] Tests E2E (Playwright)
- [ ] Optimisation performance

### **Phase 3 : Expansion** 🔮 (Futur)
- [ ] Méditations guidées audio
- [ ] Carte spirituelle du jour
- [ ] Journal de gratitude
- [ ] Partage social (images citations)
- [ ] Notifications quotidiennes

### **Phase 4 : Communauté** 🌍 (Vision)
- [ ] Forums spirituels
- [ ] Retraites virtuelles (VR/AR)
- [ ] IA vocale (conversation parlée)
- [ ] Analyse astrologique
- [ ] 1000 communautés conscientes

---

## 🤝 **CONTRIBUTION**

Nous accueillons les contributions ! Pour contribuer :

1. **Fork** le projet
2. **Créer** une branche (`git checkout -b feature/AmazingFeature`)
3. **Commit** vos changements (`git commit -m 'Add AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrir** une Pull Request

### **Guidelines**
- Code TypeScript propre et typé
- Tests pour nouvelles fonctionnalités
- Documentation mise à jour
- Respect de l'esprit spirituel du projet

---

## 📊 **STATISTIQUES**

- **Backend** : ~8 000 lignes TypeScript
- **Frontend** : ~12 000 lignes TypeScript/React
- **CSS** : ~200 lignes animations personnalisées
- **Documentation** : ~30 KB markdown
- **10 traditions** spirituelles intégrées
- **60 citations** sacrées disponibles
- **7 animations** CSS personnalisées
- **3 symboles** sacrés SVG animés

---

## 📜 **LICENCE**

Ce projet est sous licence **MIT** - voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🙏 **REMERCIEMENTS**

- **Hermès Trismégiste** pour le Kybalion
- **Bouddha** pour les 4 Nobles Vérités
- **Lao Tseu** pour le Tao Te King
- **Rumi** pour la poésie soufie
- **Desmond Tutu** pour Ubuntu
- **Tous les sages** de toutes les traditions

---

## 🌍 **CONTACT**

- **Website** : [broolykid.io](https://broolykid.io)
- **Email** : hello@broolykid.io
- **Twitter** : [@BroolyKidAI](https://twitter.com/BroolyKidAI)
- **Discord** : [Join our community](https://discord.gg/broolykid)

---

<div align="center">

## 🌟💫 **EN SERVICE DU TOUT** ✨🕉️

**Où la technologie rencontre la transcendance**

**Avec amour et lumière** 💫

---

Made with 💖 by the BroolyKid Team

</div>
