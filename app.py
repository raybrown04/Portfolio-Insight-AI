import os
import json
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from alpaca.trading.client import TradingClient
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Global asset cache for symbol -> company name
asset_name_cache = {}
asset_cache_built = False

def build_asset_cache():
    global asset_name_cache, asset_cache_built
    if asset_cache_built:
        return
    trading_client = get_trading_client()
    if trading_client:
        try:
            # Get all assets - alpaca-py doesn't use status parameter
            assets = trading_client.get_all_assets()
            # Filter for active US equities
            asset_name_cache = {a.symbol: a.name for a in assets if a.name and a.status == 'active' and a.asset_class == 'us_equity'}
            asset_cache_built = True
            print(f"Asset cache built with {len(asset_name_cache)} companies")
        except Exception as e:
            print(f"Error building asset cache: {e}")
            asset_name_cache = {}
            asset_cache_built = False

def get_trading_client():
    """Get Alpaca Trading client if keys are configured"""
    api_key = os.getenv('ALPACA_API_KEY', '').strip()
    secret_key = os.getenv('ALPACA_SECRET_KEY', '').strip()
    base_url = os.getenv('ALPACA_BASE_URL', 'https://api.alpaca.markets')
    
    print(f"API Key present: {bool(api_key)}")
    print(f"Secret Key present: {bool(secret_key)}")
    print(f"Base URL: {base_url}")
    print(f"API Key length: {len(api_key) if api_key else 0}")
    print(f"Secret Key length: {len(secret_key) if secret_key else 0}")
    
    if api_key and secret_key:
        try:
            # Try with live trading first (since user has live trading keys)
            client = TradingClient(api_key, secret_key, paper=False)
            # Test the connection
            account = client.get_account()
            print(f"Successfully connected to Alpaca (Live Trading)")
            return client
        except Exception as e:
            print(f"Live trading failed: {str(e)}")
            try:
                # Try with paper trading as fallback
                client = TradingClient(api_key, secret_key, paper=True)
                account = client.get_account()
                print(f"Successfully connected to Alpaca (Paper Trading)")
                return client
            except Exception as e2:
                print(f"Paper trading also failed: {str(e2)}")
                return None
    return None

def get_data_client():
    """Get Alpaca Data client for market data"""
    api_key = os.getenv('ALPACA_API_KEY')
    secret_key = os.getenv('ALPACA_SECRET_KEY')
    
    if api_key and secret_key:
        return StockHistoricalDataClient(api_key, secret_key)
    return None

def get_company_name(symbol):
    """Get company name from Alpaca asset cache, fallback to formatted symbol."""
    if not asset_cache_built:
        build_asset_cache()
    return asset_name_cache.get(symbol, f"{symbol} Corporation")

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/api/connect', methods=['POST'])
def connect_apis():
    """Handle API key submission and store them securely"""
    try:
        data = request.get_json()
        alpaca_key = data.get('alpaca_key')
        alpaca_secret = data.get('alpaca_secret')
        perplexity_key = data.get('perplexity_key')
        
        if not all([alpaca_key, alpaca_secret, perplexity_key]):
            return jsonify({'error': 'All API keys are required'}), 400
        
        # Write to .env file
        env_content = f"""# Alpaca Trading API Keys
ALPACA_API_KEY="{alpaca_key}"
ALPACA_SECRET_KEY="{alpaca_secret}"
ALPACA_BASE_URL="https://api.alpaca.markets"

# Perplexity AI API Key
PERPLEXITY_API_KEY="{perplexity_key}"

# Flask Configuration
FLASK_ENV="development"
FLASK_DEBUG="True"
"""
        
        with open('.env', 'w') as f:
            f.write(env_content)
        
        # Reload environment variables
        load_dotenv(override=True)
        
        # Test Alpaca connection
        api = get_trading_client()
        if api:
            try:
                account = api.get_account()
                return jsonify({
                    'success': True,
                    'message': 'API keys saved successfully',
                    'account_status': 'connected',
                    'account_type': 'paper' if 'paper' in account.status else 'live'
                })
            except Exception as e:
                return jsonify({
                    'success': True,
                    'message': 'API keys saved, but Alpaca connection failed',
                    'error': str(e)
                }), 200
        else:
            return jsonify({'error': 'Failed to initialize Alpaca API'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to save API keys: {str(e)}'}), 500

@app.route('/api/portfolio', methods=['GET'])
def get_portfolio():
    """Fetch portfolio data from Alpaca API"""
    try:
        # Force reload environment variables
        load_dotenv(override=True)
        
        trading_client = get_trading_client()
        data_client = get_data_client()
        
        if not trading_client:
            return jsonify({'error': 'Alpaca API not configured'}), 400
        
        # Get account information
        account = trading_client.get_account()
        
        # Get positions
        positions = trading_client.get_all_positions()
        
        # Calculate total portfolio value
        total_value = float(account.portfolio_value)
        cash = float(account.cash)
        positions_value = total_value - cash
        
        # Format positions data
        formatted_positions = []
        for position in positions:
            # Get current price for the symbol
            try:
                if data_client:
                    # Use Alpaca's data API for current price
                    bars_request = StockBarsRequest(
                        symbol_or_symbols=position.symbol,
                        timeframe=TimeFrame.Day,
                        limit=1
                    )
                    bars = data_client.get_stock_bars(bars_request)
                    if bars and bars.data:
                        current_price = float(bars.data[position.symbol][0].close)
                    else:
                        current_price = float(position.current_price)
                else:
                    current_price = float(position.current_price)
            except:
                current_price = float(position.current_price)
            
            # Calculate change
            avg_entry_price = float(position.avg_entry_price)
            change_percent = ((current_price - avg_entry_price) / avg_entry_price) * 100
            
            # Handle fractional shares properly
            try:
                quantity = float(position.qty)
            except (ValueError, TypeError):
                print(f"Warning: Could not parse quantity for {position.symbol}. Value was: {position.qty}")
                quantity = 0.0
            
            formatted_positions.append({
                'symbol': position.symbol,
                'company': get_company_name(position.symbol),
                'quantity': quantity,
                'current_price': round(current_price, 2),
                'market_value': round(float(position.market_value), 2),
                'avg_entry_price': round(float(position.avg_entry_price), 2),
                'cost_basis': round(float(position.cost_basis), 2),
                'todays_pl': round(float(position.unrealized_intraday_pl), 2),
                'todays_pl_pc': round(float(position.unrealized_intraday_plpc) * 100, 2),
                'total_pl': round(float(position.unrealized_pl), 2),
                'total_pl_pc': round(float(position.unrealized_plpc) * 100, 2),
            })
        
        # Sort positions by value (highest first)
        formatted_positions.sort(key=lambda x: x['market_value'], reverse=True)
        
        return jsonify({
            'account': {
                'total_value': round(total_value, 2),
                'cash': round(cash, 2),
                'positions_value': round(positions_value, 2),
                'buying_power': round(float(account.buying_power), 2),
                'day_trade_count': int(float(account.daytrade_count)) if account.daytrade_count else 0,
                'status': account.status,
                'currency': account.currency
            },
            'positions': formatted_positions,
            'last_updated': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Portfolio error: {str(e)}")
        return jsonify({'error': f'Failed to fetch portfolio data: {str(e)}'}), 500

@app.route('/api/chat', methods=['POST'])
def chat_with_ai():
    """Handle chat messages and get AI responses from Perplexity"""
    try:
        data = request.get_json()
        user_message = data.get('message')
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        perplexity_key = os.getenv('PERPLEXITY_API_KEY')
        if not perplexity_key:
            return jsonify({'error': 'Perplexity API key not configured'}), 400
        
        # Get portfolio context
        portfolio_context = ""
        try:
            trading_client = get_trading_client()
            if trading_client:
                account = trading_client.get_account()
                positions = trading_client.get_all_positions()
                
                portfolio_context = f"""
                Portfolio Context:
                - Total Value: ${float(account.portfolio_value):,.2f}
                - Cash: ${float(account.cash):,.2f}
                - Number of Positions: {len(positions)}
                - Current Holdings: {', '.join([p.symbol for p in positions]) if positions else 'None'}
                """
        except:
            portfolio_context = "Portfolio data unavailable."
        
        # Construct prompt with portfolio context
        full_prompt = f"""
        You are a professional financial advisor and portfolio analyst. 
        The user is asking about their investment portfolio.
        
        {portfolio_context}
        
        User Question: {user_message}
        
        Please provide a helpful, informative response that takes into account their portfolio context. 
        Be conversational but professional. If you need more specific portfolio data to answer their question, 
        let them know what information would be helpful.
        """
        
        # Call Perplexity API
        headers = {
            'Authorization': f'Bearer {perplexity_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'llama-3.1-sonar-small-128k-online',
            'messages': [
                {
                    'role': 'user',
                    'content': full_prompt
                }
            ],
            'max_tokens': 1000,
            'temperature': 0.7
        }
        
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result['choices'][0]['message']['content']
            search_results = result.get('search_results', [])
            
            return jsonify({
                'success': True,
                'response': ai_response,
                'search_results': search_results,
                'portfolio_context': portfolio_context.strip()
            })
        else:
            return jsonify({
                'error': f'Perplexity API error: {response.status_code}',
                'details': response.text
            }), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to process chat message: {str(e)}'}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """Check if APIs are configured and working"""
    try:
        alpaca_configured = bool(os.getenv('ALPACA_API_KEY') and os.getenv('ALPACA_SECRET_KEY'))
        perplexity_configured = bool(os.getenv('PERPLEXITY_API_KEY'))
        
        alpaca_status = 'not_configured'
        if alpaca_configured:
            try:
                trading_client = get_trading_client()
                account = trading_client.get_account()
                alpaca_status = 'connected'
            except:
                alpaca_status = 'error'
        
        return jsonify({
            'alpaca': {
                'configured': alpaca_configured,
                'status': alpaca_status
            },
            'perplexity': {
                'configured': perplexity_configured,
                'status': 'configured' if perplexity_configured else 'not_configured'
            },
            'cache': {
                'company_names_cached': len(asset_name_cache)
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get status: {str(e)}'}), 500

@app.route('/api/clear-cache', methods=['POST'])
def clear_cache():
    """Clear the company name cache"""
    try:
        global asset_name_cache
        cache_size = len(asset_name_cache)
        asset_name_cache.clear()
        return jsonify({
            'success': True,
            'message': f'Cache cleared. Removed {cache_size} cached company names.'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to clear cache: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 