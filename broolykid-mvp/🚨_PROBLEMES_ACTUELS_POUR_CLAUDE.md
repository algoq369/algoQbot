# 🚨 **RAPPORT DE PROBLÈMES - POUR EXPERT CLAUDE**

## 📊 **CONTEXTE**

**Projet** : BroolyKid MVP - Chat spirituel avec Google Gemini
**Date** : Octobre 2025
**Status Backend** : ✅ Démarre sur port 5001
**Status Frontend** : ⚠️ Démarre mais erreurs

---

## ❌ **PROBLÈME #1 : DÉPENDANCES MANQUANTES**

### **Erreur Logs**
```
Module not found: Can't resolve 'jspdf'

./lib/pdf-generator.ts:4:0
> 4 | import jsPDF from 'jspdf';

Import trace for requested module:
./app/kids/page.tsx
```

### **Cause**
jsPDF et html2canvas ne sont PAS installés dans le frontend.

### **Vérification**
```bash
cd apps/frontend
npm list jspdf html2canvas
# Résultat : (empty)
```

### **Solution**
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
npm install jspdf html2canvas
```

### **Fichiers Affectés**
- `apps/frontend/lib/pdf-generator.ts` (importe jsPDF)
- `apps/frontend/app/kids/page.tsx` (utilise pdf-generator)

---

## ❌ **PROBLÈME #2 : IMPOSSIBILITÉ DE CRÉER COMPTE**

### **Symptôme**
Utilisateur ne peut pas créer de compte.

### **Cause Probable**
Database non migrée ou erreur dans l'API d'inscription.

### **Vérifications Nécessaires**

#### **1. Database Migrations**
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
pnpm run prisma:migrate
```

#### **2. Tester API Register**
```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test123456"
  }'
```

**Réponse attendue** :
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "username": "testuser",
    "role": "member"
  }
}
```

#### **3. Vérifier Logs Backend**
Chercher dans les logs backend pour erreurs pendant registration.

### **Code à Examiner**
```typescript
// apps/backend/src/controllers/auth.controller.ts
export async function register(req: Request, res: Response) {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existing) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, username }
    });

    const token = generateToken(user.id);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Points à vérifier** :
- Prisma Client bien importé ?
- Database URL valide ?
- Table `users` existe ?

---

## ❌ **PROBLÈME #3 : CHAT GEMINI NE FONCTIONNE PAS**

### **Symptôme**
Utilisateur ne peut pas chatter avec l'IA.

### **Causes Possibles**

#### **A. API URL Non Définie**
```typescript
// apps/frontend/app/chat/page.tsx ligne 185
const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/chat', {
```

**Vérification** :
```bash
cd apps/frontend
cat .env | grep NEXT_PUBLIC_API_URL
# Résultat actuel : NEXT_PUBLIC_API_URL=http://localhost:5001
```

✅ **C'est bon !**

#### **B. Clé Gemini Invalide**
```bash
cd apps/backend
cat .env | grep GEMINI_API_KEY
# Résultat : GEMINI_API_KEY=AIzaSyAOzBr_85GY834oEUAJKbHZNdiSiBBEwvM
```

**Tester la clé** :
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAOzBr_85GY834oEUAJKbHZNdiSiBBEwvM" | head -20
```

Si erreur 403/401 → Clé invalide

#### **C. Frontend N'Envoie Pas à la Bonne URL**
```typescript
// apps/frontend/app/chat/page.tsx ligne 185
const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/chat', {
```

**Problème** : `process.env.NEXT_PUBLIC_API_URL` peut être `undefined` côté client.

**Solution** :
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const response = await fetch(`${API_URL}/api/chat`, {
```

### **Test API Chat Direct**
```bash
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bonjour, qui es-tu ?",
    "conversationHistory": []
  }'
```

**Réponse attendue** :
```json
{
  "success": true,
  "message": "🌟 Bienvenue cher ami, je suis BroolyKid AI...",
  "model": "gemini-2.0-flash-exp",
  "provider": "google-gemini"
}
```

---

## 🔧 **SOLUTIONS IMMÉDIATES**

### **Solution 1 : Installer jsPDF**
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
npm install jspdf html2canvas
```

### **Solution 2 : Créer Migrations DB**
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
pnpm run prisma:migrate
```

Suivre le prompt :
```
? Enter a name for the new migration: initial_schema
```

### **Solution 3 : Tester API Chat**
```bash
# Dans le terminal, tester l'endpoint
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "conversationHistory": []}'
```

Si ça marche → Problème est côté frontend
Si ça marche pas → Problème est côté backend (Gemini)

---

## 📝 **CODE À EXAMINER**

### **Frontend - Chat Page**

**Fichier** : `apps/frontend/app/chat/page.tsx`

**Lignes critiques** : 172-210

```typescript
const sendMessage = async (messageText: string) => {
  // ...

  try {
    // LIGNE 174 : Vérifier que ce code existe
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // LIGNE 185 : PROBLÈME POTENTIEL ICI
    const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: messageText,
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      })
    });

    const data = await response.json();

    if (data.success) {
      // Afficher message
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Chat error:', error);
    // Afficher erreur
  }
}
```

**Fix recommandé** :
```typescript
// Ligne 185 : Remplacer par
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const response = await fetch(`${API_URL}/api/chat`, {
```

### **Backend - Gemini Service**

**Fichier** : `apps/backend/src/services/gemini.service.ts`

**Lignes critiques** : 17-48

```typescript
export async function generateSpiritualResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: any[] = []
): Promise<AIResponse> {

  if (!genAI) {
    console.warn('GEMINI_API_KEY not configured, using fallback');
    return getFallbackResponse();
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: systemPrompt,
    });

    const generationConfig = {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    };

    const chat = model.startChat({
      generationConfig,
      history: buildGeminiHistory(conversationHistory),
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;

    return {
      text: response.text(),
      model: 'gemini-2.0-flash-exp',
      provider: 'google-gemini'
    };

  } catch (error: any) {
    console.error('Google Gemini error:', error.message);
    return getFallbackResponse();
  }
}
```

---

## 📋 **CHECKLIST DEBUGGING**

### **Pour Claude Expert**

Vérifier dans cet ordre :

1. **[ ] jsPDF installé ?**
   ```bash
   cd apps/frontend
   npm list jspdf
   ```
   Si empty → `npm install jspdf html2canvas`

2. **[ ] Database migrée ?**
   ```bash
   cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
   pnpm run prisma:migrate
   ```

3. **[ ] Backend répond au health check ?**
   ```bash
   curl http://localhost:5001/health
   ```
   Doit retourner : `{"status":"ok",...}`

4. **[ ] API Chat répond ?**
   ```bash
   curl -X POST http://localhost:5001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"Test","conversationHistory":[]}'
   ```

5. **[ ] Clé Gemini valide ?**
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAOzBr_85GY834oEUAJKbHZNdiSiBBEwvM"
   ```

6. **[ ] Frontend peut appeler backend ?**
   Ouvrir console navigateur sur http://localhost:3002/chat
   Chercher erreurs CORS ou fetch failed

---

## 🎯 **FICHIERS COMPLETS À PARTAGER AVEC CLAUDE**

Crée un fichier avec ces contenus :

### **1. Configuration**
```bash
# apps/backend/.env (sans secrets sensibles en prod)
DATABASE_URL=postgresql://...
JWT_SECRET=<généré>
GEMINI_API_KEY=AIzaSyAOzBr_85GY834oEUAJKbHZNdiSiBBEwvM
PORT=5001
FRONTEND_URL=http://localhost:3000

# apps/frontend/.env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### **2. Logs Backend**
```
🚀 Backend server running on http://localhost:5001
📊 Health check: http://localhost:5001/health
🔧 Environment: development
```

### **3. Logs Frontend**
```
⚠ Port 3000 is in use, trying 3001 instead.
⚠ Port 3001 is in use, trying 3002 instead.
  ▲ Next.js 14.0.4
  - Local: http://localhost:3002
✓ Ready in 1652ms

⨯ ./lib/pdf-generator.ts:4:0
Module not found: Can't resolve 'jspdf'
```

### **4. Code Chat Frontend**
`apps/frontend/app/chat/page.tsx` ligne 172-210

### **5. Code Gemini Service**
`apps/backend/src/services/gemini.service.ts` complet

### **6. Code Auth Controller**
`apps/backend/src/controllers/auth.controller.ts` fonction `register()`

---

## 🚀 **ACTIONS IMMÉDIATES**

### **Correction 1 : Installer jsPDF** (2 min)
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
npm install jspdf html2canvas
```

### **Correction 2 : Migrer Database** (3 min)
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
pnpm run prisma:migrate
```

Nom migration : `initial_schema`

### **Correction 3 : Fix API URL Frontend** (1 min)

**Fichier** : `apps/frontend/app/chat/page.tsx`

**Ligne 185, remplacer** :
```typescript
const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/chat', {
```

**Par** :
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const response = await fetch(`${API_URL}/api/chat`, {
```

### **Correction 4 : Redémarrer Frontend** (1 min)
```bash
# Tuer frontend
lsof -ti:3002 | xargs kill -9

# Relancer
cd apps/frontend
npm run dev
```

---

## 🧪 **TESTS À EXÉCUTER**

### **Test 1 : Backend Health**
```bash
curl http://localhost:5001/health
```

**Attendu** : `{"status":"ok",...}`

### **Test 2 : API Chat**
```bash
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bonjour",
    "conversationHistory": []
  }'
```

**Attendu** : Réponse de Gemini

### **Test 3 : API Register**
```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@broolykid.io",
    "username": "testuser",
    "password": "SecurePass123"
  }'
```

**Attendu** : Token JWT

### **Test 4 : Frontend Chat Page**
1. Ouvrir http://localhost:3002/chat
2. Ouvrir Console Dev (F12)
3. Chercher erreurs JavaScript
4. Taper message dans chat
5. Observer requête réseau (Network tab)

---

## 📁 **STRUCTURE FICHIERS CRITIQUES**

```
apps/
├── backend/
│   ├── .env                           # ✅ Configuré
│   ├── src/
│   │   ├── services/
│   │   │   └── gemini.service.ts      # ✅ Créé (Gemini intégré)
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts     # ⚠️ À tester
│   │   │   └── chat.controller.ts     # ✅ Utilise Gemini
│   │   └── utils/
│   │       └── jwt.util.ts            # ✅ Sécurisé
│   └── prisma/
│       └── schema.prisma              # ⚠️ Migrations à faire
│
└── frontend/
    ├── .env                           # ✅ API_URL configuré
    ├── lib/
    │   └── pdf-generator.ts           # ❌ jsPDF manquant
    ├── app/
    │   ├── chat/
    │   │   └── page.tsx               # ⚠️ Potentiel fix ligne 185
    │   └── (auth)/
    │       ├── login/page.tsx         # ⚠️ À tester
    │       └── register/page.tsx      # ⚠️ À tester
    └── components/
        ├── ErrorBoundary.tsx          # ✅ Créé
        └── ClientLayout.tsx           # ✅ Créé
```

---

## 🎯 **QUESTIONS POUR CLAUDE EXPERT**

1. **jsPDF** : Dois-je l'installer ou retirer pdf-generator.ts pour l'instant ?

2. **Database** : Les migrations Prisma doivent être exécutées ?

3. **API URL** : Le fix `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'` est-il suffisant ?

4. **Gemini** : La clé API fournie est-elle valide ? Comment tester ?

5. **Auth** : Pourquoi l'inscription ne fonctionne pas ? DB ? Validation ?

6. **Ordre des fixes** : Quelle est la priorité ?
   - a) jsPDF d'abord
   - b) Database migrations d'abord
   - c) Fix API URL d'abord

---

## 💡 **PLAN DE RÉSOLUTION SUGGÉRÉ**

### **Phase 1 : Fixes Rapides** (10 min)
1. Installer jsPDF : `npm install jspdf html2canvas`
2. Fix API URL dans chat/page.tsx ligne 185
3. Redémarrer frontend

### **Phase 2 : Database** (5 min)
4. Exécuter migrations : `pnpm run prisma:migrate`
5. Vérifier tables créées
6. Tester inscription

### **Phase 3 : Tests** (10 min)
7. Tester backend API chat via curl
8. Tester frontend chat via navigateur
9. Tester inscription utilisateur
10. Vérifier logs pour erreurs

---

## 📊 **RÉSUMÉ POUR CLAUDE**

**Projet** : BroolyKid MVP
**Score actuel** : 8.5/10 (code) mais 0/10 (runtime)

**Problèmes** :
- ❌ jsPDF manquant (bloque Kids Generator)
- ⚠️ Database peut-être non migrée (bloque Auth)
- ⚠️ Chat Gemini ne répond pas (cause inconnue)

**Fichiers OK** :
- ✅ Gemini service créé
- ✅ JWT sécurisé
- ✅ Error Boundary créé
- ✅ Three.js cleanup ajouté

**Besoin** :
- Step-by-step debugging
- Tester chaque composant isolément
- Identifier la cause racine des erreurs

---

**🌍💫 Rapport Complet pour Expert Claude 🕉️✨**

**Merci d'aider à résoudre ces derniers problèmes !**
