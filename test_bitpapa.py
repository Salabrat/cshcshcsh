#!/usr/bin/env python3
"""
Test script for BitPAPA integration
"""

import asyncio
from database import db
from bitpapa_handlers import test_bitpapa_connection, create_bitpapa_payment

async def main():
    """Test BitPAPA integration"""
    print("🧪 Testing BitPAPA Integration")
    print("=" * 50)
    
    # Connect to database
    await db.connect()
    
    try:
        # Test 1: Connection Test
        print("\n1. Testing BitPAPA Connection...")
        connection_result = await test_bitpapa_connection()
        print(f"   Result: {connection_result}")
        
        # Test 2: Create Test Payment
        print("\n2. Testing BitPAPA Payment Creation...")
        payment_result = await create_bitpapa_payment(
            user_id=123456789,
            amount=100,
            order_code="TEST001"
        )
        
        if payment_result:
            print(f"   ✅ Payment created successfully!")
            print(f"   Payment ID: {payment_result.get('payment_id', 'unknown')}")
            print(f"   Payment URL: {payment_result.get('payment_url', 'unknown')}")
            if payment_result.get('fallback'):
                print(f"   ⚠️ Using fallback URL (API may be unavailable)")
        else:
            print(f"   ❌ Payment creation failed")
        
        print("\n✅ BitPAPA Integration Test Completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())