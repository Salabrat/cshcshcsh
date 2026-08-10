import sqlite3

def check_ipv6_usa():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватные IPv6" category ID
    cursor.execute("SELECT id FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv6_category:
        print("IPv6 category not found!")
        conn.close()
        return
    
    ipv6_id = ipv6_category[0]
    
    # Search for USA in IPv6
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND name = '🇺🇸США' AND type = 'subcategory'
        ORDER BY name
    """, (ipv6_id,))
    
    results = cursor.fetchall()
    
    if results:
        print("IPv6 countries matching 'США':")
        for country_id, country_name in results:
            print(f"  ID: {country_id}, Name: {country_name}")
            
            # Check products
            cursor.execute("""
                SELECT COUNT(*) FROM catalog_items 
                WHERE parent_id = ? AND type = 'product'
            """, (country_id,))
            
            product_count = cursor.fetchone()[0]
            print(f"    Products: {product_count}")
    else:
        print("No IPv6 countries matching 'США'")
        
        # Let's try to copy the USA from IPv4 to IPv6
        print("\nCopying USA from IPv4 to IPv6...")
        
        # Get IPv4 USA
        cursor.execute("SELECT id FROM catalog_items WHERE name = '🇺🇸США' AND parent_id = (SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4')")
        ipv4_usa = cursor.fetchone()
        
        if ipv4_usa:
            ipv4_usa_id = ipv4_usa[0]
            print(f"Found IPv4 USA with ID: {ipv4_usa_id}")
            
            # Copy the country
            cursor.execute("""
                INSERT INTO catalog_items 
                (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
                 row_width, position, is_grid_3x6, search_button_name, back_button_text)
                SELECT ?, type, name, description, sticker_id, photo_id, preview_link, 
                       row_width, position, is_grid_3x6, search_button_name, back_button_text
                FROM catalog_items 
                WHERE id = ?
            """, (ipv6_id, ipv4_usa_id))
            
            new_country_id = cursor.lastrowid
            conn.commit()
            print(f"Created IPv6 USA with ID: {new_country_id}")
            
            # Copy all products for this country
            cursor.execute("""
                SELECT id, name, description FROM catalog_items 
                WHERE parent_id = ? AND type = 'product' 
                ORDER BY position
            """, (ipv4_usa_id,))
            
            products = cursor.fetchall()
            print(f"Copying {len(products)} products")
            
            for product_id, product_name, description in products:
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
                
                print(f"  Copied product: {product_name}")
            
            print(f"Completed copying USA and its products")
        else:
            print("IPv4 USA not found")
    
    conn.close()

if __name__ == "__main__":
    check_ipv6_usa()