-- Create table for storing Golden Test Cases for the Reasoner
CREATE TABLE IF NOT EXISTS reasoner_test_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  initial_state TEXT DEFAULT 'IDLE',
  steps JSONB NOT NULL, -- List of {user_input, expected_intent, expected_entities}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a comment for documentation
COMMENT ON TABLE reasoner_test_cases IS 'Stores "Golden" conversational scenarios used for regression testing the AI Reasoner.';
