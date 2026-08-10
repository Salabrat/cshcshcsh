import sqlite3

def check_u_countries():
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
    
    # Get countries starting with "🇺"
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' AND name LIKE '🇺%' 
        ORDER BY name
    """, (ipv6_id,))
    
    results = cursor.fetchall()
    
    print("IPv6 countries starting with 🇺:")
    for country_id, country_name in results:
        print(f"  ID: {country_id}, Name: {country_name}")
        
        # Check products
        cursor.execute("""
            SELECT COUNT(*) FROM catalog_items 
            WHERE parent_id = ? AND type = 'product'
        """, (country_id,))
        
        product_count = cursor.fetchone()[0]
        print(f"    Products: {product_count}")
    
    conn.close()

if __name__ == "__main__":
    check_u_countries()