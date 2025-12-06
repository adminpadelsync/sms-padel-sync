-- SMS Outbox table for test mode
-- Stores outbound SMS messages when SMS_TEST_MODE=true

CREATE TABLE IF NOT EXISTS sms_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Index for efficient polling
CREATE INDEX IF NOT EXISTS idx_sms_outbox_unread ON sms_outbox(to_number, created_at) WHERE read_at IS NULL;
