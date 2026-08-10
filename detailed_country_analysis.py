import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get the "Приватный IPv4" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%'")
proxy_category = cursor.fetchone()

if proxy_category:
    proxy_id, proxy_name = proxy_category
    
    # Get all countries (subcategories under proxy category)
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' ORDER BY name", (proxy_id,))
    countries = cursor.fetchall()
    
    print("Detailed analysis of countries and their cities:")
    
    # For each country, get all cities
    countries_with_few_cities = []
    for country_id, country_name in countries:
        country_name_clean = country_name[2:] if len(country_name) > 2 else country_name
        cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'product' ORDER BY name", (country_id,))
        cities = cursor.fetchall()
        
        if len(cities) < 10:
            countries_with_few_cities.append((country_name_clean, len(cities), country_id))
        
        # Show countries with few cities
        if len(cities) <= 5:
            print(f"\n{country_name_clean}: {len(cities)} cities")
            for city_id, city_name in cities:
                print(f"  - {city_name}")

print(f"\nTotal countries with 5 or fewer cities: {len(countries_with_few_cities)}")

# Show countries with the fewest cities
countries_with_few_cities.sort(key=lambda x: x[1])
print("\nCountries with the fewest cities:")
for country_name, city_count, country_id in countries_with_few_cities[:10]:
    print(f"  {country_name}: {city_count} cities (ID: {country_id})")

conn.close()