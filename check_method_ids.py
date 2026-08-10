import asyncio
import aiosqlite

async def check_payment_methods():
    """Check payment method IDs in database"""
    conn = await aiosqlite.connect('database.db')
    
    print("=== PAYMENT METHODS IN DATABASE ===")
    cursor = await conn.execute('''
        SELECT method_id, method_name, is_enabled 
        FROM payment_methods
        ORDER BY method_id
    ''')
    methods = await cursor.fetchall()
    
    for method_id, method_name, is_enabled in methods:
        status = "✅" if is_enabled else "❌"
        print(f"{status} method_id: '{method_id}' → {method_name}")
    
    print("\n=== PAYMENT METHOD LAYOUT ===")
    cursor = await conn.execute('''
        SELECT pm.method_id, pm.method_name, pml.row_number, pml.position_in_row
        FROM payment_methods pm
        LEFT JOIN payment_method_layout pml ON pm.method_id = pml.method_id
        WHERE pm.is_enabled = 1
        ORDER BY pml.row_number, pml.position_in_row
    ''')
    layout = await cursor.fetchall()
    
    for method_id, method_name, row, pos in layout:
        print(f"Row {row}, Pos {pos}: '{method_id}' → {method_name}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_payment_methods())
