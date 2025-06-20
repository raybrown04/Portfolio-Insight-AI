@echo off
echo Starting Portfolio Insight AI...
echo.

REM Check if virtual environment exists
if not exist "venv310\Scripts\activate.bat" (
    echo Virtual environment not found. Creating it...
    py -3.10 -m venv venv310
    if errorlevel 1 (
        echo Failed to create virtual environment. Please install Python 3.10.
        pause
        exit /b 1
    )
)

REM Activate virtual environment
call venv310\Scripts\activate.bat

REM Check if dependencies are installed
python -c "import flask" 2>nul
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Start the application
echo Starting application...
python run.py

pause 