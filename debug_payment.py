#!/usr/bin/env python3
"""
Debug script to check payment status and BitPAPA integration
"""

import asyncio
from database import db

async def debug_payment_and_bitpapa():
    """Debug payment and BitPAPA issues"""
    print("🔍 Debugging Payment and BitPAPA Issues")
    print("=" * 60)
    
    await db.connect()
    
    try:
        # Test 1: Check payment methods
        print("\n1. Checking payment methods...")
        try:
            payment_methods = await db.get_payment_methods_with_layout()
            print(f"   ✅ Found {len(payment_methods)} payment methods:")
            for method in payment_methods:
                method_id, method_name, is_enabled, row_number, position_in_row = method
                status = "✅" if is_enabled else "❌"
                print(f"   {status} {method_name} (ID: {method_id}, Row: {row_number}, Pos: {position_in_row})")
                
            # Check if we have any enabled methods
            enabled_methods = [method for method in payment_methods if method[2]]  # is_enabled is at index 2
            print(f"   📊 Total: {len(payment_methods)} methods, {len(enabled_methods)} enabled")
            
        except Exception as e:
            print(f"   ❌ Error checking payment methods: {e}")
            import traceback
            traceback.print_exc()
            
        # Test 2: Check specific payment B87Q8MY
        print("\n2. Checking payment B87Q8MY...")
        payment = await db.get_payment("B87Q8MY")
        if payment:
            print(f"   ✅ Payment found: {payment}")
            print(f"   - ID: {payment[0]}")
            print(f"   - User ID: {payment[1]}")
            print(f"   - Amount: {payment[2]}₽")
            print(f"   - Code: {payment[3]}")
            print(f"   - Status: {payment[4]}")
            print(f"   - Method: {payment[5]}")
            print(f"   - Created: {payment[6]}")
            print(f"   - Expires: {payment[7]}")
        else:
            print("   ❌ Payment B87Q8MY not found")
            
        # Test 2.5: Check specific payment L20Y8WN too
        print("\n2.5. Checking payment L20Y8WN...")
        payment_l = await db.get_payment("L20Y8WN")
        if payment_l:
            print(f"   ✅ Payment found: {payment_l}")
        else:
            print("   ❌ Payment L20Y8WN not found")
            
        # Test 3: List recent payments
        print("\n3. Listing recent payments...")
        if db.conn:
            cursor = await db.conn.execute('''
                SELECT code, user_id, amount, status, method, created_at 
                FROM payments 
                ORDER BY created_at DESC 
                LIMIT 10
            ''')
            recent_payments = await cursor.fetchall()
            
            if recent_payments:
                print(f"   Found {len(recent_payments)} recent payments:")
                for i, payment in enumerate(recent_payments, 1):
                    print(f"   {i}. {payment[0]} - {payment[2]}₽ ({payment[3]}) - {payment[5] or 'No method'}")
            else:
                print("   No payments found in database")
        else:
            print("   ❌ Database connection not available")
            
        # Test 4: Check BitPAPA API token
        print("\n4. Checking BitPAPA API token...")
        bitpapa_token = await db.get_api_token('bitpapa')
        if bitpapa_token:
            masked_token = bitpapa_token[:10] + '...' + bitpapa_token[-10:] if len(bitpapa_token) > 20 else bitpapa_token
            print(f"   ✅ BitPAPA token found: {masked_token}")
        else:
            print("   ❌ BitPAPA token not found in database")
            
        # Test 5: Test BitPAPA connection
        print("\n5. Testing BitPAPA connection...")
        try:
            from bitpapa_handlers import test_bitpapa_connection
            connection_result = await test_bitpapa_connection()
            print(f"   Result: {connection_result}")
        except Exception as e:
            print(f"   ❌ Error testing BitPAPA: {e}")
            
        # Test 6: Create test payment for debugging
        print("\n6. Creating test payment...")
        try:
            test_code = "TEST123"
            test_payment_id = await db.create_payment(
                user_id=123456789,
                amount=100,
                code=test_code,
                expires_at="2025-12-31 23:59:59"
            )
            
            if test_payment_id:
                print(f"   ✅ Test payment created with ID: {test_payment_id}")
                
                # Try to retrieve it
                test_payment = await db.get_payment(test_code)
                if test_payment:
                    print(f"   ✅ Test payment retrieved: {test_payment}")
                    
                    # Test BitPAPA handler with test payment
                    print("\n7. Testing BitPAPA payment creation...")
                    try:
                        from bitpapa_handlers import create_bitpapa_payment
                        payment_data = await create_bitpapa_payment(123456789, 100, test_code)
                        
                        if payment_data:
                            print(f"   ✅ BitPAPA payment created: {payment_data.get('payment_id', 'unknown')}")
                            print(f"   Payment URL: {payment_data.get('payment_url', 'unknown')}")
                            if payment_data.get('fallback'):
                                print(f"   ⚠️ Using fallback method")
                        else:
                            print(f"   ❌ BitPAPA payment creation failed")
                            
                    except Exception as e:
                        print(f"   ❌ Error testing BitPAPA payment: {e}")
                        import traceback
                        traceback.print_exc()
                    
                    # Clean up test payment
                    if db.conn:
                        await db.conn.execute("DELETE FROM payments WHERE code = ?", (test_code,))
                        await db.conn.commit()
                    print(f"   🧹 Test payment cleaned up")
                else:
                    print(f"   ❌ Could not retrieve test payment")
            else:
                print(f"   ❌ Failed to create test payment")
                
        except Exception as e:
            print(f"   ❌ Error creating test payment: {e}")
        
        print("\n✅ Debug completed!")
        
    except Exception as e:
        print(f"\n❌ Debug failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(debug_payment_and_bitpapa())