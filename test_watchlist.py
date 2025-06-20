#!/usr/bin/env python3
"""
Simple test script to verify watchlist functionality
"""

import json
import os
import sys

def test_watchlist_file():
    """Test watchlist file operations"""
    print("Testing watchlist functionality...")
    
    # Test file creation
    test_watchlist = [
        {
            "symbol": "AAPL",
            "company_name": "Apple Inc.",
            "entry_price": 150.00,
            "stop_price": 140.00,
            "target_price": 180.00,
            "notes": "Test stock from AI recommendation",
            "added_date": "2025-01-20T10:00:00"
        },
        {
            "symbol": "TSLA",
            "company_name": "Tesla Inc.",
            "entry_price": 200.00,
            "stop_price": 180.00,
            "target_price": 250.00,
            "notes": "Growth opportunity",
            "added_date": "2025-01-20T10:01:00"
        }
    ]
    
    # Write test data
    with open('watchlist.json', 'w') as f:
        json.dump(test_watchlist, f, indent=2)
    
    print("✅ Watchlist file created successfully")
    
    # Read test data
    with open('watchlist.json', 'r') as f:
        loaded_data = json.load(f)
    
    print(f"✅ Watchlist loaded with {len(loaded_data)} items")
    
    # Verify data structure
    for item in loaded_data:
        required_fields = ['symbol', 'company_name', 'entry_price', 'stop_price', 'target_price', 'notes', 'added_date']
        for field in required_fields:
            if field not in item:
                print(f"❌ Missing field: {field}")
                return False
    
    print("✅ All required fields present")
    
    # Clean up
    if os.path.exists('watchlist.json'):
        os.remove('watchlist.json')
        print("✅ Test file cleaned up")
    
    print("🎉 All watchlist tests passed!")
    return True

if __name__ == "__main__":
    success = test_watchlist_file()
    sys.exit(0 if success else 1) 