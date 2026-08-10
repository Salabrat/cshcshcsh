import asyncio
from keyboards import order_payment_methods_kb

async def test_keyboard():
    print("Testing keyboard generation...")
    try:
        keyboard = await order_payment_methods_kb("TEST123")
        print(f"Generated keyboard: {keyboard}")
        print(f"Keyboard type: {type(keyboard)}")
        print("Test completed successfully!")
    except Exception as e:
        print(f"Error in test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_keyboard())