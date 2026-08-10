#!/usr/bin/env python3
"""
Test script to demonstrate multi-admin status updates functionality.
This simulates how bot status messages will be sent to all administrators.
"""

import asyncio
from database import Database
from config import cfg

async def test_admin_retrieval():
    """Test retrieving all administrators from database"""
    print("🧪 Testing Admin Retrieval...")
    
    # Initialize database
    db = Database()
    await db.connect()
    
    try:
        # Get all admins
        admins = await db.get_all_admins()
        print(f"📊 Found {len(admins)} administrators:")
        
        for i, admin in enumerate(admins, 1):
            user_id, username, added_by, added_at = admin
            print(f"  {i}. ID: {user_id}, Username: {username}, Added: {added_at}")
        
        # Extract admin IDs (this is what send_status_update will use)
        admin_ids = [admin[0] for admin in admins]
        print(f"\n📋 Admin IDs for status updates: {admin_ids}")
        
        return admin_ids
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []
    finally:
        await db.close()

async def simulate_status_update(admin_ids):
    """Simulate how status updates would be sent to all admins"""
    print("\n🚀 Simulating Status Update to All Admins...")
    
    # This is what the actual send_status_update function would do:
    status_message = """🤖 **Bot Status**
🕐 2025-08-30 11:39:56

🤖 Telegram Bot Starting...
📊 Python Version: 3.10.0
📂 Working Directory: D:\sbsoft\SHOP_paymentandprofile19

✅ Bot connecting to Telegram...
✅ Database connected
✅ Commands set successfully
✅ Menu Button installed
✅ Payment check task started  
✅ CryptoBot task started
✅ CryptoBot connected successfully: Thirteen Prawn App
🚀 Bot successfully started!"""

    print("📨 Would send the following message to all admins:")
    print("-" * 50)
    print(status_message)
    print("-" * 50)
    
    for admin_id in admin_ids:
        print(f"📤 Sending status update to admin {admin_id}")
        # In real implementation: await bot.send_message(admin_id, status_message)
    
    print(f"\n✅ Status update sent to {len(admin_ids)} administrators!")

async def main():
    """Main test function"""
    print("🔧 Multi-Admin Status Update Test")
    print("=" * 40)
    
    # Test admin retrieval
    admin_ids = await test_admin_retrieval()
    
    if admin_ids:
        # Simulate status update
        await simulate_status_update(admin_ids)
    else:
        print("⚠️ No admins found - would fallback to main admin only")
        if cfg.ADMIN_ID:
            await simulate_status_update([cfg.ADMIN_ID])
    
    print("\n🎉 Test completed!")
    print("\nℹ️ In the actual bot:")
    print("   • Status messages will automatically update in real-time")
    print("   • All administrators will receive bot status notifications")
    print("   • Messages will be updated in-place (not spam multiple messages)")

if __name__ == "__main__":
    asyncio.run(main())