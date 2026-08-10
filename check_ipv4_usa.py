import sqlite3

def check_ipv4_usa():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватный IPv4" category ID
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4'")
    ipv4_category = cursor.fetchone()
    
    if not ipv4_category:
        print("IPv4 category not found!")
        conn.close()
        return
    
    ipv4_id = ipv4_category[0]
    
    # Search for USA in IPv4
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND name LIKE '%США%' AND type = 'subcategory'
        ORDER BY name
    """, (ipv4_id,))
    
    results = cursor.fetchall()
    
    if results:
        print("IPv4 countries matching 'США':")
        for country_id, country_name in results:
            print(f"  ID: {country_id}, Name: {country_name}")
            
            # Check products
            cursor.execute("""
                SELECT COUNT(*) FROM catalog_items 
                WHERE parent_id = ? AND type = 'product'
            """, (country_id,))
            
            product_count = cursor.fetchone()[0]
            print(f"    Products: {product_count}")
    else:
        print("No IPv4 countries matching 'США'")
    
    conn.close()

if __name__ == "__main__":
    check_ipv4_usa()