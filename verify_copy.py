import sqlite3

def verify_copy():
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
    
    # Check a few sample countries
    sample_countries = ['🇷🇺Россия', '🇫🇷Франция', '🇺🇸США']
    
    for country_name in sample_countries:
        print(f"\nChecking {country_name}:")
        
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
        
        if not ipv4_country:
            print(f"  IPv4 country not found")
            continue
            
        if not ipv6_country:
            print(f"  IPv6 country not found")
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
        
        print(f"  IPv4 products: {ipv4_product_count}")
        print(f"  IPv6 products: {ipv6_product_count}")
        
        if ipv4_product_count == ipv6_product_count:
            print(f"  ✓ Product counts match")
        else:
            print(f"  ✗ Product counts don't match")
    
    conn.close()

if __name__ == "__main__":
    verify_copy()