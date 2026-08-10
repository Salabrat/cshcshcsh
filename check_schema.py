import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check the schema of product_prices table
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='product_prices'")
schema = cursor.fetchone()
if schema:
    print("Product prices table schema:")
    print(schema[0])
else:
    print("Table 'product_prices' not found")

# Check the schema of product_files table
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='product_files'")
schema = cursor.fetchone()
if schema:
    print("\nProduct files table schema:")
    print(schema[0])
else:
    print("Table 'product_files' not found")

conn.close()