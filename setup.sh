#!/bin/bash

echo "🤖 Advanced BSC Trading Bot Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Check if Python is installed (for Streamlit)
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8+ first."
    echo "Visit: https://www.python.org/"
    exit 1
fi

print_status "Python version: $(python3 --version)"

# Create necessary directories
print_header "Creating project directories..."
mkdir -p data
mkdir -p logs
mkdir -p monitoring
print_status "Directories created successfully"

# Install Node.js dependencies
print_header "Installing Node.js dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_status "Node.js dependencies installed successfully"
else
    print_error "Failed to install Node.js dependencies"
    exit 1
fi

# Install Python dependencies for monitoring
print_header "Installing Python dependencies for monitoring..."
cd monitoring
pip3 install -r requirements.txt
if [ $? -eq 0 ]; then
    print_status "Python dependencies installed successfully"
else
    print_warning "Failed to install Python dependencies. You may need to install them manually:"
    echo "pip3 install streamlit pandas plotly requests"
fi
cd ..

# Setup database
print_header "Setting up database..."
npm run setup-db
if [ $? -eq 0 ]; then
    print_status "Database setup completed successfully"
else
    print_error "Failed to setup database"
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    cp env.example .env
    print_status ".env file created. Please edit it with your configuration."
    print_warning "IMPORTANT: Update the following in .env:"
    echo "  - WALLET_ADDRESS: Your BSC wallet address"
    echo "  - PRIVATE_KEY: Your wallet private key"
    echo "  - OPENAI_API_KEY: Your OpenAI API key (optional but recommended)"
    echo ""
fi

# Optional: Install Milvus for vector database
print_header "Vector Database Setup (Optional)"
echo "For advanced AI features, you can install Milvus vector database:"
echo ""
echo "Option 1: Docker (Recommended)"
echo "  docker run -d --name milvus-standalone \\"
echo "    -p 19530:19530 \\"
echo "    -p 9091:9091 \\"
echo "    -v \$(pwd)/volumes/milvus:/var/lib/milvus \\"
echo "    milvusdb/milvus:v2.3.0 \\"
echo "    milvus run standalone"
echo ""
echo "Option 2: Skip (Bot will work in mock mode)"
echo ""

read -p "Do you want to install Milvus via Docker? (y/N): " install_milvus
if [[ $install_milvus =~ ^[Yy]$ ]]; then
    if command -v docker &> /dev/null; then
        print_header "Installing Milvus with Docker..."
        docker run -d --name milvus-standalone \
            -p 19530:19530 \
            -p 9091:9091 \
            -v $(pwd)/volumes/milvus:/var/lib/milvus \
            milvusdb/milvus:v2.3.0 \
            milvus run standalone
        print_status "Milvus installed successfully"
    else
        print_error "Docker is not installed. Please install Docker first."
    fi
else
    print_status "Skipping Milvus installation. Bot will work in mock mode."
fi

# Create systemd service file (optional)
print_header "Creating systemd service (Optional)"
read -p "Do you want to create a systemd service for auto-start? (y/N): " create_service
if [[ $create_service =~ ^[Yy]$ ]]; then
    SERVICE_FILE="/etc/systemd/system/bsc-trading-bot.service"
    CURRENT_DIR=$(pwd)
    USER=$(whoami)
    
    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=BSC Advanced Trading Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/node $CURRENT_DIR/AdvancedTradingBot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable bsc-trading-bot
    print_status "Systemd service created and enabled"
    echo "To start the service: sudo systemctl start bsc-trading-bot"
    echo "To check status: sudo systemctl status bsc-trading-bot"
fi

# Final instructions
print_header "Setup Complete!"
echo ""
print_status "Your Advanced BSC Trading Bot is ready!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit .env file with your configuration:"
echo "   - Wallet address and private key"
echo "   - OpenAI API key (optional)"
echo "   - Trading parameters"
echo ""
echo "2. Start the bot:"
echo "   npm start"
echo ""
echo "3. Start the monitoring dashboard:"
echo "   npm run monitor"
echo "   (Then open http://localhost:8501 in your browser)"
echo ""
echo "4. API endpoints available at:"
echo "   http://localhost:3001/api/health"
echo ""
echo "📚 Documentation:"
echo "- Bot logs: tail -f logs/combined.log"
echo "- Database: data/trading_bot.db"
echo "- API docs: http://localhost:3001/api/health"
echo ""
echo "⚠️  Important Security Notes:"
echo "- Never share your private key"
echo "- Start with small amounts for testing"
echo "- Monitor the bot regularly"
echo "- Keep your .env file secure"
echo ""
print_status "Happy trading! 🚀"
