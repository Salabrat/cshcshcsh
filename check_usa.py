import sqlite3

def check_usa():
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
    
    # Check all countries in IPv6 that contain "США"
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND name LIKE '%США%' AND type = 'subcategory'
    """, (ipv6_id,))
    
    ipv6_countries = cursor.fetchall()
    
    print("IPv6 countries containing 'США':")
    for country in ipv6_countries:
        print(f"  ID: {country[0]}, Name: {country[1]}")
    
    # Check all countries in IPv6 that contain "USA"
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND name LIKE '%USA%' AND type = 'subcategory'
    """, (ipv6_id,))
    
    ipv6_countries = cursor.fetchall()
    
    print("\nIPv6 countries containing 'USA':")
    for country in ipv6_countries:
        print(f"  ID: {country[0]}, Name: {country[1]}")
    
    conn.close()

if __name__ == "__main__":
    check_usa()