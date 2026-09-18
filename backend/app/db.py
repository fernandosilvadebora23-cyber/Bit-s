"""Database layer. Single Mongo connection reused across the app.

All documents use their own string ids (uuid or slug). We never expose Mongo's
`_id`; every read projects it out with {"_id": 0}.
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Collections (kept as attributes for clarity / discoverability)
users = db["users"]
providers = db["providers"]
addresses = db["addresses"]
services = db["services"]
regions = db["regions"]
orders = db["orders"]
order_events = db["order_events"]
matching_attempts = db["matching_attempts"]
payments = db["payments"]
payouts = db["payouts"]
reviews = db["reviews"]
notifications = db["notifications"]
system_settings = db["system_settings"]


async def create_indexes():
    await users.create_index("user_id", unique=True)
    await users.create_index("email", unique=True)
    await providers.create_index("user_id", unique=True)
    await orders.create_index("order_id", unique=True)
    await orders.create_index("customer_id")
    await orders.create_index("provider_id")
    await order_events.create_index("order_id")
    await notifications.create_index("user_id")
    await reviews.create_index("provider_id")
