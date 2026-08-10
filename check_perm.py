import asyncio
import aiosqlite

async def check_perm():
    conn = await aiosqlite.connect('database.db')
    
    # Get Perm products
    cursor = await conn.execute('''
        SELECT id, name, description 
        FROM catalog_items 
        WHERE name LIKE "%Пермь%" AND type = "product"
    ''')
    
    products = await cursor.fetchall()
    
    print("Perm products:")
    for product in products:
        print(f"\nID: {product[0]}")
        print(f"Name: {product[1]}")
        print(f"Description: {repr(product[2])}")
        print("-" * 50)
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_perm())