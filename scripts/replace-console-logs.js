#!/usr/bin/env node

/**
 * Script to replace console.log/error/warn with logger equivalents
 * 
 * Usage: node scripts/replace-console-logs.js [--dry-run] [--file=path]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_FILE = process.argv.find(arg => arg.startsWith('--file='))?.split('=')[1];

// Files to exclude (system files, third-party, etc.)
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next\//, // Next.js build artifacts
  /package-lock\.json/,
  /\.log$/,
  /scripts\/replace-console-logs\.js$/, // Don't modify this script
  /start-shadow-mode\.js$/, // Has intentional console.log for user interaction
  /broolykid-mvp/, // Separate project
  /young-mother-earth/, // Separate project
];

// Console methods to replace
const REPLACEMENTS = [
  { pattern: /console\.log\(/g, replacement: 'logger.info(' },
  { pattern: /console\.error\(/g, replacement: 'logger.error(' },
  { pattern: /console\.warn\(/g, replacement: 'logger.warn(' },
  { pattern: /console\.info\(/g, replacement: 'logger.info(' },
  { pattern: /console\.debug\(/g, replacement: 'logger.debug(' },
];

// Special cases where console should remain (error handlers, user interaction)
const PRESERVE_PATTERNS = [
  /process\.stdout\.on\('error'/,
  /process\.stderr\.on\('error'/,
  /console\.error\('\[STD/,
  /readline\.createInterface/,
  /rl\.question/,
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function shouldPreserve(line) {
  return PRESERVE_PATTERNS.some(pattern => pattern.test(line));
}

function processFile(filePath) {
  if (shouldExclude(filePath)) {
    return { skipped: true, reason: 'excluded' };
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    const lines = content.split('\n');
    let changes = 0;
    let preserved = 0;

    // Check if logger is already imported
    const hasLoggerImport = /require\(['"]\.\.?\/logger['"]\)|import.*logger/.test(content);
    
    // Process each line
    const newLines = lines.map((line, index) => {
      // Skip if line should be preserved
      if (shouldPreserve(line)) {
        preserved++;
        return line;
      }

      let modifiedLine = line;
      REPLACEMENTS.forEach(({ pattern, replacement }) => {
        if (pattern.test(modifiedLine)) {
          modifiedLine = modifiedLine.replace(pattern, replacement);
          changes++;
        }
      });

      return modifiedLine;
    });

    if (changes === 0) {
      return { skipped: true, reason: 'no changes' };
    }

    // Add logger import if needed and not present
    if (!hasLoggerImport && changes > 0) {
      // Find the best place to add logger import (after other requires)
      const requireLines = newLines.findIndex(line => /^const.*require\(/.test(line));
      if (requireLines >= 0) {
        // Find last require line
        let lastRequireIndex = requireLines;
        for (let i = requireLines; i < newLines.length; i++) {
          if (/^const.*require\(/.test(newLines[i])) {
            lastRequireIndex = i;
          } else if (lastRequireIndex < i && newLines[i].trim() !== '') {
            break;
          }
        }
        newLines.splice(lastRequireIndex + 1, 0, "const logger = require('./logger');");
      } else {
        // Add at top if no requires found
        newLines.unshift("const logger = require('./logger');");
      }
    }

    const newContent = newLines.join('\n');

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }

    return {
      skipped: false,
      changes,
      preserved,
      filePath
    };
  } catch (error) {
    return {
      skipped: true,
      reason: 'error',
      error: error.message
    };
  }
}

function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldExclude(filePath)) {
        findJsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') && !shouldExclude(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  console.log('🔍 Finding JavaScript files...\n');

  let files;
  if (SPECIFIC_FILE) {
    files = [path.resolve(SPECIFIC_FILE)];
  } else {
    files = findJsFiles(process.cwd());
  }

  console.log(`Found ${files.length} JavaScript files\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  const results = {
    processed: 0,
    changed: 0,
    skipped: 0,
    errors: 0,
    totalChanges: 0,
    totalPreserved: 0
  };

  files.forEach(file => {
    const result = processFile(file);
    
    if (result.skipped) {
      results.skipped++;
    } else if (result.error) {
      results.errors++;
      console.error(`❌ Error processing ${file}: ${result.error}`);
    } else {
      results.processed++;
      results.changed++;
      results.totalChanges += result.changes;
      results.totalPreserved += result.preserved;
      console.log(`✅ ${file}: ${result.changes} changes, ${result.preserved} preserved`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files processed: ${results.processed}`);
  console.log(`Files changed: ${results.changed}`);
  console.log(`Files skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`Total replacements: ${results.totalChanges}`);
  console.log(`Total preserved: ${results.totalPreserved}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

main();

