import asyncio
import aiosqlite
import os

async def test_database():
    # Check if database file exists
    if not os.path.exists("database.db"):
        print("Database file not found!")
        return
    
    try:
        # Connect to database
        conn = await aiosqlite.connect("database.db")
        print("Connected to database")
        
        # Check if payment_methods table exists
        cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_methods';")
        table_exists = await cursor.fetchone()
        if table_exists:
            print("payment_methods table exists")
            
            # Get all payment methods
            cursor = await conn.execute("SELECT * FROM payment_methods;")
            methods = await cursor.fetchall()
            print(f"Payment methods: {methods}")
            
            # Check if payment_method_layout table exists
            cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_method_layout';")
            layout_table_exists = await cursor.fetchone()
            if layout_table_exists:
                print("payment_method_layout table exists")
                
                # Get all layout data
                cursor = await conn.execute("SELECT * FROM payment_method_layout;")
                layout = await cursor.fetchall()
                print(f"Payment layout: {layout}")
            else:
                print("payment_method_layout table does not exist")
        else:
            print("payment_methods table does not exist")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_database())