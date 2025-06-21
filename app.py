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

# Watchlist storage (in production, use a proper database)
WATCHLIST_FILE = 'watchlist.json'

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
        
        response_data = {
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
        }
        
        # Create response with cache-busting headers
        response = jsonify(response_data)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
    except Exception as e:
        print(f"Portfolio error: {str(e)}")
        return jsonify({'error': f'Failed to fetch portfolio data: {str(e)}'}), 500

def get_allowed_models():
    """Returns a list of allowed Perplexity models."""
    return [
        'sonar-deep-research',
        'sonar-reasoning-pro',
        'sonar-reasoning',
        'sonar-pro',
        'sonar'
    ]

@app.route('/api/chat', methods=['POST'])
def chat_with_ai():
    """Handle chat messages and get AI responses from Perplexity"""
    try:
        data = request.get_json()
        user_prompt = data.get('prompt')
        chat_history = data.get('chat_history', [])
        model_to_use = data.get('model', 'sonar-deep-research')
        
        if not user_prompt:
            return jsonify({'error': 'Message is required'}), 400
        
        # Validate the model against the allowed list
        if model_to_use not in get_allowed_models():
            model_to_use = 'sonar-deep-research'  # Default to the most capable model if invalid
        
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
        
        # Create the comprehensive system prompt
        system_prompt = """
        You are an expert-level Financial Research Assistant integrated into a portfolio management application called "Portfolio InsightAI". Your primary role is to provide users with clear, data-driven, and well-structured insights about their stock portfolio and the broader market.

        **Core Instructions:**
        1.  **Portfolio Context:** You will be given the user's current stock holdings as context for many requests. Always leverage this information to provide personalized, relevant analysis.
        2.  **Markdown Formatting:** ALWAYS format your responses using Markdown for clarity and readability. Use headers, bold text for symbols and key terms, and bullet points for lists. Ensure ample vertical spacing.
        3.  **Data-Driven:** Base your analysis on real-time or very recent data. When providing news or analysis, mention the recency.
        4.  **Unbiased Tone:** Maintain a professional, unbiased, and analytical tone. Present both pros and cons where applicable.
        5.  **Standard Stock Analysis Format:** For any request that involves analyzing a single stock (e.g., finding opportunities, analyzing a holding), YOU MUST use the specific detailed format outlined below. This ensures consistency for the user.

        ---
        ### Standard Output Format for Single Stock Analysis
        When presenting an analysis for a single stock, structure it exactly as follows. This format is mandatory for consistency.

        **[TICKER] - [Company Name] | Current: $[Current Price] | Target: $[Target Price] (XXX% upside)**

        **Primary Catalyst:** [Provide a detailed paragraph explaining the primary catalyst for the stock's potential movement. This should be a narrative, not just a few keywords.]

        [Insert a descriptive paragraph providing more context on the company, its market position, and recent news. This should elaborate on the company's story and why it is compelling.]

        **Analyst Consensus:** [Summarize the consensus from Wall Street analysts. Include the number of firms, the range of price targets, and the average target.]
        **Fundamentals:** [Describe the company's fundamental strengths or weaknesses. Include key metrics like revenue, partnerships, or market opportunities. Include a quality score if available.]
        **Technical Setup:** [Describe the stock's technical situation. Mention volatility, chart patterns, institutional backing, etc.]
        **Risk Factors:** [List the primary risks that could prevent the stock from reaching its target.]
        **Entry Strategy:** [Provide a clear entry strategy, including a buy range, a stop-loss price, and an expected timeline.]
        **Position Size:** [Recommend a position size as a percentage of the portfolio, and include a conviction score (e.g., 9/10).]

        [Conclude with a final summary paragraph that synthesizes the information and reinforces the investment thesis.]

        ---
        **Specialized Task Execution:**
        When a user's query matches one of the following tasks, execute it precisely according to these instructions, using the Standard Output Format defined above for your final output.

        ---
        ### Task 1: "Find Growth Stock Opportunities"
        Act as a dedicated Growth Stock Research Assistant. Follow this workflow to identify high-upside opportunities.

        **Workflow:**
        1.  **Scan News & Catalysts:** Look for major positive events (e.g., FDA approvals, major contracts, tech breakthroughs, analyst upgrades) in the last 48 hours.
        2.  **Validate Analyst Targets:** The stock **must** have a credible analyst price target that is at least **400% (4x)** above its current price.
        3.  **Screen for Quality:** Check for strong revenue growth, healthy financials, and institutional accumulation.
        4.  **Assess Technicals & Risk:** Validate bullish chart patterns and assess key risks.
        5.  **Generate Watchlist:** Identify 3-5 top opportunities that meet these criteria.

        **Output:** For each opportunity identified, present it using the **Standard Output Format for Single Stock Analysis** shown above.

        ---
        ### Task 2: "Find Short Squeeze Candidates"
        Act as a dedicated Short Squeeze Research Assistant.

        **Workflow:**
        1.  **Screen for Squeeze Metrics:** Identify stocks with high short interest (>30% of float), high cost-to-borrow rates (>25%), low float (<50M shares), and high relative volume.
        2.  **Check Social Sentiment:** Scan Reddit (e.g., r/wallstreetbets, r/shortsqueeze) and X (Twitter) for a surge in positive discussion.
        3.  **Validate Setup:** Look for bullish technical patterns and a lack of negative news (e.g., offerings, bankruptcy risk). The primary catalyst will be the squeeze potential itself.
        4.  **Generate Watchlist:** Identify the top 3-5 candidates.

        **Output:** For each candidate, present it using the **Standard Output Format for Single Stock Analysis**.
        - The **Primary Catalyst** section must detail the squeeze potential.
        - The **Fundamentals** or **Technical Setup** section must include the key squeeze metrics (Short Interest, CTB, Float).

        ---
        ### Task 3: "How are my stocks doing?" or "Analyze [TICKER]"
        When asked to analyze stocks in the user's portfolio or a specific ticker:

        **Workflow:**
        1.  **Gather Data:** For each stock, retrieve recent news, key technical indicators (RSI, MAs), and current analyst sentiment.
        2.  **Synthesize Findings:** Structure the analysis for each stock requested.

        **Output:** For each stock, present a full analysis using the **Standard Output Format for Single Stock Analysis**. If a target price isn't the primary focus, you can adapt that line accordingly.
        """
        
        # Construct the full user message with portfolio context
        full_user_message = f"""
        {portfolio_context}
        
        User Question: {user_prompt}
        """
        
        # Prepare messages including chat history
        messages = [
            {
                'role': 'system',
                'content': system_prompt
            }
        ]
        
        # Add chat history if provided
        if chat_history:
            messages.extend(chat_history)
        
        # Add current user message (with portfolio context)
        messages.append({
            'role': 'user',
            'content': full_user_message
        })
        
        # Call Perplexity API with proper structure
        headers = {
            'Authorization': f'Bearer {perplexity_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': model_to_use,
            'messages': messages,
            'max_tokens': 2000,
            'temperature': 0.7,
            'stream': False
        }
        
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers=headers,
            json=payload,
            timeout=60
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
            print(f"Perplexity API Error: {response.status_code}")
            print(f"Response text: {response.text}")
            print(f"Request payload: {payload}")
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
        
        response_data = {
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
        }
        
        # Create response with cache-busting headers
        response = jsonify(response_data)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
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

@app.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    """Get watchlist with real-time market data"""
    try:
        watchlist_data = get_watchlist_with_market_data()
        return jsonify({
            'success': True,
            'watchlist': watchlist_data
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get watchlist: {str(e)}'}), 500

@app.route('/api/watchlist', methods=['POST'])
def add_to_watchlist():
    """Add a stock to the watchlist"""
    try:
        data = request.get_json()
        symbol = data.get('symbol', '').upper()
        company_name = data.get('company_name', '')
        entry_price = data.get('entry_price')
        stop_price = data.get('stop_price')
        target_price = data.get('target_price')
        notes = data.get('notes', '')
        ai_analysis = data.get('ai_analysis', '')  # New field for AI analysis
        
        if not symbol:
            return jsonify({'error': 'Symbol is required'}), 400
        
        # Get company name if not provided
        if not company_name:
            company_name = get_company_name(symbol)
        
        watchlist = load_watchlist()
        
        # Check if already in watchlist
        existing_item = next((item for item in watchlist if item.get('symbol', '').upper() == symbol), None)
        if existing_item:
            return jsonify({'error': f'{symbol} is already in your watchlist'}), 400
        
        # Add new item
        new_item = {
            'symbol': symbol,
            'company_name': company_name,
            'entry_price': entry_price,
            'stop_price': stop_price,
            'target_price': target_price,
            'notes': notes,
            'ai_analysis': ai_analysis,  # Store the AI analysis
            'added_date': datetime.now().isoformat()
        }
        
        watchlist.append(new_item)
        
        if save_watchlist(watchlist):
            return jsonify({
                'success': True,
                'message': f'{symbol} added to watchlist',
                'item': new_item
            })
        else:
            return jsonify({'error': 'Failed to save watchlist'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to add to watchlist: {str(e)}'}), 500

@app.route('/api/watchlist/<symbol>', methods=['DELETE'])
def remove_from_watchlist(symbol):
    """Remove a stock from the watchlist"""
    try:
        symbol = symbol.upper()
        watchlist = load_watchlist()
        
        # Find and remove the item
        original_length = len(watchlist)
        watchlist = [item for item in watchlist if item.get('symbol', '').upper() != symbol]
        
        if len(watchlist) == original_length:
            return jsonify({'error': f'{symbol} not found in watchlist'}), 404
        
        if save_watchlist(watchlist):
            return jsonify({
                'success': True,
                'message': f'{symbol} removed from watchlist'
            })
        else:
            return jsonify({'error': 'Failed to save watchlist'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to remove from watchlist: {str(e)}'}), 500

@app.route('/api/watchlist/<symbol>', methods=['PUT'])
def update_watchlist_item(symbol):
    """Update a watchlist item"""
    try:
        symbol = symbol.upper()
        data = request.get_json()
        
        watchlist = load_watchlist()
        
        # Find the item to update
        item_index = next((i for i, item in enumerate(watchlist) if item.get('symbol', '').upper() == symbol), None)
        
        if item_index is None:
            return jsonify({'error': f'{symbol} not found in watchlist'}), 404
        
        # Update the item
        watchlist[item_index].update({
            'entry_price': data.get('entry_price'),
            'stop_price': data.get('stop_price'),
            'target_price': data.get('target_price'),
            'notes': data.get('notes', watchlist[item_index].get('notes', '')),
            'ai_analysis': data.get('ai_analysis', watchlist[item_index].get('ai_analysis', '')),  # Handle AI analysis updates
            'updated_date': datetime.now().isoformat()
        })
        
        if save_watchlist(watchlist):
            return jsonify({
                'success': True,
                'message': f'{symbol} updated in watchlist',
                'item': watchlist[item_index]
            })
        else:
            return jsonify({'error': 'Failed to save watchlist'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to update watchlist item: {str(e)}'}), 500

def load_watchlist():
    """Load watchlist from JSON file"""
    try:
        if os.path.exists(WATCHLIST_FILE):
            with open(WATCHLIST_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading watchlist: {e}")
        return []

def save_watchlist(watchlist):
    """Save watchlist to JSON file"""
    try:
        with open(WATCHLIST_FILE, 'w') as f:
            json.dump(watchlist, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving watchlist: {e}")
        return False

def get_watchlist_with_market_data():
    """Get watchlist items with real-time market data"""
    watchlist = load_watchlist()
    data_client = get_data_client()
    
    if not data_client:
        return watchlist
    
    updated_watchlist = []
    
    for item in watchlist:
        symbol = item.get('symbol', '').upper()
        try:
            # Get current price and daily change
            bars_request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Day,
                limit=2  # Get 2 days to calculate daily change
            )
            bars = data_client.get_stock_bars(bars_request)
            
            if bars and bars.data and symbol in bars.data:
                current_bar = bars.data[symbol][-1]  # Most recent bar
                current_price = float(current_bar.close)
                
                # Calculate daily change
                if len(bars.data[symbol]) >= 2:
                    previous_bar = bars.data[symbol][-2]  # Previous day
                    previous_close = float(previous_bar.close)
                    daily_change = ((current_price - previous_close) / previous_close) * 100
                else:
                    daily_change = 0.0
                
                # Update item with market data
                updated_item = {
                    **item,
                    'current_price': current_price,
                    'daily_change': daily_change,
                    'last_updated': datetime.now().isoformat()
                }
            else:
                # If no data available, keep original item
                updated_item = {
                    **item,
                    'current_price': None,
                    'daily_change': None,
                    'last_updated': datetime.now().isoformat()
                }
            
            updated_watchlist.append(updated_item)
            
        except Exception as e:
            print(f"Error fetching market data for {symbol}: {e}")
            # Keep original item if market data fetch fails
            updated_item = {
                **item,
                'current_price': None,
                'daily_change': None,
                'last_updated': datetime.now().isoformat()
            }
            updated_watchlist.append(updated_item)
    
    return updated_watchlist

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 