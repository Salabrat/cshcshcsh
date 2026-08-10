import asyncio
import aiosqlite

async def check_database():
    """Direct database check"""
    print("🔍 Direct database check...")
    
    try:
        # Connect to the database
        conn = await aiosqlite.connect("database.db")
        print("✅ Database connected")
        
        # Check payment methods table
        cursor = await conn.execute("SELECT * FROM payment_methods")
        methods = await cursor.fetchall()
        print(f"💳 Payment methods: {methods}")
        
        # Check payment method layout table
        cursor = await conn.execute("SELECT * FROM payment_method_layout")
        layout = await cursor.fetchall()
        print(f"📐 Payment layout: {layout}")
        
        await conn.close()
        print("✅ Done")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_database())