#!/usr/bin/env python3
"""
Test script for BitPAPA order payment integration
"""

import asyncio
from database import db
from bitpapa_handlers import test_bitpapa_connection, create_bitpapa_payment

async def main():
    """Test BitPAPA order payment integration"""
    print("🧪 Testing BitPAPA Order Payment Integration")
    print("=" * 50)
    
    # Connect to database
    await db.connect()
    
    try:
        # Test 1: Connection Test
        print("\n1. Testing BitPAPA Connection...")
        connection_result = await test_bitpapa_connection()
        print(f"   Result: {connection_result}")
        
        # Test 2: Create Test Order Payment
        print("\n2. Testing BitPAPA Order Payment Creation...")
        payment_result = await create_bitpapa_payment(
            user_id=123456789,
            amount=100,
            order_code="ORDER_TEST001"
        )
        
        if payment_result:
            print(f"   ✅ Order payment created successfully!")
            print(f"   Payment ID: {payment_result.get('payment_id', 'unknown')}")
            print(f"   Payment URL: {payment_result.get('payment_url', 'unknown')}")
            if payment_result.get('direct'):
                print(f"   ⚠️ Using direct URL approach")
        else:
            print(f"   ❌ Order payment creation failed")
        
        print("\n✅ BitPAPA Order Payment Integration Test Completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())