#!/usr/bin/env python3
"""
Test script to verify the /edit functionality implementation
"""

import asyncio
import aiosqlite
from database import Database
from config import cfg

async def test_edit_functionality():
    """Test the new edit functionality"""
    print("🧪 Testing /edit functionality implementation...")
    
    # Initialize database
    db = Database()
    await db.connect()
    
    try:
        # Test bot settings methods
        print("\n1. Testing bot settings database methods...")
        
        # Test setting welcome text
        await db.set_bot_setting("welcome_text", "🎉 Test welcome message!")
        welcome_text = await db.get_bot_setting("welcome_text")
        assert welcome_text == "🎉 Test welcome message!", f"Expected '🎉 Test welcome message!', got '{welcome_text}'"
        print("   ✅ Welcome text setting works")
        
        # Test setting sticker ID
        test_sticker_id = "CAACAgEAAxkBAAEO7SxodMdmuDswmlhmRigQFvYeCcXZggACRwIAAvR1IESZ69gYUsdrkzYE"
        await db.set_bot_setting("welcome_sticker_id", test_sticker_id)
        sticker_id = await db.get_bot_setting("welcome_sticker_id")
        assert sticker_id == test_sticker_id, f"Expected '{test_sticker_id}', got '{sticker_id}'"
        print("   ✅ Sticker ID setting works")
        
        # Test setting photo ID
        test_photo_id = "AgACAgIAAxkBAAEO8FFod_test_photo_id"
        await db.set_bot_setting("welcome_photo_id", test_photo_id)
        photo_id = await db.get_bot_setting("welcome_photo_id")
        assert photo_id == test_photo_id, f"Expected '{test_photo_id}', got '{photo_id}'"
        print("   ✅ Photo ID setting works")
        
        # Test getting welcome settings
        print("\n2. Testing welcome settings retrieval...")
        welcome_settings = await db.get_welcome_settings()
        
        expected_settings = {
            'text': "🎉 Test welcome message!",
            'sticker_id': test_sticker_id,
            'photo_id': test_photo_id
        }
        
        assert welcome_settings == expected_settings, f"Expected {expected_settings}, got {welcome_settings}"
        print("   ✅ Welcome settings retrieval works")
        
        # Test setting None values
        print("\n3. Testing None value handling...")
        await db.set_bot_setting("welcome_sticker_id", None)
        sticker_id = await db.get_bot_setting("welcome_sticker_id")
        assert sticker_id is None, f"Expected None, got '{sticker_id}'"
        print("   ✅ None value handling works")
        
        # Test default initialization
        print("\n4. Testing default initialization...")
        await db.init_default_bot_settings()
        print("   ✅ Default bot settings initialization works")
        
        print("\n✅ All tests passed! Edit functionality is working correctly.")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        raise
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(test_edit_functionality())