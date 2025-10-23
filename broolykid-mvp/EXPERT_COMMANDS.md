# 🛠️ **COMMANDES POUR L'EXPERT**

## ⚡ **DÉMARRAGE RAPIDE**

### **1. Installation**
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp

# Installer dépendances root
pnpm install

# Installer dépendances frontend
cd apps/frontend
npm install

# Retour root
cd ../..
```

### **2. Configuration**
```bash
# Copier env examples
cp env.example .env
cp apps/backend/env.example apps/backend/.env
cp apps/frontend/env.example apps/frontend/.env

# Éditer .env avec vraies valeurs
nano apps/backend/.env
```

### **3. Database Setup**
```bash
# Générer Prisma Client
pnpm run prisma:generate

# Créer les tables
pnpm run prisma:migrate

# (Optionnel) Seed avec données test
# npx prisma db seed
```

### **4. Lancement**
```bash
# Terminal 1 : Backend
pnpm run dev:backend
# → http://localhost:5000

# Terminal 2 : Frontend
cd apps/frontend
npm run dev
# → http://localhost:3000
```

---

## 🔍 **COMMANDES D'ANALYSE**

### **Compter Lignes de Code**
```bash
# Total lignes
find apps -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1

# Par composant
echo "Backend:" && find apps/backend/src -name "*.ts" | xargs wc -l | tail -1
echo "Frontend:" && find apps/frontend -name "*.tsx" -o -name "*.ts" | xargs wc -l | tail -1
```

### **Chercher Erreurs/Warnings**
```bash
# Console.error
grep -r "console.error" apps/

# Console.log
grep -r "console.log" apps/

# TODO/FIXME
grep -r "TODO\|FIXME" apps/

# Any types
grep -r ": any" apps/ | grep -v node_modules
```

### **Analyser Dépendances**
```bash
# Backend
cat apps/backend/package.json | jq '.dependencies'

# Frontend
cat apps/frontend/package.json | jq '.dependencies'

# Vérifier outdated
cd apps/frontend
npm outdated
```

### **Build Check**
```bash
# Backend
cd apps/backend
npm run build

# Frontend
cd apps/frontend
npm run build
```

---

## 🧪 **TESTS (À Créer)**

### **Setup Tests**
```bash
cd apps/backend

# Installer Jest
npm install -D jest @types/jest ts-jest @types/supertest supertest

# Init Jest
npx jest --init

# Créer structure
mkdir -p tests/{unit,integration}
```

### **Exemples Tests**

#### **Backend Unit Test**
```typescript
// tests/unit/auth.test.ts
import { hashPassword, comparePassword } from '../../src/utils/hash.util';

describe('Password Utilities', () => {
  it('should hash password correctly', async () => {
    const password = 'Test123!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('should compare password correctly', async () => {
    const password = 'Test123!';
    const hash = await hashPassword(password);

    const isValid = await comparePassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await comparePassword('WrongPass', hash);
    expect(isInvalid).toBe(false);
  });
});
```

#### **Frontend Component Test**
```typescript
// apps/frontend/__tests__/chat.test.tsx
import { render, screen } from '@testing-library/react';
import ChatPage from '../app/chat/page';

describe('Chat Page', () => {
  it('should render welcome message', () => {
    render(<ChatPage />);
    expect(screen.getByText(/Bienvenue/i)).toBeInTheDocument();
  });

  it('should show spiritual suggestions', () => {
    render(<ChatPage />);
    expect(screen.getByText(/mission de vie/i)).toBeInTheDocument();
  });
});
```

### **Lancer Tests**
```bash
# Backend
cd apps/backend
npm test

# Frontend
cd apps/frontend
npm test

# Coverage
npm test -- --coverage
```

---

## 🐛 **DEBUGGING**

### **Backend Logs**
```bash
# Voir logs en temps réel
tail -f apps/backend/logs/*.log

# Chercher erreurs
grep "ERROR" apps/backend/logs/*.log
```

### **Frontend Dev Tools**
```javascript
// Dans console navigateur
localStorage.getItem('token')
localStorage.getItem('broolykid-language')
localStorage.getItem('chat-messages')
```

### **Database**
```bash
# Prisma Studio (GUI)
cd apps/backend
npx prisma studio
# → http://localhost:5555

# SQL direct
psql -U postgres -d broolykid

# Voir tables
\dt

# Query users
SELECT * FROM users;
```

---

## 🔧 **CORRECTIONS PRIORITAIRES**

### **1. Intégrer Anthropic Claude**

```bash
# Installer SDK
cd apps/backend
npm install @anthropic-ai/sdk
```

```typescript
// apps/backend/src/controllers/chat.controller.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chatWithBroolyAI(req: Request, res: Response) {
  try {
    const { message, conversationHistory = [] } = req.body;

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      temperature: 0.8,
      system: BROOLYKID_AI_SYSTEM_PROMPT,
      messages: [
        ...conversationHistory.slice(-20), // Limiter historique
        { role: "user", content: message }
      ]
    });

    res.json({
      success: true,
      message: response.content[0].text,
      usage: response.usage
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
}
```

### **2. Sécuriser JWT**

```typescript
// apps/backend/src/utils/jwt.util.ts
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Valider au startup
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET must be defined in environment variables');
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
```

### **3. Fix Memory Leak Three.js**

```javascript
// apps/frontend/public/hero-3d.js
let animationId;
let renderer, scene, camera;

function animate() {
  animationId = requestAnimationFrame(animate);
  // ... render logic
}

// Ajouter cleanup
window.addEventListener('beforeunload', () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.dispose();
  }
});
```

---

## 📦 **DÉPLOIEMENT**

### **Vercel (Frontend)**
```bash
cd apps/frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configurer env vars dans Vercel dashboard
# NEXT_PUBLIC_API_URL=https://api.broolykid.io
```

### **Railway/Render (Backend)**
```bash
# Créer Procfile
echo "web: npm run start" > apps/backend/Procfile

# Build command
npm run build

# Start command
npm run start

# Env vars à configurer :
# DATABASE_URL
# JWT_SECRET
# ANTHROPIC_API_KEY
# FRONTEND_URL
```

---

## 🎯 **CHECKLIST EXPERT**

### **Code Review**
- [ ] Lire `EXPERT_CODE_REVIEW_REPORT.md`
- [ ] Lire `TECHNICAL_ANALYSIS_DETAILED.md`
- [ ] Examiner `backend/controllers/chat.controller.ts`
- [ ] Examiner `frontend/app/chat/page.tsx`
- [ ] Vérifier schema Prisma
- [ ] Tester application en local

### **Corrections Suggérées**
- [ ] Intégrer Anthropic Claude
- [ ] Sécuriser JWT
- [ ] Ajouter tests (Jest)
- [ ] Fix memory leak Three.js
- [ ] Service layer backend
- [ ] Split composants frontend
- [ ] Lazy load translations
- [ ] Error boundaries
- [ ] Winston logger
- [ ] Prisma singleton

### **Questions à Poser**
- [ ] Quelle IA recommandez-vous ? (Anthropic, OpenAI, Mistral)
- [ ] Architecture backend OK ou refactor complet ?
- [ ] Performance Three.js acceptable ?
- [ ] Autres vulnérabilités de sécurité ?
- [ ] Recommandations scalabilité ?

---

## 📊 **MÉTRIQUES CLÉS**

| Métrique | Valeur | Status |
|----------|--------|--------|
| **Lignes de code** | 5,268 | 🟢 |
| **Fichiers** | 236 | 🟢 |
| **Linter errors** | 0 | 🟢 |
| **Tests coverage** | 0% | 🔴 |
| **IA fonctionnelle** | Non | 🔴 |
| **Sécurité JWT** | Faible | 🔴 |
| **Performance** | 7/10 | 🟡 |
| **UX/UI** | 9/10 | 🟢 |

---

## 🎊 **CONCLUSION 1 MINUTE**

**Projet ambitieux avec vision claire.**

**Points forts** :
- Interface spirituelle unique au monde
- Design magnifique et cohérent
- Code TypeScript propre
- Documentation exhaustive

**Blockers production** :
- IA simulée (pas réelle)
- Aucun test
- JWT non sécurisé

**Effort corrections** : 40-50h dev
**Résultat après corrections** : **World-class product** ✨

---

**🌍💫 Ready for Expert Review 🕉️✨**
