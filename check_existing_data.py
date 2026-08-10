import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check some existing product prices
cursor.execute("SELECT * FROM product_prices LIMIT 5")
prices = cursor.fetchall()
print("Sample product prices:")
for price in prices:
    print(price)

# Check some existing product files
cursor.execute("SELECT * FROM product_files LIMIT 5")
files = cursor.fetchall()
print("\nSample product files:")
for file in files:
    print(file)

# Check how many prices each product has
cursor.execute("""
    SELECT product_id, COUNT(*) as count 
    FROM product_prices 
    GROUP BY product_id 
    HAVING COUNT(*) > 1 
    LIMIT 5
""")
multiple_prices = cursor.fetchall()
print("\nProducts with multiple prices:")
for product in multiple_prices:
    print(product)

conn.close()