import asyncio
import sqlite3
# TODO: Candidate for removal? `aiosqlite` is unused in this script

async def debug_prices():
    """Debug price display issues"""
    
    # Check product_prices table structure
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    print("=== Product Prices Table Structure ===")
    cursor.execute("PRAGMA table_info(product_prices)")
    columns = cursor.fetchall()
    for col in columns:
        print(f"Column: {col[1]}, Type: {col[2]}")
    
    print("\n=== Sample Product Prices ===")
    cursor.execute("SELECT * FROM product_prices LIMIT 5")
    prices = cursor.fetchall()
    for price in prices:
        print(f"Product ID: {price[0]}, Price: {price[1]}, Currency: {price[2]}")
    
    print("\n=== Products with their prices ===")
    cursor.execute("""
        SELECT ci.id, ci.name, pp.price, pp.currency 
        FROM catalog_items ci 
        LEFT JOIN product_prices pp ON ci.id = pp.product_id 
        WHERE ci.type = 'product' 
        LIMIT 10
    """)
    products = cursor.fetchall()
    for product in products:
        print(f"ID: {product[0]}, Name: {product[1]}, Price: {product[2]}, Currency: {product[3]}")
    
    conn.close()

if __name__ == "__main__":
    asyncio.run(debug_prices())
