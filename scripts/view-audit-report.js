#!/usr/bin/env node

/**
 * Audit Report Viewer
 * Beautiful visualization of JSON audit report
 */

const fs = require('fs').promises;
const path = require('path');

async function viewAuditReport() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║         📊 AUDIT REPORT VIEWER                            ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Find latest audit report
    const reportsDir = './reports';
    const files = await fs.readdir(reportsDir);
    const auditFiles = files.filter(f => f.startsWith('audit-'));

    if (auditFiles.length === 0) {
      console.log('⚠️  No audit reports found\n');
      return;
    }

    const latestFile = auditFiles.sort().reverse()[0];
    console.log(`📂 Loading: ${latestFile}\n`);

    const reportPath = path.join(reportsDir, latestFile);
    const reportData = await fs.readFile(reportPath, 'utf8');
    const report = JSON.parse(reportData);

    // Display report sections
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 REPORT METADATA');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Audit Time: ${new Date(report.audit_time).toLocaleString()}`);
    console.log(`Period Start: ${new Date(report.period.start).toLocaleString()}`);
    console.log(`Period End: ${new Date(report.period.end).toLocaleString()}\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 TRADING SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Total Trades: ${report.trades.total}`);
    console.log(`Winners: ${report.trades.winners}`);
    console.log(`Losers: ${report.trades.losers}`);
    console.log(`Win Rate: ${report.trades.win_rate}%`);
    console.log(`Total P&L: $${report.trades.total_pnl}\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 POSITION STATUS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Open Positions: ${report.positions.open}\n`);

    if (report.positions.details && report.positions.details.length > 0) {
      console.log('Position Details:');
      report.positions.details.forEach((pos, i) => {
        console.log(`   ${i + 1}. ${pos.id}`);
        console.log(`      Side: ${pos.side}`);
        console.log(`      Age: ${pos.age_hours}h`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 KEY INSIGHTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (report.insights && report.insights.length > 0) {
      report.insights.forEach((insight, i) => {
        console.log(`${insight.type}: ${insight.message}`);
        console.log(`   → ${insight.recommendation}\n`);
      });
    } else {
      console.log('No insights available\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RAW JSON DATA');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(JSON.stringify(report, null, 2));
    console.log('');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║             REPORT VIEWING COMPLETE                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Failed to view report:', error);
  }
}

viewAuditReport();
