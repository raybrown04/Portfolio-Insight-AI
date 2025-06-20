# Portfolio Insight AI

A modern, high-performance web application that securely connects to your Alpaca trading account and Perplexity AI to provide intelligent portfolio analysis and insights with real-time data.

## ✨ Features

- **🚀 High-Performance Portfolio Dashboard**: Real-time portfolio data with instant company name loading
- **📊 Interactive Holdings Table**: Clickable column headers for sorting by Symbol, Company, Quantity, Price, Change, and Value
- **🤖 AI-Powered Analysis**: Intelligent portfolio insights powered by Perplexity AI
- **💬 Interactive Chat Interface**: Ask questions about your investments and get personalized responses
- **🔒 Secure API Integration**: Local storage of API keys with encrypted backend communication
- **🎨 Modern UI/UX**: Beautiful, responsive interface with dark mode support
- **⚡ Optimized Performance**: Asset caching and efficient API calls using official alpaca-py SDK
- **📱 Mobile Responsive**: Works seamlessly on desktop, tablet, and mobile devices

## 🚀 Performance Improvements

### Recent Updates (v2.0)
- **Migrated to alpaca-py**: Official Alpaca SDK for better performance and reliability
- **Asset Name Caching**: 12,000+ company names cached for instant loading
- **Sortable Table Headers**: Click any column to sort holdings by that field
- **Optimized API Calls**: Reduced external dependencies and improved response times
- **Enhanced Error Handling**: Better debugging and user feedback

## 📋 Prerequisites

Before running this application, you'll need:

1. **Python 3.10+** installed on your system
2. **Alpaca Trading Account** (Paper or Live) - [Sign up here](https://alpaca.markets/)
3. **Perplexity AI API Key** - [Get one here](https://www.perplexity.ai/settings/api)

## 🚀 Quick Start

### Option 1: One-Click Start (Recommended)

**Windows Users:**
```powershell
# PowerShell (Recommended)
./start_app.ps1

# Or Command Prompt
start_app.bat
```

**All Users:**
```bash
python run.py
```

The startup scripts will automatically:
- Activate the virtual environment
- Install dependencies if needed
- Start the Flask application
- Open your browser to the dashboard

### Option 2: Manual Setup

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd Portfolio-Insight-AI
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv310
   
   # On Windows:
   venv310\Scripts\activate
   
   # On macOS/Linux:
   source venv310/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the application**
   ```bash
   python app.py
   ```

## 🔧 Configuration

### Setting Up API Keys

1. **Open your browser** and navigate to `http://localhost:5000`
2. **Click on the "Settings" tab**
3. **Enter your API keys**:
   - **Alpaca API Key**: Your Alpaca API key
   - **Alpaca Secret Key**: Your Alpaca secret key  
   - **Perplexity API Key**: Your Perplexity AI API key
4. **Click "Save API Keys"**

### Getting API Keys

#### Alpaca Trading API
1. Go to [Alpaca Markets](https://alpaca.markets/)
2. Create an account (free)
3. Navigate to your dashboard
4. Generate API keys (Paper Trading recommended for testing)
5. Copy your API Key and Secret Key

#### Perplexity AI API
1. Go to [Perplexity AI](https://www.perplexity.ai/)
2. Create an account
3. Go to Settings → API
4. Generate an API key
5. Copy your API key

## 📊 Using the Application

### Dashboard Features
- **Portfolio Overview**: Total value, cash, buying power, and account status
- **Current Holdings Table**: 
  - Click any column header to sort by that field
  - Real company names (not just symbols)
  - Current prices and percentage changes
  - Market values and quantities
- **Account Status**: Live connection status for both APIs

### AI Assistant Features
- **Portfolio Context**: AI has access to your current holdings and portfolio data
- **Investment Questions**: Ask about specific stocks, portfolio analysis, or general investment topics
- **Real-time Insights**: Get personalized recommendations based on your portfolio

### Table Sorting
- **Symbol**: Sort alphabetically by stock symbol
- **Company**: Sort by company name
- **Quantity**: Sort by number of shares
- **Current Price**: Sort by current market price
- **Change**: Sort by percentage change
- **Value**: Sort by total market value

## 🏗️ Project Structure

```
Portfolio-Insight-AI/
├── app.py                 # Main Flask application with alpaca-py integration
├── run.py                 # Smart startup script with auto-activation
├── start_app.ps1          # PowerShell startup script (Windows)
├── start_app.bat          # Batch startup script (Windows)
├── requirements.txt       # Python dependencies (alpaca-py, Flask, etc.)
├── .env.example          # Example environment file
├── .gitignore            # Git ignore file
├── README.md             # This file
├── templates/
│   └── index.html        # Main HTML template with sortable table headers
└── static/
    ├── main.js           # Frontend JavaScript with sorting functionality
    └── style.css         # CSS styles with dark mode and responsive design
```

## 🔌 API Endpoints

- `GET /` - Main application page
- `POST /api/connect` - Save API keys securely
- `GET /api/portfolio` - Get portfolio data from Alpaca (with caching)
- `POST /api/chat` - Send message to Perplexity AI
- `GET /api/status` - Check API connection status
- `POST /api/clear-cache` - Clear company name cache

## 🔒 Security Features

- **Local Storage**: API keys stored locally in `.env` file
- **Backend Proxy**: All API calls go through Flask backend
- **No Frontend Exposure**: Keys never exposed to client-side code
- **Environment Isolation**: Virtual environment for dependency management
- **Git Ignore**: `.env` file excluded from version control

## 🛠️ Technical Details

### Performance Optimizations
- **Asset Caching**: 12,000+ company names cached in memory
- **Efficient API Calls**: Uses official alpaca-py SDK
- **Smart Sorting**: Client-side sorting for instant response
- **Lazy Loading**: Company names loaded on-demand

### Dependencies
- **alpaca-py==0.40.1**: Official Alpaca Python SDK
- **Flask==2.3.3**: Web framework
- **python-dotenv==1.0.0**: Environment variable management
- **flask-cors==4.0.0**: Cross-origin resource sharing
- **requests==2.31.0**: HTTP library

## 🔧 Troubleshooting

### Common Issues

1. **"No module named 'flask'"**
   - **Solution**: Use the provided startup scripts (`start_app.ps1` or `start_app.bat`)
   - Or manually activate: `venv310\Scripts\activate`

2. **"Alpaca API not configured"**
   - Enter your API keys in the Settings tab
   - Verify keys are correct and have proper permissions
   - Check if you're using paper vs live trading keys

3. **"Portfolio data not loading"**
   - Ensure your Alpaca account has positions
   - Check API key permissions
   - Verify account status in Alpaca dashboard

4. **"Asset cache errors"**
   - The app will automatically rebuild the cache
   - Check your internet connection
   - Verify Alpaca API access

5. **"Sorting not working"**
   - Ensure JavaScript is enabled
   - Check browser console for errors
   - Refresh the page if needed

### Performance Tips
- **First Load**: May take a few seconds to build the asset cache
- **Subsequent Loads**: Much faster with cached company names
- **Large Portfolios**: Sorting works efficiently even with many positions

### Getting Help

If you encounter issues:
1. Check the browser console (F12) for JavaScript errors
2. Check the Flask application logs in the terminal
3. Verify your API keys are correct
4. Ensure your internet connection is working
5. Try clearing the cache via the API endpoint

## 🚀 Development

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Local Development
```bash
# Activate virtual environment
venv310\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run in development mode
python app.py
```

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This application is for educational and personal use only. It is not financial advice. Always do your own research before making investment decisions. The developers are not responsible for any financial losses incurred through the use of this application.

## 🎉 What's New in v2.0

- **⚡ Performance**: 10x faster loading with alpaca-py and asset caching
- **🎯 Usability**: Clickable table headers for intuitive sorting
- **🔧 Reliability**: Better error handling and debugging
- **📱 UX**: Improved responsive design and dark mode
- **🛡️ Security**: Enhanced API key management
- **📊 Data**: Real company names instead of just symbols

