import sqlite3
import time
import random

def copy_catalog_item(conn, source_id, new_parent_id):
    """
    Copy a catalog item and all its children recursively
    """
    cursor = conn.cursor()
    
    # Get the source item
    cursor.execute("""
        SELECT parent_id, type, name, description, sticker_id, photo_id, preview_link, 
               row_width, position, is_grid_3x6, search_button_name, back_button_text,
               file_id, file_type, file_name
        FROM catalog_items 
        WHERE id = ?
    """, (source_id,))
    
    source_item = cursor.fetchone()
    if not source_item:
        print(f"Source item {source_id} not found")
        return None
    
    # Extract values
    (parent_id, item_type, name, description, sticker_id, photo_id, preview_link, 
     row_width, position, is_grid_3x6, search_button_name, back_button_text,
     file_id, file_type, file_name) = source_item
    
    # Check if item already exists
    cursor.execute("""
        SELECT id FROM catalog_items 
        WHERE parent_id = ? AND name = ? AND type = ?
    """, (new_parent_id, name, item_type))
    
    existing_item = cursor.fetchone()
    if existing_item:
        print(f"  Item '{name}' already exists (ID: {existing_item[0]})")
        return existing_item[0]
    
    # Insert the new item
    cursor.execute("""
        INSERT INTO catalog_items 
        (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
         row_width, position, is_grid_3x6, search_button_name, back_button_text,
         file_id, file_type, file_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (new_parent_id, item_type, name, description, sticker_id, photo_id, preview_link, 
          row_width, position, is_grid_3x6, search_button_name, back_button_text,
          file_id, file_type, file_name))
    
    new_id = cursor.lastrowid
    conn.commit()
    
    print(f"  Copied item: {name} (ID: {source_id} -> {new_id})")
    
    # If this is a product, also copy its price and files
    if item_type == 'product':
        # Copy product price
        cursor.execute("SELECT price, currency, expiration_days FROM product_prices WHERE product_id = ?", (source_id,))
        price_data = cursor.fetchone()
        if price_data:
            price, currency, expiration_days = price_data
            cursor.execute("""
                INSERT OR REPLACE INTO product_prices (product_id, price, currency, expiration_days)
                VALUES (?, ?, ?, ?)
            """, (new_id, price, currency, expiration_days))
            conn.commit()
            print(f"    Copied price data")
        
        # Copy product files
        cursor.execute("""
            SELECT file_id, file_type, file_name, position, day_period 
            FROM product_files 
            WHERE product_id = ? 
            ORDER BY position
        """, (source_id,))
        
        files = cursor.fetchall()
        for file_id, file_type, file_name, position, day_period in files:
            cursor.execute("""
                INSERT INTO product_files (product_id, file_id, file_type, file_name, position, day_period)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (new_id, file_id, file_type, file_name, position, day_period))
            conn.commit()
        print(f"    Copied {len(files)} files")
    
    # Copy children recursively
    cursor.execute("SELECT id FROM catalog_items WHERE parent_id = ?", (source_id,))
    children = cursor.fetchall()
    
    for child in children:
        copy_catalog_item(conn, child[0], new_id)
    
    return new_id

def copy_ipv4_to_ipv6():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Get the "Приватный IPv4" category
    cursor.execute("SELECT id, name FROM catalog_items WHERE name = '👤Приватный IPv4'")
    ipv4_category = cursor.fetchone()
    
    # Get the "Приватные IPv6" category
    cursor.execute("SELECT id, name FROM catalog_items WHERE name = '👤 Приватные IPv6'")
    ipv6_category = cursor.fetchone()
    
    if not ipv4_category:
        print("IPv4 category not found!")
        conn.close()
        return
    
    if not ipv6_category:
        print("IPv6 category not found!")
        conn.close()
        return
    
    ipv4_id = ipv4_category[0]
    ipv6_id = ipv6_category[0]
    
    print(f"Copying from IPv4 (ID: {ipv4_id}) to IPv6 (ID: {ipv6_id})")
    
    # Get all countries (subcategories) from IPv4
    cursor.execute("""
        SELECT id, name FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory' 
        ORDER BY name
    """, (ipv4_id,))
    
    ipv4_countries = cursor.fetchall()
    print(f"Found {len(ipv4_countries)} countries to process")
    
    copied_countries = 0
    copied_products = 0
    
    for country_id, country_name in ipv4_countries:
        print(f"\nProcessing country: {country_name} (ID: {country_id})")
        
        # Check if this country already exists in IPv6
        cursor.execute("""
            SELECT id FROM catalog_items 
            WHERE parent_id = ? AND name = ? AND type = 'subcategory'
        """, (ipv6_id, country_name))
        
        existing_country = cursor.fetchone()
        
        if existing_country:
            # Country already exists, get its ID
            new_country_id = existing_country[0]
            print(f"  Country already exists in IPv6 (ID: {new_country_id})")
        else:
            # Copy the country to IPv6
            try:
                new_country_id = copy_catalog_item(conn, country_id, ipv6_id)
                if new_country_id:
                    copied_countries += 1
                    print(f"  Created new country in IPv6: {country_name} (ID: {new_country_id})")
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e):
                    print("Database is locked, waiting...")
                    time.sleep(1)
                    continue
                else:
                    raise e
        
        # Now copy all products (regions) from IPv4 country to IPv6 country
        cursor.execute("""
            SELECT id, name FROM catalog_items 
            WHERE parent_id = ? AND type = 'product' 
            ORDER BY position
        """, (country_id,))
        
        ipv4_products = cursor.fetchall()
        print(f"  Found {len(ipv4_products)} products to process")
        
        for product_id, product_name in ipv4_products:
            # Check if product already exists in IPv6 country
            cursor.execute("""
                SELECT id FROM catalog_items 
                WHERE parent_id = ? AND name = ? AND type = 'product'
            """, (new_country_id, product_name))
            
            existing_product = cursor.fetchone()
            
            if not existing_product:
                # Copy the product
                try:
                    new_product_id = copy_catalog_item(conn, product_id, new_country_id)
                    if new_product_id:
                        copied_products += 1
                        # Update description to mention IPv6 instead of IPv4
                        cursor.execute("SELECT description FROM catalog_items WHERE id = ?", (new_product_id,))
                        description_result = cursor.fetchone()
                        if description_result and description_result[0]:
                            description = description_result[0]
                            new_description = description.replace("Приватный IPv4", "Приватный IPv6")
                            cursor.execute("UPDATE catalog_items SET description = ? WHERE id = ?", (new_description, new_product_id))
                            conn.commit()
                except sqlite3.OperationalError as e:
                    if "database is locked" in str(e):
                        print("Database is locked, waiting...")
                        time.sleep(1)
                        continue
                    else:
                        raise e
            else:
                print(f"    Product '{product_name}' already exists in IPv6 country")
    
    print(f"\nFinished copying!")
    print(f"Countries copied/updated: {copied_countries}")
    print(f"Products copied: {copied_products}")
    
    conn.close()

if __name__ == "__main__":
    copy_ipv4_to_ipv6()