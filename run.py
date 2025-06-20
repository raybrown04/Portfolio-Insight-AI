#!/usr/bin/env python3
"""
Portfolio Insight AI - Startup Script

This script starts the Flask application for the Portfolio Insight AI.
Make sure you have installed all dependencies from requirements.txt first.

Usage:
    python run.py
"""

import os
import sys
import subprocess

def activate_venv():
    """Activate the virtual environment if not already active"""
    venv_path = os.path.join(os.path.dirname(__file__), 'venv310')
    venv_python = os.path.join(venv_path, 'Scripts', 'python.exe')
    
    if os.path.exists(venv_python):
        # Check if we're already in the virtual environment
        if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
            # Not in virtual environment, restart with venv python
            print("🔄 Activating virtual environment...")
            subprocess.run([venv_python, __file__])
            return True
    else:
        print("❌ Virtual environment not found. Please run: py -3.10 -m venv venv310")
        print("Then install dependencies: pip install -r requirements.txt")
        return False
    return False

if __name__ == '__main__':
    # Try to activate virtual environment first
    if activate_venv():
        sys.exit(0)
    
    # If we get here, we're in the virtual environment
    try:
        from app import app
        
        print("🚀 Starting Portfolio Insight AI...")
        print("📊 Dashboard will be available at: http://localhost:5000")
        print("🔑 Configure your API keys in the Settings tab")
        print("")
        print("Press Ctrl+C to stop the server")
        print("-" * 50)
        
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("💡 Make sure you're in the virtual environment and dependencies are installed:")
        print("   .\\venv310\\Scripts\\activate")
        print("   pip install -r requirements.txt")
    except Exception as e:
        print(f"❌ Error starting application: {e}") 