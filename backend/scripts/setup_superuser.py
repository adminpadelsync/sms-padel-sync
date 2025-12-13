#!/usr/bin/env python3
"""
Superuser Setup Script
Run this after signing up your first admin account to make it a superuser.

Usage:
    python3 backend/setup_superuser.py your-email@example.com
"""

import sys
import os
from database import supabase
from dotenv import load_dotenv

load_dotenv()

def setup_superuser(email: str):
    """
    Make a user a superuser by their email address.
    The user must have already signed up via the web interface.
    """
    print(f"Setting up superuser for email: {email}")
    
    # Get the user from Supabase Auth by email
    try:
        # Note: This requires service_role key to query auth.users
        response = supabase.auth.admin.list_users()
        users = response
        
        # Find user by email
        user = None
        for u in users:
            if u.email == email:
                user = u
                break
        
        if not user:
            print(f"❌ Error: No user found with email {email}")
            print("Please sign up first at http://localhost:3000/login")
            return False
        
        user_id = user.id
        print(f"✓ Found user: {user.email} (ID: {user_id})")
        
    except Exception as e:
        print(f"❌ Error finding user: {e}")
        print("Make sure SUPABASE_SERVICE_ROLE_KEY is set in backend/.env")
        return False
    
    # Check if user already exists in users table
    existing = supabase.table("users").select("*").eq("user_id", user_id).execute()
    
    if existing.data:
        # Update existing user to superuser
        result = supabase.table("users").update({
            "is_superuser": True,
            "role": "superuser",
            "club_id": None  # Superusers don't belong to a specific club
        }).eq("user_id", user_id).execute()
        print(f"✓ Updated existing user to superuser")
    else:
        # Insert new superuser record
        result = supabase.table("users").insert({
            "user_id": user_id,
            "email": email,
            "role": "superuser",
            "is_superuser": True,
            "club_id": None,
            "active": True
        }).execute()
        print(f"✓ Created new superuser record")
    
    print(f"\n✅ Success! {email} is now a superuser")
    print(f"You can now login and access all clubs")
    return True

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 backend/setup_superuser.py your-email@example.com")
        sys.exit(1)
    
    email = sys.argv[1]
    success = setup_superuser(email)
    sys.exit(0 if success else 1)
