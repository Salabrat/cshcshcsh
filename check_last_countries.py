import sqlite3

def check_last_countries():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватные IPv6" category ID
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv6_category:
        print("IPv6 category not found!")
        conn.close()
        return
    
    ipv6_id = ipv6_category[0]
    
    # Get last 10 countries alphabetically
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' 
        ORDER BY name DESC 
        LIMIT 10
    """, (ipv6_id,))
    
    results = cursor.fetchall()
    
    print("Last 10 IPv6 countries (alphabetically):")
    for country_id, country_name in results:
        print(f"  ID: {country_id}, Name: {country_name}")
        
        # Check products for the last few
        cursor.execute("""
            SELECT COUNT(*) FROM catalog_items 
            WHERE parent_id = ? AND type = 'product'
        """, (country_id,))
        
        product_count = cursor.fetchone()[0]
        print(f"    Products: {product_count}")
    
    conn.close()

if __name__ == "__main__":
    check_last_countries()