import sqlite3

def check_database_structure():
    conn = sqlite3.connect('database.db')
    
    # Get table structure
    cursor = conn.execute('PRAGMA table_info(catalog_items)')
    columns = cursor.fetchall()
    print('Catalog items table structure:')
    for col in columns:
        print(f'  {col[1]} ({col[2]})')
    
    # Get sample data by type
    print('\nSample data by type:')
    cursor = conn.execute('SELECT type, COUNT(*) FROM catalog_items GROUP BY type')
    data = cursor.fetchall()
    for row in data:
        print(f'  {row[0]}: {row[1]}')
    
    # Check for countries and products
    cursor = conn.execute('SELECT COUNT(*) FROM catalog_items WHERE type = "country"')
    country_count = cursor.fetchone()[0]
    print(f'\nCountries: {country_count}')
    
    cursor = conn.execute('SELECT COUNT(*) FROM catalog_items WHERE type = "product"')
    product_count = cursor.fetchone()[0]
    print(f'Products: {product_count}')
    
    # Get sample countries
    if country_count > 0:
        cursor = conn.execute('SELECT id, name FROM catalog_items WHERE type = "country" ORDER BY name LIMIT 5')
        countries = cursor.fetchall()
        print('\nSample countries:')
        for country in countries:
            print(f'  {country[1]}')
    
    # Get sample products
    if product_count > 0:
        cursor = conn.execute('SELECT id, name, description FROM catalog_items WHERE type = "product" ORDER BY name LIMIT 3')
        products = cursor.fetchall()
        print('\nSample products:')
        for product in products:
            print(f'  {product[1]}')
            print(f'    Description: {product[2][:100]}...')
    
    conn.close()

if __name__ == "__main__":
    check_database_structure()