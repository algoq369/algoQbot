#!/bin/bash

# MetaBase BI Dashboard Launcher
# Starts the MetaBase server

echo "🚀 Launching MetaBase Business Intelligence Dashboard..."
echo ""
echo "MetaBase will be available at: http://localhost:3000"
echo "First-time setup will walk you through configuration"
echo ""
echo "Press CTRL+C to stop MetaBase"
echo ""

cd "$(dirname "$0")"

if [ ! -f metabase.jar ]; then
    echo "❌ MetaBase not found. Downloading..."
    curl -L -o metabase.jar https://downloads.metabase.com/latest/metabase.jar
    echo "✅ Download complete!"
fi

java -jar metabase.jar
