#!/usr/bin/env python3
# Debug script for broadcast functionality

import asyncio
import sys
import os

# Add the project directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db
from aiogram import types
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

async def test_broadcast_debug():
    """Test the broadcast functionality step by step"""
    print("🔍 Testing broadcast functionality...")
    
    try:
        # Connect to the database
        await db.connect()
        print("✅ Database connected")
        
        # Test getting all users
        print("\n1. Testing get_all_users()...")
        try:
            users = await db.get_all_users()
            users_list = list(users) if users else []
            print(f"   ✅ Found {len(users_list)} users")
            if users_list:
                print(f"   📋 First 3 users: {users_list[:3]}")
            else:
                print("   ⚠️ No users found in database")
        except Exception as e:
            print(f"   ❌ Error getting users: {e}")
            import traceback
            traceback.print_exc()
            
        # Test getting a product for broadcast
        print("\n2. Testing product retrieval...")
        try:
            # Get a sample product (first available)
            if db.conn:
                cursor = await db.conn.execute('''
                    SELECT id, name, description, photo_id, preview_link FROM catalog_items 
                    WHERE type = 'product' AND is_visible = TRUE
                    LIMIT 1
                ''')
                product = await cursor.fetchone()
                
                if product:
                    product_id, name, description, photo_id, preview_link = product
                    print(f"   ✅ Found product: {product_id} - {name}")
                    print(f"   📋 Product details: photo_id={photo_id}, preview_link={preview_link}")
                    
                    # Test broadcast keyboard creation
                    from keyboards import broadcast_product_edit_kb
                    try:
                        keyboard = broadcast_product_edit_kb(product_id)
                        print(f"   ✅ Broadcast edit keyboard created: {type(keyboard)}")
                        
                        # Check if confirm button is present
                        inline_keyboard = keyboard.inline_keyboard
                        confirm_button_found = False
                        for row in inline_keyboard:
                            for button in row:
                                if (hasattr(button, 'callback_data') and 
                                    button.callback_data == f"broadcast_product_confirm_{product_id}"):
                                    confirm_button_found = True
                                    print(f"   ✅ Confirm broadcast button found: '{button.text}' -> {button.callback_data}")
                        
                        if not confirm_button_found:
                            print("   ❌ Confirm broadcast button NOT found!")
                        else:
                            print("   ✅ Confirm broadcast button is present")
                    except Exception as e:
                        print(f"   ❌ Error creating broadcast keyboard: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print("   ⚠️ No products found in database")
            else:
                print("   ❌ Database connection not available")
                
        except Exception as e:
            print(f"   ❌ Error testing product retrieval: {e}")
            import traceback
            traceback.print_exc()
            
        print("\n✅ Broadcast test completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if db.conn:
            await db.conn.close()
            print("✅ Database connection closed")

if __name__ == "__main__":
    asyncio.run(test_broadcast_debug())