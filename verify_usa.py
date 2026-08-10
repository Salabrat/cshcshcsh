import sqlite3

def verify_usa():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the USA from IPv4
    cursor.execute("SELECT id FROM catalog_items WHERE name = '🇺🇸США' AND parent_id = (SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4')")
    ipv4_usa = cursor.fetchone()
    
    # Get the USA from IPv6
    cursor.execute("SELECT id FROM catalog_items WHERE name = '🇺🇸США' AND parent_id = (SELECT id FROM catalog_items WHERE name = '👤 Приватные IPv6')")
    ipv6_usa = cursor.fetchone()
    
    if not ipv4_usa:
        print("IPv4 USA not found!")
        conn.close()
        return
        
    if not ipv6_usa:
        print("IPv6 USA not found!")
        conn.close()
        return
    
    ipv4_usa_id = ipv4_usa[0]
    ipv6_usa_id = ipv6_usa[0]
    
    print(f"IPv4 USA ID: {ipv4_usa_id}")
    print(f"IPv6 USA ID: {ipv6_usa_id}")
    
    # Count products in IPv4 USA
    cursor.execute("""
        SELECT COUNT(*) FROM catalog_items 
        WHERE parent_id = ? AND type = 'product'
    """, (ipv4_usa_id,))
    
    ipv4_product_count = cursor.fetchone()[0]
    
    # Count products in IPv6 USA
    cursor.execute("""
        SELECT COUNT(*) FROM catalog_items 
        WHERE parent_id = ? AND type = 'product'
    """, (ipv6_usa_id,))
    
    ipv6_product_count = cursor.fetchone()[0]
    
    print(f"IPv4 USA products: {ipv4_product_count}")
    print(f"IPv6 USA products: {ipv6_product_count}")
    
    if ipv4_product_count == ipv6_product_count:
        print("✓ Product counts match")
    else:
        print("✗ Product counts don't match")
    
    conn.close()

if __name__ == "__main__":
    verify_usa()