import asyncio
import aiosqlite

async def get_countries():
    conn = await aiosqlite.connect('database.db')
    
    # Get the parent ID for "Приватный IPv4"
    cursor = await conn.execute("SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4'")
    private_ipv4 = await cursor.fetchone()
    
    if not private_ipv4:
        print("Private IPv4 category not found")
        await conn.close()
        return
    
    parent_id = private_ipv4[0]
    print(f"Private IPv4 category ID: {parent_id}")
    
    # Get all countries
    cursor = await conn.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory'
        ORDER BY name
    """, (parent_id,))
    
    countries = await cursor.fetchall()
    
    print(f"Found {len(countries)} countries:")
    for country in countries:
        print(f"  ID: {country[0]}, Name: {country[1]}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(get_countries())