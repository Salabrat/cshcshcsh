import sqlite3

def find_usa():
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
    
    # Search for USA-related countries
    search_terms = ['США', 'USA', 'United States', 'Америка']
    
    for term in search_terms:
        cursor.execute("""
            SELECT id, name FROM catalog_items 
            WHERE parent_id = ? AND name LIKE ? AND type = 'subcategory'
            ORDER BY name
        """, (ipv6_id, f'%{term}%'))
        
        results = cursor.fetchall()
        
        if results:
            print(f"Countries matching '{term}':")
            for country_id, country_name in results:
                print(f"  ID: {country_id}, Name: {country_name}")
        else:
            print(f"No countries matching '{term}'")
    
    conn.close()

if __name__ == "__main__":
    find_usa()