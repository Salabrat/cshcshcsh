import sqlite3

def verify_changes():
    conn = sqlite3.connect('database.db')
    
    # Check for products still containing the text to be removed
    cursor = conn.execute('''
        SELECT COUNT(*) FROM catalog_items 
        WHERE type = "product" AND description LIKE "%генерируй в зависимости от страны/региона%"
    ''')
    count1 = cursor.fetchone()[0]
    print(f'Products still containing "генерируй в зависимости от страны/региона": {count1}')
    
    # Check for products with incorrect IP format
    cursor = conn.execute('''
        SELECT COUNT(*) FROM catalog_items 
        WHERE type = "product" AND description LIKE "%154.223.*.*.*.*%"
    ''')
    count2 = cursor.fetchone()[0]
    print(f'Products with incorrect IP format: {count2}')
    
    # Check for products with correct IP format
    cursor = conn.execute('''
        SELECT COUNT(*) FROM catalog_items 
        WHERE type = "product" AND description LIKE "%154.223.**.***%"
    ''')
    count3 = cursor.fetchone()[0]
    print(f'Products with correct IP format: {count3}')
    
    # Total proxy products
    cursor = conn.execute('''
        SELECT COUNT(*) FROM catalog_items 
        WHERE type = "product" AND description LIKE "%Прокси%"
    ''')
    total = cursor.fetchone()[0]
    print(f'Total proxy products: {total}')
    
    conn.close()

if __name__ == "__main__":
    verify_changes()