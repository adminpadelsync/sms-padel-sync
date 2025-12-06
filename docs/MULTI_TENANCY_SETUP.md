# Multi-Tenancy Migration Guide

This guide walks you through setting up multi-tenancy for club-based data isolation.

## Step 0: Disable Email Confirmation (Recommended for Development)

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Click on **Email** provider
3. **Uncheck** "Confirm email"
4. Click **Save**

This allows you to login immediately after signup without email verification.

## Step 1: Run the Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `backend/migrations/001_add_multi_tenancy.sql`
3. Paste and run the SQL
4. Verify success message appears

## Step 2: Create Your Superuser Account

1. **Sign up** at http://localhost:3000/login
   - Use your email (e.g., `adam@yourcompany.com`)
   - Choose a password
   
2. **Run the setup script:**
   ```bash
   cd /Users/adamrogers/Documents/sms-padel-sync
   source .venv/bin/activate
   python3 backend/setup_superuser.py adam@yourcompany.com
   ```

3. **Verify:**
   - You should see: ✅ Success! adam@yourcompany.com is now a superuser
   - Refresh the dashboard - you should see "Superuser Dashboard" and a purple "Superuser" badge

## Step 3: Test Multi-Tenancy

### Create Test Clubs

Run this in Supabase SQL Editor:

```sql
-- Create two test clubs
INSERT INTO clubs (name, court_count, phone_number, settings)
VALUES 
  ('South Beach Padel', 6, '+15005550001', '{"business_hours": "8am-10pm"}'),
  ('North Beach Padel', 4, '+15005550002', '{"business_hours": "9am-9pm"}');
```

### Create Test Club Admin

1. Sign up a new account at http://localhost:3000/login
   - Email: `clubadmin@test.com`
   - Password: anything

2. Associate them with a club (run in Supabase SQL Editor):

```sql
-- Get the club_id for South Beach Padel
SELECT club_id, name FROM clubs;

-- Insert user (replace USER_ID with the auth user ID from Supabase Auth Users page)
-- Replace CLUB_ID with the club_id from above
INSERT INTO users (user_id, club_id, email, role, is_superuser)
VALUES 
  ('USER_ID_HERE', 'CLUB_ID_HERE', 'clubadmin@test.com', 'club_admin', false);
```

### Verify Isolation

1. **As Superuser:**
   - Login as your superuser account
   - You should see ALL players from ALL clubs
   - Header shows "Superuser Dashboard" with purple badge

2. **As Club Admin:**
   - Logout and login as `clubadmin@test.com`
   - You should ONLY see players from South Beach Padel
   - Header shows "Admin Dashboard" with club name "South Beach Padel"
   - Try creating a player - it should be assigned to South Beach Padel

3. **Test RLS:**
   - Create players in both clubs (as superuser)
   - Verify club admin can only see their club's players
   - Try to access another club's data directly - should be blocked by RLS

## Step 4: Clean Up Test Data (Optional)

If you want to start fresh:

```sql
-- Delete all test data
DELETE FROM players;
DELETE FROM matches;
DELETE FROM users WHERE email LIKE '%test.com';
DELETE FROM clubs WHERE name LIKE '%Test%';
```

## Troubleshooting

### "User not found in system" error when creating players

**Cause:** Your user account exists in Supabase Auth but not in the `users` table.

**Fix:** Run the superuser setup script or manually insert into users table.

### Can't see any data after migration

**Cause:** RLS is now enforced, and your user isn't in the `users` table.

**Fix:** Run the superuser setup script for your account.

### "No club associated with user" error

**Cause:** Club admin user has no club_id.

**Fix:** Update the users table to set their club_id:

```sql
UPDATE users 
SET club_id = 'CLUB_ID_HERE' 
WHERE email = 'user@example.com';
```

## Next Steps

Once multi-tenancy is working:

1. **Build Superuser UI** - Add pages for managing clubs and users
2. **Invitation Flow** - Allow superusers to invite club admins
3. **Club Selection** - For superusers creating players, add club selector
4. **Audit Logging** - Track who created/modified what
