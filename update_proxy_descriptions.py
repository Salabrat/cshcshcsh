import asyncio
import aiosqlite
import re

async def update_proxy_descriptions():
    conn = await aiosqlite.connect('database.db')
    
    # Get all proxy products (cities)
    cursor = await conn.execute('''
        SELECT id, name, description, parent_id
        FROM catalog_items 
        WHERE type = 'product' AND description LIKE '%Прокси%'
    ''')
    
    products = await cursor.fetchall()
    
    print(f"Found {len(products)} proxy products to update...")
    
    updated_count = 0
    
    for product_id, product_name, description, parent_id in products:
        try:
            # Get the country name (parent category)
            cursor_country = await conn.execute('''
                SELECT name FROM catalog_items WHERE id = ?
            ''', (parent_id,))
            country_result = await cursor_country.fetchone()
            country_name = country_result[0][2:] if country_result and len(country_result[0]) > 2 else (country_result[0] if country_result else "Неизвестная страна")
            
            # Extract region from product name (everything after the first dash)
            if " - " in product_name:
                region_name = product_name.split(" - ", 1)[1]
            else:
                region_name = product_name
            
            # Create the new description with the required format
            new_description = f"""🌐 Прокси-сервер

Тип: Приватный IPv4

Список подсетей: <code>154.223.**.***</code>

Страна: {country_name}

Регион: {region_name}"""
            
            # Only update if description actually changed
            cursor_check = await conn.execute('''
                SELECT description FROM catalog_items WHERE id = ?
            ''', (product_id,))
            current_desc = await cursor_check.fetchone()
            
            if current_desc and current_desc[0] != new_description:
                await conn.execute('''
                    UPDATE catalog_items 
                    SET description = ?
                    WHERE id = ?
                ''', (new_description, product_id))
                await conn.commit()
                print(f"  ✓ Updated product '{product_name}' (ID: {product_id})")
                updated_count += 1
            else:
                print(f"  - No changes needed for '{product_name}' (ID: {product_id})")
                
        except Exception as e:
            print(f"  ✗ Error updating product ID {product_id}: {e}")
    
    print(f"\nFinished! Updated {updated_count} products.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(update_proxy_descriptions())