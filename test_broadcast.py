# Test script to verify broadcast functionality
import asyncio
from aiogram import types
from database import db

async def test_broadcast_functionality():
    """Test the broadcast functionality"""
    print("🔍 Testing broadcast functionality...")
    
    try:
        # Connect to the database
        await db.connect()
        print("✅ Database connected")
        
        # Test getting a product for broadcast
        print("\n1. Testing product retrieval...")
        try:
            # Get a sample product (first available)
            if db.conn:
                cursor = await db.conn.execute('''
                    SELECT id, name, description FROM catalog_items 
                    WHERE type = 'product' AND is_visible = TRUE
                    LIMIT 1
                ''')
                product = await cursor.fetchone()
                
                if product:
                    product_id, name, description = product
                    print(f"   ✅ Found product: {product_id} - {name}")
                    
                    # Test broadcast keyboard creation
                    from keyboards import broadcast_product_edit_kb
                    try:
                        keyboard = broadcast_product_edit_kb(product_id)
                        print(f"   ✅ Broadcast edit keyboard created: {type(keyboard)}")
                        
                        # Check keyboard structure
                        if hasattr(keyboard, 'inline_keyboard'):
                            button_count = sum(len(row) for row in keyboard.inline_keyboard)
                            print(f"   🎯 Number of buttons: {button_count}")
                            
                            # Show button details
                            for i, row in enumerate(keyboard.inline_keyboard):
                                print(f"   Row {i+1}: {len(row)} buttons")
                                for j, button in enumerate(row):
                                    if hasattr(button, 'text') and hasattr(button, 'callback_data'):
                                        print(f"     Button {j+1}: '{button.text}' -> {button.callback_data}")
                                        
                            # Check if confirm broadcast button is present
                            confirm_button_found = False
                            for row in keyboard.inline_keyboard:
                                for button in row:
                                    if hasattr(button, 'text') and "подтвердить" in button.text.lower():
                                        confirm_button_found = True
                                        print(f"   ✅ Confirm broadcast button found: '{button.text}' -> {button.callback_data}")
                                        break
                                if confirm_button_found:
                                    break
                                    
                            if not confirm_button_found:
                                print("   ❌ Confirm broadcast button NOT found!")
                            else:
                                print("   ✅ Confirm broadcast button is present")
                        else:
                            print("   ❌ Invalid keyboard structure")
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
    asyncio.run(test_broadcast_functionality())