# ⚡ DIAGNOSTIC RAPIDE - COMMANDES À EXÉCUTER

**Utilise ces commandes pour diagnostiquer rapidement les problèmes**

---

## 🔍 VÉRIFIER SI LES SERVEURS TOURNENT

### Backend (doit tourner sur port 5001)
```bash
lsof -i:5001 | grep LISTEN
```
✅ **Résultat attendu** : Une ligne avec `node` et `LISTEN`
❌ **Si vide** : Le backend ne tourne pas

### Frontend (doit tourner sur port 3002)
```bash
lsof -i:3002 | grep LISTEN
```
✅ **Résultat attendu** : Une ligne avec `node` et `LISTEN`
❌ **Si vide** : Le frontend ne tourne pas

---

## 🧪 TESTER LES APIs BACKEND

### Test 1 : Health Check
```bash
curl http://localhost:5001/health
```
✅ **Résultat attendu** :
```json
{"status":"ok","timestamp":"...","service":"broolykid-backend","version":"1.0.0"}
```

### Test 2 : Chat avec Gemini
```bash
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Bonjour BroolyKid"}'
```
✅ **Résultat attendu** :
```json
{"success":true,"message":"...","model":"gemini-2.0-flash-exp","provider":"google-gemini"}
```

### Test 3 : Créer un compte
```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-diagnostic@broolykid.io",
    "username": "testdiag",
    "password": "Test1234!"
  }'
```
✅ **Résultat attendu** :
```json
{"token":"eyJ...","user":{"id":"...","email":"test-diagnostic@broolykid.io",...}}
```

---

## 🌐 TESTER LE FRONTEND

### Test : Homepage HTML
```bash
curl -s http://localhost:3002 | head -50
```
✅ **Résultat attendu** : HTML avec `<title>BROOLYKID - Sovereign Communities</title>`

---

## 🔧 VÉRIFIER L'ENVIRONNEMENT

### Variables Backend
```bash
cat /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/backend/.env | grep -E "(GEMINI|JWT|DATABASE)"
```
✅ **Doit contenir** :
- `GEMINI_API_KEY=AIza...`
- `JWT_SECRET=...` (long string)
- `DATABASE_URL=postgresql://...`

### Variables Frontend
```bash
cat /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend/.env.local
```
✅ **Doit contenir** :
- `NEXT_PUBLIC_API_URL=http://localhost:5001`

---

## 📦 VÉRIFIER LES MODULES INSTALLÉS

### Backend
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/backend
pnpm list @google/generative-ai @prisma/client express
```
✅ **Résultat attendu** : Versions affichées

### Frontend
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
npm list next react jspdf
```
❌ **jsPDF manquant** : C'est normal, c'est le problème à résoudre

---

## 🧹 NETTOYER LES PROCESSUS ZOMBIES

### Voir tous les processus Node.js
```bash
ps aux | grep -E "(node|tsx|next)" | grep -v grep
```

### Tuer un processus spécifique
```bash
kill -9 [PID]
```

### Tuer tous les processus backend zombies (ATTENTION)
```bash
pkill -f "tsx watch src/index.ts"
```

---

## 🔄 REDÉMARRER PROPREMENT

### Arrêter tout
```bash
# Arrêter backend
pkill -f "tsx watch src/index.ts"

# Arrêter frontend
pkill -f "next dev"
```

### Redémarrer backend
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
pnpm run dev:backend
```

### Redémarrer frontend (dans un autre terminal)
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
npm run dev
```

---

## 🛠️ RÉPARER JSPDF (TENTATIVE)

### Option 1 : Avec npm force
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
npm install jspdf@2.5.1 html2canvas@1.4.1 --force
```

### Option 2 : Avec pnpm dans le workspace
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp
pnpm add jspdf html2canvas -w
```

### Option 3 : Supprimer node_modules et réinstaller
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend
rm -rf node_modules package-lock.json
npm install
npm install jspdf@2.5.1 html2canvas@1.4.1
```

---

## 📊 VÉRIFIER LA DATABASE

### Voir si Prisma est généré
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/backend
ls -la node_modules/.prisma/client
```
✅ **Doit exister** : Si non, exécuter `pnpm run prisma:generate`

### Vérifier les migrations
```bash
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/backend
pnpm run prisma migrate status
```

---

## 🔑 RÉSUMÉ : TOUT TESTER EN 1 MINUTE

Copie-colle ces 5 commandes pour un diagnostic complet :

```bash
# 1. Backend Health
curl http://localhost:5001/health

# 2. Chat API
curl -X POST http://localhost:5001/api/chat -H "Content-Type: application/json" -d '{"message":"test"}'

# 3. Register API
curl -X POST http://localhost:5001/api/auth/register -H "Content-Type: application/json" -d '{"email":"quick@test.com","username":"quick","password":"Test1234!"}'

# 4. Frontend HTML
curl -s http://localhost:3002 | head -20

# 5. Vérifier jsPDF
cd /Users/sheirraza/bsc-ranging-bot/broolykid-mvp/apps/frontend && npm list jspdf
```

---

## 📝 INTERPRÉTER LES RÉSULTATS

| Commande | Résultat OK | Résultat KO | Action |
|----------|-------------|-------------|--------|
| Health | JSON avec "ok" | Error / vide | Relancer backend |
| Chat API | JSON avec Gemini | Error | Vérifier GEMINI_API_KEY |
| Register | JSON avec token | Error | Vérifier DATABASE_URL |
| Frontend | HTML visible | Error / vide | Relancer frontend |
| jsPDF | Version affichée | `(empty)` | Installer jsPDF |

---

## 🚀 SI TOUT EST OK DANS LES TESTS CURL

**ALORS** le problème est **côté navigateur**.

**Il faut** :
1. Ouvrir http://localhost:3002/chat dans le navigateur
2. Ouvrir DevTools (F12)
3. Aller dans Console
4. Envoyer un message
5. **COPIER LES ERREURS ROUGES**
6. Partager avec Claude

**Sans les erreurs du navigateur, impossible de déboguer l'UI !** 🙏

---

**Guide créé par** : Cursor AI
**Pour un diagnostic rapide et efficace**
