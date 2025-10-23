#!/bin/bash

# Trading Bot Dashboard Launcher
# Starts the Streamlit monitoring dashboard

echo "🚀 Launching BSC Trading Bot Dashboard..."
echo ""
echo "Dashboard will be available at: http://localhost:8501"
echo "Press CTRL+C to stop the dashboard"
echo ""

cd "$(dirname "$0")"
streamlit run monitoring/app.py
