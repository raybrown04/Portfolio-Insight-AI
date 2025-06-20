# Portfolio Insight AI - Startup Script
Write-Host "Starting Portfolio Insight AI..." -ForegroundColor Green
Write-Host ""

# Check if virtual environment exists
if (-not (Test-Path "venv310\Scripts\Activate.ps1")) {
    Write-Host "Virtual environment not found. Creating it..." -ForegroundColor Yellow
    py -3.10 -m venv venv310
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create virtual environment. Please install Python 3.10." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "venv310\Scripts\Activate.ps1"

# Check if dependencies are installed
try {
    python -c "import flask" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Flask not found"
    }
} catch {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Start the application
Write-Host "Starting application..." -ForegroundColor Green
python run.py

Read-Host "Press Enter to exit" 