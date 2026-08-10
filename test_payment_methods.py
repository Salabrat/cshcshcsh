import asyncio
import sys
import os

# Add the current directory to the path so we can import the modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db

async def test_payment_methods():
    """Test if payment methods are properly initialized"""
    print("Testing payment methods initialization...")
    
    try:
        # Connect to the database
        await db.connect()
        print("✅ Database connected")
        
        # Get all payment methods
        payment_methods = await db.get_all_payment_methods()
        print(f"Payment methods: {payment_methods}")
        
        # Get payment methods with layout
        payment_methods_with_layout = await db.get_payment_methods_with_layout()
        print(f"Payment methods with layout: {payment_methods_with_layout}")
        
        # Get payment layout
        payment_layout = await db.get_payment_layout()
        print(f"Payment layout: {payment_layout}")
        
        print("✅ Test completed successfully")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Close the database connection
        if db.conn:
            await db.conn.close()
            print("✅ Database connection closed")

if __name__ == "__main__":
    asyncio.run(test_payment_methods())