import sqlite3
import random

def copy_catalog_item(conn, source_id, new_parent_id, name_suffix=""):
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
    
    # Modify name if needed (for IPv6)
    if name_suffix:
        new_name = name + name_suffix
    else:
        new_name = name
    
    # Insert the new item
    cursor.execute("""
        INSERT INTO catalog_items 
        (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
         row_width, position, is_grid_3x6, search_button_name, back_button_text,
         file_id, file_type, file_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (new_parent_id, item_type, new_name, description, sticker_id, photo_id, preview_link, 
          row_width, position, is_grid_3x6, search_button_name, back_button_text,
          file_id, file_type, file_name))
    
    new_id = cursor.lastrowid
    conn.commit()
    
    print(f"  Copied item: {name} -> {new_name} (ID: {source_id} -> {new_id})")
    
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
    print(f"Found {len(ipv4_countries)} countries to copy")
    
    copied_countries = 0
    copied_products = 0
    
    for country_id, country_name in ipv4_countries:
        print(f"\nProcessing country: {country_name} (ID: {country_id})")
        
        # Check if this country already exists in IPv6
        clean_country_name = country_name[2:] if country_name.startswith('🇦') else country_name
        ipv6_country_name = '🇦' + clean_country_name[1:] if clean_country_name.startswith('🇷') else '🇦' + clean_country_name
        
        cursor.execute("""
            SELECT id FROM catalog_items 
            WHERE parent_id = ? AND name = ? AND type = 'subcategory'
        """, (ipv6_id, ipv6_country_name))
        
        existing_country = cursor.fetchone()
        
        if existing_country:
            # Country already exists, get its ID
            new_country_id = existing_country[0]
            print(f"  Country already exists in IPv6 (ID: {new_country_id})")
        else:
            # Copy the country to IPv6
            new_country_id = copy_catalog_item(conn, country_id, ipv6_id)
            if new_country_id:
                copied_countries += 1
                # Update the name to have the correct flag
                cursor.execute("UPDATE catalog_items SET name = ? WHERE id = ?", (ipv6_country_name, new_country_id))
                conn.commit()
                print(f"  Created new country in IPv6: {ipv6_country_name} (ID: {new_country_id})")
        
        # Now copy all products (regions) from IPv4 country to IPv6 country
        cursor.execute("""
            SELECT id, name FROM catalog_items 
            WHERE parent_id = ? AND type = 'product' 
            ORDER BY position
        """, (country_id,))
        
        ipv4_products = cursor.fetchall()
        print(f"  Found {len(ipv4_products)} products to copy")
        
        for product_id, product_name in ipv4_products:
            # Check if product already exists in IPv6 country
            cursor.execute("""
                SELECT id FROM catalog_items 
                WHERE parent_id = ? AND name = ? AND type = 'product'
            """, (new_country_id, product_name))
            
            existing_product = cursor.fetchone()
            
            if not existing_product:
                # Copy the product
                new_product_id = copy_catalog_item(conn, product_id, new_country_id)
                if new_product_id:
                    copied_products += 1
                    # Update description to mention IPv6 instead of IPv4
                    cursor.execute("SELECT description FROM catalog_items WHERE id = ?", (new_product_id,))
                    description = cursor.fetchone()[0]
                    if description:
                        new_description = description.replace("Приватный IPv4", "Приватный IPv6")
                        cursor.execute("UPDATE catalog_items SET description = ? WHERE id = ?", (new_description, new_product_id))
                        conn.commit()
            else:
                print(f"    Product '{product_name}' already exists in IPv6 country")
    
    print(f"\nFinished copying!")
    print(f"Countries copied/updated: {copied_countries}")
    print(f"Products copied: {copied_products}")
    
    conn.close()

if __name__ == "__main__":
    copy_ipv4_to_ipv6()