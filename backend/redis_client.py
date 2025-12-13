import os
import json
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
            # Serialize dicts/lists to JSON strings for Redis storage
            if isinstance(v, (dict, list)):
                r.hset(key, k, json.dumps(v))
            else:
                r.hset(key, k, v)
    # Set expiry to 1 hour to clear stale sessions
    r.expire(key, 3600)
    return True

def get_user_state(phone_number: str):
    r = get_redis_client()
    if not r:
        return None
    
    key = f"user:{phone_number}"
    data = r.hgetall(key)
    
    # Deserialize any JSON strings back to dicts/lists
    for k, v in data.items():
        if isinstance(v, str) and v.startswith('{') or (isinstance(v, str) and v.startswith('[')):
            try:
                data[k] = json.loads(v)
            except json.JSONDecodeError:
                pass
    
    return data

def clear_user_state(phone_number: str):
    r = get_redis_client()
    if not r:
        return False
    key = f"user:{phone_number}"
    r.delete(key)
    return True

