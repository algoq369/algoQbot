# 🧪 INSTRUCTIONS DE TEST NAVIGATEUR - À FAIRE MAINTENANT

**URGENT** : Pour déboguer les problèmes, il faut tester dans le navigateur avec DevTools.

---

## 📋 ÉTAPE 1 : TESTER LE CHAT

### Actions à faire :

1. **Ouvrir le chat** dans ton navigateur :
   ```
   http://localhost:3002/chat
   ```

2. **Ouvrir les DevTools** :
   - Sur Mac : `Cmd + Option + I`
   - Sur Windows : `F12` ou `Ctrl + Shift + I`

3. **Aller dans l'onglet Console**

4. **Essayer d'envoyer un message** :
   - Tape "Bonjour" dans le chat
   - Clique sur "Envoyer"

5. **COPIER TOUT CE QUI EST ÉCRIT EN ROUGE** dans la Console

6. **Aller dans l'onglet Network** (Réseau)

7. **Filtrer sur "chat"**

8. **Chercher la requête vers `/api/chat`** :
   - Est-ce qu'elle apparaît ?
   - Quel est le statut (200, 404, 500) ?
   - Cliquer dessus et copier la réponse

---

## 📋 ÉTAPE 2 : TESTER L'INSCRIPTION

### Actions à faire :

1. **Ouvrir la page d'inscription** :
   ```
   http://localhost:3002/auth/register
   ```

2. **Ouvrir les DevTools** (si pas déjà ouvert)

3. **Aller dans l'onglet Console**

4. **Remplir le formulaire** :
   - Email : `testui@broolykid.io`
   - Username : `testui`
   - Password : `Test1234!`

5. **Cliquer sur "Register"**

6. **COPIER TOUT CE QUI EST ÉCRIT EN ROUGE** dans la Console

7. **Aller dans l'onglet Network**

8. **Chercher la requête vers `/api/auth/register`** :
   - Est-ce qu'elle apparaît ?
   - Quel est le statut (200, 400, 500) ?
   - Cliquer dessus et copier la réponse

---

## 📋 ÉTAPE 3 : TESTER LE PDF GENERATOR

### Actions à faire :

1. **Ouvrir la page Kids** :
   ```
   http://localhost:3002/kids
   ```

2. **Ouvrir les DevTools**

3. **Aller dans l'onglet Console**

4. **COPIER TOUT CE QUI EST ÉCRIT EN ROUGE** (même sans cliquer sur rien)

---

## 📸 CE QU'IL FAUT PARTAGER AVEC CLAUDE

### 1. Screenshots DevTools
- Screenshot de la Console (onglet Console)
- Screenshot du Network (onglet Network/Réseau)

### 2. Texte des erreurs
Copie-colle **EXACTEMENT** les erreurs rouges de la Console, par exemple :
```
❌ Error: Failed to fetch
❌ TypeError: Cannot read property 'message' of undefined
❌ Module not found: Can't resolve 'jspdf'
```

### 3. Requêtes Network
Pour chaque requête `/api/chat` ou `/api/auth/register` :
- URL complète
- Statut (200, 404, 500, etc.)
- Réponse du serveur

---

## 🔗 LIENS RAPIDES À TESTER

| Page | URL | Ce qu'il faut tester |
|------|-----|---------------------|
| Homepage | http://localhost:3002 | S'affiche correctement ? |
| Chat | http://localhost:3002/chat | Peut envoyer un message ? |
| Register | http://localhost:3002/auth/register | Peut créer un compte ? |
| Login | http://localhost:3002/auth/login | Peut se connecter ? |
| Kids | http://localhost:3002/kids | Erreur jsPDF dans Console ? |
| Book | http://localhost:3002/book | S'affiche correctement ? |

---

## 💬 MESSAGE À COPIER POUR CLAUDE

Après avoir fait les tests, copie ce template et remplis-le :

```
=== TESTS NAVIGATEUR BROOLYKID ===

📍 URL testée : http://localhost:3002/chat

❌ ERREURS CONSOLE :
[Colle ici les erreurs rouges de la Console]

📡 REQUÊTES NETWORK :
Requête vers : http://localhost:5001/api/chat
Statut : [200 / 404 / 500 / autre]
Réponse : [Colle la réponse JSON ou le message d'erreur]

📸 COMPORTEMENT :
[Décris ce qui se passe : page blanche, rien ne se passe, message d'erreur, etc.]

---

📍 URL testée : http://localhost:3002/auth/register

❌ ERREURS CONSOLE :
[Colle ici les erreurs rouges de la Console]

📡 REQUÊTES NETWORK :
Requête vers : http://localhost:5001/api/auth/register
Statut : [200 / 404 / 500 / autre]
Réponse : [Colle la réponse JSON ou le message d'erreur]

📸 COMPORTEMENT :
[Décris ce qui se passe]

---

📍 URL testée : http://localhost:3002/kids

❌ ERREURS CONSOLE :
[Colle ici les erreurs rouges de la Console]

📸 COMPORTEMENT :
[La page s'affiche ? Il y a une erreur ?]
```

---

## ⚡ SI TU VOIS ZÉRO ERREUR MAIS ÇA MARCHE PAS

C'est possible que :
1. Le navigateur utilise une **vieille version en cache**
   - Solution : `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows) pour forcer le rechargement

2. Le **serveur n'est pas démarré**
   - Solution : Vérifier que les terminaux avec `pnpm run dev:backend` et `npm run dev` tournent

3. L'URL est **incorrecte**
   - Solution : Vérifier que tu es bien sur `localhost:3002` et pas `localhost:3000`

---

**IMPORTANT** : Ne dis pas juste "ça marche pas", il faut les **erreurs exactes** de la Console pour que Claude puisse aider ! 🙏
