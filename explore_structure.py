import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check themes (top-level items)
print("Themes (top-level items):")
cursor.execute("SELECT id, name FROM catalog_items WHERE type = 'theme' ORDER BY name")
themes = cursor.fetchall()
for theme_id, theme_name in themes:
    print(f"  {theme_id}. {theme_name}")

# Check categories
print("\nCategories:")
cursor.execute("SELECT id, name, parent_id FROM catalog_items WHERE type = 'category' ORDER BY name")
categories = cursor.fetchall()
for cat_id, cat_name, parent_id in categories:
    print(f"  {cat_id}. {cat_name} (parent: {parent_id})")

# Check subcategories
print("\nSubcategories:")
cursor.execute("SELECT id, name, parent_id FROM catalog_items WHERE type = 'subcategory' ORDER BY name LIMIT 10")
subcategories = cursor.fetchall()
for subcat_id, subcat_name, parent_id in subcategories:
    print(f"  {subcat_id}. {subcat_name} (parent: {parent_id})")

# Check products
print("\nProducts (first 10):")
cursor.execute("SELECT id, name, parent_id FROM catalog_items WHERE type = 'product' ORDER BY name LIMIT 10")
products = cursor.fetchall()
for prod_id, prod_name, parent_id in products:
    print(f"  {prod_id}. {prod_name} (parent: {parent_id})")

# Check the hierarchy for one theme
if themes:
    theme_id, theme_name = themes[0]
    print(f"\nItems under theme '{theme_name}' (id: {theme_id}):")
    cursor.execute("SELECT id, name, type FROM catalog_items WHERE parent_id = ? ORDER BY type, name", (theme_id,))
    children = cursor.fetchall()
    for child_id, child_name, child_type in children:
        print(f"  {child_type}: {child_id}. {child_name}")

conn.close()