# 🎯 COMMANDES DE MONITORING RAPIDE

## 🚀 **DÉMARRAGE RAPIDE**

### **Vérifier que le bot fonctionne:**
```bash
ps aux | grep "node AdvancedTradingBot.js" | grep -v grep
```

### **Status rapide:**
```bash
./monitor-bot.sh
```

---

## 📊 **MONITORING EN TEMPS RÉEL**

### **1. Dashboard complet (auto-refresh):**
```bash
./watch-bot.sh
```
*Press Ctrl+C pour quitter*

### **2. Voir TOUS les trades en direct:**
```bash
tail -f logs/combined.log | grep --line-buffered "Shadow Trade"
```

### **3. Voir positions & profits uniquement:**
```bash
tail -f logs/combined.log | grep --line-buffered -E "(Position.*created|profit|Exit)"
```

### **4. Voir les décisions de trading:**
```bash
tail -f logs/combined.log | grep --line-buffered "Trading decision"
```

---

## 🔍 **ANALYSES PONCTUELLES**

### **Derniers 10 trades:**
```bash
tail -100 logs/combined.log | grep "Shadow Trade" | tail -10
```

### **Positions actuelles:**
```bash
tail -200 logs/combined.log | grep "Monitoring position" | tail -10
```

### **Win rate par stratégie:**
```bash
tail -500 logs/combined.log | grep "performance:" | tail -5
```

### **Portfolio actuel:**
```bash
tail -50 logs/combined.log | grep -E "(USDT|BNB|Portfolio value)"
```

### **Vérifier corruptions:**
```bash
tail -1000 logs/combined.log | grep -c "suspiciously high"
```
*Résultat attendu: 0*

---

## 📈 **STATISTIQUES**

### **Compter les trades des dernières 24h:**
```bash
# Tous les trades
grep "Shadow Trade:" logs/combined.log | wc -l

# Trades d'aujourd'hui uniquement
grep "Shadow Trade:" logs/combined.log | grep "$(date +%Y-%m-%d)" | wc -l
```

### **Calculer le profit moyen:**
```bash
tail -500 logs/combined.log | grep "Estimated Profit" | \
  awk -F': ' '{print $2}' | awk '{print $1}' | \
  awk '{s+=$1; c++} END {if(c>0) print "Avg Profit:", s/c, "USDT"; else print "No trades yet"}'
```

### **Voir les erreurs récentes:**
```bash
tail -200 logs/combined.log | grep '"level":"error"' | tail -5
```

---

## ⚡ **ACTIONS RAPIDES**

### **Redémarrer le bot:**
```bash
pkill -f "node AdvancedTradingBot.js"
sleep 2
cd /Users/sheirraza/bsc-ranging-bot && npm start &
```

### **Vérifier les fichiers de data:**
```bash
ls -lh data/
```

### **Voir la dernière activité:**
```bash
tail -30 logs/combined.log
```

---

## 🎯 **VALIDATION POST-OPTIMISATION**

### **Checklist des 2 premières heures:**

1. **Bot actif?**
   ```bash
   ps aux | grep "AdvancedTradingBot" | grep -v grep
   ```
   *Attendu: 1 processus*

2. **Portfolio correct?**
   ```bash
   tail -50 logs/combined.log | grep "Portfolio value"
   ```
   *Attendu: ~$60,000*

3. **Trades exécutés?**
   ```bash
   tail -100 logs/combined.log | grep "Shadow Trade" | wc -l
   ```
   *Attendu: 0-10 dans les 2 premières heures*

4. **Positions créées?**
   ```bash
   tail -100 logs/combined.log | grep "Position.*created" | tail -5
   ```
   *Attendu: Quelques positions*

5. **Aucune corruption?**
   ```bash
   tail -500 logs/combined.log | grep -c "suspiciously high"
   ```
   *Attendu: 0*

6. **Take profit à 1.5%?**
   ```bash
   tail -200 logs/combined.log | grep "Monitoring position" | head -3
   ```
   *Regarder les valeurs de profit*

---

## 🚨 **TROUBLESHOOTING**

### **Bot ne démarre pas:**
```bash
# Vérifier les logs d'erreur
tail -50 logs/combined.log | grep error

# Port 3001 déjà utilisé?
lsof -i :3001
```

### **Pas de trades:**
```bash
# Vérifier les décisions de trading
tail -100 logs/combined.log | grep "Trading decision"

# Vérifier le market regime
tail -100 logs/combined.log | grep "Market Regime"
```

### **Portfolio corrompu:**
```bash
# Arrêter le bot
pkill -f "node AdvancedTradingBot.js"

# Reset les balances (dans testing/shadowMode.js)
# Vérifier que usdt: 30000, bnb: 22.68

# Clear data
rm -f data/shadow-trades.json
echo "[]" > data/shadow-trades.json

# Redémarrer
npm start &
```

---

## 📋 **MÉTRIQUES CLÉS À SURVEILLER**

| Métrique | Cible | Commande |
|----------|-------|----------|
| Win Rate | ≥60% | `tail -500 logs/combined.log \| grep "performance:"` |
| Avg Profit | ≥$100 | `grep "Estimated Profit" logs/combined.log` |
| Trades/jour | 5-10 | `grep "Shadow Trade" logs/combined.log \| wc -l` |
| Max Drawdown | <5% | Surveiller portfolio value |
| Corruption | 0 | `grep "suspiciously high" logs/combined.log \| wc -l` |

---

## 🎬 **COMMANDE RECOMMANDÉE POUR DÉBUT**

```bash
# Ouvrir 2 terminals:

# Terminal 1: Status continu
watch -n 10 './monitor-bot.sh'

# Terminal 2: Trades en temps réel
tail -f logs/combined.log | grep --line-buffered -E "(Position.*created|profit|Exit)"
```

---

**📅 Créé le: 08/10/2025**
**🎯 Objectif: Monitoring optimal du bot optimisé**








