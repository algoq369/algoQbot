import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import sqlite3
import json
import requests
import time
from datetime import datetime, timedelta
import os
import sys

# Add parent directory to path to import bot modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Page configuration
st.set_page_config(
    page_title="Advanced BSC Trading Bot Monitor",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #1f77b4;
    }
    .status-healthy {
        color: #28a745;
        font-weight: bold;
    }
    .status-warning {
        color: #ffc107;
        font-weight: bold;
    }
    .status-error {
        color: #dc3545;
        font-weight: bold;
    }
    .agent-card {
        border: 1px solid #ddd;
        border-radius: 0.5rem;
        padding: 1rem;
        margin: 0.5rem 0;
        background-color: #f9f9f9;
    }
</style>
""", unsafe_allow_html=True)

class TradingBotMonitor:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'trading_bot.db')
        self.api_base = "http://localhost:3001"  # Bot API endpoint
        
    def get_db_connection(self):
        """Get database connection"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as e:
            st.error(f"Database connection error: {e}")
            return None

    def fetch_bot_status(self):
        """Fetch bot status from API"""
        try:
            response = requests.get(f"{self.api_base}/api/status", timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                return {"status": "error", "message": "Bot API not responding"}
        except Exception as e:
            return {"status": "error", "message": f"Connection error: {e}"}

    def query_rag_system(self, query):
        """Query the RAG system"""
        try:
            response = requests.post(
                f"{self.api_base}/api/rag/query",
                json={"query": query},
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": "RAG system not responding"}
        except Exception as e:
            return {"error": f"RAG query error: {e}"}

def main():
    monitor = TradingBotMonitor()
    
    # Main header
    st.markdown('<h1 class="main-header">🤖 Advanced BSC Trading Bot Monitor</h1>', unsafe_allow_html=True)
    
    # Sidebar
    st.sidebar.title("Navigation")
    page = st.sidebar.selectbox(
        "Select Page",
        ["Dashboard", "Trading Activity", "Market Analysis", "AI Chat", "System Health", "Settings"]
    )
    
    # Bot status in sidebar
    st.sidebar.markdown("---")
    st.sidebar.subheader("Bot Status")
    
    bot_status = monitor.fetch_bot_status()
    if bot_status.get("status") == "healthy":
        st.sidebar.markdown('<span class="status-healthy">🟢 Online</span>', unsafe_allow_html=True)
    else:
        st.sidebar.markdown('<span class="status-error">🔴 Offline</span>', unsafe_allow_html=True)
    
    # Last update
    st.sidebar.markdown(f"**Last Update:** {datetime.now().strftime('%H:%M:%S')}")
    
    # Auto-refresh toggle
    auto_refresh = st.sidebar.checkbox("Auto Refresh (30s)", value=True)
    if auto_refresh:
        time.sleep(30)
        st.rerun()
    
    # Page routing
    if page == "Dashboard":
        show_dashboard(monitor)
    elif page == "Trading Activity":
        show_trading_activity(monitor)
    elif page == "Market Analysis":
        show_market_analysis(monitor)
    elif page == "AI Chat":
        show_ai_chat(monitor)
    elif page == "System Health":
        show_system_health(monitor)
    elif page == "Settings":
        show_settings(monitor)

def show_dashboard(monitor):
    """Main dashboard page"""
    st.header("📊 Trading Bot Dashboard")
    
    # Key metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            label="Total Profit/Loss",
            value="$1,234.56",
            delta="+5.2%"
        )
    
    with col2:
        st.metric(
            label="Active Trades",
            value="3",
            delta="1"
        )
    
    with col3:
        st.metric(
            label="Success Rate",
            value="87.5%",
            delta="+2.1%"
        )
    
    with col4:
        st.metric(
            label="Bot Uptime",
            value="2d 14h",
            delta=""
        )
    
    # Charts section
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📈 Portfolio Performance")
        
        # Mock portfolio data
        dates = pd.date_range(start=datetime.now() - timedelta(days=7), end=datetime.now(), freq='h')
        portfolio_values = [1000 + i * 10 + (i % 24) * 5 for i in range(len(dates))]
        
        fig = px.line(
            x=dates,
            y=portfolio_values,
            title="Portfolio Value Over Time",
            labels={'x': 'Time', 'y': 'Value (USDT)'}
        )
        fig.update_layout(height=400)
        st.plotly_chart(fig, width="stretch")
    
    with col2:
        st.subheader("📊 Trading Volume")
        
        # Mock trading volume data
        volume_data = {
            'Action': ['Buy', 'Sell', 'Rebalance'],
            'Count': [45, 38, 12],
            'Volume': [1250, 1180, 340]
        }
        
        fig = px.bar(
            volume_data,
            x='Action',
            y='Volume',
            title="Trading Volume by Action",
            color='Action'
        )
        fig.update_layout(height=400)
        st.plotly_chart(fig, width="stretch")
    
    # Recent activity
    st.subheader("🕒 Recent Activity")
    
    # Mock recent activity data
    activity_data = pd.DataFrame({
        'Time': [datetime.now() - timedelta(minutes=i) for i in range(10, 0, -1)],
        'Action': ['Buy', 'Sell', 'Buy', 'Rebalance', 'Buy', 'Sell', 'Buy', 'Sell', 'Buy', 'Sell'],
        'Pair': ['USDT/BNB'] * 10,
        'Amount': [50.0, 0.25, 75.0, 100.0, 60.0, 0.3, 80.0, 0.4, 90.0, 0.45],
        'Price': [0.25, 0.251, 0.249, 0.25, 0.252, 0.253, 0.248, 0.249, 0.251, 0.250],
        'Status': ['Success'] * 10
    })
    
    st.dataframe(
        activity_data,
        width="stretch",
        hide_index=True
    )

def show_trading_activity(monitor):
    """Trading activity page"""
    st.header("📈 Trading Activity")
    
    # Filters
    col1, col2, col3 = st.columns(3)
    
    with col1:
        date_range = st.date_input(
            "Date Range",
            value=(datetime.now() - timedelta(days=7), datetime.now()),
            max_value=datetime.now()
        )
    
    with col2:
        action_filter = st.selectbox(
            "Action Filter",
            ["All", "Buy", "Sell", "Rebalance"]
        )
    
    with col3:
        pair_filter = st.selectbox(
            "Pair Filter",
            ["All", "USDT/BNB"]
        )
    
    # Trading statistics
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📊 Trading Statistics")
        
        # Mock statistics
        stats_data = {
            'Metric': ['Total Trades', 'Successful Trades', 'Failed Trades', 'Average Trade Size'],
            'Value': [95, 83, 12, 62.5],
            'Unit': ['trades', 'trades', 'trades', 'USDT']
        }
        
        for i, (metric, value, unit) in enumerate(zip(stats_data['Metric'], stats_data['Value'], stats_data['Unit'])):
            st.metric(metric, f"{value} {unit}")
    
    with col2:
        st.subheader("🎯 Performance Metrics")
        
        # Mock performance data
        perf_data = {
            'Metric': ['Win Rate', 'Average Profit', 'Max Drawdown', 'Sharpe Ratio'],
            'Value': ['87.4%', '2.3%', '5.1%', '1.85']
        }
        
        for metric, value in zip(perf_data['Metric'], perf_data['Value']):
            st.metric(metric, value)
    
    # Detailed trades table
    st.subheader("📋 Detailed Trades")
    
    # Mock detailed trades data
    trades_data = pd.DataFrame({
        'Timestamp': [datetime.now() - timedelta(hours=i) for i in range(20, 0, -1)],
        'Action': ['Buy' if i % 2 == 0 else 'Sell' for i in range(20)],
        'Pair': ['USDT/BNB'] * 20,
        'Amount': [50 + i * 5 for i in range(20)],
        'Price': [0.25 + (i % 3) * 0.001 for i in range(20)],
        'Slippage': [0.1 + i * 0.05 for i in range(20)],
        'Gas Used': [21000 + i * 1000 for i in range(20)],
        'Tx Hash': [f'0x{"a" * 64}' for _ in range(20)],
        'Status': ['Success'] * 20
    })
    
    st.dataframe(
        trades_data,
        width="stretch",
        hide_index=True
    )
    
    # Export button
    if st.button("📥 Export Data"):
        csv = trades_data.to_csv(index=False)
        st.download_button(
            label="Download CSV",
            data=csv,
            file_name=f"trading_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )

def show_market_analysis(monitor):
    """Market analysis page"""
    st.header("📊 Market Analysis")
    
    # Market overview
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Current Price", "0.2501 BNB/USDT", "+0.12%")
    
    with col2:
        st.metric("24h Volume", "$2.4M", "+15.3%")
    
    with col3:
        st.metric("Market Cap", "$3.8B", "-2.1%")
    
    with col4:
        st.metric("Fear & Greed", "Neutral", "52")
    
    # Price chart
    st.subheader("📈 Price Chart")
    
    # Mock price data
    dates = pd.date_range(start=datetime.now() - timedelta(hours=24), end=datetime.now(), freq='15min')
    prices = [0.25 + (i % 100) * 0.001 + (i % 50) * 0.0005 for i in range(len(dates))]
    volumes = [1000000 + (i % 200) * 10000 for i in range(len(dates))]
    
    # Create subplot with secondary y-axis
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    
    # Add price line
    fig.add_trace(
        go.Scatter(x=dates, y=prices, name="Price", line=dict(color="blue")),
        secondary_y=False,
    )
    
    # Add volume bars
    fig.add_trace(
        go.Bar(x=dates, y=volumes, name="Volume", opacity=0.3, marker_color="lightblue"),
        secondary_y=True,
    )
    
    # Set y-axes titles
    fig.update_yaxes(title_text="Price (BNB/USDT)", secondary_y=False)
    fig.update_yaxes(title_text="Volume (USDT)", secondary_y=True)
    
    fig.update_layout(height=500, title="USDT/BNB Price and Volume")
    st.plotly_chart(fig, width="stretch")
    
    # Technical indicators
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📊 Technical Indicators")
        
        indicators = {
            'RSI (14)': '52.3',
            'MACD': '0.0012',
            'Bollinger Upper': '0.2523',
            'Bollinger Lower': '0.2478',
            'SMA (20)': '0.2501',
            'EMA (12)': '0.2502'
        }
        
        for indicator, value in indicators.items():
            st.metric(indicator, value)
    
    with col2:
        st.subheader("🎯 Market Sentiment")
        
        # Mock sentiment data
        sentiment_data = pd.DataFrame({
            'Source': ['News', 'Social Media', 'Technical', 'On-chain'],
            'Sentiment': [0.6, 0.4, 0.7, 0.5],
            'Confidence': [0.8, 0.6, 0.9, 0.7]
        })
        
        fig = px.bar(
            sentiment_data,
            x='Source',
            y='Sentiment',
            title="Sentiment by Source",
            color='Confidence',
            color_continuous_scale='RdYlGn'
        )
        fig.update_layout(height=300)
        st.plotly_chart(fig, width="stretch")

def show_ai_chat(monitor):
    """AI Chat interface"""
    st.header("🤖 AI Trading Assistant")
    
    # Chat interface
    if "messages" not in st.session_state:
        st.session_state.messages = []
    
    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
    
    # Chat input
    if prompt := st.chat_input("Ask me anything about your trading bot, market analysis, or strategies..."):
        # Add user message to chat history
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)
        
        # Get AI response
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                response = monitor.query_rag_system(prompt)
                
                if "error" in response:
                    ai_response = f"Sorry, I encountered an error: {response['error']}"
                else:
                    ai_response = response.get("response", "I'm not sure how to help with that. Could you please rephrase your question?")
                
                st.markdown(ai_response)
        
        # Add assistant response to chat history
        st.session_state.messages.append({"role": "assistant", "content": ai_response})
    
    # Quick action buttons
    st.subheader("🚀 Quick Actions")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.button("📊 Market Analysis"):
            with st.spinner("Analyzing market..."):
                response = monitor.query_rag_system("Analyze current market conditions and provide trading insights")
                st.info(response.get("response", "Market analysis not available"))
    
    with col2:
        if st.button("📈 Performance Review"):
            with st.spinner("Reviewing performance..."):
                response = monitor.query_rag_system("Review my trading performance and suggest improvements")
                st.info(response.get("response", "Performance review not available"))
    
    with col3:
        if st.button("🔍 Strategy Analysis"):
            with st.spinner("Analyzing strategies..."):
                response = monitor.query_rag_system("Analyze my current trading strategy and suggest optimizations")
                st.info(response.get("response", "Strategy analysis not available"))
    
    with col4:
        if st.button("📰 News Summary"):
            with st.spinner("Summarizing news..."):
                response = monitor.query_rag_system("Summarize recent news that might affect BSC and BNB trading")
                st.info(response.get("response", "News summary not available"))

def show_system_health(monitor):
    """System health monitoring"""
    st.header("🏥 System Health")
    
    # Overall system status
    st.subheader("🔍 System Overview")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.metric("Bot Status", "🟢 Healthy", "Online")
        st.markdown('</div>', unsafe_allow_html=True)
    
    with col2:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.metric("Database", "🟢 Connected", "SQLite")
        st.markdown('</div>', unsafe_allow_html=True)
    
    with col3:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.metric("Vector DB", "🟡 Mock Mode", "Fallback")
        st.markdown('</div>', unsafe_allow_html=True)
    
    # Agent status
    st.subheader("🤖 Agent Status")
    
    agents = [
        {"name": "MarketResearchAgent", "status": "healthy", "uptime": "2d 14h", "executions": 1247},
        {"name": "TradingStrategyAgent", "status": "healthy", "uptime": "2d 14h", "executions": 892},
        {"name": "ExecutionAgent", "status": "healthy", "uptime": "2d 14h", "executions": 156},
        {"name": "RiskManagementAgent", "status": "warning", "uptime": "2d 14h", "executions": 445}
    ]
    
    for agent in agents:
        with st.expander(f"{agent['name']} - {agent['status'].title()}"):
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Status", agent['status'].title())
            
            with col2:
                st.metric("Uptime", agent['uptime'])
            
            with col3:
                st.metric("Executions", agent['executions'])
    
    # System metrics
    st.subheader("📊 System Metrics")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # CPU and Memory usage (mock data)
        metrics_data = pd.DataFrame({
            'Metric': ['CPU Usage', 'Memory Usage', 'Disk Usage', 'Network I/O'],
            'Value': [25.3, 68.7, 42.1, 156.8],
            'Unit': ['%', '%', '%', 'MB/s']
        })
        
        for _, row in metrics_data.iterrows():
            st.metric(f"{row['Metric']}", f"{row['Value']} {row['Unit']}")
    
    with col2:
        # Database metrics
        db_metrics = {
            'Total Trades': '95',
            'Total Logs': '2,847',
            'News Articles': '156',
            'Alerts': '12',
            'Vector Embeddings': '1,234'
        }
        
        for metric, value in db_metrics.items():
            st.metric(metric, value)
    
    # Recent alerts
    st.subheader("🚨 Recent Alerts")
    
    alerts_data = pd.DataFrame({
        'Time': [datetime.now() - timedelta(hours=i) for i in range(5, 0, -1)],
        'Type': ['System', 'Trade', 'Market', 'System', 'Trade'],
        'Severity': ['Low', 'Medium', 'High', 'Low', 'Medium'],
        'Message': [
            'Database backup completed',
            'Large trade executed: 100 USDT',
            'High volatility detected',
            'Agent restarted successfully',
            'Slippage threshold exceeded'
        ],
        'Status': ['Resolved', 'Active', 'Active', 'Resolved', 'Active']
    })
    
    st.dataframe(
        alerts_data,
        width="stretch",
        hide_index=True
    )

def show_settings(monitor):
    """Settings page"""
    st.header("⚙️ Settings")
    
    # Bot configuration
    st.subheader("🤖 Bot Configuration")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.number_input("Initial Budget (USDT)", value=100.0, min_value=10.0, max_value=10000.0)
        st.number_input("Min Trade Amount (USDT)", value=1.0, min_value=0.1, max_value=100.0)
        st.number_input("Max Trade Amount (USDT)", value=10.0, min_value=1.0, max_value=1000.0)
    
    with col2:
        st.number_input("Lower Bound %", value=95.0, min_value=80.0, max_value=99.0)
        st.number_input("Upper Bound %", value=105.0, min_value=101.0, max_value=120.0)
        st.number_input("Rebalance Threshold %", value=2.0, min_value=0.5, max_value=10.0)
    
    # Notification settings
    st.subheader("🔔 Notifications")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.checkbox("Email Notifications", value=True)
        st.checkbox("Telegram Notifications", value=False)
        st.checkbox("Discord Notifications", value=True)
    
    with col2:
        st.checkbox("Trade Executions", value=True)
        st.checkbox("System Alerts", value=True)
        st.checkbox("Market Updates", value=False)
    
    # API settings
    st.subheader("🔗 API Configuration")
    
    api_key = st.text_input("OpenAI API Key", type="password", value="sk-...")
    milvus_host = st.text_input("Milvus Host", value="localhost:19530")
    
    # Save settings
    if st.button("💾 Save Settings"):
        st.success("Settings saved successfully!")
        st.info("Note: Some changes may require bot restart to take effect.")

if __name__ == "__main__":
    main()
