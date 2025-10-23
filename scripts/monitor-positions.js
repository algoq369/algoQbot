#!/usr/bin/env node

/**
 * SCRIPT DE MONITORING AUTOMATIQUE DES POSITIONS
 *
 * Ce script surveille l'état des positions et génère des rapports toutes les heures
 *
 * Usage:
 *   node scripts/monitor-positions.js
 *
 * Ou en arrière-plan:
 *   node scripts/monitor-positions.js > logs/monitoring.log 2>&1 &
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  checkIntervalMinutes: 60,  // Vérifier toutes les heures
  logFile: path.join(__dirname, '../logs/position-monitoring.log'),
  summaryFile: path.join(__dirname, '../data/monitoring-summary.json'),
  databasePath: path.join(__dirname, '../data/trading_bot.db'),
  logsPath: path.join(__dirname, '../logs/combined.log')
};

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Fonction pour logger avec timestamp
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `${color}[${timestamp}] ${message}${colors.reset}`;
  console.log(formattedMessage);

  // Écrire aussi dans le fichier de log
  fs.appendFileSync(CONFIG.logFile, `[${timestamp}] ${message}\n`);
}

// Fonction pour analyser les logs récents
function analyzeRecentLogs() {
  try {
    if (!fs.existsSync(CONFIG.logsPath)) {
      return { error: 'Logs file not found' };
    }

    // 🔧 FIX ENOBUFS: Reduce tail to 100 lines for large log files (187 MB+)
    const { execSync } = require('child_process');
    const logs = execSync(`tail -100 "${CONFIG.logsPath}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024  // 10 MB buffer (up from default 1 MB)
    });
    const lines = logs.split('\n'); // Dernières 100 lignes

    // Extraire les positions en cours
    const positions = [];
    const exitedPositions = [];
    let currentPrice = null;

    for (const line of lines) {
      // Prix actuel
      const priceMatch = line.match(/current:\s*([\d.]+)/);
      if (priceMatch) {
        currentPrice = parseFloat(priceMatch[1]);
      }

      // Positions en monitoring
      const posMatch = line.match(/Monitoring position (pos_[\w]+).*profit\s*([-\d.]+)%.*entry:\s*([\d.]+)/);
      if (posMatch) {
        positions.push({
          id: posMatch[1],
          profitPercent: parseFloat(posMatch[2]),
          entryPrice: parseFloat(posMatch[3])
        });
      }

      // Positions sorties
      const exitMatch = line.match(/Position (pos_[\w]+) exited.*PnL:\s*\$([-\d.]+)/);
      if (exitMatch) {
        exitedPositions.push({
          id: exitMatch[1],
          pnl: parseFloat(exitMatch[2])
        });
      }
    }

    return {
      currentPrice,
      activePositions: positions.length,
      positions: positions.slice(-10), // Garder les 10 dernières
      exitedPositions: exitedPositions.slice(-10),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Fonction pour lire la base de données SQLite
async function getDatabaseStats() {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(CONFIG.databasePath);

    return new Promise((resolve, reject) => {
      const stats = {};

      // Total des trades
      db.get("SELECT COUNT(*) as total FROM trades", (err, row) => {
        if (err) {
          db.close();
          return reject(err);
        }
        stats.totalTrades = row.total;

        // Trades complétés
        db.get("SELECT COUNT(*) as completed, SUM(profit_loss) as totalProfit FROM trades WHERE status='completed'", (err, row) => {
          if (err) {
            db.close();
            return reject(err);
          }
          stats.completedTrades = row.completed || 0;
          stats.totalProfit = row.totalProfit || 0;

          // Trades par stratégie
          db.all("SELECT strategy, COUNT(*) as count, AVG(profit_loss) as avgProfit FROM trades GROUP BY strategy", (err, rows) => {
            if (err) {
              db.close();
              return reject(err);
            }
            stats.byStrategy = rows || [];

            db.close();
            resolve(stats);
          });
        });
      });
    });
  } catch (error) {
    return { error: error.message };
  }
}

// Fonction pour générer un rapport
async function generateReport() {
  log('═══════════════════════════════════════════════════════════', colors.cyan);
  log('📊 RAPPORT DE MONITORING - POSITIONS DU BOT', colors.bright + colors.cyan);
  log('═══════════════════════════════════════════════════════════', colors.cyan);
  log('');

  // Analyser les logs
  const logAnalysis = analyzeRecentLogs();

  if (logAnalysis.error) {
    log(`❌ Erreur d'analyse des logs: ${logAnalysis.error}`, colors.red);
  } else {
    log(`⏰ Heure: ${new Date().toLocaleString('fr-FR')}`, colors.cyan);
    log(`💰 Prix actuel: ${logAnalysis.currentPrice ? logAnalysis.currentPrice.toFixed(9) : 'N/A'}`, colors.cyan);
    log(`📈 Positions actives: ${logAnalysis.activePositions}`, colors.yellow);
    log('');

    // Positions actives détaillées
    if (logAnalysis.positions.length > 0) {
      log('🔍 POSITIONS ACTIVES (10 dernières):', colors.bright);
      log('─────────────────────────────────────────────────────────', colors.cyan);

      // Statistiques
      const profits = logAnalysis.positions.map(p => p.profitPercent);
      const avgProfit = (profits.reduce((a, b) => a + b, 0) / profits.length).toFixed(2);
      const maxProfit = Math.max(...profits).toFixed(2);
      const minProfit = Math.min(...profits).toFixed(2);
      const nearTP = profits.filter(p => p >= 0.7).length; // Proche du TP de 0.8%

      log(`   Moyenne: ${avgProfit}% | Max: ${maxProfit}% | Min: ${minProfit}%`, colors.yellow);
      log(`   ${nearTP} position(s) proche(s) du TP (≥0.7%)`, colors.green);
      log('');

      // Détail des positions
      logAnalysis.positions.forEach((pos, idx) => {
        const profitColor = pos.profitPercent >= 0.7 ? colors.green :
          pos.profitPercent >= 0 ? colors.yellow : colors.red;
        log(`   ${idx + 1}. ${pos.id}: ${profitColor}${pos.profitPercent.toFixed(2)}%${colors.reset} @ ${pos.entryPrice.toFixed(9)}`);
      });
      log('');
    }

    // Positions sorties récentes
    if (logAnalysis.exitedPositions.length > 0) {
      log('✅ POSITIONS SORTIES RÉCENTES:', colors.bright + colors.green);
      log('─────────────────────────────────────────────────────────', colors.cyan);

      const totalPnL = logAnalysis.exitedPositions.reduce((sum, p) => sum + p.pnl, 0);
      log(`   Total P&L: $${totalPnL.toFixed(2)}`, colors.green);
      log('');

      logAnalysis.exitedPositions.forEach((pos, idx) => {
        const pnlColor = pos.pnl > 0 ? colors.green : colors.red;
        log(`   ${idx + 1}. ${pos.id}: ${pnlColor}$${pos.pnl.toFixed(2)}${colors.reset}`);
      });
      log('');
    }
  }

  // Statistiques de la base de données
  try {
    const dbStats = await getDatabaseStats();

    if (dbStats.error) {
      log(`⚠️ Database stats unavailable: ${dbStats.error}`, colors.yellow);
    } else {
      log('💾 STATISTIQUES DATABASE:', colors.bright);
      log('─────────────────────────────────────────────────────────', colors.cyan);
      log(`   Total trades: ${dbStats.totalTrades}`, colors.cyan);
      log(`   Trades complétés: ${dbStats.completedTrades}`, colors.cyan);
      log(`   Profit total: $${dbStats.totalProfit.toFixed(2)}`,
        dbStats.totalProfit > 0 ? colors.green : colors.red);

      if (dbStats.byStrategy.length > 0) {
        log('');
        log('   Par stratégie:', colors.bright);
        dbStats.byStrategy.forEach(s => {
          log(`     ${s.strategy}: ${s.count} trades, avg $${(s.avgProfit || 0).toFixed(2)}`, colors.cyan);
        });
      }
      log('');
    }
  } catch (error) {
    log(`⚠️ Erreur lors de la lecture de la database: ${error.message}`, colors.yellow);
  }

  // Prochaine vérification
  const nextCheck = new Date(Date.now() + CONFIG.checkIntervalMinutes * 60 * 1000);
  log(`⏰ Prochaine vérification: ${nextCheck.toLocaleString('fr-FR')}`, colors.magenta);
  log('═══════════════════════════════════════════════════════════', colors.cyan);
  log('');

  // Sauvegarder le résumé
  const summary = {
    timestamp: new Date().toISOString(),
    logAnalysis,
    nextCheck: nextCheck.toISOString()
  };

  try {
    fs.writeFileSync(CONFIG.summaryFile, JSON.stringify(summary, null, 2));
  } catch (error) {
    log(`⚠️ Erreur lors de la sauvegarde du résumé: ${error.message}`, colors.yellow);
  }
}

// Fonction principale
async function main() {
  log('🚀 Démarrage du monitoring automatique des positions', colors.bright + colors.green);
  log(`📊 Intervalle: ${CONFIG.checkIntervalMinutes} minutes`, colors.cyan);
  log(`📁 Logs: ${CONFIG.logFile}`, colors.cyan);
  log('');

  // Créer le dossier logs si nécessaire
  const logsDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Générer le premier rapport immédiatement
  await generateReport();

  // Puis générer un rapport toutes les heures
  setInterval(async () => {
    await generateReport();
  }, CONFIG.checkIntervalMinutes * 60 * 1000);

  // Garder le processus actif
  log('✅ Monitoring actif. Appuyez sur Ctrl+C pour arrêter.', colors.green);
  log('');
}

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  log('', colors.reset);
  log('🛑 Arrêt du monitoring...', colors.yellow);
  log('✅ Monitoring arrêté.', colors.green);
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('', colors.reset);
  log('🛑 Arrêt du monitoring...', colors.yellow);
  log('✅ Monitoring arrêté.', colors.green);
  process.exit(0);
});

// Lancer le script
main().catch(error => {
  log(`❌ Erreur fatale: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
