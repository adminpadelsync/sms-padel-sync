-- Fix for Infinite Recursion in RLS Policies
-- Run this in Supabase SQL Editor to replace the problematic policies

-- First, drop the existing policies on users table
DROP POLICY IF EXISTS "Users can view their own record" ON users;
DROP POLICY IF EXISTS "Superusers can manage all users" ON users;

-- Create new policies that don't cause recursion
-- These policies use auth.uid() directly without checking the users table

-- Allow users to view their own record
CREATE POLICY "Users can view their own record"
  ON users FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to insert their own record (for signup flow)
CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own record
CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (user_id = auth.uid());

-- For superuser management, we'll handle this via service role key in the backend
-- The frontend will use the service role key for superuser operations

-- Success message
SELECT 'RLS policies fixed! Infinite recursion resolved.' as message;
