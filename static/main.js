// Global state
let appState = {
    isConfigured: false,
    portfolioData: null,
    watchlistData: null,
    chatHistory: [],
    currentSort: { field: 'market_value', direction: 'desc' },
    selectedModel: 'sonar-deep-research', // Default to the deep research model
    autoRefreshInterval: null,
    lastRefreshTime: null
};

// Utility functions
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-modal').classList.remove('hidden');
}

function hideError() {
    document.getElementById('error-modal').classList.add('hidden');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatNumber(amount) {
    // show up to 9 decimal places for quantity
    return parseFloat(amount).toFixed(9);
}

function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    const colorClass = value >= 0 ? 'text-green-600' : 'text-red-600';
    return `<span class="${colorClass}">${sign}${value.toFixed(2)}%</span>`;
}

function formatCurrencyWithColor(amount) {
    const sign = amount >= 0 ? '+' : '-';
    const colorClass = amount >= 0 ? 'text-green-600' : 'text-red-600';
    const formattedAmount = formatCurrency(Math.abs(amount));
    return `<span class="${colorClass}">${sign}${formattedAmount}</span>`;
}

// Add cache-busting utility
function getCacheBustingUrl(url) {
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${timestamp}`;
}

// API functions
async function checkApiStatus() {
    try {
        const response = await fetch(getCacheBustingUrl('/api/status'));
        const data = await response.json();
        
        if (response.ok) {
            updateConnectionStatus(data);
            return data;
        } else {
            throw new Error(data.error || 'Failed to check API status');
        }
    } catch (error) {
        console.error('Error checking API status:', error);
        return null;
    }
}

async function saveApiKeys() {
    const alpacaKey = document.getElementById('alpaca-api-key').value;
    const alpacaSecret = document.getElementById('alpaca-secret-key').value;
    const perplexityKey = document.getElementById('perplexity-api-key').value;
    
    if (!alpacaKey || !alpacaSecret || !perplexityKey) {
        showError('Please fill in all API keys');
        return false;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/api/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                alpaca_key: alpacaKey,
                alpaca_secret: alpacaSecret,
                perplexity_key: perplexityKey
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.isConfigured = true;
            updateConnectionStatus({
                alpaca: { configured: true, status: 'connected' },
                perplexity: { configured: true, status: 'configured' }
            });
            
            // Switch to dashboard
            showDashboard();
            
            // Load portfolio data
            await loadPortfolioData();
            
            // Start auto-refresh
            startAutoRefresh();
            
            return true;
        } else {
            throw new Error(data.error || 'Failed to save API keys');
        }
    } catch (error) {
        showError(error.message);
        return false;
    } finally {
        hideLoading();
    }
}

async function loadPortfolioData(showLoadingIndicator = false) {
    try {
        if (showLoadingIndicator) {
            showLoading();
        }
        
        const response = await fetch(getCacheBustingUrl('/api/portfolio'));
        const data = await response.json();
        
        if (response.ok) {
            appState.portfolioData = data;
            appState.lastRefreshTime = new Date();
            updatePortfolioDisplay(data);
            console.log('Portfolio data refreshed successfully');
            return data;
        } else {
            throw new Error(data.error || 'Failed to load portfolio data');
        }
    } catch (error) {
        console.error('Error loading portfolio data:', error);
        showError('Failed to load portfolio data: ' + error.message);
        return null;
    } finally {
        if (showLoadingIndicator) {
            hideLoading();
        }
    }
}

// Auto-refresh functionality
function startAutoRefresh() {
    // Clear any existing interval
    if (appState.autoRefreshInterval) {
        clearInterval(appState.autoRefreshInterval);
    }
    
    // Update UI to show auto-refresh is active
    updateAutoRefreshIndicator(true);
    
    // Refresh every 30 seconds
    appState.autoRefreshInterval = setInterval(async () => {
        if (appState.isConfigured) {
            await loadPortfolioData(false); // Don't show loading indicator for auto-refresh
        }
    }, 30000);
}

function stopAutoRefresh() {
    if (appState.autoRefreshInterval) {
        clearInterval(appState.autoRefreshInterval);
        appState.autoRefreshInterval = null;
    }
    
    // Update UI to show auto-refresh is off
    updateAutoRefreshIndicator(false);
}

function updateAutoRefreshIndicator(isActive) {
    const indicator = document.getElementById('auto-refresh-indicator');
    const text = document.getElementById('auto-refresh-text');
    
    if (indicator && text) {
        if (isActive) {
            indicator.classList.remove('hidden');
            text.textContent = 'Auto-refresh: On (30s)';
        } else {
            indicator.classList.add('hidden');
            text.textContent = 'Auto-refresh: Off';
        }
    }
}

async function sendChatMessage(message) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                model: appState.selectedModel,
                chat_history: appState.chatHistory
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            throw new Error(data.error || 'Failed to get AI response');
        }
    } catch (error) {
        console.error('Error sending chat message:', error);
        throw error;
    }
}

// UI update functions with null checks
function updateConnectionStatus(status) {
    // Update Alpaca status with null checks
    const alpacaStatus = document.getElementById('alpaca-connection-status');
    const accountStatus = document.getElementById('account-status');
    const alpacaMode = document.getElementById('alpaca-mode');
    
    if (alpacaStatus && accountStatus && alpacaMode) {
        if (status.alpaca.configured && status.alpaca.status === 'connected') {
            alpacaStatus.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800';
            alpacaStatus.textContent = 'Connected';
            accountStatus.className = 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800';
            accountStatus.textContent = 'Connected';
            alpacaMode.textContent = 'Live Trading';
        } else {
            alpacaStatus.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
            alpacaStatus.textContent = 'Not Connected';
            accountStatus.className = 'px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
            accountStatus.textContent = 'Not Connected';
            alpacaMode.textContent = '--';
        }
    }
    
    // Update Perplexity status with null checks
    const perplexityStatus = document.getElementById('perplexity-connection-status');
    const perplexityStatusDashboard = document.getElementById('perplexity-status');
    const aiStatus = document.getElementById('ai-status');
    
    if (perplexityStatus && perplexityStatusDashboard && aiStatus) {
        if (status.perplexity.configured) {
            perplexityStatus.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800';
            perplexityStatus.textContent = 'Connected';
            perplexityStatusDashboard.className = 'text-sm font-medium text-green-600';
            perplexityStatusDashboard.textContent = 'Active';
            aiStatus.className = 'px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium inline-flex items-center';
            aiStatus.innerHTML = '<div class="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></div><span>AI Online</span>';
        } else {
            perplexityStatus.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
            perplexityStatus.textContent = 'Not Connected';
            perplexityStatusDashboard.className = 'text-sm font-medium text-red-600';
            perplexityStatusDashboard.textContent = 'Not Configured';
            aiStatus.className = 'px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium inline-flex items-center';
            aiStatus.innerHTML = '<div class="w-2 h-2 bg-red-600 rounded-full mr-2"></div><span>AI Offline</span>';
        }
    }
}

function updatePortfolioDisplay(data) {
    // Update portfolio summary with null checks
    const totalValue = document.getElementById('total-portfolio-value');
    const availableCash = document.getElementById('available-cash');
    const buyingPower = document.getElementById('buying-power');
    const lastUpdated = document.getElementById('last-updated');
    const syncStatus = document.getElementById('sync-status');
    
    if (totalValue) {
        totalValue.textContent = formatCurrency(data.account.total_value);
        totalValue.className = 'text-3xl font-bold mt-1 text-white';
    }
    
    if (availableCash) {
        availableCash.textContent = formatCurrency(data.account.cash);
        availableCash.className = 'text-xl font-semibold text-white';
    }
    
    if (buyingPower) {
        buyingPower.textContent = formatCurrency(data.account.buying_power);
        buyingPower.className = 'text-xl font-semibold text-white';
    }
    
    // Update last updated time
    if (lastUpdated) {
        const lastUpdatedTime = new Date(data.last_updated).toLocaleTimeString();
        lastUpdated.textContent = `Last updated: ${lastUpdatedTime}`;
    }
    
    // Update sync status
    if (syncStatus) {
        syncStatus.textContent = 'Last sync successful • Real-time market data enabled';
    }
    
    // Update holdings table
    updateHoldingsTable(data.positions);
}

function updateHoldingsTable(positions) {
    const tbody = document.getElementById('holdings-table-body');
    if (!tbody) return;
    
    // Clear existing rows more safely
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    
    if (positions.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'bg-white dark:bg-dark-900';
        emptyRow.innerHTML = `
            <td colspan="11" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                <i class="fas fa-inbox text-2xl mb-2"></i>
                <p>No positions found</p>
                <p class="text-sm">Start trading to see your holdings here</p>
            </td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }
    
    // Sort positions based on current sort state
    const sortedPositions = [...positions].sort((a, b) => {
        let aVal = a[appState.currentSort.field];
        let bVal = b[appState.currentSort.field];
        
        // Handle numeric values
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return appState.currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle string values
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        
        if (appState.currentSort.direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    sortedPositions.forEach((p, index) => {
        const row = document.createElement('tr');
        // Set alternating row backgrounds
        row.className = index % 2 === 0 
            ? 'bg-white hover:bg-gray-50' 
            : 'bg-gray-50 hover:bg-gray-100';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <a href="https://www.google.com/search?q=NASDAQ%3A+${p.symbol}" target="_blank" class="hover:underline">${p.symbol}</a>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 overflow-hidden text-ellipsis" title="${p.company}">${p.company}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${formatNumber(p.quantity)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">${formatCurrency(p.market_value)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${formatCurrency(p.avg_entry_price)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${formatCurrency(p.cost_basis)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatPercent(p.todays_pl_pc)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrencyWithColor(p.todays_pl)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatPercent(p.total_pl_pc)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrencyWithColor(p.total_pl)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                <button class="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Liquidate</button>
            </td>
        `;

        tbody.appendChild(row);
    });
    
    updateSortIndicators();
}

function updateSortIndicators() {
    // Remove all sort indicators
    document.querySelectorAll('.sortable-header i').forEach(icon => {
        icon.className = 'fas fa-sort ml-1';
    });
    
    // Add sort indicator to current sort field
    const currentHeader = document.querySelector(`[data-sort="${appState.currentSort.field}"]`);
    if (currentHeader) {
        const icon = currentHeader.querySelector('i');
        if (appState.currentSort.direction === 'asc') {
            icon.className = 'fas fa-sort-up ml-1';
        } else {
            icon.className = 'fas fa-sort-down ml-1';
        }
    }
}

function handleTableSort(field) {
    if (appState.currentSort.field === field) {
        // Toggle direction if same field
        appState.currentSort.direction = appState.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Set new field with default direction
        appState.currentSort.field = field;
        appState.currentSort.direction = 'asc';
    }
    
    // Re-render table with sorted data
    if (appState.portfolioData && appState.portfolioData.positions) {
        updateHoldingsTable(appState.portfolioData.positions);
    }
}

// Reset marked.js to its default renderer to remove the previous heading-only logic.
marked.use({ renderer: new marked.Renderer() });

function formatAIResponse(text) {
    // Use marked.js to properly render Markdown into HTML.
    try {
        let html = marked.parse(text);

        // This regex specifically targets the "title" format from your AI's prompt,
        // which is a bolded line like: **AVGO - Broadcom Inc. | ...**
        // In HTML, this becomes: <p><strong>AVGO - Broadcom Inc. | ...</strong></p>
        html = html.replace(
            /(<p><strong>([A-Z]{2,5})\s*-\s*.*?<\/strong><\/p>)/g,
            (match, fullTag, symbol) => {
                const acronymBlacklist = [
                    'BNPL', 'AI', 'CEO', 'CFO', 'COO', 'CTO', 'EPS', 'ROI', 'SEC',
                    'FDA', 'IPO', 'USA', 'LLC', 'INC', 'AM', 'PM', 'EDIT',
                    'IT', 'PEG', 'GPU', 'YTD', 'MTD', 'QTR'
                ];

                // Check if the captured symbol is a blacklisted acronym.
                if (!acronymBlacklist.includes(symbol)) {
                    // It's a valid symbol. Let's add the star.
                    // The companyName is extracted just in case it's needed by the addStar function.
                    const companyName = fullTag.split('-')[1]?.split('|')[0]?.trim() || '';
                    const withStar = `${symbol} ${addStarToRecommendation(symbol, companyName)}`;
                    return match.replace(symbol, withStar);
                }
                
                // If it's a blacklisted term, return the original HTML tag without changes.
                return match;
            }
        );

        return html;
    } catch (error) {
        console.error('Error parsing markdown:', error);
        // Fallback to basic formatting if marked.js fails.
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const paragraphs = text.split('\\n').map(p => p.trim()).filter(p => p.length > 0);
        return paragraphs.map(p => `<p>${p}</p>`).join('');
    }
}

function addChatMessage(messageData, isUser = false) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    
    if (isUser) {
        messageDiv.className = 'flex justify-end';
        messageDiv.innerHTML = `
            <div class="max-w-4xl">
                <div class="chat-bubble-user text-white rounded-2xl rounded-tr-none py-3 px-4">
                    <p class="font-medium">You</p>
                    <div class="mt-2">
                        <p>${messageData}</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        let content;
        // The initial message is a pre-formatted HTML string
        if (typeof messageData === 'string') {
            content = messageData;
        } else {
            // AI responses from server are objects
            content = formatAIResponse(messageData.response);
            const searchResults = messageData.search_results || [];
            
            // Replace [1], [2], etc. with clickable citations
            content = content.replace(/\[(\d+)\]/g, (match, number) => {
                const index = parseInt(number, 10) - 1;
                if (searchResults[index] && searchResults[index].url) {
                    const url = searchResults[index].url;
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link">[${number}]</a>`;
                }
                return match;
            });
        }

        messageDiv.className = 'flex slide-in-left';
        messageDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-robot text-white text-sm"></i>
            </div>
            <div class="ml-3 max-w-4xl">
                <div class="chat-bubble-ai rounded-2xl rounded-tl-none py-3 px-4">
                    <p class="font-medium">Portfolio AI Assistant</p>
                    <div class="mt-2 formatted-response">
                        ${content}
                    </div>
                </div>
            </div>
        `;
    }
    
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function initializeChat() {
    const chatHistory = document.getElementById('chat-history');
    chatHistory.innerHTML = '';
    
    addChatMessage(`
        <p>Hello! I'm your **Portfolio Insight AI** assistant. I'm connected to your Alpaca trading account and ready to provide personalized analysis.</p>
        
        <p class="mt-3">**Try these powerful research tools:**</p>
        <ul class="list-disc pl-5 space-y-1 mt-2">
            <li>**Portfolio Analysis:** Get comprehensive insights on your current holdings</li>
            <li>**Growth Opportunities:** Discover high-potential stocks with 400%+ upside targets</li>
            <li>**Short Squeeze Alerts:** Find stocks with high short interest and squeeze potential</li>
        </ul>
        
        <p class="mt-3">**Or ask me anything about:**</p>
        <ul class="list-disc pl-5 space-y-1 mt-2">
            <li>Risk analysis of your portfolio</li>
            <li>Research on specific stocks like **AAPL** or **TSLA**</li>
            <li>Investment ideas based on your risk tolerance</li>
            <li>Market trends and sector analysis</li>
        </ul>
    `);
}

// Navigation functions
function showDashboard() {
    document.getElementById('dashboard-page').classList.remove('hidden');
    document.getElementById('chat-page').classList.add('hidden');
    document.getElementById('watchlist-page').classList.add('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    
    // Update navigation
    document.getElementById('dashboard-link').classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('dashboard-link').classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('chat-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('chat-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('watchlist-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('watchlist-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('settings-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('settings-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
}

function showChat() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
    document.getElementById('watchlist-page').classList.add('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    
    // Update navigation
    document.getElementById('dashboard-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('dashboard-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('chat-link').classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('chat-link').classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('watchlist-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('watchlist-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('settings-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('settings-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    
    // Initialize chat if not already done
    if (document.getElementById('chat-history').children.length === 0) {
        initializeChat();
    }
}

function showSettings() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('chat-page').classList.add('hidden');
    document.getElementById('watchlist-page').classList.add('hidden');
    document.getElementById('settings-page').classList.remove('hidden');
    
    // Update navigation
    document.getElementById('dashboard-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('dashboard-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('chat-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('chat-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('watchlist-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('watchlist-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('settings-link').classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('settings-link').classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
}

function showWatchlist() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('chat-page').classList.add('hidden');
    document.getElementById('watchlist-page').classList.remove('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    
    // Update navigation
    document.getElementById('dashboard-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('dashboard-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('chat-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('chat-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('watchlist-link').classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    document.getElementById('watchlist-link').classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('settings-link').classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
    document.getElementById('settings-link').classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    
    // Load watchlist data
    loadWatchlistData();
}

// Watchlist functions
async function loadWatchlistData(showLoadingIndicator = false) {
    try {
        if (showLoadingIndicator) {
            showLoading();
        }
        
        const response = await fetch(getCacheBustingUrl('/api/watchlist'));
        const data = await response.json();
        
        if (response.ok) {
            updateWatchlistDisplay(data.watchlist);
            appState.watchlistData = data.watchlist;
            return data.watchlist;
        } else {
            throw new Error(data.error || 'Failed to load watchlist data');
        }
    } catch (error) {
        console.error('Error loading watchlist data:', error);
        showError('Failed to load watchlist data: ' + error.message);
        return null;
    } finally {
        if (showLoadingIndicator) {
            hideLoading();
        }
    }
}

function updateWatchlistDisplay(watchlist) {
    const tbody = document.getElementById('watchlist-tbody');
    const emptyDiv = document.getElementById('watchlist-empty');
    
    if (!watchlist || watchlist.length === 0) {
        tbody.innerHTML = '';
        emptyDiv.classList.remove('hidden');
        return;
    }
    
    emptyDiv.classList.add('hidden');
    
    tbody.innerHTML = watchlist.map(item => `
        <tr class="hover:bg-gray-50 dark:hover:bg-dark-800">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                ${item.symbol}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                ${item.company_name || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                ${item.current_price ? formatCurrency(item.current_price) : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                ${item.daily_change !== null ? formatPercent(item.daily_change) : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                ${item.entry_price ? formatCurrency(item.entry_price) : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                ${item.stop_price ? formatCurrency(item.stop_price) : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                ${item.target_price ? formatCurrency(item.target_price) : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button onclick="editWatchlistItem('${item.symbol}')" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="removeFromWatchlist('${item.symbol}')" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function addToWatchlist(symbol, companyName = '', entryPrice = null, stopPrice = null, targetPrice = null, notes = '') {
    try {
        const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                symbol: symbol,
                company_name: companyName,
                entry_price: entryPrice,
                stop_price: stopPrice,
                target_price: targetPrice,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Refresh watchlist if we're on the watchlist page
            if (!document.getElementById('watchlist-page').classList.contains('hidden')) {
                await loadWatchlistData();
            }
            return { success: true, message: data.message };
        } else {
            throw new Error(data.error || 'Failed to add to watchlist');
        }
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        return { success: false, message: error.message };
    }
}

async function removeFromWatchlist(symbol) {
    if (!confirm(`Are you sure you want to remove ${symbol} from your watchlist?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/watchlist/${symbol}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            await loadWatchlistData();
            return { success: true, message: data.message };
        } else {
            throw new Error(data.error || 'Failed to remove from watchlist');
        }
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        showError('Failed to remove from watchlist: ' + error.message);
        return { success: false, message: error.message };
    }
}

function editWatchlistItem(symbol) {
    // For now, just show a simple prompt. In a full implementation, you'd want a modal
    const item = appState.watchlistData?.find(item => item.symbol === symbol);
    if (!item) return;
    
    const entryPrice = prompt('Enter price (or leave empty):', item.entry_price || '');
    const stopPrice = prompt('Stop price (or leave empty):', item.stop_price || '');
    const targetPrice = prompt('Target price (or leave empty):', item.target_price || '');
    const notes = prompt('Notes (or leave empty):', item.notes || '');
    
    if (entryPrice !== null) { // User didn't cancel
        updateWatchlistItem(symbol, {
            entry_price: entryPrice ? parseFloat(entryPrice) : null,
            stop_price: stopPrice ? parseFloat(stopPrice) : null,
            target_price: targetPrice ? parseFloat(targetPrice) : null,
            notes: notes
        });
    }
}

async function updateWatchlistItem(symbol, updates) {
    try {
        const response = await fetch(`/api/watchlist/${symbol}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            await loadWatchlistData();
            return { success: true, message: data.message };
        } else {
            throw new Error(data.error || 'Failed to update watchlist item');
        }
    } catch (error) {
        console.error('Error updating watchlist item:', error);
        showError('Failed to update watchlist item: ' + error.message);
        return { success: false, message: error.message };
    }
}

// Function to add star button to AI recommendations
function addStarToRecommendation(symbol, companyName = '') {
    return `<button onclick="addRecommendedStock('${symbol}', '${companyName}')" class="star-button text-gray-400 hover:text-yellow-500 transition-colors ml-2" title="Add ${symbol} to watchlist">
        <i class="far fa-star"></i>
    </button>`;
}

async function addRecommendedStock(symbol, companyName = '') {
    const result = await addToWatchlist(symbol, companyName);
    if (result.success) {
        // Show success message and update button
        const starButton = event.target.closest('button');
        if (starButton) {
            starButton.innerHTML = '<i class="fas fa-star"></i>';
            starButton.classList.add('added');
            starButton.title = `${symbol} added to watchlist`;
            starButton.onclick = null; // Disable further clicks
            
            // Show a brief success message
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
            successMsg.textContent = `${symbol} added to watchlist!`;
            document.body.appendChild(successMsg);
            
            // Remove the message after 3 seconds
            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 3000);
        }
    } else {
        showError(result.message);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
    // Navigation event listeners
    document.getElementById('dashboard-link').addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });
    
    document.getElementById('chat-link').addEventListener('click', (e) => {
        e.preventDefault();
        showChat();
    });
    
    document.getElementById('watchlist-link').addEventListener('click', (e) => {
        e.preventDefault();
        showWatchlist();
    });
    
    document.getElementById('settings-link').addEventListener('click', (e) => {
        e.preventDefault();
        showSettings();
    });
    
    // API key setup
    document.getElementById('save-api-keys').addEventListener('click', async (e) => {
        e.preventDefault();
        const success = await saveApiKeys();
        if (success) {
            // Clear form
            document.getElementById('alpaca-api-key').value = '';
            document.getElementById('alpaca-secret-key').value = '';
            document.getElementById('perplexity-api-key').value = '';
        }
    });
    
        // Password toggle buttons with null checks
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', (e) => {
            const closestButton = e.target.closest('button');
            if (!closestButton || !closestButton.dataset) return;
            
            const targetId = closestButton.dataset.target;
            if (!targetId) return;
            
            const input = document.getElementById(targetId);
            const icon = closestButton.querySelector('i');
            
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'far fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'far fa-eye';
                }
            }
        });
    });

    // Portfolio refresh button
    const refreshButton = document.getElementById('refresh-portfolio');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            const icon = refreshButton.querySelector('i');
            refreshButton.disabled = true;
            
            if (icon) {
                icon.classList.add('animate-spin');
            }
            
            try {
                await loadPortfolioData(false); // Use auto-refresh style (no modal loading)
            } finally {
                // Remove spinning animation
                if (icon) {
                    icon.classList.remove('animate-spin');
                }
                refreshButton.disabled = false;
            }
        });
    }
    
    // Watchlist refresh button
    const refreshWatchlistButton = document.getElementById('refresh-watchlist');
    if (refreshWatchlistButton) {
        refreshWatchlistButton.addEventListener('click', async () => {
            const icon = refreshWatchlistButton.querySelector('i');
            refreshWatchlistButton.disabled = true;
            
            if (icon) {
                icon.classList.add('animate-spin');
            }
            
            try {
                await loadWatchlistData(false);
            } finally {
                if (icon) {
                    icon.classList.remove('animate-spin');
                }
                refreshWatchlistButton.disabled = false;
            }
        });
    }
    
    // Watchlist table refresh button
    const refreshWatchlistTableButton = document.getElementById('refresh-watchlist-btn');
    if (refreshWatchlistTableButton) {
        refreshWatchlistTableButton.addEventListener('click', async () => {
            const icon = refreshWatchlistTableButton.querySelector('i');
            refreshWatchlistTableButton.disabled = true;
            
            if (icon) {
                icon.classList.add('animate-spin');
            }
            
            try {
                await loadWatchlistData(false);
            } finally {
                if (icon) {
                    icon.classList.remove('animate-spin');
                }
                refreshWatchlistTableButton.disabled = false;
            }
        });
    }
    
    // Chat functionality
    document.getElementById('send-message').addEventListener('click', async () => {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to UI
        addChatMessage(message, true);
        
        input.value = '';
        input.disabled = true;
        
        try {
            const aiResponse = await sendChatMessage(message);
            addChatMessage(aiResponse, false);
            
            // Add user message and AI response to chat history
            appState.chatHistory.push({
                role: 'user',
                content: message
            });
            appState.chatHistory.push({
                role: 'assistant',
                content: aiResponse.response
            });
        } catch (error) {
            showError('The AI assistant is currently unavailable. Please try again later.');
        } finally {
            input.disabled = false;
            input.focus();
        }
    });
    
    // Model Selector Logic
    const modelSelector = document.getElementById('model-selector');
    modelSelector.addEventListener('change', (e) => {
        appState.selectedModel = e.target.value;
    });
    
    // Conversation starter buttons
    document.getElementById('how-are-stocks-btn').addEventListener('click', () => {
        const input = document.getElementById('message-input');
        input.value = 'How are my stocks doing?';
        document.getElementById('send-message').click();
    });
    
    document.getElementById('find-growth-btn').addEventListener('click', () => {
        const input = document.getElementById('message-input');
        input.value = 'Find Growth Stock Opportunities';
        document.getElementById('send-message').click();
    });
    
    document.getElementById('find-squeeze-btn').addEventListener('click', () => {
        const input = document.getElementById('message-input');
        input.value = 'Find Short Squeeze Candidates';
        document.getElementById('send-message').click();
    });
    
    // Auto-resize textarea
    const textarea = document.getElementById('message-input');
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    });
    
    // Allow Shift+Enter for new lines, Enter to send
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('send-message').click();
        }
    });
    
    // Error modal
    document.getElementById('close-error-modal').addEventListener('click', hideError);
    
    // Table sorting with null checks
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Prevent sorting if the resizer handle is clicked
            if (e.target.classList.contains('resizer')) {
                return;
            }
            
            // Add null check for dataset
            if (!header.dataset) return;
            
            const field = header.dataset.sort;
            if (field) {
                handleTableSort(field);
            }
        });
    });
    
    // Initialize app
    await initializeApp();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (appState.autoRefreshInterval) {
            clearInterval(appState.autoRefreshInterval);
        }
    });
});

let isResizing = false;

function initializeResizableColumns() {
    const resizer = document.querySelector('.resizer');
    if (!resizer) return;

    const colElement = document.getElementById('company-col');
    let startX, startWidth;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        e.preventDefault();

        startX = e.pageX;
        startWidth = colElement.offsetWidth;

        document.documentElement.addEventListener('mousemove', onMouseMove);
        document.documentElement.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const newWidth = startWidth + (e.pageX - startX);
        if (newWidth > 100) { // Minimum width
            colElement.style.width = `${newWidth}px`;
        }
    }

    function onMouseUp() {
        document.documentElement.removeEventListener('mousemove', onMouseMove);
        document.documentElement.removeEventListener('mouseup', onMouseUp);

        // Use a short timeout to prevent the click event from firing after resize
        setTimeout(() => { isResizing = false; }, 100);
    }
}

function initializeTableSorting() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            if (isResizing) {
                return;
            }
            
            // Add null check for dataset
            if (!header.dataset) return;
            
            const field = header.dataset.sort;
            if (field) {
                handleTableSort(field);
            }
        });
    });
}

async function initializeApp() {
    showLoading();
    const status = await checkApiStatus();
    
    if (status && status.alpaca.configured) {
        appState.isConfigured = true;
        await loadPortfolioData();
        startAutoRefresh(); // Start auto-refresh for configured apps
        showDashboard();
    } else {
        showSettings();
    }

    initializeResizableColumns();
    initializeTableSorting();
    initializeChat();
    
    // Ensure all elements with dataset attributes are properly initialized
    document.querySelectorAll('[data-sort]').forEach(element => {
        if (!element.dataset) {
            element.dataset = {};
        }
    });
    
    // Hide loading screen after everything is initialized
    hideLoading();
} 