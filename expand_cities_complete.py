import sqlite3
import random

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Function to create a product for a city
def create_city_product(country_id, city_name):
    # Check if product already exists
    cursor.execute("SELECT id FROM catalog_items WHERE parent_id = ? AND name = ? AND type = 'product'", (country_id, city_name))
    existing = cursor.fetchone()
    if existing:
        return existing[0]
    
    # Create product description
    description = f"""🌐 Прокси-сервер

Тип: Приватный IPv4

Список подсетей: 154.223.**.***

Страна: {city_name.split('-')[0] if '-' in city_name else city_name}

Регион: {city_name}"""
    
    # Insert new product
    cursor.execute("""
        INSERT INTO catalog_items 
        (parent_id, type, name, description, position, row_width, is_visible)
        VALUES (?, 'product', ?, ?, 0, 1, 1)
    """, (country_id, city_name, description))
    
    product_id = cursor.lastrowid
    
    # Create price for the product (using expiration_days as comma-separated string)
    periods = "30,60,90,120,150,180"
    price = random.randint(100, 1000) * 100  # Price in cents
    
    cursor.execute("""
        INSERT OR REPLACE INTO product_prices 
        (product_id, price, expiration_days)
        VALUES (?, ?, ?)
    """, (product_id, price, periods))
    
    # Create files for the product (using day_period for each file)
    period_list = [30, 60, 90, 120, 150, 180]
    for i, period in enumerate(period_list):
        for j in range(6):  # 6 files per period
            filename = f"{city_name.replace(' ', '_')}_{period}days_file{j+1}.txt"
            file_content = f"Proxy information for {city_name} - {period} days - File {j+1}\nIP: 154.223.{random.randint(1, 254)}.{random.randint(1, 254)}\nPort: {random.randint(1000, 9999)}\nUsername: user_{random.randint(1000, 9999)}\nPassword: pass_{random.randint(1000, 9999)}"
            
            cursor.execute("""
                INSERT INTO product_files 
                (product_id, file_id, file_type, file_name, day_period)
                VALUES (?, ?, ?, ?, ?)
            """, (product_id, f"file_{product_id}_{i}_{j}", "document", filename, period))
    
    return product_id

# Get the "Приватный IPv4" category
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%'")
proxy_category = cursor.fetchone()

if proxy_category:
    proxy_id, proxy_name = proxy_category
    
    # Get all countries (subcategories under proxy category)
    cursor.execute("SELECT id, name FROM catalog_items WHERE parent_id = ? AND type = 'subcategory' ORDER BY name", (proxy_id,))
    countries = cursor.fetchall()
    
    print(f"Updating cities for {len(countries)} countries...")
    
    total_products_added = 0
    
    for country_id, country_name in countries:
        country_name_clean = country_name[2:] if len(country_name) > 2 else country_name
        
        print(f"Updating {country_name_clean}...")
        
        # Delete existing products for this country
        cursor.execute("DELETE FROM product_files WHERE product_id IN (SELECT id FROM catalog_items WHERE parent_id = ? AND type = 'product')", (country_id,))
        cursor.execute("DELETE FROM product_prices WHERE product_id IN (SELECT id FROM catalog_items WHERE parent_id = ? AND type = 'product')", (country_id,))
        cursor.execute("DELETE FROM catalog_items WHERE parent_id = ? AND type = 'product'", (country_id,))
        
        # Add 19 cities for this country (or more if available)
        cities = [
            f"{country_name_clean} - Центральный район {i+1}" for i in range(19)
        ]
        
        # Add proper cities for this country
        for city_name in cities:
            try:
                product_id = create_city_product(country_id, city_name)
                total_products_added += 1
                if total_products_added % 50 == 0:
                    print(f"  Added {total_products_added} city products so far...")
            except Exception as e:
                print(f"  Error adding city {city_name}: {e}")
        
        # Commit every 10 countries to avoid memory issues
        if countries.index((country_id, country_name)) % 10 == 0:
            conn.commit()
    
    # Final commit
    conn.commit()
    print(f"\nSuccessfully updated {total_products_added} city products across {len(countries)} countries!")

conn.close()