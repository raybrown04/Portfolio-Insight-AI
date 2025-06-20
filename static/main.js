// Global state
let appState = {
    isConfigured: false,
    portfolioData: null,
    chatHistory: [],
    currentSort: { field: 'market_value', direction: 'desc' }
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

// API functions
async function checkApiStatus() {
    try {
        const response = await fetch('/api/status');
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

async function loadPortfolioData() {
    try {
        const response = await fetch('/api/portfolio');
        const data = await response.json();
        
        if (response.ok) {
            appState.portfolioData = data;
            updatePortfolioDisplay(data);
            return data;
        } else {
            throw new Error(data.error || 'Failed to load portfolio data');
        }
    } catch (error) {
        console.error('Error loading portfolio data:', error);
        showError('Failed to load portfolio data: ' + error.message);
        return null;
    }
}

async function sendChatMessage(message) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
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

// UI update functions
function updateConnectionStatus(status) {
    // Update Alpaca status
    const alpacaStatus = document.getElementById('alpaca-connection-status');
    const accountStatus = document.getElementById('account-status');
    const alpacaMode = document.getElementById('alpaca-mode');
    
    if (status.alpaca.configured && status.alpaca.status === 'connected') {
        alpacaStatus.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800';
        alpacaStatus.textContent = 'Connected';
        accountStatus.className = 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800';
        accountStatus.textContent = 'Connected';
        alpacaMode.textContent = 'Paper Trading';
    } else {
        alpacaStatus.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
        alpacaStatus.textContent = 'Not Connected';
        accountStatus.className = 'px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
        accountStatus.textContent = 'Not Connected';
        alpacaMode.textContent = '--';
    }
    
    // Update Perplexity status
    const perplexityStatus = document.getElementById('perplexity-connection-status');
    const perplexityStatusDashboard = document.getElementById('perplexity-status');
    const aiStatus = document.getElementById('ai-status');
    
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

function updatePortfolioDisplay(data) {
    // Update portfolio summary
    const totalValue = document.getElementById('total-portfolio-value');
    totalValue.textContent = formatCurrency(data.account.total_value);
    totalValue.className = 'text-3xl font-bold mt-1 text-white';
    
    const availableCash = document.getElementById('available-cash');
    availableCash.textContent = formatCurrency(data.account.cash);
    availableCash.className = 'text-xl font-semibold text-white';
    
    const buyingPower = document.getElementById('buying-power');
    buyingPower.textContent = formatCurrency(data.account.buying_power);
    buyingPower.className = 'text-xl font-semibold text-white';
    
    // Update last updated time
    const lastUpdated = new Date(data.last_updated).toLocaleTimeString();
    document.getElementById('last-updated').textContent = `Last updated: ${lastUpdated}`;
    
    // Update sync status
    document.getElementById('sync-status').textContent = 'Last sync successful • Real-time market data enabled';
    
    // Update holdings table
    updateHoldingsTable(data.positions);
}

function updateHoldingsTable(positions) {
    const tbody = document.getElementById('holdings-table-body');
    tbody.innerHTML = '';
    
    if (positions.length === 0) {
        tbody.innerHTML = `
            <tr class="bg-white dark:bg-dark-900">
                <td colspan="11" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <i class="fas fa-inbox text-2xl mb-2"></i>
                    <p>No positions found</p>
                    <p class="text-sm">Start trading to see your holdings here</p>
                </td>
            </tr>
        `;
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

function formatAIResponse(text) {
    // Convert **text** to <strong>text</strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert newlines to paragraphs
    const paragraphs = text.split('\\n').map(p => p.trim()).filter(p => p.length > 0);
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}

function addChatMessage(messageData, isUser = false) {
    const chatHistory = document.getElementById('chat-history');
    const messageDiv = document.createElement('div');
    
    if (isUser) {
        messageDiv.className = 'flex justify-end';
        messageDiv.innerHTML = `
            <div class="max-w-4xl">
                <div class="chat-bubble-user rounded-2xl rounded-tr-none py-3 px-4">
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
                    <div class="mt-2 text-white formatted-response">
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
        <p>Hello! I'm your Portfolio Insight AI assistant. I'm connected to your Alpaca trading account and ready to provide personalized analysis.</p>
        <p class="mt-3">Here are some questions you might ask:</p>
        <ul class="list-disc pl-5 space-y-1 mt-2">
            <li>What's the overall risk profile of my portfolio?</li>
            <li>Show me research and key insights on <strong>AAPL</strong></li>
            <li>Suggest investment ideas based on my portfolio and moderate risk tolerance</li>
            <li>Explain P/E ratio in simple terms</li>
        </ul>
    `);
}

// Navigation functions
function showDashboard() {
    document.getElementById('dashboard-page').classList.remove('hidden');
    document.getElementById('chat-page').classList.add('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    
    // Update navigation
    document.querySelectorAll('#dashboard-link').forEach(el => {
        el.classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
        el.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    });
    document.querySelectorAll('#chat-link, #settings-link').forEach(el => {
        el.classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
        el.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    });
}

function showChat() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    
    // Update navigation
    document.querySelectorAll('#chat-link').forEach(el => {
        el.classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
        el.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    });
    document.querySelectorAll('#dashboard-link, #settings-link').forEach(el => {
        el.classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
        el.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    });
    
    // Initialize chat if not already done
    if (document.getElementById('chat-history').children.length === 0) {
        initializeChat();
    }
}

function showSettings() {
    document.getElementById('dashboard-page').classList.add('hidden');
    document.getElementById('chat-page').classList.add('hidden');
    document.getElementById('settings-page').classList.remove('hidden');
    
    // Update navigation
    document.querySelectorAll('#settings-link').forEach(el => {
        el.classList.add('border-primary-500', 'text-gray-900', 'dark:text-white');
        el.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    });
    document.querySelectorAll('#dashboard-link, #chat-link').forEach(el => {
        el.classList.remove('border-primary-500', 'text-gray-900', 'dark:text-white');
        el.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-300');
    });
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
    
    // Password toggle buttons
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetId = e.target.closest('button').dataset.target;
            const input = document.getElementById(targetId);
            const icon = e.target.closest('button').querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'far fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'far fa-eye';
            }
        });
    });
    
    // Portfolio refresh
    document.getElementById('refresh-portfolio').addEventListener('click', async () => {
        await loadPortfolioData();
    });
    
    // Chat functionality
    document.getElementById('send-message').addEventListener('click', async () => {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        addChatMessage(message, true);
        input.value = '';
        input.disabled = true;
        
        try {
            const aiResponse = await sendChatMessage(message);
            addChatMessage(aiResponse, false);
        } catch (error) {
            showError('The AI assistant is currently unavailable. Please try again later.');
        } finally {
            input.disabled = false;
            input.focus();
        }
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
    
    // Table sorting
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Prevent sorting if the resizer handle is clicked
            if (e.target.classList.contains('resizer')) {
                return;
            }
            const field = header.dataset.sort;
            if (field) {
                handleTableSort(field);
            }
        });
    });
    
    // Initialize app
    await initializeApp();
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
        showDashboard();
    } else {
        showSettings();
    }

    initializeResizableColumns();
    initializeTableSorting();
    initializeChat();
    
    // Hide loading screen after everything is initialized
    hideLoading();
} 