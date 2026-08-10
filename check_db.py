import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get count of subcategories (countries)
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = 'subcategory'")
subcategory_count = cursor.fetchone()[0]
print(f"Number of countries (subcategories): {subcategory_count}")

# Get products count per country (showing distribution)
cursor.execute("SELECT COUNT(*) as product_count FROM catalog_items WHERE type = 'product' GROUP BY parent_id ORDER BY product_count")
results = cursor.fetchall()

# Count how many countries have different numbers of products
product_counts = {}
for (count,) in results:
    if count in product_counts:
        product_counts[count] += 1
    else:
        product_counts[count] = 1

print("\nDistribution of products per country:")
for count in sorted(product_counts.keys()):
    print(f"  {product_counts[count]} countries with {count} products")

# Get total products
cursor.execute("SELECT COUNT(*) FROM catalog_items WHERE type = 'product'")
total_products = cursor.fetchone()[0]
print(f"\nTotal products: {total_products}")

# Check how many countries have at least 19 products
cursor.execute("""
    SELECT COUNT(*) 
    FROM (
        SELECT parent_id, COUNT(*) as product_count 
        FROM catalog_items 
        WHERE type = 'product' 
        GROUP BY parent_id 
        HAVING COUNT(*) >= 19
    )
""")
countries_with_19_plus = cursor.fetchone()[0]
print(f"\nCountries with at least 19 products: {countries_with_19_plus}")

conn.close()