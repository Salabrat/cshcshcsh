import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get all top-level catalog items
cursor.execute("SELECT id, type, name FROM catalog_items WHERE parent_id IS NULL")
top_level = cursor.fetchall()

print("Top-level catalog items:")
for item in top_level:
    print(f"ID: {item[0]}, Type: {item[1]}, Name: {item[2]}")

# Get all themes
cursor.execute("SELECT id, name FROM catalog_items WHERE type = 'theme'")
themes = cursor.fetchall()

print("\nThemes:")
for theme in themes:
    print(f"ID: {theme[0]}, Name: {theme[1]}")

conn.close()