-- Error Logs Table for debugging SMS errors
CREATE TABLE IF NOT EXISTS error_logs (
    error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Context
    phone_number VARCHAR(20),
    player_id UUID REFERENCES players(player_id),
    club_id UUID REFERENCES clubs(club_id),
    
    -- Error details
    error_type VARCHAR(100),  -- e.g., 'match_creation', 'invite_response', 'sms_parsing'
    error_message TEXT,
    stack_trace TEXT,
    
    -- Request context
    sms_body TEXT,
    handler_name VARCHAR(100),
    additional_context JSONB
);

-- Index for querying recent errors
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);

-- Index for querying by phone number
CREATE INDEX IF NOT EXISTS idx_error_logs_phone ON error_logs(phone_number);

-- Index for querying by error type
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
