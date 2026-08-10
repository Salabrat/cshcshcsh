import asyncio
from database import db

async def check_payment_methods():
    """Check if payment methods are properly initialized"""
    print("🔍 Checking payment methods...")
    
    try:
        # Connect to the database
        await db.connect()
        print("✅ Database connected")
        
        # Get payment methods with layout
        methods = await db.get_payment_methods_with_layout()
        print(f"💳 Payment methods with layout: {methods}")
        
        # Get payment layout
        layout = await db.get_payment_layout()
        print(f"📐 Payment layout: {layout}")
        
        # Check if we have any enabled methods
        enabled_methods = [method for method in methods if method[2]]  # is_enabled is at index 2
        print(f"✅ Enabled payment methods: {len(enabled_methods)}")
        
        if enabled_methods:
            print("✅ Payment methods are properly initialized")
        else:
            print("⚠️ No enabled payment methods found")
            
    except Exception as e:
        print(f"❌ Error checking payment methods: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if db.conn:
            await db.conn.close()
            print("✅ Database connection closed")

if __name__ == "__main__":
    asyncio.run(check_payment_methods())