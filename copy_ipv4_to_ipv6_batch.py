import sqlite3
import time

def copy_country_batch(start_index, batch_size=10):
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватный IPv4" category
    cursor.execute("SELECT id, name FROM catalog_items WHERE name = '👤Приватный IPv4'")
    ipv4_category = cursor.fetchone()
    
    # Get the "Приватные IPv6" category
    cursor.execute("SELECT id, name FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv4_category or not ipv6_category:
        print("Categories not found!")
        conn.close()
        return 0, 0
    
    ipv4_id = ipv4_category[0]
    ipv6_id = ipv6_category[0]
    
    # Get a batch of countries from IPv4
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' 
        ORDER BY name
        LIMIT ? OFFSET ?
    """, (ipv4_id, batch_size, start_index))
    
    ipv4_countries = cursor.fetchall()
    
    if not ipv4_countries:
        print("No more countries to process")
        conn.close()
        return 0, 0
    
    print(f"Processing batch starting at index {start_index}: {len(ipv4_countries)} countries")
    
    copied_countries = 0
    copied_products = 0
    
    for country_id, country_name in ipv4_countries:
        print(f"Processing country: {country_name}")
        
        # Check if this country already exists in IPv6
        cursor.execute("""
            SELECT id FROM catalog_items 
            WHERE parent_id = ? AND name = ? AND type = 'subcategory'
        """, (ipv6_id, country_name))
        
        existing_country = cursor.fetchone()
        
        new_country_id = None
        if existing_country:
            # Country already exists
            new_country_id = existing_country[0]
            print(f"  Country already exists in IPv6 (ID: {new_country_id})")
        else:
            # Copy the country to IPv6
            try:
                cursor.execute("""
                    INSERT INTO catalog_items 
                    (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
                     row_width, position, is_grid_3x6, search_button_name, back_button_text)
                    SELECT ?, type, name, description, sticker_id, photo_id, preview_link, 
                           row_width, position, is_grid_3x6, search_button_name, back_button_text
                    FROM catalog_items 
                    WHERE id = ?
                """, (ipv6_id, country_id))
                
                new_country_id = cursor.lastrowid
                conn.commit()
                copied_countries += 1
                print(f"  Created new country in IPv6: {country_name} (ID: {new_country_id})")
            except Exception as e:
                print(f"  Error copying country: {e}")
                continue
        
        # Copy products (regions) from IPv4 country to IPv6 country
        cursor.execute("""
            SELECT id, name, description FROM catalog_items 
            WHERE parent_id = ? AND type = 'product' 
            ORDER BY position
        """, (country_id,))
        
        ipv4_products = cursor.fetchall()
        print(f"  Found {len(ipv4_products)} products to process")
        
        for product_id, product_name, description in ipv4_products:
            # Check if product already exists in IPv6 country
            cursor.execute("""
                SELECT id FROM catalog_items 
                WHERE parent_id = ? AND name = ? AND type = 'product'
            """, (new_country_id, product_name))
            
            existing_product = cursor.fetchone()
            
            if not existing_product:
                # Copy the product
                try:
                    # Copy the product item
                    cursor.execute("""
                        INSERT INTO catalog_items 
                        (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
                         row_width, position, is_grid_3x6, search_button_name, back_button_text)
                        SELECT ?, type, name, description, sticker_id, photo_id, preview_link, 
                               row_width, position, is_grid_3x6, search_button_name, back_button_text
                        FROM catalog_items 
                        WHERE id = ?
                    """, (new_country_id, product_id))
                    
                    new_product_id = cursor.lastrowid
                    conn.commit()
                    
                    # Update description to mention IPv6 instead of IPv4
                    if description:
                        new_description = description.replace("Приватный IPv4", "Приватный IPv6")
                        cursor.execute("UPDATE catalog_items SET description = ? WHERE id = ?", (new_description, new_product_id))
                        conn.commit()
                    
                    # Copy product price
                    cursor.execute("SELECT price, currency, expiration_days FROM product_prices WHERE product_id = ?", (product_id,))
                    price_data = cursor.fetchone()
                    if price_data:
                        price, currency, expiration_days = price_data
                        cursor.execute("""
                            INSERT OR REPLACE INTO product_prices (product_id, price, currency, expiration_days)
                            VALUES (?, ?, ?, ?)
                        """, (new_product_id, price, currency, expiration_days))
                        conn.commit()
                    
                    # Copy product files
                    cursor.execute("""
                        SELECT file_id, file_type, file_name, position, day_period 
                        FROM product_files 
                        WHERE product_id = ? 
                        ORDER BY position
                    """, (product_id,))
                    
                    files = cursor.fetchall()
                    for file_data in files:
                        cursor.execute("""
                            INSERT INTO product_files (product_id, file_id, file_type, file_name, position, day_period)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (new_product_id, *file_data))
                        conn.commit()
                    
                    copied_products += 1
                    print(f"    Copied product: {product_name}")
                except Exception as e:
                    print(f"    Error copying product '{product_name}': {e}")
            else:
                print(f"    Product '{product_name}' already exists in IPv6 country")
    
    conn.close()
    return copied_countries, copied_products

def copy_all_countries():
    batch_size = 10
    start_index = 0
    total_countries = 0
    total_products = 0
    
    while True:
        try:
            copied_countries, copied_products = copy_country_batch(start_index, batch_size)
            
            if copied_countries == 0 and copied_products == 0:
                # No more countries to process
                break
                
            total_countries += copied_countries
            total_products += copied_products
            start_index += batch_size
            
            print(f"Batch completed. Total so far: {total_countries} countries, {total_products} products")
            print("Waiting 2 seconds before next batch...")
            time.sleep(2)
            
        except Exception as e:
            print(f"Error in batch processing: {e}")
            break
    
    print(f"\nFinished copying all countries!")
    print(f"Total countries copied: {total_countries}")
    print(f"Total products copied: {total_products}")

if __name__ == "__main__":
    copy_all_countries()