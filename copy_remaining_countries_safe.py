import sqlite3
import time

def copy_country_safely(country_id, country_name, ipv6_id):
    """Copy a single country with proper error handling"""
    conn = None
    try:
        # Connect to the database
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        print(f"Copying country: {country_name}")
        
        # Copy the country
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
        
        # Copy all products for this country
        cursor.execute("""
            SELECT id, name, description FROM catalog_items 
            WHERE parent_id = ? AND type = 'product' 
            ORDER BY position
        """, (country_id,))
        
        products = cursor.fetchall()
        print(f"  Copying {len(products)} products")
        
        products_copied = 0
        for product_id, product_name, description in products:
            try:
                # Copy the product
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
                
                products_copied += 1
                
            except Exception as e:
                print(f"    Error copying product '{product_name}': {e}")
                # Continue with other products
                continue
        
        print(f"  Completed copying {country_name} ({products_copied} products)")
        return True
        
    except Exception as e:
        print(f"Error copying country {country_name}: {e}")
        return False
    finally:
        if conn:
            conn.close()

def copy_remaining_countries():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватный IPv4" category
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4'")
    ipv4_category = cursor.fetchone()
    
    # Get the "Приватные IPv6" category
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv4_category or not ipv6_category:
        print("Categories not found!")
        conn.close()
        return
    
    ipv4_id = ipv4_category[0]
    ipv6_id = ipv6_category[0]
    
    # Get all countries from IPv4
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' 
        ORDER BY name
    """, (ipv4_id,))
    
    ipv4_countries = cursor.fetchall()
    
    # Get all countries from IPv6
    cursor.execute("""
        SELECT name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' 
        ORDER BY name
    """, (ipv6_id,))
    
    ipv6_country_names = set(row[0] for row in cursor.fetchall())
    
    print(f"IPv4 countries: {len(ipv4_countries)}")
    print(f"IPv6 countries: {len(ipv6_country_names)}")
    
    # Find missing countries
    missing_countries = []
    for country_id, country_name in ipv4_countries:
        if country_name not in ipv6_country_names:
            missing_countries.append((country_id, country_name))
    
    print(f"Missing countries: {len(missing_countries)}")
    
    # Copy missing countries one by one
    copied_countries = 0
    for country_id, country_name in missing_countries:
        try:
            if copy_country_safely(country_id, country_name, ipv6_id):
                copied_countries += 1
                print(f"Successfully copied {country_name} ({copied_countries}/{len(missing_countries)})")
            else:
                print(f"Failed to copy {country_name}")
            
            # Small delay to avoid database locks
            time.sleep(0.5)
        except Exception as e:
            print(f"Error processing {country_name}: {e}")
            time.sleep(1)  # Longer delay on error
    
    print(f"\nFinished copying missing countries!")
    print(f"Copied {copied_countries} countries")
    
    conn.close()

if __name__ == "__main__":
    copy_remaining_countries()