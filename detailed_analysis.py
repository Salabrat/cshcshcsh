import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check for items with empty type
print("Checking items with empty type:")
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = ''")
empty_type_count = cursor.fetchone()[0]
print(f"  Empty type count: {empty_type_count}")

# Check for items with NULL type
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type IS NULL")
null_type_count = cursor.fetchone()[0]
print(f"  NULL type count: {null_type_count}")

# Check the distribution of types
print("\nAll item types and counts:")
cursor.execute("SELECT type, COUNT(*) as count FROM catalog_items GROUP BY type ORDER BY count DESC")
types = cursor.fetchall()
for item_type, count in types:
    print(f"  '{item_type}': {count}")

# Check items with parent_id NULL (top-level items)
print("\nTop-level items (parent_id IS NULL):")
cursor.execute("SELECT type, COUNT(*) FROM catalog_items WHERE parent_id IS NULL GROUP BY type")
top_level = cursor.fetchall()
for item_type, count in top_level:
    print(f"  {item_type}: {count}")

# Check a sample of items with parent_id NULL and type = 'category'
print("\nSample categories (parent_id IS NULL, type = 'category'):")
cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id IS NULL AND type = 'category' LIMIT 5")
categories = cursor.fetchall()
for cat_id, cat_name in categories:
    print(f"  {cat_id}. {cat_name}")

# For each category, check how many sub-items it has
print("\nSub-items per category:")
for cat_id, cat_name in categories:
    cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE parent_id = ?", (cat_id,))
    sub_count = cursor.fetchone()[0]
    print(f"  {cat_name}: {sub_count} sub-items")

conn.close()