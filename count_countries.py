import asyncio
import aiosqlite

async def count_countries():
    conn = await aiosqlite.connect('database.db')
    cursor = await conn.execute('SELECT COUNT(*) FROM catalog_items WHERE parent_id = 200 AND type = "subcategory"')
    count = await cursor.fetchone()
    print(f'Total countries: {count[0]}')
    await conn.close()

if __name__ == "__main__":
    asyncio.run(count_countries())