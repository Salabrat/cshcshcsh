import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get the "Приватный IPv4" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%'")
proxy_category = cursor.fetchone()
print(f"Proxy category: {proxy_category}")

if proxy_category:
    proxy_id, proxy_name = proxy_category
    
    # Get all countries (subcategories under proxy category)
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' ORDER BY name", (proxy_id,))
    countries = cursor.fetchall()
    print(f"\nTotal countries: {len(countries)}")
    
    # Show first 10 countries
    print("\nFirst 10 countries:")
    for i, (country_id, country_name) in enumerate(countries[:10]):
        # Remove flag emoji (first 2 characters)
        country_name_clean = country_name[2:] if len(country_name) > 2 else country_name
        print(f"  {i+1}. {country_name_clean}")
    
    # For each country, get the number of cities (products)
    print("\nCities per country (first 10 countries):")
    total_cities = 0
    for country_id, country_name in countries[:10]:
        country_name_clean = country_name[2:] if len(country_name) > 2 else country_name
        cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'product'", (country_id,))
        city_count = cursor.fetchone()[0]
        total_cities += city_count
        print(f"  {country_name_clean}: {city_count} cities")
    
    # Get total cities
    for country_id, country_name in countries[10:]:
        cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'product'", (country_id,))
        city_count = cursor.fetchone()[0]
        total_cities += city_count
    
    print(f"\nTotal cities across all countries: {total_cities}")
    print(f"Average cities per country: {total_cities / len(countries):.1f}")

conn.close()