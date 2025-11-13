# 🚀 GUIDE DE DÉMARRAGE COMPLET - TOUS LES BOTS

**Date:** October 8, 2025, 22:21
**Version:** v2.0
**Status:** ✅ TOUS LES SYSTÈMES OPÉRATIONNELS

---

## 📋 VUE D'ENSEMBLE

Vous avez **2 SYSTÈMES PRINCIPAUX** à démarrer:

1. **🤖 Bot Principal** - Trading automatique
2. **📊 Monitoring Externe** - Surveillance hourly

---

## 🤖 SYSTÈME #1: BOT PRINCIPAL DE TRADING

### Démarrage Simple:

```bash
cd /Users/sheirraza/bsc-ranging-bot && npm start &
```

### Démarrage avec Clean Restart (si port occupé):

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null; sleep 2 && cd /Users/sheirraza/bsc-ranging-bot && npm start &
```

### Démarrage Silencieux (sans output):

```bash
cd /Users/sheirraza/bsc-ranging-bot && npm start > /dev/null 2>&1 &
```

### Vérifier qu'il tourne:

```bash
ps aux | grep "AdvancedTradingBot" | grep -v grep
```

**Output attendu:**
```
sheirraza   20041  0.0  0.6  node AdvancedTradingBot.js
```

### Voir les logs en direct:

```bash
tail -f logs/combined.log
```

### Voir les logs filtrés (trading seulement):

```bash
tail -f logs/combined.log | grep -E "(Trading decision|Position|profit|ERROR)"
```

### Arrêter le bot:

```bash
lsof -ti:3001 | xargs kill -9
```

Ou si vous utilisez PM2:
```bash
pm2 stop bsc-bot
```

---

## 📊 SYSTÈME #2: MONITORING EXTERNE

### Démarrage:

```bash
cd /Users/sheirraza/bsc-ranging-bot && ./start-monitoring.sh
```

### Vérifier qu'il tourne:

```bash
ps aux | grep "monitor-positions" | grep -v grep
```

**Output attendu:**
```
sheirraza   39295  0.0  0.0  node scripts/monitor-positions.js
```

### Voir les rapports en direct:

```bash
tail -f logs/position-monitoring.log
```

### Voir le dernier résumé JSON:

```bash
cat data/monitoring-summary.json | jq
```

### Arrêter le monitoring:

```bash
cd /Users/sheirraza/bsc-ranging-bot && ./stop-monitoring.sh
```

---

## 🔄 DÉMARRAGE COMPLET (LES DEUX)

### One-Liner pour tout démarrer:

```bash
cd /Users/sheirraza/bsc-ranging-bot && lsof -ti:3001 | xargs kill -9 2>/dev/null; sleep 2 && npm start > /dev/null 2>&1 & sleep 3 && ./start-monitoring.sh
```

### Step-by-Step (recommandé):

**Step 1: Démarrer le bot principal**
```bash
cd /Users/sheirraza/bsc-ranging-bot
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2
npm start > /dev/null 2>&1 &
```

**Step 2: Attendre l'initialisation (10 secondes)**
```bash
sleep 10
```

**Step 3: Vérifier que le bot tourne**
```bash
ps aux | grep AdvancedTradingBot | grep -v grep
```

**Step 4: Démarrer le monitoring**
```bash
./start-monitoring.sh
```

**Step 5: Vérifier que le monitoring tourne**
```bash
ps aux | grep monitor-positions | grep -v grep
```

---

## ✅ VÉRIFICATION COMPLÈTE

### Commande tout-en-un pour vérifier:

```bash
cat << 'EOF'

═══════════════════════════════════════════════════════════════════
📊 STATUS DE TOUS LES SYSTÈMES
═══════════════════════════════════════════════════════════════════

🤖 BOT PRINCIPAL:
EOF

if ps aux | grep "AdvancedTradingBot" | grep -v grep > /dev/null; then
  echo "   ✅ ACTIF"
  ps aux | grep "AdvancedTradingBot" | grep -v grep | awk '{print "   PID: " $2 " | Uptime: " $10}'
else
  echo "   ❌ ARRÊTÉ"
fi

echo ""
echo "📊 MONITORING EXTERNE:"

if ps aux | grep "monitor-positions" | grep -v grep > /dev/null; then
  echo "   ✅ ACTIF"
  ps aux | grep "monitor-positions" | grep -v grep | awk '{print "   PID: " $2 " | Uptime: " $10}'
else
  echo "   ❌ ARRÊTÉ"
fi

echo ""
echo "💾 TRADE COUNT & P&L:"

sqlite3 data/trading_bot.db "SELECT '   Total: ' || COUNT(*) || ' trades' FROM trades; SELECT '   P&L: $' || ROUND(SUM(profit_loss), 2) FROM trades;" 2>/dev/null || echo "   ❌ Database error"

echo ""
echo "📈 DERNIERS LOGS:"

tail -5 logs/combined.log 2>/dev/null | head -3 || echo "   ❌ No logs"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
```

---

## 🛠️ TROUBLESHOOTING

### Problème: Port 3001 déjà utilisé

**Symptôme:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**
```bash
lsof -ti:3001 | xargs kill -9
sleep 2
npm start &
```

---

### Problème: Bot ne démarre pas

**Symptôme:**
```
No process found
```

**Debug:**
```bash
# Vérifier les erreurs de démarrage
npm start
# (Regarder les erreurs dans le terminal)
```

**Solutions courantes:**
```bash
# 1. Vérifier node_modules
npm install

# 2. Vérifier le fichier .env
cat .env

# 3. Vérifier la database
ls -lh data/trading_bot.db

# 4. Vérifier les permissions
chmod +x AdvancedTradingBot.js
```

---

### Problème: Monitoring ne démarre pas

**Symptôme:**
```
⚠️ Le monitoring est déjà en cours d'exécution!
```

**Solution:**
```bash
./stop-monitoring.sh
sleep 2
./start-monitoring.sh
```

---

### Problème: Logs trop gros (ralentissement)

**Symptôme:**
```
Error: ENOBUFS
Logs: 200+ MB
```

**Solution - Archiver les vieux logs:**
```bash
# Arrêter les bots
lsof -ti:3001 | xargs kill -9
./stop-monitoring.sh

# Archiver les logs
mv logs/combined.log logs/combined.log.$(date +%Y%m%d_%H%M%S)
touch logs/combined.log

# Redémarrer
npm start > /dev/null 2>&1 &
sleep 3
./start-monitoring.sh
```

---

## 📊 COMMANDES DE SURVEILLANCE

### Vérifier le status complet:

```bash
echo "═══ BOT STATUS ═══"
ps aux | grep -E "AdvancedTradingBot|monitor-positions" | grep -v grep

echo ""
echo "═══ TRADE COUNT ═══"
sqlite3 data/trading_bot.db "SELECT COUNT(*), SUM(profit_loss) FROM trades;"

echo ""
echo "═══ DERNIÈRES ACTIONS ═══"
tail -10 logs/combined.log | grep -E "(Position|decision|profit)"
```

### Voir les positions actives:

```bash
tail -200 logs/combined.log | grep "Monitoring position" | wc -l
```

### Voir les erreurs récentes:

```bash
tail -100 logs/combined.log | grep -E "(ERROR|WARN)" | tail -20
```

### Voir le P&L par stratégie:

```bash
sqlite3 data/trading_bot.db "SELECT strategy, COUNT(*) as trades, ROUND(AVG(profit_loss), 2) as avg_pnl FROM trades GROUP BY strategy;"
```

---

## 🔧 MAINTENANCE RECOMMANDÉE

### Quotidienne:

```bash
# Vérifier le status
ps aux | grep -E "AdvancedTradingBot|monitor-positions" | grep -v grep

# Vérifier le P&L
sqlite3 data/trading_bot.db "SELECT COUNT(*), SUM(profit_loss) FROM trades;"

# Vérifier les erreurs
tail -50 logs/combined.log | grep ERROR
```

### Hebdomadaire:

```bash
# Archiver les vieux logs
mv logs/combined.log logs/combined.log.$(date +%Y%m%d)
touch logs/combined.log

# Backup de la database
cp data/trading_bot.db backups/trading_bot.db.$(date +%Y%m%d)

# Redémarrer pour appliquer les updates
lsof -ti:3001 | xargs kill -9
./stop-monitoring.sh
sleep 2
npm start > /dev/null 2>&1 &
sleep 3
./start-monitoring.sh
```

---

## 🎯 COMMANDES QUICK REFERENCE

### DÉMARRER TOUT:

```bash
# Bot principal
cd /Users/sheirraza/bsc-ranging-bot && npm start &

# Monitoring (après 10s)
sleep 10 && ./start-monitoring.sh
```

### ARRÊTER TOUT:

```bash
# Bot principal
lsof -ti:3001 | xargs kill -9

# Monitoring
./stop-monitoring.sh
```

### REDÉMARRER TOUT:

```bash
# Arrêter
lsof -ti:3001 | xargs kill -9 2>/dev/null
./stop-monitoring.sh

# Attendre
sleep 3

# Redémarrer
npm start > /dev/null 2>&1 &
sleep 10
./start-monitoring.sh
```

### VÉRIFIER STATUS:

```bash
# One-liner complet
echo "Bot: $(ps aux | grep AdvancedTradingBot | grep -v grep | wc -l | tr -d ' ') | Monitoring: $(ps aux | grep monitor-positions | grep -v grep | wc -l | tr -d ' ') | Trades: $(sqlite3 data/trading_bot.db 'SELECT COUNT(*) FROM trades;' 2>/dev/null)"
```

---

## 📁 SCRIPTS DISPONIBLES

### Démarrage:

- ✅ `npm start` - Démarrer le bot principal
- ✅ `./start-monitoring.sh` - Démarrer le monitoring
- ✅ `start-shadow-mode.js` - (alternative avec node)

### Arrêt:

- ✅ `lsof -ti:3001 | xargs kill -9` - Arrêter le bot
- ✅ `./stop-monitoring.sh` - Arrêter le monitoring

### Vérification:

- ✅ `QUICK_COMMANDS.txt` - Commandes rapides
- ✅ `COMMANDS_RESTART_BOT.sh` - Guide de redémarrage

### Monitoring:

- ✅ `scripts/monitor-positions.js` - Script de monitoring
- ✅ `logs/position-monitoring.log` - Rapports hourly

---

## 🎉 RÉSUMÉ FINAL

### ✅ TOUS LES SYSTÈMES ACTIFS:

**Bot Principal:**
- ✅ ACTIF (PID: 20041)
- ✅ 7 layers d'adaptation automatique
- ✅ Trading every 30s
- ✅ Position monitoring every 30s

**Monitoring Externe:**
- ✅ ACTIF (PID: 39295)
- ✅ Rapports hourly
- ✅ ENOBUFS fix appliqué
- ✅ Database stats fonctionnels

**Métriques:**
- Trade count: 89
- P&L: $0.00
- Positions actives: 8 (après restart)
- Erreurs: ✅ AUCUNE

---

## 🔍 LOGS RÉCENTS

### Bot Principal (dernière activité):

```
[22:04:00] Market Regime: low_volatility (2.1%)
[22:04:04] AI selected strategy: ranging (confidence: 0.65)
[22:04:04] Trading decision: HOLD (price in middle of range)
```

### Monitoring (dernier rapport):

```
[22:21:04] Positions actives: 8
[22:21:04] Prix: 0.000762
[22:21:04] Profit moyen: 0.17%
[22:21:04] Total trades: 89
[22:21:04] P&L: $0.00
```

---

## ⚡ COMMANDES ULTRA-RAPIDES

### Démarrer tout (1 commande):
```bash
cd /Users/sheirraza/bsc-ranging-bot && npm start > /dev/null 2>&1 & sleep 10 && ./start-monitoring.sh
```

### Redémarrer tout (1 commande):
```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null; ./stop-monitoring.sh; sleep 3 && cd /Users/sheirraza/bsc-ranging-bot && npm start > /dev/null 2>&1 & sleep 10 && ./start-monitoring.sh
```

### Vérifier tout (1 commande):
```bash
ps aux | grep -E "AdvancedTradingBot|monitor-positions" | grep -v grep
```

### Status complet (1 commande):
```bash
echo "Bot: $(ps aux | grep AdvancedTradingBot | grep -v grep > /dev/null && echo '✅' || echo '❌') | Monitoring: $(ps aux | grep monitor-positions | grep -v grep > /dev/null && echo '✅' || echo '❌') | Trades: $(sqlite3 data/trading_bot.db 'SELECT COUNT(*) FROM trades;' 2>/dev/null) | P&L: \$$(sqlite3 data/trading_bot.db 'SELECT ROUND(SUM(profit_loss), 2) FROM trades;' 2>/dev/null)"
```

---

**Guide créé:** October 8, 2025, 22:21
**Status:** ✅ ENOBUFS fix appliqué
**Monitoring:** ✅ OPÉRATIONNEL








