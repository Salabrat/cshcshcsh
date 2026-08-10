import asyncio
import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get first 10 country names
cursor.execute("SELECT name FROM catalog_items WHERE type = 'subcategory' LIMIT 10")
results = cursor.fetchall()

print("First 10 countries in the database:")
for i, (name,) in enumerate(results, 1):
    print(f"{i:2d}. {repr(name)}")


async def check_countries():
    try:
        # Connect to the database
        conn = await aiosqlite.connect("database.db")
        
        # Try different variations of the category name
        cursor = await conn.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%' OR name LIKE '%Private IPv4%'")
        private_ipv4 = await cursor.fetchall()
        
        if not private_ipv4:
            print("Private IPv4 category not found")
            # List all categories to see what we have
            cursor = await conn.execute("SELECT id, name, type FROM catalog_items WHERE type IN ('category', 'subcategory') ORDER BY type, name LIMIT 20")
            all_categories = await cursor.fetchall()
            print("\nAll categories in database:")
            print("-" * 50)
            for cat in all_categories:
                print(f"ID: {cat[0]}, Name: {cat[1]}, Type: {cat[2]}")
            await conn.close()
            return
        
        print("Found Private IPv4 categories:")
        for cat in private_ipv4:
            print(f"ID: {cat[0]}, Name: {cat[1]}")
        
        parent_id = private_ipv4[0][0]
        print(f"\nUsing parent ID: {parent_id}")
        
        # Get all subcategories (countries) under Private IPv4
        cursor = await conn.execute("""
            SELECT id, name, type, is_grid_3x6 
            FROM catalog_items 
            WHERE parent_id = ? AND type = 'subcategory'
            ORDER BY name
        """, (parent_id,))
        
        countries = await cursor.fetchall()
        
        print("\nExisting countries:")
        print("-" * 50)
        for country in countries:
            print(f"ID: {country[0]}, Name: {country[1]}, Type: {country[2]}, Grid_3x6: {country[3]}")
        
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_countries())