import os
import redis
from dotenv import load_dotenv

load_dotenv()

redis_url = os.environ.get("REDIS_URL")

def get_redis_client():
    if not redis_url:
        print("Warning: REDIS_URL not set")
        return None
    try:
        return redis.from_url(redis_url, decode_responses=True)
    except Exception as e:
        print(f"Error connecting to Redis: {e}")
        return None

# State management helpers
def set_user_state(phone_number: str, state: str, data: dict = None):
    r = get_redis_client()
    if not r:
        return False
    
    key = f"user:{phone_number}"
    r.hset(key, "state", state)
    if data:
        for k, v in data.items():
            r.hset(key, k, v)
    # Set expiry to 1 hour to clear stale sessions
    r.expire(key, 3600)
    return True

def get_user_state(phone_number: str):
    r = get_redis_client()
    if not r:
        return None
    
    key = f"user:{phone_number}"
    return r.hgetall(key)

def clear_user_state(phone_number: str):
    r = get_redis_client()
    if not r:
        return False
    key = f"user:{phone_number}"
    r.delete(key)
    return True
