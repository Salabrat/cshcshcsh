import sqlite3

def list_ipv6_countries():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватные IPv6" category
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv6_category:
        print("IPv6 category not found!")
        conn.close()
        return
    
    ipv6_id = ipv6_category[0]
    
    # Get all countries from IPv6
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' 
        ORDER BY name
    """, (ipv6_id,))
    
    ipv6_countries = cursor.fetchall()
    
    print(f"Found {len(ipv6_countries)} countries in IPv6:")
    for i, (country_id, country_name) in enumerate(ipv6_countries):
        print(f"  {i+1:3d}. ID: {country_id:5d}, Name: {country_name}")
        
        # For the first few countries, also show product count
        if i < 5:
            cursor.execute("""
                SELECT COUNT(*) FROM catalog_items 
                WHERE parent_id = ? AND type = 'product'
            """, (country_id,))
            
            product_count = cursor.fetchone()[0]
            print(f"       Products: {product_count}")
    
    conn.close()

if __name__ == "__main__":
    list_ipv6_countries()