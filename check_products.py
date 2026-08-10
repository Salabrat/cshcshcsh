import asyncio
import aiosqlite

async def check_products():
    conn = await aiosqlite.connect('database.db')
    
    # Get a few sample proxy products after update
    cursor = await conn.execute('''
        SELECT id, name, description 
        FROM catalog_items 
        WHERE type = 'product' AND description LIKE '%Прокси%'
        LIMIT 3
    ''')
    
    products = await cursor.fetchall()
    
    print("Sample proxy products after update:")
    for product in products:
        print(f"ID: {product[0]}")
        print(f"Name: {product[1]}")
        print(f"Description: {product[2]}")
        print("-" * 50)
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_products())