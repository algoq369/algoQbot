# 🔴 **RAPPORT URGENT POUR CLAUDE EXPERT**

## 🚨 **PROBLÈMES ACTUELS - BESOIN D'AIDE**

**Date** : 10 Octobre 2025
**Projet** : BroolyKid MVP
**Status** : Backend OK, Frontend avec erreurs

---

## ✅ **CE QUI FONCTIONNE**

1. ✅ **Backend démarre** sur port 5001
2. ✅ **Gemini intégré** (service créé)
3. ✅ **JWT sécurisé** (validation stricte)
4. ✅ **Error Boundary** créé
5. ✅ **Three.js cleanup** ajouté
6. ✅ **Health check** répond : `http://localhost:5001/health`

---

## ❌ **PROBLÈMES BLOQUANTS**

### **Problème #1 : jsPDF Manquant**

**Erreur** :
```
Module not found: Can't resolve 'jspdf'
./lib/pdf-generator.ts:4:0
```

**Cause** :
```bash
cd apps/frontend
npm list jspdf
# Résultat : (empty)
```

**Tentative d'installation** :
```bash
npm install jspdf html2canvas
```

**Erreur obtenue** :
```
npm error code 127
npm error path .../axios
npm error command failed
npm error command sh -c husky install && npm run prepare:hooks
npm error sh: husky: command not found
```

**Questions pour Claude** :
1. Pourquoi axios demande husky ?
2. Comment installer jsPDF malgré cette erreur ?
3. Dois-je fix axios d'abord ?
4. Ou supprimer pdf-generator.ts temporairement ?

---

### **Problème #2 : Impossible de Créer Compte**

**Symptôme** :
Utilisateur ne peut pas s'inscrire.

**Hypothèses** :
- Database non migrée ?
- API register ne fonctionne pas ?
- Frontend n'envoie pas à la bonne URL ?

**Tests à Faire** :
```bash
# 1. Vérifier migrations
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
pnpm run prisma:migrate

# 2. Tester API directement
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@broolykid.io",
    "username": "testuser",
    "password": "SecurePass123"
  }'
```

**Questions pour Claude** :
1. Dois-je créer les migrations maintenant ?
2. Comment tester l'API register ?
3. Y a-t-il un problème dans auth.controller.ts ?

---

### **Problème #3 : Chat Gemini Ne Répond Pas**

**Symptôme** :
Chat ne génère pas de réponses.

**Configuration Actuelle** :
```env
# Backend .env
GEMINI_API_KEY=AIzaSyAOzBr_85GY834oEUAJKbHZNdiSiBBEwvM

# Frontend .env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

**Tests à Faire** :
```bash
# 1. Tester Gemini directement
curl "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAOzBr_85GY834oEUAJKbHZNdiSiBBEwvM"

# 2. Tester API Chat backend
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","conversationHistory":[]}'
```

**Questions pour Claude** :
1. La clé Gemini est-elle valide ?
2. Le service gemini.service.ts est correct ?
3. Y a-t-il un problème dans le format de requête ?
4. Dois-je ajouter des logs pour debug ?

---

## 📝 **FICHIERS À EXAMINER**

### **Backend**

#### **`src/services/gemini.service.ts`** (103 lignes)
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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

**Questions** :
- Le modèle `gemini-2.0-flash-exp` existe-t-il ?
- Faut-il utiliser `gemini-pro` ou `gemini-1.5-flash` ?
- Le format de la requête est correct ?

#### **`src/controllers/auth.controller.ts`** (ligne 6-46)
```typescript
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

**Question** : Ce code semble correct. Quelle est la vraie erreur ?

### **Frontend**

#### **`app/chat/page.tsx`** (ligne 172-210)
```typescript
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // LIGNE 185 : POTENTIEL PROBLÈME
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
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      throw new Error(data.error || 'Erreur');
    }
  } catch (error) {
    console.error('Chat error:', error);
    // Afficher erreur
  } finally {
    setIsLoading(false);
  }
}
```

**Question** : `process.env.NEXT_PUBLIC_API_URL` est-il accessible côté client ?

---

## 🎯 **DEMANDE À CLAUDE EXPERT**

**Peux-tu m'aider avec ces 3 problèmes dans l'ordre de priorité ?**

1. **Comment installer jsPDF** malgré l'erreur husky/axios ?
2. **Comment débugger** pourquoi l'inscription ne marche pas ?
3. **Comment tester** si Gemini répond correctement ?

**Et donner un plan step-by-step** pour tout résoudre en 30 minutes ?

---

## 📞 **INFORMATIONS SYSTÈME**

- **Node.js** : v22.19.0
- **pnpm** : v10.18.1
- **OS** : macOS
- **Backend** : Port 5001 ✅
- **Frontend** : Port 3002 ✅ (avec erreurs)

---

**🌍💫 Merci Claude Expert ! 🙏✨**
