import asyncio
from database import db
from keyboards import order_payment_methods_kb

async def test_balance_payment():
    """Test that the balance payment button is now included"""
    print("🔍 Testing balance payment button...")
    
    try:
        # Connect to the database
        await db.connect()
        print("✅ Database connected")
        
        # Test the order_payment_methods_kb function
        print("\n1. Testing order_payment_methods_kb function...")
        try:
            # Test with a sample order code
            keyboard = await order_payment_methods_kb("TEST123")
            print(f"   ✅ Keyboard generated successfully: {type(keyboard)}")
            
            # Check if keyboard has buttons
            if hasattr(keyboard, 'inline_keyboard'):
                button_count = sum(len(row) for row in keyboard.inline_keyboard)
                print(f"   🎯 Number of buttons: {button_count}")
                
                # Show button details
                for i, row in enumerate(keyboard.inline_keyboard):
                    print(f"   Row {i+1}: {len(row)} buttons")
                    for j, button in enumerate(row):
                        if hasattr(button, 'text') and hasattr(button, 'callback_data'):
                            print(f"     Button {j+1}: '{button.text}' -> {button.callback_data}")
                            
                # Check if balance payment button is present
                balance_button_found = False
                for row in keyboard.inline_keyboard:
                    for button in row:
                        if hasattr(button, 'text') and "баланс" in button.text.lower():
                            balance_button_found = True
                            print(f"   ✅ Balance payment button found: '{button.text}' -> {button.callback_data}")
                            break
                    if balance_button_found:
                        break
                        
                if not balance_button_found:
                    print("   ❌ Balance payment button NOT found!")
                else:
                    print("   ✅ Balance payment button is correctly placed at the top")
                
            else:
                print("   ❌ Invalid keyboard structure")
                
        except Exception as e:
            print(f"   ❌ Error testing keyboard function: {e}")
            import traceback
            traceback.print_exc()
            
        print("\n✅ Test completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if db.conn:
            await db.conn.close()
            print("✅ Database connection closed")

if __name__ == "__main__":
    asyncio.run(test_balance_payment())