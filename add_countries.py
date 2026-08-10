import asyncio
import aiosqlite

# List of additional countries to add with their flags
additional_countries = [
    ("🇦🇷Аргентина", "Argentina"),
    ("🇦🇹Австрия", "Austria"),
    ("🇧🇪Бельгия", "Belgium"),
    ("🇧🇷Бразилия", "Brazil"),
    ("🇨🇦Канада", "Canada"),
    ("🇨🇭Швейцария", "Switzerland"),
    ("🇨🇳Китай", "China"),
    ("🇨🇴Колумбия", "Colombia"),
    ("🇩🇪Германия", "Germany"),
    ("🇪🇬Египет", "Egypt"),
    ("🇪🇸Испания", "Spain"),
    ("🇬🇧Великобритания", "United Kingdom"),
    ("🇬🇷Греция", "Greece"),
    ("🇭🇰Гонконг", "Hong Kong"),
    ("🇮🇩Индонезия", "Indonesia"),
    ("🇮🇪Ирландия", "Ireland"),
    ("🇮🇱Израиль", "Israel"),
    ("🇮🇳Индия", "India"),
    ("🇯🇵Япония", "Japan"),
    ("🇰🇷Южная Корея", "South Korea"),
    ("🇲🇽Мексика", "Mexico"),
    ("🇳🇱Нидерланды", "Netherlands"),
    ("🇳🇴Норвегия", "Norway"),
    ("🇳🇿Новая Зеландия", "New Zealand"),
    ("🇵🇭Филиппины", "Philippines"),
    ("🇵🇱Польша", "Poland"),
    ("🇵🇹Португалия", "Portugal"),
    ("🇷🇴Румыния", "Romania"),
    ("🇸🇪Швеция", "Sweden"),
    ("🇸🇬Сингапур", "Singapore"),
    ("🇹🇭Таиланд", "Thailand"),
    ("🇹🇷Турция", "Turkey"),
    ("🇹🇼Тайвань", "Taiwan"),
    ("🇺🇦Украина", "Ukraine"),
    ("🇻🇳Вьетнам", "Vietnam"),
    ("🇿🇦Южно-Африканская Республика", "South Africa")
]

async def add_countries():
    # Connect to the database
    conn = await aiosqlite.connect("database.db")
    
    # Get the parent ID for "Приватный IPv4"
    cursor = await conn.execute("SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4'")
    private_ipv4 = await cursor.fetchone()
    
    if not private_ipv4:
        print("Private IPv4 category not found")
        await conn.close()
        return
    
    parent_id = private_ipv4[0]
    print(f"Adding countries to Private IPv4 category (ID: {parent_id})")
    
    # Add each country
    for i, (russian_name, english_name) in enumerate(additional_countries, start=1):
        try:
            # Check if country already exists
            cursor = await conn.execute("""
                SELECT id FROM catalog_items 
                WHERE name = ? AND parent_id = ? AND type = 'subcategory'
            """, (russian_name, parent_id))
            
            existing = await cursor.fetchone()
            if existing:
                print(f"✓ {russian_name} already exists (ID: {existing[0]})")
                continue
            
            # Add the country as a subcategory
            cursor = await conn.execute('''
                INSERT INTO catalog_items 
                (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
                 row_width, position, is_grid_3x6, search_button_name, back_button_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                parent_id,  # parent_id
                'subcategory',  # type
                russian_name,  # name
                f"🌐 <b>Приватный IPv4</b>  ›  <b>{russian_name.replace(russian_name[0:2], '')}</b>\n\nВыберите регион:",  # description
                None,  # sticker_id
                None,  # photo_id
                None,  # preview_link
                1,  # row_width
                i + 10,  # position (start from 10 to avoid conflicts)
                1,  # is_grid_3x6
                "🔎найти регион",  # search_button_name
                "к выбору страны"  # back_button_text
            ))
            
            await conn.commit()
            country_id = cursor.lastrowid
            print(f"✓ Added {russian_name} (ID: {country_id})")
            
        except Exception as e:
            print(f"✗ Error adding {russian_name}: {e}")
    
    await conn.close()
    print("\nFinished adding countries!")

if __name__ == "__main__":
    asyncio.run(add_countries())