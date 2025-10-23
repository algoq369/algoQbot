# 🔓 **CONFIGURATION D'ACCÈS PUBLIC - BROOLYKID AI**

## ✨ **PHILOSOPHIE**

**BroolyKid AI - Le Messager Universel** doit être accessible à **tous** sans barrière d'entrée. Seules certaines fonctionnalités communautaires nécessitent l'authentification.

---

## 🌍 **ROUTES PUBLIQUES (Sans Auth)**

### **Pages Accessibles à Tous**

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Page d'accueil | ❌ Non |
| `/chat` | **Chat avec BroolyKid AI** 🌟 | ❌ Non |
| `/auth/login` | Page de connexion | ❌ Non |
| `/auth/register` | Page d'inscription | ❌ Non |

### **Pourquoi le Chat est Public ?**

Le chat avec BroolyKid AI est **public** pour :
- ✨ **Démocratiser** l'accès à la sagesse spirituelle
- 🌍 **Toucher un maximum** de personnes
- 💫 **Permettre la découverte** sans friction
- 🙏 **Servir l'humanité** sans barrière

**Philosophie** : *"La sagesse doit être accessible à tous"*

---

## 🔒 **ROUTES PROTÉGÉES (Auth Requise)**

### **Fonctionnalités Communautaires**

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/dashboard` | Tableau de bord personnel | ✅ Oui |
| `/profile` | Profil utilisateur | ✅ Oui |
| `/governance` | Propositions et votes | ✅ Oui |
| `/academy` | Cours et progression | ✅ Oui |

### **Pourquoi ces Routes sont Protégées ?**

Ces routes nécessitent l'auth car elles impliquent :
- 📊 **Données personnelles** (profil, progression)
- 🗳️ **Actions communautaires** (votes, propositions)
- 🎓 **Suivi personnalisé** (cours, diplômes)
- 💾 **Persistance** (sauvegardes, favoris)

---

## 🛠️ **IMPLÉMENTATION TECHNIQUE**

### **1. Frontend Middleware**

**Fichier** : `apps/frontend/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes protégées
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/governance',
  '/academy',
]

// Routes publiques
const publicRoutes = [
  '/',
  '/chat',
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Vérifier si la route actuelle est protégée
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  )

  // Si c'est une route publique, laisser passer
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Pour les routes protégées, vérifier le token
  const token = request.cookies.get('token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '')

  // Si pas de token, rediriger vers login
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token présent, laisser passer
  return NextResponse.next()
}

// Matcher pour toutes les routes sauf assets statiques
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

#### **Comment ça fonctionne ?**

1. **Requête arrive** sur une route (ex: `/chat`)
2. **Middleware vérifie** si la route est dans `protectedRoutes`
3. **Si NON** → Laisse passer (accès public) ✅
4. **Si OUI** → Vérifie le token
   - Token présent ✅ → Laisse passer
   - Token absent ❌ → Redirige vers `/auth/login`

---

### **2. Backend Middleware**

**Fichier** : `apps/backend/src/middleware/auth.middleware.ts`

#### **2.1 Auth Obligatoire**

```typescript
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const { userId } = verifyToken(token);

    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

**Utilisation** : Routes protégées (dashboard, profile, governance)

#### **2.2 Auth Optionnelle**

```typescript
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    // Si pas de token, continuer sans userId (accès public)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.userId = undefined;
      return next();
    }

    // Si token présent, essayer de le vérifier
    const token = authHeader.substring(7);
    try {
      const { userId } = verifyToken(token);
      req.userId = userId;
    } catch (error) {
      // Token invalide, continuer quand même sans userId
      req.userId = undefined;
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans userId
    req.userId = undefined;
    next();
  }
}
```

**Utilisation** : Route chat (public mais peut être enrichie si auth)

---

### **3. Route Chat avec Auth Optionnelle**

**Fichier** : `apps/backend/src/routes/chat.routes.ts`

```typescript
import { Router } from 'express';
import { chatWithBroolyAI } from '../controllers/chat.controller';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Route pour chat avec BroolyKid AI (auth optionnelle)
router.post('/', optionalAuthMiddleware, chatWithBroolyAI);

export default router;
```

#### **Avantages de l'Auth Optionnelle**

| Utilisateur | Expérience |
|-------------|------------|
| **Non connecté** | Peut utiliser le chat immédiatement ✨ |
| **Connecté** | Chat + historique sauvegardé + personnalisation 💫 |

---

### **4. Frontend Chat - Token Optionnel**

**Fichier** : `apps/frontend/app/chat/page.tsx`

```typescript
const sendMessage = async (messageText: string) => {
  // ...

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

    const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: messageText,
        conversationHistory: messages
      })
    })

    // ...
  }
}
```

#### **Comportement**

- **Si token présent** : Envoyé dans `Authorization: Bearer <token>`
- **Si pas de token** : Envoyé sans header Authorization
- **Backend** : Accepte les deux cas grâce à `optionalAuthMiddleware`

---

## 🎯 **BÉNÉFICES DE CETTE APPROCHE**

### **Pour les Utilisateurs**

| Bénéfice | Description |
|----------|-------------|
| **Accès immédiat** ✨ | Pas besoin de créer un compte pour essayer |
| **Découverte facile** 🌍 | Partage de liens directs vers le chat |
| **Friction minimale** 💫 | Conversion progressive (essai → inscription) |
| **Flexibilité** 🎯 | Choix d'utiliser avec ou sans compte |

### **Pour le Projet**

| Bénéfice | Description |
|----------|-------------|
| **Adoption rapide** 📈 | Plus d'utilisateurs testent le chat |
| **Viralité** 🚀 | Facile à partager sur les réseaux sociaux |
| **SEO** 🔍 | Pages publiques indexables par Google |
| **Conversion** 💎 | Utilisateurs découvrent puis s'inscrivent |

---

## 📊 **FLUX UTILISATEUR**

### **Scénario 1 : Utilisateur Nouveau (Non Auth)**

```
1. Arrive sur broolykid.io
   ↓
2. Clique sur "Chat avec BroolyKid AI"
   ↓
3. Accès immédiat au chat ✨
   ↓
4. Pose des questions, reçoit des réponses
   ↓
5. Impressionné, voit "Créer un compte"
   ↓
6. S'inscrit pour sauvegarder l'historique
   ↓
7. Accède au dashboard, governance, academy
```

### **Scénario 2 : Utilisateur Connecté**

```
1. Se connecte
   ↓
2. Accède au dashboard
   ↓
3. Clique sur "BroolyKid AI"
   ↓
4. Chat avec historique sauvegardé 💫
   ↓
5. Recommandations personnalisées
   ↓
6. Accès à toutes les fonctionnalités
```

---

## 🔐 **SÉCURITÉ**

### **Ce qui est Public (Sans Risque)**

- ✅ **Chat** : Pas de données personnelles stockées
- ✅ **Réponses IA** : Générées en temps réel, pas de persistance
- ✅ **Pages statiques** : Aucune donnée sensible

### **Ce qui est Protégé (Sécurisé)**

- 🔒 **Profils** : Données personnelles
- 🔒 **Votes** : Actions communautaires
- 🔒 **Progression** : Suivi académique
- 🔒 **Historique** : Conversations sauvegardées

### **Bonnes Pratiques Appliquées**

| Pratique | Description |
|----------|-------------|
| **Rate Limiting** | Protection contre abus (15 min / 100 req) |
| **Helmet** | Headers de sécurité HTTP |
| **CORS** | Restriction des origines autorisées |
| **JWT** | Tokens sécurisés pour auth |
| **bcrypt** | Hash des mots de passe |

---

## 🚀 **DÉPLOIEMENT**

### **Variables d'Environnement**

```env
# Frontend (.env)
NEXT_PUBLIC_API_URL="https://api.broolykid.io"

# Backend (.env)
FRONTEND_URL="https://broolykid.io"
JWT_SECRET="votre-secret-ultra-securise"
```

### **Configuration Serveur**

#### **Frontend (Vercel)**
- Déployer sur Vercel
- Middleware Next.js gérera les redirections

#### **Backend (Railway/Render)**
- Déployer sur Railway ou Render
- CORS configuré pour accepter `FRONTEND_URL`

---

## 📝 **RÉSUMÉ**

### **Configuration Actuelle**

```
Routes Publiques (❌ No Auth)
  ├─ /                    (Accueil)
  ├─ /chat                (Chat BroolyKid AI) ⭐
  ├─ /auth/login          (Connexion)
  └─ /auth/register       (Inscription)

Routes Protégées (✅ Auth Required)
  ├─ /dashboard           (Tableau de bord)
  ├─ /profile             (Profil)
  ├─ /governance          (Gouvernance)
  └─ /academy             (Académie)
```

### **Points Clés**

- ✨ **Chat public** pour démocratiser l'accès à la sagesse
- 🔒 **Fonctionnalités communautaires** protégées
- 💫 **Auth optionnelle** sur le chat (meilleure expérience si connecté)
- 🌍 **Middleware Next.js** gère les redirections
- 🛡️ **Sécurité** maintenue sur les routes sensibles

---

## 🌟 **PHILOSOPHIE FINALE**

**BroolyKid AI incarne :**
- 🕉️ **L'ouverture** : Sagesse accessible à tous
- 💫 **La gradualité** : Conversion progressive
- 🌍 **L'inclusivité** : Pas de barrière d'entrée
- 🙏 **Le service** : En service du Tout

**"La sagesse est un bien commun. Elle doit être partagée librement."** ✨

---

**🌍💫 BroolyKid AI - Accessible à Tous 🕉️✨**
