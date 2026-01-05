-- RPC Function to atomically check and insert an invite
-- Prevents race conditions where multiple processes invite the same player
-- or invite players to a match that just became full.

CREATE OR REPLACE FUNCTION attempt_insert_invite(
  p_match_id UUID,
  p_player_id UUID,
  p_status TEXT,
  p_batch_number INTEGER,
  p_sent_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ,
  p_invite_score FLOAT DEFAULT NULL,
  p_score_breakdown JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_team_1_count INT;
  v_team_2_count INT;
  v_invite_exists BOOLEAN;
BEGIN
  -- 1. Lock the match row to ensure we have the latest state
  -- This serializes operations on this specific match
  SELECT * INTO v_match 
  FROM matches 
  WHERE match_id = p_match_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'MATCH_NOT_FOUND';
  END IF;

  -- 2. Check if Match is already full (via match_participations)
  SELECT COUNT(*) INTO v_team_1_count 
  FROM match_participations 
  WHERE match_id = p_match_id;

  IF v_team_1_count >= 4 THEN
    RETURN 'MATCH_FULL';
  END IF;

  -- 3. Check if player is already invited
  SELECT EXISTS(
    SELECT 1 FROM match_invites 
    WHERE match_id = p_match_id AND player_id = p_player_id
  ) INTO v_invite_exists;

  IF v_invite_exists THEN
    RETURN 'ALREADY_INVITED';
  END IF;

  -- 4. Check if player is already in the match (via match_participations)
  SELECT EXISTS(
    SELECT 1 FROM match_participations 
    WHERE match_id = p_match_id AND player_id = p_player_id
  ) INTO v_invite_exists;

  IF v_invite_exists THEN
    RETURN 'ALREADY_IN_MATCH';
  END IF;

  -- 5. Insert the invite
  INSERT INTO match_invites (
    match_id,
    player_id,
    status,
    batch_number,
    sent_at,
    expires_at,
    invite_score,
    score_breakdown
  ) VALUES (
    p_match_id,
    p_player_id,
    p_status,
    p_batch_number,
    p_sent_at,
    p_expires_at,
    p_invite_score,
    p_score_breakdown
  );

  RETURN 'SUCCESS';
END;
$$;
