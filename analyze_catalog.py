import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get distinct types and their counts
cursor.execute("SELECT type, COUNT(*) FROM catalog_items GROUP BY type")
types = cursor.fetchall()
print("Item types in catalog:")
for item_type, count in types:
    print(f"  {item_type}: {count}")

# Get countries (items with no parent_id)
cursor.execute("SELECT id, name FROM catalog_items WHERE type = 'country' ORDER BY name")
countries = cursor.fetchall()
print(f"\nTotal countries: {len(countries)}")

# Show first 10 countries
print("\nFirst 10 countries:")
for i, (country_id, country_name) in enumerate(countries[:10]):
    print(f"  {i+1}. {country_name}")

# For each country, get the number of products/cities
print("\nCities per country (first 5 countries):")
for country_id, country_name in countries[:5]:
    cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'product'", (country_id,))
    city_count = cursor.fetchone()[0]
    print(f"  {country_name}: {city_count} cities")

# Get sample products for one country
if countries:
    first_country_id, first_country_name = countries[0]
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'product' ORDER BY name LIMIT 5", (first_country_id,))
    cities = cursor.fetchall()
    print(f"\nSample cities for {first_country_name}:")
    for city_id, city_name in cities:
        print(f"  - {city_name}")

conn.close()