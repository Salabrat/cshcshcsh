import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get the "Приватный IPv4" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%'")
proxy_category = cursor.fetchone()

if proxy_category:
    proxy_id, proxy_name = proxy_category
    
    # Get all countries and count their cities
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' ORDER BY name", (proxy_id,))
    countries = cursor.fetchall()
    
    print(f"Total countries: {len(countries)}")
    
    # Count cities per country
    city_counts = []
    for country_id, country_name in countries:
        cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'product'", (country_id,))
        city_count = cursor.fetchone()[0]
        city_counts.append(city_count)
    
    # Statistics
    min_cities = min(city_counts)
    max_cities = max(city_counts)
    avg_cities = sum(city_counts) / len(city_counts)
    
    print(f"Minimum cities per country: {min_cities}")
    print(f"Maximum cities per country: {max_cities}")
    print(f"Average cities per country: {avg_cities:.1f}")
    
    # Count how many countries have less than 19 cities
    countries_below_19 = sum(1 for count in city_counts if count < 19)
    print(f"Countries with less than 19 cities: {countries_below_19}")
    
    # Show countries with the least cities
    print("\nCountries with the least cities:")
    country_city_pairs = list(zip(countries, city_counts))
    country_city_pairs.sort(key=lambda x: x[1])
    
    for i in range(min(10, len(country_city_pairs))):
        country, city_count = country_city_pairs[i]
        country_name_clean = country[1][2:] if len(country[1]) > 2 else country[1]
        print(f"  {country_name_clean}: {city_count} cities")

conn.close()