import asyncio
from database import db

async def update_token():
    await db.connect()
    await db.set_api_token('bitpapa', '1wGD6uPJ-xwNPCBUmHDx')
    print('✅ BitPAPA token updated to: 1wGD6uPJ-xwNPCBUmHDx')
    await db.close()

if __name__ == "__main__":
    asyncio.run(update_token())