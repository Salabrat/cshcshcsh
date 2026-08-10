import sqlite3

def final_verification():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватный IPv4" category
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4'")
    ipv4_category = cursor.fetchone()
    
    # Get the "Приватные IPv6" category
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv4_category or not ipv6_category:
        print("Categories not found!")
        conn.close()
        return
    
    ipv4_id = ipv4_category[0]
    ipv6_id = ipv6_category[0]
    
    # Count countries in IPv4
    cursor.execute("""
        SELECT COUNT(*) FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory'
    """, (ipv4_id,))
    
    ipv4_country_count = cursor.fetchone()[0]
    
    # Count countries in IPv6
    cursor.execute("""
        SELECT COUNT(*) FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory'
    """, (ipv6_id,))
    
    ipv6_country_count = cursor.fetchone()[0]
    
    print(f"IPv4 countries: {ipv4_country_count}")
    print(f"IPv6 countries: {ipv6_country_count}")
    
    if ipv4_country_count <= ipv6_country_count:
        print("✓ All IPv4 countries have been copied to IPv6")
    else:
        print(f"✗ Missing {ipv4_country_count - ipv6_country_count} countries in IPv6")
    
    # Check a few sample countries to verify products
    sample_countries = ['🇷🇺Россия', '🇫🇷Франция', '🇺🇸США', '🇦🇺Австралия']
    
    all_match = True
    for country_name in sample_countries:
        # Get IPv4 country
        cursor.execute("""
            SELECT id FROM catalog_items 
            WHERE parent_id = ? AND name = ? AND type = 'subcategory'
        """, (ipv4_id, country_name))
        
        ipv4_country = cursor.fetchone()
        
        # Get IPv6 country
        cursor.execute("""
            SELECT id FROM catalog_items 
            WHERE parent_id = ? AND name = ? AND type = 'subcategory'
        """, (ipv6_id, country_name))
        
        ipv6_country = cursor.fetchone()
        
        if not ipv4_country or not ipv6_country:
            print(f"✗ Country {country_name} not found in both IPv4 and IPv6")
            all_match = False
            continue
            
        ipv4_country_id = ipv4_country[0]
        ipv6_country_id = ipv6_country[0]
        
        # Count products in IPv4 country
        cursor.execute("""
            SELECT COUNT(*) FROM catalog_items 
            WHERE parent_id = ? AND type = 'product'
        """, (ipv4_country_id,))
        
        ipv4_product_count = cursor.fetchone()[0]
        
        # Count products in IPv6 country
        cursor.execute("""
            SELECT COUNT(*) FROM catalog_items 
            WHERE parent_id = ? AND type = 'product'
        """, (ipv6_country_id,))
        
        ipv6_product_count = cursor.fetchone()[0]
        
        if ipv4_product_count == ipv6_product_count:
            print(f"✓ {country_name}: {ipv4_product_count} products match")
        else:
            print(f"✗ {country_name}: IPv4={ipv4_product_count}, IPv6={ipv6_product_count}")
            all_match = False
    
    if all_match:
        print("\n✓ All sample countries have matching product counts")
    else:
        print("\n✗ Some countries have mismatched product counts")
    
    conn.close()

if __name__ == "__main__":
    final_verification()