import asyncio
import aiosqlite

async def check_sample():
    conn = await aiosqlite.connect('database.db')
    
    # Get a sample product to check
    cursor = await conn.execute('''
        SELECT id, name, description 
        FROM catalog_items 
        WHERE type = 'product' AND description LIKE '%Прокси%'
        LIMIT 1
    ''')
    
    product = await cursor.fetchone()
    
    if product:
        print("Sample product after update:")
        print(f"ID: {product[0]}")
        print(f"Name: {product[1]}")
        print(f"Description: {product[2]}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_sample())