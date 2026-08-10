import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get the "Приватный IPv4" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name = '👤Приватный IPv4'")
ipv4_category = cursor.fetchone()

# Get the "Приватные IPv6" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name = '👤 Приватные IPv6'")
ipv6_category = cursor.fetchone()

print("Categories found:")
if ipv4_category:
    print(f"IPv4 Category: ID {ipv4_category[0]}, Name: {ipv4_category[1]}")
else:
    print("IPv4 Category: Not found")

if ipv6_category:
    print(f"IPv6 Category: ID {ipv6_category[0]}, Name: {ipv6_category[1]}")
else:
    print("IPv6 Category: Not found")

# If both categories exist, check their contents
if ipv4_category and ipv6_category:
    ipv4_id = ipv4_category[0]
    ipv6_id = ipv6_category[0]
    
    # Count countries in IPv4
    cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'subcategory'", (ipv4_id,))
    ipv4_count = cursor.fetchone()[0]
    
    # Count countries in IPv6
    cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ? AND type = 'subcategory'", (ipv6_id,))
    ipv6_count = cursor.fetchone()[0]
    
    print(f"\nIPv4 Countries: {ipv4_count}")
    print(f"IPv6 Countries: {ipv6_count}")
    
    # Show first 5 countries in each
    print("\nFirst 5 IPv4 countries:")
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' LIMIT 5", (ipv4_id,))
    ipv4_countries = cursor.fetchall()
    for country in ipv4_countries:
        print(f"  ID: {country[0]}, Name: {country[1]}")
        
    print("\nFirst 5 IPv6 countries:")
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' LIMIT 5", (ipv6_id,))
    ipv6_countries = cursor.fetchall()
    for country in ipv6_countries:
        print(f"  ID: {country[0]}, Name: {country[1]}")

conn.close()