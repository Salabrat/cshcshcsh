import asyncio
from database import db

async def check_payment_methods():
    """Simple check of payment methods"""
    print("🔍 Checking payment methods...")
    
    # Connect to the database
    await db.connect()
    print("✅ Database connected")
    
    # Get payment methods with layout
    methods = await db.get_payment_methods_with_layout()
    print(f"💳 Payment methods with layout: {methods}")
    
    # Get payment layout
    layout = await db.get_payment_layout()
    print(f"📐 Payment layout: {layout}")
    
    if db.conn:
        await db.conn.close()
    print("✅ Done")

if __name__ == "__main__":
    asyncio.run(check_payment_methods())