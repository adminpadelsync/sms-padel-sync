from fastapi import HTTPException, Depends, Header
from typing import Optional, List
from database import supabase
import uuid

class UserContext:
    def __init__(self, user_id: str, email: str, is_superuser: bool, role: str, club_ids: List[str]):
        self.user_id = user_id
        self.email = email
        self.is_superuser = is_superuser
        self.role = role
        self.club_ids = club_ids

async def get_current_user(authorization: Optional[str] = Header(None)) -> UserContext:
    """
    Dependency to get the current authenticated user and their scoped clubs.
    Expects a JWT in the Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
         print(f"DEBUG: Missing or invalid Authorization header. Header exists: {authorization is not None}")
         raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split(" ")[1]
    print(f"DEBUG: Token received, length: {len(token)}")
    
    try:
        # Verify token with Supabase
        user_res = supabase.auth.get_user(token)
        if not user_res.user:
            print("DEBUG: Supabase auth.get_user returned no user")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = user_res.user.id
        email = user_res.user.email
        print(f"DEBUG: Token verified for user: {email} ({user_id})")
        
        # Fetch role and club assignments
        user_data_res = supabase.table("users").select("is_superuser, role").eq("user_id", user_id).single().execute()
        
        if not user_data_res.data:
            print(f"DEBUG: User {user_id} not found in 'users' table")
            raise HTTPException(status_code=403, detail="User record not found in application database")
        
        is_superuser = user_data_res.data.get("is_superuser", False)
        global_role = user_data_res.data.get("role", "club_staff")
        
        # Get accessible clubs
        club_ids = []
        try:
            clubs_res = supabase.table("user_clubs").select("club_id").eq("user_id", user_id).execute()
            club_ids = [c["club_id"] for c in (clubs_res.data or [])]
        except Exception as e:
            # Fallback for transition: check legacy users table
            print(f"Warning: user_clubs table check failed, falling back to legacy users table: {e}")
            legacy_club_res = supabase.table("users").select("club_id").eq("user_id", user_id).single().execute()
            if legacy_club_res.data and legacy_club_res.data.get("club_id"):
                club_ids = [legacy_club_res.data["club_id"]]
        
        return UserContext(
            user_id=user_id,
            email=email,
            is_superuser=is_superuser,
            role=global_role,
            club_ids=club_ids
        )
        
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail=str(e))

def require_superuser(user: UserContext = Depends(get_current_user)):
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    return user

def require_club_access(club_id: str, user: UserContext = Depends(get_current_user)):
    """
    Validates that the user has access to the specified club_id.
    Superusers bypass this check.
    """
    if user.is_superuser:
        return user
    
    if club_id not in user.club_ids:
        raise HTTPException(status_code=403, detail=f"Access denied to club {club_id}")
    
    return user
