-- STAGE 5: SECURITY FOR CLUB MEMBERS
-- Enable RLS on the junction table
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- 1. Users can view memberships for their own clubs
DROP POLICY IF EXISTS "Users can view memberships for their club" ON club_members;
CREATE POLICY "Users can view memberships for their club" ON club_members FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
);

-- 2. Club admins can manage memberships for their own clubs
DROP POLICY IF EXISTS "Club admins can manage memberships for their club" ON club_members;
CREATE POLICY "Club admins can manage memberships for their club" ON club_members FOR ALL
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
);
