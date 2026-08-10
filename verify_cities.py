import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get the "Приватный IPv4" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%'")
proxy_category = cursor.fetchone()

if proxy_category:
    proxy_id, proxy_name = proxy_category
    
    # Get a few sample countries
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' ORDER BY name LIMIT 5", (proxy_id,))
    countries = cursor.fetchall()
    
    print("Sample countries and their cities:")
    
    for country_id, country_name in countries:
        country_name_clean = country_name[2:] if len(country_name) > 2 else country_name
        print(f"\n{country_name_clean}:")
        
        # Get cities for this country
        cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'product' ORDER BY name", (country_id,))
        cities = cursor.fetchall()
        
        for city_id, city_name in cities[:3]:  # Show first 3 cities
            print(f"  - {city_name}")
        
        if len(cities) > 3:
            print(f"  ... and {len(cities) - 3} more cities")

conn.close()