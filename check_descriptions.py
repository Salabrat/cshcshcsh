import sqlite3

def check_sample_descriptions():
    conn = sqlite3.connect('database.db')
    cursor = conn.execute('''
        SELECT id, name, description 
        FROM catalog_items 
        WHERE type = "product" AND description LIKE "%Прокси%" 
        LIMIT 3
    ''')
    products = cursor.fetchall()
    
    print(f"Found {len(products)} sample products:")
    for p in products:
        print(f'ID: {p[0]}')
        print(f'Name: {p[1]}')
        print(f'Description: {p[2]}')
        print('---')
    
    conn.close()

if __name__ == "__main__":
    check_sample_descriptions()