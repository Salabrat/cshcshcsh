import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check how many products exist
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = 'product'")
product_count = cursor.fetchone()[0]
print(f"Total products: {product_count}")

# Check how many subcategories (countries) exist
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = 'subcategory'")
subcategory_count = cursor.fetchone()[0]
print(f"Total countries: {subcategory_count}")

# List some countries
cursor.execute("SELECT name FROM catalog_items WHERE type = 'subcategory' LIMIT 5")
countries = cursor.fetchall()
print("\nSample countries:")
for country in countries:
    print(f"  {country[0]}")

# Check if there are any products with real city names
cursor.execute("SELECT name FROM catalog_items WHERE type = 'product' AND name = 'Москва'")
moscow_result = cursor.fetchone()
if moscow_result:
    print(f"\nFound Moscow: {moscow_result[0]}")
else:
    print("\nMoscow not found")

# Check if there are any products with generic names
cursor.execute("SELECT name FROM catalog_items WHERE type = 'product' AND name LIKE '%Центральный район%'")
generic_result = cursor.fetchone()
if generic_result:
    print(f"Found generic name: {generic_result[0]}")
else:
    print("No generic names found")

conn.close()