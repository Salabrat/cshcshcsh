import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

print("=== Final Verification of City Names ===\n")

# Check cities for several countries (using actual names from database)
countries_to_check = [
    ("🇷🇺Россия", "Москва"),
    ("🇺🇸США", "Нью-Йорк"),
    ("🇫🇷Франция", "Париж"),
    ("🇩🇪Германия", "Берлин"),
    ("🇯🇵Япония", "Токио"),
    ("🇨🇳Китай", "Пекин")
]

for country_name, expected_city in countries_to_check:
    # Get country ID
    cursor.execute("SELECT id FROM catalog_items WHERE name = ? AND type = 'subcategory'", (country_name,))
    country_result = cursor.fetchone()
    
    if country_result:
        country_id = country_result[0]
        # Count cities for this country
        cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'product'", (country_id,))
        city_count = cursor.fetchone()[0]
        
        # Get first city for this country
        cursor.execute("SELECT name FROM catalog_items WHERE parent_id = ? AND type = 'product' LIMIT 1", (country_id,))
        city_result = cursor.fetchone()
        
        if city_result:
            print(f"{country_name}: {city_count} cities, first city: {city_result[0]}")
        else:
            print(f"{country_name}: {city_count} cities, no city names found")
    else:
        print(f"{country_name}: Country not found")

print("\n=== Verification Complete ===")

# Check if there are any products with generic names
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = 'product' AND name LIKE '%Центральный район%'")
generic_count = cursor.fetchone()[0]
print(f"\nProducts with generic names: {generic_count}")

# Check total products
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = 'product'")
total_products = cursor.fetchone()[0]
print(f"Total products: {total_products}")

conn.close()