import asyncio
import aiosqlite

async def check_harbin():
    conn = await aiosqlite.connect('database.db')
    
    # Get Harbin products
    cursor = await conn.execute('''
        SELECT id, name, description 
        FROM catalog_items 
        WHERE name LIKE "%Харбин%" AND type = "product"
    ''')
    
    products = await cursor.fetchall()
    
    print("Harbin products:")
    for product in products:
        print(f"\nID: {product[0]}")
        print(f"Name: {product[1]}")
        print(f"Description: {product[2]}")
        print("-" * 50)
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_harbin())