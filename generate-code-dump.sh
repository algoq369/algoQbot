#!/bin/bash

# Generate Complete Code Dump Script
# This script creates a single file containing all JavaScript code from algoQbot

OUTPUT_FILE="algoQbot-complete-code-dump.txt"
TEMP_DIR=$(mktemp -d)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  algoQbot - Complete Code Dump Generator                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Generating complete code dump..."
echo "Output file: $OUTPUT_FILE"
echo ""

# Create header
cat > "$OUTPUT_FILE" << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║  algoQbot - Complete Code Dump                              ║
║  Generated: $(date)                                          ║
╚══════════════════════════════════════════════════════════════╝

This file contains all JavaScript code from the algoQbot project.
Files are organized by directory structure.

═══════════════════════════════════════════════════════════════
TABLE OF CONTENTS
═══════════════════════════════════════════════════════════════

EOF

# Find all JS files and create table of contents
echo "Creating table of contents..."
find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./web/*" ! -path "./broolykid-mvp/*" ! -path "./backups/*" ! -path "./.specstory/*" | sort | while read file; do
    lines=$(wc -l < "$file" 2>/dev/null || echo "0")
    echo "  $file ($lines lines)" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
echo "CODE FILES" >> "$OUTPUT_FILE"
echo "═══════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Append all code files
echo "Appending code files..."
find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./web/*" ! -path "./broolykid-mvp/*" ! -path "./backups/*" ! -path "./.specstory/*" | sort | while read file; do
    echo "Processing: $file"
    echo "" >> "$OUTPUT_FILE"
    echo "═══════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
    echo "FILE: $file" >> "$OUTPUT_FILE"
    echo "═══════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE" 2>/dev/null
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

# Update header with actual date
sed -i.bak "s/\$(date)/$(date)/" "$OUTPUT_FILE" 2>/dev/null || sed -i "s/\$(date)/$(date)/" "$OUTPUT_FILE"
rm -f "$OUTPUT_FILE.bak" 2>/dev/null

# Get final stats
TOTAL_LINES=$(wc -l < "$OUTPUT_FILE")
TOTAL_FILES=$(find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./web/*" ! -path "./broolykid-mvp/*" ! -path "./backups/*" ! -path "./.specstory/*" | wc -l)

echo ""
echo "✅ Code dump complete!"
echo ""
echo "Statistics:"
echo "  Total files: $TOTAL_FILES"
echo "  Total lines: $TOTAL_LINES"
echo "  Output file: $OUTPUT_FILE"
echo ""
echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "To view the dump:"
echo "  less $OUTPUT_FILE"
echo "  cat $OUTPUT_FILE | less"
echo "  head -n 1000 $OUTPUT_FILE  # First 1000 lines"
echo ""
