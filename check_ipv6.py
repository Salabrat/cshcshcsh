import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Check if "Приватный IPv6" category exists
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv6%' OR name LIKE '%Private IPv6%'")
ipv6_results = cursor.fetchall()

print("IPv6 Categories found:")
for result in ipv6_results:
    print(f"ID: {result[0]}, Name: {result[1]}")

# Check if "Приватный IPv4" category exists
cursor.execute("SELECT id, name FROM catalog_items WHERE name LIKE '%Приватный IPv4%' OR name LIKE '%Private IPv4%'")
ipv4_results = cursor.fetchall()

print("\nIPv4 Categories found:")
for result in ipv4_results:
    print(f"ID: {result[0]}, Name: {result[1]}")

conn.close()