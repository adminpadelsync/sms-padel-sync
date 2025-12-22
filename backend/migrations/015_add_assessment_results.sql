-- Migration: Add assessment_results table
-- Created: 2025-12-22

CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_name TEXT,
    responses JSONB NOT NULL,
    rating DECIMAL(3,2) NOT NULL,
    breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE assessment_results IS 'Stores results of Padel level assessments for evaluation.';
