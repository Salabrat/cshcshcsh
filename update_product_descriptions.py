import asyncio
import aiosqlite
import re

# Dictionary mapping regions to cities for different countries
region_to_city = {
    # Andorra
    "Андорра-ла-Велья": "Андорра-ла-Велья",
    "Эскальдес-Энгордань": "Эскальдес-Энгордань",
    "Сант-Жулия-де-Лория": "Сант-Жулия-де-Лория",
    
    # Netherlands
    "Центральный регион": "Амстердам",
    "Северный регион": "Роттердам",
    "Южный регион": "Гаага",
    "Восточный регион": "Утрехт",
    "Западный регион": "Эйндховен",
    
    # Russia
    "Центральный регион": "Москва",
    "Северный регион": "Санкт-Петербург",
    "Южный регион": "Новосибирск",
    "Восточный регион": "Екатеринбург",
    "Западный регион": "Казань",
    
    # France
    "Центральный регион": "Париж",
    "Северный регион": "Марсель",
    "Южный регион": "Лион",
    "Восточный регион": "Тулуза",
    "Западный регион": "Ницца",
    
    # USA
    "Центральный регион": "Нью-Йорк",
    "Северный регион": "Лос-Анджелес",
    "Южный регион": "Чикаго",
    "Восточный регион": "Хьюстон",
    "Западный регион": "Феникс",
    
    # Australia
    "Центральный регион": "Сидней",
    "Северный регион": "Мельбурн",
    "Южный регион": "Брисбен",
    "Восточный регион": "Перт",
    "Западный регион": "Аделаида",
    
    # Finland
    "Центральный регион": "Хельсинки",
    "Северный регион": "Эспоо",
    "Южный регион": "Тампере",
    "Восточный регион": "Вантаа",
    "Западный регион": "Оулу",
    
    # Kazakhstan
    "Центральный регион": "Алматы",
    "Северный регион": "Нур-Султан",
    "Южный регион": "Шымкент",
    "Восточный регион": "Актау",
    "Западный регион": "Атырау",
    
    # Italy
    "Центральный регион": "Рим",
    "Северный регион": "Милан",
    "Южный регион": "Неаполь",
    "Восточный регион": "Турин",
    "Западный регион": "Палермо",
    
    # For all other countries, we'll use the region name as the city name
}

async def update_product_descriptions():
    conn = await aiosqlite.connect('database.db')
    
    # Get all proxy products
    cursor = await conn.execute('''
        SELECT id, name, description 
        FROM catalog_items 
        WHERE type = 'product' AND description LIKE '%Прокси%'
    ''')
    
    products = await cursor.fetchall()
    
    print(f"Found {len(products)} proxy products to update...")
    
    updated_count = 0
    
    for product_id, product_name, description in products:
        try:
            # Remove "Доступно: 1000 шт" and "Цена за шт: X.X₽" lines
            # These lines may have different spacing, so we'll use regex
            description = re.sub(r'\s*Доступно:\s*1000\s*шт\s*', '', description)
            description = re.sub(r'\s*Цена\s*за\s*шт:\s*\d+(?:\.\d+)?₽\s*', '', description)
            
            # Update region name to city name if needed
            # Extract the region from the description
            region_match = re.search(r'Регион:\s*(.+)', description)
            if region_match:
                region = region_match.group(1).strip()
                # Get the city name for this region
                city = region_to_city.get(region, region)  # Use region name as fallback
                
                # Replace the region line with the city name
                description = re.sub(r'Регион:\s*.+', f'Регион: {city}', description)
                
                # Also update the product name if it matches the region
                if product_name == region:
                    await conn.execute('''
                        UPDATE catalog_items 
                        SET name = ?, description = ?
                        WHERE id = ?
                    ''', (city, description, product_id))
                    await conn.commit()
                    print(f"  ✓ Updated product '{region}' -> '{city}' (ID: {product_id})")
                else:
                    await conn.execute('''
                        UPDATE catalog_items 
                        SET description = ?
                        WHERE id = ?
                    ''', (description, product_id))
                    await conn.commit()
                    print(f"  ✓ Updated description for '{product_name}' (ID: {product_id})")
                
                updated_count += 1
            else:
                # Just remove the unwanted lines
                await conn.execute('''
                    UPDATE catalog_items 
                    SET description = ?
                    WHERE id = ?
                ''', (description, product_id))
                await conn.commit()
                print(f"  ✓ Updated description for '{product_name}' (ID: {product_id})")
                updated_count += 1
                
        except Exception as e:
            print(f"  ✗ Error updating product ID {product_id}: {e}")
    
    print(f"\nFinished! Updated {updated_count} products.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(update_product_descriptions())