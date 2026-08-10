import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get the "Прокси" theme
cursor.execute("SELECT id, name FROM catalog_items WHERE name = '🌐Прокси'")
proxy_theme = cursor.fetchone()

if proxy_theme:
    theme_id = proxy_theme[0]
    print(f"Proxy theme found: ID {theme_id}, Name: {proxy_theme[1]}")
    
    # Get children of the proxy theme
    cursor.execute("SELECT id, type, name FROM catalog_items WHERE parent_id = ?", (theme_id,))
    children = cursor.fetchall()
    
    print(f"\nChildren of Proxy theme:")
    for child in children:
        print(f"ID: {child[0]}, Type: {child[1]}, Name: {child[2]}")
        
        # If this is a category, get its subcategories/products
        if child[1] in ['category', 'subcategory']:
            cursor.execute("SELECT id, type, name FROM catalog_items WHERE parent_id = ?", (child[0],))
            subchildren = cursor.fetchall()
            
            print(f"  Sub-items of {child[2]}:")
            for subchild in subchildren[:5]:  # Show only first 5 to avoid too much output
                print(f"    ID: {subchild[0]}, Type: {subchild[1]}, Name: {subchild[2]}")
            if len(subchildren) > 5:
                print(f"    ... and {len(subchildren) - 5} more items")
else:
    print("Proxy theme not found")

conn.close()